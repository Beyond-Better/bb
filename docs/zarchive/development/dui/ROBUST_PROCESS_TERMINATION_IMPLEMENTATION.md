# Robust Process Termination Implementation Guide

## Problem Statement
Current `stop_api()` and `stop_bui()` functions only terminate processes with valid PID files. Rogue processes (bb-api/bb-bui running without PID files) persist and block upgrades/restarts.

## Root Cause Analysis
Looking at `dui/src-tauri/src/api.rs` line 435:
```rust
if let Some(pid) = status.pid {
    // Only kills if PID file exists
}
```

## Solution: Add Process Discovery + Robust Termination

### 1. Add to `dui/src-tauri/src/commands/api_status.rs`:

```rust
// Add after existing imports
use std::process::Command as StdCommand;

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

            Ok(pids)
        }
        Err(e) => Err(format!("Failed to list processes: {}", e)),
    }
}

// Add robust termination function
pub async fn robust_terminate_process(pid: i32, process_name: &str) -> bool {
    println!("Attempting to terminate {} process PID: {}", process_name, pid);
    
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
            println!("Process {} terminated gracefully", pid);
            return true;
        }
    }

    // Force termination
    println!("Force terminating process {}", pid);
    let force_result = {
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
        println!("Process {} terminated successfully", pid);
    } else {
        println!("Failed to terminate process {}", pid);
    }
    
    success
}
```

### 2. Update `stop_api()` in `dui/src-tauri/src/api.rs`:

Replace the existing `stop_api()` function with:

```rust
#[tauri::command]
pub async fn stop_api() -> Result<bool, String> {
    use crate::commands::api_status::{find_all_api_processes, robust_terminate_process};
    
    info!("Stopping API - looking for all bb-api processes");
    
    // Find ALL bb-api processes (not just ones with PID files)
    let all_pids = find_all_api_processes().await?;
    
    if all_pids.is_empty() {
        info!("No API processes found");
        // Clean up any stale PID file
        if let Err(e) = crate::commands::api_status::remove_pid().await {
            warn!("Failed to remove stale PID file: {}", e);
        }
        return Ok(true);
    }

    info!("Found {} API process(es): {:?}", all_pids.len(), all_pids);
    
    let mut all_stopped = true;
    
    // Terminate each process
    for pid in all_pids {
        if !robust_terminate_process(pid, "bb-api").await {
            error!("Failed to stop API process with PID: {}", pid);
            all_stopped = false;
        }
    }
    
    // Clean up PID file regardless
    if let Err(e) = crate::commands::api_status::remove_pid().await {
        warn!("Failed to remove PID file: {}", e);
    }
    
    // Wait and verify all processes are gone
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let remaining_pids = find_all_api_processes().await?;
    
    if !remaining_pids.is_empty() {
        warn!("Some API processes still running: {:?}", remaining_pids);
        all_stopped = false;
    } else {
        info!("All API processes stopped successfully");
    }
    
    Ok(all_stopped)
}
```

### 3. Similar Updates for BUI:

Apply the same pattern to:
- `dui/src-tauri/src/commands/bui_status.rs` (add `find_all_bui_processes()`)
- `dui/src-tauri/src/bui.rs` (update `stop_bui()` function)

Replace "bb-api" with "bb-bui" and "api" with "bui" in function names.

### 4. Update Upgrade Process:

In `dui/src-tauri/src/commands/upgrade.rs`, before starting new processes:

```rust
// Stop all existing processes robustly
let api_stopped = crate::api::stop_api().await?;
let bui_stopped = crate::bui::stop_bui().await?;

if !api_stopped || !bui_stopped {
    return Err("Failed to stop existing processes before upgrade".to_string());
}

// Small delay to ensure ports are freed
std::thread::sleep(std::time::Duration::from_millis(2000));
```

## Key Benefits:
1. **Finds ALL processes by name** (not just PID file processes)
2. **Graceful then force termination** (tries SIGTERM first, then SIGKILL)
3. **Cross-platform** (Windows: tasklist/TerminateProcess, Unix: pgrep/kill)
4. **Verification** (confirms processes actually died)
5. **Works for both manual stop and upgrades**

## Testing:
1. Start bb-api manually in terminal
2. Delete PID file
3. Use DUI toggle - should still kill the rogue process
4. Test upgrade with rogue processes - should work cleanly

This minimal change solves the core issue without breaking existing functionality.