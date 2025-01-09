use std::fs;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use reqwest;
use tauri::command;

use crate::config::read_global_config;

const API_PID_FILE_NAME: &str = "api.pid";
const BUI_PID_FILE_NAME: &str = "bui.pid"; // Must match the name used in BUI's fresh.config.ts
const APP_NAME: &str = "dev.beyondbetter.app";

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub pid_exists: bool,
    pub process_responds: bool,
    pub service_responds: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ServerStatus {
    pub api: ServiceStatus,
    pub bui: ServiceStatus,
    pub all_services_ready: bool,
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

fn get_pid_file_path(service: &str) -> Result<PathBuf, String> {
    let filename = match service {
        "api" => API_PID_FILE_NAME,
        "bui" => BUI_PID_FILE_NAME,
        _ => return Err(format!("Invalid service name: {}", service)),
    };
    Ok(get_app_runtime_dir()?.join(filename))
}

pub async fn save_pid(service: &str, pid: i32) -> Result<(), String> {
    let pid_file = get_pid_file_path(service)?;
    fs::write(&pid_file, pid.to_string())
        .map_err(|e| format!("Failed to write PID file: {}", e))
}

pub async fn get_pid(service: &str) -> Result<Option<i32>, String> {
    let pid_file = get_pid_file_path(service)?;
    match fs::read_to_string(&pid_file) {
        Ok(content) => match content.trim().parse::<i32>() {
            Ok(pid) => Ok(Some(pid)),
            Err(_) => Ok(None),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read PID file: {}", e)),
    }
}

pub async fn remove_pid(service: &str) -> Result<(), String> {
    let pid_file = get_pid_file_path(service)?;
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

async fn check_api_responds(hostname: &str, port: u16, use_tls: bool) -> Result<bool, String> {
    let scheme = if use_tls { "https" } else { "http" };
    let url = format!("{}://{}:{}/api/v1/status", scheme, hostname, port);
    
    println!("Checking API status at: {}", url);
    
    match reqwest::get(&url).await {
        Ok(response) => {
            let status = response.status();
            println!("API responded with status: {}", status);
            Ok(status.is_success())
        },
        Err(e) => {
            println!("Failed to connect to API: {}", e);
            Ok(false)
        }
    }
}

async fn check_bui_responds(hostname: &str, port: u16, use_tls: bool) -> Result<bool, String> {
    let scheme = if use_tls { "https" } else { "http" };
    let url = format!("{}://{}:{}/api/v1/status", scheme, hostname, port);
    
    println!("Checking BUI status at: {}", url);
    
    match reqwest::get(&url).await {
        Ok(response) => {
            let status = response.status();
            println!("BUI responded with status: {}", status);
            Ok(status.is_success())
        },
        Err(e) => {
            println!("Failed to connect to BUI: {}", e);
            Ok(false)
        }
    }
}

async fn check_service_status(service: &str) -> Result<ServiceStatus, String> {
    println!("Checking {} status...", service.to_uppercase());
    
    let mut status = ServiceStatus {
        pid_exists: false,
        process_responds: false,
        service_responds: false,
        pid: None,
        error: None,
    };

    // Level 1: Check PID file
    let pid = get_pid(service).await?;
    match pid {
        Some(pid) => {
            println!("Found PID file with PID: {}", pid);
            status.pid = Some(pid);
            
            // Level 2: Check if process exists
            status.pid_exists = check_process_exists(pid);
            println!("Process exists: {}", status.pid_exists);

            // Level 3: Check if service endpoint responds
            if status.pid_exists {
                let config = read_global_config()
                    .map_err(|e| format!("Failed to read global config: {}", e))?;
                
                match service {
                    "api" => {
                        println!("Checking API endpoint at {}:{}", config.api.hostname, config.api.port);
                        match check_api_responds(
                            &config.api.hostname,
                            config.api.port,
                            config.api.tls.use_tls
                        ).await {
                            Ok(responds) => {
                                status.service_responds = responds;
                                status.process_responds = responds;
                                println!("API responds: {}", responds);
                            }
                            Err(e) => {
                                println!("Error checking API response: {}", e);
                                status.error = Some(e);
                            }
                        }
                    },
                    "bui" => {
                        println!("Checking BUI endpoint at {}:{}", config.bui.hostname, config.bui.port);
                        match check_bui_responds(
                            &config.bui.hostname,
                            config.bui.port,
                            config.bui.tls.use_tls
                        ).await {
                            Ok(responds) => {
                                status.service_responds = responds;
                                status.process_responds = responds;
                                println!("BUI responds: {}", responds);
                            }
                            Err(e) => {
                                println!("Error checking BUI response: {}", e);
                                status.error = Some(e);
                            }
                        }
                    },
                    _ => {
                        status.error = Some(format!("Invalid service: {}", service));
                    }
                }
            }
        }
        None => {
            println!("No PID file found for {}", service.to_uppercase());
        }
    }

    Ok(status)
}

#[command]
pub async fn check_server_status() -> Result<ServerStatus, String> {
    let api_status = check_service_status("api").await?;
    let bui_status = check_service_status("bui").await?;

    //let all_services_ready = api_status.service_responds && bui_status.service_responds;
    let all_services_ready = api_status.service_responds;

    Ok(ServerStatus {
        api: api_status,
        bui: bui_status,
        all_services_ready,
    })
}

pub async fn reconcile_service_state(service: &str) -> Result<(), String> {
    let status = check_service_status(service).await?;
    let pid = get_pid(service).await?;

    if !status.pid_exists && pid.is_some() {
        // PID file exists but process doesn't - clean up
        remove_pid(service).await?;
    } else if status.pid_exists && !status.service_responds {
        // Process exists but service doesn't respond - potential zombie
        println!("{} process exists but is not responding. Consider restarting.", service.to_uppercase());
    } else if status.service_responds && pid.is_none() {
        // Service responds but no PID file - recover state if possible
        if let Some(pid) = status.pid {
            println!("Recovering PID file for {} with process ID: {}", service.to_uppercase(), pid);
            save_pid(service, pid).await?;
        }
    }

    Ok(())
}

pub async fn reconcile_all_services() -> Result<(), String> {
    reconcile_service_state("api").await?;
    reconcile_service_state("bui").await?;
    Ok(())
}