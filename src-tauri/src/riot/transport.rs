//! HTTP transport behind a trait, so the client can be tested with simulated
//! Riot responses (see `riot/tests.rs`).

use std::future::Future;
use std::time::Duration;

#[derive(Clone)]
pub struct RawResponse {
    pub status: u16,
    /// `Retry-After` header in seconds, when present.
    pub retry_after: Option<u64>,
    pub body: Vec<u8>,
}

pub trait Transport: Send + Sync {
    /// GET with the `X-Riot-Token` header. `Err` = no HTTP response at all.
    fn get(
        &self,
        url: &str,
        api_key: &str,
    ) -> impl Future<Output = Result<RawResponse, String>> + Send;
    fn sleep(&self, duration: Duration) -> impl Future<Output = ()> + Send;
}

pub struct ReqwestTransport {
    http: reqwest::Client,
}

impl ReqwestTransport {
    pub fn new() -> Result<Self, String> {
        let http = reqwest::Client::builder()
            .user_agent(format!("TeccaCodeOfLegends/{}", env!("CARGO_PKG_VERSION")))
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(20))
            .build()
            .map_err(|error| error.to_string())?;
        Ok(Self { http })
    }
}

impl Transport for ReqwestTransport {
    async fn get(&self, url: &str, api_key: &str) -> Result<RawResponse, String> {
        let response = self
            .http
            .get(url)
            .header("X-Riot-Token", api_key)
            .send()
            .await
            // reqwest errors never include request headers, so no key leaks.
            .map_err(|error| error.to_string())?;
        let status = response.status().as_u16();
        let retry_after = response
            .headers()
            .get("Retry-After")
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.trim().parse().ok());
        let body = response
            .bytes()
            .await
            .map_err(|error| error.to_string())?
            .to_vec();
        Ok(RawResponse {
            status,
            retry_after,
            body,
        })
    }

    async fn sleep(&self, duration: Duration) {
        tokio::time::sleep(duration).await;
    }
}
