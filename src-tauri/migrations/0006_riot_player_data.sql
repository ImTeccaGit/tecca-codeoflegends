-- Dati giocatore dalla Riot API ufficiale (account-v1, summoner-v4, league-v4,
-- match-v5). Solo dati reali restituiti da Riot: nessun valore dimostrativo.
--
-- * Una partita è condivisa da più giocatori: il collegamento giocatore↔partita
--   vive in `player_matches` (la colonna `matches.player_puuid` della 0001
--   resta inutilizzata).
-- * Le partite concluse sono immutabili: vengono scaricate una sola volta.
-- * `matches.raw_json` conserva la risposta originale di match-v5.

ALTER TABLE matches ADD COLUMN game_mode TEXT;
ALTER TABLE matches ADD COLUMN map_id INTEGER;
ALTER TABLE matches ADD COLUMN ended_early INTEGER NOT NULL DEFAULT 0 CHECK (ended_early IN (0, 1));

ALTER TABLE match_participants ADD COLUMN riot_id TEXT;
ALTER TABLE match_participants ADD COLUMN champion_name TEXT;
ALTER TABLE match_participants ADD COLUMN champ_level INTEGER;
ALTER TABLE match_participants ADD COLUMN team_position TEXT;
ALTER TABLE match_participants ADD COLUMN items_json TEXT;
ALTER TABLE match_participants ADD COLUMN perks_json TEXT;
ALTER TABLE match_participants ADD COLUMN summoner_spells_json TEXT;
ALTER TABLE match_participants ADD COLUMN damage_to_champions INTEGER;

CREATE TABLE player_matches (
    puuid TEXT NOT NULL REFERENCES players(puuid) ON DELETE CASCADE,
    match_id TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    PRIMARY KEY (puuid, match_id)
) STRICT;

CREATE TABLE player_ranked (
    puuid TEXT NOT NULL REFERENCES players(puuid) ON DELETE CASCADE,
    queue_type TEXT NOT NULL CHECK (length(queue_type) > 0),
    tier TEXT NOT NULL,
    division TEXT,
    league_points INTEGER NOT NULL CHECK (league_points >= 0),
    wins INTEGER NOT NULL CHECK (wins >= 0),
    losses INTEGER NOT NULL CHECK (losses >= 0),
    hot_streak INTEGER NOT NULL DEFAULT 0 CHECK (hot_streak IN (0, 1)),
    fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (puuid, queue_type)
) STRICT;

CREATE TABLE saved_profiles (
    puuid TEXT PRIMARY KEY REFERENCES players(puuid) ON DELETE CASCADE,
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    saved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Al massimo un profilo principale.
CREATE UNIQUE INDEX idx_saved_profiles_primary ON saved_profiles (is_primary) WHERE is_primary = 1;

-- Momento dell'ultimo recupero per ogni tipo di dato (cache e sincronizzazione).
CREATE TABLE player_sync (
    puuid TEXT PRIMARY KEY REFERENCES players(puuid) ON DELETE CASCADE,
    profile_synced_at TEXT,
    ranked_synced_at TEXT,
    matches_synced_at TEXT,
    last_error TEXT
) STRICT;

CREATE INDEX idx_player_matches_match ON player_matches (match_id);
CREATE INDEX idx_players_riot_id ON players (lower(game_name), lower(tag_line), region);
