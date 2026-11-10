//! Riot Data Dragon: public, versioned static data (champions, items, runes).
//! Docs: https://developer.riotgames.com/docs/lol#data-dragon

pub mod bundle;
pub mod client;
pub mod model;
pub mod sync;

pub const SOURCE_NAME: &str = "Riot Data Dragon";
pub const DDRAGON_BASE_URL: &str = "https://ddragon.leagueoflegends.com";
/// Language of imported texts. The UI is Italian.
pub const LANGUAGE: &str = "it_IT";

/// Image URLs built from stored file names and the patch version.
pub mod urls {
    use super::DDRAGON_BASE_URL;

    pub fn champion_square(version: &str, file: &str) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/{version}/img/champion/{file}")
    }

    pub fn spell(version: &str, group: &str, file: &str) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/{version}/img/{group}/{file}")
    }

    // Items and runes are imported now; their screens arrive with the Build
    // and Rune builders (phase 3). Until then only the image tests use these.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn item(version: &str, file: &str) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/{version}/img/item/{file}")
    }

    /// Rune icons are not versioned on the CDN.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn rune(icon_path: &str) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/img/{icon_path}")
    }

    /// Skin art is not versioned on the CDN (always the current art).
    pub fn skin_splash(ddragon_id: &str, num: i64) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/img/champion/splash/{ddragon_id}_{num}.jpg")
    }

    pub fn skin_loading(ddragon_id: &str, num: i64) -> String {
        format!("{DDRAGON_BASE_URL}/cdn/img/champion/loading/{ddragon_id}_{num}.jpg")
    }
}
