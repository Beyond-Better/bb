use chrono::{DateTime, Utc};
use log::{debug};
use log4rs::Handle;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug)]
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
            entry.error.as_ref().map(|e| format!(" ({})", e)).unwrap_or_default()
        );

        // In non-debug mode, only log errors or non-200 responses
        if *self.debug_mode.read().await || entry.status >= 400 || entry.error.is_some() {
            debug!("Proxy access: {}", message);
            log::info!(target: "proxy", "{}", message);
        }

        Ok(())
    }
}

pub fn setup_app_logging(log_dir: PathBuf) -> std::io::Result<Handle> {
    // Copy config file to log directory if it doesn't exist
    let config_path = log_dir.join("log4rs.yaml");
    if !config_path.exists() {
        let mut config_content = include_str!("../../config/log4rs.yaml").to_string();
        
        // Replace the path placeholders with actual paths
        let app_log_path = log_dir.join("Beyond Better.log").to_string_lossy().to_string();
        let proxy_log_path = log_dir.join("proxy-access.log").to_string_lossy().to_string();
        
        config_content = config_content.replace(
            "path: \"Beyond Better.log\"",
            &format!("path: \"{}\"", app_log_path)
        );
        config_content = config_content.replace(
            "path: \"proxy-access.log\"",
            &format!("path: \"{}\"", proxy_log_path)
        );
        
        // Update the roller patterns with full paths
        config_content = config_content.replace(
            "pattern: \"Beyond Better.{}.log\"",
            &format!("pattern: \"{}.{{}}.log\"", log_dir.join("Beyond Better").to_string_lossy())
        );
        config_content = config_content.replace(
            "pattern: \"proxy-access.{}.log\"",
            &format!("pattern: \"{}.{{}}.log\"", log_dir.join("proxy-access").to_string_lossy())
        );
        
        std::fs::write(&config_path, config_content)?;
    }

    // Parse and initialize logging with the YAML config
    let config = log4rs::config::load_config_file(&config_path, Default::default())
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    
    log4rs::init_config(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))

}