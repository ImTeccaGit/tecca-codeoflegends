//! SQL and validation for custom jungle routes and practice clear attempts.
//! Every input is validated here even if the UI already did it.

use std::collections::HashSet;

use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::error::AppError;
use crate::jungle::dto::{AttemptInput, ClearAttempt, ClearSplit, CustomRoute, RouteInput};
use crate::jungle::{CAMP_IDS, MAX_CLEAR_MS, MAX_NAME_LENGTH, MAX_NOTES_LENGTH, SIDES};

/// Attempts returned to the UI (newest first).
const MAX_ATTEMPTS_LISTED: i64 = 1000;

fn invalid(message: impl Into<String>) -> AppError {
    AppError::Validation(message.into())
}

fn validate_side(side: &str) -> Result<(), AppError> {
    if SIDES.contains(&side) {
        Ok(())
    } else {
        Err(invalid(format!("lato non valido: {side}")))
    }
}

fn validate_name(name: &str, what: &str) -> Result<String, AppError> {
    let trimmed = name.trim();
    if trimmed.is_empty() || trimmed.chars().count() > MAX_NAME_LENGTH {
        return Err(invalid(format!(
            "{what}: da 1 a {MAX_NAME_LENGTH} caratteri"
        )));
    }
    Ok(trimmed.to_string())
}

/// Known camps only, no repetitions, between `min` and all camps.
fn validate_camps(camps: &[String], min: usize) -> Result<(), AppError> {
    if camps.len() < min || camps.len() > CAMP_IDS.len() {
        return Err(invalid(format!(
            "il percorso deve avere da {min} a {} campi",
            CAMP_IDS.len()
        )));
    }
    let mut seen = HashSet::new();
    for camp in camps {
        if !CAMP_IDS.contains(&camp.as_str()) {
            return Err(invalid(format!("campo sconosciuto: {camp}")));
        }
        if !seen.insert(camp) {
            return Err(invalid(format!("campo ripetuto nel percorso: {camp}")));
        }
    }
    Ok(())
}

fn validate_champion(conn: &Connection, champion_id: Option<i64>) -> Result<(), AppError> {
    let Some(id) = champion_id else {
        return Ok(());
    };
    let exists = conn
        .query_row("SELECT 1 FROM champions WHERE id = ?1", [id], |_| Ok(()))
        .optional()?
        .is_some();
    if exists {
        Ok(())
    } else {
        Err(invalid(format!("campione {id} non presente nel catalogo")))
    }
}

fn parse_camps(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_default()
}

/* ------------------------------------------------------------------------ */
/* Custom routes (table `jungle_routes`, migration 0001)                     */
/* ------------------------------------------------------------------------ */

