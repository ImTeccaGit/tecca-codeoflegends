-- Allenamento jungle: tentativi di clear cronometrati dall'utente.
--
-- * Sono tempi di ALLENAMENTO registrati a mano (Practice Tool o simili), mai
--   timer di una partita live.
-- * Ogni tentativo conserva una copia del percorso (nome, lato, campi): lo
--   storico resta valido anche se un percorso personalizzato viene modificato
--   o eliminato.
-- * I percorsi personalizzati usano la tabella `jungle_routes` (0001).

CREATE TABLE jungle_clear_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_key TEXT NOT NULL CHECK (length(route_key) BETWEEN 1 AND 80),
    route_name TEXT NOT NULL CHECK (length(route_name) BETWEEN 1 AND 80),
    side TEXT NOT NULL CHECK (side IN ('blue', 'red')),
    camps_json TEXT NOT NULL CHECK (json_valid(camps_json) AND json_type(camps_json) = 'array'),
    total_ms INTEGER NOT NULL CHECK (total_ms > 0 AND total_ms <= 1800000),
    champion_id INTEGER REFERENCES champions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

-- Tempo cumulativo al completamento di ogni campo (millisecondi dall'avvio).
CREATE TABLE jungle_clear_splits (
    attempt_id INTEGER NOT NULL REFERENCES jungle_clear_attempts(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL CHECK (step_index >= 0),
    camp_id TEXT NOT NULL CHECK (length(camp_id) > 0),
    split_ms INTEGER NOT NULL CHECK (split_ms > 0),
    PRIMARY KEY (attempt_id, step_index)
) STRICT;

CREATE INDEX idx_jungle_attempts_route ON jungle_clear_attempts (route_key, created_at DESC);
