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

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            perform_upgrade
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}