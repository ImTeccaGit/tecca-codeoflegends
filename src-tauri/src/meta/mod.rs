//! Global champion statistics (runes, items, summoner spells, matchups)
//! collected by the app with the user's own Riot API key.
//!
//! * `collector` league-v4 ladders → match-v5 Ranked Solo/Duo matches
//! * `store`     SQLite writes, settings and seed players
//! * `stats`     per-champion aggregations computed from stored rows
//! * `service`   opt-in background loop and its status
//! * `static_data` names and icons Data Dragon does not import (shards, spells)
//!
//! Only official Riot APIs: no scraping, no third-party statistics sites.
//! Percentages are always computed from stored matches, never estimated.

pub mod collector;
pub mod dto;
pub mod service;
pub mod static_data;
pub mod stats;
pub mod store;

#[cfg(test)]
mod tests;

pub const SOURCE_LABEL: &str = "Riot API (league-v4, match-v5)";
