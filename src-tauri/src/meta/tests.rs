//! Global statistics tests: simulated Riot responses, fictional players,
//! champions (ids 9001+) and matches. No network, no real key.

use serde_json::{json, Value};

use crate::db::Database;
use crate::meta::collector::{self, PACE};
use crate::meta::stats::{champion_stats, skill_priority, ALL_PATCHES};
use crate::meta::store::{self, Settings};
use crate::riot::matches::MatchDto;
use crate::riot::tests::client;
use crate::test_support::TempDb;

const ALPHA: i64 = 9001;
const BETA: i64 = 9002;
const PAGE_A: [i64; 4] = [8010, 9111, 9104, 8299];
const PAGE_B: [i64; 4] = [8008, 9111, 9104, 8299];

fn player(index: usize, champion: i64, position: &str, win: bool, keystone_row: [i64; 4]) -> Value {
    json!({
        "puuid": format!("PUUID-{index}"),
        "championId": champion,
        "championName": format!("Fittizio{champion}"),
        "teamId": if index < 5 { 100 } else { 200 },
        "teamPosition": position,
        "win": win,
        "item0": 3047, "item1": 3071, "item2": 0, "item3": 0, "item4": 0, "item5": 0, "item6": 3340,
        "summoner1Id": 12, "summoner2Id": 4,
        "perks": {
            "statPerks": { "offense": 5008, "flex": 5008, "defense": 5011 },
            "styles": [
                { "description": "primaryStyle", "style": 8000, "selections": [
                    { "perk": keystone_row[0] }, { "perk": keystone_row[1] },
                    { "perk": keystone_row[2] }, { "perk": keystone_row[3] }
                ]},
                { "description": "subStyle", "style": 8400, "selections": [
                    { "perk": 8444 }, { "perk": 8242 }
                ]}
            ]
        }
    })
}

/// 10 players: ALPHA top for blue (wins when `alpha_wins`), BETA top for red.
fn game(id: &str, version: &str, duration: i64, alpha_wins: bool, page: [i64; 4]) -> Value {
    let positions = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
    let mut participants = Vec::new();
    for index in 0..10 {
        let blue = index < 5;
        let win = if blue { alpha_wins } else { !alpha_wins };
        let champion = match index {
            0 => ALPHA,
            5 => BETA,
            other => 9100 + other as i64,
        };
        participants.push(player(index, champion, positions[index % 5], win, page));
    }
    json!({
        "metadata": { "matchId": id },
        "info": {
            "gameCreation": 1_790_000_000_000_i64,
            "gameDuration": duration,
            "gameEndTimestamp": 1_790_000_000_000_i64 + duration * 1000,
            "gameMode": "CLASSIC",
            "gameVersion": version,
            "mapId": 11,
            "queueId": 420,
            "participants": participants,
            "teams": [
                { "teamId": 100, "bans": [] },
                { "teamId": 200, "bans": [ { "championId": ALPHA, "pickTurn": 6 } ] }
            ]
        }
    })
}

fn parse(value: &Value) -> MatchDto {
    serde_json::from_value(value.clone()).expect("fictional match parses")
}

fn store(db: &Database, value: &Value) -> bool {
    db.with_connection(|conn| store::store_match(conn, "euw1", "MASTER_PLUS", &parse(value)))
        .expect("store")
}

fn seed_stats(db: &Database) {
    // Patch 16.22: ALPHA plays 6 valid games, wins 4 (page A ×4, page B ×2).
    let games = [
        ("EUW1_1", true, PAGE_A),
        ("EUW1_2", true, PAGE_A),
        ("EUW1_3", true, PAGE_A),
        ("EUW1_4", false, PAGE_A),
        ("EUW1_5", true, PAGE_B),
        ("EUW1_6", false, PAGE_B),
    ];
    for (id, win, page) in games {
        assert!(store(db, &game(id, "16.22.734.1234", 1800, win, page)));
    }
    // Remake: stored but ignored by every statistic.
    assert!(store(
        db,
        &game("EUW1_7", "16.22.734.1234", 200, true, PAGE_B)
    ));
    // Older patch.
    assert!(store(
        db,
        &game("EUW1_8", "16.21.700.1", 1700, false, PAGE_B)
    ));
}

