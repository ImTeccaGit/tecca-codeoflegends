//! League client (LCU) response shapes and their conversion to the app's
//! storage types. Only fields that exist in the client response are used;
//! anything missing stays empty/None (never estimated).

use serde::Deserialize;

use crate::riot::league::LeagueEntry;
use crate::riot::matches::{
    Ban, MatchDto, MatchInfo, MatchMetadata, Participant, PerkSelection, PerkStyle, Perks, Team,
};
use crate::riot::routing::PLATFORMS;

/// `/lol-summoner/v1/current-summoner`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentSummoner {
    pub puuid: String,
    #[serde(default)]
    pub game_name: String,
    #[serde(default)]
    pub tag_line: String,
    #[serde(default)]
    pub summoner_level: Option<i64>,
    #[serde(default)]
    pub profile_icon_id: Option<i64>,
}

/// `/riotclient/region-locale`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct RegionLocale {
    pub region: String,
}

/// Client region code ("EUW", "NA"…) → platform id ("euw1", "na1"…).
pub fn platform_from_region(region: &str) -> Option<&'static str> {
    let platform = match region.trim().to_ascii_uppercase().as_str() {
        "EUW" | "EUW1" => "euw1",
        "EUNE" | "EUN1" => "eun1",
        "NA" | "NA1" => "na1",
        "KR" => "kr",
        "BR" | "BR1" => "br1",
        "JP" | "JP1" => "jp1",
        "RU" => "ru",
        "OCE" | "OC1" => "oc1",
        "TR" | "TR1" => "tr1",
        "LAN" | "LA1" => "la1",
        "LAS" | "LA2" => "la2",
        "ME" | "ME1" => "me1",
        "SG" | "SG2" => "sg2",
        "TW" | "TW2" => "tw2",
        "VN" | "VN2" => "vn2",
        _ => return None,
    };
    PLATFORMS.contains(&platform).then_some(platform)
}

/// `/lol-ranked/v1/current-ranked-stats`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct RankedStats {
    pub queues: Vec<RankedQueue>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct RankedQueue {
    pub queue_type: String,
    pub tier: String,
    pub division: String,
    pub league_points: i64,
    pub wins: i64,
    pub losses: i64,
}

/// Ranked queues with a real placement (unranked/provisional are skipped).
pub fn ranked_entries(stats: &RankedStats) -> Vec<LeagueEntry> {
    stats
        .queues
        .iter()
        .filter(|queue| {
            matches!(
                queue.queue_type.as_str(),
                "RANKED_SOLO_5x5" | "RANKED_FLEX_SR"
            ) && !queue.tier.is_empty()
                && queue.tier != "NONE"
        })
        .map(|queue| LeagueEntry {
            queue_type: queue.queue_type.clone(),
            tier: queue.tier.clone(),
            rank: Some(queue.division.clone()).filter(|value| !value.is_empty() && value != "NA"),
            league_points: queue.league_points,
            wins: queue.wins,
            losses: queue.losses,
            hot_streak: false,
        })
        .collect()
}

