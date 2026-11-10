-- Impostazioni predefinite e primo evento locale reale.
-- I valori sono JSON serializzati: il backend li valida prima dell'uso.

INSERT INTO settings (key, value)
VALUES ('region', '"euw1"')
ON CONFLICT(key) DO NOTHING;

INSERT INTO settings (key, value)
VALUES ('reduce_motion', 'false')
ON CONFLICT(key) DO NOTHING;

INSERT INTO activity_log (kind, title, detail)
SELECT
    'database',
    'Database locale inizializzato',
    'Migrazioni applicate e schema locale pronto.'
WHERE NOT EXISTS (
    SELECT 1
    FROM activity_log
    WHERE kind = 'database' AND title = 'Database locale inizializzato'
);
