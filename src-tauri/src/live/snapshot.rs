//! Builds the snapshot from Live Client Data responses.
//!
//! Privacy and policy rules enforced here: the local player's own stats are
//! kept; for the other players only the public identity shown on the
//! scoreboard (Riot ID, champion, team, lane) is kept. Their items, runes,
//! summoner spells, scores and timers are parsed away and never leave Rust.
//! Bots and players whose Riot ID is hidden get no Riot ID (never looked up).

use crate::live::model::{
    LiveGame, LivePlayer, LiveSnapshot, RawGameStats, RawPlayer, RosterEntry,
};
use crate::live::source::{FetchError, LiveSource};

const RAW_CHAMPION_PREFIX: &str = "game_character_displayname_";

fn champion_key(raw: &str) -> Option<String> {
    raw.strip_prefix(RAW_CHAMPION_PREFIX)
        .filter(|key| !key.is_empty() && key.chars().all(|c| c.is_ascii_alphanumeric()))
        .map(String::from)
}

/// Pure: game stats + active player name + player list → snapshot.
pub fn build_snapshot(
    stats: &RawGameStats,
    active_name: Option<&str>,
    players: &[RawPlayer],
) -> LiveSnapshot {
    let game = LiveGame {
        mode: stats.game_mode.clone(),
        map_name: stats.map_name.clone(),
        map_number: stats.map_number,
        game_time_seconds: stats.game_time.max(0.0),
    };

    let me = active_name.and_then(|name| players.iter().find(|player| player.matches_name(name)));
    let player = me.map(|raw| {
        let minutes = game.game_time_seconds / 60.0;
        LivePlayer {
            riot_id: active_name.unwrap_or_default().to_string(),
            champion_name: raw.champion_name.clone(),
            champion_key: champion_key(&raw.raw_champion_name),
            level: raw.level,
            team: raw.team.clone(),
            position: Some(raw.position.clone())
                .filter(|value| !value.is_empty() && value != "NONE"),
            is_dead: raw.is_dead,
            kills: raw.scores.kills,
            deaths: raw.scores.deaths,
            assists: raw.scores.assists,
            creep_score: raw.scores.creep_score,
            ward_score: raw.scores.ward_score,
            cs_per_minute: (minutes >= 1.0).then(|| raw.scores.creep_score as f64 / minutes),
        }
    });

    let roster = players
        .iter()
        .map(|raw| {
            let is_me = active_name.is_some_and(|name| raw.matches_name(name));
            RosterEntry {
                riot_id: public_riot_id(raw),
                champion_name: raw.champion_name.clone(),
                champion_key: champion_key(&raw.raw_champion_name),
                team: raw.team.clone(),
                position: Some(raw.position.clone())
                    .filter(|value| !value.is_empty() && value != "NONE"),
                is_me,
                is_bot: raw.is_bot,
            }
        })
        .collect();

    let message = if player.is_none() {
        Some(
            "Partita rilevata, ma nessun giocatore attivo (spettatore o replay): nessun dato personale da mostrare."
                .to_string(),
        )
    } else {
        None
    };

    LiveSnapshot {
        status: "in_game".to_string(),
        game: Some(game),
        player,
        roster,
        message,
        updated_at_ms: 0,
    }
}

/// "Name#TAG" when the game shows it; `None` for bots and hidden names.
fn public_riot_id(raw: &RawPlayer) -> Option<String> {
    if raw.is_bot {
        return None;
    }
    match (&raw.riot_id_game_name, &raw.riot_id_tag_line) {
        (Some(name), Some(tag)) if !name.trim().is_empty() && !tag.trim().is_empty() => {
            Some(format!("{}#{}", name.trim(), tag.trim()))
        }
        _ => None,
    }
}

fn from_fetch_error(error: FetchError) -> LiveSnapshot {
    match error {
        FetchError::NotRunning => {
            LiveSnapshot::with_status("not_running", Some("Nessuna partita in corso."))
        }
        FetchError::Unavailable(_) => LiveSnapshot::with_status(
            "loading",
            Some("Client di gioco rilevato: dati non ancora disponibili (caricamento)."),
        ),
        FetchError::Invalid(detail) => {
            log::warn!("Live Client Data API: risposta non valida: {detail}");
            LiveSnapshot::with_status(
                "error",
                Some("Risposta non valida dalla Live Client Data API. Il dettaglio è nei log."),
            )
        }
    }
}

/// One check: three read-only GETs to the local API.
pub async fn poll_once<S: LiveSource>(source: &S) -> LiveSnapshot {
    let stats_body = match source.get("/liveclientdata/gamestats").await {
        Ok(body) => body,
        Err(error) => return from_fetch_error(error),
    };
    let stats: RawGameStats = match serde_json::from_str(&stats_body) {
        Ok(stats) => stats,
        Err(error) => return from_fetch_error(FetchError::Invalid(error.to_string())),
    };

    // A missing active player (spectator) is not an error.
    let active_name: Option<String> = match source.get("/liveclientdata/activeplayername").await {
        Ok(body) => serde_json::from_str(&body).ok(),
        Err(FetchError::NotRunning) => return from_fetch_error(FetchError::NotRunning),
        Err(_) => None,
    };

    let players: Vec<RawPlayer> = match source.get("/liveclientdata/playerlist").await {
        Ok(body) => match serde_json::from_str(&body) {
            Ok(players) => players,
            Err(error) => return from_fetch_error(FetchError::Invalid(error.to_string())),
        },
        Err(error) => return from_fetch_error(error),
    };

    build_snapshot(&stats, active_name.as_deref(), &players)
}
