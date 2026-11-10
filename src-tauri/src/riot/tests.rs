//! Riot API tests with simulated responses: no network, no real key, no real
//! player data. Accounts, champions and matches below are fictional.

use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::rate_limit::RateLimiter;
use crate::riot::repository;
use crate::riot::routing::{account_region, encode_segment, match_region, Regional, PLATFORMS};
use crate::riot::secrets::{is_valid_key_format, KeyProvider, KeySource, SecretStore};
use crate::riot::sync::{self, validate_riot_id, SyncLocks};
use crate::riot::transport::{RawResponse, Transport};
use crate::riot::{account, matches};
use crate::test_support::TempDb;

pub(crate) const TEST_KEY: &str = "RGAPI-00000000-0000-0000-0000-000000000000";
const PUUID: &str = "PUUID-TESTER";
const OTHER: &str = "PUUID-OTHER";

/* ---------------------------- test doubles ------------------------------ */

#[derive(Default)]
pub(crate) struct MemoryStore(Mutex<Option<String>>);

impl MemoryStore {
    fn with(value: Option<&str>) -> Self {
        Self(Mutex::new(value.map(String::from)))
    }
}

impl SecretStore for MemoryStore {
    fn get(&self) -> Result<Option<String>, String> {
        Ok(self.0.lock().unwrap().clone())
    }
    fn set(&self, value: &str) -> Result<(), String> {
        *self.0.lock().unwrap() = Some(value.to_string());
        Ok(())
    }
    fn delete(&self) -> Result<(), String> {
        *self.0.lock().unwrap() = None;
        Ok(())
    }
}

/// Scripted Riot API: responses are matched by URL substring; the last
/// response of a route repeats. Unknown URLs fail the request loudly.
#[derive(Default)]
pub(crate) struct MockTransport {
    routes: Mutex<Vec<(String, VecDeque<RawResponse>)>>,
    calls: Mutex<Vec<String>>,
    keys: Mutex<Vec<String>>,
    pub(crate) sleeps: Mutex<Vec<Duration>>,
}

impl MockTransport {
    pub(crate) fn on(&self, pattern: &str, status: u16, body: Value) -> &Self {
        self.on_raw(pattern, status, None, body.to_string())
    }

    fn on_raw(&self, pattern: &str, status: u16, retry_after: Option<u64>, body: String) -> &Self {
        let response = RawResponse {
            status,
            retry_after,
            body: body.into_bytes(),
        };
        let mut routes = self.routes.lock().unwrap();
        if let Some((_, queue)) = routes.iter_mut().find(|(p, _)| p == pattern) {
            queue.push_back(response);
        } else {
            routes.push((pattern.to_string(), VecDeque::from([response])));
        }
        self
    }

    /// Replaces every scripted response for URLs containing `pattern`; the new
    /// route takes precedence over broader patterns registered earlier.
    fn replace(&self, pattern: &str, status: u16, body: Value) -> &Self {
        let mut routes = self.routes.lock().unwrap();
        routes.retain(|(existing, _)| existing != pattern);
        routes.insert(
            0,
            (
                pattern.to_string(),
                VecDeque::from([RawResponse {
                    status,
                    retry_after: None,
                    body: body.to_string().into_bytes(),
                }]),
            ),
        );
        self
    }

    pub(crate) fn count(&self, pattern: &str) -> usize {
        self.calls
            .lock()
            .unwrap()
            .iter()
            .filter(|url| url.contains(pattern))
            .count()
    }

    fn total(&self) -> usize {
        self.calls.lock().unwrap().len()
    }
}

impl Transport for MockTransport {
    async fn get(&self, url: &str, api_key: &str) -> Result<RawResponse, String> {
        self.calls.lock().unwrap().push(url.to_string());
        self.keys.lock().unwrap().push(api_key.to_string());
        let mut routes = self.routes.lock().unwrap();
        let (_, queue) = routes
            .iter_mut()
            .find(|(pattern, _)| url.contains(pattern.as_str()))
            .ok_or_else(|| format!("URL inattesa nel test: {url}"))?;
        Ok(if queue.len() > 1 {
            queue.pop_front().unwrap()
        } else {
            queue.front().cloned().unwrap()
        })
    }

    async fn sleep(&self, duration: Duration) {
        self.sleeps.lock().unwrap().push(duration);
    }
}

