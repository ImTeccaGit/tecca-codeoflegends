//! Match Analysis contracts (camelCase). Mirrored by Zod in
//! `src/types/analysis.ts`. Every value comes from stored match-v5 responses;
//! fields Riot did not return stay `None` and are shown as unavailable.

use serde::Serialize;

use crate::riot::dto::{RankedEntry, RuneRef};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChampionRef {
    pub champion_id: i64,
    pub champion_name: String,
    pub image_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisItem {
    pub id: i64,
    pub name: Option<String>,
    pub image_url: Option<String>,
    /// Final item per Data Dragon (no upgrade, ≥ 900 gold, not consumable).
    pub completed: bool,
}

/// The direct lane opponent: same `teamPosition` on the enemy team.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaneOpponent {
    pub champion: ChampionRef,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: i64,
    pub gold_earned: i64,
    pub vision_score: i64,
    pub damage_dealt: Option<i64>,
    pub damage_taken: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisMatch {
    pub match_id: String,
    pub queue_id: i64,
    pub game_mode: Option<String>,
    pub game_version: Option<String>,
    /// "major.minor" derived from `game_version` (e.g. "14.23").
    pub patch: Option<String>,
    /// ISO 8601 UTC.
    pub played_at: String,
    pub duration_seconds: i64,
    pub ended_early: bool,
    pub win: bool,
    pub champion: ChampionRef,
    pub team_position: Option<String>,
    pub champ_level: Option<i64>,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: i64,
    pub gold_earned: i64,
    pub vision_score: i64,
    pub damage_dealt: Option<i64>,
    pub damage_taken: Option<i64>,
    /// Kills of the player's team (for kill participation).
    pub team_kills: i64,
    pub items: Vec<AnalysisItem>,
    pub keystone: Option<RuneRef>,
    pub secondary_style: Option<RuneRef>,
    pub opponent: Option<LaneOpponent>,
    pub allies: Vec<ChampionRef>,
    pub enemies: Vec<ChampionRef>,
    /// Champion ids banned by either team.
    pub bans: Vec<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisDataset {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
    pub region: String,
    pub source: String,
    pub matches_synced_at: Option<String>,
    /// Current ranked entries (league-v4). match-v5 has no per-match tier.
    pub ranked: Vec<RankedEntry>,
    /// Newest first.
    pub matches: Vec<AnalysisMatch>,
}
