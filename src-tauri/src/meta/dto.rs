//! Global statistics contracts (camelCase). Mirrored by Zod in
//! `src/types/global-stats.ts`.

use serde::Serialize;

/// Id + Data Dragon name and icon (rune, rune tree, shard, spell, item).
pub use crate::riot::dto::RuneRef as IconRef;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchSample {
    /// "16.22".
    pub patch: String,
    pub matches: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GlobalStatsStatus {
    pub enabled: bool,
    /// "disabled" | "idle" | "collecting" | "waiting" | "error".
    pub state: String,
    pub platform: String,
    pub seed_tier: String,
    pub message: Option<String>,
    /// Matches stored since the app started.
    pub session_matches: u64,
    /// Epoch milliseconds of the last stored match or completed step.
    pub last_activity_ms: Option<u64>,
    pub total_matches: i64,
    /// Newest patch first.
    pub patches: Vec<PatchSample>,
    pub seed_players: i64,
    pub seeds_refreshed_at: Option<String>,
    pub last_fetched_at: Option<String>,
    pub key_configured: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleShare {
    pub role: String,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunePageStat {
    pub primary_style: IconRef,
    /// Keystone first, then one rune per row.
    pub primary_runes: Vec<IconRef>,
    pub secondary_style: IconRef,
    pub secondary_runes: Vec<IconRef>,
    /// Offense, flex, defense.
    pub shards: Vec<IconRef>,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IconStat {
    pub icon: IconRef,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SpellPairStat {
    pub spells: Vec<IconRef>,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MatchupStat {
    pub champion_id: i64,
    /// Data Dragon id used by the champion page route ("MonkeyKing").
    pub key: Option<String>,
    pub name: Option<String>,
    pub image_url: Option<String>,
    pub games: i64,
    /// Wins of the selected champion against this opponent.
    pub wins: i64,
}

/// One rune tree of the current patch, row by row (row 0 = keystones).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuneTreeLayout {
    pub tree: IconRef,
    pub rows: Vec<Vec<IconRef>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionGlobalStats {
    pub champion_id: i64,
    /// Selected patch; `None` = every stored patch.
    pub patch: Option<String>,
    pub patches: Vec<PatchSample>,
    pub platforms: Vec<String>,
    pub seed_tiers: Vec<String>,
    /// Valid matches (no remakes) in the selected patch scope.
    pub total_matches: i64,
    /// All roles.
    pub games: i64,
    pub wins: i64,
    /// Matches where the champion was banned.
    pub bans: i64,
    pub roles: Vec<RoleShare>,
    /// Selected role (`None` when the champion has no games).
    pub role: Option<String>,
    pub role_games: i64,
    pub role_wins: i64,
    pub rune_pages: Vec<RunePageStat>,
    pub keystones: Vec<IconStat>,
    pub summoner_spells: Vec<SpellPairStat>,
    pub boots: Vec<IconStat>,
    pub core_items: Vec<IconStat>,
    /// Lane opponents the champion beats most / loses to most.
    pub strong_against: Vec<MatchupStat>,
    pub weak_against: Vec<MatchupStat>,
    pub matchup_min_games: i64,
    pub rune_trees: Vec<RuneTreeLayout>,
    pub shard_rows: Vec<Vec<IconRef>>,
    pub last_fetched_at: Option<String>,
    pub source: String,
    /// True when the numbers come from the user's own saved matches (the
    /// collected matches do not contain this champion).
    pub personal: bool,
    /// Most common max order of Q/W/E, with the most common sequence.
    pub skill_orders: Vec<SkillOrderStat>,
    /// Items bought in the first 90 seconds.
    pub start_builds: Vec<ItemSetStat>,
    /// First three completed items (boots excluded), in purchase order.
    pub core_builds: Vec<ItemSetStat>,
    /// Games of the selected role with a timeline (skills and builds).
    pub timeline_games: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillOrderStat {
    /// e.g. ["Q", "E", "W"].
    pub priority: Vec<String>,
    /// Up to 18 level-ups, e.g. ["Q", "E", "W", "Q", ...].
    pub sequence: Vec<String>,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemSetStat {
    pub items: Vec<IconRef>,
    pub games: i64,
    pub wins: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionRoles {
    pub champion_id: i64,
    pub games: i64,
    /// Most played first.
    pub roles: Vec<RoleShare>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChampionRolesOverview {
    pub champions: Vec<ChampionRoles>,
    pub global_matches: i64,
    pub personal_matches: i64,
}
