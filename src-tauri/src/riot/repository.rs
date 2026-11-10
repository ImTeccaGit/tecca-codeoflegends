//! SQLite storage for Riot player data: players, ranked entries, matches,
//! participants, saved profiles and sync timestamps. All values come from
//! official Riot API responses.

use std::collections::{HashMap, HashSet};

use rusqlite::{params, Connection, OptionalExtension};
use serde_json::json;

use crate::catalog::repository::current_version;
use crate::ddragon::bundle::version_key;
use crate::ddragon::urls;
use crate::error::AppError;
use crate::riot::dto::{
    ItemSlot, PlayerMatch, PlayerProfile, ProfileSummary, RankedEntry, RuneRef, SyncState,
};
use crate::riot::league::LeagueEntry;
use crate::riot::matches::MatchDto;

/// Matches returned with a profile (newest first).
const PROFILE_MATCH_LIMIT: i64 = 100;
pub const SOURCE_LABEL: &str = "Riot API";
pub const CLIENT_SOURCE_LABEL: &str = "Client League (LCU)";

/// Where a stored match was read from (column `matches.source`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchSource {
    RiotApi,
    LeagueClient,
}

impl MatchSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::RiotApi => "riot-api",
            Self::LeagueClient => "league-client",
        }
    }
}

/// Human label for the sources of a player's stored data.
pub fn sources_label(conn: &Connection, puuid: &str) -> Result<String, AppError> {
    let mut statement = conn.prepare(
        "SELECT DISTINCT m.source FROM player_matches pm
         JOIN matches m ON m.match_id = pm.match_id
         WHERE pm.puuid = ?1 ORDER BY m.source DESC",
    )?;
    let sources = statement
        .query_map([puuid], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    let client_synced: bool = conn
        .query_row(
            "SELECT client_synced_at IS NOT NULL FROM player_sync WHERE puuid = ?1",
            [puuid],
            |row| row.get(0),
        )
        .optional()?
        .unwrap_or(false);
    let api = sources.iter().any(|source| source == "riot-api");
    let client = client_synced || sources.iter().any(|source| source == "league-client");
    Ok(match (api, client) {
        (true, true) => format!("{SOURCE_LABEL} + {CLIENT_SOURCE_LABEL}"),
        (false, true) => CLIENT_SOURCE_LABEL.to_string(),
        _ => SOURCE_LABEL.to_string(),
    })
}

pub struct SyncAges {
    pub profile_minutes: Option<f64>,
    pub ranked_minutes: Option<f64>,
    pub matches_minutes: Option<f64>,
}

#[derive(Clone, Copy)]
pub enum SyncField {
    Profile,
    Ranked,
    Matches,
}

impl SyncField {
    fn column(self) -> &'static str {
        match self {
            Self::Profile => "profile_synced_at",
            Self::Ranked => "ranked_synced_at",
            Self::Matches => "matches_synced_at",
        }
    }
}

