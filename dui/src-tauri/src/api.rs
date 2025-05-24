use crate::commands::api_status::{check_api_status, reconcile_api_pid_state, save_api_pid};
use crate::config::read_global_config;
use dirs;
use libc;
use log::{debug, error, info, warn};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;
#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;
#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::{CloseHandle, FALSE};
#[cfg(target_os = "windows")]
use windows_sys::Win32::System::Threading::{
    CreateProcessW, OpenProcess, TerminateProcess, CREATE_NO_WINDOW, NORMAL_PRIORITY_CLASS,
    PROCESS_INFORMATION, STARTUPINFOW,
};

#[cfg(not(target_os = "windows"))]
use std::process::Command;

pub(crate) fn get_default_log_dir() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Logs")
                .join(crate::config::APP_NAME)
        })
    }

    #[cfg(target_os = "windows")]
    {
        std::env::var("ProgramData").ok().map(|program_data| {
            PathBuf::from(program_data)
                .join(crate::config::APP_NAME)
                .join("logs")
        })
    }

    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|home| home.join(".bb").join("logs"))
    }
}

pub fn get_default_api_log_path() -> Option<PathBuf> {
    get_default_log_dir().map(|dir| dir.join("api.log"))
}

pub fn get_api_log_path(config: &crate::config::ApiConfig) -> Option<PathBuf> {
    if let Some(log_file) = &config.log_file {
        if log_file.starts_with('/') || log_file.contains(":\\") {
            // Absolute path
            Some(PathBuf::from(log_file))
        } else {
            // Relative path - append to default log dir
            get_default_log_dir().map(|dir| dir.join(log_file))
        }
    } else {
        // No log file specified - use default
        get_default_api_log_path()
    }
}

pub(crate) fn get_bb_api_path() -> Result<PathBuf, String> {
    debug!("Starting binary search");
    let mut checked_paths = Vec::new();
    let api_name = if cfg!(target_os = "windows") {
        "bb-api.exe"
    } else {
        "bb-api"
    };
    info!("Looking for {} executable", api_name);

    // Try user-specific location first
    if let Some(home) = dirs::home_dir() {
        let user_install = if cfg!(target_os = "windows") {
            if let Some(local_app_data) = dirs::data_local_dir() {
                local_app_data.join("BeyondBetter").join("bin")
            } else {
                home.join("AppData")
                    .join("Local")
                    .join("BeyondBetter")
                    .join("bin")
            }
        } else if cfg!(target_os = "macos") {
            home.join(".bb").join("bin")
        } else {
            // Linux
            home.join(".local").join("bin")
        };

        let user_binary = user_install.join(api_name);
        checked_paths.push(user_binary.clone());
        debug!("Checking user install location: {}", user_binary.display());
        if !user_install.exists() {
            debug!(
                "User install directory does not exist: {}",
                user_install.display()
            );
        } else if !user_binary.exists() {
            debug!("Binary not found in user install location");
        } else {
            info!("Found API executable in user install location");
            return Ok(user_binary);
        }
    }

    // Try system location
    let system_install = if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Program Files\BeyondBetter\bin")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/usr/local/bin")
    } else {
        PathBuf::from("/usr/local/bin")
    };

    let system_binary = system_install.join(api_name);
    checked_paths.push(system_binary.clone());
    debug!(
        "Checking system install location: {}",
        system_binary.display()
    );
    if !system_install.exists() {
        debug!(
            "System install directory does not exist: {}",
            system_install.display()
        );
    } else if !system_binary.exists() {
        debug!("Binary not found in system install location");
    } else {
        info!("Found API executable in system install location");
        return Ok(system_binary);
    }

    let error_msg = format!(
        "Could not find {} in any of these locations:\n{}",
        api_name,
        checked_paths
            .iter()
            .map(|p| format!("- {}", p.display()))
            .collect::<Vec<_>>()
            .join("\n")
    );
    error!("Binary search failed: {}", error_msg);
    Err(error_msg)
}

