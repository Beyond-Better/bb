use std::process::Command;
use serde::Serialize;
use crate::config::read_global_config;
use crate::commands::api_status::{check_api_status, reconcile_pid_state, save_pid};

#[derive(Debug, Serialize)]
pub struct ApiStartResult {
    pub success: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn start_api() -> Result<ApiStartResult, String> {
    // First reconcile any existing state
    reconcile_pid_state().await?;

    // Check if API is already running
    let status = check_api_status().await?;
    if status.api_responds {
        return Ok(ApiStartResult {
            success: true,
            pid: status.pid,
            error: None,
        });
    }

    // Get API configuration
    let global_config = read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    let config = &global_config.api;
    
    // Get the bb executable path from config
    let bb_api_exec = if cfg!(target_os = "windows") {
        format!("{}.exe", global_config.bb_api_exe_name)
    } else {
        global_config.bb_api_exe_name
    };

    // Build command arguments - only include valid args
    let mut args = Vec::new();
    
    // Add hostname and port
    args.push("--hostname".to_string());
    args.push(config.hostname.clone());
    
    args.push("--port".to_string());
    args.push(config.port.to_string());
    
    // Add TLS configuration
    args.push("--use-tls".to_string());
    args.push(config.tls.use_tls.to_string());
    
    // Add log file if specified
    if let Some(log_file) = &config.log_file {
        args.push("--log-file".to_string());
        args.push(log_file.clone());
    }

    println!("Starting API with command: {} {:?}", bb_api_exec, args);

    // Spawn the process
    match Command::new(bb_api_exec)
        .args(&args)
        .spawn()
    {
        Ok(child) => {
            let pid = child.id() as i32;
            save_pid(pid).await?;
            
            // Give the API a moment to start
            std::thread::sleep(std::time::Duration::from_millis(500));
            
            // Verify the API is responding
            let status = check_api_status().await?;
            if status.api_responds {
                Ok(ApiStartResult {
                    success: true,
                    pid: Some(pid),
                    error: None,
                })
            } else {
                Ok(ApiStartResult {
                    success: false,
                    pid: Some(pid),
                    error: Some("API process started but not responding".to_string()),
                })
            }
        }
        Err(e) => Ok(ApiStartResult {
            success: false,
            pid: None,
            error: Some(format!("Failed to start API: {}", e)),
        }),
    }
}

#[tauri::command]
pub async fn stop_api() -> Result<bool, String> {
    let status = check_api_status().await?;

    if !status.pid_exists && !status.api_responds {
        return Ok(false);
    }

    if let Some(pid) = status.pid {
        #[cfg(target_family = "unix")]
        unsafe {
            libc::kill(pid, libc::SIGTERM);
        }

        #[cfg(target_family = "windows")]
        {
            let _ = Command::new("taskkill")
                .args(&["/PID", &pid.to_string(), "/F"])
                .output();
        }

        Ok(true)
    } else {
        Ok(false)
    }
}