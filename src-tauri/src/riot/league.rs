//! LEAGUE-V4 (platform-scoped): ranked entries (Solo/Duo, Flex) by PUUID.

use serde::Deserialize;

use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::routing::{encode_segment, is_platform, platform_host};
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LeagueEntry {
    pub queue_type: String,
    pub tier: String,
    /// "I".."IV"; absent for Master and above in some responses.
    #[serde(default)]
    pub rank: Option<String>,
    pub league_points: i64,
    pub wins: i64,
    pub losses: i64,
    #[serde(default)]
    pub hot_streak: bool,
}

pub async fn entries_by_puuid<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
) -> Result<Vec<LeagueEntry>, AppError> {
    if !is_platform(platform) {
        return Err(AppError::Validation(format!(
            "regione non supportata: {platform}"
        )));
    }
    let url = format!(
        "{}/lol/league/v4/entries/by-puuid/{}",
        platform_host(platform),
        encode_segment(puuid)
    );
    client.get_json(platform, &url).await
}

/// One player of a ranked ladder (apex league or tier/division page). Riot
/// returns the PUUID since 2024; entries without it are skipped.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LadderEntry {
    #[serde(default)]
    pub puuid: Option<String>,
    #[serde(default)]
    pub league_points: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct LeagueList {
    #[serde(default)]
    pub entries: Vec<LadderEntry>,
}

/// Apex leagues of Ranked Solo/Duo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApexLeague {
    Challenger,
    Grandmaster,
    Master,
}

impl ApexLeague {
    fn path(self) -> &'static str {
        match self {
            Self::Challenger => "challengerleagues",
            Self::Grandmaster => "grandmasterleagues",
            Self::Master => "masterleagues",
        }
    }
}

fn require_platform(platform: &str) -> Result<(), AppError> {
    if is_platform(platform) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "regione non supportata: {platform}"
        )))
    }
}

/// Every player of an apex league (Ranked Solo/Duo).
pub async fn apex_league<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    league: ApexLeague,
) -> Result<Vec<LadderEntry>, AppError> {
    require_platform(platform)?;
    let url = format!(
        "{}/lol/league/v4/{}/by-queue/RANKED_SOLO_5x5",
        platform_host(platform),
        league.path()
    );
    let list: LeagueList = client.get_json(platform, &url).await?;
    Ok(list.entries)
}

/// One page of a tier/division below Master (Ranked Solo/Duo). `tier` and
/// `division` must be Riot values ("DIAMOND", "I").
pub async fn ladder_page<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    tier: &str,
    division: &str,
    page: u32,
) -> Result<Vec<LadderEntry>, AppError> {
    require_platform(platform)?;
    let valid_tier = [
        "DIAMOND", "EMERALD", "PLATINUM", "GOLD", "SILVER", "BRONZE", "IRON",
    ]
    .contains(&tier);
    if !valid_tier || !["I", "II", "III", "IV"].contains(&division) {
        return Err(AppError::Validation(format!(
            "fascia non valida: {tier} {division}"
        )));
    }
    let url = format!(
        "{}/lol/league/v4/entries/RANKED_SOLO_5x5/{tier}/{division}?page={}",
        platform_host(platform),
        page.max(1)
    );
    client.get_json(platform, &url).await
}