#[test]
fn settings_default_to_disabled_master_plus() {
    let temp = TempDb::new("meta-settings");
    let db = temp.open();
    let settings = db.with_connection(|conn| store::settings(conn)).unwrap();
    assert_eq!(
        settings,
        Settings {
            enabled: false,
            platform: "euw1".to_string(),
            seed_tier: "MASTER_PLUS".to_string()
        }
    );
    let changed = Settings {
        enabled: true,
        platform: "kr".to_string(),
        seed_tier: "DIAMOND".to_string(),
    };
    db.with_connection(|conn| store::save_settings(conn, &changed))
        .unwrap();
    assert_eq!(
        db.with_connection(|conn| store::settings(conn)).unwrap(),
        changed
    );
}

#[test]
fn rune_page_needs_every_selection() {
    let full = parse(&game("EUW1_1", "16.22.1.1", 1800, true, PAGE_A));
    let (page, keystone) = store::rune_page(&full.info.participants[0]);
    assert_eq!(
        page.as_deref(),
        Some("8000|8010,9111,9104,8299|8400|8444,8242|5008,5008,5011")
    );
    assert_eq!(keystone, Some(8010));

    // League client history: no shards, page kept with "0,0,0".
    let mut no_shards = game("EUW1_2", "16.22.1.1", 1800, true, PAGE_A);
    no_shards["info"]["participants"][0]["perks"]["statPerks"] = json!({});
    let no_shards = parse(&no_shards);
    let (page, _) = store::rune_page(&no_shards.info.participants[0]);
    assert_eq!(
        page.as_deref(),
        Some("8000|8010,9111,9104,8299|8400|8444,8242|0,0,0")
    );

    let mut partial = game("EUW1_3", "16.22.1.1", 1800, true, PAGE_A);
    partial["info"]["participants"][0]["perks"]["styles"][1]["selections"] = json!([]);
    let partial = parse(&partial);
    let (page, keystone) = store::rune_page(&partial.info.participants[0]);
    assert_eq!(page, None);
    assert_eq!(keystone, Some(8010));
}

#[test]
fn patch_and_non_standard_games() {
    assert_eq!(store::patch_of("16.22.734.1234").as_deref(), Some("16.22"));
    assert_eq!(store::patch_of("x.1"), None);

    let temp = TempDb::new("meta-nonstandard");
    let db = temp.open();
    let mut small = game("EUW1_1", "16.22.1.1", 1800, true, PAGE_A);
    small["info"]["participants"]
        .as_array_mut()
        .unwrap()
        .truncate(2);
    assert!(!store(&db, &small));
    assert!(!store(&db, &game("EUW1_2", "beta", 1800, true, PAGE_A)));
}

