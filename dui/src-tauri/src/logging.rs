use std::path::PathBuf;
use chrono::Local;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
    Handle,
};
use log::LevelFilter;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AccessLogEntry {
    pub timestamp: String,
    pub method: String,
    pub path: String,
    pub status: u16,
    pub duration_ms: u64,
}

pub struct AccessLogger {
    log_file: PathBuf,
}

impl AccessLogger {
    pub fn new(log_dir: PathBuf) -> Self {
        let log_file = log_dir.join("access.log");
        Self { log_file }
    }

    pub fn log_access(&self, entry: &AccessLogEntry) {
        let log_line = format!(
            "[{}] {} {} {} {}ms\n",
            entry.timestamp,
            entry.method,
            entry.path,
            entry.status,
            entry.duration_ms
        );
        
        // Append to log file
        if let Ok(mut content) = std::fs::read_to_string(&self.log_file) {
            content.push_str(&log_line);
            let _ = std::fs::write(&self.log_file, content);
        } else {
            let _ = std::fs::write(&self.log_file, log_line);
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