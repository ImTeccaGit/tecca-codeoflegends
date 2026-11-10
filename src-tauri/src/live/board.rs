//! In-game board ("pannello partita"), approved by the user on 2026-11-10:
//!
//! * every player of the game: public Riot data looked up with the user's
//!   own key (level, Ranked Solo/Duo rank, recent ranked form), starting
//!   from the Riot IDs the scoreboard already shows. Bots and players whose
//!   Riot ID is hidden are never looked up;
//! * the build of the user's own champion, from the app statistics
//!   (collected or personal matches), computed once per game.
//!
//! The board window opens by itself at the start of every game.
//! Read-only and informative: no timers, cooldowns, items or scores of other
//! players, no decisions taken for the player, no input to the game.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::catalog::repository::current_version;
use crate::db::DatabaseSlot;
use crate::ddragon::urls;
use crate::error::AppError;
use crate::live::model::{LiveSnapshot, RosterEntry};
use crate::meta::dto::ChampionGlobalStats;
use crate::meta::service::GlobalStatsService;
use crate::meta::{stats as meta_stats, store as meta_store};
use crate::riot::client::RiotClient;
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;
use crate::riot::{account, league, matches, summoner, AppRiotClient};

pub const BOARD_UPDATE_EVENT: &str = "live-board-update";
/// Recent ranked games read per player (one request each).
pub const RECENT_DETAILS: usize = 5;
/// Window of the recent ranked games.
pub const RECENT_SECONDS: i64 = 30 * 24 * 3600;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankSummary {
    pub tier: String,
    pub division: Option<String>,
    pub league_points: i64,
    pub wins: i64,
    pub losses: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentForm {
    pub games: i64,
    pub wins: i64,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    /// Most played lane in those games.
    pub main_role: Option<String>,
    /// Games and wins with the champion played now.
    pub champion_games: i64,
    pub champion_wins: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardPlayer {
    pub riot_id: Option<String>,
    pub champion_name: String,
    pub champion_key: Option<String>,
    pub champion_image_url: Option<String>,
    pub team: String,
    pub position: Option<String>,
    pub is_me: bool,
    /// "anonymous" | "bot" | "pending" | "ranked" | "ready" | "error".
    pub state: String,
    pub summoner_level: Option<i64>,
    pub rank: Option<RankSummary>,
    pub recent: Option<RecentForm>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveBoard {
    pub active: bool,
    pub platform: Option<String>,
    pub players: Vec<BoardPlayer>,
    pub build: Option<ChampionGlobalStats>,
    pub build_champion: Option<String>,
    pub message: Option<String>,
    pub updated_at_ms: u64,
}

impl LiveBoard {
    fn inactive() -> Self {
        Self {
            active: false,
            platform: None,
            players: Vec::new(),
            build: None,
            build_champion: None,
            message: Some("Nessuna partita in corso.".to_string()),
            updated_at_ms: now_ms(),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

pub struct BoardService {
    board: Mutex<LiveBoard>,
    /// Key of the game being shown (Riot IDs + champions).
    game_key: Mutex<Option<String>>,
    /// Incremented on every new game: stale lookups stop writing.
    generation: AtomicU64,
}

impl Default for BoardService {
    fn default() -> Self {
        Self {
            board: Mutex::new(LiveBoard::inactive()),
            game_key: Mutex::new(None),
            generation: AtomicU64::new(0),
        }
    }
}

impl BoardService {
    pub fn latest(&self) -> LiveBoard {
        self.board
            .lock()
            .map(|board| board.clone())
            .unwrap_or_else(|_| LiveBoard::inactive())
    }

    fn update(&self, generation: u64, change: impl FnOnce(&mut LiveBoard)) -> Option<LiveBoard> {
        if self.generation.load(Ordering::SeqCst) != generation {
            return None;
        }
        let mut board = self.board.lock().ok()?;
        change(&mut board);
        board.updated_at_ms = now_ms();
        Some(board.clone())
    }
}

/// "Name#TAG" → ("Name", "TAG").
pub fn split_riot_id(riot_id: &str) -> Option<(&str, &str)> {
    let (name, tag) = riot_id.rsplit_once('#')?;
    (!name.is_empty() && !tag.is_empty()).then_some((name, tag))
}

/// Recent ranked form of `puuid` from match details.
pub fn summarize_recent(
    puuid: &str,
    champion_id: Option<i64>,
    games: &[matches::MatchDto],
) -> RecentForm {
    let mut form = RecentForm::default();
    let mut roles: HashMap<String, i64> = HashMap::new();
    for game in games {
        let Some(me) = game
            .info
            .participants
            .iter()
            .find(|participant| participant.puuid == puuid)
        else {
            continue;
        };
        form.games += 1;
        form.wins += i64::from(me.win);
        form.kills += me.kills;
        form.deaths += me.deaths;
        form.assists += me.assists;
        if !me.team_position.is_empty() {
            *roles.entry(me.team_position.clone()).or_default() += 1;
        }
        if Some(me.champion_id) == champion_id {
            form.champion_games += 1;
            form.champion_wins += i64::from(me.win);
        }
    }
    form.main_role = roles
        .into_iter()
        .max_by(|a, b| a.1.cmp(&b.1).then_with(|| b.0.cmp(&a.0)))
        .map(|(role, _)| role);
    form
}

/// Level and Ranked Solo/Duo entry. Returns the PUUID for the next phase.
pub async fn lookup_rank<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    riot_id: &str,
) -> Result<(String, i64, Option<RankSummary>), AppError> {
    let (name, tag) = split_riot_id(riot_id)
        .ok_or_else(|| AppError::Validation("Riot ID non valido".to_string()))?;
    let found = account::by_riot_id(client, platform, name, tag).await?;
    let profile = summoner::by_puuid(client, platform, &found.puuid).await?;
    let rank = league::entries_by_puuid(client, platform, &found.puuid)
        .await?
        .into_iter()
        .find(|entry| entry.queue_type == "RANKED_SOLO_5x5")
        .map(|entry| RankSummary {
            tier: entry.tier,
            division: entry.rank,
            league_points: entry.league_points,
            wins: entry.wins,
            losses: entry.losses,
        });
    Ok((found.puuid, profile.summoner_level, rank))
}

/// Recent Ranked Solo/Duo games (up to `RECENT_DETAILS`).
pub async fn lookup_recent<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
    champion_id: Option<i64>,
    now_epoch_seconds: i64,
) -> Result<RecentForm, AppError> {
    let ids = matches::ranked_solo_ids(
        client,
        platform,
        puuid,
        now_epoch_seconds - RECENT_SECONDS,
        RECENT_DETAILS as u32,
    )
    .await?;
    let mut games = Vec::new();
    for id in ids.iter().take(RECENT_DETAILS) {
        match matches::by_id(client, platform, id).await {
            Ok((game, _raw)) => games.push(game),
            Err(AppError::NotFound(_)) => continue,
            Err(error) => return Err(error),
        }
    }
    Ok(summarize_recent(puuid, champion_id, &games))
}

/// Data Dragon id → (champion id, square image URL), current patch.
fn champion_index(conn: &Connection) -> Result<HashMap<String, (i64, String)>, AppError> {
    let Some(version) = current_version(conn)? else {
        return Ok(HashMap::new());
    };
    let mut statement = conn.prepare(
        "SELECT ddragon_id, champion_id, image_file FROM champion_versions WHERE patch_version = ?1",
    )?;
    let rows = statement.query_map([&version], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    let mut index = HashMap::new();
    for row in rows {
        let (key, id, file) = row?;
        index.insert(key, (id, urls::champion_square(&version, &file)));
    }
    Ok(index)
}

fn game_key(roster: &[RosterEntry]) -> String {
    roster
        .iter()
        .map(|entry| {
            format!(
                "{}:{}:{}",
                entry.team,
                entry.riot_id.as_deref().unwrap_or("?"),
                entry.champion_name
            )
        })
        .collect::<Vec<_>>()
        .join("|")
}

fn emit(app: &AppHandle, board: &LiveBoard) {
    if let Err(error) = app.emit(BOARD_UPDATE_EVENT, board) {
        log::warn!("Evento {BOARD_UPDATE_EVENT} non inviato: {error}");
    }
}

/// Called by the Live loop on every snapshot change.
pub fn on_snapshot(app: &AppHandle, snapshot: &LiveSnapshot) {
    let service = app.state::<BoardService>();
    let in_game = snapshot.status == "in_game" && !snapshot.roster.is_empty();
    if !in_game {
        let had_game = service
            .game_key
            .lock()
            .map(|mut key| key.take().is_some())
            .unwrap_or(false);
        if had_game {
            service.generation.fetch_add(1, Ordering::SeqCst);
            if let Ok(mut board) = service.board.lock() {
                *board = LiveBoard::inactive();
            }
            emit(app, &service.latest());
            crate::live::window::close_board(app);
        }
        return;
    }

    // Called about every 2 s in game: keep the board above the game.
    crate::live::window::raise_board(app);

    let key = game_key(&snapshot.roster);
    let new_game = {
        let Ok(mut current) = service.game_key.lock() else {
            return;
        };
        if current.as_deref() == Some(key.as_str()) {
            return;
        }
        current.replace(key).is_none()
    };
    // Opens by itself when a game starts (the user asked for it); the
    // shortcut still hides it. Not reopened if the roster changes later.
    if new_game {
        if let Err(error) = crate::live::window::open_board(app) {
            log::warn!("Apertura automatica del pannello partita non riuscita: {error}");
        }
    }
    let generation = service.generation.fetch_add(1, Ordering::SeqCst) + 1;
    let roster = snapshot.roster.clone();
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        run_lookup(&app, generation, roster).await;
    });
}

async fn run_lookup(app: &AppHandle, generation: u64, roster: Vec<RosterEntry>) {
    let service = app.state::<BoardService>();
    let slot = app.state::<DatabaseSlot>();
    let Ok(db) = slot.get() else {
        return;
    };
    let platform = db
        .settings()
        .map(|settings| settings.region)
        .unwrap_or_else(|_| "euw1".to_string());
    let index = db
        .with_connection(|conn| champion_index(conn))
        .unwrap_or_default();

    let players: Vec<BoardPlayer> = roster
        .iter()
        .map(|entry| {
            let indexed = entry.champion_key.as_ref().and_then(|key| index.get(key));
            BoardPlayer {
                riot_id: entry.riot_id.clone(),
                champion_name: entry.champion_name.clone(),
                champion_key: entry.champion_key.clone(),
                champion_image_url: indexed.map(|(_, url)| url.clone()),
                team: entry.team.clone(),
                position: entry.position.clone(),
                is_me: entry.is_me,
                state: if entry.is_bot {
                    "bot"
                } else if entry.riot_id.is_none() {
                    "anonymous"
                } else {
                    "pending"
                }
                .to_string(),
                summoner_level: None,
                rank: None,
                recent: None,
                message: None,
            }
        })
        .collect();

    // Build of the user's own champion (statistics already in the database).
    let me = roster.iter().find(|entry| entry.is_me);
    let my_champion = me
        .and_then(|entry| entry.champion_key.as_ref())
        .and_then(|key| index.get(key))
        .map(|(id, _)| *id);
    let build = match (my_champion, me) {
        (Some(id), Some(entry)) => db
            .with_connection(|conn| {
                let _ = meta_store::import_personal(conn);
                meta_stats::champion_stats(conn, id, None, entry.position.as_deref())
            })
            .map_err(|error| log::warn!("Build in partita non calcolata: {error}"))
            .ok(),
        _ => None,
    };

    if let Some(board) = service.update(generation, |board| {
        board.active = true;
        board.platform = Some(platform.clone());
        board.players = players.clone();
        board.build = build;
        board.build_champion = me.map(|entry| entry.champion_name.clone());
        board.message = None;
    }) {
        emit(app, &board);
    }

    let client = app.state::<AppRiotClient>();
    let collector = app.state::<GlobalStatsService>();
    collector.set_paused(true);
    let result = lookup_all(app, &client, generation, &platform, &roster, &index).await;
    collector.set_paused(false);
    if let Err(error) = result {
        let message = error.user_message();
        let _ = error.logged();
        if let Some(board) = service.update(generation, |board| {
            for player in &mut board.players {
                if player.state == "pending" || player.state == "ranked" {
                    player.state = "error".to_string();
                }
            }
            board.message = Some(message);
        }) {
            emit(app, &board);
        }
    }
}

async fn lookup_all(
    app: &AppHandle,
    client: &AppRiotClient,
    generation: u64,
    platform: &str,
    roster: &[RosterEntry],
    index: &HashMap<String, (i64, String)>,
) -> Result<(), AppError> {
    let service = app.state::<BoardService>();
    // Phase 1: level and rank for everybody (fills the board quickly).
    let mut puuids: Vec<Option<String>> = vec![None; roster.len()];
    for (position, entry) in roster.iter().enumerate() {
        let Some(riot_id) = entry.riot_id.as_deref() else {
            continue;
        };
        if service.generation.load(Ordering::SeqCst) != generation {
            return Ok(());
        }
        let outcome = lookup_rank(client, platform, riot_id).await;
        let fatal = matches!(outcome, Err(AppError::RiotKey(_)));
        let board = service.update(generation, |board| {
            let Some(player) = board.players.get_mut(position) else {
                return;
            };
            match &outcome {
                Ok((puuid, level, rank)) => {
                    puuids[position] = Some(puuid.clone());
                    player.summoner_level = Some(*level);
                    player.rank = rank.clone();
                    player.state = "ranked".to_string();
                }
                Err(error) => {
                    player.state = "error".to_string();
                    player.message = Some(error.user_message());
                }
            }
        });
        if let Some(board) = board {
            emit(app, &board);
        }
        if fatal {
            return outcome.map(|_| ());
        }
    }

    // Phase 2: recent ranked form.
    let now = (now_ms() / 1000) as i64;
    for (position, entry) in roster.iter().enumerate() {
        let Some(puuid) = puuids[position].clone() else {
            continue;
        };
        if service.generation.load(Ordering::SeqCst) != generation {
            return Ok(());
        }
        let champion_id = entry
            .champion_key
            .as_ref()
            .and_then(|key| index.get(key))
            .map(|(id, _)| *id);
        let outcome = lookup_recent(client, platform, &puuid, champion_id, now).await;
        let fatal = matches!(outcome, Err(AppError::RiotKey(_)));
        if let Some(board) = service.update(generation, |board| {
            let Some(player) = board.players.get_mut(position) else {
                return;
            };
            match &outcome {
                Ok(form) => {
                    player.recent = Some(form.clone());
                    player.state = "ready".to_string();
                }
                Err(error) => {
                    player.state = "ready".to_string();
                    player.message = Some(error.user_message());
                }
            }
        }) {
            emit(app, &board);
        }
        if fatal {
            return outcome.map(|_| ());
        }
    }
    Ok(())
}
