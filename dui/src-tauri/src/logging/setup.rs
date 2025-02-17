use std::path::PathBuf;
use log4rs::{
    append::file::FileAppender,
    config::{Appender, Config, Root},
    encode::pattern::PatternEncoder,
    Handle,
};
use log::LevelFilter;

pub fn setup_app_logging(log_dir: PathBuf) -> Result<Handle, Box<dyn std::error::Error>> {
    // Ensure log directory exists
    std::fs::create_dir_all(&log_dir)?;

    // Set environment variable for log directory
    std::env::set_var("LOG_DIR", log_dir.to_string_lossy().to_string());

    // Load and initialize config from file
    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("config")
        .join("log4rs.yaml");

    // Initialize the logger
    Ok(log4rs::init_file(config_path, Default::default())?
}