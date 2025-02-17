// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use beyond_better_lib::{
    run
};

fn main() {
    // Create a startup log file in a known location
    if let Ok(program_data) = std::env::var("ProgramData") {
        let log_path = std::path::PathBuf::from(program_data)
            .join("Beyond Better")
            .join("startup.log");
        
        // Ensure directory exists
        if let Some(dir) = log_path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        
        // Log startup attempt with timestamp
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let startup_msg = format!("[{}] Attempting to start Beyond Better...\n", timestamp);
        let _ = std::fs::write(&log_path, startup_msg);
    }
    
    run();
}