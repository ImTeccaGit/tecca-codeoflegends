//! Reads the analysis dataset from SQLite (stored match-v5 data only).

use std::collections::HashMap;

use rusqlite::{params, Connection, OptionalExtension};

use crate::analysis::dto::{
    AnalysisDataset, AnalysisItem, AnalysisMatch, ChampionRef, LaneOpponent,
};
use crate::error::AppError;
use crate::riot::repository::{ranked_entries, sources_label, StaticIndex};

/// Upper bound of matches analysed per player (newest first).
pub const ANALYSIS_MATCH_LIMIT: i64 = 1000;

/// "14.23.636.1234" → "14.23". `None` when the version is not numeric.
pub fn patch_of(version: &str) -> Option<String> {
    let mut parts = version.split('.');
    let major = parts.next()?;
    let minor = parts.next()?;
    let numeric = |part: &str| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit());
    (numeric(major) && numeric(minor)).then(|| format!("{major}.{minor}"))
}

struct Participant {
    puuid: String,
    champion_id: i64,
    champion_name: Option<String>,
    team_id: Option<i64>,
    team_position: Option<String>,
    kills: i64,
    deaths: i64,
    assists: i64,
    creep_score: i64,
    gold_earned: i64,
    vision_score: i64,
    damage_dealt: Option<i64>,
    damage_taken: Option<i64>,
}

fn champion_ref(index: &StaticIndex, id: i64, fallback: Option<&str>) -> ChampionRef {
    ChampionRef {
        champion_id: id,
        champion_name: index
            .champion_names
            .get(&id)
            .cloned()
            .or_else(|| fallback.map(String::from))
            .unwrap_or_else(|| format!("Campione {id}")),
        image_url: index.champion_images.get(&id).cloned(),
    }
}

fn participants_by_match(
    conn: &Connection,
    puuid: &str,
) -> Result<HashMap<String, Vec<Participant>>, AppError> {
    let mut statement = conn.prepare(
        "SELECT p.match_id, p.puuid, p.champion_id, p.champion_name, p.team_id,
                p.team_position, p.kills, p.deaths, p.assists, p.cs, p.gold,
                p.vision_score, p.damage_to_champions, p.damage_taken
         FROM player_matches pm
         JOIN match_participants p ON p.match_id = pm.match_id
         WHERE pm.puuid = ?1",
    )?;
    let mut grouped: HashMap<String, Vec<Participant>> = HashMap::new();
    for row in statement.query_map([puuid], |row| {
        Ok((
            row.get::<_, String>(0)?,
            Participant {
                puuid: row.get(1)?,
                champion_id: row.get::<_, Option<i64>>(2)?.unwrap_or_default(),
                champion_name: row.get(3)?,
                team_id: row.get(4)?,
                team_position: row.get(5)?,
                kills: row.get(6)?,
                deaths: row.get(7)?,
                assists: row.get(8)?,
                creep_score: row.get(9)?,
                gold_earned: row.get(10)?,
                vision_score: row.get(11)?,
                damage_dealt: row.get(12)?,
                damage_taken: row.get(13)?,
            },
        ))
    })? {
        let (match_id, participant) = row?;
        grouped.entry(match_id).or_default().push(participant);
    }
    Ok(grouped)
}

fn bans_by_match(conn: &Connection, puuid: &str) -> Result<HashMap<String, Vec<i64>>, AppError> {
    let mut statement = conn.prepare(
        "SELECT b.match_id, b.champion_id
         FROM player_matches pm
         JOIN match_bans b ON b.match_id = pm.match_id
         WHERE pm.puuid = ?1
         ORDER BY b.team_id, b.pick_turn",
    )?;
    let mut grouped: HashMap<String, Vec<i64>> = HashMap::new();
    for row in statement.query_map([puuid], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
    })? {
        let (match_id, champion_id) = row?;
        let bans = grouped.entry(match_id).or_default();
        if !bans.contains(&champion_id) {
            bans.push(champion_id);
        }
    }
    Ok(grouped)
}

