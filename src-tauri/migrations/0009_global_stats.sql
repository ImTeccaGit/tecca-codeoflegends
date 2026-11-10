-- Statistiche globali per campione (rune, oggetti, incantesimi, counter).
--
-- Raccolta opt-in fatta dall'app con la chiave Riot dell'utente:
-- league-v4 (classifiche della fascia scelta) → match-v5 (partite
-- classificate Solo/Duo dei giocatori trovati). Si salvano solo i campi
-- necessari alle aggregazioni, non la risposta completa. Nessun valore
-- stimato: le percentuali sono calcolate al volo da queste righe.
--
-- * `global_stats_settings`: unica riga con preferenze della raccolta.
-- * `global_seed_players`: giocatori da cui partire, con l'ultima lettura.
-- * `global_seed_sources`: ultimo aggiornamento della lista per regione/fascia.
-- * `global_matches`, `global_participants`, `global_bans`: dati delle partite.
--   `seed_tier` è la fascia del giocatore da cui la partita è stata trovata:
--   il rank degli altri 9 partecipanti non è verificato.

CREATE TABLE global_stats_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
    platform TEXT NOT NULL DEFAULT 'euw1' CHECK (length(platform) BETWEEN 2 AND 8),
    seed_tier TEXT NOT NULL DEFAULT 'MASTER_PLUS'
        CHECK (seed_tier IN ('MASTER_PLUS', 'DIAMOND', 'EMERALD', 'PLATINUM')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

INSERT INTO global_stats_settings (id) VALUES (1);

CREATE TABLE global_seed_sources (
    platform TEXT NOT NULL,
    seed_tier TEXT NOT NULL,
    refreshed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    player_count INTEGER NOT NULL CHECK (player_count >= 0),
    PRIMARY KEY (platform, seed_tier)
) STRICT;

CREATE TABLE global_seed_players (
    platform TEXT NOT NULL,
    puuid TEXT NOT NULL CHECK (length(puuid) BETWEEN 1 AND 128),
    seed_tier TEXT NOT NULL,
    added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    crawled_at TEXT,
    PRIMARY KEY (platform, puuid)
) STRICT;

CREATE INDEX idx_global_seed_players_next ON global_seed_players (platform, seed_tier, crawled_at);

CREATE TABLE global_matches (
    match_id TEXT PRIMARY KEY CHECK (length(match_id) BETWEEN 3 AND 64),
    platform TEXT NOT NULL,
    patch TEXT NOT NULL CHECK (patch GLOB '[0-9]*.[0-9]*'),
    game_version TEXT NOT NULL,
    queue_id INTEGER NOT NULL,
    game_creation_ms INTEGER NOT NULL,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 0),
    ended_early INTEGER NOT NULL CHECK (ended_early IN (0, 1)),
    seed_tier TEXT NOT NULL,
    fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_global_matches_patch ON global_matches (patch);

CREATE TABLE global_participants (
    match_id TEXT NOT NULL REFERENCES global_matches(match_id) ON DELETE CASCADE,
    participant_index INTEGER NOT NULL CHECK (participant_index BETWEEN 0 AND 9),
    champion_id INTEGER NOT NULL CHECK (champion_id > 0),
    team_id INTEGER NOT NULL,
    team_position TEXT NOT NULL
        CHECK (team_position IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY', '')),
    win INTEGER NOT NULL CHECK (win IN (0, 1)),
    -- "primario|r1,r2,r3,r4|secondario|r5,r6|offesa,flessibile,difesa";
    -- NULL se la risposta non contiene una pagina di rune completa.
    rune_page TEXT,
    keystone INTEGER,
    -- Coppia ordinata "4,12".
    summoner_spells TEXT NOT NULL,
    items_json TEXT NOT NULL CHECK (json_valid(items_json) AND json_type(items_json) = 'array'),
    PRIMARY KEY (match_id, participant_index)
) STRICT;

CREATE INDEX idx_global_participants_champion ON global_participants (champion_id, team_position);

CREATE TABLE global_bans (
    match_id TEXT NOT NULL REFERENCES global_matches(match_id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL,
    pick_turn INTEGER NOT NULL,
    champion_id INTEGER NOT NULL CHECK (champion_id > 0),
    PRIMARY KEY (match_id, team_id, pick_turn)
) STRICT;

CREATE INDEX idx_global_bans_champion ON global_bans (champion_id);