fn client_with(
    store_key: Option<&str>,
    env: Option<&str>,
) -> RiotClient<MockTransport, MemoryStore> {
    RiotClient::new(
        MockTransport::default(),
        KeyProvider::new(MemoryStore::with(store_key), env.map(String::from)),
        RateLimiter::development(),
    )
}

pub(crate) fn client() -> RiotClient<MockTransport, MemoryStore> {
    client_with(Some(TEST_KEY), None)
}

/* ------------------------------ fixtures -------------------------------- */

fn participant(
    puuid: &str,
    champion: &str,
    champion_id: i64,
    win: bool,
    kda: (i64, i64, i64),
) -> Value {
    json!({
        "puuid": puuid,
        "riotIdGameName": if puuid == PUUID { "Tester" } else { "Altro" },
        "riotIdTagline": "TEST",
        "championId": champion_id,
        "championName": champion,
        "teamId": if win { 100 } else { 200 },
        "teamPosition": "JUNGLE",
        "win": win,
        "kills": kda.0, "deaths": kda.1, "assists": kda.2,
        "totalMinionsKilled": 40, "neutralMinionsKilled": 120,
        "goldEarned": 11000, "visionScore": 30, "champLevel": 15,
        "totalDamageDealtToChampions": 18000,
        "item0": 1001, "item1": 0, "item2": 3020, "item3": 0, "item4": 0, "item5": 0, "item6": 3340,
        "summoner1Id": 11, "summoner2Id": 4,
        "perks": { "styles": [
            { "description": "primaryStyle", "style": 8100, "selections": [{ "perk": 8112 }] },
            { "description": "subStyle", "style": 8300, "selections": [{ "perk": 8304 }] }
        ]}
    })
}

fn match_json(id: &str, creation: i64, win: bool) -> Value {
    json!({
        "metadata": { "matchId": id, "participants": [PUUID, OTHER] },
        "info": {
            "gameCreation": creation,
            "gameDuration": 1830,
            "gameEndTimestamp": creation + 1_830_000,
            "gameMode": "CLASSIC",
            "gameVersion": "1.1.123",
            "mapId": 11,
            "queueId": 420,
            "participants": [
                participant(PUUID, "Alpha", 9001, win, (7, 2, 9)),
                participant(OTHER, "Beta", 9002, !win, (3, 7, 4))
            ]
        }
    })
}

/// A complete, consistent fictional player on euw1 with two matches.
fn script_player(transport: &MockTransport) {
    transport
        .on("/accounts/by-riot-id/Tester/TEST", 200, json!({ "puuid": PUUID, "gameName": "Tester", "tagLine": "TEST" }))
        .on(&format!("/accounts/by-puuid/{PUUID}"), 200, json!({ "puuid": PUUID, "gameName": "Tester", "tagLine": "TEST" }))
        .on("/summoner/v4/summoners/by-puuid/", 200, json!({ "puuid": PUUID, "profileIconId": 29, "summonerLevel": 187 }))
        .on("/league/v4/entries/by-puuid/", 200, json!([
            { "queueType": "RANKED_SOLO_5x5", "tier": "GOLD", "rank": "II", "leaguePoints": 47, "wins": 30, "losses": 25, "hotStreak": true },
            { "queueType": "RANKED_FLEX_SR", "tier": "SILVER", "rank": "I", "leaguePoints": 12, "wins": 5, "losses": 7, "hotStreak": false }
        ]))
        .on("/ids?", 200, json!(["EUW1_2", "EUW1_1"]))
        .on("/matches/EUW1_2", 200, match_json("EUW1_2", 1_700_000_100_000, true))
        .on("/matches/EUW1_1", 200, match_json("EUW1_1", 1_700_000_000_000, false));
}

/* ------------------------------- routing -------------------------------- */

#[test]
fn every_platform_has_routing() {
    for platform in PLATFORMS {
        assert!(match_region(platform).is_some(), "{platform}");
        assert_ne!(account_region(platform), Some(Regional::Sea), "{platform}");
    }
    assert_eq!(match_region("euw1"), Some(Regional::Europe));
    assert_eq!(match_region("na1"), Some(Regional::Americas));
    assert_eq!(match_region("kr"), Some(Regional::Asia));
    assert_eq!(match_region("oc1"), Some(Regional::Sea));
    assert_eq!(account_region("sg2"), Some(Regional::Asia));
    assert_eq!(match_region("xx1"), None);
}

