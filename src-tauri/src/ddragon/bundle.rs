//! Converts raw Data Dragon files into a validated, import-ready bundle.
//! Every check here runs before any database write: an invalid bundle is
//! rejected as a whole and the existing data is left untouched.

use std::collections::{BTreeSet, HashSet};

use crate::ddragon::model::{ChampionFullFile, ItemFile, RawChampion, RawRuneTree};
use crate::ddragon::SOURCE_NAME;
use crate::error::AppError;

/// Ability slots in Data Dragon order: passive, then spells[0..4] = Q, W, E, R.
pub const SPELL_SLOTS: [&str; 4] = ["Q", "W", "E", "R"];

#[derive(Debug, Clone)]
pub struct PatchBundle {
    pub version: String,
    pub language: String,
    pub champions: Vec<ChampionRecord>,
    pub items: Vec<ItemRecord>,
    pub rune_trees: Vec<RuneTreeRecord>,
}

impl PatchBundle {
    pub fn spell_count(&self) -> usize {
        self.champions.iter().map(|c| c.spells.len()).sum()
    }

    pub fn skin_count(&self) -> usize {
        self.champions.iter().map(|c| c.skins.len()).sum()
    }

    pub fn rune_count(&self) -> usize {
        self.rune_trees.iter().map(|t| t.runes.len()).sum()
    }
}

#[derive(Debug, Clone)]
pub struct ChampionRecord {
    /// Numeric Riot champion key (e.g. 103), stable across patches.
    pub id: i64,
    /// Data Dragon id (e.g. "Ahri"), used for image and URL names.
    pub ddragon_id: String,
    pub name: String,
    pub title: String,
    pub blurb: String,
    pub lore: String,
    pub tags: Vec<String>,
    pub partype: String,
    pub info_json: String,
    pub stats_json: String,
    pub image_file: String,
    /// Passive first, then Q, W, E, R.
    pub spells: Vec<SpellRecord>,
    pub skins: Vec<SkinRecord>,
}

#[derive(Debug, Clone)]
pub struct SpellRecord {
    pub slot: &'static str,
    pub spell_key: String,
    pub name: String,
    pub description: String,
    pub cooldown: Option<String>,
    pub cost: Option<String>,
    pub range: Option<String>,
    pub max_rank: Option<i64>,
    pub image_group: &'static str,
    pub image_file: String,
}

#[derive(Debug, Clone)]
pub struct SkinRecord {
    pub skin_id: i64,
    pub num: i64,
    pub name: String,
    pub has_chromas: bool,
}

#[derive(Debug, Clone)]
pub struct ItemRecord {
    pub item_id: i64,
    pub name: String,
    pub plaintext: String,
    pub description: String,
    pub gold_base: i64,
    pub gold_total: i64,
    pub gold_sell: i64,
    pub purchasable: bool,
    pub in_store: bool,
    pub tags_json: String,
    pub maps_json: String,
    pub builds_from_json: String,
    pub builds_into_json: String,
    pub image_file: String,
}

#[derive(Debug, Clone)]
pub struct RuneTreeRecord {
    pub tree_id: i64,
    pub key: String,
    pub name: String,
    pub icon_path: String,
    pub runes: Vec<RuneRecord>,
}

#[derive(Debug, Clone)]
pub struct RuneRecord {
    pub rune_id: i64,
    pub slot_index: i64,
    pub key: String,
    pub name: String,
    pub short_desc: String,
    pub long_desc: String,
    pub icon_path: String,
}

fn invalid(detail: impl Into<String>) -> AppError {
    AppError::SourceData {
        source_name: SOURCE_NAME,
        detail: detail.into(),
    }
}

fn non_empty(value: &str, what: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        Err(invalid(format!("{what} vuoto")))
    } else {
        Ok(())
    }
}

fn blank_to_none(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.trim().is_empty())
}

