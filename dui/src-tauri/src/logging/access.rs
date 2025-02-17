use std::path::PathBuf;
use chrono::{DateTime, Utc};
use serde::{self, Deserialize, Serialize};
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
    log_file: PathBuf,
    debug_mode: Arc<RwLock<bool>>,
}

impl AccessLogger {
    pub fn new(log_dir: PathBuf, debug_mode: Arc<RwLock<bool>>) -> std::io::Result<Self> {
        let log_file = log_dir.join("access.log");
        
        // Ensure directory exists
        if let Some(parent) = log_file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        
        Ok(Self { 
            log_file,
            debug_mode,
        })
    }

    pub async fn log_request(&mut self, entry: &AccessLogEntry) -> std::io::Result<()> {
        let log_line = if *self.debug_mode.read().await {
            format!(
                "[{}] {} {} {} {}ms -> {} {}\n",
                entry.timestamp,
                entry.method,
                entry.path,
                entry.status,
                entry.duration_ms,
                entry.target,
                entry.error.as_deref().unwrap_or("-")
            )
        } else {
            format!(
                "[{}] {} {} {} {}ms\n",
                entry.timestamp,
                entry.method,
                entry.path,
                entry.status,
                entry.duration_ms
            )
        };
        
        // Append to log file
        if let Ok(mut content) = std::fs::read_to_string(&self.log_file) {
            content.push_str(&log_line);
            std::fs::write(&self.log_file, content)
        } else {
            std::fs::write(&self.log_file, log_line)
        }
    }
}