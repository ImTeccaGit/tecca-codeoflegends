-- Schema iniziale di Tecca CodeOfLegends.
-- Le migrazioni sono append-only: non modificare un file già applicato.

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS champions (
    id INTEGER PRIMARY KEY,
    champion_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    title TEXT,
    roles_json TEXT NOT NULL DEFAULT '[]',
    image_url TEXT,
    data_version TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS favorite_champions (
    champion_id INTEGER PRIMARY KEY REFERENCES champions(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS rune_pages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    champion_id INTEGER REFERENCES champions(id) ON DELETE SET NULL,
    primary_tree TEXT NOT NULL,
    secondary_tree TEXT NOT NULL,
    shards_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS builds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    champion_id INTEGER REFERENCES champions(id) ON DELETE SET NULL,
    role TEXT,
    items_json TEXT NOT NULL DEFAULT '[]',
    skill_order_json TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS jungle_routes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    champion_id INTEGER REFERENCES champions(id) ON DELETE SET NULL,
    side TEXT,
    steps_json TEXT NOT NULL DEFAULT '[]',
    patch TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS players (
    puuid TEXT PRIMARY KEY,
    game_name TEXT,
    tag_line TEXT,
    region TEXT NOT NULL,
    summoner_level INTEGER,
    profile_icon_id INTEGER,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS matches (
    match_id TEXT PRIMARY KEY,
    player_puuid TEXT REFERENCES players(puuid) ON DELETE CASCADE,
    region TEXT NOT NULL,
    queue_id INTEGER,
    game_version TEXT,
    game_creation INTEGER,
    game_duration INTEGER,
    raw_json TEXT,
    fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS match_participants (
    match_id TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    puuid TEXT NOT NULL,
    champion_id INTEGER,
    team_id INTEGER,
    role TEXT,
    kills INTEGER NOT NULL DEFAULT 0,
    deaths INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    win INTEGER NOT NULL DEFAULT 0,
    cs INTEGER NOT NULL DEFAULT 0,
    gold INTEGER NOT NULL DEFAULT 0,
    vision_score INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (match_id, puuid)
) STRICT;

CREATE TABLE IF NOT EXISTS matchup_notes (
    id TEXT PRIMARY KEY,
    champion_id INTEGER NOT NULL REFERENCES champions(id) ON DELETE CASCADE,
    opponent_id INTEGER NOT NULL REFERENCES champions(id) ON DELETE CASCADE,
    role TEXT,
    notes TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_activity_created_at
    ON activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_matches_player
    ON matches (player_puuid, game_creation DESC);

CREATE INDEX IF NOT EXISTS idx_match_participants_match
    ON match_participants (match_id);

CREATE INDEX IF NOT EXISTS idx_matchup_notes_champion
    ON matchup_notes (champion_id, opponent_id);