/// Cached player for a Riot ID in a region, with minutes since profile sync.
pub fn find_by_riot_id(
    conn: &Connection,
    game_name: &str,
    tag_line: &str,
    platform: &str,
) -> Result<Option<(String, Option<f64>)>, AppError> {
    Ok(conn
        .query_row(
            "SELECT p.puuid,
                    (julianday('now') - julianday(s.profile_synced_at)) * 1440.0
             FROM players p LEFT JOIN player_sync s ON s.puuid = p.puuid
             WHERE lower(p.game_name) = lower(?1) AND lower(p.tag_line) = lower(?2)
               AND p.region = ?3",
            params![game_name, tag_line, platform],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?)
}

pub fn player_region(conn: &Connection, puuid: &str) -> Result<Option<String>, AppError> {
    Ok(conn
        .query_row(
            "SELECT region FROM players WHERE puuid = ?1",
            [puuid],
            |row| row.get(0),
        )
        .optional()?)
}

pub fn upsert_player(
    conn: &Connection,
    puuid: &str,
    game_name: &str,
    tag_line: &str,
    platform: &str,
    summoner: Option<(i64, i64)>,
) -> Result<(), AppError> {
    let (level, icon) = summoner.unzip();
    conn.execute(
        "INSERT INTO players (puuid, game_name, tag_line, region, summoner_level, profile_icon_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(puuid) DO UPDATE SET
            game_name = excluded.game_name,
            tag_line = excluded.tag_line,
            region = excluded.region,
            summoner_level = COALESCE(excluded.summoner_level, players.summoner_level),
            profile_icon_id = COALESCE(excluded.profile_icon_id, players.profile_icon_id),
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        params![puuid, game_name, tag_line, platform, level, icon],
    )?;
    conn.execute(
        "INSERT INTO player_sync (puuid) VALUES (?1) ON CONFLICT(puuid) DO NOTHING",
        [puuid],
    )?;
    Ok(())
}

pub fn replace_ranked(
    conn: &mut Connection,
    puuid: &str,
    entries: &[LeagueEntry],
) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM player_ranked WHERE puuid = ?1", [puuid])?;
    {
        let mut insert = tx.prepare(
            "INSERT INTO player_ranked
                (puuid, queue_type, tier, division, league_points, wins, losses, hot_streak)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        )?;
        for entry in entries {
            insert.execute(params![
                puuid,
                entry.queue_type,
                entry.tier,
                entry.rank,
                entry.league_points.max(0),
                entry.wins.max(0),
                entry.losses.max(0),
                entry.hot_streak,
            ])?;
        }
    }
    tx.commit()?;
    Ok(())
}

/// Ids among `ids` that are already stored (no need to download them again).
pub fn known_match_ids(conn: &Connection, ids: &[String]) -> Result<HashSet<String>, AppError> {
    let mut statement = conn.prepare("SELECT 1 FROM matches WHERE match_id = ?1")?;
    let mut known = HashSet::new();
    for id in ids {
        if statement.exists([id])? {
            known.insert(id.clone());
        }
    }
    Ok(known)
}

/// Stores a match and all its participants (idempotent).
pub fn store_match(
    conn: &mut Connection,
    regional: &str,
    data: &MatchDto,
    raw_json: &str,
    source: MatchSource,
) -> Result<(), AppError> {
    let info = &data.info;
    let ended_early = info
        .participants
        .iter()
        .any(|participant| participant.game_ended_in_early_surrender);

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO matches
            (match_id, region, queue_id, game_version, game_creation, game_duration,
             raw_json, game_mode, map_id, ended_early, source)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(match_id) DO NOTHING",
        params![
            data.metadata.match_id,
            regional,
            info.queue_id,
            info.game_version,
            info.game_creation,
            info.duration_seconds(),
            raw_json,
            info.game_mode,
            info.map_id,
            ended_early,
            source.as_str(),
        ],
    )?;
    {
        let mut insert = tx.prepare(
            "INSERT INTO match_participants
                (match_id, puuid, champion_id, team_id, role, kills, deaths, assists, win, cs,
                 gold, vision_score, riot_id, champion_name, champ_level, team_position,
                 items_json, perks_json, summoner_spells_json, damage_to_champions,
                 damage_taken)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16,
                     ?17, ?18, ?19, ?20, ?21)
             ON CONFLICT(match_id, puuid) DO NOTHING",
        )?;
        for participant in &info.participants {
            if participant.puuid.is_empty() {
                continue;
            }
            let riot_id = match (&participant.riot_id_game_name, &participant.riot_id_tagline) {
                (Some(name), Some(tag)) if !name.is_empty() => Some(format!("{name}#{tag}")),
                _ => None,
            };
            let primary = participant
                .perks
                .styles
                .iter()
                .find(|style| style.description == "primaryStyle")
                .or_else(|| participant.perks.styles.first());
            let secondary = participant
                .perks
                .styles
                .iter()
                .find(|style| style.description == "subStyle")
                .or_else(|| participant.perks.styles.get(1));
            let perks = json!({
                "primaryStyle": primary.map(|style| style.style),
                "keystone": primary.and_then(|style| style.selections.first()).map(|selection| selection.perk),
                "subStyle": secondary.map(|style| style.style),
            });
            let position =
                Some(participant.team_position.clone()).filter(|value| !value.is_empty());
            insert.execute(params![
                data.metadata.match_id,
                participant.puuid,
                participant.champion_id,
                participant.team_id,
                position,
                participant.kills,
                participant.deaths,
                participant.assists,
                participant.win,
                participant.creep_score(),
                participant.gold_earned,
                participant.vision_score,
                riot_id,
                participant.champion_name,
                participant.champ_level,
                position,
                serde_json::to_string(&participant.items())?,
                perks.to_string(),
                serde_json::to_string(&[participant.summoner1_id, participant.summoner2_id])?,
                participant.total_damage_dealt_to_champions,
                participant.total_damage_taken,
            ])?;
        }
        let mut insert_ban = tx.prepare(
            "INSERT INTO match_bans (match_id, team_id, pick_turn, champion_id)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(match_id, team_id, pick_turn) DO NOTHING",
        )?;
        for team in &info.teams {
            for ban in team.bans.iter().filter(|ban| ban.champion_id > 0) {
                insert_ban.execute(params![
                    data.metadata.match_id,
                    team.team_id,
                    ban.pick_turn,
                    ban.champion_id
                ])?;
            }
        }
    }
    tx.commit()?;
    Ok(())
}

