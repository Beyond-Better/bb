use tauri_plugin_fs;
use log::{debug, info, warn, error};
use tauri::Manager;
use std::sync::Arc;
use tokio::sync::RwLock;
use std::time::Duration;
use std::fs;
use std::path::PathBuf;
use crate::config::get_global_config_dir;

// Make modules available within the crate
pub mod api;
pub mod bui;
pub mod config;  // Make config module public
pub mod commands;  // Make commands module public
pub mod window_state;
pub mod logging;
pub mod proxy;

// Re-export public items
pub use crate::api::{start_api, stop_api};
pub use crate::bui::{start_bui, stop_bui};
pub use crate::config::{read_global_config, get_api_config, get_bui_config, ApiConfig, BuiConfig};
pub use crate::commands::server_status::check_server_status;
pub use crate::commands::version::{get_binary_version, get_version_info, check_version_compatibility};
pub use crate::commands::upgrade::{perform_install, perform_upgrade};
pub use crate::commands::config::{get_global_config, set_global_config_value, test_read_config, get_log_path, get_api_log_path, get_bui_log_path};

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

async fn start_services_if_needed() -> Result<(), String> {
    debug!("Checking API startup conditions");

    // Try API status check with retries
    let max_status_attempts = 3;
    let mut api_status = None;

    for attempt in 1..=max_status_attempts {
        match crate::check_server_status().await {
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
        if status.api.service_responds && status.bui.service_responds {
            info!("All services are already running");
            return Ok(());
        }
        debug!("Services not running (API: {}, BUI: {})", status.api.service_responds, status.bui.service_responds);
    }

    // Check if config exists and has API key
    match read_global_config() {
        Ok(config) => {
            if let Some(llm_keys) = &config.api.llm_keys {
                if let Some(key) = &llm_keys.anthropic {
                    if !key.trim().is_empty() {
                        info!("Starting API automatically");
                        // Start API first
						let api_result = crate::start_api().await;
						if let Err(e) = api_result {
							error!("Failed to start API: {}", e);
							return Err(e);
						}
						let api_result = api_result.unwrap();
						if !api_result.success {
							let error = api_result.error.unwrap_or_else(|| "Unknown error".to_string());
							warn!("API start returned false: {}", error);
							return Err("API failed to start".to_string());
						}
						
						// Give the API a moment to initialize
						std::thread::sleep(Duration::from_millis(1000));

						let bui_result = crate::start_bui().await;
						if let Err(e) = bui_result {
							error!("Failed to start BUI: {}", e);
							return Err(e);
						}
						let bui_result = bui_result.unwrap();
						if !bui_result.success {
							let error = bui_result.error.unwrap_or_else(|| "Unknown error".to_string());
							warn!("BUI start returned false: {}", error);
							return Err("BUI failed to start".to_string());
						}
						
						// Now start BUI
						// match crate::start_bui().await {
						// 	Ok(result) => {
						// 		if result.success {
						// 			info!("BUI started successfully");
						// 			// Give the API a moment to initialize
						// 			std::thread::sleep(Duration::from_millis(1000));
						// 			return Ok(());
						// 		} else {
						// 			warn!("BUI start returned false: {}", result.error.unwrap_or_else(|| "Unknown error".to_string()));
						// 			// Stop API since BUI failed
						// 			let _ = crate::stop_api().await;
						// 			return Err("BUI failed to start".to_string());
						// 		}
						// 	}
						// 	Err(e) => {
						// 		error!("Failed to start BUI: {}", e);
						// 		// Stop API since BUI failed
						// 		let _ = crate::stop_api().await;
						// 		return Err(e.to_string());
						// 	}
						// }
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

    // Try to start services if needed
    tauri::async_runtime::block_on(async {
        if let Err(e) = start_services_if_needed().await {
            warn!("Failed to start services: {}", e);
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
        .invoke_handler(tauri::generate_handler![
            start_api,
            stop_api,
            start_bui,
            stop_bui,
            commands::server_status::check_server_status,
            get_api_config,
            get_bui_config,
            get_global_config,
            get_binary_version,
            get_version_info,
            check_version_compatibility,
            perform_install,
            perform_upgrade,
            set_global_config_value,
            test_read_config,
            get_log_path,
            get_api_log_path,
            get_bui_log_path,
            get_proxy_info,
            set_proxy_target,
            set_debug_mode,
            start_proxy_server,
            stop_proxy_server
        ])
        .manage(proxy_state)
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            if let Some(main_window) = app.webview_windows().get("main") {
                // Load and apply saved window state
                let state = window_state::load_window_state(&main_window);
                window_state::apply_window_state(&main_window, &state);

                // Set up window state event handlers
                window_state::setup_window_state_handler(&main_window);
            } else {
                warn!("Main window not found");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}