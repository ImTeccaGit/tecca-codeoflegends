-- Catalogo statico Riot Data Dragon, versionato per patch.
--
-- Regole:
-- * Ogni import aggiunge righe legate a una riga di `patch_versions`.
-- * Le righe di una patch non vengono mai aggiornate né cancellate (trigger):
--   i dati storici restano disponibili per le partite delle patch passate.
-- * `champions` (migrazione 0001) resta l'identità stabile del campione:
--   `id` = chiave numerica Riot (es. 103), `champion_key` = id Data Dragon
--   (es. "Ahri"). Preferiti, build, rune e note continuano a riferirla.
-- * Le immagini sono salvate come nome file Data Dragon: l'URL completo viene
--   costruito dal backend con la versione della patch.

CREATE TABLE patch_versions (
    version TEXT PRIMARY KEY
        CHECK (version GLOB '[0-9]*.[0-9]*.[0-9]*'),
    language TEXT NOT NULL CHECK (length(language) > 0),
    source TEXT NOT NULL CHECK (source = 'data_dragon'),
    source_url TEXT NOT NULL CHECK (source_url LIKE 'https://%'),
    champion_count INTEGER NOT NULL CHECK (champion_count > 0),
    spell_count INTEGER NOT NULL CHECK (spell_count > 0),
    skin_count INTEGER NOT NULL CHECK (skin_count > 0),
    item_count INTEGER NOT NULL CHECK (item_count >= 0),
    rune_count INTEGER NOT NULL CHECK (rune_count >= 0),
    imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE champion_versions (
    champion_id INTEGER NOT NULL REFERENCES champions(id),
    patch_version TEXT NOT NULL REFERENCES patch_versions(version),
    ddragon_id TEXT NOT NULL CHECK (length(ddragon_id) > 0),
    name TEXT NOT NULL CHECK (length(name) > 0),
    title TEXT NOT NULL,
    blurb TEXT NOT NULL,
    lore TEXT NOT NULL,
    tags_json TEXT NOT NULL CHECK (json_valid(tags_json) AND json_type(tags_json) = 'array'),
    partype TEXT NOT NULL,
    info_json TEXT NOT NULL CHECK (json_valid(info_json) AND json_type(info_json) = 'object'),
    stats_json TEXT NOT NULL CHECK (json_valid(stats_json) AND json_type(stats_json) = 'object'),
    image_file TEXT NOT NULL CHECK (length(image_file) > 0),
    PRIMARY KEY (champion_id, patch_version),
    UNIQUE (patch_version, ddragon_id)
) STRICT;

CREATE TABLE champion_spells (
    champion_id INTEGER NOT NULL,
    patch_version TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('P', 'Q', 'W', 'E', 'R')),
    spell_key TEXT NOT NULL CHECK (length(spell_key) > 0),
    name TEXT NOT NULL CHECK (length(name) > 0),
    description TEXT NOT NULL,
    cooldown TEXT,
    cost TEXT,
    spell_range TEXT,
    max_rank INTEGER CHECK (max_rank IS NULL OR max_rank > 0),
    image_group TEXT NOT NULL CHECK (image_group IN ('spell', 'passive')),
    image_file TEXT NOT NULL CHECK (length(image_file) > 0),
    PRIMARY KEY (champion_id, patch_version, slot),
    FOREIGN KEY (champion_id, patch_version)
        REFERENCES champion_versions(champion_id, patch_version),
    CHECK ((slot = 'P') = (image_group = 'passive'))
) STRICT;

CREATE TABLE champion_skins (
    patch_version TEXT NOT NULL,
    skin_id INTEGER NOT NULL CHECK (skin_id > 0),
    champion_id INTEGER NOT NULL,
    num INTEGER NOT NULL CHECK (num >= 0),
    name TEXT NOT NULL CHECK (length(name) > 0),
    has_chromas INTEGER NOT NULL CHECK (has_chromas IN (0, 1)),
    PRIMARY KEY (patch_version, skin_id),
    UNIQUE (patch_version, champion_id, num),
    FOREIGN KEY (champion_id, patch_version)
        REFERENCES champion_versions(champion_id, patch_version)
) STRICT;

CREATE TABLE items (
    patch_version TEXT NOT NULL REFERENCES patch_versions(version),
    item_id INTEGER NOT NULL CHECK (item_id > 0),
    name TEXT NOT NULL,
    plaintext TEXT NOT NULL,
    description TEXT NOT NULL,
    gold_base INTEGER NOT NULL,
    gold_total INTEGER NOT NULL,
    gold_sell INTEGER NOT NULL,
    purchasable INTEGER NOT NULL CHECK (purchasable IN (0, 1)),
    in_store INTEGER NOT NULL CHECK (in_store IN (0, 1)),
    tags_json TEXT NOT NULL CHECK (json_valid(tags_json) AND json_type(tags_json) = 'array'),
    maps_json TEXT NOT NULL CHECK (json_valid(maps_json) AND json_type(maps_json) = 'object'),
    builds_from_json TEXT NOT NULL CHECK (json_valid(builds_from_json) AND json_type(builds_from_json) = 'array'),
    builds_into_json TEXT NOT NULL CHECK (json_valid(builds_into_json) AND json_type(builds_into_json) = 'array'),
    image_file TEXT NOT NULL CHECK (length(image_file) > 0),
    PRIMARY KEY (patch_version, item_id)
) STRICT;

