//! Locating the League client's `lockfile` (read only).
//!
//! The client writes `<install dir>\lockfile` while it runs:
//! `LeagueClient:<pid>:<port>:<password>:<protocol>`. The password is a local
//! session token for 127.0.0.1 only; it is never logged, stored or sent to the
//! webview. Nothing in the game folder is ever written.

use std::fs;
use std::path::{Path, PathBuf};

/// Riot's install metadata (documents the League install path).
const PRODUCT_SETTINGS: &str = r"C:\ProgramData\Riot Games\Metadata\league_of_legends.live\league_of_legends.live.product_settings.yaml";
const DEFAULT_INSTALLS: [&str; 2] = [
    r"C:\Riot Games\League of Legends",
    r"D:\Riot Games\League of Legends",
];

#[derive(Clone, PartialEq, Eq)]
pub struct Lockfile {
    pub pid: u32,
    pub port: u16,
    pub password: String,
}

impl std::fmt::Debug for Lockfile {
    // Never print the session password.
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Lockfile")
            .field("pid", &self.pid)
            .field("port", &self.port)
            .field("password", &"<redacted>")
            .finish()
    }
}

/// Parses the lockfile content. `None` when it is not a League client lockfile.
pub fn parse(content: &str) -> Option<Lockfile> {
    let mut parts = content.trim().split(':');
    let _name = parts.next()?;
    let pid = parts.next()?.parse().ok()?;
    let port = parts.next()?.parse().ok()?;
    let password = parts.next()?.to_string();
    let protocol = parts.next()?;
    if protocol != "https" || password.is_empty() || port == 0 || parts.next().is_some() {
        return None;
    }
    Some(Lockfile {
        pid,
        port,
        password,
    })
}

/// `product_install_full_path: "C:/Riot Games/League of Legends"` → path.
pub fn install_path_from_settings(yaml: &str) -> Option<PathBuf> {
    yaml.lines().find_map(|line| {
        let value = line.trim().strip_prefix("product_install_full_path:")?;
        let value = value.trim().trim_matches('"').trim_matches('\'');
        (!value.is_empty()).then(|| PathBuf::from(value.replace('/', "\\")))
    })
}

/// Valid install dir: an existing directory containing `LeagueClient.exe`.
pub fn is_install_dir(path: &Path) -> bool {
    path.is_dir() && path.join("LeagueClient.exe").is_file()
}

/// Install directory: user override, Riot metadata, then default locations.
pub fn find_install_dir(override_path: Option<&Path>) -> Option<PathBuf> {
    if let Some(path) = override_path {
        return is_install_dir(path).then(|| path.to_path_buf());
    }
    let from_metadata = fs::read_to_string(PRODUCT_SETTINGS)
        .ok()
        .and_then(|yaml| install_path_from_settings(&yaml));
    from_metadata
        .into_iter()
        .chain(DEFAULT_INSTALLS.iter().map(PathBuf::from))
        .find(|path| is_install_dir(path))
}

/// Reads `<install>\lockfile`. `None` when the client is not running.
pub fn read(install_dir: &Path) -> Option<Lockfile> {
    fs::read_to_string(install_dir.join("lockfile"))
        .ok()
        .and_then(|content| parse(&content))
}
