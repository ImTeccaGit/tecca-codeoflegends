//! Versioned static catalog (champions, spells, skins, items, runes) stored in
//! SQLite. `repository` owns every SQL statement; `dto` the frontend contracts.

pub mod dto;
pub mod preferences;
pub mod repository;

#[cfg(test)]
mod tests;
