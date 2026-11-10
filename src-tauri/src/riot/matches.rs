//! MATCH-V5 (regional clusters): match ids by PUUID and match details.

use serde::Deserialize;

use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::routing::{encode_segment, match_region, regional_host, Regional};
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchDto {
    pub metadata: MatchMetadata,
    pub info: MatchInfo,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchMetadata {
    pub match_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchInfo {
    /// Epoch milliseconds.
    pub game_creation: i64,
    /// Seconds when `game_end_timestamp` is present, milliseconds before
    /// that field existed (Riot docs).
    pub game_duration: i64,
    #[serde(default)]
    pub game_end_timestamp: Option<i64>,
    #[serde(default)]
    pub game_mode: String,
    #[serde(default)]
    pub game_version: String,
    #[serde(default)]
    pub map_id: i64,
    #[serde(default)]
    pub queue_id: i64,
    pub participants: Vec<Participant>,
    #[serde(default)]
    pub teams: Vec<Team>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Team {
    pub team_id: i64,
    pub bans: Vec<Ban>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Ban {
    pub champion_id: i64,
    pub pick_turn: i64,
}

impl MatchInfo {
    pub fn duration_seconds(&self) -> i64 {
        if self.game_end_timestamp.is_some() {
            self.game_duration
        } else {
            self.game_duration / 1000
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Participant {
    /// 1–10, links the participant to timeline events.
    pub participant_id: i64,
    pub puuid: String,
    pub riot_id_game_name: Option<String>,
    pub riot_id_tagline: Option<String>,
    pub champion_id: i64,
    pub champion_name: String,
    pub team_id: i64,
    pub team_position: String,
    pub win: bool,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub total_minions_killed: i64,
    pub neutral_minions_killed: i64,
    pub gold_earned: i64,
    pub vision_score: i64,
    pub champ_level: i64,
    pub total_damage_dealt_to_champions: i64,
    pub total_damage_taken: Option<i64>,
    pub item0: i64,
    pub item1: i64,
    pub item2: i64,
    pub item3: i64,
    pub item4: i64,
    pub item5: i64,
    pub item6: i64,
    pub summoner1_id: i64,
    pub summoner2_id: i64,
    pub game_ended_in_early_surrender: bool,
    pub perks: Perks,
}

impl Participant {
    /// Item slots 0–6 (6 = trinket), 0 = empty.
    pub fn items(&self) -> [i64; 7] {
        [
            self.item0, self.item1, self.item2, self.item3, self.item4, self.item5, self.item6,
        ]
    }

    pub fn creep_score(&self) -> i64 {
        self.total_minions_killed + self.neutral_minions_killed
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct Perks {
    #[serde(rename = "statPerks")]
    pub stat_perks: StatPerks,
    pub styles: Vec<PerkStyle>,
}

/// Rune shards; 0 = missing.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct StatPerks {
    pub offense: i64,
    pub flex: i64,
    pub defense: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PerkStyle {
    pub description: String,
    pub style: i64,
    pub selections: Vec<PerkSelection>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct PerkSelection {
    pub perk: i64,
}

fn region(platform: &str) -> Result<Regional, AppError> {
    match_region(platform)
        .ok_or_else(|| AppError::Validation(format!("regione non supportata: {platform}")))
}

/// Most recent match ids, newest first.
pub async fn ids_by_puuid<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
    count: u32,
) -> Result<Vec<String>, AppError> {
    let region = region(platform)?;
    let url = format!(
        "{}/lol/match/v5/matches/by-puuid/{}/ids?start=0&count={}",
        regional_host(region),
        encode_segment(puuid),
        count.clamp(1, 100)
    );
    client.get_json(region.as_str(), &url).await
}

/// MATCH-V5 timeline: only the events used by the statistics.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TimelineDto {
    pub info: TimelineInfo,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TimelineInfo {
    pub frames: Vec<TimelineFrame>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct TimelineFrame {
    pub events: Vec<TimelineEvent>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct TimelineEvent {
    #[serde(rename = "type")]
    pub kind: String,
    /// Milliseconds from the start of the game.
    pub timestamp: i64,
    pub participant_id: i64,
    pub item_id: i64,
    pub skill_slot: i64,
    pub level_up_type: String,
    pub before_id: i64,
}

/// Match timeline (skill level-ups and item purchases).
pub async fn timeline_by_id<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    match_id: &str,
) -> Result<TimelineDto, AppError> {
    let region = region(platform)?;
    let url = format!(
        "{}/lol/match/v5/matches/{}/timeline",
        regional_host(region),
        encode_segment(match_id)
    );
    client.get_json(region.as_str(), &url).await
}

/// Ranked Solo/Duo (queue 420) match ids since `start_time` (epoch
/// seconds), newest first.
pub async fn ranked_solo_ids<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
    start_time: i64,
    count: u32,
) -> Result<Vec<String>, AppError> {
    let region = region(platform)?;
    let url = format!(
        "{}/lol/match/v5/matches/by-puuid/{}/ids?queue=420&type=ranked&startTime={}&start=0&count={}",
        regional_host(region),
        encode_segment(puuid),
        start_time.max(0),
        count.clamp(1, 100)
    );
    client.get_json(region.as_str(), &url).await
}

/// Match detail: parsed DTO plus the original JSON for local storage.
pub async fn by_id<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    match_id: &str,
) -> Result<(MatchDto, String), AppError> {
    let region = region(platform)?;
    let url = format!(
        "{}/lol/match/v5/matches/{}",
        regional_host(region),
        encode_segment(match_id)
    );
    let raw = client.get_text(region.as_str(), &url).await?;
    let parsed = serde_json::from_str(&raw).map_err(|error| AppError::SourceData {
        source_name: crate::riot::client::SOURCE_NAME,
        detail: format!("partita {match_id}: {error}"),
    })?;
    Ok((parsed, raw))
}
