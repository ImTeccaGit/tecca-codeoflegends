//! ACCOUNT-V1: Riot ID ⇄ PUUID. Accounts are global; any cluster works.

use serde::Deserialize;

use crate::error::AppError;
use crate::riot::client::RiotClient;
use crate::riot::routing::{account_region, encode_segment, regional_host};
use crate::riot::secrets::SecretStore;
use crate::riot::transport::Transport;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub puuid: String,
    #[serde(default)]
    pub game_name: Option<String>,
    #[serde(default)]
    pub tag_line: Option<String>,
}

fn host(platform: &str) -> Result<(String, &'static str), AppError> {
    let region = account_region(platform)
        .ok_or_else(|| AppError::Validation(format!("regione non supportata: {platform}")))?;
    Ok((regional_host(region), region.as_str()))
}

pub async fn by_riot_id<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    game_name: &str,
    tag_line: &str,
) -> Result<Account, AppError> {
    let (host, limit_key) = host(platform)?;
    let url = format!(
        "{host}/riot/account/v1/accounts/by-riot-id/{}/{}",
        encode_segment(game_name),
        encode_segment(tag_line)
    );
    client
        .get_json(limit_key, &url)
        .await
        .map_err(|error| match error {
            AppError::NotFound(_) => AppError::NotFound(format!(
                "Nessun account Riot trovato per {game_name}#{tag_line}. Controlla nome e tag."
            )),
            other => other,
        })
}

pub async fn by_puuid<T: Transport, S: SecretStore>(
    client: &RiotClient<T, S>,
    platform: &str,
    puuid: &str,
) -> Result<Account, AppError> {
    let (host, limit_key) = host(platform)?;
    let url = format!(
        "{host}/riot/account/v1/accounts/by-puuid/{}",
        encode_segment(puuid)
    );
    client.get_json(limit_key, &url).await
}