pub fn link_matches(conn: &Connection, puuid: &str, ids: &[String]) -> Result<(), AppError> {
    let mut statement = conn.prepare(
        "INSERT INTO player_matches (puuid, match_id)
         SELECT ?1, ?2 WHERE EXISTS (SELECT 1 FROM matches WHERE match_id = ?2)
         ON CONFLICT(puuid, match_id) DO NOTHING",
    )?;
    for id in ids {
        statement.execute(params![puuid, id])?;
    }
    Ok(())
}

pub fn touch_sync(conn: &Connection, puuid: &str, field: SyncField) -> Result<(), AppError> {
    // The column name comes from a closed enum, never from input.
    conn.execute(
        &format!(
            "UPDATE player_sync SET {} = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), last_error = NULL
             WHERE puuid = ?1",
            field.column()
        ),
        [puuid],
    )?;
    Ok(())
}

pub fn set_last_error(conn: &Connection, puuid: &str, message: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE player_sync SET last_error = ?2 WHERE puuid = ?1",
        params![puuid, message],
    )?;
    Ok(())
}

pub fn sync_ages(conn: &Connection, puuid: &str) -> Result<SyncAges, AppError> {
    Ok(conn
        .query_row(
            "SELECT (julianday('now') - julianday(profile_synced_at)) * 1440.0,
                    (julianday('now') - julianday(ranked_synced_at)) * 1440.0,
                    (julianday('now') - julianday(matches_synced_at)) * 1440.0
             FROM player_sync WHERE puuid = ?1",
            [puuid],
            |row| {
                Ok(SyncAges {
                    profile_minutes: row.get(0)?,
                    ranked_minutes: row.get(1)?,
                    matches_minutes: row.get(2)?,
                })
            },
        )
        .optional()?
        .unwrap_or(SyncAges {
            profile_minutes: None,
            ranked_minutes: None,
            matches_minutes: None,
        }))
}

/* ------------------------------------------------------------------------ */
/* Saved profiles                                                            */
/* ------------------------------------------------------------------------ */

fn require_player(conn: &Connection, puuid: &str) -> Result<(), AppError> {
    if player_region(conn, puuid)?.is_some() {
        Ok(())
    } else {
        Err(AppError::NotFound(
            "Profilo non presente in locale.".to_string(),
        ))
    }
}

