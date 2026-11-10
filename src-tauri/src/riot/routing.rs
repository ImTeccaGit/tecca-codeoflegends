//! Riot API routing. Platform routing values (euw1, na1, …) serve
//! platform-scoped APIs (summoner-v4, league-v4, lol-status-v4); regional
//! clusters (americas, europe, asia, sea) serve account-v1 and match-v5.
//! Docs: https://developer.riotgames.com/docs/lol#routing-values

/// Supported platform routing values. Mirrored by `RIOT_REGIONS` in
/// `src/types/system.ts`.
pub const PLATFORMS: &[&str] = &[
    "euw1", "eun1", "na1", "kr", "br1", "jp1", "ru", "oc1", "tr1", "la1", "la2", "me1", "sg2",
    "tw2", "vn2",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Regional {
    Americas,
    Europe,
    Asia,
    Sea,
}

impl Regional {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Americas => "americas",
            Self::Europe => "europe",
            Self::Asia => "asia",
            Self::Sea => "sea",
        }
    }
}

pub fn is_platform(platform: &str) -> bool {
    PLATFORMS.contains(&platform)
}

/// Cluster for match-v5.
pub fn match_region(platform: &str) -> Option<Regional> {
    Some(match platform {
        "na1" | "br1" | "la1" | "la2" => Regional::Americas,
        "euw1" | "eun1" | "tr1" | "ru" | "me1" => Regional::Europe,
        "kr" | "jp1" => Regional::Asia,
        "oc1" | "sg2" | "tw2" | "vn2" => Regional::Sea,
        _ => return None,
    })
}

/// Cluster for account-v1, which has no `sea` cluster: accounts are global and
/// can be queried from any cluster, so SEA platforms use the nearest (asia).
pub fn account_region(platform: &str) -> Option<Regional> {
    match match_region(platform)? {
        Regional::Sea => Some(Regional::Asia),
        other => Some(other),
    }
}

pub fn platform_host(platform: &str) -> String {
    format!("https://{platform}.api.riotgames.com")
}

pub fn regional_host(region: Regional) -> String {
    format!("https://{}.api.riotgames.com", region.as_str())
}

/// Percent-encodes one URL path segment (Riot IDs may contain spaces and
/// non-ASCII characters).
pub fn encode_segment(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}
