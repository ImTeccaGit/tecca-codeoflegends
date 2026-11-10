use serde::Serialize;

/// Errori applicativi serializzati verso il frontend con un contratto stabile.
///
/// - `Display` contiene il dettaglio tecnico ed è destinato **solo ai log**.
/// - `user_message()` è il testo comprensibile mostrato all'utente.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Errore database: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Errore filesystem: {0}")]
    Io(#[from] std::io::Error),

    #[error("Errore di serializzazione: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Dato non valido: {0}")]
    Validation(String),

    #[error("Stato applicativo non disponibile: {0}")]
    State(String),

    #[error("Database locale non disponibile dall'avvio dell'applicazione")]
    DatabaseUnavailable { log_dir: Option<String> },

    #[error("Errore di rete verso {source_name}: {detail}")]
    Network {
        source_name: &'static str,
        detail: String,
    },

    #[error("Dati non conformi da {source_name}: {detail}")]
    SourceData {
        source_name: &'static str,
        detail: String,
    },

    #[error("Operazione già in corso: {0}")]
    Busy(String),

    /// The requested resource does not exist (e.g. unknown Riot ID).
    #[error("Non trovato: {0}")]
    NotFound(String),

    /// Missing, malformed, invalid or expired Riot API key.
    #[error("Chiave API Riot: {0}")]
    RiotKey(String),

    #[error("Limite di richieste Riot raggiunto, riprovare tra {retry_after_secs} s")]
    RateLimited { retry_after_secs: u64 },

    #[error("Errore del runtime desktop: {0}")]
    Tauri(#[from] tauri::Error),
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Database(_)
            | Self::Io(_)
            | Self::Serialization(_)
            | Self::State(_)
            | Self::DatabaseUnavailable { .. } => "DATABASE_ERROR",
            Self::Validation(_) | Self::SourceData { .. } => "VALIDATION_ERROR",
            Self::Network { .. } => "NETWORK_ERROR",
            Self::Busy(_) => "BUSY",
            Self::NotFound(_) => "NOT_FOUND",
            Self::RiotKey(_) => "RIOT_KEY",
            Self::RateLimited { .. } => "RATE_LIMITED",
            Self::Tauri(_) => "BACKEND_UNAVAILABLE",
        }
    }

    /// Messaggio per l'utente: nessun dettaglio tecnico, che resta nei log.
    pub fn user_message(&self) -> String {
        match self {
            Self::Validation(_) => self.to_string(),
            Self::DatabaseUnavailable { log_dir } => {
                let location = log_dir
                    .as_deref()
                    .map(|dir| format!(" Il dettaglio è nei log locali: {dir}"))
                    .unwrap_or_default();
                format!(
                    "Il database locale non è disponibile. Riavvia l'applicazione.{location}"
                )
            }
            Self::Database(_) | Self::Io(_) | Self::Serialization(_) | Self::State(_) => {
                "Operazione sul database locale non riuscita. Il dettaglio tecnico è stato registrato nei log locali."
                    .to_string()
            }
            Self::Tauri(_) => {
                "Il runtime desktop ha restituito un errore. Il dettaglio tecnico è stato registrato nei log locali."
                    .to_string()
            }
            Self::Network { source_name, .. } => format!(
                "Impossibile contattare {source_name}. Controlla la connessione: i dati già importati restano disponibili."
            ),
            Self::SourceData { source_name, .. } => format!(
                "I dati ricevuti da {source_name} non superano i controlli di integrità. L'import è stato annullato e i dati esistenti non sono stati modificati."
            ),
            Self::Busy(message) | Self::NotFound(message) => message.clone(),
            Self::RiotKey(message) => format!("Chiave API Riot: {message}"),
            Self::RateLimited { retry_after_secs } => format!(
                "Limite di richieste della Riot API raggiunto. Riprova tra {retry_after_secs} secondi: i dati già scaricati restano disponibili."
            ),
        }
    }

    /// Registra il dettaglio tecnico nei log e restituisce l'errore invariato.
    /// Da usare al confine dei comandi Tauri, prima della serializzazione.
    pub fn logged(self) -> Self {
        match self {
            Self::Validation(_)
            | Self::Busy(_)
            | Self::NotFound(_)
            | Self::RiotKey(_)
            | Self::RateLimited { .. } => log::warn!("[{}] {}", self.code(), self),
            _ => log::error!("[{}] {}", self.code(), self),
        }
        self
    }
}

#[derive(Serialize)]
struct ErrorPayload {
    code: &'static str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        ErrorPayload {
            code: self.code(),
            message: self.user_message(),
        }
        .serialize(serializer)
    }
}
