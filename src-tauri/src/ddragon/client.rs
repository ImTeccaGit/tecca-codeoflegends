//! HTTP access to the public Data Dragon CDN. No API key is involved.
//! Requests are sequential, have timeouts and a small bounded retry with
//! backoff for transient failures only.

use std::time::Duration;

use serde::de::DeserializeOwned;

use crate::ddragon::bundle::{build_bundle, newest_release, PatchBundle};
use crate::ddragon::model::{ChampionFullFile, ItemFile, RawRuneTree};
use crate::ddragon::{DDRAGON_BASE_URL, LANGUAGE, SOURCE_NAME};
use crate::error::AppError;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
const MAX_ATTEMPTS: u32 = 3;
const RETRY_BASE_DELAY: Duration = Duration::from_secs(2);

pub struct DataDragonClient {
    http: reqwest::Client,
    base_url: String,
}

fn network(detail: impl Into<String>) -> AppError {
    AppError::Network {
        source_name: SOURCE_NAME,
        detail: detail.into(),
    }
}

impl DataDragonClient {
    pub fn new() -> Result<Self, AppError> {
        let http = reqwest::Client::builder()
            .user_agent(format!("TeccaCodeOfLegends/{}", env!("CARGO_PKG_VERSION")))
            .connect_timeout(CONNECT_TIMEOUT)
            .timeout(REQUEST_TIMEOUT)
            .build()
            .map_err(|error| network(format!("client HTTP non inizializzato: {error}")))?;

        Ok(Self {
            http,
            base_url: DDRAGON_BASE_URL.to_string(),
        })
    }

    pub fn versions_url(&self) -> String {
        format!("{}/api/versions.json", self.base_url)
    }

    pub fn data_url(&self, version: &str, file: &str) -> String {
        format!("{}/cdn/{version}/data/{LANGUAGE}/{file}", self.base_url)
    }

    /// Newest regular release listed in versions.json.
    pub async fn latest_version(&self) -> Result<String, AppError> {
        let versions: Vec<String> = self.get_json(&self.versions_url()).await?;
        newest_release(&versions).ok_or_else(|| AppError::SourceData {
            source_name: SOURCE_NAME,
            detail: "versions.json non contiene versioni valide".to_string(),
        })
    }

    /// Downloads and validates champions (full), items and runes for a version.
    pub async fn fetch_bundle(&self, version: &str) -> Result<PatchBundle, AppError> {
        let champions: ChampionFullFile = self
            .get_json(&self.data_url(version, "championFull.json"))
            .await?;
        let items: ItemFile = self.get_json(&self.data_url(version, "item.json")).await?;
        let runes: Vec<RawRuneTree> = self
            .get_json(&self.data_url(version, "runesReforged.json"))
            .await?;

        build_bundle(version, LANGUAGE, champions, items, runes)
    }

    async fn get_json<T: DeserializeOwned>(&self, url: &str) -> Result<T, AppError> {
        let mut attempt = 1;

        loop {
            match self.try_get_bytes(url).await {
                Ok(bytes) => {
                    return serde_json::from_slice(&bytes).map_err(|error| AppError::SourceData {
                        source_name: SOURCE_NAME,
                        detail: format!("JSON non valido da {url}: {error}"),
                    });
                }
                Err((error, retryable)) if retryable && attempt < MAX_ATTEMPTS => {
                    let delay = RETRY_BASE_DELAY * attempt;
                    log::warn!(
                        "Data Dragon: tentativo {attempt}/{MAX_ATTEMPTS} fallito ({error}), nuovo tentativo tra {}s",
                        delay.as_secs()
                    );
                    tokio::time::sleep(delay).await;
                    attempt += 1;
                }
                Err((error, _)) => return Err(error),
            }
        }
    }

    /// Returns the body, or the error plus whether retrying makes sense.
    async fn try_get_bytes(&self, url: &str) -> Result<Vec<u8>, (AppError, bool)> {
        let response = self.http.get(url).send().await.map_err(|error| {
            let retryable = error.is_timeout() || error.is_connect() || error.is_request();
            (network(format!("{url}: {error}")), retryable)
        })?;

        let status = response.status();
        if !status.is_success() {
            let retryable = status.is_server_error() || status.as_u16() == 429;
            return Err((network(format!("{url}: HTTP {status}")), retryable));
        }

        response
            .bytes()
            .await
            .map(|bytes| bytes.to_vec())
            .map_err(|error| (network(format!("{url}: lettura risposta: {error}")), true))
    }
}
