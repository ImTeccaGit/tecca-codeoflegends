//! Riot API key handling. The key is read only here, in Rust:
//! 1. `RIOT_API_KEY` process environment variable (development);
//! 2. the OS credential store (Windows Credential Manager).
//!
//! It is never returned to the webview, never logged and never persisted in
//! SQLite or in the repository.

use crate::error::AppError;

pub const ENV_VAR: &str = "RIOT_API_KEY";
const SERVICE: &str = "com.tecca.codeoflegends";
const ACCOUNT: &str = "riot-api-key";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum KeySource {
    Environment,
    CredentialStore,
}

impl KeySource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Environment => "environment",
            Self::CredentialStore => "credential_store",
        }
    }
}

pub trait SecretStore: Send + Sync {
    fn get(&self) -> Result<Option<String>, String>;
    fn set(&self, value: &str) -> Result<(), String>;
    fn delete(&self) -> Result<(), String>;
}

/// Windows Credential Manager (generic credential).
pub struct OsCredentialStore;

impl OsCredentialStore {
    fn entry() -> Result<keyring::Entry, String> {
        keyring::Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
    }
}

impl SecretStore for OsCredentialStore {
    fn get(&self) -> Result<Option<String>, String> {
        match Self::entry()?.get_password() {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    }

    fn set(&self, value: &str) -> Result<(), String> {
        Self::entry()?
            .set_password(value)
            .map_err(|error| error.to_string())
    }

    fn delete(&self) -> Result<(), String> {
        match Self::entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}

/// "RGAPI-" followed by a UUID, as issued by the Riot Developer Portal.
pub fn is_valid_key_format(key: &str) -> bool {
    let Some(uuid) = key.strip_prefix("RGAPI-") else {
        return false;
    };
    let groups: Vec<&str> = uuid.split('-').collect();
    let lengths = [8, 4, 4, 4, 12];
    groups.len() == lengths.len()
        && groups.iter().zip(lengths).all(|(group, length)| {
            group.len() == length && group.chars().all(|c| c.is_ascii_hexdigit())
        })
}

pub struct KeyProvider<S: SecretStore> {
    store: S,
    environment: Option<String>,
}

fn store_error(detail: String) -> AppError {
    AppError::State(format!("archivio credenziali: {detail}"))
}

impl<S: SecretStore> KeyProvider<S> {
    /// `environment` is the value of `RIOT_API_KEY`, read once at startup.
    pub fn new(store: S, environment: Option<String>) -> Self {
        let environment = environment
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        Self { store, environment }
    }

    pub fn from_process_env(store: S) -> Self {
        Self::new(store, std::env::var(ENV_VAR).ok())
    }

    /// The key to use and where it comes from, if configured.
    pub fn resolve(&self) -> Result<Option<(String, KeySource)>, AppError> {
        if let Some(key) = &self.environment {
            return Ok(Some((key.clone(), KeySource::Environment)));
        }
        Ok(self
            .store
            .get()
            .map_err(store_error)?
            .map(|key| (key, KeySource::CredentialStore)))
    }

    pub fn source(&self) -> Result<Option<KeySource>, AppError> {
        Ok(self.resolve()?.map(|(_, source)| source))
    }

    pub fn save(&self, key: &str) -> Result<(), AppError> {
        let key = key.trim();
        if !is_valid_key_format(key) {
            return Err(AppError::Validation(
                "la chiave deve avere il formato RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    .to_string(),
            ));
        }
        self.store.set(key).map_err(store_error)
    }

    pub fn clear(&self) -> Result<(), AppError> {
        self.store.delete().map_err(store_error)
    }

    pub fn environment_overrides(&self) -> bool {
        self.environment.is_some()
    }
}
