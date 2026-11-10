use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Impostazioni persistite localmente. I valori sono sempre validati prima del salvataggio.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub region: String,
    pub reduce_motion: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            region: "euw1".to_string(),
            reduce_motion: false,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub region: Option<String>,
    pub reduce_motion: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseStatus {
    pub state: String,
    pub path: Option<String>,
    pub schema_version: i64,
    pub size_bytes: u64,
    pub table_counts: BTreeMap<String, i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatus {
    pub state: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: i64,
    pub kind: String,
    pub title: String,
    pub detail: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemSnapshot {
    pub runtime: String,
    pub app_version: String,
    pub generated_at: String,
    /// Cartella dei log locali (file ruotati, nessun invio remoto).
    pub log_directory: Option<String>,
    pub database: DatabaseStatus,
    pub riot: ServiceStatus,
    pub live_client: ServiceStatus,
    pub settings: AppSettings,
    pub activity: Vec<ActivityEntry>,
}