fn map_route(row: &Row<'_>) -> rusqlite::Result<CustomRoute> {
    let steps: String = row.get(3)?;
    Ok(CustomRoute {
        id: row.get(0)?,
        name: row.get(1)?,
        side: row.get(2)?,
        camps: parse_camps(&steps),
        notes: row.get(4)?,
        champion_id: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

const ROUTE_COLUMNS: &str =
    "id, name, side, steps_json, notes, champion_id, created_at, updated_at";

pub fn list_routes(conn: &Connection) -> Result<Vec<CustomRoute>, AppError> {
    let mut statement = conn.prepare(&format!(
        "SELECT {ROUTE_COLUMNS} FROM jungle_routes ORDER BY name COLLATE NOCASE"
    ))?;
    let routes = statement
        .query_map([], map_route)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(routes)
}

fn get_route(conn: &Connection, id: &str) -> Result<Option<CustomRoute>, AppError> {
    Ok(conn
        .query_row(
            &format!("SELECT {ROUTE_COLUMNS} FROM jungle_routes WHERE id = ?1"),
            [id],
            map_route,
        )
        .optional()?)
}

/// Creates a route, or updates it when `input.id` is set.
pub fn save_route(conn: &Connection, input: &RouteInput) -> Result<CustomRoute, AppError> {
    let name = validate_name(&input.name, "nome del percorso")?;
    validate_side(&input.side)?;
    validate_camps(&input.camps, 2)?;
    validate_champion(conn, input.champion_id)?;

    let notes = input
        .notes
        .as_deref()
        .map(str::trim)
        .filter(|text| !text.is_empty());
    if notes.is_some_and(|text| text.chars().count() > MAX_NOTES_LENGTH) {
        return Err(invalid(format!(
            "note: massimo {MAX_NOTES_LENGTH} caratteri"
        )));
    }
    let steps_json = serde_json::to_string(&input.camps)?;

    let id = match &input.id {
        Some(id) => {
            let changed = conn.execute(
                "UPDATE jungle_routes
                 SET name = ?2, side = ?3, steps_json = ?4, notes = ?5, champion_id = ?6,
                     updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                 WHERE id = ?1",
                params![id, name, input.side, steps_json, notes, input.champion_id],
            )?;
            if changed == 0 {
                return Err(invalid("percorso personalizzato non trovato"));
            }
            id.clone()
        }
        None => conn.query_row(
            "INSERT INTO jungle_routes (id, name, side, steps_json, notes, champion_id)
             VALUES ('custom-' || lower(hex(randomblob(8))), ?1, ?2, ?3, ?4, ?5)
             RETURNING id",
            params![name, input.side, steps_json, notes, input.champion_id],
            |row| row.get(0),
        )?,
    };

    get_route(conn, &id)?.ok_or_else(|| invalid("percorso personalizzato non trovato"))
}

/// Deletes a custom route. Recorded attempts keep their own route snapshot.
pub fn delete_route(conn: &Connection, id: &str) -> Result<(), AppError> {
    let changed = conn.execute("DELETE FROM jungle_routes WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(invalid("percorso personalizzato non trovato"));
    }
    Ok(())
}

/* ------------------------------------------------------------------------ */
/* Clear attempts                                                            */
/* ------------------------------------------------------------------------ */

pub fn save_attempt(conn: &mut Connection, input: &AttemptInput) -> Result<ClearAttempt, AppError> {
    let route_key = input.route_key.trim();
    if route_key.is_empty() || route_key.chars().count() > 80 {
        return Err(invalid("percorso del tentativo non valido"));
    }
    let route_name = validate_name(&input.route_name, "nome del percorso")?;
    validate_side(&input.side)?;
    validate_camps(&input.camps, 1)?;
    validate_champion(conn, input.champion_id)?;

    if input.splits_ms.len() != input.camps.len() {
        return Err(invalid(
            "ogni campo del percorso deve avere il proprio tempo",
        ));
    }
    let mut previous = 0;
    for split in &input.splits_ms {
        if *split <= previous {
            return Err(invalid("i tempi dei campi devono essere crescenti"));
        }
        previous = *split;
    }
    let total_ms = previous;
    if total_ms > MAX_CLEAR_MS {
        return Err(invalid("tempo di clear oltre il massimo di 30 minuti"));
    }

    let tx = conn.transaction()?;
    let id: i64 = tx.query_row(
        "INSERT INTO jungle_clear_attempts
            (route_key, route_name, side, camps_json, total_ms, champion_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING id",
        params![
            route_key,
            route_name,
            input.side,
            serde_json::to_string(&input.camps)?,
            total_ms,
            input.champion_id,
        ],
        |row| row.get(0),
    )?;
    {
        let mut split = tx.prepare(
            "INSERT INTO jungle_clear_splits (attempt_id, step_index, camp_id, split_ms)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        for (index, (camp, split_ms)) in input.camps.iter().zip(&input.splits_ms).enumerate() {
            split.execute(params![id, index as i64, camp, split_ms])?;
        }
    }
    tx.commit()?;

    list_attempts(conn)?
        .into_iter()
        .find(|attempt| attempt.id == id)
        .ok_or_else(|| AppError::State("tentativo appena salvato non trovato".to_string()))
}

pub fn list_attempts(conn: &Connection) -> Result<Vec<ClearAttempt>, AppError> {
    let mut statement = conn.prepare(
        "SELECT a.id, a.route_key, a.route_name, a.side, a.camps_json, a.total_ms,
                a.champion_id, c.name, a.created_at
         FROM jungle_clear_attempts a
         LEFT JOIN champions c ON c.id = a.champion_id
         ORDER BY a.id DESC
         LIMIT ?1",
    )?;
    let mut attempts = statement
        .query_map([MAX_ATTEMPTS_LISTED], |row| {
            let camps: String = row.get(4)?;
            Ok(ClearAttempt {
                id: row.get(0)?,
                route_key: row.get(1)?,
                route_name: row.get(2)?,
                side: row.get(3)?,
                camps: parse_camps(&camps),
                total_ms: row.get(5)?,
                champion_id: row.get(6)?,
                champion_name: row.get(7)?,
                created_at: row.get(8)?,
                splits: Vec::new(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut split_statement = conn.prepare(
        "SELECT step_index, camp_id, split_ms FROM jungle_clear_splits
         WHERE attempt_id = ?1 ORDER BY step_index",
    )?;
    for attempt in &mut attempts {
        attempt.splits = split_statement
            .query_map([attempt.id], |row| {
                Ok(ClearSplit {
                    step_index: row.get(0)?,
                    camp_id: row.get(1)?,
                    split_ms: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
    }

    Ok(attempts)
}

pub fn delete_attempt(conn: &Connection, id: i64) -> Result<(), AppError> {
    let changed = conn.execute("DELETE FROM jungle_clear_attempts WHERE id = ?1", [id])?;
    if changed == 0 {
        return Err(invalid("tentativo non trovato"));
    }
    Ok(())
}