#[test]
fn path_segments_are_percent_encoded() {
    assert_eq!(encode_segment("Tecca Ò"), "Tecca%20%C3%92");
    assert_eq!(encode_segment("a/b?c#d"), "a%2Fb%3Fc%23d");
}

#[test]
fn riot_id_validation() {
    assert_eq!(
        validate_riot_id("  Tester ", "#EUW").unwrap(),
        ("Tester".to_string(), "EUW".to_string())
    );
    assert!(validate_riot_id("ab", "EUW").is_err());
    assert!(validate_riot_id("Tester", "E").is_err());
    assert!(validate_riot_id("Tester", "EU W").is_err());
}

/* ----------------------------- rate limiter ----------------------------- */

#[test]
fn rate_limiter_enforces_short_and_long_windows() {
    let mut limiter = RateLimiter::new(vec![
        (3, Duration::from_secs(1)),
        (5, Duration::from_secs(10)),
    ]);
    let start = Instant::now();
    for _ in 0..3 {
        assert!(limiter.acquire("euw1", start).is_ok());
    }
    let wait = limiter.acquire("euw1", start).unwrap_err();
    assert_eq!(wait, Duration::from_secs(1));
    // Other routing values have their own budget.
    assert!(limiter.acquire("na1", start).is_ok());

    let later = start + Duration::from_secs(1);
    assert!(limiter.acquire("euw1", later).is_ok());
    assert!(limiter.acquire("euw1", later).is_ok());
    // 5 requests in the 10 s window: blocked until the first one expires.
    let wait = limiter.acquire("euw1", later).unwrap_err();
    assert_eq!(wait, Duration::from_secs(9));
    assert!(limiter
        .acquire("euw1", start + Duration::from_secs(10))
        .is_ok());
}

#[test]
fn rate_limiter_honours_retry_after_blocks() {
    let mut limiter = RateLimiter::development();
    let now = Instant::now();
    limiter.block("europe", now, Duration::from_secs(5));
    assert_eq!(
        limiter.acquire("europe", now).unwrap_err(),
        Duration::from_secs(5)
    );
    assert!(limiter
        .acquire("europe", now + Duration::from_secs(5))
        .is_ok());
}

/* -------------------------------- keys ---------------------------------- */

#[test]
fn key_format_and_precedence() {
    assert!(is_valid_key_format(TEST_KEY));
    assert!(!is_valid_key_format("RGAPI-123"));
    assert!(!is_valid_key_format("00000000-0000-0000-0000-000000000000"));

    let provider = KeyProvider::new(MemoryStore::with(None), None);
    assert!(provider.resolve().unwrap().is_none());
    assert!(matches!(
        provider.save("chiave-sbagliata"),
        Err(AppError::Validation(_))
    ));
    provider.save(&format!("  {TEST_KEY} ")).unwrap();
    assert_eq!(provider.source().unwrap(), Some(KeySource::CredentialStore));
    provider.clear().unwrap();
    assert!(provider.resolve().unwrap().is_none());

    let env_first = KeyProvider::new(
        MemoryStore::with(Some(TEST_KEY)),
        Some("RGAPI-11111111-1111-1111-1111-111111111111".to_string()),
    );
    let (key, source) = env_first.resolve().unwrap().unwrap();
    assert_eq!(source, KeySource::Environment);
    assert!(key.starts_with("RGAPI-1111"));
}

/* ------------------------------- client --------------------------------- */

#[tokio::test]
async fn missing_key_is_reported_without_any_request() {
    let client = client_with(None, None);
    let result = account::by_riot_id(&client, "euw1", "Tester", "TEST").await;
    assert!(matches!(result, Err(AppError::RiotKey(_))));
    assert_eq!(client_total(&client), 0);
}

fn client_total(client: &RiotClient<MockTransport, MemoryStore>) -> usize {
    transport(client).total()
}

fn transport(client: &RiotClient<MockTransport, MemoryStore>) -> &MockTransport {
    // Test-only access to the scripted transport.
    client.transport_for_tests()
}

