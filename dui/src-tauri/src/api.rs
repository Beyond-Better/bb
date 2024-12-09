use std::process::Command;
use std::path::PathBuf;
use serde::Serialize;
use crate::config::read_global_config;
use crate::commands::api_status::{check_api_status, reconcile_pid_state, save_pid};

fn get_bb_api_path() -> Result<PathBuf, String> {
    let api_name = if cfg!(target_os = "windows") { "bb-api.exe" } else { "bb-api" };
    println!("Looking for {} executable", api_name);

    // First try to find in the same directory as the current executable
    if let Ok(mut exe_path) = std::env::current_exe() {
        println!("Current executable path: {}", exe_path.display());
        exe_path.pop(); // Remove executable name
        exe_path.push(api_name);
        println!("Checking for API at: {}", exe_path.display());
        if exe_path.exists() {
            println!("Found API executable in current directory");
            return Ok(exe_path);
        }
    } else {
        println!("Warning: Could not determine current executable path");
    }

    // Then try to find in PATH
    match std::env::var("PATH") {
        Ok(path) => {
            println!("Searching PATH for {}", api_name);
            for dir in std::env::split_paths(&path) {
                let full_path = dir.join(api_name);
                println!("Checking PATH location: {}", full_path.display());
                if full_path.exists() {
                    println!("Found API executable in PATH");
                    return Ok(full_path);
                }
            }
            Err(format!("Could not find {} in PATH or current directory", api_name))
        }
        Err(e) => Err(format!("Failed to read PATH environment variable: {}", e))
    }
}

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
    
    // Get the full path to the bb-api executable
    let bb_api_path = get_bb_api_path()
        .map_err(|e| format!("Failed to locate bb-api executable: {}", e))?;
    
    println!("Found bb-api executable at: {}", bb_api_path.display());

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

    println!("Starting API with command: {} {:?}", bb_api_path.display(), args);

    // Convert PathBuf to string for logging
    let bb_api_path_str = bb_api_path.to_string_lossy();
    println!("Starting API with command: {} {:?}", bb_api_path_str, args);

    // Spawn the process
    let spawn_result = Command::new(bb_api_path)
        .args(&args)
        .spawn();

    match spawn_result {
        Ok(child) => {
            let pid = child.id() as i32;
            println!("API process started with PID: {}", pid);

            // Save the PID immediately
            if let Err(e) = save_pid(pid).await {
                println!("Warning: Failed to save PID file: {}", e);
            }
            
            // Give the API a moment to start
            let max_attempts = 10;
            for attempt in 1..=max_attempts {
                std::thread::sleep(std::time::Duration::from_millis(500));
                
                // Verify the API is responding
                match check_api_status().await {
                    Ok(status) if status.api_responds => {
                        println!("API is responding after {} attempts", attempt);
                        return Ok(ApiStartResult {
                            success: true,
                            pid: Some(pid),
                            error: None,
                        });
                    }
                    Ok(_) if attempt == max_attempts => {
                        let error_msg = "API process started but not responding after multiple attempts";
                        println!("{}", error_msg);
                        return Ok(ApiStartResult {
                            success: false,
                            pid: Some(pid),
                            error: Some(error_msg.to_string()),
                        });
                    }
                    Ok(_) => {
                        println!("API not responding yet, attempt {}/{}", attempt, max_attempts);
                        continue;
                    }
                    Err(e) => {
                        println!("Error checking API status: {}", e);
                    }
                }
            }

            Ok(ApiStartResult {
                success: false,
                pid: Some(pid),
                error: Some("API process started but failed to respond".to_string()),
            })
        }
        Err(e) => {
            let error_msg = format!("Failed to start API process: {}", e);
            println!("{}", error_msg);
            Ok(ApiStartResult {
                success: false,
                pid: None,
                error: Some(error_msg),
            })
        }
    }
}

#[tauri::command]
pub async fn stop_api() -> Result<bool, String> {
    let status = check_api_status().await?;
    println!("Current API status: {:?}", status);

    if !status.pid_exists && !status.api_responds {
        println!("API is not running");
        // Clean up any stale PID file
        if let Err(e) = crate::commands::api_status::remove_pid().await {
            println!("Warning: Failed to remove stale PID file: {}", e);
        }
        return Ok(false);
    }

    if let Some(pid) = status.pid {
        println!("Attempting to stop API process with PID: {}", pid);

        let stop_result = {
            #[cfg(target_family = "unix")]
            {
                unsafe {
                    libc::kill(pid, libc::SIGTERM) == 0
                }
            }

            #[cfg(target_family = "windows")]
            {
                match Command::new("taskkill")
                    .args(&["/PID", &pid.to_string(), "/F"])
                    .output()
                {
                    Ok(output) => output.status.success(),
                    Err(e) => {
                        println!("Failed to execute taskkill: {}", e);
                        false
                    }
                }
            }
        };

        // Wait for the process to actually stop
        let max_attempts = 10;
        for attempt in 1..=max_attempts {
            std::thread::sleep(std::time::Duration::from_millis(500));
            match check_api_status().await {
                Ok(status) if !status.api_responds && !status.pid_exists => {
                    println!("API stopped successfully after {} attempts", attempt);
                    // Clean up PID file
                    if let Err(e) = crate::commands::api_status::remove_pid().await {
                        println!("Warning: Failed to remove PID file: {}", e);
                    }
                    return Ok(true);
                }
                Ok(_) if attempt == max_attempts => {
                    println!("API failed to stop completely after {} attempts", max_attempts);
                    break;
                }
                Ok(_) => {
                    println!("Waiting for API to stop, attempt {}/{}", attempt, max_attempts);
                    continue;
                }
                Err(e) => {
                    println!("Error checking API status during stop: {}", e);
                }
            }
        }

        if stop_result {
            println!("Stop command succeeded but API may still be running");
        } else {
            println!("Failed to stop API process");
        }

        Ok(stop_result)
    } else {
        println!("No PID found for running API");
        Ok(false)
    }
}