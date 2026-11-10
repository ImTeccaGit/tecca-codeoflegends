//! Riot API client: authentication, rate limiting, retries and error mapping.
//! The API services (`account`, `summoner`, `league`, `matches`) build URLs
//! and call `get_json` / `get_text`; they never handle HTTP details.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;

use crate::error::AppError;
use crate::riot::rate_limit::RateLimiter;
use crate::riot::secrets::{KeyProvider, KeySource, SecretStore};
use crate::riot::transport::Transport;

pub const SOURCE_NAME: &str = "Riot API";
const MAX_ATTEMPTS: u32 = 3;
/// Longer waits are returned to the user as a rate-limit error instead of
/// blocking the request.
const MAX_LOCAL_WAIT: Duration = Duration::from_secs(15);
const SERVER_ERROR_BACKOFF: Duration = Duration::from_millis(800);

pub struct RiotClient<T: Transport, S: SecretStore> {
    transport: T,
    keys: KeyProvider<S>,
    limiter: Mutex<RateLimiter>,
}

fn network(detail: impl Into<String>) -> AppError {
    AppError::Network {
        source_name: SOURCE_NAME,
        detail: detail.into(),
    }
}

impl<T: Transport, S: SecretStore> RiotClient<T, S> {
    pub fn new(transport: T, keys: KeyProvider<S>, limiter: RateLimiter) -> Self {
        Self {
            transport,
            keys,
            limiter: Mutex::new(limiter),
        }
    }

    pub fn keys(&self) -> &KeyProvider<S> {
        &self.keys
    }

    #[cfg(test)]
    pub fn transport_for_tests(&self) -> &T {
        &self.transport
    }

    /// Waits without sending anything (pacing of background collectors).
    pub async fn pause(&self, duration: Duration) {
        self.transport.sleep(duration).await;
    }

    pub fn key_source(&self) -> Result<Option<KeySource>, AppError> {
        self.keys.source()
    }

    fn api_key(&self) -> Result<String, AppError> {
        self.keys.resolve()?.map(|(key, _)| key).ok_or_else(|| {
            AppError::RiotKey(
                "non configurata. Inseriscila in Impostazioni oppure imposta la variabile d'ambiente RIOT_API_KEY."
                    .to_string(),
            )
        })
    }

    /// Waits for a rate-limit slot on `limit_key` (routing value).
    async fn reserve(&self, limit_key: &str) -> Result<(), AppError> {
        loop {
            let decision = {
                let mut limiter = self
                    .limiter
                    .lock()
                    .map_err(|_| AppError::State("rate limiter non disponibile".to_string()))?;
                limiter.acquire(limit_key, Instant::now())
            };
            match decision {
                Ok(()) => return Ok(()),
                Err(wait) if wait <= MAX_LOCAL_WAIT => self.transport.sleep(wait).await,
                Err(wait) => {
                    return Err(AppError::RateLimited {
                        retry_after_secs: wait.as_secs().max(1),
                    })
                }
            }
        }
    }

    fn block(&self, limit_key: &str, retry_after: Duration) {
        if let Ok(mut limiter) = self.limiter.lock() {
            limiter.block(limit_key, Instant::now(), retry_after);
        }
    }

    /// GET returning the raw body. `limit_key` is the routing value.
    pub async fn get_text(&self, limit_key: &str, url: &str) -> Result<String, AppError> {
        let key = self.api_key()?;
        let mut attempt = 1;

        loop {
            self.reserve(limit_key).await?;
            let response = self
                .transport
                .get(url, &key)
                .await
                .map_err(|detail| network(format!("{url}: {detail}")))?;

            match response.status {
                200..=299 => {
                    return String::from_utf8(response.body)
                        .map_err(|_| AppError::SourceData {
                            source_name: SOURCE_NAME,
                            detail: format!("{url}: risposta non UTF-8"),
                        });
                }
                404 => return Err(AppError::NotFound("Risorsa non trovata sulla Riot API.".to_string())),
                401 | 403 => {
                    return Err(AppError::RiotKey(
                        "non valida o scaduta. Le chiavi di sviluppo durano 24 ore: rigenerala sul Riot Developer Portal."
                            .to_string(),
                    ))
                }
                429 => {
                    let retry_after = Duration::from_secs(response.retry_after.unwrap_or(1).max(1));
                    self.block(limit_key, retry_after);
                    if attempt < MAX_ATTEMPTS && retry_after <= MAX_LOCAL_WAIT {
                        log::warn!(
                            "Riot API 429 su {limit_key}: attesa {}s (tentativo {attempt}/{MAX_ATTEMPTS})",
                            retry_after.as_secs()
                        );
                        self.transport.sleep(retry_after).await;
                    } else {
                        return Err(AppError::RateLimited {
                            retry_after_secs: retry_after.as_secs(),
                        });
                    }
                }
                500..=599 if attempt < MAX_ATTEMPTS => {
                    log::warn!(
                        "Riot API HTTP {} su {url} (tentativo {attempt}/{MAX_ATTEMPTS})",
                        response.status
                    );
                    self.transport.sleep(SERVER_ERROR_BACKOFF * attempt).await;
                }
                400 => {
                    return Err(AppError::Validation(
                        "richiesta non valida per la Riot API".to_string(),
                    ))
                }
                status => return Err(network(format!("{url}: HTTP {status}"))),
            }
            attempt += 1;
        }
    }

    pub async fn get_json<D: DeserializeOwned>(
        &self,
        limit_key: &str,
        url: &str,
    ) -> Result<D, AppError> {
        let text = self.get_text(limit_key, url).await?;
        serde_json::from_str(&text).map_err(|error| AppError::SourceData {
            source_name: SOURCE_NAME,
            detail: format!("{url}: {error}"),
        })
    }
}
