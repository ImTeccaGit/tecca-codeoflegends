//! SQLite writes for the global statistics: settings, seed players and the
//! compact match rows used by `stats`.

use std::collections::HashSet;

use rusqlite::{params, Connection, OptionalExtension};

use crate::ddragon::bundle::version_key;
use crate::error::AppError;
use crate::meta::dto::PatchSample;
use crate::riot::matches::{MatchDto, Participant, TimelineDto};

/// Accepted values of `global_stats_settings.seed_tier`.
pub const SEED_TIERS: &[&str] = &["MASTER_PLUS", "DIAMOND", "EMERALD", "PLATINUM"];
pub const ROLES: &[&str] = &["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
/// Shorter games are remakes and are ignored by the statistics.
pub const MIN_GAME_SECONDS: i64 = 300;
pub const RANKED_SOLO_QUEUE: i64 = 420;
/// `seed_tier` of the user's own saved matches (personal statistics).
pub const PERSONAL: &str = "PERSONAL";
/// Starting items: bought in the first 90 seconds.
pub const START_ITEMS_MS: i64 = 90_000;
/// Skill level-ups kept per player.
pub const MAX_SKILLS: usize = 18;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Settings {
    pub enabled: bool,
    pub platform: String,
    pub seed_tier: String,
}

pub fn settings(conn: &Connection) -> Result<Settings, AppError> {
    Ok(conn.query_row(
        "SELECT enabled, platform, seed_tier FROM global_stats_settings WHERE id = 1",
        [],
        |row| {
            Ok(Settings {
                enabled: row.get(0)?,
                platform: row.get(1)?,
                seed_tier: row.get(2)?,
            })
        },
    )?)
}

pub fn save_settings(conn: &Connection, settings: &Settings) -> Result<(), AppError> {
    conn.execute(
        "UPDATE global_stats_settings
         SET enabled = ?1, platform = ?2, seed_tier = ?3,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = 1",
        params![settings.enabled, settings.platform, settings.seed_tier],
    )?;
    Ok(())
}

/// Hours since the seed list of `platform`/`tier` was refreshed.
pub fn seeds_age_hours(
    conn: &Connection,
    platform: &str,
    tier: &str,
) -> Result<Option<f64>, AppError> {
    Ok(conn
        .query_row(
            "SELECT (julianday('now') - julianday(refreshed_at)) * 24
             FROM global_seed_sources WHERE platform = ?1 AND seed_tier = ?2",
            params![platform, tier],
            |row| row.get(0),
        )
        .optional()?)
}

/// Replaces the seed list of `platform`/`tier`, keeping when each player
/// already present was last read.
pub fn replace_seeds(
    conn: &mut Connection,
    platform: &str,
    tier: &str,
    puuids: &[String],
) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute(
        "CREATE TEMP TABLE IF NOT EXISTS seed_keep (puuid TEXT PRIMARY KEY)",
        [],
    )?;
    tx.execute("DELETE FROM temp.seed_keep", [])?;
    {
        let mut keep = tx.prepare("INSERT OR IGNORE INTO temp.seed_keep (puuid) VALUES (?1)")?;
        let mut insert = tx.prepare(
            "INSERT INTO global_seed_players (platform, puuid, seed_tier) VALUES (?1, ?2, ?3)
             ON CONFLICT (platform, puuid) DO UPDATE SET seed_tier = excluded.seed_tier",
        )?;
        for puuid in puuids {
            keep.execute([puuid])?;
            insert.execute(params![platform, puuid, tier])?;
        }
    }
    tx.execute(
        "DELETE FROM global_seed_players
         WHERE platform = ?1 AND seed_tier = ?2
           AND puuid NOT IN (SELECT puuid FROM temp.seed_keep)",
        params![platform, tier],
    )?;
    tx.execute("DELETE FROM temp.seed_keep", [])?;
    tx.execute(
        "INSERT INTO global_seed_sources (platform, seed_tier, player_count) VALUES (?1, ?2, ?3)
         ON CONFLICT (platform, seed_tier) DO UPDATE SET
             player_count = excluded.player_count,
             refreshed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
        params![platform, tier, puuids.len() as i64],
    )?;
    tx.commit()?;
    Ok(())
}

/// Seed player never read, or read at least `min_hours` ago (oldest first).
pub fn next_seed(
    conn: &Connection,
    platform: &str,
    tier: &str,
    min_hours: f64,
) -> Result<Option<String>, AppError> {
    Ok(conn
        .query_row(
            "SELECT puuid FROM global_seed_players
             WHERE platform = ?1 AND seed_tier = ?2
               AND (crawled_at IS NULL
                    OR (julianday('now') - julianday(crawled_at)) * 24 >= ?3)
             ORDER BY crawled_at IS NOT NULL, crawled_at, rowid
             LIMIT 1",
            params![platform, tier, min_hours],
            |row| row.get(0),
        )
        .optional()?)
}

