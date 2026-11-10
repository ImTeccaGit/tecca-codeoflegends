//! Catalog tests on fictional fixtures ("Alpha", "Beta", patches 1.x): they
//! mirror the Data Dragon file shapes but contain no real game data.
//! `live_data_dragon_import` (ignored by default) checks the real service.

use serde_json::{json, Value};

use crate::catalog::repository;
use crate::ddragon::bundle::{build_bundle, html_to_text, newest_release, PatchBundle};
use crate::ddragon::model::{ChampionFullFile, ItemFile, RawRuneTree};
use crate::ddragon::urls;
use crate::error::AppError;
use crate::test_support::TempDb;

const SOURCE: &str = "https://example.invalid/championFull.json";

fn stats() -> Value {
    let keys = [
        "hp",
        "hpperlevel",
        "mp",
        "mpperlevel",
        "movespeed",
        "armor",
        "armorperlevel",
        "spellblock",
        "spellblockperlevel",
        "attackrange",
        "hpregen",
        "hpregenperlevel",
        "mpregen",
        "mpregenperlevel",
        "crit",
        "critperlevel",
        "attackdamage",
        "attackdamageperlevel",
        "attackspeedperlevel",
        "attackspeed",
    ];
    Value::Object(
        keys.iter()
            .map(|key| (key.to_string(), json!(1.5)))
            .collect(),
    )
}

fn champion(id: &str, key: i64, name_suffix: &str) -> Value {
    let spells: Vec<Value> = ["Q", "W", "E", "R"]
        .iter()
        .map(|slot| {
            json!({
                "id": format!("{id}{slot}"),
                "name": format!("{id} {slot}"),
                "description": format!("Abilità {slot}<br>di <magicDamage>{id}</magicDamage>"),
                "maxrank": 5,
                "cooldownBurn": "10/9/8/7/6",
                "costBurn": "50",
                "rangeBurn": "600",
                "image": { "full": format!("{id}{slot}.png") }
            })
        })
        .collect();

    json!({
        "id": id,
        "key": key.to_string(),
        "name": format!("{id}{name_suffix}"),
        "title": "campione di prova",
        "image": { "full": format!("{id}.png") },
        "skins": [
            { "id": format!("{key}000"), "num": 0, "name": "default", "chromas": false },
            { "id": format!("{key}001"), "num": 1, "name": format!("{id} Prova"), "chromas": true }
        ],
        "lore": "Storia<br><br>di prova &amp; test.",
        "blurb": "Breve <i>descrizione</i>.",
        "tags": ["Mage"],
        "partype": "Mana",
        "info": { "attack": 3, "defense": 4, "magic": 8, "difficulty": 5 },
        "stats": stats(),
        "spells": spells,
        "passive": {
            "name": format!("{id} passiva"),
            "description": "Passiva di prova.",
            "image": { "full": format!("{id}_P.png") }
        }
    })
}

fn raw_files(version: &str, champions: &[Value]) -> (Value, Value, Value) {
    let data: serde_json::Map<String, Value> = champions
        .iter()
        .map(|c| (c["id"].as_str().unwrap().to_string(), c.clone()))
        .collect();
    let champion_full = json!({ "version": version, "data": data });
    let items = json!({
        "version": version,
        "data": {
            "1001": {
                "name": "Oggetto di prova",
                "description": "<stats>+10</stats>",
                "plaintext": "Test",
                "image": { "full": "1001.png" },
                "gold": { "base": 300, "total": 300, "sell": 210, "purchasable": true },
                "tags": ["Boots"],
                "maps": { "11": true }
            },
            "2001": {
                "name": "Oggetto nascosto",
                "image": { "full": "2001.png" },
                "gold": { "base": 0, "total": 0, "sell": 0, "purchasable": false },
                "inStore": false
            }
        }
    });
    let runes = json!([{
        "id": 8000, "key": "Precision", "icon": "perk-images/Styles/Test.png", "name": "Precisione",
        "slots": [
            { "runes": [ { "id": 8005, "key": "Test", "icon": "perk-images/Test.png",
                           "name": "Runa di prova", "shortDesc": "breve", "longDesc": "lunga" } ] }
        ]
    }]);
    (champion_full, items, runes)
}

