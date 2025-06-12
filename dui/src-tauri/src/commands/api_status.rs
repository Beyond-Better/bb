use reqwest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;
use log::{info, error};

use crate::config::read_global_config;

#[cfg(not(target_os = "windows"))]
use std::process::Command as StdCommand;
#[cfg(target_os = "windows")]
use std::process::Command as StdCommand;

const PID_FILE_NAME: &str = "api.pid";
const APP_NAME: &str = "dev.beyondbetter.app";

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiStatusCheck {
    pub pid_exists: bool,
    pub process_responds: bool,
    pub api_responds: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
}

fn get_app_runtime_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home_dir =
            dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
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
        let home_dir =
            dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        let dir = home_dir.join(".bb").join("run");
        fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create runtime directory: {}", e))?;
        Ok(dir)
    }
}

fn get_pid_file_path() -> Result<PathBuf, String> {
    Ok(get_app_runtime_dir()?.join(PID_FILE_NAME))
}

pub async fn save_api_pid(pid: i32) -> Result<(), String> {
    let pid_file = get_pid_file_path()?;
    fs::write(&pid_file, pid.to_string()).map_err(|e| format!("Failed to write PID file: {}", e))
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
        fs::remove_file(&pid_file).map_err(|e| format!("Failed to remove PID file: {}", e))
    } else {
        Ok(())
    }
}

#[cfg(target_family = "unix")]
fn check_process_exists(pid: i32) -> bool {
    unsafe { libc::kill(pid, 0) == 0 }
}

#[cfg(target_family = "windows")]
fn check_process_exists(pid: i32) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, FALSE};
    use windows_sys::Win32::System::Threading::{GetExitCodeProcess, OpenProcess};

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

// Add new function for process discovery
pub async fn find_all_api_processes() -> Result<Vec<i32>, String> {
    let process_name = if cfg!(target_os = "windows") {
        "bb-api.exe"
    } else {
        "bb-api"
    };

    let output = if cfg!(target_os = "windows") {
        StdCommand::new("tasklist")
            .args(&["/fo", "csv", "/nh"])
            .output()
    } else if cfg!(target_os = "macos") {
        StdCommand::new("pgrep")
            .args(&["-f", process_name])
            .output()
    } else {
        // Linux
        StdCommand::new("pgrep")
            .args(&[process_name])
            .output()
    };

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let mut pids = Vec::new();

            if cfg!(target_os = "windows") {
                // Parse CSV format from tasklist
                for line in stdout.lines() {
                    if line.contains(process_name) {
                        let parts: Vec<&str> = line.split(',').collect();
                        if parts.len() >= 2 {
                            if let Ok(pid) = parts[1].trim_matches('"').parse::<i32>() {
                                pids.push(pid);
                            }
                        }
                    }
                }
            } else {
                // Parse pgrep output
                for line in stdout.lines() {
                    if let Ok(pid) = line.trim().parse::<i32>() {
                        pids.push(pid);
                    }
                }
            }

            info!("Found {} API processes: {:?}", pids.len(), pids);
            Ok(pids)
        }
        Err(e) => {
            error!("Failed to list processes: {}", e);
            Err(format!("Failed to list processes: {}", e))
        }
    }
}

