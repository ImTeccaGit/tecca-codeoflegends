use tauri::{AppHandle, Emitter, Manager, State};

use crate::db::Database;
use crate::{
    analysis::{dto::AnalysisDataset, repository as analysis_repository},
    backup::BackupInfo,
    catalog::{
        dto::{CatalogStatus, ChampionCatalog, ChampionDetail, ChampionPreferences, SyncOutcome},
        preferences, repository,
    },
    client::{
        repository as client_repository,
        service::{self as client_service, ClientService, ClientStatus},
    },
    db::DatabaseSlot,
    ddragon::sync::{self, DataDragonSync, CHECK_INTERVAL_HOURS},
    error::AppError,
    jungle::{
        dto::{AttemptInput, ClearAttempt, CustomRoute, RouteInput},
        repository as jungle_repository,
    },
    live::{
        board::{BoardService, LiveBoard},
        model::LiveSnapshot,
        overlay::{OverlayPatch, OverlaySettings},
        repository as live_repository,
        service::{LiveService, LIVE_UPDATE_EVENT},
        window::{self as overlay_window, OVERLAY_SETTINGS_EVENT},
    },
    meta::{
        dto::{ChampionGlobalStats, ChampionRolesOverview, GlobalStatsStatus},
        service::GlobalStatsService,
        stats as meta_stats, store as meta_store,
    },
    models::{AppSettings, ServiceStatus, SettingsPatch, SystemSnapshot},
    riot::{
        dto::{KeyStatus, PlayerProfile, ProfileSummary},
        repository as riot_repository,
        secrets::KeySource,
        summoner as riot_summoner,
        sync::{self as riot_sync, SyncLocks},
        AppRiotClient,
    },
};

/// Longest Data Dragon champion id accepted from the UI.
const MAX_CHAMPION_KEY_LENGTH: usize = 64;

#[tauri::command]
pub fn get_champion_catalog(
    database: State<'_, DatabaseSlot>,
) -> Result<ChampionCatalog, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| repository::champion_catalog(conn)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn get_champion_detail(
    database: State<'_, DatabaseSlot>,
    key: String,
) -> Result<Option<ChampionDetail>, AppError> {
    let valid = !key.is_empty()
        && key.len() <= MAX_CHAMPION_KEY_LENGTH
        && key.chars().all(|c| c.is_ascii_alphanumeric());
    if !valid {
        return Err(
            AppError::Validation("identificativo campione non valido".to_string()).logged(),
        );
    }

    database
        .get()
        .and_then(|db| db.with_connection(|conn| repository::champion_detail(conn, &key)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn get_catalog_status(
    database: State<'_, DatabaseSlot>,
    sync_state: State<'_, DataDragonSync>,
) -> Result<CatalogStatus, AppError> {
    let syncing = sync_state.is_running();
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| {
                repository::catalog_status(conn, syncing, CHECK_INTERVAL_HOURS)
            })
        })
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn set_champion_favorite(
    database: State<'_, DatabaseSlot>,
    champion_id: i64,
    favorite: bool,
) -> Result<ChampionPreferences, AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| preferences::set_favorite(conn, champion_id, favorite))
        })
        .map_err(AppError::logged)
}

/// Lanes chosen by the user. Validated in Rust (allowed values, no duplicates).
#[tauri::command]
pub fn set_champion_lanes(
    database: State<'_, DatabaseSlot>,
    champion_id: i64,
    lanes: Vec<String>,
) -> Result<ChampionPreferences, AppError> {
    if lanes.len() > preferences::LANES.len() {
        return Err(AppError::Validation("troppe corsie indicate".to_string()).logged());
    }
    database
        .get()
        .and_then(|db| db.with_connection(|conn| preferences::set_lanes(conn, champion_id, &lanes)))
        .map_err(AppError::logged)
}

/* Jungle training (offline practice data, no live game access) ------------ */

#[tauri::command]
pub fn list_jungle_routes(database: State<'_, DatabaseSlot>) -> Result<Vec<CustomRoute>, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::list_routes(conn)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn save_jungle_route(
    database: State<'_, DatabaseSlot>,
    input: RouteInput,
) -> Result<CustomRoute, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::save_route(conn, &input)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn delete_jungle_route(database: State<'_, DatabaseSlot>, id: String) -> Result<(), AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::delete_route(conn, &id)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn list_clear_attempts(
    database: State<'_, DatabaseSlot>,
) -> Result<Vec<ClearAttempt>, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::list_attempts(conn)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn save_clear_attempt(
    database: State<'_, DatabaseSlot>,
    input: AttemptInput,
) -> Result<ClearAttempt, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::save_attempt(conn, &input)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn delete_clear_attempt(database: State<'_, DatabaseSlot>, id: i64) -> Result<(), AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| jungle_repository::delete_attempt(conn, id)))
        .map_err(AppError::logged)
}

