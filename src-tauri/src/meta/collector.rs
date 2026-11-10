//! One collection step: refresh the ladder if needed, read the recent Ranked
//! Solo/Duo matches of one seed player and store the ones not seen before.
//!
//! Pacing: every request waits `PACE` first, so the collector uses about
//! half of a development key's budget (100 requests / 2 min per routing
//! value) and leaves room for the user's own profile syncs. 429 responses
//! are handled by the shared client (Retry-After).

use std::time::Duration;

use crate::db::Database;
use crate::error::AppError;
use crate::meta::store;
use crate::riot::client::RiotClient;
use crate::riot::league::{self, ApexLeague, LadderEntry};
use crate::riot::matches;
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;

pub const PACE: Duration = Duration::from_millis(2_500);
/// Ladder lists are refreshed once a day.
pub const SEED_REFRESH_HOURS: f64 = 24.0;
/// A seed player is read again only after this many hours.
pub const SEED_RECRAWL_HOURS: f64 = 12.0;
/// Highest-LP players kept per ladder.
pub const MAX_SEEDS: usize = 1_000;
/// Matches requested per seed player.
pub const MATCHES_PER_PLAYER: u32 = 20;
/// Only matches from the last two weeks.
pub const LOOKBACK_SECONDS: i64 = 14 * 24 * 3600;
/// Older patches are deleted to keep the database small.
pub const KEEP_PATCHES: usize = 3;

#[derive(Debug, Default, PartialEq, Eq)]
pub struct StepOutcome {
    /// Players in the refreshed ladder, when it was refreshed.
    pub seeded: Option<usize>,
    /// False when every seed player was read recently: nothing to do.
    pub worked: bool,
    pub new_matches: usize,
}

fn unique_puuids(mut entries: Vec<LadderEntry>) -> Vec<String> {
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.league_points));
    let mut seen = std::collections::HashSet::new();
    entries
        .into_iter()
        .filter_map(|entry| entry.puuid)
        .filter(|puuid| !puuid.is_empty() && puuid.len() <= 128)
        .filter(|puuid| seen.insert(puuid.clone()))
        .take(MAX_SEEDS)
        .collect()
}

async fn ladder<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    tier: &str,
) -> Result<Vec<String>, AppError> {
    let mut entries = Vec::new();
    if tier == "MASTER_PLUS" {
        for apex in [
            ApexLeague::Challenger,
            ApexLeague::Grandmaster,
            ApexLeague::Master,
        ] {
            client.pause(PACE).await;
            entries.extend(league::apex_league(client, platform, apex).await?);
        }
    } else {
        for division in ["I", "II"] {
            client.pause(PACE).await;
            entries.extend(league::ladder_page(client, platform, tier, division, 1).await?);
        }
    }
    Ok(unique_puuids(entries))
}

/// Older matches completed with their timeline at each step.
pub const TIMELINE_BACKFILL: i64 = 5;

/// Skill order and purchases of a stored match (one more request).
async fn fetch_timeline<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    db: &Database,
    platform: &str,
    match_id: &str,
) -> Result<(), AppError> {
    client.pause(PACE).await;
    match matches::timeline_by_id(client, platform, match_id).await {
        Ok(timeline) => db.with_connection(|conn| store::store_timeline(conn, match_id, &timeline)),
        // Not available: do not ask again.
        Err(AppError::NotFound(_)) => {
            db.with_connection(|conn| store::mark_timeline(conn, match_id))
        }
        Err(error) => Err(error),
    }
}

/// `keep_going` is checked before each match download, so turning the
/// collector off stops it within one request.
pub async fn step<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    db: &Database,
    settings: &store::Settings,
    now_epoch_seconds: i64,
    keep_going: &(dyn Fn() -> bool + Sync),
) -> Result<StepOutcome, AppError> {
    let platform = settings.platform.as_str();
    let tier = settings.seed_tier.as_str();
    let mut outcome = StepOutcome::default();

    let age = db.with_connection(|conn| store::seeds_age_hours(conn, platform, tier))?;
    if age.map_or(true, |hours| hours >= SEED_REFRESH_HOURS) {
        let puuids = ladder(client, platform, tier).await?;
        db.with_connection(|conn| store::replace_seeds(conn, platform, tier, &puuids))?;
        log::info!(
            "Statistiche globali: {} giocatori {tier} su {platform}",
            puuids.len()
        );
        outcome.seeded = Some(puuids.len());
    }

    let Some(puuid) =
        db.with_connection(|conn| store::next_seed(conn, platform, tier, SEED_RECRAWL_HOURS))?
    else {
        return Ok(outcome);
    };
    outcome.worked = true;

    client.pause(PACE).await;
    let ids = matches::ranked_solo_ids(
        client,
        platform,
        &puuid,
        now_epoch_seconds - LOOKBACK_SECONDS,
        MATCHES_PER_PLAYER,
    )
    .await?;
    db.with_connection(|conn| store::mark_crawled(conn, platform, &puuid))?;
    let known = db.with_connection(|conn| store::known_match_ids(conn, &ids))?;

    for id in ids.iter().filter(|id| !known.contains(*id)) {
        if !keep_going() {
            break;
        }
        client.pause(PACE).await;
        let data = match matches::by_id(client, platform, id).await {
            Ok((data, _raw)) => data,
            // Removed or not yet available: skip it, keep collecting.
            Err(AppError::NotFound(_)) => continue,
            Err(error) => return Err(error),
        };
        if data.info.queue_id != store::RANKED_SOLO_QUEUE {
            continue;
        }
        if db.with_connection(|conn| store::store_match(conn, platform, tier, &data))? {
            outcome.new_matches += 1;
            fetch_timeline(client, db, platform, id).await?;
        }
    }

    // Matches stored before timelines were collected.
    let missing =
        db.with_connection(|conn| store::missing_timelines(conn, platform, TIMELINE_BACKFILL))?;
    for id in &missing {
        if !keep_going() {
            break;
        }
        fetch_timeline(client, db, platform, id).await?;
    }

    let pruned = db.with_connection(|conn| store::prune_old_patches(conn, KEEP_PATCHES))?;
    if pruned > 0 {
        log::info!("Statistiche globali: {pruned} partite di patch vecchie eliminate");
    }
    Ok(outcome)
}
