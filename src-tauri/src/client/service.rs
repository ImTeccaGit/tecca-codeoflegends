//! Automatic account detection from the League client.
//!
//! Every 30 s (when enabled) the loop looks for the client's lockfile. When
//! the client is running it synchronizes on each new client session and then
//! every 10 minutes. Live Client data seen during a game is used as a
//! fallback to remember the player's Riot ID (no stats without the client).

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::Notify;

use crate::client::lockfile;
use crate::client::repository as client_repository;
use crate::client::source::HttpClientSource;
use crate::client::sync::{self, ClientAccount};
use crate::db::DatabaseSlot;
use crate::error::AppError;

pub const CLIENT_UPDATE_EVENT: &str = "client-account-updated";
const CHECK_INTERVAL: Duration = Duration::from_secs(30);
const RESYNC_AFTER: Duration = Duration::from_secs(600);

/// "disabled" | "not_found" | "not_running" | "syncing" | "connected" | "error".
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientStatus {
    pub enabled: bool,
    pub state: String,
    pub install_path: Option<String>,
    pub account: Option<ClientAccount>,
    /// Epoch milliseconds of the last successful synchronization.
    pub last_sync_ms: Option<u64>,
    pub new_matches: usize,
    pub message: Option<String>,
    pub detected_riot_id: Option<client_repository::DetectedRiotId>,
}

impl ClientStatus {
    fn initial(enabled: bool) -> Self {
        Self {
            enabled,
            state: if enabled { "not_running" } else { "disabled" }.to_string(),
            install_path: None,
            account: None,
            last_sync_ms: None,
            new_matches: 0,
            message: None,
            detected_riot_id: None,
        }
    }
}

pub struct ClientService {
    enabled: AtomicBool,
    syncing: AtomicBool,
    status: Mutex<ClientStatus>,
    session: Mutex<Option<(u32, Instant)>>,
    wake: Notify,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

impl ClientService {
    pub fn new(enabled: bool) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
            syncing: AtomicBool::new(false),
            status: Mutex::new(ClientStatus::initial(enabled)),
            session: Mutex::new(None),
            wake: Notify::new(),
        }
    }

    pub fn status(&self) -> ClientStatus {
        self.status
            .lock()
            .map(|status| status.clone())
            .unwrap_or_else(|_| ClientStatus::initial(false))
    }

    fn update(&self, change: impl FnOnce(&mut ClientStatus)) -> ClientStatus {
        match self.status.lock() {
            Ok(mut status) => {
                change(&mut status);
                status.clone()
            }
            Err(_) => ClientStatus::initial(false),
        }
    }

    pub fn set_enabled(&self, enabled: bool) -> ClientStatus {
        self.enabled.store(enabled, Ordering::SeqCst);
        if enabled {
            self.reset_session();
            self.wake.notify_one();
        }
        self.update(|status| {
            status.enabled = enabled;
            if !enabled {
                status.state = "disabled".to_string();
                status.message = None;
            }
        })
    }

    /// Forces a synchronization at the next check.
    pub fn reset_session(&self) {
        if let Ok(mut session) = self.session.lock() {
            *session = None;
        }
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::SeqCst)
    }
}

fn emit(app: &AppHandle, status: &ClientStatus) {
    if let Err(error) = app.emit(CLIENT_UPDATE_EVENT, status) {
        log::warn!("Evento {CLIENT_UPDATE_EVENT} non inviato: {error}");
    }
}

fn detected(app: &AppHandle) -> Option<client_repository::DetectedRiotId> {
    app.state::<DatabaseSlot>()
        .get()
        .and_then(|db| db.with_connection(|conn| client_repository::detected_riot_id(conn)))
        .ok()
        .flatten()
}