#[test]
fn champion_stats_count_only_valid_games() {
    let temp = TempDb::new("meta-stats");
    let db = temp.open();
    seed_stats(&db);

    let stats = db
        .with_connection(|conn| champion_stats(conn, ALPHA, None, None))
        .unwrap();
    assert_eq!(stats.patch.as_deref(), Some("16.22"));
    assert_eq!(stats.patches.len(), 2);
    assert_eq!(stats.patches[0].patch, "16.22");
    assert_eq!(stats.total_matches, 6, "the remake is ignored");
    assert_eq!((stats.games, stats.wins), (6, 4));
    assert_eq!(stats.bans, 6, "banned by the red team in every valid game");
    assert_eq!(stats.role.as_deref(), Some("TOP"));
    assert_eq!((stats.role_games, stats.role_wins), (6, 4));

    assert_eq!(stats.rune_pages.len(), 2);
    let top_page = &stats.rune_pages[0];
    assert_eq!((top_page.games, top_page.wins), (4, 3));
    assert_eq!(top_page.primary_style.id, 8000);
    let primary: Vec<i64> = top_page.primary_runes.iter().map(|rune| rune.id).collect();
    assert_eq!(primary, PAGE_A);
    assert_eq!(top_page.secondary_style.id, 8400);
    assert_eq!(top_page.shards.len(), 3);
    assert_eq!(top_page.shards[0].name.as_deref(), Some("Forza adattiva"));
    assert_eq!(stats.keystones[0].icon.id, 8010);

    assert_eq!(stats.summoner_spells.len(), 1);
    let spells: Vec<i64> = stats.summoner_spells[0]
        .spells
        .iter()
        .map(|s| s.id)
        .collect();
    assert_eq!(spells, [4, 12]);
    assert_eq!(
        stats.summoner_spells[0].spells[0].name.as_deref(),
        Some("Flash")
    );

    // Lane opponent BETA: 6 games, ALPHA won 4.
    assert_eq!(stats.strong_against.len(), 1);
    assert_eq!(stats.strong_against[0].champion_id, BETA);
    assert_eq!(
        (stats.strong_against[0].games, stats.strong_against[0].wins),
        (6, 4)
    );
    assert!(stats.weak_against.is_empty());
    assert_eq!(stats.shard_rows.len(), 3);

    let all = db
        .with_connection(|conn| champion_stats(conn, ALPHA, Some(ALL_PATCHES), Some("TOP")))
        .unwrap();
    assert_eq!(all.patch, None);
    assert_eq!(all.total_matches, 7);
    assert_eq!((all.games, all.wins), (7, 4));

    let beta = db
        .with_connection(|conn| champion_stats(conn, BETA, Some("16.22"), None))
        .unwrap();
    assert_eq!(beta.weak_against[0].champion_id, ALPHA);
    assert!(beta.strong_against.is_empty());
}

#[test]
fn champion_without_games_has_empty_sections() {
    let temp = TempDb::new("meta-empty");
    let db = temp.open();
    let stats = db
        .with_connection(|conn| champion_stats(conn, ALPHA, None, None))
        .unwrap();
    assert_eq!(stats.total_matches, 0);
    assert_eq!(stats.patch, None);
    assert_eq!(stats.role, None);
    assert!(stats.rune_pages.is_empty());
    assert!(stats.strong_against.is_empty());
}

#[test]
fn old_patches_are_pruned() {
    let temp = TempDb::new("meta-prune");
    let db = temp.open();
    seed_stats(&db);
    assert!(store(&db, &game("EUW1_9", "16.9.1.1", 1700, true, PAGE_A)));
    let deleted = db
        .with_connection(|conn| store::prune_old_patches(conn, 2))
        .unwrap();
    assert_eq!(deleted, 1, "16.9 is older than 16.21 and 16.22");
    let patches = db
        .with_connection(|conn| store::patch_samples(conn))
        .unwrap();
    let names: Vec<&str> = patches.iter().map(|sample| sample.patch.as_str()).collect();
    assert_eq!(names, ["16.22", "16.21"]);
}