#[derive(Debug, Serialize)]
pub struct ApiStartResult {
    pub success: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
    pub requires_settings: bool,
}

fn verify_api_requirements() -> Result<(), String> {
    // Only check if bb-api binary exists
    get_bb_api_path()
        .map(|_| ())
        .map_err(|e| format!("BB API binary not found: {}", e))
}

#[cfg(target_os = "windows")]
fn create_process_windows(executable_path: PathBuf, args: Vec<String>) -> Result<u32, String> {
    use std::ptr::null_mut;

    // Convert the command line to UTF-16 for Windows API
    let mut command_line = format!("\"{}\"", executable_path.to_string_lossy());
    for arg in args {
        command_line.push_str(&format!(" \"{}\"", arg));
    }
    let wide_command: Vec<u16> = OsStr::new(&command_line)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut startup_info: STARTUPINFOW = unsafe { std::mem::zeroed() };
    startup_info.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
    startup_info.dwFlags = 1; // STARTF_USESHOWWINDOW
    startup_info.wShowWindow = 0; // SW_HIDE

    let mut process_info: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };

    // Create the process with specific flags to hide the window
    let success = unsafe {
        CreateProcessW(
            null_mut(), // Use command line for executable path
            wide_command.as_ptr() as *mut u16,
            null_mut(), // Process security attributes
            null_mut(), // Thread security attributes
            FALSE,      // Don't inherit handles
            CREATE_NO_WINDOW | NORMAL_PRIORITY_CLASS,
            null_mut(), // Use parent's environment
            null_mut(), // Use parent's current directory
            &startup_info,
            &mut process_info,
        )
    };

    if success == 0 {
        return Err("Failed to create process".to_string());
    }

    // Close handles we don't need
    unsafe {
        CloseHandle(process_info.hThread);
        CloseHandle(process_info.hProcess);
    }

    // Return process ID
    Ok(process_info.dwProcessId)
}

#[tauri::command]
pub async fn start_api() -> Result<ApiStartResult, String> {
    // Verify only that the binary exists
    if let Err(e) = verify_api_requirements() {
        return Ok(ApiStartResult {
            success: false,
            pid: None,
            error: Some(e),
            requires_settings: false,
        });
    }

    // First reconcile any existing state
    reconcile_api_pid_state().await?;

    // Check if API is already running
    let status = check_api_status().await?;
    if status.api_responds {
        return Ok(ApiStartResult {
            success: true,
            pid: status.pid,
            error: None,
            requires_settings: false,
        });
    }

    // Get API configuration
    let global_config =
        read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    let config = &global_config.api;

    // Get the full path to the bb-api executable
    let bb_api_path =
        get_bb_api_path().map_err(|e| format!("Failed to locate bb-api executable: {}", e))?;

    info!("Found bb-api executable at: {}", bb_api_path.display());

    // Build command arguments
    let mut args = Vec::new();
    args.push("--hostname".to_string());
    args.push(config.hostname.clone());
    args.push("--port".to_string());
    args.push(config.port.to_string());
    args.push("--use-tls".to_string());
    args.push(config.tls.use_tls.to_string());

    // Get log file path using the consolidated logic
    let log_path =
        get_api_log_path(config).ok_or_else(|| "Failed to determine log path".to_string())?;

    // Ensure log directory exists
    if let Some(parent) = log_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            error!("Failed to create log directory for {:?}: {}", log_path, e);
            return Ok(ApiStartResult {
                success: false,
                pid: None,
                error: Some(format!("Failed to create log directory: {}", e)),
                requires_settings: false,
            });
        }
    }

    // Add log file argument
    args.extend_from_slice(&[
        "--log-file".to_string(),
        log_path.to_string_lossy().to_string(),
    ]);

    info!(
        "Starting API with command: {} {:?}",
        bb_api_path.display(),
        args
    );

    // Start the process using platform-specific method
    let process_result = {
        #[cfg(target_os = "windows")]
        {
            create_process_windows(bb_api_path, args).map(|pid| pid as i32)
        }

        #[cfg(not(target_os = "windows"))]
        {
            match Command::new(bb_api_path).args(&args).spawn() {
                Ok(child) => Ok(child.id() as i32),
                Err(e) => Err(format!("Failed to start API process: {}", e)),
            }
        }
    };

    match process_result {
        Ok(pid) => {
            info!("API process started with PID: {}", pid);

            // Save the PID immediately
            if let Err(e) = save_api_pid(pid).await {
                warn!("Failed to save PID file: {}", e);
            }

            // Give the API a moment to start
            let max_attempts = 10;
            for attempt in 1..=max_attempts {
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Verify the API is responding
                match check_api_status().await {
                    Ok(status) if status.api_responds => {
                        info!("API is responding after {} attempts", attempt);
                        return Ok(ApiStartResult {
                            success: true,
                            pid: Some(pid),
                            error: None,
                            requires_settings: false,
                        });
                    }
                    Ok(_) if attempt == max_attempts => {
                        let error_msg =
                            "API process started but not responding after multiple attempts";
                        error!("{}", error_msg);
                        return Ok(ApiStartResult {
                            success: false,
                            pid: Some(pid),
                            error: Some(error_msg.to_string()),
                            requires_settings: false,
                        });
                    }
                    Ok(_) => {
                        debug!(
                            "API not responding yet, attempt {}/{}",
                            attempt, max_attempts
                        );
                        continue;
                    }
                    Err(e) => {
                        error!("Error checking API status: {}", e);
                    }
                }
            }

            Ok(ApiStartResult {
                success: false,
                pid: Some(pid),
                error: Some("API process started but failed to respond".to_string()),
                requires_settings: false,
            })
        }
        Err(e) => {
            let error_msg = format!("Failed to start API process: {}", e);
            error!("{}", error_msg);
            Ok(ApiStartResult {
                success: false,
                pid: None,
                error: Some(error_msg),
                requires_settings: false,
            })
        }
    }
}