#[tokio::test]
async fn unknown_account_returns_a_clear_not_found() {
    let client = client();
    transport(&client).on(
        "/by-riot-id/",
        404,
        json!({ "status": { "message": "Data not found", "status_code": 404 } }),
    );
    let error = account::by_riot_id(&client, "euw1", "Nessuno", "000")
        .await
        .unwrap_err();
    match error {
        AppError::NotFound(message) => assert!(message.contains("Nessuno#000")),
        other => panic!("errore inatteso: {other:?}"),
    }
}

#[tokio::test]
async fn invalid_or_expired_keys_are_reported() {
    for status in [401, 403] {
        let client = client();
        transport(&client).on("/by-riot-id/", status, json!({}));
        let result = account::by_riot_id(&client, "euw1", "Tester", "TEST").await;
        assert!(matches!(result, Err(AppError::RiotKey(_))), "{status}");
    }
}

#[tokio::test]
async fn the_key_is_sent_only_as_header_value_and_regions_route_correctly() {
    let client = client();
    transport(&client)
        .on(
            "asia.api.riotgames.com/riot/account",
            200,
            json!({ "puuid": PUUID }),
        )
        .on(
            "kr.api.riotgames.com/lol/summoner",
            200,
            json!({ "profileIconId": 1, "summonerLevel": 30 }),
        )
        .on("sea.api.riotgames.com/lol/match", 200, json!([]));

    account::by_riot_id(&client, "kr", "Tester", "KR1")
        .await
        .unwrap();
    crate::riot::summoner::by_puuid(&client, "kr", PUUID)
        .await
        .unwrap();
    matches::ids_by_puuid(&client, "oc1", PUUID, 20)
        .await
        .unwrap();

    let calls = transport(&client).calls.lock().unwrap().clone();
    assert!(
        calls.iter().all(|url| !url.contains("RGAPI")),
        "key never in URLs"
    );
    assert!(transport(&client)
        .keys
        .lock()
        .unwrap()
        .iter()
        .all(|key| key == TEST_KEY));
    assert!(calls[2].contains("count=20"));
}

#[tokio::test]
async fn rate_limit_429_waits_retry_after_then_succeeds() {
    let client = client();
    transport(&client)
        .on_raw("/by-riot-id/", 429, Some(2), "{}".to_string())
        .on("/by-riot-id/", 200, json!({ "puuid": PUUID }));

    let found = account::by_riot_id(&client, "euw1", "Tester", "TEST")
        .await
        .unwrap();
    assert_eq!(found.puuid, PUUID);
    assert_eq!(transport(&client).count("/by-riot-id/"), 2);
    assert!(transport(&client)
        .sleeps
        .lock()
        .unwrap()
        .contains(&Duration::from_secs(2)));
}

#[tokio::test]
async fn long_retry_after_is_returned_to_the_user() {
    let client = client();
    transport(&client).on_raw("/by-riot-id/", 429, Some(120), "{}".to_string());
    let result = account::by_riot_id(&client, "euw1", "Tester", "TEST").await;
    assert!(matches!(
        result,
        Err(AppError::RateLimited {
            retry_after_secs: 120
        })
    ));
    assert_eq!(
        transport(&client).count("/by-riot-id/"),
        1,
        "no blind retry"
    );
}

#[tokio::test]
async fn server_errors_are_retried_a_bounded_number_of_times() {
    let client = client();
    transport(&client).on("/by-riot-id/", 503, json!({})).on(
        "/by-riot-id/",
        200,
        json!({ "puuid": PUUID }),
    );
    assert!(account::by_riot_id(&client, "euw1", "Tester", "TEST")
        .await
        .is_ok());

    let failing = client_with(Some(TEST_KEY), None);
    transport(&failing).on("/by-riot-id/", 500, json!({}));
    let result = account::by_riot_id(&failing, "euw1", "Tester", "TEST").await;
    assert!(matches!(result, Err(AppError::Network { .. })));
    assert_eq!(transport(&failing).count("/by-riot-id/"), 3);
}

#[tokio::test]
async fn malformed_responses_are_rejected() {
    let client = client();
    transport(&client).on_raw("/by-riot-id/", 200, None, "{ non json".to_string());
    let result = account::by_riot_id(&client, "euw1", "Tester", "TEST").await;
    assert!(matches!(result, Err(AppError::SourceData { .. })));
}

/* ------------------------- sync, cache, statistics ---------------------- */

