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

    // Load config from file
    let config_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("config")
        .join("log4rs.yaml");

    // Initialize logger with config file
    let config = log4rs::config::load_config_file(config_path, |config| {
        // Update log file paths to be relative to log_dir
        config.appenders().iter().for_each(|(_, appender)| {
            if let log4rs::config::Appender::RollingFile(ref file_appender) = appender {
                let path = log_dir.join(file_appender.path());
                file_appender.set_path(path);
            }
        });
        Ok(config)
    })?;

    // Initialize the logger
    Ok(log4rs::init_config(config)?
}