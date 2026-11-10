//! Live Game & Desktop Overlay.
//!
//! Policy scope (Riot Developer Portal, General Policies and LoL policies):
//! * data source: only the documented local Live Client Data API
//!   (https://127.0.0.1:2999), read-only, opt-in, disabled by default;
//! * the local player's own stats; for the other players only the public
//!   identity of the scoreboard (`snapshot.rs`), plus their public Riot API
//!   profile looked up with the user's key in `board.rs` (approved by the
//!   user on 2026-11-10; anonymous players and bots are never looked up);
//! * no event feed, no timers, no cooldowns, no LCU, no memory reading,
//!   no injection, no game file changes, no input automation;
//! * overlay and board are separate click-through Tauri windows.
//!
//! Layout: `source` (transport) → `snapshot` (pure filtering) → `service`
//! (polling state + events) and `overlay` (settings) → `window` (Tauri window).

pub mod board;
pub mod model;
pub mod overlay;
pub mod repository;
pub mod service;
pub mod snapshot;
pub mod source;
pub mod window;

#[cfg(test)]
mod tests;