#[tokio::test]
async fn search_syncs_profile_ranked_and_match_history() {
    let temp = TempDb::new("riot-search");
    let db = temp.open();
    let client = client();
    let locks = SyncLocks::default();
    script_player(transport(&client));

    let puuid = sync::search(&client, &db, &locks, "euw1", "Tester", "TEST")
        .await
        .unwrap();
    assert_eq!(puuid, PUUID);

    let profile = db
        .with_connection(|conn| repository::profile(conn, PUUID))
        .unwrap()
        .unwrap();
    assert_eq!(profile.game_name, "Tester");
    assert_eq!(profile.summoner_level, Some(187));
    assert_eq!(profile.source, "Riot API");
    assert!(profile.sync.matches_synced_at.is_some());

    let solo = profile
        .ranked
        .iter()
        .find(|r| r.queue_type == "RANKED_SOLO_5x5")
        .unwrap();
    assert_eq!(
        (
            solo.tier.as_str(),
            solo.division.as_deref(),
            solo.league_points
        ),
        ("GOLD", Some("II"), 47)
    );
    assert_eq!((solo.wins, solo.losses), (30, 25));
    assert!(profile
        .ranked
        .iter()
        .any(|r| r.queue_type == "RANKED_FLEX_SR"));

    assert_eq!(profile.matches.len(), 2);
    let newest = &profile.matches[0];
    assert_eq!(newest.match_id, "EUW1_2", "newest first");
    assert!(newest.win);
    assert_eq!((newest.kills, newest.deaths, newest.assists), (7, 2, 9));
    assert_eq!(newest.creep_score, 160);
    assert_eq!(newest.duration_seconds, 1830);
    assert_eq!(newest.queue_id, 420);
    assert_eq!(newest.champion_name.as_deref(), Some("Alpha"));
    assert_eq!(
        newest.items.iter().map(|item| item.id).collect::<Vec<_>>(),
        [1001, 3020, 3340]
    );
    assert_eq!(newest.keystone.as_ref().map(|rune| rune.id), Some(8112));
    assert_eq!(
        newest.secondary_style.as_ref().map(|rune| rune.id),
        Some(8300)
    );
    assert!(newest.played_at.starts_with("2023-11-14T"));
    assert!(!profile.matches[1].win);

    // Both players of the match are stored, the match only once.
    let participants: i64 = db
        .with_connection(|conn| {
            Ok(conn.query_row("SELECT COUNT(*) FROM match_participants", [], |r| r.get(0))?)
        })
        .unwrap();
    assert_eq!(participants, 4);
}

#[tokio::test]
async fn cache_avoids_duplicate_requests() {
    let temp = TempDb::new("riot-cache");
    let db = temp.open();
    let client = client();
    let locks = SyncLocks::default();
    script_player(transport(&client));

    sync::search(&client, &db, &locks, "euw1", "Tester", "TEST")
        .await
        .unwrap();
    let after_first = transport(&client).total();
    assert_eq!(
        after_first, 7,
        "account + account/puuid + summoner + league + ids + 2 matches"
    );

    // Within the TTLs: a new search or sync sends nothing.
    sync::search(&client, &db, &locks, "euw1", "tester", "test")
        .await
        .unwrap();
    sync::sync_player(&client, &db, &locks, PUUID, false)
        .await
        .unwrap();
    assert_eq!(transport(&client).total(), after_first);

    // Forced sync with one new match: only that match is downloaded.
    transport(&client)
        .replace("/ids?", 200, json!(["EUW1_3", "EUW1_2", "EUW1_1"]))
        .replace(
            "/matches/EUW1_3",
            200,
            match_json("EUW1_3", 1_700_000_200_000, true),
        );
    sync::sync_player(&client, &db, &locks, PUUID, true)
        .await
        .unwrap();
    assert_eq!(transport(&client).count("/matches/EUW1_3"), 1);
    assert_eq!(
        transport(&client).count("/matches/EUW1_2"),
        1,
        "never downloaded twice"
    );
    assert_eq!(
        transport(&client).count("/matches/EUW1_1"),
        1,
        "never downloaded twice"
    );

    let profile = db
        .with_connection(|conn| repository::profile(conn, PUUID))
        .unwrap()
        .unwrap();
    assert_eq!(profile.matches.len(), 3);
}

