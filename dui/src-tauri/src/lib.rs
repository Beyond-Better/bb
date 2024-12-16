use env_logger;
use tauri_plugin_fs;
use log::{debug, info, warn, error};
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use crate::config::get_global_config_dir;

// Make modules available within the crate
pub mod api;
pub mod config;  // Make config module public
pub mod commands;  // Make commands module public

// Re-export public items
pub use crate::api::{start_api, stop_api};
pub use crate::config::{read_global_config, get_api_config, ApiConfig};
pub use crate::commands::api_status::check_api_status;
pub use crate::commands::version::{get_binary_version, get_version_info, check_version_compatibility};
pub use crate::commands::upgrade::{perform_install, perform_upgrade};
pub use crate::commands::config::{get_global_config, set_global_config_value, test_read_config, get_log_path, get_api_log_path};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn ensure_global_config() -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = get_global_config_dir()?;
    let config_path = config_dir.join("config.yaml");

    if !config_path.exists() {
        info!("Global config not found, creating with defaults");
        
        // Create config directory if it doesn't exist
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)?;
        }

        // Create default config using the config module's default implementation
        let default_config = crate::config::GlobalConfig::default();
        let yaml = serde_yaml::to_string(&default_config)?;
        fs::write(config_path, yaml)?;
        info!("Created default global config");
    }

    Ok(())
}

async fn start_api_if_needed() -> Result<(), String> {
    debug!("Checking API startup conditions");

    // Try API status check with retries
    let max_status_attempts = 3;
    let mut api_status = None;

    for attempt in 1..=max_status_attempts {
        match crate::check_api_status().await {
            Ok(status) => {
                api_status = Some(status);
                break;
            }
            Err(e) if attempt == max_status_attempts => {
                warn!("Failed to check API status after {} attempts: {}", max_status_attempts, e);
            }
            Err(e) => {
                debug!("API status check attempt {}/{} failed: {}", attempt, max_status_attempts, e);
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }

    if let Some(status) = api_status {
        if status.api_responds {
            info!("API is already running");
            return Ok(());
        }
        debug!("API is not running (pid_exists: {}, process_responds: {})", status.pid_exists, status.process_responds);
    }

    // Check if config exists and has API key
    match read_global_config() {
        Ok(config) => {
            if let Some(llm_keys) = &config.api.llm_keys {
                if let Some(key) = &llm_keys.anthropic {
                    if !key.trim().is_empty() {
                        info!("Starting API automatically");
                        match crate::start_api().await {
                            Ok(result) => {
                                if result.success {
                                    info!("API started successfully");
                                    // Give the API a moment to initialize
                                    std::thread::sleep(Duration::from_millis(1000));
                                    return Ok(());
                                } else {
                                    warn!("API start returned false: {}", result.error.unwrap_or_else(|| "Unknown error".to_string()));
                                    return Err("API failed to start".to_string());
                                }
                            }
                            Err(e) => {
                                error!("Failed to start API: {}", e);
                                return Err(e);
                            }
                        }
                    } else {
                        debug!("Not starting API: Anthropic API key is empty");
                    }
                } else {
                    debug!("Not starting API: No Anthropic API key found");
                }
            } else {
                debug!("Not starting API: No LLM keys configured");
            }
            Ok(())
        }
        Err(e) => {
            warn!("Failed to read config: {}", e);
            Ok(())
        }
    }
}

fn get_app_log_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Logs")
                .join(config::APP_NAME)
        })
    }

    #[cfg(target_os = "windows")]
    {
        std::env::var("ProgramData").ok().map(|program_data| {
            PathBuf::from(program_data)
                .join(config::APP_NAME)
                .join("logs")
        })
    }

    #[cfg(target_os = "linux")]
    {
        Some(PathBuf::from("/var/log").join(config::APP_NAME.to_lowercase()))
    }
}

pub fn run() {
    // Ensure global config exists before starting the app
    if let Err(e) = ensure_global_config() {
        warn!("Failed to ensure global config: {}", e);
    }

    // Try to start API if needed
    tauri::async_runtime::block_on(async {
        if let Err(e) = start_api_if_needed().await {
            warn!("Failed to start API: {}", e);
        }
    });
    // Initialize the logger with timestamp and file output
    if let Some(log_dir) = get_app_log_dir() {
        std::fs::create_dir_all(&log_dir).expect("Failed to create log directory");
        let log_file = log_dir.join("Beyond Better.log");
        
        let file = match std::fs::File::create(&log_file) {
            Ok(f) => f,
            Err(e) => {
                error!("Failed to create log file at {:?}: {}", log_file, e);
                panic!("Could not create log file: {}", e);
            }
        };
        
//         env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug"))
        env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(if cfg!(debug_assertions) { "debug" } else { "info" }))
            .format_timestamp(Some(env_logger::fmt::TimestampPrecision::Millis))
            .target(env_logger::Target::Pipe(Box::new(file)))
            .init();
    } else {
        // Fallback to default logging if we can't create the log file
//         env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("debug"))
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
            get_log_path,
            get_api_log_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}