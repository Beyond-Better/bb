/*
 * License: AGPL-3.0-or-later
 * Copyright: 2025 - Beyond Better <charlie@beyondbetter.app>
 */

use log::{debug, error, info, warn};
use tauri_plugin_fs;
// Use Tauri's HTTP types, not the standalone HTTP crate
use crate::config::get_global_config_dir;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::Manager;
use tokio::sync::RwLock;

// Make modules available within the crate
pub mod api;
pub mod bui;
pub mod commands; // Make commands module public
pub mod config; // Make config module public
pub mod logging;
pub mod oauth; // OAuth authentication module
pub mod proxy;
pub mod window_state;

// Re-export public items
pub use crate::api::{start_api, stop_api};
pub use crate::bui::{start_bui, stop_bui};
pub use crate::commands::config::{
    get_api_log_path, get_bui_log_path, get_dui_log_path, get_global_config, get_log_path,
    get_proxy_log_path, open_log_file, set_global_config_value, test_read_config,
};
pub use crate::commands::proxy::{
    get_proxy_info, set_debug_mode, set_proxy_target, start_proxy_server, stop_proxy_server,
};
pub use crate::commands::server_status::check_server_status;
pub use crate::commands::upgrade::{perform_install, perform_upgrade, check_dui_update, perform_atomic_update, perform_dui_update_only};
pub use crate::commands::version::{
    check_version_compatibility, get_binary_version, get_version_info,
};
pub use crate::config::{
    get_api_config, get_bui_config, get_dui_debug_mode, read_global_config, set_dui_debug_mode,
    ApiConfig, BuiConfig,
};
pub use crate::window_state::{
    apply_window_state, load_window_state, save_window_state, setup_window_state_handler,
};
pub use crate::oauth::{
    close_oauth_window, complete_oauth_flow, get_oauth_windows, start_oauth_flow,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
async fn start_proxy(
    log_dir: std::path::PathBuf,
) -> Result<proxy::HttpProxy, Box<dyn std::error::Error>> {
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
                format!("Failed to start proxy server: {}", e),
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
    // eprintln!("Getting global config directory...");
    let config_dir = get_global_config_dir()?;
    // eprintln!("Config directory: {:?}", config_dir);
    let config_path = config_dir.join("config.yaml");
    // eprintln!("Config path: {:?}", config_path);

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
    debug!("Checking API and BUI startup conditions");

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
                warn!(
                    "Failed to check services status after {} attempts: {}",
                    max_status_attempts, e
                );
            }
            Err(e) => {
                debug!(
                    "Services status check attempt {}/{} failed: {}",
                    attempt, max_status_attempts, e
                );
                std::thread::sleep(Duration::from_millis(500));
            }
        }
    }

    if let Some(status) = services_status {
        if status.api.service_responds && status.bui.service_responds {
            info!("All services are already running");
            return Ok(());
        }
        debug!(
            "Services not running (API: {}, BUI: {})",
            status.api.service_responds, status.bui.service_responds
        );

        // Start API if it's not running
        if !status.api.service_responds {
            info!("Starting API automatically");
            let api_result = crate::start_api().await;
            if let Err(e) = api_result {
                error!("Failed to start API: {}", e);
                return Err(e);
            }
            let api_result = api_result.unwrap();
            if !api_result.success {
                let error = api_result
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                warn!("API start returned false: {}", error);
                return Err("API failed to start".to_string());
            }
        }

        // Start BUI if it's not running
        if !status.bui.service_responds {
            info!("Starting BUI automatically");
            let bui_result = crate::start_bui().await;
            if let Err(e) = bui_result {
                error!("Failed to start BUI: {}", e);
                return Err(e);
            }
            let bui_result = bui_result.unwrap();
            if !bui_result.success {
                let error = bui_result
                    .error
                    .unwrap_or_else(|| "Unknown error".to_string());
                warn!("BUI start returned false: {}", error);
                return Err("BUI failed to start".to_string());
            }
        }
    } else {
        // If we couldn't get status, try starting both services
        info!("Could not determine service status, attempting to start both services");

        // Start API
        let api_result = crate::start_api().await?;
        if !api_result.success {
            let error = api_result
                .error
                .unwrap_or_else(|| "Unknown error".to_string());
            warn!("API start returned false: {}", error);
            return Err("API failed to start".to_string());
        }

        // Start BUI
        let bui_result = crate::start_bui().await?;
        if !bui_result.success {
            let error = bui_result
                .error
                .unwrap_or_else(|| "Unknown error".to_string());
            warn!("BUI start returned false: {}", error);
            return Err("BUI failed to start".to_string());
        }
    }

    Ok(())
}

fn get_app_log_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| home.join("Library").join("Logs").join(config::APP_NAME))
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
        dirs::home_dir().map(|home| home.join(".bb").join("logs"))
    }
}

