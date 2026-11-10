use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

use rusqlite::{params, Connection, OptionalExtension};

use crate::{
    error::AppError,
    models::{ActivityEntry, AppSettings, DatabaseStatus, SettingsPatch},
};

/// Migrazioni applicate in ordine. I file sono immutabili una volta rilasciati:
/// per cambiare lo schema si aggiunge una nuova voce.
const MIGRATIONS: &[(&str, &str)] = &[
    ("0001_init", include_str!("../migrations/0001_init.sql")),
    (
        "0002_defaults",
        include_str!("../migrations/0002_defaults.sql"),
    ),
    (
        "0003_data_dragon_catalog",
        include_str!("../migrations/0003_data_dragon_catalog.sql"),
    ),
    (
        "0004_user_champion_lanes",
        include_str!("../migrations/0004_user_champion_lanes.sql"),
    ),
    (
        "0005_jungle_training",
        include_str!("../migrations/0005_jungle_training.sql"),
    ),
    (
        "0006_riot_player_data",
        include_str!("../migrations/0006_riot_player_data.sql"),
    ),
    (
        "0007_match_analysis",
        include_str!("../migrations/0007_match_analysis.sql"),
    ),
    (
        "0008_client_source",
        include_str!("../migrations/0008_client_source.sql"),
    ),
    (
        "0009_global_stats",
        include_str!("../migrations/0009_global_stats.sql"),
    ),
    (
        "0010_global_timeline",
        include_str!("../migrations/0010_global_timeline.sql"),
    ),
];

const TABLES: &[&str] = &[
    "champions",
    "patch_versions",
    "champion_versions",
    "champion_spells",
    "champion_skins",
    "items",
    "rune_trees",
    "runes",
    "data_dragon_checks",
    "favorite_champions",
    "user_champion_lanes",
    "jungle_clear_attempts",
    "jungle_clear_splits",
    "player_matches",
    "player_ranked",
    "saved_profiles",
    "match_bans",
    "rune_pages",
    "builds",
    "jungle_routes",
    "players",
    "matches",
    "match_participants",
    "matchup_notes",
    "activity_log",
    "global_matches",
    "global_participants",
];

const VALID_REGIONS: &[&str] = crate::riot::routing::PLATFORMS;

/// Schema version this build migrates to.
pub fn schema_target() -> i64 {
    MIGRATIONS.len() as i64
}

pub struct Database {
    connection: Mutex<Connection>,
    path: PathBuf,
}

/// Stato gestito da Tauri. Se il database non si apre, l'app resta avviata in
/// modalità degradata: ogni comando restituisce un errore esplicito invece di
/// terminare il processo senza messaggi.
pub enum DatabaseSlot {
    Ready(Database),
    Unavailable { log_dir: Option<String> },
}

impl DatabaseSlot {
    pub fn get(&self) -> Result<&Database, AppError> {
        match self {
            Self::Ready(database) => Ok(database),
            Self::Unavailable { log_dir } => Err(AppError::DatabaseUnavailable {
                log_dir: log_dir.clone(),
            }),
        }
    }
}

