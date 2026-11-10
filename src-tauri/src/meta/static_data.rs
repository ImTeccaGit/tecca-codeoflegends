//! Names and icons for ids that the imported Data Dragon catalog does not
//! cover. Values copied from Data Dragon 16.22.1 (`summoner.json`, it_IT) and
//! the public `perk-images/StatMods` icons; ids are stable Riot ids.

use crate::ddragon::urls;
use crate::meta::dto::IconRef;

/// (id, Italian name, icon file in `perk-images/StatMods/`).
const SHARDS: &[(i64, &str, &str)] = &[
    (5008, "Forza adattiva", "StatModsAdaptiveForceIcon.png"),
    (5005, "Velocità d'attacco", "StatModsAttackSpeedIcon.png"),
    (5007, "Velocità abilità", "StatModsCDRScalingIcon.png"),
    (
        5010,
        "Velocità di movimento",
        "StatModsMovementSpeedIcon.png",
    ),
    (5001, "Salute crescente", "StatModsHealthScalingIcon.png"),
    (5011, "Salute", "StatModsHealthPlusIcon.png"),
    (
        5013,
        "Tenacia e resistenza ai rallentamenti",
        "StatModsTenacityIcon.png",
    ),
    (5002, "Armatura", "StatModsArmorIcon.png"),
    (5003, "Resistenza magica", "StatModsMagicResIcon.png"),
];

/// Current shard rows (offense, flex, defense) as shown in the client.
pub const SHARD_ROWS: [[i64; 3]; 3] = [[5008, 5005, 5007], [5008, 5010, 5001], [5011, 5013, 5001]];

/// Summoner's Rift spells: (id, Italian name, Data Dragon image file).
const SUMMONER_SPELLS: &[(i64, &str, &str)] = &[
    (1, "Purificazione", "SummonerBoost.png"),
    (3, "Sfinimento", "SummonerExhaust.png"),
    (4, "Flash", "SummonerFlash.png"),
    (6, "Spettralità", "SummonerHaste.png"),
    (7, "Guarigione", "SummonerHeal.png"),
    (11, "Punizione", "SummonerSmite.png"),
    (12, "Teletrasporto", "SummonerTeleport.png"),
    (13, "Chiarezza", "SummonerMana.png"),
    (14, "Ustione", "SummonerDot.png"),
    (21, "Barriera", "SummonerBarrier.png"),
];

pub fn shard(id: i64) -> IconRef {
    match SHARDS.iter().find(|(shard_id, _, _)| *shard_id == id) {
        Some((_, name, file)) => IconRef {
            id,
            name: Some((*name).to_string()),
            icon_url: Some(urls::rune(&format!("perk-images/StatMods/{file}"))),
        },
        None => IconRef {
            id,
            name: None,
            icon_url: None,
        },
    }
}

/// `version` = current Data Dragon patch, needed by spell image URLs.
pub fn summoner_spell(id: i64, version: Option<&str>) -> IconRef {
    match SUMMONER_SPELLS
        .iter()
        .find(|(spell_id, _, _)| *spell_id == id)
    {
        Some((_, name, file)) => IconRef {
            id,
            name: Some((*name).to_string()),
            icon_url: version.map(|version| urls::spell(version, "spell", file)),
        },
        None => IconRef {
            id,
            name: None,
            icon_url: None,
        },
    }
}
