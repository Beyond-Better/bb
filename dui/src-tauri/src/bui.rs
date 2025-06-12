use crate::config::read_global_config;
use dirs;
use log::{debug, error, info, warn};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
//use crate::commands::api_status::{check_api_status, reconcile_api_pid_state, save_api_pid};
use crate::commands::bui_status::{check_bui_status, reconcile_bui_pid_state, save_bui_pid};

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

pub fn get_default_bui_log_path() -> Option<PathBuf> {
    get_default_log_dir().map(|dir| dir.join("bui.log"))
}

pub fn get_bui_log_path(config: &crate::config::BuiConfig) -> Option<PathBuf> {
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
        get_default_bui_log_path()
    }
}

pub(crate) fn get_bb_bui_path() -> Result<PathBuf, String> {
    debug!("Starting binary search");
    let mut checked_paths = Vec::new();
    let bui_name = if cfg!(target_os = "windows") {
        "bb-bui.exe"
    } else {
        "bb-bui"
    };
    info!("Looking for {} executable", bui_name);

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

        let user_binary = user_install.join(bui_name);
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
            info!("Found BUI executable in user install location");
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

    let system_binary = system_install.join(bui_name);
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
        info!("Found BUI executable in system install location");
        return Ok(system_binary);
    }

    let error_msg = format!(
        "Could not find {} in any of these locations:\n{}",
        bui_name,
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
pub struct BuiStartResult {
    pub success: bool,
    pub pid: Option<i32>,
    pub error: Option<String>,
    pub requires_settings: bool,
}

fn verify_bui_requirements() -> Result<(), String> {
    // Check if bb-bui binary exists
    get_bb_bui_path().map_err(|e| format!("BB BUI binary not found: {}", e))?;

    // // Check if config exists and has required values
    // let global_config = read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    //
    // // Check for required BUI config values
    // if let Some(bui_config) = &global_config.bui {
    // 	if bui_config.supabase_url.trim().is_empty() {
    // 		return Err("Supabase URL not configured".to_string());
    // 	}
    // 	if bui_config.supabase_anon_key.trim().is_empty() {
    // 		return Err("Supabase anonymous key not configured".to_string());
    // 	}
    // } else {
    // 	return Err("BUI configuration not found".to_string());
    // }

    Ok(())
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
pub async fn start_bui() -> Result<BuiStartResult, String> {
    // // First check if API is running, as BUI requires it
    // let api_status = check_api_status().await?;
    // if !api_status.api_responds {
    // 	return Ok(BuiStartResult {
    // 		success: false,
    // 		pid: None,
    // 		error: Some("API must be running before starting BUI".to_string()),
    // 		requires_settings: false,
    // 	});
    // }

    // Verify all requirements are met before starting
    if let Err(e) = verify_bui_requirements() {
        return Ok(BuiStartResult {
            success: false,
            pid: None,
            error: Some(e),
            requires_settings: true,
        });
    }

    // First reconcile any existing state
    reconcile_bui_pid_state().await?;

    // Check if BUI is already running
    let status = check_bui_status().await?;
    if status.bui_responds {
        return Ok(BuiStartResult {
            success: true,
            pid: status.pid,
            error: None,
            requires_settings: false,
        });
    }

    // Get BUI configuration
    let global_config =
        read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    let config = &global_config.bui;

    // Get the full path to the bb-bui executable
    let bb_bui_path =
        get_bb_bui_path().map_err(|e| format!("Failed to locate bb-bui executable: {}", e))?;

    info!("Found bb-bui executable at: {}", bb_bui_path.display());

    // Build command arguments
    let mut args = Vec::new();
    args.push("--hostname".to_string());
    args.push(config.hostname.clone());
    args.push("--port".to_string());
    args.push(config.port.to_string());
    args.push("--use-tls".to_string());
    args.push(config.tls.use_tls.to_string());

    // Get log file path
    //let log_path = get_bui_log_path(&config)
    let log_path =
        get_bui_log_path(config).ok_or_else(|| "Failed to determine log path".to_string())?;

    // Ensure log directory exists
    if let Some(parent) = log_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            error!("Failed to create log directory for {:?}: {}", log_path, e);
            return Ok(BuiStartResult {
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
        "Starting BUI with command: {} {:?}",
        bb_bui_path.display(),
        args
    );

    // Start the process using platform-specific method
    let process_result = {
        #[cfg(target_os = "windows")]
        {
            create_process_windows(bb_bui_path, args).map(|pid| pid as i32)
        }

        #[cfg(not(target_os = "windows"))]
        {
            match Command::new(bb_bui_path).args(&args).spawn() {
                Ok(child) => Ok(child.id() as i32),
                Err(e) => Err(format!("Failed to start BUI process: {}", e)),
            }
        }
    };

    match process_result {
        Ok(pid) => {
            info!("BUI process started with PID: {}", pid);

            // Save the PID immediately
            if let Err(e) = save_bui_pid(pid).await {
                warn!("Failed to save PID file: {}", e);
            }

            // Give the BUI a moment to start
            let max_attempts = 10;
            for attempt in 1..=max_attempts {
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Verify the BUI is responding
                match check_bui_status().await {
                    Ok(status) if status.bui_responds => {
                        info!("BUI is responding after {} attempts", attempt);
                        return Ok(BuiStartResult {
                            success: true,
                            pid: Some(pid),
                            error: None,
                            requires_settings: false,
                        });
                    }
                    Ok(_) if attempt == max_attempts => {
                        let error_msg =
                            "BUI process started but not responding after multiple attempts";
                        error!("{}", error_msg);
                        return Ok(BuiStartResult {
                            success: false,
                            pid: Some(pid),
                            error: Some(error_msg.to_string()),
                            requires_settings: false,
                        });
                    }
                    Ok(_) => {
                        debug!(
                            "BUI not responding yet, attempt {}/{}",
                            attempt, max_attempts
                        );
                        continue;
                    }
                    Err(e) => {
                        error!("Error checking BUI status: {}", e);
                    }
                }
            }

            Ok(BuiStartResult {
                success: false,
                pid: Some(pid),
                error: Some("BUI process started but failed to respond".to_string()),
                requires_settings: false,
            })
        }
        Err(e) => {
            let error_msg = format!("Failed to start BUI process: {}", e);
            error!("{}", error_msg);
            Ok(BuiStartResult {
                success: false,
                pid: None,
                error: Some(error_msg),
                requires_settings: false,
            })
        }
    }
}

#[tauri::command]
pub async fn stop_bui() -> Result<bool, String> {
    use crate::commands::bui_status::{find_all_bui_processes, robust_terminate_process};
    
    info!("Stopping BUI - looking for all bb-bui processes");
    
    // Find ALL bb-bui processes (not just ones with PID files)
    let all_pids = find_all_bui_processes().await?;
    
    if all_pids.is_empty() {
        info!("No BUI processes found");
        // Clean up any stale PID file
        if let Err(e) = crate::commands::bui_status::remove_pid().await {
            warn!("Failed to remove stale PID file: {}", e);
        }
        return Ok(true);
    }

    info!("Found {} BUI process(es): {:?}", all_pids.len(), all_pids);
    
    let mut all_stopped = true;
    
    // Terminate each process
    for pid in all_pids {
        if !robust_terminate_process(pid, "bb-bui").await {
            error!("Failed to stop BUI process with PID: {}", pid);
            all_stopped = false;
        }
    }
    
    // Clean up PID file regardless
    if let Err(e) = crate::commands::bui_status::remove_pid().await {
        warn!("Failed to remove PID file: {}", e);
    }
    
    // Wait and verify all processes are gone
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let remaining_pids = find_all_bui_processes().await?;
    
    if !remaining_pids.is_empty() {
        warn!("Some BUI processes still running: {:?}", remaining_pids);
        all_stopped = false;
    } else {
        info!("All BUI processes stopped successfully");
    }
    
    Ok(all_stopped)
}
