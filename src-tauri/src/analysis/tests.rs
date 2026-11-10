//! Match Analysis tests with fictional match-v5 responses (no network, no
//! real players). Champions are referenced by fictional ids.

use serde_json::{json, Value};

use crate::analysis::repository::{dataset, patch_of};
use crate::riot::matches::MatchDto;
use crate::riot::repository;
use crate::test_support::TempDb;

const ME: &str = "PUUID-ME";

/// (puuid, champion id, name, team, position, kills, deaths, assists)
type Row = (
    &'static str,
    i64,
    &'static str,
    i64,
    &'static str,
    i64,
    i64,
    i64,
);

fn participant(row: Row, damage_taken: Option<i64>) -> Value {
    let (puuid, id, name, team, position, kills, deaths, assists) = row;
    let mut value = json!({
        "puuid": puuid, "championId": id, "championName": name, "teamId": team,
        "teamPosition": position, "win": team == 100,
        "kills": kills, "deaths": deaths, "assists": assists,
        "totalMinionsKilled": 150, "neutralMinionsKilled": 10,
        "goldEarned": 10000 + kills * 300, "visionScore": 20, "champLevel": 14,
        "totalDamageDealtToChampions": 15000 + kills * 1000,
        "item0": 3006, "item1": 0, "item2": 0, "item3": 0, "item4": 0, "item5": 0, "item6": 3340,
        "perks": { "styles": [] }
    });
    if let Some(taken) = damage_taken {
        value["totalDamageTaken"] = json!(taken);
    }
    value
}

fn match_json(id: &str, creation: i64, rows: &[Row], with_bans: bool) -> Value {
    let teams = if with_bans {
        json!([
            { "teamId": 100, "bans": [{ "championId": 501, "pickTurn": 1 }, { "championId": -1, "pickTurn": 2 }] },
            { "teamId": 200, "bans": [{ "championId": 502, "pickTurn": 6 }] }
        ])
    } else {
        json!([])
    };
    json!({
        "metadata": { "matchId": id },
        "info": {
            "gameCreation": creation, "gameDuration": 1800, "gameEndTimestamp": creation + 1_800_000,
            "gameMode": "CLASSIC", "gameVersion": "14.23.636.1234", "mapId": 11, "queueId": 420,
            "participants": rows.iter().map(|row| participant(*row, Some(20000))).collect::<Vec<_>>(),
            "teams": teams
        }
    })
}

fn store(db: &crate::db::Database, value: &Value) {
    let dto: MatchDto = serde_json::from_value(value.clone()).expect("dto");
    let raw = value.to_string();
    db.with_connection(|conn| {
        repository::store_match(conn, "europe", &dto, &raw, repository::MatchSource::RiotApi)?;
        repository::link_matches(conn, ME, std::slice::from_ref(&dto.metadata.match_id))
    })
    .expect("store");
}

fn setup(name: &str) -> (TempDb, crate::db::Database) {
    let temp = TempDb::new(name);
    let db = temp.open();
    db.with_connection(|conn| repository::upsert_player(conn, ME, "Me", "EUW", "euw1", None))
        .expect("player");
    (temp, db)
}

const FULL_GAME: [Row; 6] = [
    (ME, 1, "Alpha", 100, "MIDDLE", 5, 2, 7),
    ("ALLY-1", 2, "Beta", 100, "JUNGLE", 4, 3, 6),
    ("ALLY-2", 3, "Gamma", 100, "BOTTOM", 6, 1, 2),
    ("ENEMY-MID", 11, "Delta", 200, "MIDDLE", 2, 5, 1),
    ("ENEMY-JG", 12, "Epsilon", 200, "JUNGLE", 1, 6, 3),
    ("ENEMY-BOT", 13, "Zeta", 200, "BOTTOM", 3, 4, 0),
];

#[test]
fn patch_is_derived_from_game_version() {
    assert_eq!(patch_of("14.23.636.1234").as_deref(), Some("14.23"));
    assert_eq!(patch_of("15.1"), Some("15.1".to_string()));
    assert_eq!(patch_of("abc"), None);
    assert_eq!(patch_of(""), None);
}

