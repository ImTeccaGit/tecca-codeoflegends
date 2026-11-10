//! Automatic Riot account from the local League client (no API key).
//!
//! Policy (see docs/RIOT_COMPLIANCE.md): the League Client API (LCU) is not
//! officially supported by Riot for third-party apps. It is used here only
//! with the user's explicit choice, read-only (GET), on 127.0.0.1, for the
//! logged-in player's own account, rank and match history:
//! * the `lockfile` in the League folder is read, never written;
//! * no POST/PUT/DELETE (no auto-accept, no lobby or champion select);
//! * no memory reading, no injection, no game file changes;
//! * the session password never leaves this module (not logged or stored).

pub mod convert;
pub mod lockfile;
pub mod repository;
pub mod service;
pub mod source;
pub mod sync;

#[cfg(test)]
mod tests;
