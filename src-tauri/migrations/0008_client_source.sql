-- Account automatico dal client di League of Legends (LCU, sola lettura).
--
-- * `matches.source`: dove è stata letta la partita. 'riot-api' = match-v5
--   con la chiave dell'utente; 'league-client' = cronologia del client locale.
--   Le partite già presenti vengono tutte dalla Riot API.
-- * `player_sync.client_synced_at`: ultima lettura dal client locale.

ALTER TABLE matches ADD COLUMN source TEXT NOT NULL DEFAULT 'riot-api'
    CHECK (source IN ('riot-api', 'league-client'));

ALTER TABLE player_sync ADD COLUMN client_synced_at TEXT;
