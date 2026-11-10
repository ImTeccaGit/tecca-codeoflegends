-- Match Analysis & Matchups: campi di match-v5 non ancora estratti.
--
-- * `damage_taken`: totalDamageTaken del partecipante.
-- * `match_bans`: ban di ogni squadra (info.teams[].bans).
--
-- Le partite già salvate vengono completate da `matches.raw_json`, cioè dalla
-- risposta originale di Riot: nessun valore stimato. Se un campo manca nella
-- risposta resta NULL e l'interfaccia lo mostra come non disponibile.

ALTER TABLE match_participants ADD COLUMN damage_taken INTEGER;

UPDATE match_participants
SET damage_taken = (
    SELECT json_extract(participant.value, '$.totalDamageTaken')
    FROM matches, json_each(matches.raw_json, '$.info.participants') AS participant
    WHERE matches.match_id = match_participants.match_id
      AND json_valid(matches.raw_json)
      AND json_extract(participant.value, '$.puuid') = match_participants.puuid
);

CREATE TABLE match_bans (
    match_id TEXT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
    team_id INTEGER NOT NULL,
    pick_turn INTEGER NOT NULL,
    champion_id INTEGER NOT NULL CHECK (champion_id > 0),
    PRIMARY KEY (match_id, team_id, pick_turn)
) STRICT;

INSERT OR IGNORE INTO match_bans (match_id, team_id, pick_turn, champion_id)
SELECT matches.match_id,
       json_extract(team.value, '$.teamId'),
       json_extract(ban.value, '$.pickTurn'),
       json_extract(ban.value, '$.championId')
FROM matches,
     json_each(matches.raw_json, '$.info.teams') AS team,
     json_each(team.value, '$.bans') AS ban
WHERE json_valid(matches.raw_json)
  AND json_extract(ban.value, '$.championId') > 0
  AND json_extract(team.value, '$.teamId') IS NOT NULL
  AND json_extract(ban.value, '$.pickTurn') IS NOT NULL;

CREATE INDEX idx_match_bans_champion ON match_bans (champion_id);
CREATE INDEX idx_match_participants_champion ON match_participants (champion_id);