pub fn dataset(conn: &Connection, puuid: &str) -> Result<Option<AnalysisDataset>, AppError> {
    let base = conn
        .query_row(
            "SELECT p.game_name, p.tag_line, p.region, s.matches_synced_at
             FROM players p LEFT JOIN player_sync s ON s.puuid = p.puuid
             WHERE p.puuid = ?1",
            [puuid],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            },
        )
        .optional()?;
    let Some((game_name, tag_line, region, matches_synced_at)) = base else {
        return Ok(None);
    };

    let index = StaticIndex::load(conn)?;
    let mut participants = participants_by_match(conn, puuid)?;
    let mut bans = bans_by_match(conn, puuid)?;

    let mut statement = conn.prepare(
        "SELECT m.match_id, m.queue_id, m.game_mode, m.game_version,
                strftime('%Y-%m-%dT%H:%M:%fZ', m.game_creation / 1000.0, 'unixepoch'),
                m.game_duration, m.ended_early, p.win, p.champ_level,
                p.items_json, p.perks_json
         FROM player_matches pm
         JOIN matches m ON m.match_id = pm.match_id
         JOIN match_participants p ON p.match_id = m.match_id AND p.puuid = pm.puuid
         WHERE pm.puuid = ?1
         ORDER BY m.game_creation DESC
         LIMIT ?2",
    )?;
    let rows = statement
        .query_map(params![puuid, ANALYSIS_MATCH_LIMIT], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, i64>(5)?,
                row.get::<_, bool>(6)?,
                row.get::<_, bool>(7)?,
                row.get::<_, Option<i64>>(8)?,
                row.get::<_, Option<String>>(9)?,
                row.get::<_, Option<String>>(10)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut matches = Vec::with_capacity(rows.len());
    for (
        match_id,
        queue_id,
        game_mode,
        game_version,
        played_at,
        duration_seconds,
        ended_early,
        win,
        champ_level,
        items_json,
        perks_json,
    ) in rows
    {
        let everyone = participants.remove(&match_id).unwrap_or_default();
        let Some(me) = everyone.iter().find(|p| p.puuid == puuid) else {
            log::warn!("Partita {match_id} senza riga del giocatore: esclusa dall'analisi.");
            continue;
        };

        let same_team = |p: &Participant| p.team_id.is_some() && p.team_id == me.team_id;
        let team_kills = everyone
            .iter()
            .filter(|p| same_team(p))
            .map(|p| p.kills)
            .sum();
        let allies = everyone
            .iter()
            .filter(|p| same_team(p) && p.puuid != me.puuid)
            .map(|p| champion_ref(&index, p.champion_id, p.champion_name.as_deref()))
            .collect();
        let enemies = everyone
            .iter()
            .filter(|p| p.team_id.is_some() && !same_team(p))
            .map(|p| champion_ref(&index, p.champion_id, p.champion_name.as_deref()))
            .collect();
        // Lane opponent only when the position is known and unambiguous.
        let opponent = me.team_position.as_deref().and_then(|position| {
            let mut candidates = everyone.iter().filter(|p| {
                p.team_id.is_some() && !same_team(p) && p.team_position.as_deref() == Some(position)
            });
            let found = candidates.next()?;
            if candidates.next().is_some() {
                return None;
            }
            Some(LaneOpponent {
                champion: champion_ref(&index, found.champion_id, found.champion_name.as_deref()),
                kills: found.kills,
                deaths: found.deaths,
                assists: found.assists,
                creep_score: found.creep_score,
                gold_earned: found.gold_earned,
                vision_score: found.vision_score,
                damage_dealt: found.damage_dealt,
                damage_taken: found.damage_taken,
            })
        });

        let item_ids: Vec<i64> = items_json
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();
        let items = item_ids
            .into_iter()
            .filter(|id| *id > 0)
            .map(|id| {
                let info = index.items.get(&id);
                AnalysisItem {
                    id,
                    name: info.map(|info| info.name.clone()),
                    image_url: index.item_images.get(&id).cloned(),
                    completed: info.is_some_and(|info| info.completed),
                }
            })
            .collect();
        let perks: serde_json::Value = perks_json
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default();

        matches.push(AnalysisMatch {
            patch: game_version.as_deref().and_then(patch_of),
            match_id: match_id.clone(),
            queue_id,
            game_mode,
            game_version,
            played_at,
            duration_seconds,
            ended_early,
            win,
            champion: champion_ref(&index, me.champion_id, me.champion_name.as_deref()),
            team_position: me.team_position.clone(),
            champ_level,
            kills: me.kills,
            deaths: me.deaths,
            assists: me.assists,
            creep_score: me.creep_score,
            gold_earned: me.gold_earned,
            vision_score: me.vision_score,
            damage_dealt: me.damage_dealt,
            damage_taken: me.damage_taken,
            team_kills,
            items,
            keystone: index.rune(perks["keystone"].as_i64()),
            secondary_style: index.rune(perks["subStyle"].as_i64()),
            opponent,
            allies,
            enemies,
            bans: bans.remove(&match_id).unwrap_or_default(),
        });
    }

    Ok(Some(AnalysisDataset {
        puuid: puuid.to_string(),
        game_name,
        tag_line,
        region,
        source: sources_label(conn, puuid)?,
        matches_synced_at,
        ranked: ranked_entries(conn, puuid)?,
        matches,
    }))
}
