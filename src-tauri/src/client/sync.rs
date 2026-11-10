//! One synchronization from the running League client into the local
//! database: account, ranked entries and recent match history.
//!
//! Read-only GET endpoints used:
//! * `/lol-summoner/v1/current-summoner`
//! * `/riotclient/region-locale`
//! * `/lol-ranked/v1/current-ranked-stats`
//! * `/lol-match-history/v1/products/lol/current-summoner/matches`
//! * `/lol-match-history/v1/games/{gameId}`

use std::collections::HashMap;

use serde::Serialize;

use crate::catalog::repository::current_version;
use crate::client::convert::{
    self, ClientGame, CurrentSummoner, HistoryList, RankedStats, RegionLocale,
};
use crate::client::repository as client_repository;
use crate::client::source::{ClientError, ClientSource};
use crate::db::Database;
use crate::error::AppError;
use crate::riot::repository::{self, MatchSource, SyncField};
use crate::riot::routing::match_region;

/// Games read from the client history per synchronization.
pub const HISTORY_COUNT: i64 = 20;
const SOURCE_NAME: &str = "client di League of Legends";

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientAccount {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub region: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SyncOutcome {
    pub account: ClientAccount,
    pub new_matches: usize,
    pub ranked_queues: usize,
    /// Non-fatal problems (ranked or history unavailable), for the log.
    pub warnings: Vec<String>,
}

fn client_error(error: ClientError) -> AppError {
    match error {
        ClientError::NotRunning => {
            AppError::NotFound("Il client di League of Legends non è aperto.".to_string())
        }
        ClientError::Status(404) => AppError::NotFound(
            "Client aperto, ma nessun account ha ancora effettuato l'accesso.".to_string(),
        ),
        other => AppError::Network {
            source_name: SOURCE_NAME,
            detail: other.to_string(),
        },
    }
}

async fn get_json<S: ClientSource, T: serde::de::DeserializeOwned>(
    source: &S,
    path: &str,
) -> Result<(T, String), AppError> {
    let body = source.get(path).await.map_err(client_error)?;
    let parsed = serde_json::from_str(&body).map_err(|error| AppError::SourceData {
        source_name: SOURCE_NAME,
        detail: format!("{path}: {error}"),
    })?;
    Ok((parsed, body))
}

fn champion_keys(db: &Database) -> Result<HashMap<i64, String>, AppError> {
    db.with_connection(|conn| {
        let Some(version) = current_version(conn)? else {
            return Ok(HashMap::new());
        };
        let mut statement = conn.prepare(
            "SELECT champion_id, ddragon_id FROM champion_versions WHERE patch_version = ?1",
        )?;
        let keys = statement
            .query_map([version], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<HashMap<_, _>, _>>()?;
        Ok(keys)
    })
}

pub async fn sync<S: ClientSource>(db: &Database, source: &S) -> Result<SyncOutcome, AppError> {
    let (summoner, _) =
        get_json::<_, CurrentSummoner>(source, "/lol-summoner/v1/current-summoner").await?;
    if summoner.puuid.is_empty() || summoner.game_name.is_empty() {
        return Err(AppError::NotFound(
            "Client aperto, ma l'account non è ancora disponibile.".to_string(),
        ));
    }
    let mut warnings = Vec::new();

    // History first: its platform id is a fallback for the region.
    let history = match get_json::<_, HistoryList>(
        source,
        &format!(
            "/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=0&endIndex={}",
            HISTORY_COUNT - 1
        ),
    )
    .await
    {
        Ok((list, _)) => list.games.games,
        Err(error) => {
            warnings.push(format!("cronologia non disponibile: {error}"));
            Vec::new()
        }
    };

    let region_code = get_json::<_, RegionLocale>(source, "/riotclient/region-locale")
        .await
        .map(|(locale, _)| locale.region)
        .unwrap_or_default();
    let platform = convert::platform_from_region(&region_code)
        .or_else(|| {
            history
                .iter()
                .find_map(|entry| convert::platform_from_region(&entry.platform_id))
        })
        .ok_or_else(|| {
            AppError::Validation(format!(
                "regione del client non riconosciuta: {region_code}"
            ))
        })?;

    let account = ClientAccount {
        puuid: summoner.puuid.clone(),
        game_name: summoner.game_name.clone(),
        tag_line: summoner.tag_line.clone(),
        region: platform.to_string(),
    };
    let summoner_info = summoner.summoner_level.zip(summoner.profile_icon_id);
    db.with_connection(|conn| {
        repository::upsert_player(
            conn,
            &account.puuid,
            &account.game_name,
            &account.tag_line,
            platform,
            summoner_info,
        )?;
        // Saved automatically; becomes the primary profile only if none exists.
        repository::save_profile(conn, &account.puuid, false)?;
        repository::touch_sync(conn, &account.puuid, SyncField::Profile)
    })?;

    let mut ranked_queues = 0;
    match get_json::<_, RankedStats>(source, "/lol-ranked/v1/current-ranked-stats").await {
        Ok((stats, _)) => {
            let entries = convert::ranked_entries(&stats);
            ranked_queues = entries.len();
            db.with_connection(|conn| {
                repository::replace_ranked(conn, &account.puuid, &entries)?;
                repository::touch_sync(conn, &account.puuid, SyncField::Ranked)
            })?;
        }
        Err(error) => warnings.push(format!("rank non disponibile: {error}")),
    }

    let regional = match_region(platform)
        .map(|region| region.as_str())
        .unwrap_or("europe");
    let ids: Vec<(String, i64)> = history
        .iter()
        .filter_map(|entry| {
            Some((
                convert::match_id(&entry.platform_id, entry.game_id)?,
                entry.game_id,
            ))
        })
        .collect();
    let id_list: Vec<String> = ids.iter().map(|(id, _)| id.clone()).collect();
    let known = db.with_connection(|conn| repository::known_match_ids(conn, &id_list))?;
    let keys = champion_keys(db)?;

    let mut new_matches = 0;
    for (id, game_id) in ids.iter().filter(|(id, _)| !known.contains(id)) {
        let (game, raw) = match get_json::<_, ClientGame>(
            source,
            &format!("/lol-match-history/v1/games/{game_id}"),
        )
        .await
        {
            Ok(result) => result,
            Err(error) => {
                warnings.push(format!("partita {id}: {error}"));
                continue;
            }
        };
        let Some(dto) = convert::to_match(&game, |champion| keys.get(&champion).cloned()) else {
            warnings.push(format!("partita {id}: dati incompleti, ignorata"));
            continue;
        };
        if !dto
            .info
            .participants
            .iter()
            .any(|p| p.puuid == account.puuid)
        {
            warnings.push(format!("partita {id}: giocatore assente, ignorata"));
            continue;
        }
        db.with_connection(|conn| {
            repository::store_match(conn, regional, &dto, &raw, MatchSource::LeagueClient)?;
            repository::link_matches(
                conn,
                &account.puuid,
                std::slice::from_ref(&dto.metadata.match_id),
            )
        })?;
        new_matches += 1;
    }

    db.with_connection(|conn| {
        let linked: Vec<String> = id_list
            .into_iter()
            .filter(|id| known.contains(id))
            .collect();
        repository::link_matches(conn, &account.puuid, &linked)?;
        repository::touch_sync(conn, &account.puuid, SyncField::Matches)?;
        client_repository::touch_client_sync(conn, &account.puuid)
    })?;
    if new_matches > 0 {
        db.log_activity(
            "riot",
            "Partite lette dal client League",
            Some(&format!(
                "{}#{} · {new_matches} nuove",
                account.game_name, account.tag_line
            )),
        )?;
    }

    Ok(SyncOutcome {
        account,
        new_matches,
        ranked_queues,
        warnings,
    })
}
