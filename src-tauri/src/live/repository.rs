//! Persistence of the Live Game preferences in the `settings` table
//! (key/value JSON). Invalid stored values fall back to safe defaults:
//! detection off, overlay hidden.

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::AppError;
use crate::live::overlay::OverlaySettings;

const LIVE_ENABLED_KEY: &str = "live_enabled";
const OVERLAY_KEY: &str = "overlay";

fn read(conn: &Connection, key: &str) -> Result<Option<String>, AppError> {
    conn.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
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

pub fn live_enabled(conn: &Connection) -> Result<bool, AppError> {
    Ok(match read(conn, LIVE_ENABLED_KEY)? {
        Some(value) => serde_json::from_str::<bool>(&value).unwrap_or_else(|_| {
            log::warn!("Valore 'live_enabled' non valido, rilevamento disattivato.");
            false
        }),
        None => false,
    })
}

pub fn set_live_enabled(conn: &Connection, enabled: bool) -> Result<(), AppError> {
    write(conn, LIVE_ENABLED_KEY, &serde_json::to_string(&enabled)?)?;
    conn.execute(
        "INSERT INTO activity_log (kind, title, detail) VALUES ('settings', ?1, NULL)",
        params![if enabled {
            "Rilevamento partita attivato"
        } else {
            "Rilevamento partita disattivato"
        }],
    )?;
    Ok(())
}

pub fn overlay_settings(conn: &Connection) -> Result<OverlaySettings, AppError> {
    let Some(value) = read(conn, OVERLAY_KEY)? else {
        return Ok(OverlaySettings::default());
    };
    match serde_json::from_str::<OverlaySettings>(&value) {
        Ok(settings) if settings.validate().is_ok() => Ok(settings),
        _ => {
            log::warn!("Impostazioni overlay non valide nel database, uso i default.");
            Ok(OverlaySettings::default())
        }
    }
}

pub fn save_overlay_settings(
    conn: &Connection,
    settings: &OverlaySettings,
) -> Result<(), AppError> {
    settings.validate()?;
    write(conn, OVERLAY_KEY, &serde_json::to_string(settings)?)
}
