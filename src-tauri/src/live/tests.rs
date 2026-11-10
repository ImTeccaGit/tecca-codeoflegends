//! Live Game tests with a simulated Live Client Data API. Test-only: the
//! application never ships simulated game data.

use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use crate::live::model::LiveSnapshot;
use crate::live::overlay::{position, Area, OverlayPatch, OverlaySettings};
use crate::live::repository;
use crate::live::service::LiveService;
use crate::live::snapshot::poll_once;
use crate::live::source::{FetchError, LiveSource};
use crate::test_support::TempDb;

#[derive(Default)]
struct SimulatedGame {
    responses: Mutex<HashMap<String, Result<String, FetchError>>>,
    calls: AtomicUsize,
}

impl SimulatedGame {
    fn set(&self, path: &str, response: Result<String, FetchError>) {
        self.responses
            .lock()
            .unwrap()
            .insert(format!("/liveclientdata/{path}"), response);
    }

    fn calls(&self) -> usize {
        self.calls.load(Ordering::SeqCst)
    }

    fn not_running() -> Self {
        let game = Self::default();
        for path in ["gamestats", "activeplayername", "playerlist"] {
            game.set(path, Err(FetchError::NotRunning));
        }
        game
    }

    fn in_game(game_time: f64, my_cs: i64) -> Self {
        let game = Self::default();
        game.set_in_game(game_time, my_cs);
        game
    }

    fn set_in_game(&self, game_time: f64, my_cs: i64) {
        self.set(
            "gamestats",
            Ok(format!(
                r#"{{"gameMode":"CLASSIC","gameTime":{game_time},"mapName":"Map11","mapNumber":11,"mapTerrain":"Default"}}"#
            )),
        );
        self.set("activeplayername", Ok(r#""Tester#EUW""#.to_string()));
        self.set(
            "playerlist",
            Ok(format!(
                r#"[
                {{"riotId":"Tester#EUW","riotIdGameName":"Tester","riotIdTagLine":"EUW","summonerName":"Tester#EUW",
                  "championName":"Ahri","rawChampionName":"game_character_displayname_Ahri","level":7,"team":"ORDER",
                  "position":"MIDDLE","isDead":false,"isBot":false,
                  "items":[{{"itemID":1056}}],"summonerSpells":{{}},"runes":{{}},
                  "scores":{{"kills":2,"deaths":1,"assists":3,"creepScore":{my_cs},"wardScore":4.5}}}},
                {{"riotId":"EnemySecret#KR1","riotIdGameName":"EnemySecret","riotIdTagLine":"KR1",
                  "championName":"Zed","rawChampionName":"game_character_displayname_Zed","level":8,"team":"CHAOS",
                  "position":"MIDDLE","isDead":true,"respawnTimer":12.5,
                  "items":[{{"itemID":3142}}],
                  "scores":{{"kills":5,"deaths":0,"assists":1,"creepScore":99,"wardScore":1.0}}}}
              ]"#
            )),
        );
    }
}

impl LiveSource for SimulatedGame {
    async fn get(&self, path: &str) -> Result<String, FetchError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.responses
            .lock()
            .unwrap()
            .get(path)
            .cloned()
            .unwrap_or(Err(FetchError::Unavailable(404)))
    }
}

/* Snapshot ---------------------------------------------------------------- */

#[tokio::test]
async fn no_game_running_reports_not_running() {
    let snapshot = poll_once(&SimulatedGame::not_running()).await;
    assert_eq!(snapshot.status, "not_running");
    assert!(snapshot.game.is_none() && snapshot.player.is_none());
}

#[tokio::test]
async fn loading_screen_reports_loading() {
    let game = SimulatedGame::default();
    game.set("gamestats", Err(FetchError::Unavailable(404)));
    assert_eq!(poll_once(&game).await.status, "loading");
}