async fn setup_windows(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    //    // Set up macOS menu
    //    #[cfg(target_os = "macos")]
    //    {
    //        // For macOS, let Tauri handle the menu creation using the productName from tauri.conf.json
    //        // and the Info.plist template
    //        use tauri::menu::Menu;
    //        if let Ok(menu) = Menu::default(&app.handle()) {
    //            let _ = app.set_menu(menu);
    //        }
    //    }

    // Set up window state
    //if let Some(main_window) = app.webview_windows().get("main") {
    if let Some(main_window) = app.get_webview_window("main") {
        // Load and apply saved window state
        let state =
            window_state::load_window_state("main".to_string(), app.handle().clone(), Some(false))
                .await?; // Use physical pixels for DUI window
        window_state::apply_window_state_internal(&main_window, &state);

        // Set up window state event handlers
        window_state::setup_window_state_handler_internal(&main_window);
    } else {
        warn!("Main window not found");
    }
    Ok(())
}

fn handle_bblink_protocol<'a, R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<'a, R>,
    request: tauri::http::Request<Vec<u8>>,
) -> tauri::http::Response<Vec<u8>> {
    // Extract the actual download URL from the request URL
    let url_str = request.uri().to_string();
    info!("[DOWNLOAD HANDLER] Received bblink request: {}", url_str);

    // Protocol format should be: bblink://https://example.com/file.zip
    if let Some(actual_url) = url_str.strip_prefix("bblink://") {
        info!(
            "[DOWNLOAD HANDLER] Opening URL in system browser: {}",
            actual_url
        );

        // Open in system browser using platform-specific command
        let cmd = if cfg!(target_os = "windows") {
            "cmd"
        } else if cfg!(target_os = "macos") {
            "open"
        } else {
            "xdg-open"
        };

        // URL-decode the string to handle any URL encoding
        let decoded_url = match urlencoding::decode(actual_url) {
            Ok(decoded) => decoded.to_string(),
            Err(e) => {
                error!("[DOWNLOAD HANDLER] Failed to decode URL: {}", e);
                actual_url.to_string()
            }
        };

        // Fix common protocol formatting issues and ensure proper protocol
        let url_to_open =
            if decoded_url.starts_with("https://") || decoded_url.starts_with("http://") {
                // URL already has correct protocol
                decoded_url
            } else if decoded_url.starts_with("https/") {
                // Missing colon after https
                decoded_url.replacen("https/", "https:/", 1)
            } else if decoded_url.starts_with("http/") {
                // Missing colon after http
                decoded_url.replacen("http/", "http:/", 1)
            } else {
                // No protocol, add https://
                format!("https://{}", decoded_url)
            };

        info!("[DOWNLOAD HANDLER] Final URL for opening: {}", url_to_open);

        info!(
            "[DOWNLOAD HANDLER] Formatted URL for opening: {}",
            url_to_open
        );

        let url_str = url_to_open.as_str();

        let args = if cfg!(target_os = "windows") {
            vec!["/c", "start", "", url_str]
        } else {
            vec![url_str]
        };

        match std::process::Command::new(cmd).args(args).spawn() {
            Ok(child) => info!(
                "[DOWNLOAD HANDLER] Successfully spawned process with ID: {:?}",
                child.id()
            ),
            Err(e) => error!("[DOWNLOAD HANDLER] Failed to open URL: {}", e),
        }
    } else {
        warn!("[DOWNLOAD HANDLER] Invalid bblink URL format: {}", url_str);
    }

    // Return a response with a helpful message in case the page shows
    // This makes the UX better if the user somehow sees this page
    let html_content = r#"<!DOCTYPE html>
<html>
<head>
    <title>Link Opened in Browser</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
            color: #333;
            text-align: center;
            padding: 50px;
            max-width: 600px;
            margin: 0 auto;
            line-height: 1.6;
        }
        h1 { color: #2563EB; }
        .box {
            background-color: #F3F4F6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            border-left: 4px solid #2563EB;
        }
        .button {
            display: inline-block;
            background-color: #2563EB;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            text-decoration: none;
            margin-top: 20px;
            font-weight: 500;
        }
        .button:hover {
            background-color: #1D4ED8;
        }
    </style>
    <script>
        setTimeout(() => {
            history.back();
        }, 5000);
    </script>
</head>
<body>
    <h1>Link Opened in Browser</h1>
    <div class="box">
        <p>The link has been opened in your default browser.</p>
        <p>If the link is a download that doesn't start automatically, please check your browser.</p>
    </div>
    <a href="javascript:history.back()" class="button">Return to Chat Page</a>
</body>
</html>
"#;

    tauri::http::Response::new(html_content.as_bytes().to_vec())
}