// Add robust termination function
pub async fn robust_terminate_process(pid: i32, process_name: &str) -> bool {
    info!("Attempting to terminate {} process PID: {}", process_name, pid);
    
    // First try graceful termination
    let graceful_result = {
        #[cfg(target_family = "unix")]
        {
            unsafe { libc::kill(pid, libc::SIGTERM) == 0 }
        }
        #[cfg(target_family = "windows")]
        {
            // Try WM_CLOSE first for graceful shutdown
            false // Skip for now, go straight to TerminateProcess
        }
    };

    if graceful_result {
        // Wait a bit for graceful shutdown
        std::thread::sleep(std::time::Duration::from_millis(2000));
        
        // Check if process is gone
        if !check_process_exists(pid) {
            info!("Process {} terminated gracefully", pid);
            return true;
        }
    }

    // Force termination
    info!("Force terminating process {}", pid);
    let _force_result = {
        #[cfg(target_family = "unix")]
        {
            unsafe { libc::kill(pid, libc::SIGKILL) == 0 }
        }
        #[cfg(target_family = "windows")]
        {
            use windows_sys::Win32::Foundation::{CloseHandle, FALSE};
            use windows_sys::Win32::System::Threading::{OpenProcess, TerminateProcess};
            
            const PROCESS_TERMINATE: u32 = 0x0001;
            unsafe {
                let handle = OpenProcess(PROCESS_TERMINATE, FALSE, pid as u32);
                if handle == 0 {
                    false
                } else {
                    let result = TerminateProcess(handle, 1);
                    CloseHandle(handle);
                    result != 0
                }
            }
        }
    };

    // Wait a bit and verify
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let success = !check_process_exists(pid);
    
    if success {
        info!("Process {} terminated successfully", pid);
    } else {
        error!("Failed to terminate process {}", pid);
    }
    
    success
}

async fn check_api_responds(hostname: &str, port: u16, use_tls: bool) -> Result<bool, String> {
    // Try the configured protocol first
    let primary_scheme = if use_tls { "https" } else { "http" };
    let primary_url = format!("{}://{}:{}/api/v1/status", primary_scheme, hostname, port);

    info!("Checking API status at: {}", primary_url);

    match reqwest::get(&primary_url).await {
        Ok(response) => {
            let status = response.status();
            info!("API responded with status: {} on {}", status, primary_scheme);
            if status.is_success() {
                return Ok(true);
            }
        }
        Err(e) => {
            info!("Failed to connect to API on {}: {}", primary_scheme, e);
        }
    }

    // Fallback to the other protocol
    let fallback_scheme = if use_tls { "http" } else { "https" };
    let fallback_url = format!("{}://{}:{}/api/v1/status", fallback_scheme, hostname, port);

    info!("Trying fallback API status check at: {}", fallback_url);

    match reqwest::get(&fallback_url).await {
        Ok(response) => {
            let status = response.status();
            info!("API responded with status: {} on {} (fallback)", status, fallback_scheme);
            Ok(status.is_success())
        }
        Err(e) => {
            info!("Failed to connect to API on {} (fallback): {}", fallback_scheme, e);
            Ok(false)
        }
    }
}

#[command]
pub async fn check_api_status() -> Result<ApiStatusCheck, String> {
    println!("Checking Server status...");

    let mut status = ApiStatusCheck {
        pid_exists: false,
        process_responds: false,
        api_responds: false,
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

            // Level 3: Check if API endpoint responds
            if status.pid_exists {
                let config = read_global_config()
                    .map_err(|e| format!("Failed to read global config: {}", e))?;

                println!(
                    "Checking Server endpoint at {}:{}",
                    config.api.hostname, config.api.port
                );
                match check_api_responds(
                    &config.api.hostname,
                    config.api.port,
                    config.api.tls.use_tls,
                )
                .await
                {
                    Ok(responds) => {
                        status.api_responds = responds;
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

pub async fn reconcile_api_pid_state() -> Result<(), String> {
    let status = check_api_status().await?;
    let pid = get_pid().await?;

    if !status.pid_exists && pid.is_some() {
        // PID file exists but process doesn't - clean up
        remove_pid().await?;
    } else if status.pid_exists && !status.api_responds {
        // Process exists but API doesn't respond - potential zombie
        println!("Server process exists but is not responding. Consider restarting.");
    } else if status.api_responds && pid.is_none() {
        // API responds but no PID file - recover state if possible
        if let Some(pid) = status.pid {
            println!("Recovering PID file with process ID: {}", pid);
            save_api_pid(pid).await?;
        }
    }

    Ok(())
}
