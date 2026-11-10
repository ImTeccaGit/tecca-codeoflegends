mod analysis;
mod backup;
mod catalog;
mod client;
mod commands;
mod db;
mod ddragon;
mod error;
mod jungle;
mod live;
mod meta;
mod models;
mod riot;
#[cfg(test)]
mod test_support;

use tauri::Manager;
use tauri_plugin_log::{RotationStrategy, Target, TargetKind, TimezoneStrategy};

/// Dimensione massima di un file di log prima della rotazione (1 MB).
const LOG_MAX_FILE_SIZE: u128 = 1_000_000;
/// File di log ruotati conservati oltre a quello corrente.
const LOG_KEEP_FILES: usize = 5;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            // Log solo locali: file ruotati in %LOCALAPPDATA%\<identifier>\logs
            // e stdout durante lo sviluppo. Nessuna telemetria remota.
            tauri_plugin_log::Builder::new()
                .clear_targets()
                .target(Target::new(TargetKind::LogDir {
                    file_name: Some("tecca-codeoflegends".into()),
                }))
                .target(Target::new(TargetKind::Stdout))
                .level(log::LevelFilter::Info)
                .max_file_size(LOG_MAX_FILE_SIZE)
                .rotation_strategy(RotationStrategy::KeepSome(LOG_KEEP_FILES))
                .timezone_strategy(TimezoneStrategy::UseUtc)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(
            // Registered from Rust only: the webview has no shortcut permission.
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        if let Err(error) = live::window::toggle_board(app) {
                            log::warn!("Pannello partita non commutato: {error}");
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            log::info!("Avvio TECCA CODEOFLEGENDS v{}", app.package_info().version);

            let slot = match open_database(app.handle()) {
                Ok(database) => db::DatabaseSlot::Ready(database),
                Err(error) => {
                    // L'app resta aperta: la UI mostra un errore esplicito.
                    log::error!("Apertura del database locale non riuscita: {error}");
                    db::DatabaseSlot::Unavailable {
                        log_dir: commands::log_directory(app.handle()),
                    }
                }
            };
            let database_ready = matches!(slot, db::DatabaseSlot::Ready(_));

            app.manage(slot);
            app.manage(ddragon::sync::DataDragonSync::default());

            // Riot API: key from RIOT_API_KEY or the OS credential store only.
            let transport = riot::transport::ReqwestTransport::new()
                .map_err(|error| format!("client HTTP Riot non inizializzato: {error}"))?;
            app.manage(riot::client::RiotClient::new(
                transport,
                riot::secrets::KeyProvider::from_process_env(riot::secrets::OsCredentialStore),
                riot::rate_limit::RateLimiter::development(),
            ));
            app.manage(riot::sync::SyncLocks::default());

            // Live Game: opt-in (off by default). Overlay restored if it was
            // left visible. Without a database both stay off.
            let (live_enabled, overlay_settings) = match slot_ref(app.handle()) {
                Some(db) => db
                    .with_connection(|conn| {
                        Ok((
                            live::repository::live_enabled(conn)?,
                            live::repository::overlay_settings(conn)?,
                        ))
                    })
                    .unwrap_or_else(|error| {
                        log::warn!("Preferenze Live non leggibili: {error}");
                        (false, live::overlay::OverlaySettings::default())
                    }),
                None => (false, live::overlay::OverlaySettings::default()),
            };
            app.manage(live::service::LiveService::new(live_enabled));

            // Riot account from the local League client (read-only, no key).
            let client_enabled = slot_ref(app.handle())
                .map(|db| db.with_connection(|conn| client::repository::sync_enabled(conn)))
                .transpose()
                .unwrap_or_else(|error| {
                    log::warn!("Preferenza client League non leggibile: {error}");
                    Some(false)
                })
                .unwrap_or(false);
            app.manage(client::service::ClientService::new(client_enabled));
            if database_ready {
                client::service::spawn(app.handle().clone());
            }
            app.manage(live::window::OverlayWindowState::default());
            app.manage(live::board::BoardService::default());
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                if let Err(error) = app.global_shortcut().register(live::window::BOARD_SHORTCUT) {
                    // Another program may own the combination: the button in
                    // the Live Game page still works.
                    log::warn!("Tasto rapido del pannello partita non registrato: {error}");
                }
            }
            live::service::spawn(app.handle().clone());
            if overlay_settings.visible {
                if let Err(error) = live::window::apply(app.handle(), &overlay_settings) {
                    log::warn!("Overlay non ripristinato: {error}");
                }
            }

            // Statistiche globali: raccolta opt-in con la chiave dell'utente.
            let global_enabled = slot_ref(app.handle())
                .map(|db| db.with_connection(|conn| meta::store::settings(conn)))
                .transpose()
                .unwrap_or_else(|error| {
                    log::warn!("Preferenza statistiche globali non leggibile: {error}");
                    None
                })
                .is_some_and(|settings| settings.enabled);
            app.manage(meta::service::GlobalStatsService::new(global_enabled));
            if database_ready {
                meta::service::spawn(app.handle().clone());
            }

            // Controllo periodico delle nuove versioni Data Dragon (dati
            // pubblici, nessuna chiave). Senza database non c'è dove salvarle.
            if database_ready {
                ddragon::sync::spawn_scheduler(app.handle().clone());
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                if window.label() == live::window::OVERLAY_LABEL {
                    // Closing the overlay from its title bar = "hide overlay".
                    api.prevent_close();
                    commands::hide_overlay(app);
                } else if window.label() == live::window::BOARD_LABEL {
                    api.prevent_close();
                    live::window::close_board(app);
                } else if window.label() == "main" {
                    // Overlay and board never outlive the main window.
                    live::window::close(app);
                    live::window::close_board(app);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_system_snapshot,
            commands::update_settings,
            commands::get_champion_catalog,
            commands::get_champion_detail,
            commands::get_catalog_status,
            commands::sync_data_dragon,
            commands::set_champion_favorite,
            commands::set_champion_lanes,
            commands::list_jungle_routes,
            commands::save_jungle_route,
            commands::delete_jungle_route,
            commands::list_clear_attempts,
            commands::save_clear_attempt,
            commands::delete_clear_attempt,
            commands::get_riot_key_status,
            commands::set_riot_api_key,
            commands::clear_riot_api_key,
            commands::verify_riot_api_key,
            commands::search_player,
            commands::sync_player,
            commands::get_player_profile,
            commands::get_primary_profile,
            commands::list_saved_profiles,
            commands::save_player_profile,
            commands::remove_player_profile,
            commands::delete_player_data,
            commands::get_match_analysis,
            commands::create_database_backup,
            commands::list_database_backups,
            commands::get_client_account_status,
            commands::set_client_sync_enabled,
            commands::sync_from_client,
            commands::set_league_install_path,
            commands::get_live_snapshot,
            commands::set_live_enabled,
            commands::get_overlay_settings,
            commands::update_overlay_settings,
            commands::get_global_stats_status,
            commands::update_global_stats_settings,
            commands::clear_global_stats,
            commands::get_champion_global_stats,
            commands::get_champion_roles,
            commands::get_live_board,
            commands::toggle_live_board,
            commands::is_live_board_open
        ])
        .run(tauri::generate_context!())
        .expect("Errore durante l'avvio di Tecca CodeOfLegends");
}