fn bundle_from(version: &str, champions: &[Value]) -> Result<PatchBundle, AppError> {
    let (champion_full, items, runes) = raw_files(version, champions);
    build_bundle(
        version,
        "it_IT",
        serde_json::from_value::<ChampionFullFile>(champion_full).unwrap(),
        serde_json::from_value::<ItemFile>(items).unwrap(),
        serde_json::from_value::<Vec<RawRuneTree>>(runes).unwrap(),
    )
}

fn default_bundle(version: &str) -> PatchBundle {
    bundle_from(
        version,
        &[champion("Alpha", 9001, ""), champion("Beta", 9002, "")],
    )
    .expect("valid fixture bundle")
}

fn count(db: &crate::db::Database, sql: &str) -> i64 {
    db.with_connection(|conn| Ok(conn.query_row(sql, [], |row| row.get(0))?))
        .unwrap()
}

#[test]
fn html_is_reduced_to_plain_text() {
    assert_eq!(
        html_to_text("Danni<br>magici <magicDamage>80</magicDamage> &amp; altro"),
        "Danni\nmagici 80 & altro"
    );
    assert_eq!(html_to_text("A<br><br><br>B"), "A\n\nB");
    assert_eq!(html_to_text("  <i>solo</i>  testo "), "solo testo");
}

#[test]
fn newest_release_uses_numeric_order_and_skips_legacy_entries() {
    let versions = ["16.9.1", "16.10.1", "lolpatch_3.7", "0.151.2", "16.10.1b"]
        .map(String::from)
        .to_vec();
    assert_eq!(newest_release(&versions).as_deref(), Some("16.10.1"));
}

#[test]
fn bundle_rejects_inconsistent_source_data() {
    // File version different from the requested one.
    let (champion_full, items, runes) = raw_files("1.1.1", &[champion("Alpha", 9001, "")]);
    let wrong = build_bundle(
        "1.2.1",
        "it_IT",
        serde_json::from_value(champion_full).unwrap(),
        serde_json::from_value(items).unwrap(),
        serde_json::from_value(runes).unwrap(),
    );
    assert!(matches!(wrong, Err(AppError::SourceData { .. })));

    // A champion with three abilities.
    let mut broken = champion("Alpha", 9001, "");
    broken["spells"].as_array_mut().unwrap().pop();
    assert!(bundle_from("1.1.1", &[broken]).is_err());

    // Missing base skin.
    let mut no_base = champion("Alpha", 9001, "");
    no_base["skins"].as_array_mut().unwrap().remove(0);
    assert!(bundle_from("1.1.1", &[no_base]).is_err());

    // Duplicate numeric keys.
    assert!(bundle_from(
        "1.1.1",
        &[champion("Alpha", 9001, ""), champion("Beta", 9001, "")]
    )
    .is_err());
}

#[test]
fn import_stores_everything_with_correct_associations() {
    let temp = TempDb::new("catalog-import");
    let db = temp.open();
    let bundle = default_bundle("1.1.1");

    let report = db
        .with_connection(|conn| repository::import_bundle(conn, &bundle, SOURCE))
        .expect("import");
    assert!(report.problems.is_empty(), "{:?}", report.problems);
    assert_eq!(report.champion_count, 2);
    assert_eq!(report.spell_count, 10);
    assert_eq!(report.skin_count, 4);
    assert_eq!(report.item_count, 2);
    assert_eq!(report.rune_tree_count, 1);
    assert_eq!(report.rune_count, 1);

    // Every Alpha ability belongs to Alpha (id 9001) and to no one else.
    let wrong_owner = count(
        &db,
        "SELECT COUNT(*) FROM champion_spells
         WHERE (champion_id = 9001 AND spell_key LIKE 'Beta%')
            OR (champion_id = 9002 AND spell_key LIKE 'Alpha%')",
    );
    assert_eq!(wrong_owner, 0);

    let detail = db
        .with_connection(|conn| repository::champion_detail(conn, "alpha"))
        .expect("detail")
        .expect("Alpha exists");
    assert_eq!(detail.id, 9001);
    assert_eq!(
        detail
            .spells
            .iter()
            .map(|s| s.slot.as_str())
            .collect::<Vec<_>>(),
        ["P", "Q", "W", "E", "R"]
    );
    assert_eq!(detail.spells[1].key, "AlphaQ");
    assert_eq!(detail.spells[1].description, "Abilità Q\ndi Alpha");
    assert_eq!(
        detail.spells[1].image_url,
        "https://ddragon.leagueoflegends.com/cdn/1.1.1/img/spell/AlphaQ.png"
    );
    assert_eq!(
        detail.spells[0].image_url,
        "https://ddragon.leagueoflegends.com/cdn/1.1.1/img/passive/Alpha_P.png"
    );
    assert_eq!(
        detail.skins[0].name, "Alpha",
        "base skin shows the champion name"
    );
    assert_eq!(
        detail.skins[1].loading_url,
        "https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Alpha_1.jpg"
    );
    assert_eq!(detail.lore, "Storia\n\ndi prova & test.");
    assert_eq!(detail.patch.patch, "1.1");

    assert!(db
        .with_connection(|conn| repository::champion_detail(conn, "Gamma"))
        .unwrap()
        .is_none());
}

