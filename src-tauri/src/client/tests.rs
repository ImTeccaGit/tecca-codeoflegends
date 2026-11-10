//! League client tests with a simulated client (fictional accounts and
//! games; no real client, no network).

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use serde_json::{json, Value};

use crate::client::convert::{self, ClientGame, ClientTimeline};
use crate::client::lockfile;
use crate::client::repository as client_repository;
use crate::client::source::{ClientError, ClientSource};
use crate::client::sync::sync;
use crate::riot::repository;
use crate::test_support::TempDb;

const ME: &str = "PUUID-CLIENT-ME";

#[derive(Default)]
struct SimulatedClient {
    responses: Mutex<HashMap<String, Result<String, ClientError>>>,
    calls: AtomicUsize,
}

impl SimulatedClient {
    fn on(&self, path: &str, body: Value) -> &Self {
        self.responses
            .lock()
            .unwrap()
            .insert(path.to_string(), Ok(body.to_string()));
        self
    }
    fn fail(&self, path: &str, error: ClientError) -> &Self {
        self.responses
            .lock()
            .unwrap()
            .insert(path.to_string(), Err(error));
        self
    }
    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }
}

impl ClientSource for SimulatedClient {
    async fn get(&self, path: &str) -> Result<String, ClientError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        // Query strings are ignored by the simulation.
        let key = path.split('?').next().unwrap_or(path);
        self.responses
            .lock()
            .unwrap()
            .get(key)
            .cloned()
            .unwrap_or(Err(ClientError::Status(404)))
    }
}

fn game(game_id: i64, my_lane: &str, win: bool) -> Value {
    let player = |id: i64, puuid: &str, name: &str| json!({ "participantId": id, "player": { "puuid": puuid, "gameName": name, "tagLine": "EUW" } });
    let participant = |id: i64,
                       team: i64,
                       champion: i64,
                       lane: &str,
                       role: &str,
                       kills: i64,
                       won: bool| {
        json!({
            "participantId": id, "teamId": team, "championId": champion, "spell1Id": 4, "spell2Id": 14,
            "stats": {
                "win": won, "kills": kills, "deaths": 2, "assists": 5,
                "totalMinionsKilled": 180, "neutralMinionsKilled": 8, "goldEarned": 11000,
                "visionScore": 20, "champLevel": 15, "totalDamageDealtToChampions": 21000,
                "totalDamageTaken": 19000, "item0": 3089, "item6": 3340,
                "perk0": 8112, "perkPrimaryStyle": 8100, "perkSubStyle": 8300
            },
            "timeline": { "lane": lane, "role": role }
        })
    };
    json!({
        "gameId": game_id, "platformId": "EUW1", "gameCreation": 1_762_000_000_000_i64 + game_id,
        "gameDuration": 1800, "gameMode": "CLASSIC", "gameVersion": "15.22.123.4567",
        "mapId": 11, "queueId": 420,
        "participantIdentities": [player(1, ME, "Tester"), player(2, "PUUID-ENEMY", "Rivale")],
        "participants": [
            participant(1, 100, 103, my_lane, "SOLO", 6, win),
            participant(2, 200, 238, my_lane, "SOLO", 3, !win)
        ],
        "teams": [
            { "teamId": 100, "bans": [{ "championId": 157, "pickTurn": 1 }] },
            { "teamId": 200, "bans": [] }
        ]
    })
}

fn client_with_history(ids: &[i64]) -> SimulatedClient {
    let client = SimulatedClient::default();
    client
        .on("/lol-summoner/v1/current-summoner", json!({
            "puuid": ME, "gameName": "Tester", "tagLine": "EUW", "summonerLevel": 312, "profileIconId": 29
        }))
        .on("/riotclient/region-locale", json!({ "region": "EUW", "locale": "it_IT" }))
        .on("/lol-ranked/v1/current-ranked-stats", json!({ "queues": [
            { "queueType": "RANKED_SOLO_5x5", "tier": "GOLD", "division": "II", "leaguePoints": 47, "wins": 30, "losses": 25 },
            { "queueType": "RANKED_FLEX_SR", "tier": "NONE", "division": "NA", "leaguePoints": 0, "wins": 0, "losses": 0 },
            { "queueType": "RANKED_TFT", "tier": "SILVER", "division": "I", "leaguePoints": 10, "wins": 1, "losses": 1 }
        ]}))
        .on(
            "/lol-match-history/v1/products/lol/current-summoner/matches",
            json!({ "games": { "games": ids.iter().map(|id| json!({ "gameId": id, "platformId": "EUW1" })).collect::<Vec<_>>() } }),
        );
    for (index, id) in ids.iter().enumerate() {
        client.on(
            &format!("/lol-match-history/v1/games/{id}"),
            game(*id, "MIDDLE", index % 2 == 0),
        );
    }
    client
}