/// `/lol-match-history/v1/products/lol/current-summoner/matches`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct HistoryList {
    pub games: HistoryGames,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct HistoryGames {
    pub games: Vec<HistoryEntry>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct HistoryEntry {
    pub game_id: i64,
    pub platform_id: String,
}

/// `/lol-match-history/v1/games/{gameId}`: full game (all participants).
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientGame {
    pub game_id: i64,
    pub platform_id: String,
    pub game_creation: i64,
    /// Seconds.
    pub game_duration: i64,
    pub game_mode: String,
    pub game_version: String,
    pub map_id: i64,
    pub queue_id: i64,
    pub participant_identities: Vec<ParticipantIdentity>,
    pub participants: Vec<ClientParticipant>,
    pub teams: Vec<ClientTeam>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ParticipantIdentity {
    pub participant_id: i64,
    pub player: IdentityPlayer,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct IdentityPlayer {
    pub puuid: String,
    pub game_name: String,
    pub tag_line: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientParticipant {
    pub participant_id: i64,
    pub team_id: i64,
    pub champion_id: i64,
    pub spell1_id: i64,
    pub spell2_id: i64,
    pub stats: ClientStats,
    pub timeline: ClientTimeline,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientStats {
    pub win: bool,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub total_minions_killed: i64,
    pub neutral_minions_killed: i64,
    pub gold_earned: i64,
    pub vision_score: i64,
    pub champ_level: i64,
    pub total_damage_dealt_to_champions: i64,
    pub total_damage_taken: Option<i64>,
    pub item0: i64,
    pub item1: i64,
    pub item2: i64,
    pub item3: i64,
    pub item4: i64,
    pub item5: i64,
    pub item6: i64,
    pub perk0: i64,
    pub perk1: i64,
    pub perk2: i64,
    pub perk3: i64,
    pub perk4: i64,
    pub perk5: i64,
    pub perk_primary_style: i64,
    pub perk_sub_style: i64,
    pub game_ended_in_early_surrender: bool,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(default)]
pub struct ClientTimeline {
    pub lane: String,
    pub role: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientTeam {
    pub team_id: i64,
    pub bans: Vec<ClientBan>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClientBan {
    pub champion_id: i64,
    pub pick_turn: i64,
}

/// Lane inferred by the client (`timeline.lane/role`) → Riot `teamPosition`.
/// Empty when the client did not infer a lane.
pub fn team_position(timeline: &ClientTimeline) -> String {
    let role = timeline.role.to_ascii_uppercase();
    match timeline.lane.to_ascii_uppercase().as_str() {
        "TOP" => "TOP",
        "JUNGLE" => "JUNGLE",
        "MIDDLE" | "MID" => "MIDDLE",
        "BOTTOM" | "BOT" if role.contains("SUPPORT") => "UTILITY",
        "BOTTOM" | "BOT" => "BOTTOM",
        _ => "",
    }
    .to_string()
}

/// Match id in match-v5 form ("EUW1_7123456789") so the same game read from
/// the Riot API and from the client is stored only once.
pub fn match_id(platform_id: &str, game_id: i64) -> Option<String> {
    let platform = platform_id.trim().to_ascii_uppercase();
    let valid =
        !platform.is_empty() && platform.chars().all(|c| c.is_ascii_alphanumeric()) && game_id > 0;
    valid.then(|| format!("{platform}_{game_id}"))
}

/// Converts a full client game to the storage DTO. `champion_name` resolves
/// a champion id to its Data Dragon id (e.g. "Ahri"), when known.
pub fn to_match(
    game: &ClientGame,
    champion_name: impl Fn(i64) -> Option<String>,
) -> Option<MatchDto> {
    let id = match_id(&game.platform_id, game.game_id)?;
    let participants = game
        .participants
        .iter()
        .filter_map(|participant| {
            let identity = game
                .participant_identities
                .iter()
                .find(|identity| identity.participant_id == participant.participant_id)?;
            if identity.player.puuid.is_empty() {
                return None;
            }
            let stats = &participant.stats;
            Some(Participant {
                participant_id: participant.participant_id,
                puuid: identity.player.puuid.clone(),
                riot_id_game_name: Some(identity.player.game_name.clone())
                    .filter(|name| !name.is_empty()),
                riot_id_tagline: Some(identity.player.tag_line.clone())
                    .filter(|tag| !tag.is_empty()),
                champion_id: participant.champion_id,
                champion_name: champion_name(participant.champion_id).unwrap_or_default(),
                team_id: participant.team_id,
                team_position: team_position(&participant.timeline),
                win: stats.win,
                kills: stats.kills,
                deaths: stats.deaths,
                assists: stats.assists,
                total_minions_killed: stats.total_minions_killed,
                neutral_minions_killed: stats.neutral_minions_killed,
                gold_earned: stats.gold_earned,
                vision_score: stats.vision_score,
                champ_level: stats.champ_level,
                total_damage_dealt_to_champions: stats.total_damage_dealt_to_champions,
                total_damage_taken: stats.total_damage_taken,
                item0: stats.item0,
                item1: stats.item1,
                item2: stats.item2,
                item3: stats.item3,
                item4: stats.item4,
                item5: stats.item5,
                item6: stats.item6,
                summoner1_id: participant.spell1_id,
                summoner2_id: participant.spell2_id,
                game_ended_in_early_surrender: stats.game_ended_in_early_surrender,
                perks: Perks {
                    // The LCU history does not expose rune shards.
                    stat_perks: Default::default(),
                    styles: if stats.perk_primary_style > 0 {
                        vec![
                            PerkStyle {
                                description: "primaryStyle".to_string(),
                                style: stats.perk_primary_style,
                                selections: [stats.perk0, stats.perk1, stats.perk2, stats.perk3]
                                    .into_iter()
                                    .filter(|perk| *perk > 0)
                                    .map(|perk| PerkSelection { perk })
                                    .collect(),
                            },
                            PerkStyle {
                                description: "subStyle".to_string(),
                                style: stats.perk_sub_style,
                                selections: [stats.perk4, stats.perk5]
                                    .into_iter()
                                    .filter(|perk| *perk > 0)
                                    .map(|perk| PerkSelection { perk })
                                    .collect(),
                            },
                        ]
                    } else {
                        Vec::new()
                    },
                },
            })
        })
        .collect::<Vec<_>>();
    if participants.is_empty() {
        return None;
    }

    Some(MatchDto {
        metadata: MatchMetadata { match_id: id },
        info: MatchInfo {
            game_creation: game.game_creation,
            game_duration: game.game_duration,
            // The client reports seconds: mark the duration as such.
            game_end_timestamp: Some(game.game_creation + game.game_duration * 1000),
            game_mode: game.game_mode.clone(),
            game_version: game.game_version.clone(),
            map_id: game.map_id,
            queue_id: game.queue_id,
            participants,
            teams: game
                .teams
                .iter()
                .map(|team| Team {
                    team_id: team.team_id,
                    bans: team
                        .bans
                        .iter()
                        .map(|ban| Ban {
                            champion_id: ban.champion_id,
                            pick_turn: ban.pick_turn,
                        })
                        .collect(),
                })
                .collect(),
        },
    })
}
