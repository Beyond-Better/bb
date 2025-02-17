use tauri_plugin_fs;
// Basic logging with eprintln
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

    eprintln!("Initializing proxy server");
    let proxy = proxy::HttpProxy::new(log_dir).await?;

    if !config.api.tls.use_tls {
        eprintln!("Starting proxy server (TLS disabled)");
        if let Err(e) = proxy.start().await {
            eprintln!("Failed to start proxy server: {}", e);
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to start proxy server: {}", e)
            )));
        }
        eprintln!("Proxy server started successfully");
    } else {
        eprintln!("Proxy not needed - API is in TLS mode");
        eprintln!("API using TLS, direct HTTPS connections will be used");
    }

    Ok(proxy)
}

fn ensure_global_config() -> Result<(), Box<dyn std::error::Error>> {
    eprintln!("Ensuring global config exists...");

    eprintln!("Getting global config directory...");
    let config_dir = get_global_config_dir()?;
    eprintln!("Config directory: {:?}", config_dir);
    let config_path = config_dir.join("config.yaml");
    eprintln!("Config path: {:?}", config_path);

    if !config_path.exists() {
        eprintln!("Global config not found, creating with defaults");
        
        // Create config directory if it doesn't exist
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir)?;
        }

        // Create default config using the config module's default implementation
        let default_config = crate::config::GlobalConfig::default();
        let yaml = serde_yaml::to_string(&default_config)?;
        fs::write(config_path, yaml)?;
        eprintln!("Created default global config");
    }

    Ok(())
}

