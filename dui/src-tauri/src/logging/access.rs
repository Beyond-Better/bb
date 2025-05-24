use chrono::{DateTime, Utc};
use log::debug;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessLogEntry {
    pub timestamp: DateTime<Utc>,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub duration_ms: u64,
    pub target: String,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct AccessLogger {
    debug_mode: Arc<RwLock<bool>>,
}

impl AccessLogger {
    pub fn new(_log_dir: PathBuf, debug_mode: Arc<RwLock<bool>>) -> std::io::Result<Self> {
        Ok(Self { debug_mode })
    }

    pub async fn log_request(&self, entry: &AccessLogEntry) -> std::io::Result<()> {
        let message = format!(
            "{} {} {} {}ms -> {}{}",
            entry.method,
            entry.path,
            entry.status,
            entry.duration_ms,
            entry.target,
            entry
                .error
                .as_ref()
                .map(|e| format!(" ({})", e))
                .unwrap_or_default()
        );

        // In non-debug mode, only log errors or non-200 responses
        if *self.debug_mode.read().await || entry.status >= 400 || entry.error.is_some() {
            debug!("Proxy access: {}", message);
            log::info!(target: "proxy", "{}", message);
        }

        Ok(())
    }
}
