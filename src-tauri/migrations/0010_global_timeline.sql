-- Statistiche globali: dati dalla timeline di match-v5 e partite personali.
--
-- * `skill_order`: abilità potenziate in ordine (Q, W, E, R), al massimo 18.
-- * `start_items_json`: oggetti comprati nei primi 90 secondi (annullamenti
--   esclusi). `purchases_json`: acquisti successivi in ordine.
-- * `global_matches.timeline_fetched`: 1 quando la timeline è stata letta.
-- Le partite già salvate restano senza timeline (NULL) e non entrano in
-- queste aggregazioni finché non vengono completate dalla raccolta.
-- Le partite personali (già salvate dall'app) vengono copiate con
-- seed_tier = 'PERSONAL' e sono tenute separate dalle statistiche globali.

ALTER TABLE global_participants ADD COLUMN skill_order TEXT
    CHECK (skill_order IS NULL OR skill_order NOT GLOB '*[^QWER]*');
ALTER TABLE global_participants ADD COLUMN start_items_json TEXT
    CHECK (start_items_json IS NULL OR (json_valid(start_items_json) AND json_type(start_items_json) = 'array'));
ALTER TABLE global_participants ADD COLUMN purchases_json TEXT
    CHECK (purchases_json IS NULL OR (json_valid(purchases_json) AND json_type(purchases_json) = 'array'));
ALTER TABLE global_matches ADD COLUMN timeline_fetched INTEGER NOT NULL DEFAULT 0
    CHECK (timeline_fetched IN (0, 1));

CREATE INDEX idx_global_matches_tier ON global_matches (seed_tier, timeline_fetched);