/* Pure parts -------------------------------------------------------------- */

#[test]
fn lockfile_is_parsed_and_the_password_is_never_printed() {
    let lock = lockfile::parse("LeagueClient:1234:52437:s3cr3t-token:https\n").expect("valid");
    assert_eq!((lock.pid, lock.port), (1234, 52437));
    assert!(!format!("{lock:?}").contains("s3cr3t"));
    assert!(lockfile::parse("garbage").is_none());
    assert!(lockfile::parse("LeagueClient:1:0:x:https").is_none());
    assert!(lockfile::parse("LeagueClient:1:2:x:http").is_none());
}

#[test]
fn install_path_is_read_from_riot_metadata() {
    let yaml = "product_install_root: \"C:/Riot Games\"\nproduct_install_full_path: \"D:/Giochi/League of Legends\"\n";
    assert_eq!(
        lockfile::install_path_from_settings(yaml),
        Some(std::path::PathBuf::from(r"D:\Giochi\League of Legends"))
    );
    assert_eq!(lockfile::install_path_from_settings("other: 1"), None);
}

#[test]
fn regions_lanes_and_ids_are_mapped() {
    assert_eq!(convert::platform_from_region("EUW"), Some("euw1"));
    assert_eq!(convert::platform_from_region("eune"), Some("eun1"));
    assert_eq!(convert::platform_from_region("LAS"), Some("la2"));
    assert_eq!(convert::platform_from_region("PBE"), None);

    let lane = |lane: &str, role: &str| {
        convert::team_position(&ClientTimeline {
            lane: lane.into(),
            role: role.into(),
        })
    };
    assert_eq!(lane("MIDDLE", "SOLO"), "MIDDLE");
    assert_eq!(lane("BOTTOM", "DUO_SUPPORT"), "UTILITY");
    assert_eq!(lane("BOTTOM", "DUO_CARRY"), "BOTTOM");
    assert_eq!(lane("NONE", "NONE"), "");

    assert_eq!(convert::match_id("EUW1", 42).as_deref(), Some("EUW1_42"));
    assert_eq!(convert::match_id("EU W", 42), None);
    assert_eq!(convert::match_id("EUW1", 0), None);
}

#[test]
fn client_game_converts_to_the_storage_shape() {
    let parsed: ClientGame = serde_json::from_value(game(77, "BOTTOM", true)).unwrap();
    let dto =
        convert::to_match(&parsed, |id| (id == 103).then(|| "Kassadin".to_string())).expect("dto");
    assert_eq!(dto.metadata.match_id, "EUW1_77");
    assert_eq!(dto.info.duration_seconds(), 1800);
    let me = dto
        .info
        .participants
        .iter()
        .find(|p| p.puuid == ME)
        .unwrap();
    assert_eq!(me.champion_name, "Kassadin");
    assert_eq!(me.team_position, "BOTTOM");
    assert_eq!(me.creep_score(), 188);
    assert_eq!(me.total_damage_taken, Some(19000));
    assert_eq!(me.perks.styles[0].selections[0].perk, 8112);
    assert_eq!(dto.info.teams[0].bans[0].champion_id, 157);
}

#[test]
fn ranked_keeps_only_placed_league_queues() {
    let stats: convert::RankedStats = serde_json::from_value(json!({ "queues": [
        { "queueType": "RANKED_SOLO_5x5", "tier": "GOLD", "division": "II", "leaguePoints": 47, "wins": 30, "losses": 25 },
        { "queueType": "RANKED_FLEX_SR", "tier": "", "division": "", "leaguePoints": 0, "wins": 0, "losses": 0 },
        { "queueType": "RANKED_TFT", "tier": "SILVER", "division": "I", "leaguePoints": 10, "wins": 1, "losses": 1 }
    ]})).unwrap();
    let entries = convert::ranked_entries(&stats);
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].rank.as_deref(), Some("II"));
}

/* Synchronization -------------------------------------------------------- */

