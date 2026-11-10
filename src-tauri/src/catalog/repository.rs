//! SQL for the versioned Data Dragon catalog.
//!
//! * Imports run in one transaction and are verified before commit: a failed
//!   check rolls everything back, existing patches are never touched.
//! * Reads always target the newest imported patch; older patches stay in the
//!   database (immutable, see migration 0003) for historical matches.

use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::catalog::dto::{
    CatalogStatus, ChampionCatalog, ChampionDetail, ChampionListItem, ChampionSkin, ChampionSpell,
    CheckRecord, IntegrityReport, PatchSummary,
};
use crate::catalog::preferences::{champion_preferences, PreferenceIndex};
use crate::ddragon::bundle::{html_to_text, version_key, PatchBundle};
use crate::ddragon::model::{ChampionInfo, ChampionStats};
use crate::ddragon::{urls, SOURCE_NAME};
use crate::error::AppError;

/// Check log entries kept in `data_dragon_checks`.
const KEEP_CHECKS: i64 = 200;

fn patch_label(version: &str) -> String {
    version.split('.').take(2).collect::<Vec<_>>().join(".")
}

pub fn version_exists(conn: &Connection, version: &str) -> Result<bool, AppError> {
    Ok(conn
        .query_row(
            "SELECT 1 FROM patch_versions WHERE version = ?1",
            [version],
            |_| Ok(()),
        )
        .optional()?
        .is_some())
}

/// Newest imported version by numeric order (16.10.1 > 16.9.1).
pub fn current_version(conn: &Connection) -> Result<Option<String>, AppError> {
    let mut statement = conn.prepare("SELECT version FROM patch_versions")?;
    let versions = statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(versions
        .into_iter()
        .filter_map(|version| version_key(&version).map(|key| (key, version)))
        .max_by_key(|(key, _)| *key)
        .map(|(_, version)| version))
}

fn map_patch(row: &Row<'_>) -> rusqlite::Result<PatchSummary> {
    let version: String = row.get(0)?;
    Ok(PatchSummary {
        patch: patch_label(&version),
        version,
        language: row.get(1)?,
        source: SOURCE_NAME.to_string(),
        source_url: row.get(2)?,
        imported_at: row.get(3)?,
        champion_count: row.get(4)?,
        spell_count: row.get(5)?,
        skin_count: row.get(6)?,
        item_count: row.get(7)?,
        rune_count: row.get(8)?,
    })
}

const PATCH_COLUMNS: &str = "version, language, source_url, imported_at, champion_count, \
     spell_count, skin_count, item_count, rune_count";

pub fn patch_summary(conn: &Connection, version: &str) -> Result<Option<PatchSummary>, AppError> {
    Ok(conn
        .query_row(
            &format!("SELECT {PATCH_COLUMNS} FROM patch_versions WHERE version = ?1"),
            [version],
            map_patch,
        )
        .optional()?)
}

/// All imported patches, newest first.
pub fn list_patches(conn: &Connection) -> Result<Vec<PatchSummary>, AppError> {
    let mut statement = conn.prepare(&format!("SELECT {PATCH_COLUMNS} FROM patch_versions"))?;
    let mut patches = statement
        .query_map([], map_patch)?
        .collect::<Result<Vec<_>, _>>()?;
    patches.sort_by_key(|patch| std::cmp::Reverse(version_key(&patch.version)));
    Ok(patches)
}