#[tokio::test]
async fn unknown_account_creates_no_local_data() {
    let temp = TempDb::new("riot-missing");
    let db = temp.open();
    let client = client();
    transport(&client).on("/by-riot-id/", 404, json!({}));

    let result = sync::search(
        &client,
        &db,
        &SyncLocks::default(),
        "euw1",
        "Nessuno",
        "000",
    )
    .await;
    assert!(matches!(result, Err(AppError::NotFound(_))));
    let players: i64 = db
        .with_connection(|conn| {
            Ok(conn.query_row("SELECT COUNT(*) FROM players", [], |r| r.get(0))?)
        })
        .unwrap();
    assert_eq!(players, 0);
}

#[tokio::test]
async fn sync_errors_are_recorded_and_keep_previous_data() {
    let temp = TempDb::new("riot-sync-error");
    let db = temp.open();
    let client = client();
    let locks = SyncLocks::default();
    script_player(transport(&client));
    sync::search(&client, &db, &locks, "euw1", "Tester", "TEST")
        .await
        .unwrap();

    transport(&client).replace("/summoner/v4/", 403, json!({}));
    let result = sync::sync_player(&client, &db, &locks, PUUID, true).await;
    assert!(matches!(result, Err(AppError::RiotKey(_))));

    let profile = db
        .with_connection(|conn| repository::profile(conn, PUUID))
        .unwrap()
        .unwrap();
    assert!(profile.sync.last_error.unwrap().contains("Chiave API Riot"));
    assert_eq!(profile.matches.len(), 2, "cached history stays available");
}

#[tokio::test]
async fn concurrent_sync_of_the_same_player_is_rejected() {
    let locks = SyncLocks::default();
    let _guard = locks.acquire(PUUID).unwrap();
    assert!(matches!(locks.acquire(PUUID), Err(AppError::Busy(_))));
    assert!(locks.acquire(OTHER).is_ok());
}

#[tokio::test]
async fn saved_profiles_and_data_deletion() {
    let temp = TempDb::new("riot-profiles");
    let db = temp.open();
    let client = client();
    let locks = SyncLocks::default();
    script_player(transport(&client));
    sync::search(&client, &db, &locks, "euw1", "Tester", "TEST")
        .await
        .unwrap();

    db.with_connection(|conn| {
        repository::upsert_player(conn, OTHER, "Altro", "TEST", "euw1", None)?;
        repository::link_matches(conn, OTHER, &["EUW1_1".to_string()])?;
        repository::save_profile(conn, PUUID, false)?;
        repository::save_profile(conn, OTHER, false)
    })
    .unwrap();

    let saved = db
        .with_connection(|conn| repository::saved_profiles(conn))
        .unwrap();
    assert_eq!(saved.len(), 2);
    assert!(
        saved.iter().find(|p| p.puuid == PUUID).unwrap().primary,
        "first saved = primary"
    );
    assert_eq!(
        saved
            .iter()
            .find(|p| p.puuid == PUUID)
            .unwrap()
            .solo_queue
            .as_ref()
            .unwrap()
            .tier,
        "GOLD"
    );

    db.with_connection(|conn| repository::save_profile(conn, OTHER, true))
        .unwrap();
    assert_eq!(
        db.with_connection(|conn| repository::primary_puuid(conn))
            .unwrap()
            .as_deref(),
        Some(OTHER)
    );

    // Deleting a player keeps matches still linked to someone else.
    db.with_connection(|conn| repository::delete_player_data(conn, PUUID))
        .unwrap();
    let remaining: Vec<String> = db
        .with_connection(|conn| {
            let mut statement = conn.prepare("SELECT match_id FROM matches ORDER BY match_id")?;
            let rows = statement
                .query_map([], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
        .unwrap();
    assert_eq!(remaining, ["EUW1_1"]);
    assert!(db
        .with_connection(|conn| repository::profile(conn, PUUID))
        .unwrap()
        .is_none());
}

#[test]
fn legacy_match_durations_in_milliseconds_are_normalised() {
    let mut legacy = match_json("EUW1_9", 1_500_000_000_000, true);
    legacy["info"]
        .as_object_mut()
        .unwrap()
        .remove("gameEndTimestamp");
    legacy["info"]["gameDuration"] = json!(1_830_000);
    let parsed: matches::MatchDto = serde_json::from_value(legacy).unwrap();
    assert_eq!(parsed.info.duration_seconds(), 1830);
}
