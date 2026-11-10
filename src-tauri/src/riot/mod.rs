//! Official Riot API integration (https://developer.riotgames.com/docs/lol).
//!
//! Separate services:
//! * `routing`    platform and regional routing values
//! * `rate_limit` client-side limits per routing value + Retry-After
//! * `secrets`    API key: env var or OS credential store, never in the webview
//! * `transport`  HTTP behind a trait (simulated in tests)
//! * `client`     auth header, retries and error mapping
//! * `account`, `summoner`, `league`, `matches`  one module per Riot API
//! * `repository` SQLite cache; `sync` TTLs, dedup and orchestration
//!
//! No scraping, no undocumented endpoints, no client/game access.

pub mod account;
pub mod client;
pub mod dto;
pub mod league;
pub mod matches;
pub mod rate_limit;
pub mod repository;
pub mod routing;
pub mod secrets;
pub mod summoner;
pub mod sync;
pub mod transport;

#[cfg(test)]
pub(crate) mod tests;

use crate::riot::client::RiotClient;
use crate::riot::secrets::OsCredentialStore;
use crate::riot::transport::ReqwestTransport;

/// The concrete client managed by Tauri.
pub type AppRiotClient = RiotClient<ReqwestTransport, OsCredentialStore>;
