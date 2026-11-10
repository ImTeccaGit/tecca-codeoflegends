//! Opt-in background collection of global statistics. Off by default; while
//! on, it runs `collector::step` in a loop and pauses on errors instead of
//! retrying aggressively.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tokio::sync::Notify;

use crate::db::{Database, DatabaseSlot};
use crate::error::AppError;
use crate::meta::collector;
use crate::meta::dto::GlobalStatsStatus;
use crate::meta::store::{self, Settings};
use crate::riot::AppRiotClient;

/// Every seed player was read recently: check again later.
const IDLE_WAIT: Duration = Duration::from_secs(15 * 60);
const NETWORK_WAIT: Duration = Duration::from_secs(60);
const KEY_WAIT: Duration = Duration::from_secs(10 * 60);
const OTHER_WAIT: Duration = Duration::from_secs(120);
/// In-game board lookup running: check again shortly.
const PAUSE_WAIT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone)]
struct RunState {
    state: String,
    message: Option<String>,
    session_matches: u64,
    last_activity_ms: Option<u64>,
}

pub struct GlobalStatsService {
    enabled: AtomicBool,
    /// Set while the in-game board uses the Riot API budget.
    paused: AtomicBool,
    run: Mutex<RunState>,
    wake: Notify,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

impl GlobalStatsService {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
            paused: AtomicBool::new(false),
            run: Mutex::new(RunState {
                state: if enabled { "idle" } else { "disabled" }.to_string(),
                message: None,
                session_matches: 0,
                last_activity_ms: None,
            }),
            wake: Notify::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    /// Pauses collection while the in-game board looks players up.
    pub fn set_paused(&self, paused: bool) {
        self.paused.store(paused, Ordering::SeqCst);
        if !paused {
            self.wake.notify_one();
        }
    }

    fn is_paused(&self) -> bool {
        self.paused.load(Ordering::SeqCst)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::SeqCst);
        self.update(|run| {
            run.state = if enabled { "idle" } else { "disabled" }.to_string();
            run.message = None;
        });
        self.wake.notify_one();
    }

    /// Settings changed: restart the current wait.
    pub fn nudge(&self) {
        self.wake.notify_one();
    }

    fn update(&self, change: impl FnOnce(&mut RunState)) {
        if let Ok(mut run) = self.run.lock() {
            change(&mut run);
        }
    }

    fn snapshot(&self) -> Option<RunState> {
        self.run.lock().ok().map(|run| run.clone())
    }

    /// Persistent totals + in-memory progress of this session.
    pub fn status(
        &self,
        db: &Database,
        key_configured: bool,
    ) -> Result<GlobalStatsStatus, AppError> {
        let (settings, totals, patches) = db.with_connection(|conn| {
            let settings = store::settings(conn)?;
            let totals = store::totals(conn, &settings)?;
            Ok((settings, totals, store::patch_samples(conn)?))
        })?;
        let run = self
            .snapshot()
            .ok_or_else(|| AppError::State("stato della raccolta non disponibile".to_string()))?;
        Ok(GlobalStatsStatus {
            enabled: settings.enabled,
            state: run.state,
            platform: settings.platform,
            seed_tier: settings.seed_tier,
            message: run.message,
            session_matches: run.session_matches,
            last_activity_ms: run.last_activity_ms,
            total_matches: totals.total_matches,
            patches,
            seed_players: totals.seed_players,
            seeds_refreshed_at: totals.seeds_refreshed_at,
            last_fetched_at: totals.last_fetched_at,
            key_configured,
        })
    }
}

fn now_epoch_seconds() -> i64 {
    (now_ms() / 1000) as i64
}

/// Runs one step and returns how long to wait before the next one.
async fn tick(app: &AppHandle) -> Duration {
    let service = app.state::<GlobalStatsService>();
    let slot = app.state::<DatabaseSlot>();
    let Ok(db) = slot.get() else {
        return KEY_WAIT;
    };
    let settings: Settings = match db.with_connection(|conn| store::settings(conn)) {
        Ok(settings) => settings,
        Err(error) => {
            log::warn!("Impostazioni statistiche globali non leggibili: {error}");
            return OTHER_WAIT;
        }
    };
    if service.is_paused() {
        return PAUSE_WAIT;
    }
    let client = app.state::<AppRiotClient>();
    service.update(|run| {
        run.state = "collecting".to_string();
        run.message = None;
    });

    let keep_going = || service.is_enabled() && !service.is_paused();
    match collector::step(&client, db, &settings, now_epoch_seconds(), &keep_going).await {
        Ok(outcome) => {
            if outcome.new_matches > 0 {
                log::info!(
                    "Statistiche globali: {} partite nuove ({}, {})",
                    outcome.new_matches,
                    settings.platform,
                    settings.seed_tier
                );
            }
            let idle = !outcome.worked;
            service.update(|run| {
                run.session_matches += outcome.new_matches as u64;
                run.last_activity_ms = Some(now_ms());
                run.state = if idle { "idle" } else { "collecting" }.to_string();
                run.message = idle.then(|| {
                    "Tutti i giocatori della classifica sono stati letti di recente: nuova lettura tra qualche minuto."
                        .to_string()
                });
            });
            if idle {
                IDLE_WAIT
            } else {
                Duration::ZERO
            }
        }
        Err(error) => {
            let message = error.user_message();
            let wait = match &error {
                AppError::RateLimited { retry_after_secs } => {
                    Duration::from_secs((*retry_after_secs).max(5))
                }
                AppError::RiotKey(_) => KEY_WAIT,
                AppError::Network { .. } => NETWORK_WAIT,
                _ => OTHER_WAIT,
            };
            let state = if matches!(error, AppError::RateLimited { .. }) {
                "waiting"
            } else {
                "error"
            };
            let _ = error.logged();
            service.update(|run| {
                run.state = state.to_string();
                run.message = Some(message);
            });
            wait
        }
    }
}

pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let service = app.state::<GlobalStatsService>();
            let wait = if service.is_enabled() {
                let wait = tick(&app).await;
                if !service.is_enabled() {
                    // Turned off while the step was running.
                    service.update(|run| {
                        run.state = "disabled".to_string();
                        run.message = None;
                    });
                }
                wait
            } else {
                // Sleep until enabled.
                Duration::from_secs(24 * 3600)
            };
            if wait.is_zero() {
                continue;
            }
            tokio::select! {
                () = tokio::time::sleep(wait) => {}
                () = service.wake.notified() => {}
            }
        }
    });
}
