//! Read-only HTTP access to the League client (LCU) on 127.0.0.1.
//! Only GET requests to the documented-by-client endpoints listed in
//! `sync.rs`; no POST/PUT/DELETE, so the client state is never changed.

use std::future::Future;
use std::time::Duration;

use crate::client::lockfile::Lockfile;

const RIOT_ROOT_CERT: &[u8] = include_bytes!("../../certs/riotgames.pem");

#[derive(Debug, Clone, PartialEq)]
pub enum ClientError {
    /// Client not reachable (closed, starting, or port changed).
    NotRunning,
    /// HTTP status from the client (e.g. 404 while logging in).
    Status(u16),
    /// Unexpected response or transport error.
    Invalid(String),
}

impl std::fmt::Display for ClientError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotRunning => write!(f, "client non raggiungibile"),
            Self::Status(code) => write!(f, "risposta HTTP {code} dal client"),
            Self::Invalid(detail) => write!(f, "risposta non valida: {detail}"),
        }
    }
}

pub trait ClientSource: Send + Sync {
    fn get(&self, path: &str) -> impl Future<Output = Result<String, ClientError>> + Send;
}

pub struct HttpClientSource {
    http: reqwest::Client,
    base: String,
    password: String,
}

impl HttpClientSource {
    pub fn new(lockfile: &Lockfile) -> Result<Self, String> {
        let certificate = reqwest::Certificate::from_pem(RIOT_ROOT_CERT)
            .map_err(|error| format!("certificato Riot non valido: {error}"))?;
        let http = reqwest::Client::builder()
            .add_root_certificate(certificate)
            // Certificate issued by Riot's CA for a name that is not
            // "127.0.0.1": the chain is still verified, loopback only.
            .danger_accept_invalid_hostnames(true)
            .connect_timeout(Duration::from_secs(2))
            .timeout(Duration::from_secs(10))
            .no_proxy()
            .build()
            .map_err(|error| error.to_string())?;
        Ok(Self {
            http,
            base: format!("https://127.0.0.1:{}", lockfile.port),
            password: lockfile.password.clone(),
        })
    }
}

impl ClientSource for HttpClientSource {
    async fn get(&self, path: &str) -> Result<String, ClientError> {
        let response = self
            .http
            .get(format!("{}{path}", self.base))
            .basic_auth("riot", Some(&self.password))
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|error| {
                if error.is_connect() || error.is_timeout() {
                    ClientError::NotRunning
                } else {
                    ClientError::Invalid(error.to_string())
                }
            })?;
        let status = response.status();
        if !status.is_success() {
            return Err(ClientError::Status(status.as_u16()));
        }
        response
            .text()
            .await
            .map_err(|error| ClientError::Invalid(error.to_string()))
    }
}
