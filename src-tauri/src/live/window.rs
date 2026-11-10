//! Overlay window management (separate Tauri window, label `overlay`).
//!
//! * "overlay" mode: transparent, no decorations, always on top, hidden from
//!   the taskbar, never focused and click-through (`set_ignore_cursor_events`).
//!   It does not receive mouse or keyboard input, so it cannot interact with
//!   the game. No injection: it is an ordinary top-level desktop window.
//! * "window" mode: normal decorated window, not on top, not click-through.
//! * Hidden = window destroyed: no webview, no CPU or memory used.

use std::sync::Mutex;

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppError;
use crate::live::overlay::{position, Area, OverlaySettings};

pub const OVERLAY_LABEL: &str = "overlay";
pub const OVERLAY_SETTINGS_EVENT: &str = "overlay-settings-updated";

/// Mode of the currently open overlay window (transparency and decorations
/// are fixed at creation, so a mode change recreates the window).
#[derive(Default)]
pub struct OverlayWindowState {
    mode: Mutex<Option<String>>,
}

fn monitor_area(app: &AppHandle) -> Option<Area> {
    let monitor = app
        .get_webview_window("main")
        .and_then(|main| main.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten())?;
    let scale = monitor.scale_factor();
    let size = monitor.size().to_logical::<f64>(scale);
    let origin = monitor.position().to_logical::<f64>(scale);
    Some(Area {
        x: origin.x,
        y: origin.y,
        width: size.width,
        height: size.height,
    })
}

pub fn close(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        if let Err(error) = window.destroy() {
            log::warn!("Chiusura overlay non riuscita: {error}");
        }
    }
    if let Some(state) = app.try_state::<OverlayWindowState>() {
        if let Ok(mut mode) = state.mode.lock() {
            *mode = None;
        }
    }
}

/// Opens, updates or closes the overlay window to match `settings`.
pub fn apply(app: &AppHandle, settings: &OverlaySettings) -> Result<(), AppError> {
    if !settings.visible {
        close(app);
        return Ok(());
    }

    let state = app.state::<OverlayWindowState>();
    let current_mode = state
        .mode
        .lock()
        .map_err(|_| AppError::State("stato overlay non disponibile".to_string()))?
        .clone();

    let area = monitor_area(app);
    let (x, y) = area.map_or((100.0, 100.0), |area| position(settings, area));
    let size = LogicalSize::new(f64::from(settings.width), f64::from(settings.height));

    if let Some(window) = app.get_webview_window(OVERLAY_LABEL) {
        if current_mode.as_deref() == Some(settings.mode.as_str()) {
            window.set_size(size)?;
            if settings.is_click_through() {
                window.set_position(LogicalPosition::new(x, y))?;
            }
            return Ok(());
        }
        close(app);
    }

    let click_through = settings.is_click_through();
    let window =
        WebviewWindowBuilder::new(app, OVERLAY_LABEL, WebviewUrl::App("index.html".into()))
            .title("TECCA CODEOFLEGENDS — Overlay")
            .inner_size(size.width, size.height)
            .position(x, y)
            .decorations(!click_through)
            .transparent(click_through)
            .shadow(!click_through)
            .always_on_top(click_through)
            .skip_taskbar(click_through)
            .resizable(!click_through)
            .focused(!click_through)
            .maximizable(false)
            .minimizable(!click_through)
            .background_color(tauri::window::Color(0, 0, 0, 0))
            .build()?;

    if click_through {
        window.set_ignore_cursor_events(true)?;
    }

    if let Ok(mut mode) = state.mode.lock() {
        *mode = Some(settings.mode.clone());
    }
    log::info!(
        "Overlay aperto in modalità {} ({}x{})",
        settings.mode,
        settings.width,
        settings.height
    );
    Ok(())
}

/* In-game board ("pannello partita") ------------------------------------- */

pub const BOARD_LABEL: &str = "board";
/// Global shortcut that shows/hides the board (registered in `lib.rs`).
pub const BOARD_SHORTCUT: &str = "Home";
const BOARD_WIDTH: f64 = 1180.0;
const BOARD_HEIGHT: f64 = 640.0;

pub fn close_board(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BOARD_LABEL) {
        if let Err(error) = window.destroy() {
            log::warn!("Chiusura pannello partita non riuscita: {error}");
        }
    }
}

pub fn is_board_open(app: &AppHandle) -> bool {
    app.get_webview_window(BOARD_LABEL).is_some()
}

/// Opens the board centered on the monitor of the main window. Same rules
/// as the overlay: transparent, always on top, never focused, click-through
/// (it cannot receive input, so it cannot interact with the game).
pub fn open_board(app: &AppHandle) -> Result<(), AppError> {
    if is_board_open(app) {
        return Ok(());
    }
    let area = monitor_area(app);
    let width = area.map_or(BOARD_WIDTH, |area| BOARD_WIDTH.min(area.width - 40.0));
    let height = area.map_or(BOARD_HEIGHT, |area| BOARD_HEIGHT.min(area.height - 80.0));
    let (x, y) = area.map_or((60.0, 60.0), |area| {
        (
            area.x + (area.width - width) / 2.0,
            area.y + (area.height - height) / 2.0,
        )
    });
    let window = WebviewWindowBuilder::new(app, BOARD_LABEL, WebviewUrl::App("index.html".into()))
        .title("TECCA CODEOFLEGENDS — Pannello partita")
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .focused(false)
        .maximizable(false)
        .minimizable(false)
        .background_color(tauri::window::Color(0, 0, 0, 0))
        .build()?;
    window.set_ignore_cursor_events(true)?;
    log::info!("Pannello partita aperto ({width:.0}x{height:.0})");
    Ok(())
}

/// Puts the open board back at the top of the always-on-top windows (a
/// borderless game can cover it after taking focus). Never focuses it.
pub fn raise_board(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(BOARD_LABEL) {
        if let Err(error) = window.set_always_on_top(true) {
            log::warn!("Pannello partita non riportato in primo piano: {error}");
        }
    }
}

/// Shows the board if hidden, hides it if shown. Returns the new state.
pub fn toggle_board(app: &AppHandle) -> Result<bool, AppError> {
    if is_board_open(app) {
        close_board(app);
        Ok(false)
    } else {
        open_board(app)?;
        Ok(true)
    }
}
