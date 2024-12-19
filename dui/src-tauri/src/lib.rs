use tauri_plugin_fs;
use log::{debug, info, warn, error};
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use crate::config::get_global_config_dir;

// Make modules available within the crate
pub mod api;
pub mod config;  // Make config module public
pub mod commands;  // Make commands module public
pub mod logging;
pub mod proxy;

// Re-export public items
pub use crate::api::{start_api, stop_api};
pub use crate::config::{read_global_config, get_api_config, ApiConfig};
pub use crate::commands::api_status::check_api_status;
pub use crate::commands::version::{get_binary_version, get_version_info, check_version_compatibility};
pub use crate::commands::upgrade::{perform_install, perform_upgrade};
pub use crate::commands::config::{get_global_config, set_global_config_value, test_read_config, get_log_path, get_api_log_path};

pub use crate::commands::proxy::{get_proxy_info, set_proxy_target, set_debug_mode, start_proxy_server, stop_proxy_server};


#[cfg_attr(mobile, tauri::mobile_entry_point)]
async fn start_proxy(log_dir: std::path::PathBuf) -> Result<proxy::HttpProxy, Box<dyn std::error::Error>> {
    // Check if proxy is needed based on TLS configuration
    let config = read_global_config()?;

    debug!("Initializing proxy server");
    let proxy = proxy::HttpProxy::new(log_dir).await?;

    if !config.api.tls.use_tls {
        debug!("Starting proxy server (TLS disabled)");
        if let Err(e) = proxy.start().await {
            error!("Failed to start proxy server: {}", e);
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to start proxy server: {}", e)
            )));
        }
        info!("Proxy server started successfully");
    } else {
        debug!("Proxy not needed - API is in TLS mode");
        info!("API using TLS, direct HTTPS connections will be used");
    }

    Ok(proxy)
}

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
                                return Err(e.to_string());
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
    let log_dir = get_app_log_dir().expect("Failed to get log directory");
    std::fs::create_dir_all(&log_dir).expect("Failed to create log directory");
    
    debug!("Starting Beyond Better DUI application");

    // Initialize logging with log4rs
    let _logging_handle = match logging::setup_app_logging(log_dir.clone()) {
        Ok(handle) => handle,
        Err(e) => {
            eprintln!("Failed to setup logging: {}", e);
            panic!("Failed to initialize logging system");
        }
    };

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

    // Start proxy server if needed
    debug!("Initializing proxy state");
    let proxy_state = match tauri::async_runtime::block_on(async {
        start_proxy(log_dir.clone()).await
    }) {
        Ok(proxy) => {
            info!("Proxy server initialized");
            Arc::new(RwLock::new(proxy))
        },
        Err(e) => {
            error!("Failed to initialize proxy server: {}", e);
            panic!("Failed to initialize proxy server: {}", e);
        }
    };


    // Initialize Tauri
    tauri::Builder::default()
        .manage(proxy_state)
        .invoke_handler(tauri::generate_handler![
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
            get_api_log_path,
            get_proxy_info,
            set_proxy_target,
            set_debug_mode,
            start_proxy_server,
            stop_proxy_server
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}