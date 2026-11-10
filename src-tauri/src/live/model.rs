//! Raw Live Client Data API shapes (only the fields the app reads) and the
//! snapshot sent to the webview.
//! Docs: https://developer.riotgames.com/docs/lol#game-client-api_live-client-data-api

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RawGameStats {
    #[serde(default)]
    pub game_mode: String,
    #[serde(default)]
    pub game_time: f64,
    #[serde(default)]
    pub map_name: String,
    #[serde(default)]
    pub map_number: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RawScores {
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: i64,
    pub ward_score: f64,
}

/// Entry of `/playerlist`. Only identity and the fields shown in the
/// player's own scoreboard row are declared; everything else is ignored.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RawPlayer {
    pub riot_id: Option<String>,
    pub riot_id_game_name: Option<String>,
    pub riot_id_tag_line: Option<String>,
    pub summoner_name: Option<String>,
    pub champion_name: String,
    pub raw_champion_name: String,
    pub level: i64,
    pub team: String,
    pub position: String,
    pub is_dead: bool,
    pub is_bot: bool,
    pub scores: RawScores,
}

impl RawPlayer {
    pub fn matches_name(&self, name: &str) -> bool {
        if let (Some(game), Some(tag)) = (&self.riot_id_game_name, &self.riot_id_tag_line) {
            if format!("{game}#{tag}").eq_ignore_ascii_case(name) {
                return true;
            }
        }
        [self.riot_id.as_deref(), self.summoner_name.as_deref()]
            .into_iter()
            .flatten()
            .any(|candidate| candidate.eq_ignore_ascii_case(name))
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveGame {
    pub mode: String,
    pub map_name: String,
    pub map_number: i64,
    pub game_time_seconds: f64,
}

/// The local player's own data only: what they already see in their client.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LivePlayer {
    pub riot_id: String,
    pub champion_name: String,
    /// Data Dragon id derived from `rawChampionName` (e.g. "Ahri"), if present.
    pub champion_key: Option<String>,
    pub level: i64,
    pub team: String,
    pub position: Option<String>,
    pub is_dead: bool,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub creep_score: i64,
    pub ward_score: f64,
    pub cs_per_minute: Option<f64>,
}

/// One player of the game as shown on the in-game scoreboard (Tab): public
/// identity only, never items, scores, spells or timers. `riot_id` is `None`
/// for bots and for players whose Riot ID the game hides (anonymous): they
/// are never looked up.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RosterEntry {
    pub riot_id: Option<String>,
    pub champion_name: String,
    pub champion_key: Option<String>,
    /// "ORDER" (blue) or "CHAOS" (red).
    pub team: String,
    pub position: Option<String>,
    pub is_me: bool,
    pub is_bot: bool,
}

/// "disabled" | "not_running" | "loading" | "in_game" | "error".
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LiveSnapshot {
    pub status: String,
    pub game: Option<LiveGame>,
    pub player: Option<LivePlayer>,
    /// Every player's public identity (approved by the user on 2026-11-10,
    /// see docs/LIVE_GAME.md). Empty outside a game.
    pub roster: Vec<RosterEntry>,
    pub message: Option<String>,
    /// Epoch milliseconds of the last check (0 = never).
    pub updated_at_ms: u64,
}

impl LiveSnapshot {
    pub fn with_status(status: &str, message: Option<&str>) -> Self {
        Self {
            status: status.to_string(),
            game: None,
            player: None,
            roster: Vec::new(),
            message: message.map(String::from),
            updated_at_ms: 0,
        }
    }

    /// Same content ignoring the timestamp (used to emit only real changes).
    pub fn same_content(&self, other: &Self) -> bool {
        self.status == other.status
            && self.game == other.game
            && self.player == other.player
            && self.roster == other.roster
            && self.message == other.message
    }
}
