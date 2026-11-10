//! Jungle contracts (camelCase). Mirrored by Zod in `src/types/jungle.ts`.

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomRoute {
    pub id: String,
    pub name: String,
    pub side: String,
    pub camps: Vec<String>,
    pub notes: Option<String>,
    pub champion_id: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteInput {
    /// Present when updating an existing custom route.
    pub id: Option<String>,
    pub name: String,
    pub side: String,
    pub camps: Vec<String>,
    pub notes: Option<String>,
    pub champion_id: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearSplit {
    pub step_index: i64,
    pub camp_id: String,
    /// Cumulative time from the start when this camp was completed.
    pub split_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearAttempt {
    pub id: i64,
    pub route_key: String,
    pub route_name: String,
    pub side: String,
    pub camps: Vec<String>,
    pub total_ms: i64,
    pub champion_id: Option<i64>,
    pub champion_name: Option<String>,
    pub created_at: String,
    pub splits: Vec<ClearSplit>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AttemptInput {
    /// Model route key (e.g. "blue-full-red-start") or custom route id.
    pub route_key: String,
    pub route_name: String,
    pub side: String,
    pub camps: Vec<String>,
    /// Cumulative split per camp, same length and order as `camps`.
    pub splits_ms: Vec<i64>,
    pub champion_id: Option<i64>,
}