#[test]
fn same_version_cannot_be_imported_twice() {
    let temp = TempDb::new("catalog-duplicate");
    let db = temp.open();
    let bundle = default_bundle("1.1.1");

    db.with_connection(|conn| repository::import_bundle(conn, &bundle, SOURCE))
        .unwrap();
    let again = db.with_connection(|conn| repository::import_bundle(conn, &bundle, SOURCE));
    assert!(again.is_err());
    assert_eq!(count(&db, "SELECT COUNT(*) FROM champion_versions"), 2);
    assert_eq!(count(&db, "SELECT COUNT(*) FROM patch_versions"), 1);
}

#[test]
fn new_versions_keep_historical_data() {
    let temp = TempDb::new("catalog-history");
    let db = temp.open();

    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.1.1"), SOURCE))
        .unwrap();
    let renamed = bundle_from(
        "1.2.1",
        &[
            champion("Alpha", 9001, " Rinnovato"),
            champion("Beta", 9002, ""),
        ],
    )
    .unwrap();
    db.with_connection(|conn| repository::import_bundle(conn, &renamed, SOURCE))
        .unwrap();

    assert_eq!(count(&db, "SELECT COUNT(*) FROM patch_versions"), 2);
    assert_eq!(count(&db, "SELECT COUNT(*) FROM champion_versions"), 4);
    assert_eq!(
        count(
            &db,
            "SELECT COUNT(*) FROM champion_versions WHERE patch_version = '1.1.1' AND name = 'Alpha'"
        ),
        1,
        "the old name stays attached to the old patch"
    );

    let catalog = db
        .with_connection(|conn| repository::champion_catalog(conn))
        .unwrap();
    assert_eq!(catalog.patch.unwrap().version, "1.2.1");
    assert!(catalog
        .champions
        .iter()
        .any(|c| c.name == "Alpha Rinnovato"));

    // Importing an older patch later never overwrites the newest identity.
    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.0.1"), SOURCE))
        .unwrap();
    let identity: (String, String) = db
        .with_connection(|conn| {
            Ok(conn.query_row(
                "SELECT name, data_version FROM champions WHERE id = 9001",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?)
        })
        .unwrap();
    assert_eq!(
        identity,
        ("Alpha Rinnovato".to_string(), "1.2.1".to_string())
    );

    let status = db
        .with_connection(|conn| repository::catalog_status(conn, false, 6))
        .unwrap();
    assert_eq!(
        status
            .versions
            .iter()
            .map(|v| v.version.as_str())
            .collect::<Vec<_>>(),
        ["1.2.1", "1.1.1", "1.0.1"]
    );
}

#[test]
fn historical_rows_are_immutable() {
    let temp = TempDb::new("catalog-immutable");
    let db = temp.open();
    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.1.1"), SOURCE))
        .unwrap();

    for sql in [
        "DELETE FROM patch_versions",
        "DELETE FROM champion_versions",
        "UPDATE champion_spells SET name = 'x'",
        "DELETE FROM champion_skins",
        "UPDATE items SET name = 'x'",
        "DELETE FROM runes",
    ] {
        let result = db.with_connection(|conn| Ok(conn.execute(sql, [])?));
        assert!(result.is_err(), "{sql} must be rejected");
    }
    assert_eq!(count(&db, "SELECT COUNT(*) FROM champion_spells"), 10);
}

#[test]
fn failed_integrity_check_rolls_back_everything() {
    let temp = TempDb::new("catalog-rollback");
    let db = temp.open();
    let mut bundle = default_bundle("1.1.1");
    // Bypass build_bundle validation to simulate a corrupted bundle.
    bundle.champions[0].spells.pop();

    let result = db.with_connection(|conn| repository::import_bundle(conn, &bundle, SOURCE));
    assert!(matches!(result, Err(AppError::SourceData { .. })));
    assert_eq!(count(&db, "SELECT COUNT(*) FROM patch_versions"), 0);
    assert_eq!(count(&db, "SELECT COUNT(*) FROM champion_versions"), 0);
    assert_eq!(count(&db, "SELECT COUNT(*) FROM champions"), 0);
}

#[test]
fn check_log_records_outcomes() {
    let temp = TempDb::new("catalog-checks");
    let db = temp.open();
    db.with_connection(|conn| {
        repository::record_check(conn, None, "failed", Some("offline"))?;
        repository::record_check(conn, Some("1.1.1"), "up_to_date", None)
    })
    .unwrap();
    let last = db
        .with_connection(|conn| repository::last_check(conn))
        .unwrap()
        .unwrap();
    assert_eq!(last.outcome, "up_to_date");
    assert_eq!(last.latest_version.as_deref(), Some("1.1.1"));
}

#[test]
fn image_urls_follow_data_dragon_layout() {
    assert_eq!(
        urls::item("1.1.1", "1001.png"),
        "https://ddragon.leagueoflegends.com/cdn/1.1.1/img/item/1001.png"
    );
    assert_eq!(
        urls::rune("perk-images/Styles/Test.png"),
        "https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/Test.png"
    );
}

#[test]
fn favorites_toggle_and_appear_in_catalog() {
    use crate::catalog::preferences;

    let temp = TempDb::new("prefs-favorites");
    let db = temp.open();
    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.1.1"), SOURCE))
        .unwrap();

    let on = db
        .with_connection(|conn| preferences::set_favorite(conn, 9001, true))
        .unwrap();
    assert!(on.favorite);
    // Idempotent: adding twice keeps one row.
    db.with_connection(|conn| preferences::set_favorite(conn, 9001, true))
        .unwrap();
    assert_eq!(count(&db, "SELECT COUNT(*) FROM favorite_champions"), 1);

    let catalog = db
        .with_connection(|conn| repository::champion_catalog(conn))
        .unwrap();
    let alpha = catalog.champions.iter().find(|c| c.id == 9001).unwrap();
    let beta = catalog.champions.iter().find(|c| c.id == 9002).unwrap();
    assert!(alpha.favorite);
    assert!(!beta.favorite);

    let off = db
        .with_connection(|conn| preferences::set_favorite(conn, 9001, false))
        .unwrap();
    assert!(!off.favorite);
    assert_eq!(count(&db, "SELECT COUNT(*) FROM favorite_champions"), 0);

    // Unknown champion: explicit validation error, nothing written.
    let unknown = db.with_connection(|conn| preferences::set_favorite(conn, 4242, true));
    assert!(matches!(unknown, Err(AppError::Validation(_))));
}

#[test]
fn lanes_are_validated_ordered_and_replaced() {
    use crate::catalog::preferences;

    let temp = TempDb::new("prefs-lanes");
    let db = temp.open();
    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.1.1"), SOURCE))
        .unwrap();

    let lanes = |values: &[&str]| values.iter().map(|v| v.to_string()).collect::<Vec<_>>();

    let saved = db
        .with_connection(|conn| {
            preferences::set_lanes(conn, 9001, &lanes(&["UTILITY", "TOP", "TOP", "MIDDLE"]))
        })
        .unwrap();
    assert_eq!(
        saved.lanes,
        ["TOP", "MIDDLE", "UTILITY"],
        "dedup + Riot order"
    );

    let replaced = db
        .with_connection(|conn| preferences::set_lanes(conn, 9001, &lanes(&["JUNGLE"])))
        .unwrap();
    assert_eq!(replaced.lanes, ["JUNGLE"]);

    let cleared = db
        .with_connection(|conn| preferences::set_lanes(conn, 9001, &[]))
        .unwrap();
    assert!(cleared.lanes.is_empty());

    let invalid = db.with_connection(|conn| preferences::set_lanes(conn, 9001, &lanes(&["ADC"])));
    assert!(matches!(invalid, Err(AppError::Validation(_))));
    assert_eq!(count(&db, "SELECT COUNT(*) FROM user_champion_lanes"), 0);
}

#[test]
fn preferences_survive_new_patches() {
    use crate::catalog::preferences;

    let temp = TempDb::new("prefs-patches");
    let db = temp.open();
    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.1.1"), SOURCE))
        .unwrap();
    db.with_connection(|conn| {
        preferences::set_favorite(conn, 9002, true)?;
        preferences::set_lanes(conn, 9002, &["BOTTOM".to_string()])
    })
    .unwrap();

    db.with_connection(|conn| repository::import_bundle(conn, &default_bundle("1.2.1"), SOURCE))
        .unwrap();

    let detail = db
        .with_connection(|conn| repository::champion_detail(conn, "Beta"))
        .unwrap()
        .unwrap();
    assert_eq!(detail.patch.version, "1.2.1");
    assert!(detail.favorite);
    assert_eq!(detail.lanes, ["BOTTOM"]);
}

/// Real end-to-end check against Data Dragon (network). Run explicitly:
/// `cargo test --manifest-path src-tauri/Cargo.toml -- --ignored --nocapture`
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires network access to ddragon.leagueoflegends.com"]
async fn live_data_dragon_import() {
    use std::collections::BTreeSet;

    use crate::ddragon::client::DataDragonClient;

    let client = DataDragonClient::new().expect("client");
    let version = client.latest_version().await.expect("latest version");
    let bundle = client.fetch_bundle(&version).await.expect("bundle");

    // Independent source: the lightweight champion list must match 1:1.
    let http = reqwest::Client::new();
    let list_bytes = http
        .get(client.data_url(&version, "champion.json"))
        .send()
        .await
        .unwrap()
        .bytes()
        .await
        .unwrap();
    let list: Value = serde_json::from_slice(&list_bytes).unwrap();
    let listed: BTreeSet<String> = list["data"].as_object().unwrap().keys().cloned().collect();
    let imported: BTreeSet<String> = bundle
        .champions
        .iter()
        .map(|c| c.ddragon_id.clone())
        .collect();
    assert_eq!(listed, imported, "every available champion is imported");

    let temp = TempDb::new("catalog-live");
    let db = temp.open();
    let report = db
        .with_connection(|conn| {
            repository::import_bundle(
                conn,
                &bundle,
                &client.data_url(&version, "championFull.json"),
            )
        })
        .expect("import");
    assert!(report.problems.is_empty(), "{:?}", report.problems);
    println!(
        "patch {version}: {} campioni, {} abilità, {} skin, {} oggetti, {} alberi, {} rune",
        report.champion_count,
        report.spell_count,
        report.skin_count,
        report.item_count,
        report.rune_tree_count,
        report.rune_count
    );

    // Images: every champion portrait, ability icon, base splash and rune
    // icon, plus every item icon. HEAD requests, a few at a time.
    let mut image_urls = Vec::new();
    for champion in &bundle.champions {
        image_urls.push(urls::champion_square(&version, &champion.image_file));
        image_urls.push(urls::skin_splash(&champion.ddragon_id, 0));
        for spell in &champion.spells {
            image_urls.push(urls::spell(&version, spell.image_group, &spell.image_file));
        }
    }
    for item in &bundle.items {
        image_urls.push(urls::item(&version, &item.image_file));
    }
    for tree in &bundle.rune_trees {
        image_urls.push(urls::rune(&tree.icon_path));
        for rune in &tree.runes {
            image_urls.push(urls::rune(&rune.icon_path));
        }
    }

    let mut failures = Vec::new();
    for chunk in image_urls.chunks(8) {
        let handles: Vec<_> = chunk
            .iter()
            .cloned()
            .map(|url| {
                let http = http.clone();
                tokio::spawn(async move {
                    let status = http.head(&url).send().await.map(|r| r.status());
                    (url, status)
                })
            })
            .collect();
        for handle in handles {
            let (url, status) = handle.await.expect("task");
            match status {
                Ok(code) if code.is_success() => {}
                other => failures.push(format!("{url} -> {other:?}")),
            }
        }
    }
    println!(
        "immagini verificate: {}, errori: {}",
        image_urls.len(),
        failures.len()
    );
    assert!(
        failures.is_empty(),
        "immagini non raggiungibili: {failures:#?}"
    );
}