/// One check. `force` ignores the session/interval rules (manual button).
pub async fn check(app: &AppHandle, force: bool) -> Result<ClientStatus, AppError> {
    let service = app.state::<ClientService>();
    let detected_id = detected(app);
    if !service.is_enabled() && !force {
        return Ok(service.update(|status| {
            status.state = "disabled".to_string();
            status.detected_riot_id = detected_id;
        }));
    }

    let database = app.state::<DatabaseSlot>();
    let db = database.get()?;
    let override_path = db.with_connection(|conn| client_repository::install_path(conn))?;
    let Some(install) = lockfile::find_install_dir(override_path.as_deref()) else {
        return Ok(service.update(|status| {
            status.state = "not_found".to_string();
            status.install_path = None;
            status.message = Some(if override_path.is_some() {
                "La cartella indicata non contiene più League of Legends.".to_string()
            } else {
                "Installazione di League of Legends non trovata: indica la cartella in Impostazioni.".to_string()
            });
            status.detected_riot_id = detected_id;
        }));
    };
    let install_text = install.to_string_lossy().into_owned();

    let Some(lock) = lockfile::read(&install) else {
        if let Ok(mut session) = service.session.lock() {
            *session = None;
        }
        return Ok(service.update(|status| {
            status.state = "not_running".to_string();
            status.install_path = Some(install_text);
            status.message = Some("Client di League of Legends chiuso: apri il client per aggiornare account e partite.".to_string());
            status.detected_riot_id = detected_id;
        }));
    };

    let due = force
        || match service.session.lock().ok().and_then(|session| *session) {
            Some((pid, at)) => pid != lock.pid || at.elapsed() >= RESYNC_AFTER,
            None => true,
        };
    if !due {
        return Ok(service.status());
    }
    if service.syncing.swap(true, Ordering::SeqCst) {
        return Err(AppError::Busy(
            "Lettura dal client già in corso.".to_string(),
        ));
    }
    let syncing = service.update(|status| {
        status.state = "syncing".to_string();
        status.install_path = Some(install_text.clone());
    });
    emit(app, &syncing);

    let result = match HttpClientSource::new(&lock) {
        Ok(source) => sync::sync(db, &source).await,
        Err(error) => Err(AppError::State(error)),
    };
    service.syncing.store(false, Ordering::SeqCst);

    let status = match result {
        Ok(outcome) => {
            for warning in &outcome.warnings {
                log::warn!("Client League: {warning}");
            }
            log::info!(
                "Client League: account {}#{} ({}), {} partite nuove, {} code classificate",
                outcome.account.game_name,
                outcome.account.tag_line,
                outcome.account.region,
                outcome.new_matches,
                outcome.ranked_queues
            );
            if let Ok(mut session) = service.session.lock() {
                *session = Some((lock.pid, Instant::now()));
            }
            service.update(|status| {
                status.state = "connected".to_string();
                status.account = Some(outcome.account);
                status.last_sync_ms = Some(now_ms());
                status.new_matches = outcome.new_matches;
                status.message = (!outcome.warnings.is_empty()).then(|| {
                    "Account aggiornato; alcuni dati non erano disponibili (dettaglio nei log)."
                        .to_string()
                });
                status.detected_riot_id = detected_id;
            })
        }
        Err(error) => {
            let message = error.user_message();
            let error = error.logged();
            // Retry at the next check instead of waiting 10 minutes.
            service.reset_session();
            let status = service.update(|status| {
                status.state = if matches!(error, AppError::NotFound(_)) {
                    "not_running"
                } else {
                    "error"
                }
                .to_string();
                status.message = Some(message);
                status.detected_riot_id = detected_id;
            });
            emit(app, &status);
            return Err(error);
        }
    };
    emit(app, &status);
    Ok(status)
}

/// Remembers the Riot ID seen by the Live Client during a game.
pub fn remember_from_game(app: &AppHandle, riot_id: &str) {
    let changed = app.state::<DatabaseSlot>().get().and_then(|db| {
        db.with_connection(|conn| client_repository::remember_riot_id(conn, riot_id))
    });
    match changed {
        Ok(true) => {
            log::info!("Riot ID rilevato dalla partita in corso.");
            let detected_id = detected(app);
            let status = app
                .state::<ClientService>()
                .update(|status| status.detected_riot_id = detected_id);
            emit(app, &status);
        }
        Ok(false) => {}
        Err(error) => log::warn!("Riot ID dalla partita non salvato: {error}"),
    }
}

pub fn spawn(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let service = app.state::<ClientService>();
            if service.is_enabled() {
                // Errors are already logged and stored in the status.
                let _ = check(&app, false).await;
            }
            tokio::select! {
                () = tokio::time::sleep(CHECK_INTERVAL) => {}
                () = service.wake.notified() => {}
            }
        }
    });
}
