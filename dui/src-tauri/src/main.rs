// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use beyond_better_lib::{
    run
};

fn main() {
    // Create a visible indicator that we're trying to start
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging;
        let title = std::ffi::CString::new("Beyond Better Startup").unwrap();
        let msg = std::ffi::CString::new("Attempting to start Beyond Better...").unwrap();
        unsafe {
            WindowsAndMessaging::MessageBoxA(
                0,
                msg.as_ptr(),
                title.as_ptr(),
                WindowsAndMessaging::MB_OK | WindowsAndMessaging::MB_ICONINFORMATION
            );
        }
    }

    // Try to write to Windows Event Log
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::EventLog;
        use std::ffi::CString;
        
        let source = CString::new("Beyond Better").unwrap();
        let message = CString::new("Application startup attempted").unwrap();
        
        unsafe {
            let event_source = EventLog::RegisterEventSourceA(std::ptr::null(), source.as_ptr());
            if !event_source.is_null() {
                EventLog::ReportEventA(
                    event_source,
                    EventLog::EVENTLOG_INFORMATION_TYPE,
                    0,
                    0,
                    std::ptr::null(),
                    1,
                    0,
                    &message.as_ptr(),
                    std::ptr::null(),
                );
                EventLog::DeregisterEventSource(event_source);
            }
        }
    }

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