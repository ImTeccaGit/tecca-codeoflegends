//! Overlay settings: validation, merge and pure placement.
//!
//! The overlay is a separate Tauri window (see `window.rs`). In "overlay"
//! mode it is transparent, always on top and click-through: it never
//! receives input, so it cannot interfere with the game.

use serde::{Deserialize, Serialize};

use crate::error::AppError;

pub const MODES: [&str; 2] = ["overlay", "window"];
pub const ANCHORS: [&str; 4] = ["top-left", "top-right", "bottom-left", "bottom-right"];
pub const THEMES: [&str; 3] = ["tecca", "minimal", "contrast"];

pub const WIDTH_RANGE: (u32, u32) = (200, 600);
pub const HEIGHT_RANGE: (u32, u32) = (80, 400);
pub const OFFSET_MAX: u32 = 2000;
pub const OPACITY_RANGE: (f64, f64) = (0.3, 1.0);

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlaySettings {
    pub visible: bool,
    pub mode: String,
    pub width: u32,
    pub height: u32,
    pub anchor: String,
    pub offset_x: u32,
    pub offset_y: u32,
    pub opacity: f64,
    pub theme: String,
}

impl Default for OverlaySettings {
    fn default() -> Self {
        Self {
            visible: false,
            mode: "overlay".to_string(),
            width: 300,
            height: 140,
            anchor: "top-right".to_string(),
            offset_x: 24,
            offset_y: 96,
            opacity: 0.92,
            theme: "tecca".to_string(),
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlayPatch {
    pub visible: Option<bool>,
    pub mode: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub anchor: Option<String>,
    pub offset_x: Option<u32>,
    pub offset_y: Option<u32>,
    pub opacity: Option<f64>,
    pub theme: Option<String>,
}

impl OverlayPatch {
    fn is_empty(&self) -> bool {
        self.visible.is_none()
            && self.mode.is_none()
            && self.width.is_none()
            && self.height.is_none()
            && self.anchor.is_none()
            && self.offset_x.is_none()
            && self.offset_y.is_none()
            && self.opacity.is_none()
            && self.theme.is_none()
    }
}

fn invalid(message: &str) -> AppError {
    AppError::Validation(message.to_string())
}

impl OverlaySettings {
    pub fn validate(&self) -> Result<(), AppError> {
        if !MODES.contains(&self.mode.as_str()) {
            return Err(invalid("modalità overlay non valida"));
        }
        if !ANCHORS.contains(&self.anchor.as_str()) {
            return Err(invalid("posizione overlay non valida"));
        }
        if !THEMES.contains(&self.theme.as_str()) {
            return Err(invalid("tema overlay non valido"));
        }
        if !(WIDTH_RANGE.0..=WIDTH_RANGE.1).contains(&self.width) {
            return Err(invalid("larghezza overlay fuori intervallo (200–600 px)"));
        }
        if !(HEIGHT_RANGE.0..=HEIGHT_RANGE.1).contains(&self.height) {
            return Err(invalid("altezza overlay fuori intervallo (80–400 px)"));
        }
        if self.offset_x > OFFSET_MAX || self.offset_y > OFFSET_MAX {
            return Err(invalid("margine overlay fuori intervallo (0–2000 px)"));
        }
        if !self.opacity.is_finite()
            || self.opacity < OPACITY_RANGE.0
            || self.opacity > OPACITY_RANGE.1
        {
            return Err(invalid("opacità overlay fuori intervallo (30–100%)"));
        }
        Ok(())
    }

    /// Applies a patch and validates the result. Never partially applied.
    pub fn merged(&self, patch: &OverlayPatch) -> Result<Self, AppError> {
        if patch.is_empty() {
            return Err(invalid("Nessuna impostazione overlay da aggiornare."));
        }
        let mut next = self.clone();
        if let Some(value) = patch.visible {
            next.visible = value;
        }
        if let Some(value) = &patch.mode {
            next.mode = value.clone();
        }
        if let Some(value) = patch.width {
            next.width = value;
        }
        if let Some(value) = patch.height {
            next.height = value;
        }
        if let Some(value) = &patch.anchor {
            next.anchor = value.clone();
        }
        if let Some(value) = patch.offset_x {
            next.offset_x = value;
        }
        if let Some(value) = patch.offset_y {
            next.offset_y = value;
        }
        if let Some(value) = patch.opacity {
            next.opacity = value;
        }
        if let Some(value) = &patch.theme {
            next.theme = value.clone();
        }
        next.validate()?;
        Ok(next)
    }

    pub fn is_click_through(&self) -> bool {
        self.mode == "overlay"
    }
}

/// Monitor area in logical pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Area {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Top-left corner of the overlay inside `area`, clamped so the window always
/// stays fully on that monitor.
pub fn position(settings: &OverlaySettings, area: Area) -> (f64, f64) {
    let width = f64::from(settings.width).min(area.width);
    let height = f64::from(settings.height).min(area.height);
    let offset_x = f64::from(settings.offset_x);
    let offset_y = f64::from(settings.offset_y);

    let (raw_x, raw_y) = match settings.anchor.as_str() {
        "top-left" => (offset_x, offset_y),
        "bottom-left" => (offset_x, area.height - height - offset_y),
        "bottom-right" => (
            area.width - width - offset_x,
            area.height - height - offset_y,
        ),
        _ => (area.width - width - offset_x, offset_y),
    };

    let x = raw_x.clamp(0.0, (area.width - width).max(0.0));
    let y = raw_y.clamp(0.0, (area.height - height).max(0.0));
    (area.x + x, area.y + y)
}
