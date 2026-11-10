//! Search and synchronisation with caching.
//!
//! * Each data type has a minimum refresh interval (TTL); within it the local
//!   copy is used and no request is sent.
//! * Finished matches never change: only ids not already stored are fetched.
//! * One sync per player at a time (`SyncLocks`).

use std::collections::HashSet;
use std::sync::Mutex;

use crate::db::Database;
use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::repository::{self, SyncField};
use crate::riot::routing::{is_platform, match_region};
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;
use crate::riot::{account, league, matches, summoner};

pub const PROFILE_TTL_MINUTES: f64 = 60.0;
pub const RANKED_TTL_MINUTES: f64 = 10.0;
pub const MATCHES_TTL_MINUTES: f64 = 3.0;
/// Match ids requested per sync (newest first).
pub const MATCHES_PER_SYNC: u32 = 20;

#[derive(Default)]
pub struct SyncLocks {
    running: Mutex<HashSet<String>>,
}

pub struct SyncGuard<'a> {
    locks: &'a SyncLocks,
    puuid: String,
}

impl Drop for SyncGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut running) = self.locks.running.lock() {
            running.remove(&self.puuid);
        }
    }
}

impl SyncLocks {
    pub fn acquire(&self, puuid: &str) -> Result<SyncGuard<'_>, AppError> {
        let mut running = self
            .running
            .lock()
            .map_err(|_| AppError::State("blocco sincronizzazione non disponibile".to_string()))?;
        if !running.insert(puuid.to_string()) {
            return Err(AppError::Busy(
                "Sincronizzazione di questo profilo già in corso.".to_string(),
            ));
        }
        Ok(SyncGuard {
            locks: self,
            puuid: puuid.to_string(),
        })
    }
}

/// Never synced, or synced at least `ttl` minutes ago.
pub fn stale(age_minutes: Option<f64>, ttl: f64) -> bool {
    match age_minutes {
        Some(minutes) => minutes >= ttl,
        None => true,
    }
}

/// Riot ID rules: game name 3–16 characters, tag 3–5 letters or digits.
pub fn validate_riot_id(game_name: &str, tag_line: &str) -> Result<(String, String), AppError> {
    let name = game_name.trim();
    let tag = tag_line.trim().trim_start_matches('#');
    let name_len = name.chars().count();
    if !(3..=16).contains(&name_len) {
        return Err(AppError::Validation(
            "il nome del Riot ID deve avere da 3 a 16 caratteri".to_string(),
        ));
    }
    let tag_len = tag.chars().count();
    if !(3..=5).contains(&tag_len) || !tag.chars().all(char::is_alphanumeric) {
        return Err(AppError::Validation(
            "il tag del Riot ID deve avere da 3 a 5 lettere o cifre".to_string(),
        ));
    }
    Ok((name.to_string(), tag.to_string()))
}

/// Resolves a Riot ID to a PUUID (local cache first), then syncs the player.
pub async fn search<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    db: &Database,
    locks: &SyncLocks,
    platform: &str,
    game_name: &str,
    tag_line: &str,
) -> Result<String, AppError> {
    if !is_platform(platform) {
        return Err(AppError::Validation(format!(
            "regione non supportata: {platform}"
        )));
    }
    let (name, tag) = validate_riot_id(game_name, tag_line)?;

    let cached =
        db.with_connection(|conn| repository::find_by_riot_id(conn, &name, &tag, platform))?;
    let puuid = match cached {
        Some((puuid, Some(age))) if age < PROFILE_TTL_MINUTES => puuid,
        _ => {
            let found = account::by_riot_id(client, platform, &name, &tag).await?;
            db.with_connection(|conn| {
                repository::upsert_player(
                    conn,
                    &found.puuid,
                    found.game_name.as_deref().unwrap_or(&name),
                    found.tag_line.as_deref().unwrap_or(&tag),
                    platform,
                    None,
                )
            })?;
            found.puuid
        }
    };

    sync_player(client, db, locks, &puuid, false).await?;
    Ok(puuid)
}

/// Refreshes stale data for a stored player. `force` ignores the TTLs (the
/// rate limiter and the "download each match once" rule still apply).
pub async fn sync_player<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    db: &Database,
    locks: &SyncLocks,
    puuid: &str,
    force: bool,
) -> Result<(), AppError> {
    let _guard = locks.acquire(puuid)?;
    let platform = db
        .with_connection(|conn| repository::player_region(conn, puuid))?
        .ok_or_else(|| AppError::NotFound("Profilo non presente in locale.".to_string()))?;

    let result = run_sync(client, db, puuid, &platform, force).await;
    if let Err(error) = &result {
        let message = error.user_message();
        // Best effort: the original error is what the user needs to see.
        let _ = db.with_connection(|conn| repository::set_last_error(conn, puuid, &message));
    }
    result
}

async fn run_sync<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    db: &Database,
    puuid: &str,
    platform: &str,
    force: bool,
) -> Result<(), AppError> {
    let ages = db.with_connection(|conn| repository::sync_ages(conn, puuid))?;

    if force || stale(ages.profile_minutes, PROFILE_TTL_MINUTES) {
        // Riot IDs can change: refresh it together with level and icon.
        let account = account::by_puuid(client, platform, puuid).await?;
        let profile = summoner::by_puuid(client, platform, puuid).await?;
        db.with_connection(|conn| {
            repository::upsert_player(
                conn,
                puuid,
                account.game_name.as_deref().unwrap_or_default(),
                account.tag_line.as_deref().unwrap_or_default(),
                platform,
                Some((profile.summoner_level, profile.profile_icon_id)),
            )?;
            repository::touch_sync(conn, puuid, SyncField::Profile)
        })?;
    }

    if force || stale(ages.ranked_minutes, RANKED_TTL_MINUTES) {
        let entries = league::entries_by_puuid(client, platform, puuid).await?;
        db.with_connection(|conn| {
            repository::replace_ranked(conn, puuid, &entries)?;
            repository::touch_sync(conn, puuid, SyncField::Ranked)
        })?;
    }

    if force || stale(ages.matches_minutes, MATCHES_TTL_MINUTES) {
        let regional = match_region(platform)
            .ok_or_else(|| AppError::Validation(format!("regione non supportata: {platform}")))?
            .as_str();
        let ids = matches::ids_by_puuid(client, platform, puuid, MATCHES_PER_SYNC).await?;
        let known = db.with_connection(|conn| repository::known_match_ids(conn, &ids))?;

        for id in ids.iter().filter(|id| !known.contains(*id)) {
            let (data, raw) = matches::by_id(client, platform, id).await?;
            db.with_connection(|conn| {
                repository::store_match(
                    conn,
                    regional,
                    &data,
                    &raw,
                    repository::MatchSource::RiotApi,
                )
            })?;
            // Link as we go: an interruption keeps what was already fetched.
            db.with_connection(|conn| {
                repository::link_matches(conn, puuid, std::slice::from_ref(id))
            })?;
        }
        db.with_connection(|conn| {
            repository::link_matches(conn, puuid, &ids)?;
            repository::touch_sync(conn, puuid, SyncField::Matches)
        })?;
    }

    Ok(())
}