/// Imports a validated bundle as a new, immutable patch.
pub fn import_bundle(
    conn: &mut Connection,
    bundle: &PatchBundle,
    source_url: &str,
) -> Result<IntegrityReport, AppError> {
    let version = bundle.version.as_str();

    if version_exists(conn, version)? {
        return Err(AppError::Validation(format!(
            "la patch {version} è già importata"
        )));
    }

    // Only the newest patch refreshes the stable `champions` identity rows, so
    // importing an older version can never overwrite newer names or images.
    let is_newest = match current_version(conn)? {
        None => true,
        Some(current) => version_key(version) > version_key(&current),
    };

    let tx = conn.transaction()?;

    tx.execute(
        "INSERT INTO patch_versions
            (version, language, source, source_url, champion_count, spell_count,
             skin_count, item_count, rune_count)
         VALUES (?1, ?2, 'data_dragon', ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            version,
            bundle.language,
            source_url,
            bundle.champions.len() as i64,
            bundle.spell_count() as i64,
            bundle.skin_count() as i64,
            bundle.items.len() as i64,
            bundle.rune_count() as i64,
        ],
    )?;

    {
        let identity_sql = if is_newest {
            "INSERT INTO champions (id, champion_key, name, title, roles_json, image_url, data_version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                champion_key = excluded.champion_key,
                name = excluded.name,
                title = excluded.title,
                roles_json = excluded.roles_json,
                image_url = excluded.image_url,
                data_version = excluded.data_version,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
        } else {
            "INSERT INTO champions (id, champion_key, name, title, roles_json, image_url, data_version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO NOTHING"
        };
        let mut identity = tx.prepare(identity_sql)?;
        let mut champion = tx.prepare(
            "INSERT INTO champion_versions
                (champion_id, patch_version, ddragon_id, name, title, blurb, lore,
                 tags_json, partype, info_json, stats_json, image_file)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        )?;
        let mut spell = tx.prepare(
            "INSERT INTO champion_spells
                (champion_id, patch_version, slot, spell_key, name, description,
                 cooldown, cost, spell_range, max_rank, image_group, image_file)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        )?;
        let mut skin = tx.prepare(
            "INSERT INTO champion_skins
                (patch_version, skin_id, champion_id, num, name, has_chromas)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )?;

        for record in &bundle.champions {
            let tags_json = serde_json::to_string(&record.tags)?;
            identity.execute(params![
                record.id,
                record.ddragon_id,
                record.name,
                record.title,
                tags_json,
                urls::champion_square(version, &record.image_file),
                version,
            ])?;
            champion.execute(params![
                record.id,
                version,
                record.ddragon_id,
                record.name,
                record.title,
                record.blurb,
                record.lore,
                tags_json,
                record.partype,
                record.info_json,
                record.stats_json,
                record.image_file,
            ])?;
            for item in &record.spells {
                spell.execute(params![
                    record.id,
                    version,
                    item.slot,
                    item.spell_key,
                    item.name,
                    item.description,
                    item.cooldown,
                    item.cost,
                    item.range,
                    item.max_rank,
                    item.image_group,
                    item.image_file,
                ])?;
            }
            for item in &record.skins {
                skin.execute(params![
                    version,
                    item.skin_id,
                    record.id,
                    item.num,
                    item.name,
                    item.has_chromas,
                ])?;
            }
        }

        let mut item = tx.prepare(
            "INSERT INTO items
                (patch_version, item_id, name, plaintext, description, gold_base,
                 gold_total, gold_sell, purchasable, in_store, tags_json, maps_json,
                 builds_from_json, builds_into_json, image_file)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
        )?;
        for record in &bundle.items {
            item.execute(params![
                version,
                record.item_id,
                record.name,
                record.plaintext,
                record.description,
                record.gold_base,
                record.gold_total,
                record.gold_sell,
                record.purchasable,
                record.in_store,
                record.tags_json,
                record.maps_json,
                record.builds_from_json,
                record.builds_into_json,
                record.image_file,
            ])?;
        }

        let mut tree = tx.prepare(
            "INSERT INTO rune_trees (patch_version, tree_id, tree_key, name, icon_path)
             VALUES (?1, ?2, ?3, ?4, ?5)",
        )?;
        let mut rune = tx.prepare(
            "INSERT INTO runes
                (patch_version, rune_id, tree_id, slot_index, rune_key, name,
                 short_desc, long_desc, icon_path)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        )?;
        for record in &bundle.rune_trees {
            tree.execute(params![
                version,
                record.tree_id,
                record.key,
                record.name,
                record.icon_path,
            ])?;
            for item in &record.runes {
                rune.execute(params![
                    version,
                    item.rune_id,
                    record.tree_id,
                    item.slot_index,
                    item.key,
                    item.name,
                    item.short_desc,
                    item.long_desc,
                    item.icon_path,
                ])?;
            }
        }
    }

    let mut report = verify_patch(&tx, version)?;
    let expected = [
        ("campioni", report.champion_count, bundle.champions.len()),
        ("abilità", report.spell_count, bundle.spell_count()),
        ("skin", report.skin_count, bundle.skin_count()),
        ("oggetti", report.item_count, bundle.items.len()),
        ("rune", report.rune_count, bundle.rune_count()),
    ];
    for (label, stored, source) in expected {
        if stored != source as i64 {
            report.problems.push(format!(
                "{label}: {stored} salvati invece dei {source} presenti nella fonte"
            ));
        }
    }

    if !report.problems.is_empty() {
        // Dropping `tx` rolls the whole import back.
        return Err(AppError::SourceData {
            source_name: SOURCE_NAME,
            detail: format!(
                "verifica di integrità fallita per {version}: {}",
                report.problems.join("; ")
            ),
        });
    }

    tx.commit()?;
    Ok(report)
}

