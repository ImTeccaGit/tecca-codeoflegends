//! Local SQLite backups (`VACUUM INTO`): a consistent, compacted copy of the
//! database written next to it, in `<app data>/backups`.
//!
//! * automatic before every schema migration of an existing database;
//! * manual from Settings;
//! * only the newest `KEEP_BACKUPS` files are kept;
//! * restore is manual and documented (docs/DATABASE.md): the app never
//!   overwrites the live database by itself.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;
use serde::Serialize;

use crate::error::AppError;

pub const BACKUP_DIR: &str = "backups";
pub const FILE_PREFIX: &str = "tecca-codeoflegends-";
pub const KEEP_BACKUPS: usize = 10;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    /// "manual" | "pre-migration".
    pub reason: String,
    /// UTC, from the file name (YYYYMMDD-HHMMSS).
    pub created_at: String,
    /// "YYYYMMDD-HHMMSSmmm" from the file name, for ordering.
    #[serde(skip)]
    stamp: String,
}

pub fn backup_dir(database_path: &Path) -> PathBuf {
    database_path.parent().map_or_else(
        || PathBuf::from(BACKUP_DIR),
        |parent| parent.join(BACKUP_DIR),
    )
}

/// Writes a backup of `conn` and prunes old files. `reason` is internal.
pub fn create(
    conn: &Connection,
    database_path: &Path,
    reason: &str,
) -> Result<BackupInfo, AppError> {
    debug_assert!(reason == "manual" || reason == "pre-migration");
    let dir = backup_dir(database_path);
    fs::create_dir_all(&dir)?;

    let (stamp, version): (String, i64) = conn.query_row(
        "SELECT strftime('%Y%m%d-%H%M%f', 'now'), (SELECT user_version FROM pragma_user_version)",
        [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    // "20261110-153012.345" → "20261110-153012345" (unique per millisecond).
    let stamp = stamp.replace('.', "");
    let file_name = format!("{FILE_PREFIX}{reason}-{stamp}-v{version}.sqlite3");
    let path = dir.join(&file_name);
    if path.exists() {
        return Err(AppError::Busy(
            "Un backup è appena stato creato: riprova tra un istante.".to_string(),
        ));
    }

    let target = path.to_string_lossy().into_owned();
    conn.execute("VACUUM INTO ?1", [&target])?;
    verify(&path)?;
    log::info!("Backup database creato: {}", path.display());

    prune(&dir)?;
    describe(&path)
        .ok_or_else(|| AppError::State("backup non leggibile dopo la creazione".to_string()))
}

/// The copy must open and pass SQLite's integrity check.
fn verify(path: &Path) -> Result<(), AppError> {
    let copy = Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let result: String = copy.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if result != "ok" {
        let _ = fs::remove_file(path);
        return Err(AppError::State(format!("backup non integro: {result}")));
    }
    Ok(())
}

fn describe(path: &Path) -> Option<BackupInfo> {
    let file_name = path.file_name()?.to_str()?.to_string();
    let rest = file_name
        .strip_prefix(FILE_PREFIX)?
        .strip_suffix(".sqlite3")?;
    let (reason, rest) = if let Some(rest) = rest.strip_prefix("pre-migration-") {
        ("pre-migration", rest)
    } else {
        ("manual", rest.strip_prefix("manual-")?)
    };
    let date = rest.get(0..8)?;
    let time = rest.get(9..15)?;
    let created_at = format!(
        "{}-{}-{}T{}:{}:{}Z",
        &date[0..4],
        &date[4..6],
        &date[6..8],
        &time[0..2],
        &time[2..4],
        &time[4..6]
    );
    let stamp = rest.split_once("-v").map(|(stamp, _)| stamp)?.to_string();
    Some(BackupInfo {
        stamp,
        size_bytes: fs::metadata(path).ok()?.len(),
        path: path.to_string_lossy().into_owned(),
        file_name,
        reason: reason.to_string(),
        created_at,
    })
}

/// Backups in `dir`, newest first.
pub fn list_in(dir: &Path) -> Result<Vec<BackupInfo>, AppError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut found: Vec<BackupInfo> = fs::read_dir(dir)?
        .filter_map(Result::ok)
        .filter_map(|entry| describe(&entry.path()))
        .collect();
    // Newest first.
    found.sort_by(|a, b| b.stamp.cmp(&a.stamp));
    Ok(found)
}

fn prune(dir: &Path) -> Result<(), AppError> {
    for old in list_in(dir)?.into_iter().skip(KEEP_BACKUPS) {
        if let Err(error) = fs::remove_file(&old.path) {
            log::warn!("Backup vecchio non rimosso ({}): {error}", old.file_name);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_support::TempDb;

    #[test]
    fn manual_backup_is_a_verified_copy() {
        let temp = TempDb::new("backup-manual");
        let db = temp.open();
        let info = db.create_backup("manual").expect("backup");
        assert_eq!(info.reason, "manual");
        assert!(info.size_bytes > 0);
        assert!(info
            .file_name
            .ends_with(&format!("-v{}.sqlite3", crate::db::schema_target())));

        let copy = Connection::open(&info.path).expect("open copy");
        let regions: i64 = copy
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE key = 'region'",
                [],
                |row| row.get(0),
            )
            .expect("query copy");
        assert_eq!(regions, 1);
        assert_eq!(db.backups().expect("list"), vec![info]);
    }

    #[test]
    fn old_backups_are_pruned() {
        let temp = TempDb::new("backup-prune");
        let db = temp.open();
        for _ in 0..(KEEP_BACKUPS + 3) {
            db.create_backup("manual").expect("backup");
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
        let list = db.backups().expect("list");
        assert_eq!(list.len(), KEEP_BACKUPS);
        assert!(list.windows(2).all(|pair| pair[0].stamp > pair[1].stamp));
    }

    #[test]
    fn unrelated_files_are_ignored() {
        let temp = TempDb::new("backup-ignore");
        let db = temp.open();
        let dir = backup_dir(&db.path());
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("notes.txt"), "x").unwrap();
        fs::write(dir.join(format!("{FILE_PREFIX}weird.sqlite3")), "x").unwrap();
        assert!(db.backups().expect("list").is_empty());
    }
}