impl Database {
    pub fn open(path: PathBuf) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let connection = Connection::open(&path)?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "busy_timeout", 5_000)?;

        let database = Self {
            connection: Mutex::new(connection),
            path,
        };

        database.check_compatible()?;
        database.backup_before_migration()?;
        database.migrate()?;
        database.log_activity(
            "system",
            "Applicazione avviata",
            Some("Sessione desktop inizializzata con database locale."),
        )?;
        database.prune_activity(200)?;

        Ok(database)
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::State("Connessione SQLite bloccata.".to_string()))
    }

    /// Runs a repository function with exclusive access to the connection.
    /// Used by domain modules (e.g. `catalog`) that own their SQL.
    pub fn with_connection<T>(
        &self,
        operation: impl FnOnce(&mut Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let mut connection = self.lock()?;
        operation(&mut connection)
    }

    #[cfg(test)]
    pub fn path(&self) -> PathBuf {
        self.path.clone()
    }

    fn user_version(&self) -> Result<i64, AppError> {
        let connection = self.lock()?;
        Ok(connection.query_row("PRAGMA user_version", [], |row| row.get(0))?)
    }

    /// A database written by a newer app version must not be opened (its
    /// schema is unknown here): the user gets a clear error, data untouched.
    fn check_compatible(&self) -> Result<(), AppError> {
        let current = self.user_version()?;
        if current > schema_target() {
            return Err(AppError::State(format!(
                "Il database locale (schema v{current}) è stato creato da una versione più recente dell'app (supporta fino a v{}). Installa la versione più recente: i dati non sono stati modificati.",
                schema_target()
            )));
        }
        Ok(())
    }

    /// Existing databases get a verified backup before any schema change.
    fn backup_before_migration(&self) -> Result<(), AppError> {
        let current = self.user_version()?;
        if current == 0 || current >= schema_target() {
            return Ok(());
        }
        let connection = self.lock()?;
        let info = crate::backup::create(&connection, &self.path, "pre-migration")?;
        log::info!(
            "Backup pre-migrazione v{current} -> v{}: {}",
            schema_target(),
            info.file_name
        );
        Ok(())
    }

    pub fn create_backup(&self, reason: &str) -> Result<crate::backup::BackupInfo, AppError> {
        let connection = self.lock()?;
        let info = crate::backup::create(&connection, &self.path, reason)?;
        drop(connection);
        if reason == "manual" {
            self.log_activity(
                "database",
                "Backup del database creato",
                Some(&info.file_name),
            )?;
        }
        Ok(info)
    }

    pub fn backups(&self) -> Result<Vec<crate::backup::BackupInfo>, AppError> {
        crate::backup::list_in(&crate::backup::backup_dir(&self.path))
    }

    fn migrate(&self) -> Result<(), AppError> {
        let connection = self.lock()?;
        let current: i64 = connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

        for (index, (name, sql)) in MIGRATIONS.iter().enumerate() {
            let version = (index + 1) as i64;

            if version <= current {
                continue;
            }

            let script = format!(
                "BEGIN;\n{}\nPRAGMA user_version = {};\nCOMMIT;",
                sql, version
            );

            if let Err(error) = connection.execute_batch(&script) {
                let _ = connection.execute_batch("ROLLBACK;");
                return Err(AppError::State(format!(
                    "Migrazione {name} non riuscita: {error}"
                )));
            }
        }

        Ok(())
    }

    pub fn now(&self) -> Result<String, AppError> {
        let connection = self.lock()?;
        let timestamp =
            connection.query_row("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')", [], |row| {
                row.get(0)
            })?;

        Ok(timestamp)
    }

    pub fn status(&self) -> Result<DatabaseStatus, AppError> {
        let connection = self.lock()?;
        let schema_version: i64 =
            connection.query_row("PRAGMA user_version", [], |row| row.get(0))?;

        let mut table_counts = BTreeMap::new();

        for table in TABLES {
            // I nomi provengono da una costante interna, mai da input utente.
            let count: i64 =
                connection.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                    row.get(0)
                })?;
            table_counts.insert((*table).to_string(), count);
        }

        let size_bytes = fs::metadata(&self.path).map(|meta| meta.len()).unwrap_or(0);

        Ok(DatabaseStatus {
            state: "ready".to_string(),
            path: Some(self.path.to_string_lossy().into_owned()),
            schema_version,
            size_bytes,
            table_counts,
        })
    }

    pub fn settings(&self) -> Result<AppSettings, AppError> {
        let connection = self.lock()?;
        let mut settings = AppSettings::default();

        if let Some(value) = read_setting(&connection, "region")? {
            match serde_json::from_str::<String>(&value) {
                Ok(region) if is_valid_region(&region) => settings.region = region,
                _ => log::warn!("Valore 'region' non valido nel database, uso il default."),
            }
        }

        if let Some(value) = read_setting(&connection, "reduce_motion")? {
            match serde_json::from_str::<bool>(&value) {
                Ok(reduce_motion) => settings.reduce_motion = reduce_motion,
                Err(_) => log::warn!("Valore 'reduce_motion' non valido, uso il default."),
            }
        }

        Ok(settings)
    }

    pub fn update_settings(&self, patch: &SettingsPatch) -> Result<AppSettings, AppError> {
        if patch.region.is_none() && patch.reduce_motion.is_none() {
            return Err(AppError::Validation(
                "Nessuna impostazione da aggiornare.".to_string(),
            ));
        }

        if let Some(region) = &patch.region {
            if !is_valid_region(region) {
                return Err(AppError::Validation(format!(
                    "Regione Riot non supportata: {region}"
                )));
            }
        }

        let mut next = self.settings()?;

        if let Some(region) = &patch.region {
            next.region = region.clone();
        }

        if let Some(reduce_motion) = patch.reduce_motion {
            next.reduce_motion = reduce_motion;
        }

        {
            let connection = self.lock()?;
            let transaction = connection.unchecked_transaction()?;

            transaction.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
                params!["region", serde_json::to_string(&next.region)?],
            )?;

            transaction.execute(
                "INSERT INTO settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET
                   value = excluded.value,
                   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')",
                params!["reduce_motion", serde_json::to_string(&next.reduce_motion)?],
            )?;

            transaction.commit()?;
        }

        let mut changes = Vec::new();
        if patch.region.is_some() {
            changes.push(format!("regione {}", next.region));
        }
        if patch.reduce_motion.is_some() {
            changes.push(format!(
                "animazioni {}",
                if next.reduce_motion {
                    "ridotte"
                } else {
                    "standard"
                }
            ));
        }

        self.log_activity(
            "settings",
            "Preferenze aggiornate",
            Some(&changes.join(" · ")),
        )?;

        Ok(next)
    }

    pub fn recent_activity(&self, limit: i64) -> Result<Vec<ActivityEntry>, AppError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(
            "SELECT id, kind, title, detail, created_at
             FROM activity_log
             ORDER BY id DESC
             LIMIT ?1",
        )?;

        let entries = statement.query_map([limit], |row| {
            Ok(ActivityEntry {
                id: row.get(0)?,
                kind: row.get(1)?,
                title: row.get(2)?,
                detail: row.get(3)?,
                created_at: row.get(4)?,
            })
        })?;

        entries.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn log_activity(
        &self,
        kind: &str,
        title: &str,
        detail: Option<&str>,
    ) -> Result<(), AppError> {
        let connection = self.lock()?;
        connection.execute(
            "INSERT INTO activity_log (kind, title, detail) VALUES (?1, ?2, ?3)",
            params![kind, title, detail],
        )?;

        Ok(())
    }

    fn prune_activity(&self, keep: i64) -> Result<(), AppError> {
        let connection = self.lock()?;
        connection.execute(
            "DELETE FROM activity_log
             WHERE id NOT IN (
               SELECT id FROM activity_log ORDER BY id DESC LIMIT ?1
             )",
            [keep],
        )?;

        Ok(())
    }
}