fn slot_ref(app: &tauri::AppHandle) -> Option<&db::Database> {
    app.try_state::<db::DatabaseSlot>()
        .and_then(|slot| slot.inner().get().ok())
}

fn open_database(app: &tauri::AppHandle) -> Result<db::Database, error::AppError> {
    let data_dir = app.path().app_data_dir()?;
    let database_path = data_dir.join("tecca-codeoflegends.sqlite3");
    let database = db::Database::open(database_path)?;
    log::info!("Database locale pronto (schema aggiornato, WAL attivo).");
    Ok(database)
}

#[cfg(test)]
mod release_tests {
    //! Release guards: one version everywhere, production config sane.

    fn json(text: &str) -> serde_json::Value {
        serde_json::from_str(text).expect("valid JSON")
    }

    #[test]
    fn version_is_identical_in_cargo_tauri_and_npm() {
        let tauri = json(include_str!("../tauri.conf.json"));
        let npm = json(include_str!("../../package.json"));
        let cargo = env!("CARGO_PKG_VERSION");
        assert_eq!(tauri["version"], cargo);
        assert_eq!(npm["version"], cargo);
    }

    #[test]
    fn production_config_is_locked_down() {
        let tauri = json(include_str!("../tauri.conf.json"));
        assert_eq!(tauri["productName"], "TECCA CODEOFLEGENDS");
        let csp = tauri["app"]["security"]["csp"].as_str().expect("csp");
        assert!(
            !csp.contains("localhost:1420"),
            "dev server in production CSP"
        );
        assert!(!csp.contains("'unsafe-eval'"));
        assert!(tauri["app"]["security"]
            .get("dangerousDisableAssetCspModification")
            .is_none());
        assert_eq!(tauri["bundle"]["windows"]["allowDowngrades"], false);

        for capability in [
            include_str!("../capabilities/default.json"),
            include_str!("../capabilities/overlay.json"),
        ] {
            let text = capability.to_string();
            for forbidden in ["shell:", "fs:", "core:default", "process:", "http:"] {
                assert!(
                    !text.contains(forbidden),
                    "permesso non minimo: {forbidden}"
                );
            }
        }
    }
}