/// True for regular release versions such as "16.22.1" (versions.json also
/// lists legacy entries like "lolpatch_3.7", which are ignored).
pub fn is_release_version(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

/// Numeric ordering key for release versions ("16.9.1" < "16.10.1").
pub fn version_key(version: &str) -> Option<(u32, u32, u32)> {
    if !is_release_version(version) {
        return None;
    }
    let mut parts = version.split('.').map(|part| part.parse::<u32>().ok());
    Some((parts.next()??, parts.next()??, parts.next()??))
}

/// Picks the newest release version from versions.json.
pub fn newest_release(versions: &[String]) -> Option<String> {
    versions
        .iter()
        .filter_map(|version| version_key(version).map(|key| (key, version)))
        .max_by_key(|(key, _)| *key)
        .map(|(_, version)| version.clone())
}

pub fn build_bundle(
    version: &str,
    language: &str,
    champions: ChampionFullFile,
    items: ItemFile,
    rune_trees: Vec<RawRuneTree>,
) -> Result<PatchBundle, AppError> {
    if !is_release_version(version) {
        return Err(invalid(format!("versione non valida: {version}")));
    }
    if champions.version != version {
        return Err(invalid(format!(
            "championFull.json è della versione {} invece di {version}",
            champions.version
        )));
    }
    if items.version != version {
        return Err(invalid(format!(
            "item.json è della versione {} invece di {version}",
            items.version
        )));
    }
    if champions.data.is_empty() {
        return Err(invalid("nessun campione presente"));
    }

    let mut champion_ids = HashSet::new();
    let mut ddragon_ids = HashSet::new();
    let mut skin_ids = HashSet::new();
    let mut champion_records = Vec::with_capacity(champions.data.len());

    for (map_key, raw) in champions.data {
        if map_key != raw.id {
            return Err(invalid(format!(
                "chiave {map_key} diversa dall'id del campione {}",
                raw.id
            )));
        }
        let record = convert_champion(raw)?;
        if !champion_ids.insert(record.id) {
            return Err(invalid(format!("id campione duplicato: {}", record.id)));
        }
        if !ddragon_ids.insert(record.ddragon_id.to_lowercase()) {
            return Err(invalid(format!(
                "campione duplicato: {}",
                record.ddragon_id
            )));
        }
        for skin in &record.skins {
            if !skin_ids.insert(skin.skin_id) {
                return Err(invalid(format!("id skin duplicato: {}", skin.skin_id)));
            }
        }
        champion_records.push(record);
    }

    let mut item_records = Vec::with_capacity(items.data.len());
    for (item_key, raw) in items.data {
        let item_id: i64 = item_key
            .parse()
            .ok()
            .filter(|id: &i64| *id > 0)
            .ok_or_else(|| invalid(format!("id oggetto non numerico: {item_key}")))?;
        non_empty(&raw.image.full, &format!("immagine dell'oggetto {item_id}"))?;
        item_records.push(ItemRecord {
            item_id,
            name: raw.name,
            plaintext: raw.plaintext,
            description: raw.description,
            gold_base: raw.gold.base,
            gold_total: raw.gold.total,
            gold_sell: raw.gold.sell,
            purchasable: raw.gold.purchasable,
            in_store: raw.in_store.unwrap_or(true),
            tags_json: serde_json::to_string(&raw.tags)?,
            maps_json: serde_json::to_string(&raw.maps)?,
            builds_from_json: serde_json::to_string(&raw.from)?,
            builds_into_json: serde_json::to_string(&raw.into)?,
            image_file: raw.image.full,
        });
    }

    if rune_trees.is_empty() {
        return Err(invalid("nessun albero di rune presente"));
    }
    let mut tree_ids = HashSet::new();
    let mut rune_ids = HashSet::new();
    let mut tree_records = Vec::with_capacity(rune_trees.len());
    for tree in rune_trees {
        if !tree_ids.insert(tree.id) {
            return Err(invalid(format!("albero di rune duplicato: {}", tree.id)));
        }
        non_empty(&tree.name, "nome albero di rune")?;
        non_empty(&tree.icon, "icona albero di rune")?;
        let mut runes = Vec::new();
        for (slot_index, slot) in tree.slots.into_iter().enumerate() {
            for rune in slot.runes {
                if !rune_ids.insert(rune.id) {
                    return Err(invalid(format!("runa duplicata: {}", rune.id)));
                }
                non_empty(&rune.name, "nome runa")?;
                non_empty(&rune.icon, &format!("icona della runa {}", rune.id))?;
                runes.push(RuneRecord {
                    rune_id: rune.id,
                    slot_index: slot_index as i64,
                    key: rune.key,
                    name: rune.name,
                    short_desc: rune.short_desc,
                    long_desc: rune.long_desc,
                    icon_path: rune.icon,
                });
            }
        }
        tree_records.push(RuneTreeRecord {
            tree_id: tree.id,
            key: tree.key,
            name: tree.name,
            icon_path: tree.icon,
            runes,
        });
    }

    Ok(PatchBundle {
        version: version.to_string(),
        language: language.to_string(),
        champions: champion_records,
        items: item_records,
        rune_trees: tree_records,
    })
}

fn convert_champion(raw: RawChampion) -> Result<ChampionRecord, AppError> {
    let id: i64 = raw
        .key
        .parse()
        .ok()
        .filter(|id: &i64| *id > 0)
        .ok_or_else(|| invalid(format!("chiave numerica non valida per {}", raw.id)))?;

    non_empty(&raw.id, "id campione")?;
    non_empty(&raw.name, &format!("nome del campione {}", raw.id))?;
    non_empty(
        &raw.image.full,
        &format!("immagine del campione {}", raw.id),
    )?;

    if raw.spells.len() != SPELL_SLOTS.len() {
        return Err(invalid(format!(
            "{} ha {} abilità invece di 4",
            raw.id,
            raw.spells.len()
        )));
    }

    let mut spells = Vec::with_capacity(5);
    non_empty(&raw.passive.name, &format!("passiva di {}", raw.id))?;
    non_empty(
        &raw.passive.image.full,
        &format!("icona passiva di {}", raw.id),
    )?;
    spells.push(SpellRecord {
        slot: "P",
        spell_key: raw.passive.image.full.clone(),
        name: raw.passive.name,
        description: raw.passive.description,
        cooldown: None,
        cost: None,
        range: None,
        max_rank: None,
        image_group: "passive",
        image_file: raw.passive.image.full,
    });

    let mut spell_keys = HashSet::new();
    for (slot, spell) in SPELL_SLOTS.iter().zip(raw.spells) {
        non_empty(&spell.id, &format!("id abilità {slot} di {}", raw.id))?;
        non_empty(&spell.name, &format!("nome abilità {slot} di {}", raw.id))?;
        non_empty(
            &spell.image.full,
            &format!("icona abilità {slot} di {}", raw.id),
        )?;
        if !spell_keys.insert(spell.id.clone()) {
            return Err(invalid(format!(
                "abilità duplicata {} in {}",
                spell.id, raw.id
            )));
        }
        spells.push(SpellRecord {
            slot,
            spell_key: spell.id,
            name: spell.name,
            description: spell.description,
            cooldown: blank_to_none(spell.cooldown_burn),
            cost: blank_to_none(spell.cost_burn),
            range: blank_to_none(spell.range_burn),
            max_rank: spell.maxrank.filter(|rank| *rank > 0),
            image_group: "spell",
            image_file: spell.image.full,
        });
    }

    if raw.skins.is_empty() {
        return Err(invalid(format!("{} non ha skin", raw.id)));
    }
    let mut nums = BTreeSet::new();
    let mut skins = Vec::with_capacity(raw.skins.len());
    for skin in raw.skins {
        let skin_id: i64 = skin
            .id
            .parse()
            .ok()
            .filter(|id: &i64| *id > 0)
            .ok_or_else(|| invalid(format!("id skin non valido per {}", raw.id)))?;
        if skin.num < 0 || !nums.insert(skin.num) {
            return Err(invalid(format!(
                "numero skin {} non valido per {}",
                skin.num, raw.id
            )));
        }
        // Data Dragon names the base skin "default": show the champion name.
        let name = if skin.num == 0 || skin.name.trim().is_empty() || skin.name == "default" {
            raw.name.clone()
        } else {
            skin.name
        };
        skins.push(SkinRecord {
            skin_id,
            num: skin.num,
            name,
            has_chromas: skin.chromas,
        });
    }
    if !nums.contains(&0) {
        return Err(invalid(format!("{} non ha la skin base (num 0)", raw.id)));
    }

    Ok(ChampionRecord {
        id,
        info_json: serde_json::to_string(&raw.info)?,
        stats_json: serde_json::to_string(&raw.stats)?,
        ddragon_id: raw.id,
        name: raw.name,
        title: raw.title,
        blurb: raw.blurb,
        lore: raw.lore,
        tags: raw.tags,
        partype: raw.partype,
        image_file: raw.image.full,
        spells,
        skins,
    })
}

/// Turns Data Dragon rich text into plain text: `<br>` becomes a newline,
/// every other tag is dropped and common entities are decoded. The UI never
/// renders upstream HTML.
pub fn html_to_text(input: &str) -> String {
    let mut output = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '<' {
            let mut tag = String::new();
            for next in chars.by_ref() {
                if next == '>' {
                    break;
                }
                tag.push(next);
            }
            let name = tag
                .trim_start_matches('/')
                .split(|c: char| c.is_whitespace() || c == '/')
                .next()
                .unwrap_or("")
                .to_ascii_lowercase();
            if name == "br" || name == "li" || name == "p" {
                output.push('\n');
            }
        } else {
            output.push(ch);
        }
    }

    let decoded = output
        .replace("&nbsp;", " ")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&amp;", "&");

    let mut lines: Vec<String> = decoded
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect();

    // Collapse runs of empty lines to a single paragraph break.
    lines.dedup_by(|a, b| a.is_empty() && b.is_empty());
    lines.join("\n").trim().to_string()
}