pub fn save_profile(conn: &mut Connection, puuid: &str, primary: bool) -> Result<(), AppError> {
    require_player(conn, puuid)?;
    let tx = conn.transaction()?;
    let has_primary: bool = tx
        .query_row(
            "SELECT 1 FROM saved_profiles WHERE is_primary = 1",
            [],
            |_| Ok(()),
        )
        .optional()?
        .is_some();
    // The first saved profile becomes the primary one.
    let make_primary = primary || !has_primary;
    if make_primary {
        tx.execute(
            "UPDATE saved_profiles SET is_primary = 0 WHERE is_primary = 1",
            [],
        )?;
    }
    tx.execute(
        "INSERT INTO saved_profiles (puuid, is_primary) VALUES (?1, ?2)
         ON CONFLICT(puuid) DO UPDATE SET is_primary = MAX(saved_profiles.is_primary, excluded.is_primary)",
        params![puuid, make_primary],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn remove_profile(conn: &Connection, puuid: &str) -> Result<(), AppError> {
    conn.execute("DELETE FROM saved_profiles WHERE puuid = ?1", [puuid])?;
    Ok(())
}

/// Deletes everything stored for a player; matches no longer linked to any
/// player are deleted too.
pub fn delete_player_data(conn: &mut Connection, puuid: &str) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute("DELETE FROM players WHERE puuid = ?1", [puuid])?;
    tx.execute(
        "DELETE FROM matches WHERE match_id NOT IN (SELECT match_id FROM player_matches)",
        [],
    )?;
    tx.commit()?;
    Ok(())
}

/* ------------------------------------------------------------------------ */
/* Read models                                                               */
/* ------------------------------------------------------------------------ */

/// Numeric patch ordering key (see `ddragon::bundle::version_key`).
type VersionKey = Option<(u32, u32, u32)>;

/// Data Dragon lookups for images and rune names (newest imported patch).
/// Data Dragon item facts used by the analysis (newest patch per item).
pub(crate) struct ItemInfo {
    pub name: String,
    /// No further upgrade, at least 900 gold, not a consumable or trinket.
    pub completed: bool,
}

/// Static Data Dragon lookups (current patch for champions, newest patch
/// containing each item / rune).
pub(crate) struct StaticIndex {
    version: Option<String>,
    pub champion_images: HashMap<i64, String>,
    pub champion_names: HashMap<i64, String>,
    pub item_images: HashMap<i64, String>,
    pub items: HashMap<i64, ItemInfo>,
    runes: HashMap<i64, (String, String)>,
}

impl StaticIndex {
    pub(crate) fn load(conn: &Connection) -> Result<Self, AppError> {
        let version = current_version(conn)?;
        let mut champion_images = HashMap::new();
        let mut champion_names = HashMap::new();
        if let Some(version) = &version {
            let mut statement = conn.prepare(
                "SELECT champion_id, image_file, name FROM champion_versions WHERE patch_version = ?1",
            )?;
            for row in statement.query_map([version], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })? {
                let (id, file, name) = row?;
                champion_images.insert(id, urls::champion_square(version, &file));
                champion_names.insert(id, name);
            }
        }

        // Newest patch containing each item / rune.
        let mut item_rows: HashMap<i64, (VersionKey, String, ItemInfo)> = HashMap::new();
        let mut statement = conn.prepare(
            "SELECT item_id, patch_version, image_file, name, gold_total,
                    builds_into_json = '[]',
                    EXISTS (SELECT 1 FROM json_each(tags_json)
                            WHERE value IN ('Consumable', 'Trinket'))
             FROM items",
        )?;
        for row in statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, i64>(4)?,
                row.get::<_, bool>(5)?,
                row.get::<_, bool>(6)?,
            ))
        })? {
            let (id, patch, file, name, gold, final_tier, consumable) = row?;
            let key = version_key(&patch);
            let newer = match item_rows.get(&id) {
                Some((current, _, _)) => key > *current,
                None => true,
            };
            if newer {
                let info = ItemInfo {
                    name,
                    completed: final_tier && gold >= 900 && !consumable,
                };
                item_rows.insert(id, (key, urls::item(&patch, &file), info));
            }
        }
        let mut item_images = HashMap::new();
        let mut items = HashMap::new();
        for (id, (_, url, info)) in item_rows {
            item_images.insert(id, url);
            items.insert(id, info);
        }

        let mut runes = HashMap::new();
        let mut statement = conn.prepare(
            "SELECT rune_id AS id, name, icon_path FROM runes
             UNION ALL SELECT tree_id, name, icon_path FROM rune_trees",
        )?;
        for row in statement.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })? {
            let (id, name, icon) = row?;
            runes.insert(id, (name, urls::rune(&icon)));
        }

        Ok(Self {
            version,
            champion_images,
            champion_names,
            item_images,
            items,
            runes,
        })
    }

    pub(crate) fn rune(&self, id: Option<i64>) -> Option<RuneRef> {
        let id = id?;
        let found = self.runes.get(&id);
        Some(RuneRef {
            id,
            name: found.map(|(name, _)| name.clone()),
            icon_url: found.map(|(_, url)| url.clone()),
        })
    }

    fn profile_icon(&self, icon: Option<i64>) -> Option<String> {
        Some(format!(
            "{}/cdn/{}/img/profileicon/{}.png",
            crate::ddragon::DDRAGON_BASE_URL,
            self.version.as_ref()?,
            icon?
        ))
    }
}

