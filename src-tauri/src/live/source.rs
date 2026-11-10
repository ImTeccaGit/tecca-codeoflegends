//! Access to the local Live Client Data API (https://127.0.0.1:2999), behind
//! a trait so tests can simulate a game. Read-only GET requests to a
//! documented local endpoint: no memory reading, no injection, no files.

use std::future::Future;
use std::time::Duration;

pub const LIVE_CLIENT_BASE: &str = "https://127.0.0.1:2999";
/// Riot's public root certificate for the game client's self-signed TLS.
const RIOT_ROOT_CERT: &[u8] = include_bytes!("../../certs/riotgames.pem");

#[derive(Debug, Clone, PartialEq)]
pub enum FetchError {
    /// Nothing listens on the port: no game is running.
    NotRunning,
    /// The client answers but has no data yet (loading screen, menus).
    Unavailable(u16),
    /// Unexpected response or transport error.
    Invalid(String),
}

pub trait LiveSource: Send + Sync {
    /// GET `path` (e.g. "/liveclientdata/gamestats") and return the body.
    fn get(&self, path: &str) -> impl Future<Output = Result<String, FetchError>> + Send;
}

pub struct HttpLiveSource {
    http: reqwest::Client,
}

impl HttpLiveSource {
    pub fn new() -> Result<Self, String> {
        let certificate = reqwest::Certificate::from_pem(RIOT_ROOT_CERT)
            .map_err(|error| format!("certificato Riot non valido: {error}"))?;
        let http = reqwest::Client::builder()
            .add_root_certificate(certificate)
            // The game's certificate is issued by Riot's CA for a hostname
            // that is not "127.0.0.1"; the chain is still verified against
            // the pinned Riot root, and this client only talks to loopback.
            .danger_accept_invalid_hostnames(true)
            .connect_timeout(Duration::from_millis(800))
            .timeout(Duration::from_secs(2))
            .no_proxy()
            .build()
            .map_err(|error| error.to_string())?;
        Ok(Self { http })
    }
}

impl LiveSource for HttpLiveSource {
    async fn get(&self, path: &str) -> Result<String, FetchError> {
        let response = self
            .http
            .get(format!("{LIVE_CLIENT_BASE}{path}"))
            .send()
            .await
            .map_err(|error| {
                if error.is_connect() || error.is_timeout() {
                    FetchError::NotRunning
                } else {
                    FetchError::Invalid(error.to_string())
                }
            })?;
        let status = response.status();
        if !status.is_success() {
            return Err(FetchError::Unavailable(status.as_u16()));
        }
        response
            .text()
            .await
            .map_err(|error| FetchError::Invalid(error.to_string()))
    }
}