pub fn run() {
    //    // Log startup attempt with detailed environment info
    //    eprintln!("Starting Beyond Better DUI...");
    //    if let Ok(exe_path) = std::env::current_exe() {
    //        eprintln!("Executable path: {:?}", exe_path);
    //    }
    //    if let Ok(current_dir) = std::env::current_dir() {
    //        eprintln!("Current directory: {:?}", current_dir);
    //    }
    //
    //    // Check ProgramData permissions
    //    if let Ok(program_data) = std::env::var("ProgramData") {
    //        eprintln!("ProgramData path: {:?}", program_data);
    //        let bb_program_data = PathBuf::from(program_data).join("Beyond Better");
    //        eprintln!("Beyond Better ProgramData directory: {:?}", bb_program_data);
    //
    //        if bb_program_data.exists() {
    //            eprintln!("ProgramData directory exists");
    //            if let Ok(metadata) = std::fs::metadata(&bb_program_data) {
    //                eprintln!("Directory is writable: {}", metadata.permissions().readonly() == false);
    //            } else {
    //                eprintln!("Failed to get ProgramData directory metadata");
    //            }
    //        } else {
    //            eprintln!("ProgramData directory does not exist");
    //            // Try to create it
    //            match std::fs::create_dir_all(&bb_program_data) {
    //                Ok(_) => eprintln!("Successfully created ProgramData directory"),
    //                Err(e) => eprintln!("Failed to create ProgramData directory: {}", e)
    //            }
    //        }
    //    }
    //    if let Ok(appdata) = std::env::var("APPDATA") {
    //        eprintln!("APPDATA path: {:?}", appdata);
    //        let tauri_app_dir = PathBuf::from(appdata).join("dev.beyondbetter.app");
    //        eprintln!("Tauri app directory: {:?}", tauri_app_dir);
    //
    //        // Check directory permissions
    //        if tauri_app_dir.exists() {
    //            eprintln!("Tauri app directory exists");
    //            if let Ok(metadata) = std::fs::metadata(&tauri_app_dir) {
    //                eprintln!("Directory is writable: {}", metadata.permissions().readonly() == false);
    //            } else {
    //                eprintln!("Failed to get directory metadata");
    //            }
    //        } else {
    //            eprintln!("Tauri app directory does not exist");
    //            // Try to create it
    //            match std::fs::create_dir_all(&tauri_app_dir) {
    //                Ok(_) => eprintln!("Successfully created Tauri app directory"),
    //                Err(e) => eprintln!("Failed to create Tauri app directory: {}", e)
    //            }
    //        }
    //    }
    //
    //    eprintln!("Getting app log directory...");
    //    let log_dir = match get_app_log_dir() {
    //        Some(dir) => {
    //            eprintln!("Log directory: {:?}", dir);
    //            dir
    //        },
    //        None => {
    //            eprintln!("Failed to get log directory");
    //            panic!("Failed to get log directory");
    //        }
    //    };
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
    let proxy_state =
        match tauri::async_runtime::block_on(async { start_proxy(log_dir.clone()).await }) {
            Ok(proxy) => {
                info!("Proxy server initialized");
                Arc::new(RwLock::new(proxy))
            }
            Err(e) => {
                error!("Failed to initialize proxy server: {}", e);
                panic!("Failed to initialize proxy server: {}", e);
            }
        };

    // Initialize Tauri
    tauri::Builder::default()
        // Register custom protocol handler for downloads
        .register_uri_scheme_protocol("bblink", handle_bblink_protocol)
        .invoke_handler(tauri::generate_handler![
            start_api,
            stop_api,
            start_bui,
            stop_bui,
            commands::upgrade::open_external_url,
            commands::server_status::check_server_status,
            get_api_config,
            get_bui_config,
            get_global_config,
            get_binary_version,
            get_version_info,
            check_version_compatibility,
            perform_install,
            perform_upgrade,
            commands::upgrade::check_dui_update,
            commands::upgrade::perform_atomic_update,
            commands::upgrade::perform_dui_update_only,
            set_global_config_value,
            test_read_config,
            get_log_path,
            get_api_log_path,
            get_bui_log_path,
            get_dui_log_path,
            get_proxy_log_path,
            open_log_file,
            get_proxy_info,
            set_proxy_target,
            set_debug_mode,
            start_proxy_server,
            stop_proxy_server,
            get_dui_debug_mode,
            set_dui_debug_mode,
            load_window_state,
            save_window_state,
            setup_window_state_handler,
            apply_window_state,
            start_oauth_flow,
            complete_oauth_flow,
            get_oauth_windows,
            close_oauth_window
        ])
        .manage(proxy_state)
        //.plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| tauri::async_runtime::block_on(async { setup_windows(app).await }))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
