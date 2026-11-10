//! User preferences on champions: favorites and personally assigned lanes.
//! Keyed by the stable Riot champion id, so they survive patch changes.

use std::collections::{BTreeSet, HashMap, HashSet};

use rusqlite::{params, Connection, OptionalExtension};

use crate::catalog::dto::ChampionPreferences;
use crate::error::AppError;

/// Riot team positions, in display order.
pub const LANES: [&str; 5] = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

fn lane_order(lane: &str) -> usize {
    LANES
        .iter()
        .position(|item| *item == lane)
        .unwrap_or(LANES.len())
}

fn ensure_champion(conn: &Connection, champion_id: i64) -> Result<(), AppError> {
    let exists = conn
        .query_row(
            "SELECT 1 FROM champions WHERE id = ?1",
            [champion_id],
            |_| Ok(()),
        )
        .optional()?
        .is_some();

    if exists {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "campione {champion_id} non presente nel catalogo"
        )))
    }
}

/// Validates, deduplicates and orders lanes (TOP → UTILITY).
pub fn normalize_lanes(lanes: &[String]) -> Result<Vec<String>, AppError> {
    let mut unique = BTreeSet::new();
    for lane in lanes {
        if !LANES.contains(&lane.as_str()) {
            return Err(AppError::Validation(format!("corsia non valida: {lane}")));
        }
        unique.insert((lane_order(lane), lane.clone()));
    }
    Ok(unique.into_iter().map(|(_, lane)| lane).collect())
}

pub fn champion_preferences(
    conn: &Connection,
    champion_id: i64,
) -> Result<ChampionPreferences, AppError> {
    let favorite = conn
        .query_row(
            "SELECT 1 FROM favorite_champions WHERE champion_id = ?1",
            [champion_id],
            |_| Ok(()),
        )
        .optional()?
        .is_some();

    let mut statement =
        conn.prepare("SELECT lane FROM user_champion_lanes WHERE champion_id = ?1")?;
    let mut lanes = statement
        .query_map([champion_id], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    lanes.sort_by_key(|lane| lane_order(lane));

    Ok(ChampionPreferences {
        champion_id,
        favorite,
        lanes,
    })
}

pub fn set_favorite(
    conn: &Connection,
    champion_id: i64,
    favorite: bool,
) -> Result<ChampionPreferences, AppError> {
    ensure_champion(conn, champion_id)?;

    if favorite {
        conn.execute(
            "INSERT INTO favorite_champions (champion_id) VALUES (?1)
             ON CONFLICT(champion_id) DO NOTHING",
            [champion_id],
        )?;
    } else {
        conn.execute(
            "DELETE FROM favorite_champions WHERE champion_id = ?1",
            [champion_id],
        )?;
    }

    champion_preferences(conn, champion_id)
}

/// Replaces the user's lanes for one champion (empty list = no lanes).
pub fn set_lanes(
    conn: &mut Connection,
    champion_id: i64,
    lanes: &[String],
) -> Result<ChampionPreferences, AppError> {
    let lanes = normalize_lanes(lanes)?;
    ensure_champion(conn, champion_id)?;

    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM user_champion_lanes WHERE champion_id = ?1",
        [champion_id],
    )?;
    {
        let mut insert =
            tx.prepare("INSERT INTO user_champion_lanes (champion_id, lane) VALUES (?1, ?2)")?;
        for lane in &lanes {
            insert.execute(params![champion_id, lane])?;
        }
    }
    tx.commit()?;

    champion_preferences(conn, champion_id)
}

/// All favorites and lanes, for decorating catalog lists in one pass.
pub struct PreferenceIndex {
    favorites: HashSet<i64>,
    lanes: HashMap<i64, Vec<String>>,
}

impl PreferenceIndex {
    pub fn load(conn: &Connection) -> Result<Self, AppError> {
        let mut favorite_statement = conn.prepare("SELECT champion_id FROM favorite_champions")?;
        let favorites = favorite_statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<HashSet<_>, _>>()?;

        let mut lane_statement =
            conn.prepare("SELECT champion_id, lane FROM user_champion_lanes")?;
        let mut lanes: HashMap<i64, Vec<String>> = HashMap::new();
        for row in lane_statement.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })? {
            let (champion_id, lane) = row?;
            lanes.entry(champion_id).or_default().push(lane);
        }
        for list in lanes.values_mut() {
            list.sort_by_key(|lane| lane_order(lane));
        }

        Ok(Self { favorites, lanes })
    }

    pub fn is_favorite(&self, champion_id: i64) -> bool {
        self.favorites.contains(&champion_id)
    }

    pub fn lanes(&self, champion_id: i64) -> Vec<String> {
        self.lanes.get(&champion_id).cloned().unwrap_or_default()
    }
}