#[tokio::test]
async fn malformed_response_reports_error_without_fake_data() {
    let game = SimulatedGame::in_game(600.0, 50);
    game.set("playerlist", Ok("{not json".to_string()));
    let snapshot = poll_once(&game).await;
    assert_eq!(snapshot.status, "error");
    assert!(snapshot.game.is_none() && snapshot.player.is_none());
}

#[tokio::test]
async fn in_game_keeps_own_stats_and_only_public_identity_of_others() {
    let snapshot = poll_once(&SimulatedGame::in_game(600.0, 75)).await;
    assert_eq!(snapshot.status, "in_game");

    let game = snapshot.game.as_ref().expect("game");
    assert_eq!(game.mode, "CLASSIC");
    assert_eq!(game.map_number, 11);

    let me = snapshot.player.as_ref().expect("own player");
    assert_eq!(me.riot_id, "Tester#EUW");
    assert_eq!(me.champion_name, "Ahri");
    assert_eq!(me.champion_key.as_deref(), Some("Ahri"));
    assert_eq!(me.position.as_deref(), Some("MIDDLE"));
    assert_eq!((me.kills, me.deaths, me.assists), (2, 1, 3));
    assert_eq!(me.cs_per_minute, Some(7.5));

    // Other players: only the scoreboard identity (Riot ID, champion, team,
    // lane). Their items, scores and timers never reach the webview.
    assert_eq!(snapshot.roster.len(), 2);
    let enemy = &snapshot.roster[1];
    assert_eq!(enemy.riot_id.as_deref(), Some("EnemySecret#KR1"));
    assert_eq!(enemy.champion_key.as_deref(), Some("Zed"));
    assert_eq!(enemy.team, "CHAOS");
    assert!(!enemy.is_me && snapshot.roster[0].is_me);
    let json = serde_json::to_string(&snapshot).unwrap();
    for leaked in ["respawn", "12.5", "3142", "\"kills\":5", "99"] {
        assert!(
            !json.contains(leaked),
            "dato di partita di altri giocatori esposto: {leaked}"
        );
    }
}

#[test]
fn hidden_names_and_bots_are_never_identified() {
    use crate::live::model::{RawGameStats, RawPlayer};
    let stats: RawGameStats =
        serde_json::from_str(r#"{"gameMode":"CLASSIC","gameTime":60}"#).unwrap();
    let players: Vec<RawPlayer> = serde_json::from_str(
        r#"[
          {"riotId":"Tester#EUW","riotIdGameName":"Tester","riotIdTagLine":"EUW","championName":"Ahri","team":"ORDER"},
          {"riotIdGameName":"","riotIdTagLine":"","championName":"Zed","team":"CHAOS"},
          {"riotIdGameName":"Bot","riotIdTagLine":"BOT","championName":"Annie","team":"CHAOS","isBot":true}
        ]"#,
    )
    .unwrap();
    let snapshot = crate::live::snapshot::build_snapshot(&stats, Some("Tester#EUW"), &players);
    assert_eq!(snapshot.roster[0].riot_id.as_deref(), Some("Tester#EUW"));
    assert_eq!(snapshot.roster[1].riot_id, None, "hidden name");
    assert_eq!(snapshot.roster[2].riot_id, None, "bot");
    assert!(snapshot.roster[2].is_bot);
}

#[test]
fn board_summarizes_recent_ranked_form() {
    use crate::live::board::{split_riot_id, summarize_recent};
    assert_eq!(
        split_riot_id("Nome con spazi#EUW"),
        Some(("Nome con spazi", "EUW"))
    );
    assert_eq!(split_riot_id("Senza tag"), None);

    let game =
        |id: &str, champion: i64, win: bool, position: &str| -> crate::riot::matches::MatchDto {
            serde_json::from_value(serde_json::json!({
            "metadata": { "matchId": id },
            "info": {
                "gameCreation": 0, "gameDuration": 1800, "gameEndTimestamp": 1,
                "queueId": 420,
                "participants": [
                    { "puuid": "ME", "championId": champion, "win": win, "teamPosition": position,
                      "kills": 4, "deaths": 2, "assists": 6 },
                    { "puuid": "OTHER", "championId": 1, "win": !win, "teamPosition": "TOP" }
                ]
            }
        }))
        .unwrap()
        };
    let games = [
        game("A", 39, true, "TOP"),
        game("B", 39, false, "TOP"),
        game("C", 7, true, "MIDDLE"),
    ];
    let form = summarize_recent("ME", Some(39), &games);
    assert_eq!((form.games, form.wins), (3, 2));
    assert_eq!((form.kills, form.deaths, form.assists), (12, 6, 18));
    assert_eq!(form.main_role.as_deref(), Some("TOP"));
    assert_eq!((form.champion_games, form.champion_wins), (2, 1));
}