/* Riot API (official endpoints only; the key never leaves Rust) ------------ */

fn key_status(client: &AppRiotClient) -> Result<KeyStatus, AppError> {
    let source = client.key_source()?;
    Ok(KeyStatus {
        configured: source.is_some(),
        source: source.map(|value| value.as_str().to_string()),
        environment_overrides: client.keys().environment_overrides(),
    })
}

#[tauri::command]
pub fn get_riot_key_status(riot: State<'_, AppRiotClient>) -> Result<KeyStatus, AppError> {
    key_status(&riot).map_err(AppError::logged)
}

/// Stores the key in the OS credential store. Write-only: never read back.
#[tauri::command]
pub fn set_riot_api_key(
    riot: State<'_, AppRiotClient>,
    key: String,
) -> Result<KeyStatus, AppError> {
    riot.keys()
        .save(&key)
        .and_then(|()| key_status(&riot))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn clear_riot_api_key(riot: State<'_, AppRiotClient>) -> Result<KeyStatus, AppError> {
    riot.keys()
        .clear()
        .and_then(|()| key_status(&riot))
        .map_err(AppError::logged)
}

/// Checks the configured key with lol-status-v4 (no player data involved).
#[tauri::command]
pub async fn verify_riot_api_key(
    riot: State<'_, AppRiotClient>,
    region: String,
) -> Result<(), AppError> {
    riot_summoner::platform_status(&riot, &region)
        .await
        .map_err(AppError::logged)
}

fn profile_or_missing(db: &Database, puuid: &str) -> Result<PlayerProfile, AppError> {
    db.with_connection(|conn| riot_repository::profile(conn, puuid))?
        .ok_or_else(|| AppError::NotFound("Profilo non presente in locale.".to_string()))
}

#[tauri::command]
pub async fn search_player(
    database: State<'_, DatabaseSlot>,
    riot: State<'_, AppRiotClient>,
    locks: State<'_, SyncLocks>,
    game_name: String,
    tag_line: String,
    region: String,
) -> Result<PlayerProfile, AppError> {
    async {
        let db = database.get()?;
        let puuid = riot_sync::search(&riot, db, &locks, &region, &game_name, &tag_line).await?;
        profile_or_missing(db, &puuid)
    }
    .await
    .map_err(AppError::logged)
}

#[tauri::command]
pub async fn sync_player(
    database: State<'_, DatabaseSlot>,
    riot: State<'_, AppRiotClient>,
    locks: State<'_, SyncLocks>,
    puuid: String,
    force: bool,
) -> Result<PlayerProfile, AppError> {
    async {
        let db = database.get()?;
        riot_sync::sync_player(&riot, db, &locks, &puuid, force).await?;
        profile_or_missing(db, &puuid)
    }
    .await
    .map_err(AppError::logged)
}

/// Local data only: no network request.
#[tauri::command]
pub fn get_player_profile(
    database: State<'_, DatabaseSlot>,
    puuid: String,
) -> Result<Option<PlayerProfile>, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| riot_repository::profile(conn, &puuid)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn get_primary_profile(
    database: State<'_, DatabaseSlot>,
) -> Result<Option<PlayerProfile>, AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| match riot_repository::primary_puuid(conn)? {
                Some(puuid) => riot_repository::profile(conn, &puuid),
                None => Ok(None),
            })
        })
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn list_saved_profiles(
    database: State<'_, DatabaseSlot>,
) -> Result<Vec<ProfileSummary>, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| riot_repository::saved_profiles(conn)))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn save_player_profile(
    database: State<'_, DatabaseSlot>,
    puuid: String,
    primary: bool,
) -> Result<(), AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| riot_repository::save_profile(conn, &puuid, primary))
        })
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn remove_player_profile(
    database: State<'_, DatabaseSlot>,
    puuid: String,
) -> Result<(), AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| riot_repository::remove_profile(conn, &puuid)))
        .map_err(AppError::logged)
}

/// Deletes all locally stored data of a player (privacy).
#[tauri::command]
pub fn delete_player_data(
    database: State<'_, DatabaseSlot>,
    puuid: String,
) -> Result<(), AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| riot_repository::delete_player_data(conn, &puuid)))
        .map_err(AppError::logged)
}

/* Riot account from the League client (read-only, no API key) ------------ */