pub fn mark_crawled(conn: &Connection, platform: &str, puuid: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE global_seed_players SET crawled_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE platform = ?1 AND puuid = ?2",
        params![platform, puuid],
    )?;
    Ok(())
}

pub fn known_match_ids(conn: &Connection, ids: &[String]) -> Result<HashSet<String>, AppError> {
    let mut statement = conn.prepare("SELECT 1 FROM global_matches WHERE match_id = ?1")?;
    let mut known = HashSet::new();
    for id in ids {
        if statement.exists([id])? {
            known.insert(id.clone());
        }
    }
    Ok(known)
}

/// "16.22.734.1234" → "16.22".
pub fn patch_of(game_version: &str) -> Option<String> {
    let mut parts = game_version.split('.');
    let major = parts.next()?.parse::<u32>().ok()?;
    let minor = parts.next()?.parse::<u32>().ok()?;
    Some(format!("{major}.{minor}"))
}

/// Canonical rune page "primary|r1,r2,r3,r4|secondary|r5,r6|offense,flex,defense"
/// and keystone. The page is `None` when the runes are incomplete; missing
/// shards (League client history) are written as "0,0,0".
pub fn rune_page(participant: &Participant) -> (Option<String>, Option<i64>) {
    let styles = &participant.perks.styles;
    let primary = styles
        .iter()
        .find(|style| style.description == "primaryStyle")
        .or_else(|| styles.first());
    let secondary = styles
        .iter()
        .find(|style| style.description == "subStyle")
        .or_else(|| styles.get(1));
    let keystone = primary
        .and_then(|style| style.selections.first())
        .map(|selection| selection.perk)
        .filter(|perk| *perk > 0);

    let shards = &participant.perks.stat_perks;
    let page = match (primary, secondary) {
        (Some(primary), Some(secondary))
            if primary.style > 0
                && secondary.style > 0
                && primary.selections.len() == 4
                && secondary.selections.len() == 2 =>
        {
            let join = |selections: &[crate::riot::matches::PerkSelection]| {
                selections
                    .iter()
                    .map(|selection| selection.perk.to_string())
                    .collect::<Vec<_>>()
                    .join(",")
            };
            Some(format!(
                "{}|{}|{}|{}|{},{},{}",
                primary.style,
                join(&primary.selections),
                secondary.style,
                join(&secondary.selections),
                shards.offense,
                shards.flex,
                shards.defense
            ))
        }
        _ => None,
    };
    (page, keystone)
}

/// Stores one match. Returns `false` (nothing written) for matches that are
/// not standard 5v5 games with a readable patch.
pub fn store_match(
    conn: &mut Connection,
    platform: &str,
    seed_tier: &str,
    data: &MatchDto,
) -> Result<bool, AppError> {
    let info = &data.info;
    let Some(patch) = patch_of(&info.game_version) else {
        return Ok(false);
    };
    if info.participants.len() != 10 {
        return Ok(false);
    }
    let ended_early = info
        .participants
        .iter()
        .any(|participant| participant.game_ended_in_early_surrender);

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT OR IGNORE INTO global_matches
            (match_id, platform, patch, game_version, queue_id, game_creation_ms,
             duration_seconds, ended_early, seed_tier)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            data.metadata.match_id,
            platform,
            patch,
            info.game_version,
            info.queue_id,
            info.game_creation,
            info.duration_seconds(),
            ended_early,
            seed_tier
        ],
    )?;
    {
        let mut insert = tx.prepare(
            "INSERT OR IGNORE INTO global_participants
                (match_id, participant_index, champion_id, team_id, team_position, win,
                 rune_page, keystone, summoner_spells, items_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        )?;
        for (position_in_list, participant) in info.participants.iter().enumerate() {
            if participant.champion_id <= 0 {
                continue;
            }
            // Timeline events use participantId 1–10.
            let index = if (1..=10).contains(&participant.participant_id) {
                (participant.participant_id - 1) as usize
            } else {
                position_in_list
            };
            let position = if ROLES.contains(&participant.team_position.as_str()) {
                participant.team_position.as_str()
            } else {
                ""
            };
            let (page, keystone) = rune_page(participant);
            let mut spells = [participant.summoner1_id, participant.summoner2_id];
            spells.sort_unstable();
            let items: Vec<i64> = participant.items()[..6]
                .iter()
                .copied()
                .filter(|item| *item > 0)
                .collect();
            insert.execute(params![
                data.metadata.match_id,
                index as i64,
                participant.champion_id,
                participant.team_id,
                position,
                participant.win,
                page,
                keystone,
                format!("{},{}", spells[0], spells[1]),
                serde_json::to_string(&items)?,
            ])?;
        }
        let mut ban = tx.prepare(
            "INSERT OR IGNORE INTO global_bans (match_id, team_id, pick_turn, champion_id)
             VALUES (?1, ?2, ?3, ?4)",
        )?;
        for team in &info.teams {
            for entry in team.bans.iter().filter(|entry| entry.champion_id > 0) {
                ban.execute(params![
                    data.metadata.match_id,
                    team.team_id,
                    entry.pick_turn,
                    entry.champion_id
                ])?;
            }
        }
    }
    tx.commit()?;
    Ok(true)
}

