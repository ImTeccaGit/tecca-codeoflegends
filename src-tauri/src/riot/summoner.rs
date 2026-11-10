//! SUMMONER-V4 (platform-scoped): level and profile icon for a PUUID, plus
//! LOL-STATUS-V4 used to verify a key without touching player data.

use serde::Deserialize;

use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::routing::{encode_segment, is_platform, platform_host};
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summoner {
    pub profile_icon_id: i64,
    pub summoner_level: i64,
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

pub async fn by_puuid<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
) -> Result<Summoner, AppError> {
    require_platform(platform)?;
    let url = format!(
        "{}/lol/summoner/v4/summoners/by-puuid/{}",
        platform_host(platform),
        encode_segment(puuid)
    );
    client
        .get_json(platform, &url)
        .await
        .map_err(|error| match error {
            AppError::NotFound(_) => AppError::NotFound(
                "L'account esiste ma non ha un profilo League of Legends in questa regione."
                    .to_string(),
            ),
            other => other,
        })
}

/// Cheapest authenticated call: checks that the key works.
pub async fn platform_status<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
) -> Result<(), AppError> {
    require_platform(platform)?;
    let url = format!("{}/lol/status/v4/platform-data", platform_host(platform));
    client.get_text(platform, &url).await.map(|_| ())
}
