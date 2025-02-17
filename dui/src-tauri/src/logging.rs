use std::path::PathBuf;
use chrono::{DateTime, Utc};
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
    Handle,
};
use log::LevelFilter;
use serde::{Deserialize, Serialize};
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

pub fn setup_app_logging(log_dir: PathBuf) -> Result<Handle, Box<dyn std::error::Error>> {
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;

    // Create logfile appender
    let logfile = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d(%Y-%m-%d %H:%M:%S)} {l} {t} - {m}{n}")))
        .build(log_dir.join("dui.log"))?;

    // Build the log configuration
    let config = Config::builder()
        .appender(Appender::builder().build("logfile", Box::new(logfile)))
        .build(Root::builder()
            .appender("logfile")
            .build(LevelFilter::Info))?;

    // Initialize the logger
    Ok(log4rs::init_config(config)?)
}