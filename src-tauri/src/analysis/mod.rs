//! Match Analysis & Matchups (post-game only).
//!
//! The backend returns the player's stored matches enriched with the facts
//! the analysis needs (lane opponent, teams, bans, items). Aggregations and
//! filters are pure TypeScript functions (`src/features/analysis/lib`), so
//! the same numbers feed tables, cards and charts.

pub mod dto;
pub mod repository;

#[cfg(test)]
mod tests;
