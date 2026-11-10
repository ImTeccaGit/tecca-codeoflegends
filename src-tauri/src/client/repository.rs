//! Client-account preferences in the `settings` table (key/value JSON).

use std::path::PathBuf;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

const ENABLED_KEY: &str = "client_sync_enabled";
const INSTALL_PATH_KEY: &str = "league_install_path";
const DETECTED_KEY: &str = "detected_riot_id";

fn read(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
        row.get(0)
    })
    .optional()
    .map_err(Into::into)
}

fn write(conn: &Connection, key: &str, value: &str) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET
           value = excluded.value,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        params![key, value],
    )?;
    Ok(())
}

/// Automatic account detection from the League client: on unless disabled.
pub fn sync_enabled(conn: &Connection) -> Result<bool, AppError> {
    Ok(read(conn, ENABLED_KEY)?
        .and_then(|value| serde_json::from_str::<bool>(&value).ok())
        .unwrap_or(true))
}

pub fn set_sync_enabled(conn: &Connection, enabled: bool) -> Result<(), AppError> {
    write(conn, ENABLED_KEY, &serde_json::to_string(&enabled)?)?;
    conn.execute(
        "INSERT INTO activity_log (kind, title, detail) VALUES ('settings', ?1, NULL)",
        params![if enabled {
            "Rilevamento account dal client attivato"
        } else {
            "Rilevamento account dal client disattivato"
        }],
    )?;
    Ok(())
}

pub fn install_path(conn: &Connection) -> Result<Option<PathBuf>, AppError> {
    Ok(read(conn, INSTALL_PATH_KEY)?
        .and_then(|value| {
            serde_json::from_str::<Option<String>>(&value)
                .ok()
                .flatten()
        })
        .map(PathBuf::from))
}

/// Saves (or clears) the manual install folder. Validated: absolute,
/// existing, containing `LeagueClient.exe`.
pub fn set_install_path(conn: &Connection, path: Option<&str>) -> Result<(), AppError> {
    if let Some(path) = path {
        let candidate = PathBuf::from(path.trim());
        if path.len() > 400 || !candidate.is_absolute() {
            return Err(AppError::Validation("percorso non valido".to_string()));
        }
        if !crate::client::lockfile::is_install_dir(&candidate) {
            return Err(AppError::Validation(
                "la cartella non contiene LeagueClient.exe".to_string(),
            ));
        }
        write(
            conn,
            INSTALL_PATH_KEY,
            &serde_json::to_string(&Some(path.trim()))?,
        )
    } else {
        write(conn, INSTALL_PATH_KEY, "null")
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectedRiotId {
    pub riot_id: String,
    /// ISO 8601 UTC.
    pub detected_at: String,
}

pub fn detected_riot_id(conn: &Connection) -> Result<Option<DetectedRiotId>, AppError> {
    Ok(read(conn, DETECTED_KEY)?.and_then(|value| serde_json::from_str(&value).ok()))
}

/// Stores the Riot ID seen in a live game. Returns true when it changed.
pub fn remember_riot_id(conn: &Connection, riot_id: &str) -> Result<bool, AppError> {
    let valid = riot_id.contains('#') && riot_id.chars().count() <= 40;
    if !valid {
        return Ok(false);
    }
    if detected_riot_id(conn)?.is_some_and(|known| known.riot_id == riot_id) {
        return Ok(false);
    }
    let now: String =
        conn.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| {
            row.get(0)
        })?;
    let value = DetectedRiotId {
        riot_id: riot_id.to_string(),
        detected_at: now,
    };
    write(conn, DETECTED_KEY, &serde_json::to_string(&value)?)?;
    Ok(true)
}

pub fn touch_client_sync(conn: &Connection, puuid: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE player_sync SET client_synced_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE puuid = ?1",
        [puuid],
    )?;
    Ok(())
}