/// Stored patches with valid matches, newest first.
pub fn patch_samples(conn: &Connection) -> Result<Vec<PatchSample>, AppError> {
    let mut statement = conn.prepare(
        "SELECT patch, COUNT(*) FROM global_matches
         WHERE duration_seconds >= ?1 AND ended_early = 0 AND queue_id = ?2
           AND seed_tier <> 'PERSONAL'
         GROUP BY patch",
    )?;
    let mut samples = statement
        .query_map(params![MIN_GAME_SECONDS, RANKED_SOLO_QUEUE], |row| {
            Ok(PatchSample {
                patch: row.get(0)?,
                matches: row.get(1)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    samples.sort_by(|a, b| {
        version_key(&format!("{}.0", b.patch)).cmp(&version_key(&format!("{}.0", a.patch)))
    });
    Ok(samples)
}

/// Keeps only the `keep` newest patches. Returns the deleted match count.
pub fn prune_old_patches(conn: &Connection, keep: usize) -> Result<usize, AppError> {
    let mut statement =
        conn.prepare("SELECT DISTINCT patch FROM global_matches WHERE seed_tier <> 'PERSONAL'")?;
    let mut patches = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    patches.sort_by_key(|patch| std::cmp::Reverse(version_key(&format!("{patch}.0"))));
    let mut deleted = 0;
    for old in patches.iter().skip(keep) {
        deleted += conn.execute(
            "DELETE FROM global_matches WHERE patch = ?1 AND seed_tier <> 'PERSONAL'",
            [old],
        )?;
    }
    Ok(deleted)
}

/// Deletes every collected match and seed list (settings are kept).
pub fn clear(conn: &mut Connection) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    tx.execute(
        "DELETE FROM global_matches WHERE seed_tier <> 'PERSONAL'",
        [],
    )?;
    tx.execute("DELETE FROM global_seed_players", [])?;
    tx.execute("DELETE FROM global_seed_sources", [])?;
    tx.commit()?;
    Ok(())
}

pub struct Totals {
    pub total_matches: i64,
    pub seed_players: i64,
    pub seeds_refreshed_at: Option<String>,
    pub last_fetched_at: Option<String>,
}

pub fn totals(conn: &Connection, settings: &Settings) -> Result<Totals, AppError> {
    let total_matches = conn.query_row(
        "SELECT COUNT(*) FROM global_matches
         WHERE duration_seconds >= ?1 AND ended_early = 0 AND queue_id = ?2
           AND seed_tier <> 'PERSONAL'",
        params![MIN_GAME_SECONDS, RANKED_SOLO_QUEUE],
        |row| row.get(0),
    )?;
    let seed_players = conn.query_row(
        "SELECT COUNT(*) FROM global_seed_players WHERE platform = ?1 AND seed_tier = ?2",
        params![settings.platform, settings.seed_tier],
        |row| row.get(0),
    )?;
    let seeds_refreshed_at = conn
        .query_row(
            "SELECT refreshed_at FROM global_seed_sources WHERE platform = ?1 AND seed_tier = ?2",
            params![settings.platform, settings.seed_tier],
            |row| row.get(0),
        )
        .optional()?;
    let last_fetched_at = conn.query_row(
        "SELECT MAX(fetched_at) FROM global_matches WHERE seed_tier <> 'PERSONAL'",
        [],
        |row| row.get(0),
    )?;
    Ok(Totals {
        total_matches,
        seed_players,
        seeds_refreshed_at,
        last_fetched_at,
    })
}

/// Per player: skill order, starting items and later purchases.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct PlayerTimeline {
    pub skills: String,
    pub start_items: Vec<i64>,
    pub purchases: Vec<i64>,
}

/// Extracts skill level-ups and item purchases (an undo removes the
/// purchase; evolutions are not level-ups). Index = participantId - 1.
pub fn player_timelines(timeline: &TimelineDto) -> Vec<PlayerTimeline> {
    let mut players = vec![PlayerTimeline::default(); 10];
    let mut bought: Vec<Vec<(i64, i64)>> = vec![Vec::new(); 10];
    for event in timeline.info.frames.iter().flat_map(|frame| &frame.events) {
        let Some(index) = usize::try_from(event.participant_id - 1)
            .ok()
            .filter(|index| *index < 10)
        else {
            continue;
        };
        match event.kind.as_str() {
            "SKILL_LEVEL_UP" if event.level_up_type == "NORMAL" => {
                let slot = match event.skill_slot {
                    1 => 'Q',
                    2 => 'W',
                    3 => 'E',
                    4 => 'R',
                    _ => continue,
                };
                if players[index].skills.len() < MAX_SKILLS {
                    players[index].skills.push(slot);
                }
            }
            "ITEM_PURCHASED" if event.item_id > 0 => {
                bought[index].push((event.timestamp, event.item_id));
            }
            "ITEM_UNDO" if event.before_id > 0 => {
                if let Some(position) = bought[index]
                    .iter()
                    .rposition(|(_, item)| *item == event.before_id)
                {
                    bought[index].remove(position);
                }
            }
            _ => {}
        }
    }
    for (player, purchases) in players.iter_mut().zip(bought) {
        for (timestamp, item) in purchases {
            if timestamp < START_ITEMS_MS {
                player.start_items.push(item);
            } else {
                player.purchases.push(item);
            }
        }
    }
    players
}

/// Stores the timeline data of a match already saved with `store_match`.
pub fn store_timeline(
    conn: &mut Connection,
    match_id: &str,
    timeline: &TimelineDto,
) -> Result<(), AppError> {
    let tx = conn.transaction()?;
    {
        let mut update = tx.prepare(
            "UPDATE global_participants
             SET skill_order = ?3, start_items_json = ?4, purchases_json = ?5
             WHERE match_id = ?1 AND participant_index = ?2",
        )?;
        for (index, player) in player_timelines(timeline).iter().enumerate() {
            if player.skills.is_empty()
                && player.start_items.is_empty()
                && player.purchases.is_empty()
            {
                continue;
            }
            update.execute(params![
                match_id,
                index as i64,
                Some(player.skills.as_str()).filter(|skills| !skills.is_empty()),
                serde_json::to_string(&player.start_items)?,
                serde_json::to_string(&player.purchases)?,
            ])?;
        }
    }
    mark_timeline(&tx, match_id)?;
    tx.commit()?;
    Ok(())
}

/// Timeline read (or not available): never requested again.
pub fn mark_timeline(conn: &Connection, match_id: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE global_matches SET timeline_fetched = 1 WHERE match_id = ?1",
        [match_id],
    )?;
    Ok(())
}

/// Collected matches still without a timeline, newest first.
pub fn missing_timelines(
    conn: &Connection,
    platform: &str,
    limit: i64,
) -> Result<Vec<String>, AppError> {
    let mut statement = conn.prepare(
        "SELECT match_id FROM global_matches
         WHERE timeline_fetched = 0 AND seed_tier <> 'PERSONAL' AND platform = ?1
         ORDER BY game_creation_ms DESC LIMIT ?2",
    )?;
    let ids = statement
        .query_map(params![platform, limit], |row| row.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(ids)
}

/// Copies the user's own saved matches (Riot API or League client) into the
/// statistics tables as personal rows. Only matches not copied yet are
/// read. Returns how many were added.
pub fn import_personal(conn: &mut Connection) -> Result<usize, AppError> {
    let pending: Vec<(String, String, String)> = {
        let mut statement = conn.prepare(
            "SELECT m.match_id, m.source, m.raw_json FROM matches m
             WHERE m.raw_json IS NOT NULL AND json_valid(m.raw_json)
               AND NOT EXISTS (SELECT 1 FROM global_matches g WHERE g.match_id = m.match_id)",
        )?;
        let rows = statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    let mut added = 0;
    for (match_id, source, raw) in pending {
        let parsed = if source == "league-client" {
            serde_json::from_str::<crate::client::convert::ClientGame>(&raw)
                .ok()
                .and_then(|game| crate::client::convert::to_match(&game, |_| None))
        } else {
            serde_json::from_str::<MatchDto>(&raw).ok()
        };
        let Some(data) = parsed.filter(|data| data.metadata.match_id == match_id) else {
            continue;
        };
        if store_match(conn, "local", PERSONAL, &data)? {
            added += 1;
        }
    }
    Ok(added)
}
