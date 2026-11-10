//! Checks Data Dragon for new versions and imports them.
//!
//! * One sync at a time (`DataDragonSync` guard).
//! * Background scheduler: first check shortly after startup, then every
//!   `CHECK_INTERVAL_HOURS`. The last check time lives in SQLite, so restarts
//!   do not cause extra requests.
//! * Every check (success or failure) is recorded in `data_dragon_checks`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::catalog::dto::SyncOutcome;
use crate::catalog::repository;
use crate::db::DatabaseSlot;
use crate::ddragon::client::DataDragonClient;
use crate::error::AppError;

pub const CHECK_INTERVAL_HOURS: u32 = 6;
/// With no catalog yet, a failed first import is retried sooner.
const EMPTY_CATALOG_RETRY_MINUTES: f64 = 15.0;
/// After a failure with data already present.
const FAILED_RETRY_MINUTES: f64 = 60.0;
const STARTUP_DELAY: Duration = Duration::from_secs(5);
const SCHEDULER_TICK: Duration = Duration::from_secs(15 * 60);

/// Event emitted to the webview after a new patch has been imported.
pub const CATALOG_UPDATED_EVENT: &str = "catalog-updated";

#[derive(Default)]
pub struct DataDragonSync {
    running: AtomicBool,
}

struct RunningGuard<'a>(&'a AtomicBool);

impl Drop for RunningGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

impl DataDragonSync {
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    fn try_begin(&self) -> Result<RunningGuard<'_>, AppError> {
        self.running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .map(|_| RunningGuard(&self.running))
            .map_err(|_| AppError::Busy("Un aggiornamento Data Dragon è già in corso.".to_string()))
    }
}

/// Pure scheduling rule, kept separate for tests.
pub fn is_check_due(last: Option<(f64, &str)>, has_catalog: bool) -> bool {
    match last {
        None => true,
        Some((minutes, outcome)) => {
            let wait = if outcome == "failed" {
                if has_catalog {
                    FAILED_RETRY_MINUTES
                } else {
                    EMPTY_CATALOG_RETRY_MINUTES
                }
            } else if !has_catalog {
                EMPTY_CATALOG_RETRY_MINUTES
            } else {
                f64::from(CHECK_INTERVAL_HOURS) * 60.0
            };
            minutes >= wait
        }
    }
}

fn with_db<T>(
    app: &AppHandle,
    operation: impl FnOnce(&mut rusqlite::Connection) -> Result<T, AppError>,
) -> Result<T, AppError> {
    app.state::<DatabaseSlot>()
        .get()?
        .with_connection(operation)
}

/// Checks for a new version and imports it. Safe to call concurrently: a
/// second call while one is running returns `AppError::Busy`.
pub async fn check_and_import(app: &AppHandle) -> Result<SyncOutcome, AppError> {
    let sync = app.state::<DataDragonSync>();
    let _guard = sync.try_begin()?;

    let result = run(app).await;

    if let Err(error) = &result {
        let detail = error.to_string();
        if let Err(record_error) = with_db(app, |conn| {
            repository::record_check(conn, None, "failed", Some(&detail))
        }) {
            log::warn!("Data Dragon: impossibile registrare il controllo fallito: {record_error}");
        }
    }

    result
}

async fn run(app: &AppHandle) -> Result<SyncOutcome, AppError> {
    let client = DataDragonClient::new()?;
    let latest = client.latest_version().await?;

    if with_db(app, |conn| repository::version_exists(conn, &latest))? {
        with_db(app, |conn| {
            repository::record_check(conn, Some(&latest), "up_to_date", None)
        })?;
        log::info!("Data Dragon: versione {latest} già presente.");
        let patch = with_db(app, |conn| repository::patch_summary(conn, &latest))?;
        return Ok(SyncOutcome {
            outcome: "up_to_date".to_string(),
            version: latest,
            patch,
        });
    }

    log::info!("Data Dragon: nuova versione {latest}, download in corso.");
    let bundle = client.fetch_bundle(&latest).await?;
    let source_url = client.data_url(&latest, "championFull.json");

    let handle = app.clone();
    let report = tauri::async_runtime::spawn_blocking(move || {
        with_db(&handle, |conn| {
            repository::import_bundle(conn, &bundle, &source_url)
        })
    })
    .await
    .map_err(|error| AppError::State(format!("import interrotto: {error}")))??;

    let summary = format!(
        "{} campioni, {} abilità, {} skin, {} oggetti, {} rune",
        report.champion_count,
        report.spell_count,
        report.skin_count,
        report.item_count,
        report.rune_count
    );
    log::info!("Data Dragon: patch {latest} importata ({summary}).");

    with_db(app, |conn| {
        repository::record_check(conn, Some(&latest), "imported", Some(&summary))
    })?;
    if let Ok(database) = app.state::<DatabaseSlot>().get() {
        if let Err(error) = database.log_activity(
            "database",
            &format!("Dati Data Dragon {latest} importati"),
            Some(&summary),
        ) {
            log::warn!("Activity log non aggiornato: {error}");
        }
    }

    if let Err(error) = app.emit(CATALOG_UPDATED_EVENT, &latest) {
        log::warn!("Evento {CATALOG_UPDATED_EVENT} non inviato: {error}");
    }

    let patch = with_db(app, |conn| repository::patch_summary(conn, &latest))?;
    Ok(SyncOutcome {
        outcome: "imported".to_string(),
        version: latest,
        patch,
    })
}

fn check_due_now(app: &AppHandle) -> Result<bool, AppError> {
    with_db(app, |conn| {
        let last = repository::last_check_age(conn)?;
        let has_catalog = repository::current_version(conn)?.is_some();
        Ok(is_check_due(
            last.as_ref()
                .map(|(minutes, outcome)| (*minutes, outcome.as_str())),
            has_catalog,
        ))
    })
}

/// Background loop: periodic checks for new Data Dragon versions.
pub fn spawn_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_DELAY).await;

        loop {
            match check_due_now(&app) {
                Ok(true) => match check_and_import(&app).await {
                    Ok(outcome) => log::info!(
                        "Controllo Data Dragon automatico: {} ({})",
                        outcome.outcome,
                        outcome.version
                    ),
                    Err(AppError::Busy(_)) => {}
                    Err(error) => log::warn!("Controllo Data Dragon automatico fallito: {error}"),
                },
                Ok(false) => {}
                Err(error) => log::warn!("Pianificazione Data Dragon non disponibile: {error}"),
            }

            tokio::time::sleep(SCHEDULER_TICK).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_run_is_always_due() {
        assert!(is_check_due(None, false));
        assert!(is_check_due(None, true));
    }

    #[test]
    fn regular_interval_after_success() {
        assert!(!is_check_due(Some((60.0, "up_to_date")), true));
        assert!(is_check_due(Some((6.0 * 60.0, "imported")), true));
    }

    #[test]
    fn failures_retry_sooner_without_catalog() {
        assert!(is_check_due(Some((16.0, "failed")), false));
        assert!(!is_check_due(Some((16.0, "failed")), true));
        assert!(is_check_due(Some((61.0, "failed")), true));
    }

    #[test]
    fn guard_rejects_concurrent_sync() {
        let sync = DataDragonSync::default();
        let guard = sync.try_begin().expect("first");
        assert!(sync.is_running());
        assert!(matches!(sync.try_begin(), Err(AppError::Busy(_))));
        drop(guard);
        assert!(!sync.is_running());
        assert!(sync.try_begin().is_ok());
    }
}