fn read_setting(connection: &Connection, key: &str) -> Result<Option<String>, AppError> {
    connection
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()
        .map_err(Into::into)
}

fn is_valid_region(region: &str) -> bool {
    VALID_REGIONS.contains(&region)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Temporary database directory, removed on drop. Never touches the real
    /// application data directory.
    struct TempDb {
        dir: PathBuf,
    }

    impl TempDb {
        fn new(name: &str) -> Self {
            let dir =
                std::env::temp_dir().join(format!("tecca-db-test-{}-{name}", std::process::id()));
            let _ = fs::remove_dir_all(&dir);
            Self { dir }
        }

        fn path(&self) -> PathBuf {
            self.dir.join("test.sqlite3")
        }
    }

    impl Drop for TempDb {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.dir);
        }
    }

    #[test]
    fn existing_database_is_backed_up_before_migrating() {
        let temp = TempDb::new("pre-migration");
        drop(Database::open(temp.path()).expect("open"));
        // Simulate a database left at an older schema by a previous release.
        {
            let connection = Connection::open(temp.path()).expect("raw");
            connection
                .execute_batch(
                    "DROP INDEX idx_global_matches_tier; DROP TABLE global_bans; DROP TABLE global_participants; DROP TABLE global_matches;
                     DROP TABLE global_seed_players; DROP TABLE global_seed_sources;
                     DROP TABLE global_stats_settings;
                     DROP INDEX idx_match_bans_champion; DROP INDEX idx_match_participants_champion;
                     DROP TABLE match_bans; ALTER TABLE match_participants DROP COLUMN damage_taken;
                     ALTER TABLE matches DROP COLUMN source; ALTER TABLE player_sync DROP COLUMN client_synced_at;
                     PRAGMA user_version = 6;",
                )
                .expect("downgrade schema");
        }
        let database = Database::open(temp.path()).expect("reopen and migrate");
        assert_eq!(
            database.status().expect("status").schema_version,
            schema_target()
        );
        let backups = database.backups().expect("backups");
        assert_eq!(backups.len(), 1);
        assert_eq!(backups[0].reason, "pre-migration");
        assert!(backups[0].file_name.ends_with("-v6.sqlite3"));

        // Already up to date: no new backup.
        drop(database);
        let again = Database::open(temp.path()).expect("reopen");
        assert_eq!(again.backups().expect("backups").len(), 1);
    }

    #[test]
    fn fresh_database_needs_no_backup() {
        let temp = TempDb::new("fresh-no-backup");
        let database = Database::open(temp.path()).expect("open");
        assert!(database.backups().expect("backups").is_empty());
    }

    #[test]
    fn database_from_a_newer_version_is_refused_untouched() {
        let temp = TempDb::new("newer");
        drop(Database::open(temp.path()).expect("open"));
        {
            let connection = Connection::open(temp.path()).expect("raw");
            connection
                .execute_batch(&format!("PRAGMA user_version = {};", schema_target() + 1))
                .expect("bump");
        }
        let Err(error) = Database::open(temp.path()) else {
            panic!("a newer schema must be refused");
        };
        assert!(error.to_string().contains("versione più recente"));
        let connection = Connection::open(temp.path()).expect("raw");
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("version");
        assert_eq!(version, schema_target() + 1);
    }

    #[test]
    fn fresh_database_is_migrated_with_defaults() {
        let temp = TempDb::new("fresh");
        let database = Database::open(temp.path()).expect("open");

        let status = database.status().expect("status");
        assert_eq!(status.schema_version, MIGRATIONS.len() as i64);
        assert_eq!(status.table_counts.len(), TABLES.len());
        assert_eq!(status.table_counts.get("matches"), Some(&0));

        let settings = database.settings().expect("settings");
        assert_eq!(settings.region, "euw1");
        assert!(!settings.reduce_motion);

        let activity = database.recent_activity(10).expect("activity");
        assert!(activity
            .iter()
            .any(|entry| entry.title == "Applicazione avviata"));
    }

    #[test]
    fn rejects_unknown_region() {
        let temp = TempDb::new("region");
        let database = Database::open(temp.path()).expect("open");

        let result = database.update_settings(&SettingsPatch {
            region: Some("xx9".to_string()),
            reduce_motion: None,
        });

        assert!(matches!(result, Err(AppError::Validation(_))));
        assert_eq!(database.settings().expect("settings").region, "euw1");
    }

    #[test]
    fn rejects_empty_patch() {
        let temp = TempDb::new("empty");
        let database = Database::open(temp.path()).expect("open");

        let result = database.update_settings(&SettingsPatch {
            region: None,
            reduce_motion: None,
        });

        assert!(matches!(result, Err(AppError::Validation(_))));
    }

    #[test]
    fn settings_persist_across_reopen_without_rerunning_migrations() {
        let temp = TempDb::new("persist");

        {
            let database = Database::open(temp.path()).expect("open");
            let updated = database
                .update_settings(&SettingsPatch {
                    region: Some("kr".to_string()),
                    reduce_motion: Some(true),
                })
                .expect("update");
            assert_eq!(updated.region, "kr");
            assert!(updated.reduce_motion);
        }

        let reopened = Database::open(temp.path()).expect("reopen");
        let settings = reopened.settings().expect("settings");
        assert_eq!(settings.region, "kr");
        assert!(settings.reduce_motion);
        assert_eq!(
            reopened.status().expect("status").schema_version,
            MIGRATIONS.len() as i64
        );

        let activity = reopened.recent_activity(20).expect("activity");
        assert!(activity
            .iter()
            .any(|entry| entry.title == "Preferenze aggiornate"));
    }

    #[test]
    fn user_messages_hide_technical_details() {
        let error = AppError::State("dettaglio interno sqlite".to_string());
        assert!(!error.user_message().contains("sqlite"));
        assert_eq!(error.code(), "DATABASE_ERROR");

        let validation = AppError::Validation("Regione Riot non supportata: xx".to_string());
        assert!(validation
            .user_message()
            .contains("Regione Riot non supportata"));
    }
}