pub(crate) fn ranked_entries(conn: &Connection, puuid: &str) -> Result<Vec<RankedEntry>, AppError> {
    let mut statement = conn.prepare(
        "SELECT queue_type, tier, division, league_points, wins, losses, hot_streak, fetched_at
         FROM player_ranked WHERE puuid = ?1 ORDER BY queue_type",
    )?;
    let entries = statement
        .query_map([puuid], |row| {
            Ok(RankedEntry {
                queue_type: row.get(0)?,
                tier: row.get(1)?,
                division: row.get(2)?,
                league_points: row.get(3)?,
                wins: row.get(4)?,
                losses: row.get(5)?,
                hot_streak: row.get(6)?,
                fetched_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(entries)
}

fn player_matches(
    conn: &Connection,
    puuid: &str,
    index: &StaticIndex,
) -> Result<Vec<PlayerMatch>, AppError> {
    let mut statement = conn.prepare(
        "SELECT m.match_id, m.queue_id, m.game_mode, m.game_version,
                strftime('%Y-%m-%dT%H:%M:%fZ', m.game_creation / 1000.0, 'unixepoch'),
                m.game_duration, m.ended_early,
                p.win, p.champion_id, p.champion_name, p.kills, p.deaths, p.assists, p.cs,
                p.gold, p.vision_score, p.champ_level, p.team_position, p.damage_to_champions,
                p.items_json, p.perks_json
         FROM player_matches pm
         JOIN matches m ON m.match_id = pm.match_id
         JOIN match_participants p ON p.match_id = m.match_id AND p.puuid = pm.puuid
         WHERE pm.puuid = ?1
         ORDER BY m.game_creation DESC
         LIMIT ?2",
    )?;
    let rows = statement
        .query_map(params![puuid, PROFILE_MATCH_LIMIT], |row| {
            let items_json: Option<String> = row.get(19)?;
            let perks_json: Option<String> = row.get(20)?;
            let champion_id: i64 = row.get(8)?;
            Ok((
                PlayerMatch {
                    match_id: row.get(0)?,
                    queue_id: row.get(1)?,
                    game_mode: row.get(2)?,
                    game_version: row.get(3)?,
                    played_at: row.get(4)?,
                    duration_seconds: row.get(5)?,
                    ended_early: row.get(6)?,
                    win: row.get(7)?,
                    champion_id,
                    champion_name: row.get(9)?,
                    champion_image_url: index.champion_images.get(&champion_id).cloned(),
                    kills: row.get(10)?,
                    deaths: row.get(11)?,
                    assists: row.get(12)?,
                    creep_score: row.get(13)?,
                    gold_earned: row.get(14)?,
                    vision_score: row.get(15)?,
                    champ_level: row.get(16)?,
                    team_position: row.get(17)?,
                    damage_to_champions: row.get(18)?,
                    items: Vec::new(),
                    keystone: None,
                    secondary_style: None,
                },
                items_json,
                perks_json,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(rows
        .into_iter()
        .map(|(mut item, items_json, perks_json)| {
            let ids: Vec<i64> = items_json
                .and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default();
            item.items = ids
                .into_iter()
                .filter(|id| *id > 0)
                .map(|id| ItemSlot {
                    id,
                    image_url: index.item_images.get(&id).cloned(),
                })
                .collect();
            let perks: serde_json::Value = perks_json
                .and_then(|json| serde_json::from_str(&json).ok())
                .unwrap_or_default();
            item.keystone = index.rune(perks["keystone"].as_i64());
            item.secondary_style = index.rune(perks["subStyle"].as_i64());
            item
        })
        .collect())
}

pub fn profile(conn: &Connection, puuid: &str) -> Result<Option<PlayerProfile>, AppError> {
    let base = conn
        .query_row(
            "SELECT p.game_name, p.tag_line, p.region, p.summoner_level, p.profile_icon_id,
                    sp.puuid IS NOT NULL, COALESCE(sp.is_primary, 0),
                    s.profile_synced_at, s.ranked_synced_at, s.matches_synced_at, s.last_error
             FROM players p
             LEFT JOIN saved_profiles sp ON sp.puuid = p.puuid
             LEFT JOIN player_sync s ON s.puuid = p.puuid
             WHERE p.puuid = ?1",
            [puuid],
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, Option<i64>>(4)?,
                    row.get::<_, bool>(5)?,
                    row.get::<_, bool>(6)?,
                    SyncState {
                        profile_synced_at: row.get(7)?,
                        ranked_synced_at: row.get(8)?,
                        matches_synced_at: row.get(9)?,
                        last_error: row.get(10)?,
                    },
                ))
            },
        )
        .optional()?;

    let Some((name, tag, region, level, icon, saved, primary, sync)) = base else {
        return Ok(None);
    };
    let index = StaticIndex::load(conn)?;

    Ok(Some(PlayerProfile {
        puuid: puuid.to_string(),
        game_name: name.unwrap_or_default(),
        tag_line: tag.unwrap_or_default(),
        region,
        summoner_level: level,
        profile_icon_url: index.profile_icon(icon),
        saved,
        primary,
        sync,
        ranked: ranked_entries(conn, puuid)?,
        matches: player_matches(conn, puuid, &index)?,
        source: sources_label(conn, puuid)?,
    }))
}

pub fn saved_profiles(conn: &Connection) -> Result<Vec<ProfileSummary>, AppError> {
    let index = StaticIndex::load(conn)?;
    let mut statement = conn.prepare(
        "SELECT p.puuid, p.game_name, p.tag_line, p.region, p.summoner_level, p.profile_icon_id,
                sp.is_primary, s.matches_synced_at,
                (SELECT COUNT(*) FROM player_matches pm WHERE pm.puuid = p.puuid)
         FROM saved_profiles sp
         JOIN players p ON p.puuid = sp.puuid
         LEFT JOIN player_sync s ON s.puuid = p.puuid
         ORDER BY sp.is_primary DESC, lower(p.game_name)",
    )?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, Option<i64>>(5)?,
                row.get::<_, bool>(6)?,
                row.get::<_, Option<String>>(7)?,
                row.get::<_, i64>(8)?,
            ))
        })?
        .collect::<Result<Vec<_>, _>>()?;

    rows.into_iter()
        .map(
            |(puuid, name, tag, region, level, icon, primary, synced, count)| {
                let solo_queue = ranked_entries(conn, &puuid)?
                    .into_iter()
                    .find(|entry| entry.queue_type == "RANKED_SOLO_5x5");
                Ok(ProfileSummary {
                    game_name: name.unwrap_or_default(),
                    tag_line: tag.unwrap_or_default(),
                    region,
                    summoner_level: level,
                    profile_icon_url: index.profile_icon(icon),
                    primary,
                    solo_queue,
                    match_count: count,
                    matches_synced_at: synced,
                    puuid,
                })
            },
        )
        .collect()
}

pub fn primary_puuid(conn: &Connection) -> Result<Option<String>, AppError> {
    Ok(conn
        .query_row(
            "SELECT puuid FROM saved_profiles WHERE is_primary = 1",
            [],
            |row| row.get(0),
        )
        .optional()?)
}
