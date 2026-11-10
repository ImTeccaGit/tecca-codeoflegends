//! Per-champion aggregations over the collected matches. Every number is a
//! count of stored rows; percentages are left to the UI together with the
//! sample size.

use std::collections::{HashMap, HashSet};

use rusqlite::{named_params, Connection};

use crate::catalog::repository::current_version;
use crate::ddragon::urls;
use crate::error::AppError;
use crate::meta::dto::{
    ChampionGlobalStats, ChampionRoles, ChampionRolesOverview, IconRef, IconStat, ItemSetStat,
    MatchupStat, PatchSample, RoleShare, RunePageStat, RuneTreeLayout, SkillOrderStat,
    SpellPairStat,
};
use crate::meta::static_data::{shard, summoner_spell, SHARD_ROWS};
use crate::meta::store::{MIN_GAME_SECONDS, ROLES};
use crate::meta::SOURCE_LABEL;
use crate::riot::repository::StaticIndex;

/// Value of the `patch` filter meaning "every stored patch".
pub const ALL_PATCHES: &str = "ALL";
/// Lane matchups with fewer games are not shown.
pub const MATCHUP_MIN_GAMES: i64 = 5;
const TOP_PAGES: usize = 3;
const TOP_KEYSTONES: usize = 4;
const TOP_SPELLS: usize = 3;
const TOP_BOOTS: usize = 3;
const TOP_ITEMS: usize = 6;
const TOP_MATCHUPS: usize = 3;
const TOP_SKILL_ORDERS: usize = 2;
const TOP_STARTS: usize = 2;
const TOP_CORES: usize = 3;
/// Completed items in the "core" build.
const CORE_SIZE: usize = 3;
/// The user's own matches are few: lower threshold, sample always shown.
const PERSONAL_MATCHUP_MIN_GAMES: i64 = 2;
pub const PERSONAL_SOURCE_LABEL: &str = "Le tue partite salvate (Riot API / client League)";

/// Shared filter on `global_matches m`: `:patch` = patch or NULL for all.
/// `:personal` = 1 for the user's own matches, 0 for the collected ones.
/// Summoner's Rift 5v5 queues only (draft, ranked solo/flex, blind, quickplay).
const VALID: &str = "m.duration_seconds >= :min_seconds AND m.ended_early = 0
                     AND m.queue_id IN (400, 420, 430, 440, 490)
                     AND (m.seed_tier = 'PERSONAL') = :personal
                     AND (:patch IS NULL OR m.patch = :patch)";

fn sql(body: &str) -> String {
    body.replace("{VALID}", VALID)
}

#[derive(Default, Clone, Copy)]
struct Tally {
    games: i64,
    wins: i64,
}

impl Tally {
    fn add(&mut self, win: bool) {
        self.games += 1;
        self.wins += i64::from(win);
    }
}

/// Most played first, ties by id for stable output.
fn top<K: Clone + Ord>(map: HashMap<K, Tally>, limit: usize) -> Vec<(K, Tally)> {
    let mut entries: Vec<(K, Tally)> = map.into_iter().collect();
    entries.sort_by(|a, b| b.1.games.cmp(&a.1.games).then_with(|| a.0.cmp(&b.0)));
    entries.truncate(limit);
    entries
}

fn ids(text: &str) -> Vec<i64> {
    text.split(',').filter_map(|id| id.parse().ok()).collect()
}

struct Lookup {
    index: StaticIndex,
    version: Option<String>,
    boots: HashSet<i64>,
    /// Champion id → Data Dragon id (current patch).
    keys: HashMap<i64, String>,
}