#[test]
fn dataset_associates_matches_champions_and_lane_opponent() {
    let (_temp, db) = setup("analysis-assoc");
    store(
        &db,
        &match_json("EUW1_10", 1_700_000_000_000, &FULL_GAME, true),
    );

    let data = db
        .with_connection(|conn| dataset(conn, ME))
        .expect("query")
        .expect("player exists");
    assert_eq!(data.matches.len(), 1);
    let game = &data.matches[0];

    assert_eq!(game.champion.champion_id, 1);
    assert_eq!(game.champion.champion_name, "Alpha");
    assert_eq!(game.patch.as_deref(), Some("14.23"));
    assert!(game.win);
    // Team kills = 5 + 4 + 6.
    assert_eq!(game.team_kills, 15);
    assert_eq!(game.damage_taken, Some(20000));

    let opponent = game.opponent.as_ref().expect("lane opponent");
    assert_eq!(opponent.champion.champion_id, 11);
    assert_eq!((opponent.kills, opponent.deaths), (2, 5));

    let allies: Vec<i64> = game.allies.iter().map(|c| c.champion_id).collect();
    let enemies: Vec<i64> = game.enemies.iter().map(|c| c.champion_id).collect();
    assert_eq!(allies.len(), 2);
    assert!(allies.contains(&2) && allies.contains(&3));
    assert_eq!(enemies.len(), 3);
    assert!(!enemies.contains(&1));

    // Invalid ban (-1) skipped.
    assert_eq!(game.bans, vec![501, 502]);
    assert_eq!(game.items.len(), 2);
}

#[test]
fn missing_data_stays_missing() {
    let (_temp, db) = setup("analysis-missing");
    // No position for me, no teams/bans, no damage taken in the response.
    let mut value = match_json(
        "EUW1_11",
        1_700_000_100_000,
        &[
            (ME, 1, "Alpha", 100, "", 0, 0, 0),
            ("E", 11, "Delta", 200, "", 1, 0, 0),
        ],
        false,
    );
    for participant in value["info"]["participants"].as_array_mut().unwrap() {
        participant
            .as_object_mut()
            .unwrap()
            .remove("totalDamageTaken");
    }
    store(&db, &value);

    let data = db
        .with_connection(|conn| dataset(conn, ME))
        .unwrap()
        .unwrap();
    let game = &data.matches[0];
    assert_eq!(game.team_position, None);
    assert!(game.opponent.is_none(), "no position: no guessed opponent");
    assert_eq!(game.damage_taken, None);
    assert!(game.bans.is_empty());
    assert_eq!(game.team_kills, 0);
}

#[test]
fn ambiguous_lane_opponent_is_not_guessed() {
    let (_temp, db) = setup("analysis-ambiguous");
    store(
        &db,
        &match_json(
            "EUW1_12",
            1_700_000_200_000,
            &[
                (ME, 1, "Alpha", 100, "MIDDLE", 1, 1, 1),
                ("E1", 11, "Delta", 200, "MIDDLE", 1, 1, 1),
                ("E2", 12, "Epsilon", 200, "MIDDLE", 1, 1, 1),
            ],
            false,
        ),
    );
    let data = db
        .with_connection(|conn| dataset(conn, ME))
        .unwrap()
        .unwrap();
    assert!(data.matches[0].opponent.is_none());
}

#[test]
fn unknown_player_has_no_dataset_and_order_is_newest_first() {
    let (_temp, db) = setup("analysis-order");
    assert!(db
        .with_connection(|conn| dataset(conn, "NOBODY"))
        .unwrap()
        .is_none());

    store(
        &db,
        &match_json("EUW1_OLD", 1_600_000_000_000, &FULL_GAME, false),
    );
    store(
        &db,
        &match_json("EUW1_NEW", 1_700_000_000_000, &FULL_GAME, false),
    );
    let data = db
        .with_connection(|conn| dataset(conn, ME))
        .unwrap()
        .unwrap();
    let ids: Vec<&str> = data.matches.iter().map(|m| m.match_id.as_str()).collect();
    assert_eq!(ids, ["EUW1_NEW", "EUW1_OLD"]);
}

/// The 0007 backfill reads already stored raw responses.
#[test]
fn migration_backfills_from_raw_json() {
    let (_temp, db) = setup("analysis-backfill");
    store(
        &db,
        &match_json("EUW1_20", 1_700_000_300_000, &FULL_GAME, true),
    );

    let sql = include_str!("../../migrations/0007_match_analysis.sql");
    let update = &sql[sql.find("UPDATE match_participants").unwrap()
        ..sql.find("CREATE TABLE match_bans").unwrap()];
    let insert = &sql
        [sql.find("INSERT OR IGNORE INTO match_bans").unwrap()..sql.find("CREATE INDEX").unwrap()];

    db.with_connection(|conn| {
        // Simulate rows stored before 0007.
        conn.execute("UPDATE match_participants SET damage_taken = NULL", [])?;
        conn.execute("DELETE FROM match_bans", [])?;
        conn.execute_batch(update)?;
        conn.execute_batch(insert)?;
        let filled: i64 = conn.query_row(
            "SELECT COUNT(*) FROM match_participants WHERE damage_taken = 20000",
            [],
            |row| row.get(0),
        )?;
        let bans: i64 = conn.query_row("SELECT COUNT(*) FROM match_bans", [], |row| row.get(0))?;
        assert_eq!(filled, 6);
        assert_eq!(bans, 2);
        Ok(())
    })
    .expect("backfill");
}