CREATE TABLE rune_trees (
    patch_version TEXT NOT NULL REFERENCES patch_versions(version),
    tree_id INTEGER NOT NULL CHECK (tree_id > 0),
    tree_key TEXT NOT NULL CHECK (length(tree_key) > 0),
    name TEXT NOT NULL CHECK (length(name) > 0),
    icon_path TEXT NOT NULL CHECK (length(icon_path) > 0),
    PRIMARY KEY (patch_version, tree_id)
) STRICT;

CREATE TABLE runes (
    patch_version TEXT NOT NULL,
    rune_id INTEGER NOT NULL CHECK (rune_id > 0),
    tree_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL CHECK (slot_index >= 0),
    rune_key TEXT NOT NULL CHECK (length(rune_key) > 0),
    name TEXT NOT NULL CHECK (length(name) > 0),
    short_desc TEXT NOT NULL,
    long_desc TEXT NOT NULL,
    icon_path TEXT NOT NULL CHECK (length(icon_path) > 0),
    PRIMARY KEY (patch_version, rune_id),
    FOREIGN KEY (patch_version, tree_id)
        REFERENCES rune_trees(patch_version, tree_id)
) STRICT;

-- Registro dei controlli automatici e manuali delle nuove versioni.
CREATE TABLE data_dragon_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    latest_version TEXT,
    outcome TEXT NOT NULL CHECK (outcome IN ('up_to_date', 'imported', 'failed')),
    detail TEXT
) STRICT;

CREATE INDEX idx_champion_versions_patch ON champion_versions (patch_version, name);
CREATE INDEX idx_champion_skins_champion ON champion_skins (champion_id, patch_version, num);
CREATE INDEX idx_items_patch ON items (patch_version, name);
CREATE INDEX idx_runes_tree ON runes (patch_version, tree_id, slot_index);
CREATE INDEX idx_data_dragon_checks_time ON data_dragon_checks (checked_at DESC);

-- Dati storici immutabili: nessuna modifica o cancellazione dopo l'import.
CREATE TRIGGER patch_versions_immutable_update BEFORE UPDATE ON patch_versions
BEGIN SELECT RAISE(ABORT, 'patch_versions: i dati di patch importati sono immutabili'); END;
CREATE TRIGGER patch_versions_immutable_delete BEFORE DELETE ON patch_versions
BEGIN SELECT RAISE(ABORT, 'patch_versions: i dati di patch importati non si cancellano'); END;

CREATE TRIGGER champion_versions_immutable_update BEFORE UPDATE ON champion_versions
BEGIN SELECT RAISE(ABORT, 'champion_versions: dati storici immutabili'); END;
CREATE TRIGGER champion_versions_immutable_delete BEFORE DELETE ON champion_versions
BEGIN SELECT RAISE(ABORT, 'champion_versions: dati storici immutabili'); END;

CREATE TRIGGER champion_spells_immutable_update BEFORE UPDATE ON champion_spells
BEGIN SELECT RAISE(ABORT, 'champion_spells: dati storici immutabili'); END;
CREATE TRIGGER champion_spells_immutable_delete BEFORE DELETE ON champion_spells
BEGIN SELECT RAISE(ABORT, 'champion_spells: dati storici immutabili'); END;

CREATE TRIGGER champion_skins_immutable_update BEFORE UPDATE ON champion_skins
BEGIN SELECT RAISE(ABORT, 'champion_skins: dati storici immutabili'); END;
CREATE TRIGGER champion_skins_immutable_delete BEFORE DELETE ON champion_skins
BEGIN SELECT RAISE(ABORT, 'champion_skins: dati storici immutabili'); END;

CREATE TRIGGER items_immutable_update BEFORE UPDATE ON items
BEGIN SELECT RAISE(ABORT, 'items: dati storici immutabili'); END;
CREATE TRIGGER items_immutable_delete BEFORE DELETE ON items
BEGIN SELECT RAISE(ABORT, 'items: dati storici immutabili'); END;

CREATE TRIGGER rune_trees_immutable_update BEFORE UPDATE ON rune_trees
BEGIN SELECT RAISE(ABORT, 'rune_trees: dati storici immutabili'); END;
CREATE TRIGGER rune_trees_immutable_delete BEFORE DELETE ON rune_trees
BEGIN SELECT RAISE(ABORT, 'rune_trees: dati storici immutabili'); END;

CREATE TRIGGER runes_immutable_update BEFORE UPDATE ON runes
BEGIN SELECT RAISE(ABORT, 'runes: dati storici immutabili'); END;
CREATE TRIGGER runes_immutable_delete BEFORE DELETE ON runes
BEGIN SELECT RAISE(ABORT, 'runes: dati storici immutabili'); END;