#[tauri::command]
pub fn get_client_account_status(
    database: State<'_, DatabaseSlot>,
    client: State<'_, ClientService>,
) -> ClientStatus {
    let mut status = client.status();
    status.detected_riot_id = database
        .get()
        .and_then(|db| db.with_connection(|conn| client_repository::detected_riot_id(conn)))
        .ok()
        .flatten();
    status
}

#[tauri::command]
pub async fn set_client_sync_enabled(
    app: AppHandle,
    database: State<'_, DatabaseSlot>,
    client: State<'_, ClientService>,
    enabled: bool,
) -> Result<ClientStatus, AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| client_repository::set_sync_enabled(conn, enabled))
        })
        .map_err(AppError::logged)?;
    let status = client.set_enabled(enabled);
    if let Err(error) = app.emit(client_service::CLIENT_UPDATE_EVENT, &status) {
        log::warn!("Evento client non inviato: {error}");
    }
    Ok(status)
}

/// Manual "read from the client now" (works even when the automatic
/// detection is off: the user asked for it explicitly).
#[tauri::command]
pub async fn sync_from_client(app: AppHandle) -> Result<ClientStatus, AppError> {
    client_service::check(&app, true).await
}

#[tauri::command]
pub async fn set_league_install_path(
    app: AppHandle,
    database: State<'_, DatabaseSlot>,
    client: State<'_, ClientService>,
    path: Option<String>,
) -> Result<ClientStatus, AppError> {
    let path = path.filter(|value| !value.trim().is_empty());
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| client_repository::set_install_path(conn, path.as_deref()))
        })
        .map_err(AppError::logged)?;
    client.reset_session();
    match client_service::check(&app, false).await {
        Ok(status) => Ok(status),
        // The path was saved; a closed client is not an error here.
        Err(_) => Ok(client.status()),
    }
}

/* Database backups (local only) ------------------------------------------ */

#[tauri::command]
pub fn create_database_backup(database: State<'_, DatabaseSlot>) -> Result<BackupInfo, AppError> {
    database
        .get()
        .and_then(|db| db.create_backup("manual"))
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn list_database_backups(
    database: State<'_, DatabaseSlot>,
) -> Result<Vec<BackupInfo>, AppError> {
    database
        .get()
        .and_then(|db| db.backups())
        .map_err(AppError::logged)
}

/* Match Analysis & Matchups (stored match-v5 data, post-game only) ------- */

/// Local data only: no network request.
#[tauri::command]
pub fn get_match_analysis(
    database: State<'_, DatabaseSlot>,
    puuid: String,
) -> Result<Option<AnalysisDataset>, AppError> {
    if puuid.is_empty() || puuid.len() > 128 {
        return Err(AppError::Validation("PUUID non valido".to_string()).logged());
    }
    database
        .get()
        .and_then(|db| db.with_connection(|conn| analysis_repository::dataset(conn, &puuid)))
        .map_err(AppError::logged)
}

/* Live Game & overlay (local Live Client Data API, own data only) -------- */

#[tauri::command]
pub fn get_live_snapshot(live: State<'_, LiveService>) -> LiveSnapshot {
    live.latest()
}

/// Explicit opt-in: persisted first, then the polling loop is woken up.
#[tauri::command]
pub fn set_live_enabled(
    app: AppHandle,
    database: State<'_, DatabaseSlot>,
    live: State<'_, LiveService>,
    enabled: bool,
) -> Result<LiveSnapshot, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| live_repository::set_live_enabled(conn, enabled)))
        .map_err(AppError::logged)?;
    let snapshot = live.set_enabled(enabled);
    log::info!(
        "Rilevamento partita {}",
        if enabled { "attivato" } else { "disattivato" }
    );
    if let Err(error) = app.emit(LIVE_UPDATE_EVENT, &snapshot) {
        log::warn!("Evento {LIVE_UPDATE_EVENT} non inviato: {error}");
    }
    Ok(snapshot)
}

#[tauri::command]
pub fn get_overlay_settings(
    database: State<'_, DatabaseSlot>,
) -> Result<OverlaySettings, AppError> {
    database
        .get()
        .and_then(|db| db.with_connection(|conn| live_repository::overlay_settings(conn)))
        .map_err(AppError::logged)
}

