use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use reqwest;
use tauri::command;

use crate::config::read_global_config;

const PID_FILE_NAME: &str = "bui.pid";
const APP_NAME: &str = "dev.beyondbetter.app";

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiStatusCheck {
    pub pid_exists: bool,
    pub process_responds: bool,
    pub bui_responds: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
}

fn get_app_runtime_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home_dir = dirs::home_dir()
            .ok_or_else(|| "Failed to get home directory".to_string())?;
        let dir = home_dir
            .join("Library")
            .join("Application Support")
            .join(APP_NAME)
            .join("run");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create runtime directory: {}", e))?;
        Ok(dir)
    }

    #[cfg(target_os = "windows")]
    {
        let program_data = std::env::var("ProgramData")
            .map_err(|_| "Failed to get ProgramData directory".to_string())?;
        let dir = PathBuf::from(program_data).join(APP_NAME).join("run");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create runtime directory: {}", e))?;
        Ok(dir)
    }

    #[cfg(target_os = "linux")]
    {
        let dir = PathBuf::from("/var/run").join(APP_NAME.to_lowercase());
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create runtime directory: {}", e))?;
        Ok(dir)
    }
}

fn get_pid_file_path() -> Result<PathBuf, String> {
    Ok(get_app_runtime_dir()?.join(PID_FILE_NAME))
}

pub async fn save_bui_pid(pid: i32) -> Result<(), String> {
    let pid_file = get_pid_file_path()?;
    fs::write(&pid_file, pid.to_string())
        .map_err(|e| format!("Failed to write PID file: {}", e))
}

pub async fn get_pid() -> Result<Option<i32>, String> {
    let pid_file = get_pid_file_path()?;
    match fs::read_to_string(&pid_file) {
        Ok(content) => match content.trim().parse::<i32>() {
            Ok(pid) => Ok(Some(pid)),
            Err(_) => Ok(None),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read PID file: {}", e)),
    }
}

pub async fn remove_pid() -> Result<(), String> {
    let pid_file = get_pid_file_path()?;
    if pid_file.exists() {
        fs::remove_file(&pid_file)
            .map_err(|e| format!("Failed to remove PID file: {}", e))
    } else {
        Ok(())
    }
}

#[cfg(target_family = "unix")]
fn check_process_exists(pid: i32) -> bool {
    unsafe {
        libc::kill(pid, 0) == 0
    }
}

#[cfg(target_family = "windows")]
fn check_process_exists(pid: i32) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, FALSE};
    use windows_sys::Win32::System::Threading::{OpenProcess, GetExitCodeProcess};
    
    const PROCESS_QUERY_INFORMATION: u32 = 0x0400;
    const STILL_ACTIVE: u32 = 259;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_INFORMATION, FALSE, pid as u32);
        if handle == 0 {
            return false;
        }

        let mut exit_code: u32 = 0;
        let result = GetExitCodeProcess(handle, &mut exit_code);
        CloseHandle(handle);

        result != 0 && exit_code == STILL_ACTIVE
    }
}

async fn check_bui_responds(hostname: &str, port: u16, use_tls: bool) -> Result<bool, String> {
    let scheme = if use_tls { "https" } else { "http" };
    let url = format!("{}://{}:{}/api/v1/status", scheme, hostname, port);
    
    println!("Checking Server status at: {}", url);
    
    match reqwest::get(&url).await {
        Ok(response) => {
            let status = response.status();
            println!("Server responded with status: {}", status);
            Ok(status.is_success())
        },
        Err(e) => {
            println!("Failed to connect to Server: {}", e);
            Ok(false)
        }
    }
}

#[command]
pub async fn check_bui_status() -> Result<ApiStatusCheck, String> {
    println!("Checking Server status...");
    
    let mut status = ApiStatusCheck {
        pid_exists: false,
        process_responds: false,
        bui_responds: false,
        pid: None,
        error: None,
    };

    // Level 1: Check PID file
    let pid = get_pid().await?;
    match pid {
        Some(pid) => {
            println!("Found PID file with PID: {}", pid);
            status.pid = Some(pid);
            
            // Level 2: Check if process exists
            status.pid_exists = check_process_exists(pid);
            println!("Process exists: {}", status.pid_exists);

            // Level 3: Check if BUI endpoint responds
            if status.pid_exists {
                let config = read_global_config()
                    .map_err(|e| format!("Failed to read global config: {}", e))?;
                
                println!("Checking Server endpoint at {}:{}", config.bui.hostname, config.bui.port);
                match check_bui_responds(
                    &config.bui.hostname,
                    config.bui.port,
                    config.bui.tls.use_tls
                ).await {
                    Ok(responds) => {
                        status.bui_responds = responds;
                        status.process_responds = responds;
                        println!("Server responds: {}", responds);
                    }
                    Err(e) => {
                        println!("Error checking Server response: {}", e);
                        status.error = Some(e);
                    }
                }
            }
        }
        None => {
            println!("No PID file found");
        }
    }

    Ok(status)
}

pub async fn reconcile_bui_pid_state() -> Result<(), String> {
    let status = check_bui_status().await?;
    let pid = get_pid().await?;

    if !status.pid_exists && pid.is_some() {
        // PID file exists but process doesn't - clean up
        remove_pid().await?;
    } else if status.pid_exists && !status.bui_responds {
        // Process exists but BUI doesn't respond - potential zombie
        println!("Server process exists but is not responding. Consider restarting.");
    } else if status.bui_responds && pid.is_none() {
        // BUI responds but no PID file - recover state if possible
        if let Some(pid) = status.pid {
            println!("Recovering PID file with process ID: {}", pid);
            save_bui_pid(pid).await?;
        }
    }

    Ok(())
}