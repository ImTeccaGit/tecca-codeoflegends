//! Raw Data Dragon JSON shapes. Only the fields the app imports are declared;
//! unknown fields are ignored. Missing required fields make parsing fail, so
//! malformed upstream data never reaches the database.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct ChampionFullFile {
    pub version: String,
    pub data: BTreeMap<String, RawChampion>,
}

#[derive(Debug, Deserialize)]
pub struct RawChampion {
    pub id: String,
    pub key: String,
    pub name: String,
    pub title: String,
    pub image: RawImage,
    pub skins: Vec<RawSkin>,
    pub lore: String,
    pub blurb: String,
    pub tags: Vec<String>,
    pub partype: String,
    pub info: ChampionInfo,
    pub stats: ChampionStats,
    pub spells: Vec<RawSpell>,
    pub passive: RawPassive,
}

#[derive(Debug, Deserialize)]
pub struct RawImage {
    pub full: String,
}

#[derive(Debug, Deserialize)]
pub struct RawSkin {
    pub id: String,
    pub num: i64,
    pub name: String,
    #[serde(default)]
    pub chromas: bool,
}

/// Official 0–10 ratings published by Riot for each champion.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChampionInfo {
    pub attack: f64,
    pub defense: f64,
    pub magic: f64,
    pub difficulty: f64,
}

/// Base stats and per-level growth, with Data Dragon key names.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChampionStats {
    pub hp: f64,
    pub hpperlevel: f64,
    pub mp: f64,
    pub mpperlevel: f64,
    pub movespeed: f64,
    pub armor: f64,
    pub armorperlevel: f64,
    pub spellblock: f64,
    pub spellblockperlevel: f64,
    pub attackrange: f64,
    pub hpregen: f64,
    pub hpregenperlevel: f64,
    pub mpregen: f64,
    pub mpregenperlevel: f64,
    pub crit: f64,
    pub critperlevel: f64,
    pub attackdamage: f64,
    pub attackdamageperlevel: f64,
    pub attackspeedperlevel: f64,
    pub attackspeed: f64,
}

#[derive(Debug, Deserialize)]
pub struct RawSpell {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub maxrank: Option<i64>,
    #[serde(rename = "cooldownBurn", default)]
    pub cooldown_burn: Option<String>,
    #[serde(rename = "costBurn", default)]
    pub cost_burn: Option<String>,
    #[serde(rename = "rangeBurn", default)]
    pub range_burn: Option<String>,
    pub image: RawImage,
}

#[derive(Debug, Deserialize)]
pub struct RawPassive {
    pub name: String,
    pub description: String,
    pub image: RawImage,
}

#[derive(Debug, Deserialize)]
pub struct ItemFile {
    pub version: String,
    pub data: BTreeMap<String, RawItem>,
}

#[derive(Debug, Deserialize)]
pub struct RawItem {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub plaintext: String,
    pub image: RawImage,
    pub gold: RawGold,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub maps: BTreeMap<String, bool>,
    #[serde(default)]
    pub from: Vec<String>,
    #[serde(default)]
    pub into: Vec<String>,
    /// Absent means "sold in the shop".
    #[serde(rename = "inStore", default)]
    pub in_store: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct RawGold {
    pub base: i64,
    pub total: i64,
    pub sell: i64,
    pub purchasable: bool,
}

#[derive(Debug, Deserialize)]
pub struct RawRuneTree {
    pub id: i64,
    pub key: String,
    pub icon: String,
    pub name: String,
    pub slots: Vec<RawRuneSlot>,
}

#[derive(Debug, Deserialize)]
pub struct RawRuneSlot {
    pub runes: Vec<RawRune>,
}

#[derive(Debug, Deserialize)]
pub struct RawRune {
    pub id: i64,
    pub key: String,
    pub icon: String,
    pub name: String,
    #[serde(rename = "shortDesc")]
    pub short_desc: String,
    #[serde(rename = "longDesc")]
    pub long_desc: String,
}