#[tokio::test]
async fn collector_seeds_the_ladder_and_downloads_each_match_once() {
    let temp = TempDb::new("meta-collector");
    let db = temp.open();
    let client = client();
    let transport = client.transport_for_tests();
    transport
        .on(
            "/challengerleagues/",
            200,
            json!({ "entries": [
                { "puuid": "SEED-A", "leaguePoints": 1500 },
                { "leaguePoints": 1400 }
            ]}),
        )
        .on(
            "/grandmasterleagues/",
            200,
            json!({ "entries": [
                { "puuid": "SEED-B", "leaguePoints": 700 },
                { "puuid": "SEED-A", "leaguePoints": 1500 }
            ]}),
        )
        .on("/masterleagues/", 200, json!({ "entries": [] }))
        .on("/ids?queue=420", 200, json!(["EUW1_1", "EUW1_2"]))
        .on(
            "/matches/EUW1_1",
            200,
            game("EUW1_1", "16.22.1.1", 1800, true, PAGE_A),
        )
        .on("/matches/EUW1_2", 404, json!({}));

    let settings = Settings {
        enabled: true,
        platform: "euw1".to_string(),
        seed_tier: "MASTER_PLUS".to_string(),
    };
    let keep_going = || true;
    let first = collector::step(&client, &db, &settings, 1_790_000_000, &keep_going)
        .await
        .unwrap();
    assert_eq!(
        first.seeded,
        Some(2),
        "duplicates and missing PUUIDs removed"
    );
    assert!(first.worked);
    assert_eq!(first.new_matches, 1, "the 404 match is skipped");
    assert!(
        transport.count("startTime=1788790400") == 1,
        "two-week window"
    );
    // Every request was paced.
    assert!(transport
        .sleeps
        .lock()
        .unwrap()
        .iter()
        .all(|wait| *wait == PACE));

    // Second step: ladder still fresh, next seed player, known match skipped.
    let second = collector::step(&client, &db, &settings, 1_790_000_000, &keep_going)
        .await
        .unwrap();
    assert_eq!(second.seeded, None);
    assert_eq!(second.new_matches, 0);
    assert_eq!(transport.count("/challengerleagues/"), 1);
    assert_eq!(transport.count("/matches/EUW1_1/timeline"), 1);
    assert_eq!(
        transport.count("/matches/EUW1_1"),
        2,
        "detail + timeline, once"
    );

    // Both seed players read recently: nothing left to do.
    let third = collector::step(&client, &db, &settings, 1_790_000_000, &keep_going)
        .await
        .unwrap();
    assert!(!third.worked);
}

#[tokio::test]
async fn collector_stops_when_turned_off() {
    let temp = TempDb::new("meta-stop");
    let db = temp.open();
    let client = client();
    client
        .transport_for_tests()
        .on(
            "/entries/RANKED_SOLO_5x5/DIAMOND/",
            200,
            json!([{ "puuid": "SEED-D", "leaguePoints": 50 }]),
        )
        .on("/ids?queue=420", 200, json!(["EUW1_1"]))
        .on(
            "/matches/EUW1_1",
            200,
            game("EUW1_1", "16.22.1.1", 1800, true, PAGE_A),
        );
    let settings = Settings {
        enabled: true,
        platform: "euw1".to_string(),
        seed_tier: "DIAMOND".to_string(),
    };
    let stop = || false;
    let outcome = collector::step(&client, &db, &settings, 1_790_000_000, &stop)
        .await
        .unwrap();
    assert_eq!(outcome.new_matches, 0);
    assert_eq!(client.transport_for_tests().count("/matches/EUW1_1"), 0);
    assert_eq!(client.transport_for_tests().count("/DIAMOND/I?page=1"), 1);
    assert_eq!(client.transport_for_tests().count("/DIAMOND/II?page=1"), 1);
}