fn store_and_apply_overlay(
    app: &AppHandle,
    patch: &OverlayPatch,
) -> Result<OverlaySettings, AppError> {
    let database = app.state::<DatabaseSlot>();
    let db = database.get()?;
    let next = db.with_connection(|conn| {
        let next = live_repository::overlay_settings(conn)?.merged(patch)?;
        live_repository::save_overlay_settings(conn, &next)?;
        Ok(next)
    })?;
    overlay_window::apply(app, &next)?;
    if let Err(error) = app.emit(OVERLAY_SETTINGS_EVENT, &next) {
        log::warn!("Evento {OVERLAY_SETTINGS_EVENT} non inviato: {error}");
    }
    Ok(next)
}

/// Async on purpose: creating a window from a sync command blocks the main
/// thread on Windows.
#[tauri::command]
pub async fn update_overlay_settings(
    app: AppHandle,
    patch: OverlayPatch,
) -> Result<OverlaySettings, AppError> {
    store_and_apply_overlay(&app, &patch).map_err(AppError::logged)
}

/// Overlay closed from its own title bar (window mode): persist as hidden.
pub fn hide_overlay(app: &AppHandle) {
    let patch = OverlayPatch {
        visible: Some(false),
        ..OverlayPatch::default()
    };
    if let Err(error) = store_and_apply_overlay(app, &patch) {
        log::warn!("Chiusura overlay non salvata: {error}");
        overlay_window::close(app);
    }
}

/// Manual "check now": same path as the background scheduler.
#[tauri::command]
pub async fn sync_data_dragon(app: AppHandle) -> Result<SyncOutcome, AppError> {
    sync::check_and_import(&app).await.map_err(AppError::logged)
}

/// Percorso della cartella log, se risolvibile su questa piattaforma.
pub fn log_directory(app: &AppHandle) -> Option<String> {
    app.path()
        .app_log_dir()
        .ok()
        .map(|dir| dir.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn get_system_snapshot(
    app: AppHandle,
    database: State<'_, DatabaseSlot>,
    riot: State<'_, AppRiotClient>,
    live: State<'_, LiveService>,
) -> Result<SystemSnapshot, AppError> {
    build_snapshot(&app, &database, &riot, &live).map_err(AppError::logged)
}

fn riot_service_status(riot: &AppRiotClient) -> ServiceStatus {
    match riot.key_source() {
        Ok(Some(source)) => ServiceStatus {
            state: "configured".to_string(),
            message: match source {
                KeySource::Environment => {
                    "Chiave API configurata tramite variabile d'ambiente RIOT_API_KEY.".to_string()
                }
                KeySource::CredentialStore => {
                    "Chiave API salvata nella Gestione credenziali di Windows.".to_string()
                }
            },
        },
        Ok(None) => ServiceStatus {
            state: "not_configured".to_string(),
            message: "Nessuna chiave API configurata: aggiungila in Impostazioni.".to_string(),
        },
        Err(error) => {
            log::warn!("Stato chiave Riot non leggibile: {error}");
            ServiceStatus {
                state: "error".to_string(),
                message: "Impossibile leggere l'archivio credenziali.".to_string(),
            }
        }
    }
}

fn live_service_status(live: &LiveService) -> ServiceStatus {
    let snapshot = live.latest();
    let state = match snapshot.status.as_str() {
        "disabled" => "disabled",
        "in_game" | "loading" => "running",
        "error" => "error",
        _ => "not_running",
    };
    ServiceStatus {
        state: state.to_string(),
        message: snapshot
            .message
            .unwrap_or_else(|| "Partita in corso: dati del giocatore locale.".to_string()),
    }
}

#[tauri::command]
pub fn update_settings(
    database: State<'_, DatabaseSlot>,
    patch: SettingsPatch,
) -> Result<AppSettings, AppError> {
    database
        .get()
        .and_then(|database| database.update_settings(&patch))
        .map_err(AppError::logged)
}

fn build_snapshot(
    app: &AppHandle,
    slot: &DatabaseSlot,
    riot: &AppRiotClient,
    live: &LiveService,
) -> Result<SystemSnapshot, AppError> {
    let database = slot.get()?;

    Ok(SystemSnapshot {
        runtime: "tauri".to_string(),
        app_version: app.package_info().version.to_string(),
        generated_at: database.now()?,
        log_directory: log_directory(app),
        database: database.status()?,
        riot: riot_service_status(riot),
        live_client: live_service_status(live),
        settings: database.settings()?,
        activity: database.recent_activity(8)?,
    })
}

/* Global champion statistics (opt-in, Riot API with the user's key) ------- */

fn key_configured(riot: &AppRiotClient) -> bool {
    matches!(riot.key_source(), Ok(Some(_)))
}

#[tauri::command]
pub fn get_global_stats_status(
    database: State<'_, DatabaseSlot>,
    service: State<'_, GlobalStatsService>,
    riot: State<'_, AppRiotClient>,
) -> Result<GlobalStatsStatus, AppError> {
    database
        .get()
        .and_then(|db| service.status(db, key_configured(&riot)))
        .map_err(AppError::logged)
}

/// Explicit opt-in: persisted first, then the collector is woken up.
#[tauri::command]
pub fn update_global_stats_settings(
    database: State<'_, DatabaseSlot>,
    service: State<'_, GlobalStatsService>,
    riot: State<'_, AppRiotClient>,
    enabled: bool,
    platform: String,
    seed_tier: String,
) -> Result<GlobalStatsStatus, AppError> {
    let result = (|| {
        if !crate::riot::routing::is_platform(&platform) {
            return Err(AppError::Validation(format!(
                "regione non supportata: {}",
                platform.chars().take(16).collect::<String>()
            )));
        }
        if !meta_store::SEED_TIERS.contains(&seed_tier.as_str()) {
            return Err(AppError::Validation("fascia non supportata".to_string()));
        }
        let db = database.get()?;
        let settings = meta_store::Settings {
            enabled,
            platform: platform.clone(),
            seed_tier: seed_tier.clone(),
        };
        db.with_connection(|conn| meta_store::save_settings(conn, &settings))?;
        if service.is_enabled() == enabled {
            service.nudge();
        } else {
            service.set_enabled(enabled);
        }
        log::info!(
            "Statistiche globali: raccolta {} ({platform}, {seed_tier})",
            if enabled { "attiva" } else { "disattivata" }
        );
        service.status(db, key_configured(&riot))
    })();
    result.map_err(AppError::logged)
}

/// Deletes every collected match and ladder (settings are kept).
#[tauri::command]
pub fn clear_global_stats(
    database: State<'_, DatabaseSlot>,
    service: State<'_, GlobalStatsService>,
    riot: State<'_, AppRiotClient>,
) -> Result<GlobalStatsStatus, AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(meta_store::clear)?;
            log::info!("Statistiche globali eliminate dall'utente");
            service.status(db, key_configured(&riot))
        })
        .map_err(AppError::logged)
}