#[tokio::test]
async fn spectator_has_game_but_no_personal_data() {
    let game = SimulatedGame::in_game(300.0, 10);
    game.set("activeplayername", Err(FetchError::Unavailable(404)));
    let snapshot = poll_once(&game).await;
    assert_eq!(snapshot.status, "in_game");
    assert!(snapshot.game.is_some());
    assert!(snapshot.player.is_none());
    assert!(snapshot.message.is_some());
}

#[tokio::test]
async fn cs_per_minute_is_not_computed_in_the_first_minute() {
    let snapshot = poll_once(&SimulatedGame::in_game(30.0, 2)).await;
    assert_eq!(snapshot.player.expect("player").cs_per_minute, None);
}

/* Service ----------------------------------------------------------------- */

#[tokio::test]
async fn disabled_service_makes_no_requests() {
    let service = LiveService::new(false);
    let game = SimulatedGame::in_game(600.0, 50);
    assert!(service.tick(&game).await.is_none());
    assert_eq!(game.calls(), 0);
    assert_eq!(service.latest().status, "disabled");
}

#[tokio::test]
async fn service_emits_only_on_changes_and_detects_disconnection() {
    let service = LiveService::new(true);
    let game = SimulatedGame::in_game(600.0, 50);

    let first = service.tick(&game).await.expect("first snapshot emitted");
    assert_eq!(first.status, "in_game");
    assert!(first.updated_at_ms > 0);
    assert_eq!(
        service.next_interval(),
        crate::live::service::IN_GAME_INTERVAL
    );

    // Same data: nothing to emit.
    assert!(service.tick(&game).await.is_none());

    // Data update.
    game.set_in_game(660.0, 58);
    let updated = service.tick(&game).await.expect("update emitted");
    assert_eq!(updated.player.expect("player").creep_score, 58);

    // Game closed: disconnection is emitted and polling slows down.
    for path in ["gamestats", "activeplayername", "playerlist"] {
        game.set(path, Err(FetchError::NotRunning));
    }
    let closed = service.tick(&game).await.expect("disconnection emitted");
    assert_eq!(closed.status, "not_running");
    assert_eq!(service.next_interval(), crate::live::service::IDLE_INTERVAL);
}

#[tokio::test]
async fn disabling_resets_state_and_stops_requests() {
    let service = LiveService::new(true);
    let game = SimulatedGame::in_game(600.0, 50);
    service.tick(&game).await.expect("in game");

    let snapshot = service.set_enabled(false);
    assert_eq!(snapshot.status, "disabled");
    assert!(snapshot.player.is_none());

    let calls = game.calls();
    assert!(service.tick(&game).await.is_none());
    assert_eq!(game.calls(), calls);
}

#[test]
fn same_content_ignores_timestamp() {
    let mut a = LiveSnapshot::with_status("not_running", Some("x"));
    let b = a.clone();
    a.updated_at_ms = 42;
    assert!(a.same_content(&b));
}

/* Overlay settings ------------------------------------------------------- */

#[test]
fn overlay_defaults_are_hidden_and_valid() {
    let settings = OverlaySettings::default();
    assert!(!settings.visible);
    assert!(settings.is_click_through());
    settings.validate().expect("defaults valid");
}

