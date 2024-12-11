use env_logger;
use tauri_plugin_fs;
use log::debug;

// Make modules available within the crate
pub mod api;
pub mod config;  // Make config module public
pub mod commands;  // Make commands module public

// Re-export public items
pub use api::{start_api, stop_api};
pub use config::{read_global_config, get_api_config, GlobalConfig, ApiConfig};
pub use commands::api_status::check_api_status;
pub use commands::version::{get_binary_version, get_version_info, check_version_compatibility};
pub use commands::upgrade::{perform_install, perform_upgrade};
pub use commands::config::{get_global_config, set_global_config_value, test_read_config, get_log_path};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the logger with timestamp and file output
    if let Some(home_dir) = dirs::home_dir() {
        let log_dir = home_dir.join("Library").join("Logs").join(config::APP_NAME);
        std::fs::create_dir_all(&log_dir).expect("Failed to create log directory");
        let log_file = log_dir.join("Beyond Better.log");
        
        let file = std::fs::File::create(log_file).expect("Failed to create log file");
        
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(if cfg!(debug_assertions) { "debug" } else { "info" }))
            .format_timestamp(Some(env_logger::fmt::TimestampPrecision::Millis))
            .target(env_logger::Target::Pipe(Box::new(file)))
            .init();
    } else {
        // Fallback to default logging if we can't create the log file
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
            .format_timestamp(Some(env_logger::fmt::TimestampPrecision::Millis))
            .init();
    }

    debug!("Starting Beyond Better DUI application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            start_api,
            stop_api,
            check_api_status,
            get_api_config,
            get_binary_version,
            get_version_info,
            check_version_compatibility,
            perform_install,
            perform_upgrade,
            get_global_config,
            set_global_config_value,
            test_read_config,
            get_log_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}