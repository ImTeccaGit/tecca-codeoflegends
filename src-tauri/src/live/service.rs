//! Live Game service: opt-in polling of the local Live Client Data API.
//!
//! * Disabled by default: when off, no request is made at all.
//! * Polls every 2 s in game, every 5 s otherwise.
//! * Emits `live-game-update` to all windows only when the content changes.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;

use crate::live::model::LiveSnapshot;
use crate::live::snapshot::poll_once;
use crate::live::source::{HttpLiveSource, LiveSource};

pub const LIVE_UPDATE_EVENT: &str = "live-game-update";
pub const IN_GAME_INTERVAL: Duration = Duration::from_secs(2);
pub const IDLE_INTERVAL: Duration = Duration::from_secs(5);

pub struct LiveService {
    enabled: AtomicBool,
    latest: Mutex<LiveSnapshot>,
    wake: Notify,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

impl LiveService {
    pub fn new(enabled: bool) -> Self {
        let initial = if enabled {
            LiveSnapshot::with_status("not_running", Some("In attesa del primo controllo."))
        } else {
            disabled_snapshot()
        };
        Self {
            enabled: AtomicBool::new(enabled),
            latest: Mutex::new(initial),
            wake: Notify::new(),
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }

    pub fn latest(&self) -> LiveSnapshot {
        self.latest
            .lock()
            .map(|snapshot| snapshot.clone())
            .unwrap_or_else(|_| LiveSnapshot::with_status("error", Some("Stato non disponibile.")))
    }

    /// Turns detection on/off. Returns the new current snapshot.
    pub fn set_enabled(&self, enabled: bool) -> LiveSnapshot {
        self.enabled.store(enabled, Ordering::SeqCst);
        let snapshot = if enabled {
            LiveSnapshot::with_status("not_running", Some("In attesa del primo controllo."))
        } else {
            disabled_snapshot()
        };
        self.store(snapshot.clone());
        if enabled {
            self.wake.notify_one();
        }
        snapshot
    }

    fn store(&self, snapshot: LiveSnapshot) {
        if let Ok(mut latest) = self.latest.lock() {
            *latest = snapshot;
        }
    }

    /// One iteration. Returns the snapshot when its content changed (to be
    /// emitted), `None` when disabled or unchanged. No request when disabled.
    pub async fn tick<S: LiveSource>(&self, source: &S) -> Option<LiveSnapshot> {
        if !self.is_enabled() {
            return None;
        }
        let mut snapshot = poll_once(source).await;
        // Disabled while the request was in flight: drop the result.
        if !self.is_enabled() {
            return None;
        }
        snapshot.updated_at_ms = now_ms();
        let changed = !self.latest().same_content(&snapshot);
        self.store(snapshot.clone());
        changed.then_some(snapshot)
    }

    pub fn next_interval(&self) -> Duration {
        if self.latest().status == "in_game" {
            IN_GAME_INTERVAL
        } else {
            IDLE_INTERVAL
        }
    }

    async fn wait_until_enabled(&self) {
        while !self.is_enabled() {
            self.wake.notified().await;
        }
    }
}

pub fn disabled_snapshot() -> LiveSnapshot {
    LiveSnapshot::with_status(
        "disabled",
        Some("Rilevamento disattivato: nessuna richiesta al client di gioco."),
    )
}

/// Background loop. Sleeps on a notification while disabled (zero requests).
pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let source = match HttpLiveSource::new() {
            Ok(source) => source,
            Err(error) => {
                log::error!("Live Client Data API non inizializzabile: {error}");
                return;
            }
        };
        loop {
            let service = app.state::<LiveService>();
            service.wait_until_enabled().await;
            if let Some(snapshot) = service.tick(&source).await {
                log::info!("Live Game: stato {}", snapshot.status);
                // Fallback account detection: the player's own Riot ID.
                if let Some(player) = &snapshot.player {
                    crate::client::service::remember_from_game(&app, &player.riot_id);
                }
                if let Err(error) = app.emit(LIVE_UPDATE_EVENT, &snapshot) {
                    log::warn!("Evento {LIVE_UPDATE_EVENT} non inviato: {error}");
                }
                crate::live::board::on_snapshot(&app, &snapshot);
            }
            let interval = service.next_interval();
            tokio::select! {
                () = tokio::time::sleep(interval) => {}
                () = service.wake.notified() => {}
            }
        }
    });
}
