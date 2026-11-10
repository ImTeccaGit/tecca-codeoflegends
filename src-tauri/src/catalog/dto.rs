//! Contracts serialized to the frontend (camelCase). Mirrored by Zod schemas
//! in `src/types/catalog.ts`.

use serde::Serialize;

use crate::ddragon::model::{ChampionInfo, ChampionStats};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchSummary {
    /// Full Data Dragon version, e.g. "16.22.1".
    pub version: String,
    /// Game patch label, e.g. "16.22".
    pub patch: String,
    pub language: String,
    pub source: String,
    pub source_url: String,
    pub imported_at: String,
    pub champion_count: i64,
    pub spell_count: i64,
    pub skin_count: i64,
    pub item_count: i64,
    pub rune_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionListItem {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub title: String,
    pub tags: Vec<String>,
    pub image_url: String,
    /// User data: marked as favorite.
    pub favorite: bool,
    /// User data: lanes assigned by the user (Data Dragon has none).
    pub lanes: Vec<String>,
}

/// User preferences for one champion, returned after every change.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionPreferences {
    pub champion_id: i64,
    pub favorite: bool,
    pub lanes: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionCatalog {
    pub patch: Option<PatchSummary>,
    pub champions: Vec<ChampionListItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionSpell {
    /// "P" (passive), "Q", "W", "E" or "R".
    pub slot: String,
    pub key: String,
    pub name: String,
    pub description: String,
    pub cooldown: Option<String>,
    pub cost: Option<String>,
    pub range: Option<String>,
    pub max_rank: Option<i64>,
    pub image_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionSkin {
    pub id: i64,
    pub num: i64,
    pub name: String,
    pub has_chromas: bool,
    pub splash_url: String,
    pub loading_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionDetail {
    pub id: i64,
    pub key: String,
    pub name: String,
    pub title: String,
    pub blurb: String,
    pub lore: String,
    pub tags: Vec<String>,
    pub partype: String,
    pub info: ChampionInfo,
    pub stats: ChampionStats,
    pub image_url: String,
    pub splash_url: String,
    pub spells: Vec<ChampionSpell>,
    pub skins: Vec<ChampionSkin>,
    pub patch: PatchSummary,
    pub favorite: bool,
    pub lanes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckRecord {
    pub checked_at: String,
    pub latest_version: Option<String>,
    /// "up_to_date", "imported" or "failed".
    pub outcome: String,
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogStatus {
    pub current: Option<PatchSummary>,
    /// Newest first. Older versions are kept for historical matches.
    pub versions: Vec<PatchSummary>,
    pub last_check: Option<CheckRecord>,
    pub syncing: bool,
    pub check_interval_hours: u32,
}

/// Result of the post-import integrity verification.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IntegrityReport {
    pub version: String,
    pub champion_count: i64,
    pub spell_count: i64,
    pub skin_count: i64,
    pub item_count: i64,
    pub rune_tree_count: i64,
    pub rune_count: i64,
    pub problems: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncOutcome {
    /// "up_to_date" or "imported".
    pub outcome: String,
    pub version: String,
    pub patch: Option<PatchSummary>,
}