#[tokio::test]
async fn sync_saves_account_rank_and_history_without_api_key() {
    let temp = TempDb::new("client-sync");
    let db = temp.open();
    let client = client_with_history(&[101, 102, 103]);

    let outcome = sync(&db, &client).await.expect("sync");
    assert_eq!(outcome.account.region, "euw1");
    assert_eq!(outcome.new_matches, 3);
    assert_eq!(outcome.ranked_queues, 1);
    assert!(outcome.warnings.is_empty());

    let profile = db
        .with_connection(|conn| repository::profile(conn, ME))
        .unwrap()
        .expect("profile stored");
    assert!(
        profile.saved && profile.primary,
        "first account becomes the primary profile"
    );
    assert_eq!(profile.game_name, "Tester");
    assert_eq!(profile.ranked.len(), 1);
    assert_eq!(profile.matches.len(), 3);
    assert_eq!(profile.source, "Client League (LCU)");

    let stored_source: String = db
        .with_connection(|conn| {
            Ok(conn.query_row("SELECT DISTINCT source FROM matches", [], |row| row.get(0))?)
        })
        .unwrap();
    assert_eq!(stored_source, "league-client");

    // Second run: no game downloaded twice.
    let calls = client.calls();
    let again = sync(&db, &client).await.expect("resync");
    assert_eq!(again.new_matches, 0);
    assert_eq!(
        client.calls() - calls,
        4,
        "summoner, history, region, ranked only"
    );
}

#[tokio::test]
async fn existing_primary_profile_is_kept() {
    let temp = TempDb::new("client-primary");
    let db = temp.open();
    db.with_connection(|conn| {
        repository::upsert_player(conn, "PUUID-OTHER", "Altro", "EUW", "euw1", None)?;
        repository::save_profile(conn, "PUUID-OTHER", true)
    })
    .unwrap();

    sync(&db, &client_with_history(&[])).await.expect("sync");
    let primary = db
        .with_connection(|conn| repository::primary_puuid(conn))
        .unwrap();
    assert_eq!(primary.as_deref(), Some("PUUID-OTHER"));
    let saved = db
        .with_connection(|conn| repository::saved_profiles(conn))
        .unwrap();
    assert_eq!(saved.len(), 2);
}

#[tokio::test]
async fn partial_failures_do_not_invent_data() {
    let temp = TempDb::new("client-partial");
    let db = temp.open();
    let client = client_with_history(&[201, 202]);
    client
        .fail(
            "/lol-ranked/v1/current-ranked-stats",
            ClientError::Status(500),
        )
        .on(
            "/lol-match-history/v1/games/202",
            json!({ "gameId": 202, "platformId": "EUW1", "participants": [] }),
        );

    let outcome = sync(&db, &client).await.expect("sync");
    assert_eq!(outcome.new_matches, 1);
    assert_eq!(outcome.ranked_queues, 0);
    assert_eq!(outcome.warnings.len(), 2);
    let profile = db
        .with_connection(|conn| repository::profile(conn, ME))
        .unwrap()
        .unwrap();
    assert!(profile.ranked.is_empty());
}

#[tokio::test]
async fn closed_or_logged_out_client_is_reported() {
    let temp = TempDb::new("client-closed");
    let db = temp.open();

    let closed = SimulatedClient::default();
    closed.fail("/lol-summoner/v1/current-summoner", ClientError::NotRunning);
    let error = sync(&db, &closed).await.expect_err("closed");
    assert!(error.user_message().contains("non è aperto"));

    let logged_out = SimulatedClient::default();
    let error = sync(&db, &logged_out).await.expect_err("logged out");
    assert!(error.user_message().contains("nessun account"));

    let saved = db
        .with_connection(|conn| repository::saved_profiles(conn))
        .unwrap();
    assert!(saved.is_empty(), "no data stored on failure");
}

#[test]
fn riot_id_from_the_game_is_validated_and_stored_once() {
    let temp = TempDb::new("client-detected");
    let db = temp.open();
    db.with_connection(|conn| {
        assert!(!client_repository::remember_riot_id(conn, "senza-tag")?);
        assert!(client_repository::remember_riot_id(conn, "Tester#EUW")?);
        assert!(!client_repository::remember_riot_id(conn, "Tester#EUW")?);
        let stored = client_repository::detected_riot_id(conn)?.expect("stored");
        assert_eq!(stored.riot_id, "Tester#EUW");
        assert!(client_repository::sync_enabled(conn)?, "on by default");
        client_repository::set_sync_enabled(conn, false)?;
        assert!(!client_repository::sync_enabled(conn)?);
        assert!(client_repository::set_install_path(conn, Some("relativo")).is_err());
        assert!(client_repository::set_install_path(conn, Some(r"C:\Windows")).is_err());
        client_repository::set_install_path(conn, None)?;
        assert_eq!(client_repository::install_path(conn)?, None);
        Ok(())
    })
    .unwrap();
}