#[tauri::command]
pub fn get_champion_global_stats(
    database: State<'_, DatabaseSlot>,
    champion_id: i64,
    patch: Option<String>,
    role: Option<String>,
) -> Result<ChampionGlobalStats, AppError> {
    if !(1..=1_000_000).contains(&champion_id) {
        return Err(AppError::Validation("campione non valido".to_string()).logged());
    }
    if let Some(patch) = &patch {
        let valid = patch == meta_stats::ALL_PATCHES
            || (patch.len() <= 8 && meta_store::patch_of(patch).as_deref() == Some(patch.as_str()));
        if !valid {
            return Err(AppError::Validation("patch non valida".to_string()).logged());
        }
    }
    if let Some(role) = &role {
        if !meta_store::ROLES.contains(&role.as_str()) {
            return Err(AppError::Validation("ruolo non valido".to_string()).logged());
        }
    }
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| {
                import_personal_matches(conn);
                meta_stats::champion_stats(conn, champion_id, patch.as_deref(), role.as_deref())
            })
        })
        .map_err(AppError::logged)
}

/// Best effort: a failed copy of the personal matches must not hide the
/// collected statistics (the error is logged).
fn import_personal_matches(conn: &mut rusqlite::Connection) {
    match meta_store::import_personal(conn) {
        Ok(0) => {}
        Ok(added) => log::info!("Statistiche: {added} partite personali aggiunte"),
        Err(error) => log::warn!("Partite personali non importate: {error}"),
    }
}

/// Lanes actually played by each champion (collected + personal matches).
#[tauri::command]
pub fn get_champion_roles(
    database: State<'_, DatabaseSlot>,
) -> Result<ChampionRolesOverview, AppError> {
    database
        .get()
        .and_then(|db| {
            db.with_connection(|conn| {
                import_personal_matches(conn);
                meta_stats::champion_roles(conn)
            })
        })
        .map_err(AppError::logged)
}

/* In-game board ---------------------------------------------------------- */

#[tauri::command]
pub fn get_live_board(board: State<'_, BoardService>) -> LiveBoard {
    board.latest()
}

/// Shows or hides the in-game board window. Returns whether it is open.
#[tauri::command]
pub fn toggle_live_board(app: AppHandle) -> Result<bool, AppError> {
    overlay_window::toggle_board(&app).map_err(AppError::logged)
}

#[tauri::command]
pub fn is_live_board_open(app: AppHandle) -> bool {
    overlay_window::is_board_open(&app)
}