async fn start_services_if_needed() -> Result<(), String> {
    eprintln!("Checking API and BUI startup conditions");

    // Try status check with retries
    let max_status_attempts = 3;
    let mut services_status = None;

    for attempt in 1..=max_status_attempts {
        match crate::check_server_status().await {
            Ok(status) => {
                services_status = Some(status);
                break;
            }
            Err(e) if attempt == max_status_attempts => {
                eprintln!("Failed to check services status after {} attempts: {}", max_status_attempts, e);
            }
            Err(e) => {
                eprintln!("Services status check attempt {}/{} failed: {}", attempt, max_status_attempts, e);
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }

    if let Some(status) = services_status {
        if status.api.service_responds && status.bui.service_responds {
            eprintln!("All services are already running");
            return Ok(());
        }
        eprintln!("Services not running (API: {}, BUI: {})", status.api.service_responds, status.bui.service_responds);

        // Start API if it's not running
        if !status.api.service_responds {
            eprintln!("Starting API automatically");
            let api_result = crate::start_api().await;
            if let Err(e) = api_result {
                eprintln!("Failed to start API: {}", e);
                return Err(e);
            }
            let api_result = api_result.unwrap();
            if !api_result.success {
                let error = api_result.error.unwrap_or_else(|| "Unknown error".to_string());
                eprintln!("API start returned false: {}", error);
                return Err("API failed to start".to_string());
            }
        }

        // Start BUI if it's not running
        if !status.bui.service_responds {
            eprintln!("Starting BUI automatically");
            let bui_result = crate::start_bui().await;
            if let Err(e) = bui_result {
                eprintln!("Failed to start BUI: {}", e);
                return Err(e);
            }
            let bui_result = bui_result.unwrap();
            if !bui_result.success {
                let error = bui_result.error.unwrap_or_else(|| "Unknown error".to_string());
                eprintln!("BUI start returned false: {}", error);
                return Err("BUI failed to start".to_string());
            }
        }
    } else {
        // If we couldn't get status, try starting both services
        eprintln!("Could not determine service status, attempting to start both services");
        
        // Start API
        let api_result = crate::start_api().await?;
        if !api_result.success {
            let error = api_result.error.unwrap_or_else(|| "Unknown error".to_string());
            eprintln!("API start returned false: {}", error);
            return Err("API failed to start".to_string());
        }

        // Start BUI
        let bui_result = crate::start_bui().await?;
        if !bui_result.success {
            let error = bui_result.error.unwrap_or_else(|| "Unknown error".to_string());
            eprintln!("BUI start returned false: {}", error);
            return Err("BUI failed to start".to_string());
        }
    }

    Ok(())
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
        dirs::home_dir().map(|home| {
            home.join(".bb")
                .join("logs")
        })
    }
}

pub fn run() {
    // Log startup attempt with detailed environment info
    eprintln!("Starting Beyond Better DUI...");
    if let Ok(exe_path) = std::env::current_exe() {
        eprintln!("Executable path: {:?}", exe_path);
    }
    if let Ok(current_dir) = std::env::current_dir() {
        eprintln!("Current directory: {:?}", current_dir);
    }

    // Check ProgramData permissions
    if let Ok(program_data) = std::env::var("ProgramData") {
        eprintln!("ProgramData path: {:?}", program_data);
        let bb_program_data = PathBuf::from(program_data).join("Beyond Better");
        eprintln!("Beyond Better ProgramData directory: {:?}", bb_program_data);
        
        if bb_program_data.exists() {
            eprintln!("ProgramData directory exists");
            if let Ok(metadata) = std::fs::metadata(&bb_program_data) {
                eprintln!("Directory is writable: {}", metadata.permissions().readonly() == false);
            } else {
                eprintln!("Failed to get ProgramData directory metadata");
            }
        } else {
            eprintln!("ProgramData directory does not exist");
            // Try to create it
            match std::fs::create_dir_all(&bb_program_data) {
                Ok(_) => eprintln!("Successfully created ProgramData directory"),
                Err(e) => eprintln!("Failed to create ProgramData directory: {}", e)
            }
        }
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        eprintln!("APPDATA path: {:?}", appdata);
        let tauri_app_dir = PathBuf::from(appdata).join("dev.beyondbetter.app");
        eprintln!("Tauri app directory: {:?}", tauri_app_dir);
        
        // Check directory permissions
        if tauri_app_dir.exists() {
            eprintln!("Tauri app directory exists");
            if let Ok(metadata) = std::fs::metadata(&tauri_app_dir) {
                eprintln!("Directory is writable: {}", metadata.permissions().readonly() == false);
            } else {
                eprintln!("Failed to get directory metadata");
            }
        } else {
            eprintln!("Tauri app directory does not exist");
            // Try to create it
            match std::fs::create_dir_all(&tauri_app_dir) {
                Ok(_) => eprintln!("Successfully created Tauri app directory"),
                Err(e) => eprintln!("Failed to create Tauri app directory: {}", e)
            }
        }
    }

    eprintln!("Getting app log directory...");
    let log_dir = match get_app_log_dir() {
        Some(dir) => {
            eprintln!("Log directory: {:?}", dir);
            dir
        },
        None => {
            eprintln!("Failed to get log directory");
            panic!("Failed to get log directory");
        }
    };
    std::fs::create_dir_all(&log_dir).expect("Failed to create log directory");
    
    eprintln!("Starting Beyond Better DUI application");

    // Basic logging to file
    let log_file = log_dir.join("dui.log");
    if let Some(parent) = log_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let startup_msg = format!("[{}] Starting Beyond Better DUI...\n", timestamp);
    let _ = std::fs::write(&log_file, startup_msg);

    // Ensure global config exists before starting the app
    if let Err(e) = ensure_global_config() {
        eprintln!("Failed to ensure global config: {}", e);
    }

    // Try to start services if needed
    tauri::async_runtime::block_on(async {
        if let Err(e) = start_services_if_needed().await {
            eprintln!("Failed to start services: {}", e);
        }
    });

    // Start proxy server if needed
    eprintln!("Initializing proxy state");
    let proxy_state = match tauri::async_runtime::block_on(async {
        start_proxy(log_dir.clone()).await
    }) {
        Ok(proxy) => {
            eprintln!("Proxy server initialized");
            Arc::new(RwLock::new(proxy))
        },
        Err(e) => {
            eprintln!("Failed to initialize proxy server: {}", e);
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
                eprintln!("Main window not found");
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}