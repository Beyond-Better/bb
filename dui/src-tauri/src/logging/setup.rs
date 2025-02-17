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