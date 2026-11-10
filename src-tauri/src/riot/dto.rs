//! Riot player contracts (camelCase). Mirrored by Zod in `src/types/riot.ts`.

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyStatus {
    pub configured: bool,
    /// "environment" or "credential_store". The key itself is never sent.
    pub source: Option<String>,
    /// True when RIOT_API_KEY is set: it takes precedence over the stored key.
    pub environment_overrides: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncState {
    pub profile_synced_at: Option<String>,
    pub ranked_synced_at: Option<String>,
    pub matches_synced_at: Option<String>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankedEntry {
    pub queue_type: String,
    pub tier: String,
    pub division: Option<String>,
    pub league_points: i64,
    pub wins: i64,
    pub losses: i64,
    pub hot_streak: bool,
    pub fetched_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemSlot {
    pub id: i64,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuneRef {
    pub id: i64,
    pub name: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerMatch {
    pub match_id: String,
    pub queue_id: i64,
    pub game_mode: Option<String>,
    pub game_version: Option<String>,
    /// ISO 8601 UTC.
    pub played_at: String,
    pub duration_seconds: i64,
    pub ended_early: bool,
    pub win: bool,
    pub champion_id: i64,
    pub champion_name: Option<String>,
    pub champion_image_url: Option<String>,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: i64,
    pub gold_earned: i64,
    pub vision_score: i64,
    pub champ_level: Option<i64>,
    pub team_position: Option<String>,
    pub damage_to_champions: Option<i64>,
    pub items: Vec<ItemSlot>,
    pub keystone: Option<RuneRef>,
    pub secondary_style: Option<RuneRef>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProfile {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub region: String,
    pub summoner_level: Option<i64>,
    pub profile_icon_url: Option<String>,
    pub saved: bool,
    pub primary: bool,
    pub sync: SyncState,
    pub ranked: Vec<RankedEntry>,
    /// Newest first.
    pub matches: Vec<PlayerMatch>,
    pub source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileSummary {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub region: String,
    pub summoner_level: Option<i64>,
    pub profile_icon_url: Option<String>,
    pub primary: bool,
    pub solo_queue: Option<RankedEntry>,
    pub match_count: i64,
    pub matches_synced_at: Option<String>,
}
