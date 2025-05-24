// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use beyond_better_lib::run;

fn main() {
    run();
}

//use beyond_better_lib::run;
//use std::fs;
//use std::path::PathBuf;
//use std::time::SystemTime;
//
//fn log_to_file(msg: &str) {
//    if let Some(log_dir) = get_log_dir() {
//        let log_path = log_dir.join("startup.log");
//        let timestamp = SystemTime::now()
//            .duration_since(SystemTime::UNIX_EPOCH)
//            .unwrap_or_default()
//            .as_secs();
//
//        let log_msg = format!("[{}] {}\n", timestamp, msg);
//
//        // Ensure directory exists
//        if let Some(parent) = log_path.parent() {
//            let _ = fs::create_dir_all(parent);
//        }
//
//        // Append to log file
//        if let Ok(mut content) = fs::read_to_string(&log_path) {
//            content.push_str(&log_msg);
//            let _ = fs::write(&log_path, content);
//        } else {
//            let _ = fs::write(&log_path, log_msg);
//        }
//    }
//}
//
//fn get_log_dir() -> Option<PathBuf> {
//    #[cfg(target_os = "windows")]
//    {
//        std::env::var("ProgramData").ok().map(|program_data| {
//            PathBuf::from(program_data)
//                .join("Beyond Better")
//                .join("logs")
//        })
//    }
//
//    #[cfg(not(target_os = "windows"))]
//    {
//        None
//    }
//}
//
//fn main() {
//    // Always log to stdout in debug builds
//    #[cfg(debug_assertions)]
//    {
//        println!("Starting Beyond Better in debug mode");
//        println!("Current exe: {:?}", std::env::current_exe().unwrap_or_default());
//        println!("Current dir: {:?}", std::env::current_dir().unwrap_or_default());
//    }
//
//    log_to_file("Application starting");
//
//    // Log environment info
//    if let Ok(exe_path) = std::env::current_exe() {
//        log_to_file(&format!("Executable path: {:?}", exe_path));
//    }
//    if let Ok(current_dir) = std::env::current_dir() {
//        log_to_file(&format!("Current directory: {:?}", current_dir));
//    }
//
//    // Start the application
//    log_to_file("Starting Tauri application");
//    run();
//}