#[tauri::command]
pub async fn stop_api() -> Result<bool, String> {
    let status = check_api_status().await?;
    debug!("Current API status: {:?}", status);

    if !status.pid_exists && !status.api_responds {
        info!("API is not running");
        // Clean up any stale PID file
        if let Err(e) = crate::commands::api_status::remove_pid().await {
            warn!("Failed to remove stale PID file: {}", e);
        }
        return Ok(false);
    }

    if let Some(pid) = status.pid {
        info!("Attempting to stop API process with PID: {}", pid);

        let stop_result = {
            #[cfg(target_family = "unix")]
            {
                unsafe { libc::kill(pid, libc::SIGTERM) == 0 }
            }

            #[cfg(target_family = "windows")]
            {
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

        // Wait for the process to actually stop
        let max_attempts = 10;
        for attempt in 1..=max_attempts {
            std::thread::sleep(std::time::Duration::from_millis(500));
            match check_api_status().await {
                Ok(status) if !status.api_responds && !status.pid_exists => {
                    info!("API stopped successfully after {} attempts", attempt);
                    // Clean up PID file
                    if let Err(e) = crate::commands::api_status::remove_pid().await {
                        warn!("Failed to remove PID file: {}", e);
                    }
                    return Ok(true);
                }
                Ok(_) if attempt == max_attempts => {
                    error!(
                        "API failed to stop completely after {} attempts",
                        max_attempts
                    );
                    break;
                }
                Ok(_) => {
                    debug!(
                        "Waiting for API to stop, attempt {}/{}",
                        attempt, max_attempts
                    );
                    continue;
                }
                Err(e) => {
                    error!("Error checking API status during stop: {}", e);
                }
            }
        }

        if stop_result {
            warn!("Stop command succeeded but API may still be running");
        } else {
            error!("Failed to stop API process");
        }

        Ok(stop_result)
    } else {
        warn!("No PID found for running API");
        Ok(false)
    }
}