impl Lookup {
    fn load(conn: &Connection) -> Result<Self, AppError> {
        let mut statement = conn.prepare(
            "SELECT DISTINCT item_id FROM items
             WHERE gold_total > 300
               AND EXISTS (SELECT 1 FROM json_each(tags_json) WHERE value = 'Boots')",
        )?;
        let boots = statement
            .query_map([], |row| row.get::<_, i64>(0))?
            .collect::<Result<HashSet<_>, _>>()?;
        let version = current_version(conn)?;
        let mut statement = conn.prepare(
            "SELECT champion_id, ddragon_id FROM champion_versions WHERE patch_version = ?1",
        )?;
        let keys = statement
            .query_map([version.as_deref()], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<HashMap<_, _>, _>>()?;
        Ok(Self {
            index: StaticIndex::load(conn)?,
            version,
            boots,
            keys,
        })
    }

    fn rune(&self, id: i64) -> IconRef {
        self.index.rune(Some(id)).unwrap_or(IconRef {
            id,
            name: None,
            icon_url: None,
        })
    }

    fn item(&self, id: i64) -> IconRef {
        IconRef {
            id,
            name: self.index.items.get(&id).map(|item| item.name.clone()),
            icon_url: self.index.item_images.get(&id).cloned(),
        }
    }

    /// Parses a canonical page (see `store::rune_page`).
    fn page(&self, key: &str, tally: Tally) -> Option<RunePageStat> {
        let parts: Vec<&str> = key.split('|').collect();
        let [primary, primary_runes, secondary, secondary_runes, shards] = parts[..] else {
            return None;
        };
        Some(RunePageStat {
            primary_style: self.rune(primary.parse().ok()?),
            primary_runes: ids(primary_runes)
                .into_iter()
                .map(|id| self.rune(id))
                .collect(),
            secondary_style: self.rune(secondary.parse().ok()?),
            secondary_runes: ids(secondary_runes)
                .into_iter()
                .map(|id| self.rune(id))
                .collect(),
            shards: ids(shards).into_iter().map(shard).collect(),
            games: tally.games,
            wins: tally.wins,
        })
    }
}

fn rune_trees(conn: &Connection, version: Option<&str>) -> Result<Vec<RuneTreeLayout>, AppError> {
    let Some(version) = version else {
        return Ok(Vec::new());
    };
    let mut statement = conn.prepare(
        "SELECT tree_id, name, icon_path FROM rune_trees WHERE patch_version = ?1 ORDER BY tree_id",
    )?;
    let mut trees: Vec<RuneTreeLayout> = statement
        .query_map([version], |row| {
            Ok(RuneTreeLayout {
                tree: IconRef {
                    id: row.get(0)?,
                    name: Some(row.get(1)?),
                    icon_url: Some(urls::rune(&row.get::<_, String>(2)?)),
                },
                rows: Vec::new(),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut statement = conn.prepare(
        "SELECT tree_id, slot_index, rune_id, name, icon_path FROM runes
         WHERE patch_version = ?1 ORDER BY tree_id, slot_index, rowid",
    )?;
    let rows = statement.query_map([version], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            IconRef {
                id: row.get(2)?,
                name: Some(row.get(3)?),
                icon_url: Some(urls::rune(&row.get::<_, String>(4)?)),
            },
        ))
    })?;
    for row in rows {
        let (tree_id, slot, rune) = row?;
        let Some(tree) = trees.iter_mut().find(|tree| tree.tree.id == tree_id) else {
            continue;
        };
        let slot = usize::try_from(slot).unwrap_or_default();
        while tree.rows.len() <= slot {
            tree.rows.push(Vec::new());
        }
        tree.rows[slot].push(rune);
    }
    Ok(trees)
}

fn distinct_text(
    conn: &Connection,
    column: &str,
    patch: Option<&str>,
    personal: bool,
) -> Result<Vec<String>, AppError> {
    // `column` is one of two constants at the call site, never user input.
    let query = sql(&format!(
        "SELECT DISTINCT m.{column} FROM global_matches m WHERE {{VALID}} ORDER BY 1"
    ));
    let mut statement = conn.prepare(&query)?;
    let values = statement
        .query_map(
            named_params! {
                ":patch": patch,
                ":min_seconds": MIN_GAME_SECONDS,
                ":personal": personal,
            },
            |row| row.get::<_, String>(0),
        )?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(values)
}

pub fn champion_stats(
    conn: &Connection,
    champion_id: i64,
    patch_filter: Option<&str>,
    role_filter: Option<&str>,
) -> Result<ChampionGlobalStats, AppError> {
    let personal = use_personal(conn, champion_id)?;
    let patches = patch_samples(conn, personal)?;
    let patch: Option<String> = match patch_filter {
        Some(ALL_PATCHES) => None,
        Some(wanted) if patches.iter().any(|sample| sample.patch == wanted) => {
            Some(wanted.to_string())
        }
        _ => patches.first().map(|sample| sample.patch.clone()),
    };
    let scope = patch.as_deref();

    let total_matches: i64 = conn.query_row(
        &sql("SELECT COUNT(*) FROM global_matches m WHERE {VALID}"),
        named_params! {
            ":patch": scope,
            ":min_seconds": MIN_GAME_SECONDS,
            ":personal": personal,
        },
        |row| row.get(0),
    )?;

    let (games, wins): (i64, i64) = conn.query_row(
        &sql("SELECT COUNT(*), COALESCE(SUM(p.win), 0)
             FROM global_participants p JOIN global_matches m ON m.match_id = p.match_id
             WHERE p.champion_id = :champion AND {VALID}"),
        named_params! {
            ":patch": scope,
            ":min_seconds": MIN_GAME_SECONDS,
            ":personal": personal,
            ":champion": champion_id,
        },
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let bans: i64 = conn.query_row(
        &sql("SELECT COUNT(DISTINCT b.match_id)
             FROM global_bans b JOIN global_matches m ON m.match_id = b.match_id
             WHERE b.champion_id = :champion AND {VALID}"),
        named_params! {
            ":patch": scope,
            ":min_seconds": MIN_GAME_SECONDS,
            ":personal": personal,
            ":champion": champion_id,
        },
        |row| row.get(0),
    )?;

    let mut statement = conn.prepare(&sql(
        "SELECT p.team_position, COUNT(*), COALESCE(SUM(p.win), 0)
         FROM global_participants p JOIN global_matches m ON m.match_id = p.match_id
         WHERE p.champion_id = :champion AND p.team_position <> '' AND {VALID}
         GROUP BY p.team_position ORDER BY 2 DESC, 1",
    ))?;
    let roles = statement
        .query_map(
            named_params! {
                ":patch": scope,
                ":min_seconds": MIN_GAME_SECONDS,
                ":personal": personal,
                ":champion": champion_id,
            },
            |row| {
                Ok(RoleShare {
                    role: row.get(0)?,
                    games: row.get(1)?,
                    wins: row.get(2)?,
                })
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;

    let role = match role_filter {
        Some(wanted) if ROLES.contains(&wanted) => Some(wanted.to_string()),
        _ => roles.first().map(|share| share.role.clone()),
    };

    let lookup = Lookup::load(conn)?;
    let mut pages: HashMap<String, Tally> = HashMap::new();
    let mut keystones: HashMap<i64, Tally> = HashMap::new();
    let mut spells: HashMap<String, Tally> = HashMap::new();
    let mut boots: HashMap<i64, Tally> = HashMap::new();
    let mut items: HashMap<i64, Tally> = HashMap::new();
    let mut role_tally = Tally::default();
    let mut skill_priorities: HashMap<String, Tally> = HashMap::new();
    let mut skill_sequences: HashMap<String, HashMap<String, i64>> = HashMap::new();
    let mut starts: HashMap<String, Tally> = HashMap::new();
    let mut cores: HashMap<String, Tally> = HashMap::new();
    let mut timeline_games = 0_i64;
    let min_games = if personal {
        PERSONAL_MATCHUP_MIN_GAMES
    } else {
        MATCHUP_MIN_GAMES
    };
    let mut strong_against = Vec::new();
    let mut weak_against = Vec::new();

    if let Some(role) = role.as_deref() {
        let mut statement = conn.prepare(&sql(
            "SELECT p.rune_page, p.keystone, p.summoner_spells, p.items_json, p.win,
                    p.skill_order, p.start_items_json, p.purchases_json
             FROM global_participants p JOIN global_matches m ON m.match_id = p.match_id
             WHERE p.champion_id = :champion AND p.team_position = :role AND {VALID}",
        ))?;
        let rows = statement.query_map(
            named_params! {
                ":patch": scope,
                ":min_seconds": MIN_GAME_SECONDS,
                ":personal": personal,
                ":champion": champion_id,
                ":role": role,
            },
            |row| {
                Ok((
                    row.get::<_, Option<String>>(0)?,
                    row.get::<_, Option<i64>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, bool>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, Option<String>>(6)?,
                    row.get::<_, Option<String>>(7)?,
                ))
            },
        )?;
        for row in rows {
            let (page, keystone, spell_pair, items_json, win, skills, start, purchases) = row?;
            role_tally.add(win);
            if let Some(skills) = skills.filter(|skills| skills.len() >= 6) {
                let priority = skill_priority(&skills);
                skill_priorities
                    .entry(priority.clone())
                    .or_default()
                    .add(win);
                *skill_sequences
                    .entry(priority)
                    .or_default()
                    .entry(skills)
                    .or_default() += 1;
            }
            if let Some(start) = start {
                let mut items: Vec<i64> = serde_json::from_str(&start).unwrap_or_default();
                if !items.is_empty() {
                    items.sort_unstable();
                    starts.entry(join_ids(&items)).or_default().add(win);
                }
            }
            if let Some(purchases) = purchases {
                timeline_games += 1;
                let bought: Vec<i64> = serde_json::from_str(&purchases).unwrap_or_default();
                let mut core: Vec<i64> = Vec::new();
                for item in bought {
                    let completed = lookup
                        .index
                        .items
                        .get(&item)
                        .is_some_and(|info| info.completed);
                    if completed && !lookup.boots.contains(&item) && !core.contains(&item) {
                        core.push(item);
                    }
                    if core.len() == CORE_SIZE {
                        break;
                    }
                }
                if core.len() == CORE_SIZE {
                    cores.entry(join_ids(&core)).or_default().add(win);
                }
            }
            if let Some(page) = page {
                pages.entry(page).or_default().add(win);
            }
            if let Some(keystone) = keystone {
                keystones.entry(keystone).or_default().add(win);
            }
            spells.entry(spell_pair).or_default().add(win);
            let owned: HashSet<i64> = serde_json::from_str::<Vec<i64>>(&items_json)
                .unwrap_or_default()
                .into_iter()
                .collect();
            for item in owned {
                if lookup.boots.contains(&item) {
                    boots.entry(item).or_default().add(win);
                } else if lookup
                    .index
                    .items
                    .get(&item)
                    .is_some_and(|info| info.completed)
                {
                    items.entry(item).or_default().add(win);
                }
            }
        }

        let mut statement = conn.prepare(&sql(
            "SELECT o.champion_id, COUNT(*), COALESCE(SUM(p.win), 0)
             FROM global_participants p
             JOIN global_matches m ON m.match_id = p.match_id
             JOIN global_participants o ON o.match_id = p.match_id
                  AND o.team_position = p.team_position AND o.team_id <> p.team_id
             WHERE p.champion_id = :champion AND p.team_position = :role AND {VALID}
             GROUP BY o.champion_id HAVING COUNT(*) >= :min_games",
        ))?;
        let mut matchups = statement
            .query_map(
                named_params! {
                    ":patch": scope,
                    ":min_seconds": MIN_GAME_SECONDS,
                    ":personal": personal,
                    ":champion": champion_id,
                    ":role": role,
                    ":min_games": min_games,
                },
                |row| {
                    Ok((
                        row.get::<_, i64>(0)?,
                        row.get::<_, i64>(1)?,
                        row.get::<_, i64>(2)?,
                    ))
                },
            )?
            .collect::<Result<Vec<_>, _>>()?;
        let rate = |(_, games, wins): &(i64, i64, i64)| *wins as f64 / *games as f64;
        matchups.sort_by(|a, b| {
            rate(b)
                .total_cmp(&rate(a))
                .then_with(|| b.1.cmp(&a.1))
                .then_with(|| a.0.cmp(&b.0))
        });
        let to_stat = |(id, games, wins): &(i64, i64, i64)| MatchupStat {
            champion_id: *id,
            key: lookup.keys.get(id).cloned(),
            name: lookup.index.champion_names.get(id).cloned(),
            image_url: lookup.index.champion_images.get(id).cloned(),
            games: *games,
            wins: *wins,
        };
        strong_against = matchups
            .iter()
            .filter(|matchup| rate(matchup) >= 0.5)
            .take(TOP_MATCHUPS)
            .map(to_stat)
            .collect();
        weak_against = matchups
            .iter()
            .rev()
            .filter(|matchup| rate(matchup) < 0.5)
            .take(TOP_MATCHUPS)
            .map(to_stat)
            .collect();
    }

    let last_fetched_at: Option<String> = conn.query_row(
        &sql("SELECT MAX(m.fetched_at) FROM global_matches m WHERE {VALID}"),
        named_params! {
            ":patch": scope,
            ":min_seconds": MIN_GAME_SECONDS,
            ":personal": personal,
        },
        |row| row.get(0),
    )?;

    let icon_stats = |map: HashMap<i64, Tally>, limit: usize, icon: &dyn Fn(i64) -> IconRef| {
        top(map, limit)
            .into_iter()
            .map(|(id, tally)| IconStat {
                icon: icon(id),
                games: tally.games,
                wins: tally.wins,
            })
            .collect::<Vec<_>>()
    };

    Ok(ChampionGlobalStats {
        champion_id,
        patches,
        platforms: distinct_text(conn, "platform", scope, personal)?,
        seed_tiers: distinct_text(conn, "seed_tier", scope, personal)?,
        patch,
        total_matches,
        games,
        wins,
        bans,
        roles,
        role,
        role_games: role_tally.games,
        role_wins: role_tally.wins,
        rune_pages: top(pages, TOP_PAGES)
            .into_iter()
            .filter_map(|(key, tally)| lookup.page(&key, tally))
            .collect(),
        keystones: icon_stats(keystones, TOP_KEYSTONES, &|id| lookup.rune(id)),
        summoner_spells: top(spells, TOP_SPELLS)
            .into_iter()
            .map(|(pair, tally)| SpellPairStat {
                spells: ids(&pair)
                    .into_iter()
                    .map(|id| summoner_spell(id, lookup.version.as_deref()))
                    .collect(),
                games: tally.games,
                wins: tally.wins,
            })
            .collect(),
        boots: icon_stats(boots, TOP_BOOTS, &|id| lookup.item(id)),
        core_items: icon_stats(items, TOP_ITEMS, &|id| lookup.item(id)),
        strong_against,
        weak_against,
        matchup_min_games: min_games,
        skill_orders: top(skill_priorities, TOP_SKILL_ORDERS)
            .into_iter()
            .map(|(priority, tally)| {
                let sequence = skill_sequences
                    .get(&priority)
                    .and_then(|sequences| {
                        sequences
                            .iter()
                            .max_by(|a, b| a.1.cmp(b.1).then_with(|| b.0.cmp(a.0)))
                            .map(|(sequence, _)| sequence.clone())
                    })
                    .unwrap_or_default();
                SkillOrderStat {
                    priority: priority.chars().map(String::from).collect(),
                    sequence: sequence.chars().map(String::from).collect(),
                    games: tally.games,
                    wins: tally.wins,
                }
            })
            .collect(),
        start_builds: item_sets(&lookup, starts, TOP_STARTS),
        core_builds: item_sets(&lookup, cores, TOP_CORES),
        timeline_games,
        rune_trees: rune_trees(conn, lookup.version.as_deref())?,
        shard_rows: SHARD_ROWS
            .iter()
            .map(|row| row.iter().copied().map(shard).collect())
            .collect(),
        last_fetched_at,
        source: if personal {
            PERSONAL_SOURCE_LABEL.to_string()
        } else {
            SOURCE_LABEL.to_string()
        },
        personal,
    })
}

fn join_ids(ids: &[i64]) -> String {
    ids.iter().map(i64::to_string).collect::<Vec<_>>().join(",")
}

fn item_sets(lookup: &Lookup, map: HashMap<String, Tally>, limit: usize) -> Vec<ItemSetStat> {
    top(map, limit)
        .into_iter()
        .map(|(key, tally)| ItemSetStat {
            items: ids(&key).into_iter().map(|id| lookup.item(id)).collect(),
            games: tally.games,
            wins: tally.wins,
        })
        .collect()
}

/// Order in which Q, W and E are maxed ("QEW"): the ability that reaches its
/// 5th point first comes first; ties by points and first level-up.
pub fn skill_priority(sequence: &str) -> String {
    let mut keys: Vec<(usize, std::cmp::Reverse<usize>, usize, char)> = ['Q', 'W', 'E']
        .into_iter()
        .map(|slot| {
            let mut count = 0;
            let mut fifth = usize::MAX;
            let mut first = usize::MAX;
            for (index, current) in sequence.chars().enumerate() {
                if current == slot {
                    count += 1;
                    if first == usize::MAX {
                        first = index;
                    }
                    if count == 5 {
                        fifth = index;
                    }
                }
            }
            (fifth, std::cmp::Reverse(count), first, slot)
        })
        .collect();
    keys.sort();
    keys.into_iter().map(|key| key.3).collect()
}

fn count_games(conn: &Connection, champion_id: i64, personal: bool) -> Result<i64, AppError> {
    Ok(conn.query_row(
        &sql("SELECT COUNT(*)
             FROM global_participants p JOIN global_matches m ON m.match_id = p.match_id
             WHERE p.champion_id = :champion AND {VALID}"),
        named_params! {
            ":patch": Option::<&str>::None,
            ":min_seconds": MIN_GAME_SECONDS,
            ":personal": personal,
            ":champion": champion_id,
        },
        |row| row.get(0),
    )?)
}

/// Collected matches when they contain the champion, otherwise the user's
/// own saved matches (when they do).
fn use_personal(conn: &Connection, champion_id: i64) -> Result<bool, AppError> {
    if count_games(conn, champion_id, false)? > 0 {
        return Ok(false);
    }
    Ok(count_games(conn, champion_id, true)? > 0)
}

/// Patches with valid matches of one source, newest first.
fn patch_samples(conn: &Connection, personal: bool) -> Result<Vec<PatchSample>, AppError> {
    let mut statement = conn.prepare(&sql(
        "SELECT m.patch, COUNT(*) FROM global_matches m WHERE {VALID} GROUP BY m.patch",
    ))?;
    let mut samples = statement
        .query_map(
            named_params! {
                ":patch": Option::<&str>::None,
                ":min_seconds": MIN_GAME_SECONDS,
                ":personal": personal,
            },
            |row| {
                Ok(PatchSample {
                    patch: row.get(0)?,
                    matches: row.get(1)?,
                })
            },
        )?
        .collect::<Result<Vec<_>, _>>()?;
    samples.sort_by_key(|sample| {
        std::cmp::Reverse(crate::ddragon::bundle::version_key(&format!(
            "{}.0",
            sample.patch
        )))
    });
    Ok(samples)
}

/// Lanes actually played by every champion, from collected and personal
/// matches together (remakes excluded).
pub fn champion_roles(conn: &Connection) -> Result<ChampionRolesOverview, AppError> {
    let mut statement = conn.prepare(
        "SELECT p.champion_id, p.team_position, COUNT(*), COALESCE(SUM(p.win), 0)
         FROM global_participants p JOIN global_matches m ON m.match_id = p.match_id
         WHERE p.team_position <> '' AND m.duration_seconds >= :min_seconds
           AND m.ended_early = 0 AND m.queue_id IN (400, 420, 430, 440, 490)
         GROUP BY p.champion_id, p.team_position
         ORDER BY p.champion_id, 3 DESC, 2",
    )?;
    let rows = statement.query_map(named_params! { ":min_seconds": MIN_GAME_SECONDS }, |row| {
        Ok((
            row.get::<_, i64>(0)?,
            RoleShare {
                role: row.get(1)?,
                games: row.get(2)?,
                wins: row.get(3)?,
            },
        ))
    })?;
    let mut champions: Vec<ChampionRoles> = Vec::new();
    for row in rows {
        let (champion_id, share) = row?;
        match champions.last_mut() {
            Some(last) if last.champion_id == champion_id => {
                last.games += share.games;
                last.roles.push(share);
            }
            _ => champions.push(ChampionRoles {
                champion_id,
                games: share.games,
                roles: vec![share],
            }),
        }
    }
    let count = |personal: bool| -> Result<i64, AppError> {
        Ok(conn.query_row(
            &sql("SELECT COUNT(*) FROM global_matches m WHERE {VALID}"),
            named_params! {
                ":patch": Option::<&str>::None,
                ":min_seconds": MIN_GAME_SECONDS,
                ":personal": personal,
            },
            |row| row.get(0),
        )?)
    };
    Ok(ChampionRolesOverview {
        champions,
        global_matches: count(false)?,
        personal_matches: count(true)?,
    })
}
