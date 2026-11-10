-- Corsie assegnate dall'utente ai campioni.
--
-- Riot Data Dragon non pubblica le corsie (solo le classi): questi valori sono
-- scelte personali dell'utente, mai dati presentati come ufficiali. Sono legati
-- all'id stabile del campione, quindi sopravvivono ai cambi di patch.
-- I preferiti usano la tabella `favorite_champions` della migrazione 0001.

CREATE TABLE user_champion_lanes (
    champion_id INTEGER NOT NULL REFERENCES champions(id) ON DELETE CASCADE,
    lane TEXT NOT NULL CHECK (lane IN ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (champion_id, lane)
) STRICT;

CREATE INDEX idx_user_champion_lanes_lane ON user_champion_lanes (lane, champion_id);