/// Real end-to-end check against the Riot API with the key stored by the app
/// (RIOT_API_KEY or the Windows Credential Manager; never printed). Runs on a
/// database file chosen by the caller, normally a copy of the app database:
/// `TECCA_LIVE_DB=<copy> cargo test --manifest-path src-tauri/Cargo.toml live_global_stats -- --ignored --nocapture`
/// Optional: `TECCA_LIVE_PLATFORM` (default euw1), `TECCA_LIVE_STEPS`
/// (default 1), `TECCA_LIVE_OUT` (JSON of the most played champion).
#[tokio::test(flavor = "multi_thread")]
#[ignore = "requires a Riot API key and network access to *.api.riotgames.com"]
async fn live_global_stats() {
    use crate::meta::service::GlobalStatsService;
    use crate::riot::client::RiotClient;
    use crate::riot::rate_limit::RateLimiter;
    use crate::riot::secrets::{KeyProvider, OsCredentialStore};
    use crate::riot::transport::ReqwestTransport;

    let path = std::env::var("TECCA_LIVE_DB").expect("TECCA_LIVE_DB");
    let platform = std::env::var("TECCA_LIVE_PLATFORM").unwrap_or_else(|_| "euw1".to_string());
    let steps: usize = std::env::var("TECCA_LIVE_STEPS")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(1);
    let db = Database::open(std::path::PathBuf::from(path)).expect("open database copy");
    let client = RiotClient::new(
        ReqwestTransport::new().expect("http client"),
        KeyProvider::from_process_env(OsCredentialStore),
        RateLimiter::development(),
    );
    let settings = Settings {
        enabled: true,
        platform,
        seed_tier: "MASTER_PLUS".to_string(),
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    let keep_going = || true;
    for index in 0..steps {
        let outcome = collector::step(&client, &db, &settings, now, &keep_going)
            .await
            .expect("collector step");
        println!("passo {}: {outcome:?}", index + 1);
    }

    let status = GlobalStatsService::new(true)
        .status(&db, true)
        .expect("status");
    println!(
        "partite valide: {}, giocatori in classifica: {}, patch: {:?}",
        status.total_matches,
        status.seed_players,
        status
            .patches
            .iter()
            .map(|sample| format!("{} ({})", sample.patch, sample.matches))
            .collect::<Vec<_>>()
    );
    assert!(status.total_matches > 0, "no match stored");

    let champion: i64 = db
        .with_connection(|conn| {
            Ok(conn.query_row(
                "SELECT champion_id FROM global_participants
                 GROUP BY champion_id ORDER BY COUNT(*) DESC, champion_id LIMIT 1",
                [],
                |row| row.get(0),
            )?)
        })
        .expect("most played champion");
    let stats = db
        .with_connection(|conn| champion_stats(conn, champion, None, None))
        .expect("champion stats");
    println!(
        "campione {champion}: {} partite, ruolo {:?}, pagine di rune {}, prima rune chiave {:?}",
        stats.games,
        stats.role,
        stats.rune_pages.len(),
        stats
            .keystones
            .first()
            .and_then(|stat| stat.icon.name.clone())
    );
    assert!(stats.games > 0);
    assert!(!stats.rune_pages.is_empty(), "no complete rune page parsed");
    assert!(
        stats.rune_pages[0].shards.len() == 3,
        "statPerks not parsed from the real response"
    );
    if let Ok(out) = std::env::var("TECCA_LIVE_OUT") {
        std::fs::write(
            out,
            serde_json::to_string_pretty(&json!({ "status": status, "stats": stats }))
                .expect("json"),
        )
        .expect("write output");
    }
}

fn timeline_json() -> Value {
    let skill = |ts: i64, slot: i64| json!({ "type": "SKILL_LEVEL_UP", "timestamp": ts, "participantId": 1, "skillSlot": slot, "levelUpType": "NORMAL" });
    let mut events = vec![
        json!({ "type": "ITEM_PURCHASED", "timestamp": 1_000, "participantId": 1, "itemId": 1054 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 1_500, "participantId": 1, "itemId": 2003 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 1_600, "participantId": 1, "itemId": 2003 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 1_700, "participantId": 1, "itemId": 1055 }),
        json!({ "type": "ITEM_UNDO", "timestamp": 1_800, "participantId": 1, "beforeId": 1055, "afterId": 0 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 400_000, "participantId": 1, "itemId": 3068 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 600_000, "participantId": 1, "itemId": 3047 }),
        json!({ "type": "ITEM_PURCHASED", "timestamp": 800_000, "participantId": 1, "itemId": 3075 }),
        json!({ "type": "SKILL_LEVEL_UP", "timestamp": 10, "participantId": 1, "skillSlot": 4, "levelUpType": "EVOLVE" }),
    ];
    // Q E W Q Q R Q E Q E R E E W W
    for (index, slot) in [1, 3, 2, 1, 1, 4, 1, 3, 1, 3, 4, 3, 3, 2, 2]
        .into_iter()
        .enumerate()
    {
        events.push(skill(100 + index as i64, slot));
    }
    json!({ "info": { "frames": [ { "events": events } ] } })
}

#[test]
fn timeline_gives_skills_start_items_and_purchases() {
    let timeline: crate::riot::matches::TimelineDto =
        serde_json::from_value(timeline_json()).unwrap();
    let players = store::player_timelines(&timeline);
    assert_eq!(players[0].skills, "QEWQQRQEQEREEWW");
    assert_eq!(
        players[0].start_items,
        [1054, 2003, 2003],
        "undone purchase removed"
    );
    assert_eq!(players[0].purchases, [3068, 3047, 3075]);
    assert!(players[1].skills.is_empty());
    assert_eq!(skill_priority("QEWQQRQEQEREEWW"), "QEW");
    assert_eq!(skill_priority("QWE"), "QWE");
}

#[test]
fn timeline_feeds_skill_order_and_builds() {
    let temp = TempDb::new("meta-timeline");
    let db = temp.open();
    seed_stats(&db);
    let timeline: crate::riot::matches::TimelineDto =
        serde_json::from_value(timeline_json()).unwrap();
    for id in ["EUW1_1", "EUW1_2"] {
        db.with_connection(|conn| store::store_timeline(conn, id, &timeline))
            .unwrap();
    }
    let missing = db
        .with_connection(|conn| store::missing_timelines(conn, "euw1", 50))
        .unwrap();
    assert!(!missing.contains(&"EUW1_1".to_string()));
    assert!(missing.contains(&"EUW1_3".to_string()));

    let stats = db
        .with_connection(|conn| champion_stats(conn, ALPHA, None, None))
        .unwrap();
    assert_eq!(stats.timeline_games, 2);
    assert_eq!(stats.skill_orders[0].priority, ["Q", "E", "W"]);
    assert_eq!(stats.skill_orders[0].games, 2);
    assert_eq!(stats.skill_orders[0].sequence.len(), 15);
    let start: Vec<i64> = stats.start_builds[0]
        .items
        .iter()
        .map(|item| item.id)
        .collect();
    assert_eq!(start, [1054, 2003, 2003]);
    // No Data Dragon catalog in the test database: no item counts as
    // "completed", so no core build is invented.
    assert!(stats.core_builds.is_empty());
}

#[test]
fn personal_matches_are_a_separate_fallback() {
    let temp = TempDb::new("meta-personal");
    let db = temp.open();
    // A saved personal match (Riot API source) with fictional players.
    let mut personal = game("EUW1_P1", "16.22.1.1", 1800, true, PAGE_B);
    for (index, participant) in personal["info"]["participants"]
        .as_array_mut()
        .unwrap()
        .iter_mut()
        .enumerate()
    {
        participant["participantId"] = json!(index + 1);
    }
    db.with_connection(|conn| {
        conn.execute(
            "INSERT INTO matches (match_id, region, queue_id, game_version, game_creation, game_duration, raw_json)
             VALUES ('EUW1_P1', 'europe', 420, '16.22.1.1', 1790000000000, 1800, ?1)",
            [personal.to_string()],
        )?;
        Ok(())
    })
    .unwrap();
    let added = db.with_connection(store::import_personal).unwrap();
    assert_eq!(added, 1);
    assert_eq!(
        db.with_connection(store::import_personal).unwrap(),
        0,
        "copied once"
    );

    let stats = db
        .with_connection(|conn| champion_stats(conn, ALPHA, None, None))
        .unwrap();
    assert!(stats.personal);
    assert_eq!((stats.games, stats.total_matches), (1, 1));
    assert_eq!(stats.rune_pages[0].primary_runes[0].id, PAGE_B[0]);

    // Collected matches take precedence once they contain the champion.
    seed_stats(&db);
    let stats = db
        .with_connection(|conn| champion_stats(conn, ALPHA, None, None))
        .unwrap();
    assert!(!stats.personal);
    assert_eq!(stats.total_matches, 6, "personal match not mixed in");

    // The global status ignores personal matches; roles use both.
    let status = crate::meta::service::GlobalStatsService::new(false)
        .status(&db, false)
        .unwrap();
    assert_eq!(
        status.total_matches, 7,
        "both stored patches, personal excluded"
    );
    let roles = db
        .with_connection(|conn| crate::meta::stats::champion_roles(conn))
        .unwrap();
    assert_eq!((roles.global_matches, roles.personal_matches), (7, 1));
    let alpha = roles
        .champions
        .iter()
        .find(|c| c.champion_id == ALPHA)
        .unwrap();
    assert_eq!(alpha.roles[0].role, "TOP");
    assert_eq!(alpha.games, 8);
}