#[test]
fn overlay_patch_is_validated_and_never_partially_applied() {
    let base = OverlaySettings::default();
    let bad = [
        OverlayPatch {
            mode: Some("fullscreen".into()),
            ..Default::default()
        },
        OverlayPatch {
            width: Some(5000),
            ..Default::default()
        },
        OverlayPatch {
            height: Some(10),
            ..Default::default()
        },
        OverlayPatch {
            opacity: Some(0.05),
            ..Default::default()
        },
        OverlayPatch {
            opacity: Some(f64::NAN),
            ..Default::default()
        },
        OverlayPatch {
            anchor: Some("center".into()),
            ..Default::default()
        },
        OverlayPatch {
            theme: Some("neon".into()),
            ..Default::default()
        },
        OverlayPatch {
            offset_x: Some(9999),
            ..Default::default()
        },
        OverlayPatch::default(),
    ];
    for patch in bad {
        assert!(base.merged(&patch).is_err(), "patch accettata: {patch:?}");
    }

    let next = base
        .merged(&OverlayPatch {
            visible: Some(true),
            mode: Some("window".into()),
            width: Some(400),
            ..Default::default()
        })
        .expect("valid patch");
    assert!(next.visible && !next.is_click_through());
    assert_eq!(next.width, 400);
    assert_eq!(next.height, base.height);
}

#[test]
fn overlay_position_respects_anchor_and_stays_on_screen() {
    let area = Area {
        x: 1920.0,
        y: 0.0,
        width: 1920.0,
        height: 1080.0,
    };
    let mut settings = OverlaySettings::default(); // 300x140, top-right, 24/96
    assert_eq!(
        position(&settings, area),
        (1920.0 + 1920.0 - 300.0 - 24.0, 96.0)
    );

    settings.anchor = "bottom-left".into();
    assert_eq!(
        position(&settings, area),
        (1920.0 + 24.0, 1080.0 - 140.0 - 96.0)
    );

    // Huge offsets are clamped inside the monitor.
    settings.anchor = "top-left".into();
    settings.offset_x = 2000;
    settings.offset_y = 2000;
    assert_eq!(
        position(&settings, area),
        (1920.0 + 1920.0 - 300.0, 1080.0 - 140.0)
    );
}

/* Persistence ------------------------------------------------------------ */

#[test]
fn live_preferences_persist_with_safe_defaults() {
    let temp = TempDb::new("live-prefs");
    let db = temp.open();
    db.with_connection(|conn| {
        assert!(!repository::live_enabled(conn)?);
        assert_eq!(
            repository::overlay_settings(conn)?,
            OverlaySettings::default()
        );

        repository::set_live_enabled(conn, true)?;
        assert!(repository::live_enabled(conn)?);

        let custom = OverlaySettings {
            visible: true,
            theme: "contrast".into(),
            ..Default::default()
        };
        repository::save_overlay_settings(conn, &custom)?;
        assert_eq!(repository::overlay_settings(conn)?, custom);

        // Tampered values fall back to safe defaults.
        conn.execute(
            "UPDATE settings SET value = '{\"width\":99999}' WHERE key = 'overlay'",
            [],
        )?;
        conn.execute(
            "UPDATE settings SET value = 'oops' WHERE key = 'live_enabled'",
            [],
        )?;
        assert_eq!(
            repository::overlay_settings(conn)?,
            OverlaySettings::default()
        );
        assert!(!repository::live_enabled(conn)?);
        Ok(())
    })
    .expect("repository");
}

#[test]
fn board_shortcut_is_the_home_key() {
    let shortcut: tauri_plugin_global_shortcut::Shortcut = crate::live::window::BOARD_SHORTCUT
        .parse()
        .expect("valid shortcut");
    assert_eq!(
        shortcut.key,
        tauri_plugin_global_shortcut::Code::Home,
        "Home, no modifiers"
    );
    assert!(shortcut.mods.is_empty());
}