fn count(conn: &Connection, sql: &str, version: &str) -> Result<i64, AppError> {
    Ok(conn.query_row(sql, [version], |row| row.get(0))?)
}

fn list_strings(conn: &Connection, sql: &str, version: &str) -> Result<Vec<String>, AppError> {
    let mut statement = conn.prepare(sql)?;
    let values = statement
        .query_map([version], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(values)
}

/// Structural checks on one patch: counts, five abilities per champion, base
/// skin present, no duplicate names, foreign keys and database consistency.
pub fn verify_patch(conn: &Connection, version: &str) -> Result<IntegrityReport, AppError> {
    let mut problems = Vec::new();

    for champion in list_strings(
        conn,
        "SELECT cv.ddragon_id FROM champion_versions cv
         WHERE cv.patch_version = ?1
           AND (SELECT COUNT(*) FROM champion_spells s
                WHERE s.patch_version = cv.patch_version
                  AND s.champion_id = cv.champion_id) <> 5",
        version,
    )? {
        problems.push(format!("{champion} non ha esattamente passiva + Q/W/E/R"));
    }

    for champion in list_strings(
        conn,
        "SELECT cv.ddragon_id FROM champion_versions cv
         WHERE cv.patch_version = ?1
           AND NOT EXISTS (SELECT 1 FROM champion_skins k
                           WHERE k.patch_version = cv.patch_version
                             AND k.champion_id = cv.champion_id AND k.num = 0)",
        version,
    )? {
        problems.push(format!("{champion} non ha la skin base"));
    }

    for name in list_strings(
        conn,
        "SELECT name FROM champion_versions WHERE patch_version = ?1
         GROUP BY lower(name) HAVING COUNT(*) > 1",
        version,
    )? {
        problems.push(format!("nome campione duplicato: {name}"));
    }

    let mut fk_statement = conn.prepare("PRAGMA foreign_key_check")?;
    let fk_violations = fk_statement
        .query_map([], |row| row.get::<_, String>(0))?
        .collect::<Result<Vec<_>, _>>()?;
    for table in fk_violations {
        problems.push(format!("riferimento non valido nella tabella {table}"));
    }

    let quick_check: String = conn.query_row("PRAGMA quick_check", [], |row| row.get(0))?;
    if quick_check != "ok" {
        problems.push(format!("controllo SQLite: {quick_check}"));
    }

    Ok(IntegrityReport {
        version: version.to_string(),
        champion_count: count(
            conn,
            "SELECT COUNT(*) FROM champion_versions WHERE patch_version = ?1",
            version,
        )?,
        spell_count: count(
            conn,
            "SELECT COUNT(*) FROM champion_spells WHERE patch_version = ?1",
            version,
        )?,
        skin_count: count(
            conn,
            "SELECT COUNT(*) FROM champion_skins WHERE patch_version = ?1",
            version,
        )?,
        item_count: count(
            conn,
            "SELECT COUNT(*) FROM items WHERE patch_version = ?1",
            version,
        )?,
        rune_tree_count: count(
            conn,
            "SELECT COUNT(*) FROM rune_trees WHERE patch_version = ?1",
            version,
        )?,
        rune_count: count(
            conn,
            "SELECT COUNT(*) FROM runes WHERE patch_version = ?1",
            version,
        )?,
        problems,
    })
}

fn parse_tags(json: &str) -> Vec<String> {
    serde_json::from_str(json).unwrap_or_default()
}

pub fn champion_catalog(conn: &Connection) -> Result<ChampionCatalog, AppError> {
    let Some(version) = current_version(conn)? else {
        return Ok(ChampionCatalog {
            patch: None,
            champions: Vec::new(),
        });
    };

    let preferences = PreferenceIndex::load(conn)?;
    let mut statement = conn.prepare(
        "SELECT champion_id, ddragon_id, name, title, tags_json, image_file
         FROM champion_versions
         WHERE patch_version = ?1
         ORDER BY name COLLATE NOCASE",
    )?;
    let champions = statement
        .query_map([&version], |row| {
            let id: i64 = row.get(0)?;
            let image_file: String = row.get(5)?;
            let tags_json: String = row.get(4)?;
            Ok(ChampionListItem {
                id,
                key: row.get(1)?,
                name: row.get(2)?,
                title: row.get(3)?,
                tags: parse_tags(&tags_json),
                image_url: urls::champion_square(&version, &image_file),
                favorite: preferences.is_favorite(id),
                lanes: preferences.lanes(id),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ChampionCatalog {
        patch: patch_summary(conn, &version)?,
        champions,
    })
}

/// Detail of one champion in the newest patch, by Data Dragon id ("Ahri").
pub fn champion_detail(conn: &Connection, key: &str) -> Result<Option<ChampionDetail>, AppError> {
    let Some(version) = current_version(conn)? else {
        return Ok(None);
    };
    let Some(patch) = patch_summary(conn, &version)? else {
        return Ok(None);
    };

    struct Base {
        id: i64,
        key: String,
        name: String,
        title: String,
        blurb: String,
        lore: String,
        tags_json: String,
        partype: String,
        info_json: String,
        stats_json: String,
        image_file: String,
    }

    let base = conn
        .query_row(
            "SELECT champion_id, ddragon_id, name, title, blurb, lore, tags_json,
                    partype, info_json, stats_json, image_file
             FROM champion_versions
             WHERE patch_version = ?1 AND ddragon_id = ?2 COLLATE NOCASE",
            params![version, key],
            |row| {
                Ok(Base {
                    id: row.get(0)?,
                    key: row.get(1)?,
                    name: row.get(2)?,
                    title: row.get(3)?,
                    blurb: row.get(4)?,
                    lore: row.get(5)?,
                    tags_json: row.get(6)?,
                    partype: row.get(7)?,
                    info_json: row.get(8)?,
                    stats_json: row.get(9)?,
                    image_file: row.get(10)?,
                })
            },
        )
        .optional()?;

    let Some(base) = base else {
        return Ok(None);
    };

    let info: ChampionInfo = serde_json::from_str(&base.info_json)?;
    let stats: ChampionStats = serde_json::from_str(&base.stats_json)?;

    let mut spell_statement = conn.prepare(
        "SELECT slot, spell_key, name, description, cooldown, cost, spell_range,
                max_rank, image_group, image_file
         FROM champion_spells
         WHERE patch_version = ?1 AND champion_id = ?2
         ORDER BY CASE slot WHEN 'P' THEN 0 WHEN 'Q' THEN 1 WHEN 'W' THEN 2
                            WHEN 'E' THEN 3 ELSE 4 END",
    )?;
    let spells = spell_statement
        .query_map(params![version, base.id], |row| {
            let description: String = row.get(3)?;
            let group: String = row.get(8)?;
            let file: String = row.get(9)?;
            Ok(ChampionSpell {
                slot: row.get(0)?,
                key: row.get(1)?,
                name: row.get(2)?,
                description: html_to_text(&description),
                cooldown: row.get(4)?,
                cost: row.get(5)?,
                range: row.get(6)?,
                max_rank: row.get(7)?,
                image_url: urls::spell(&version, &group, &file),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let mut skin_statement = conn.prepare(
        "SELECT skin_id, num, name, has_chromas
         FROM champion_skins
         WHERE patch_version = ?1 AND champion_id = ?2
         ORDER BY num",
    )?;
    let skins = skin_statement
        .query_map(params![version, base.id], |row| {
            let num: i64 = row.get(1)?;
            Ok(ChampionSkin {
                id: row.get(0)?,
                num,
                name: row.get(2)?,
                has_chromas: row.get(3)?,
                splash_url: urls::skin_splash(&base.key, num),
                loading_url: urls::skin_loading(&base.key, num),
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    let user = champion_preferences(conn, base.id)?;

    Ok(Some(ChampionDetail {
        favorite: user.favorite,
        lanes: user.lanes,
        id: base.id,
        image_url: urls::champion_square(&version, &base.image_file),
        splash_url: urls::skin_splash(&base.key, 0),
        name: base.name,
        title: base.title,
        blurb: html_to_text(&base.blurb),
        lore: html_to_text(&base.lore),
        tags: parse_tags(&base.tags_json),
        partype: base.partype,
        info,
        stats,
        spells,
        skins,
        patch,
        key: base.key,
    }))
}

pub fn record_check(
    conn: &Connection,
    latest_version: Option<&str>,
    outcome: &str,
    detail: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "INSERT INTO data_dragon_checks (latest_version, outcome, detail) VALUES (?1, ?2, ?3)",
        params![latest_version, outcome, detail],
    )?;
    conn.execute(
        "DELETE FROM data_dragon_checks WHERE id NOT IN (
            SELECT id FROM data_dragon_checks ORDER BY id DESC LIMIT ?1)",
        [KEEP_CHECKS],
    )?;
    Ok(())
}

pub fn last_check(conn: &Connection) -> Result<Option<CheckRecord>, AppError> {
    Ok(conn
        .query_row(
            "SELECT checked_at, latest_version, outcome, detail
             FROM data_dragon_checks ORDER BY id DESC LIMIT 1",
            [],
            |row| {
                Ok(CheckRecord {
                    checked_at: row.get(0)?,
                    latest_version: row.get(1)?,
                    outcome: row.get(2)?,
                    detail: row.get(3)?,
                })
            },
        )
        .optional()?)
}

/// Minutes since the last check and its outcome, computed by SQLite.
pub fn last_check_age(conn: &Connection) -> Result<Option<(f64, String)>, AppError> {
    Ok(conn
        .query_row(
            "SELECT (julianday('now') - julianday(checked_at)) * 1440.0, outcome
             FROM data_dragon_checks ORDER BY id DESC LIMIT 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?)
}

pub fn catalog_status(
    conn: &Connection,
    syncing: bool,
    check_interval_hours: u32,
) -> Result<CatalogStatus, AppError> {
    let versions = list_patches(conn)?;
    Ok(CatalogStatus {
        current: versions.first().cloned(),
        versions,
        last_check: last_check(conn)?,
        syncing,
        check_interval_hours,
    })
}
