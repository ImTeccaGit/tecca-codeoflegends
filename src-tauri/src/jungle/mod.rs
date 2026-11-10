//! Jungle training: custom routes and timed clear attempts.
//!
//! Everything here is user-generated practice data. There is no live game
//! integration: no game timers, no detection, no hidden information.

pub mod dto;
pub mod repository;

#[cfg(test)]
mod tests;

/// Camp identifiers accepted in routes and attempts. Mirrors
/// `src/features/jungle/data/camps.ts`; scuttles live in the river.
pub const CAMP_IDS: [&str; 14] = [
    "blue-blue",
    "blue-gromp",
    "blue-wolves",
    "blue-raptors",
    "blue-red",
    "blue-krugs",
    "red-blue",
    "red-gromp",
    "red-wolves",
    "red-raptors",
    "red-red",
    "red-krugs",
    "scuttle-top",
    "scuttle-bot",
];

pub const SIDES: [&str; 2] = ["blue", "red"];

/// Longest practice clear accepted (30 minutes).
pub const MAX_CLEAR_MS: i64 = 30 * 60 * 1000;
pub const MAX_NAME_LENGTH: usize = 60;
pub const MAX_NOTES_LENGTH: usize = 500;
