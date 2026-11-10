//! Test helpers. Never compiled into the application.

use std::{fs, path::PathBuf};

use crate::db::Database;

/// Temporary database directory, removed on drop. Never touches the real
/// application data directory.
pub struct TempDb {
    dir: PathBuf,
}

impl TempDb {
    pub fn new(name: &str) -> Self {
        let dir = std::env::temp_dir().join(format!("tecca-test-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        Self { dir }
    }

    pub fn open(&self) -> Database {
        Database::open(self.dir.join("test.sqlite3")).expect("open test database")
    }
}

impl Drop for TempDb {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.dir);
    }
}
