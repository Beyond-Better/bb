// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
use windows_sys::Win32::Foundation::HANDLE;

use beyond_better_lib::{
    run
};

#[cfg(target_os = "windows")]
fn to_wide_string(s: &str) -> Vec<u16> {
    use std::os::windows::ffi::OsStrExt;
    std::ffi::OsStr::new(s).encode_wide().chain(Some(0)).collect()
}

fn main() {
    // Force immediate console output
    println!("Starting Beyond Better - stdout test");
    eprintln!("Starting Beyond Better - stderr test");
    
    // Ensure we have a console window
    #[cfg(target_os = "windows")]
    unsafe {
        use windows_sys::Win32::System::Console;
        Console::AllocConsole();
    }

    // Set up Windows error handling
    #[cfg(target_os = "windows")]
    {
        use std::panic;
        use windows_sys::Win32::UI::WindowsAndMessaging;
        
        // Set up panic handler
        panic::set_hook(Box::new(|panic_info| {
            let msg = format!("Application panic: {}\n\nLocation: {:?}", 
                panic_info.payload().downcast_ref::<String>().cloned().unwrap_or_else(|| 
                    panic_info.payload().downcast_ref::<&str>().copied().unwrap_or("<unknown error>")
                    .to_string()),
                panic_info.location()
            );
            
            // Write to file
            if let Ok(program_data) = std::env::var("ProgramData") {
                let log_path = std::path::PathBuf::from(program_data)
                    .join("Beyond Better")
                    .join("crash.log");
                let _ = std::fs::write(&log_path, &msg);
            }
            
            // Show error message box
            let title = to_wide_string("Beyond Better Error");
            let msg = to_wide_string(&msg);
            unsafe {
                WindowsAndMessaging::MessageBoxW(
                    0,
                    msg.as_ptr(),
                    title.as_ptr(),
                    WindowsAndMessaging::MB_OK | WindowsAndMessaging::MB_ICONERROR
                );
            }
        }));
    }

    // Log DLL loading information
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::LibraryLoader;
        
        // Try to load some common DLLs to check dependencies
        // Check WebView2 installation
        #[cfg(target_os = "windows")]
        let mut log_content = String::from("System Checks:\n\n");
        
        #[cfg(target_os = "windows")]
        // Check WebView2 Registry Keys
        #[cfg(target_os = "windows")]
        let webview2_keys = [
            "SOFTWARE\\Microsoft\\EdgeUpdate\\ClientState\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",  // Machine-wide install
            "SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\ClientState\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"  // 32-bit on 64-bit
        ];
        
        log_content.push_str("WebView2 Runtime Check:\n");
        for key_path in webview2_keys.iter() {
            use windows_sys::Win32::System::Registry::*;
            #[cfg(target_os = "windows")]
            {
                let key_path = to_wide_string(key_path);
                let mut h_key = 0;
                
                unsafe {
                let result = RegOpenKeyExW(
                    HKEY_LOCAL_MACHINE,
                    key_path.as_ptr(),
                    0,
                    KEY_READ,
                    &mut h_key
                );
                
                #[cfg(target_os = "windows")]
                log_content.push_str(&format!("  {} : {}\n", key_path.iter().take(key_path.len() - 1)
                    .map(|&c| c as u8 as char).collect::<String>(),
                    if result == 0 { "Found" } else { "Not Found" }));
                
                    if h_key != 0 {
                        RegCloseKey(h_key);
                    }
                }
            }
        }
        
        log_content.push_str("\nEnvironment Variables:\n");
        let important_vars = ["PATH", "ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA", "APPDATA", "SystemRoot"];
        for var in important_vars.iter() {
            if let Ok(value) = std::env::var(var) {
                log_content.push_str(&format!("  {}: {}\n", var, value));
            } else {
                log_content.push_str(&format!("  {}: Not Found\n", var));
            }
        }

        log_content.push_str("\nProcess Information:\n");
        if let Ok(exe_path) = std::env::current_exe() {
            log_content.push_str(&format!("  Executable Path: {:?}\n", exe_path));
        }
        if let Ok(current_dir) = std::env::current_dir() {
            log_content.push_str(&format!("  Current Directory: {:?}\n", current_dir));
        }

        log_content.push_str("\nDLL Checks:\n");
        #[cfg(target_os = "windows")]
        let dlls = ["VCRUNTIME140.dll", "MSVCP140.dll", "WebView2Loader.dll"];
        #[cfg(target_os = "windows")]
        let mut log_content = String::from("DLL Check Results:\n");
        
        #[cfg(target_os = "windows")]
        for dll in dlls.iter() {
            #[cfg(target_os = "windows")]
            unsafe {
                let dll_name = to_wide_string(dll);
                #[cfg(target_os = "windows")]
                {
                    let handle = LibraryLoader::LoadLibraryW(dll_name.as_ptr()) as HANDLE;
                    log_content.push_str(&format!("{}: {}\n", dll, if handle != 0 { "Found" } else { "Not Found" }));
                    if handle != 0 {
                        LibraryLoader::FreeLibrary(handle);
                    }
                }
            }
        }
        
        #[cfg(target_os = "windows")]
        // Write results to a file
        if let Ok(program_data) = std::env::var("ProgramData") {
            let log_path = std::path::PathBuf::from(program_data)
                .join("Beyond Better")
                .join("dll_check.log");
            
            if let Some(dir) = log_path.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            
            let _ = std::fs::write(&log_path, log_content);
        }
    }

    // Create a visible indicator that we're trying to start
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging;
        let title = to_wide_string("Beyond Better Startup");
        let msg = to_wide_string("Attempting to start Beyond Better...");
        unsafe {
            WindowsAndMessaging::MessageBoxW(
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
        
        let source = to_wide_string("Beyond Better");
        let message = to_wide_string("Application startup attempted");
        
        unsafe {
            let event_source = EventLog::RegisterEventSourceW(std::ptr::null_mut(), source.as_ptr());
            if event_source != 0 {
                EventLog::ReportEventW(
                    event_source,
                    EventLog::EVENTLOG_INFORMATION_TYPE,
                    0,
                    0,
                    std::ptr::null_mut(),
                    1,
                    0,
                    &message.as_ptr(),
                    std::ptr::null_mut(),
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
    
    // Check Visual C++ Redistributable
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Registry::*;
        use std::ffi::CString;

        unsafe {
            let mut h_key = 0;
            let vcredist_keys = [
                "SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64",
                "SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64"
            ];

            let mut found = false;
            for key_path in vcredist_keys.iter() {
                let key_path = to_wide_string(key_path);
                if RegOpenKeyExW(HKEY_LOCAL_MACHINE, key_path.as_ptr(), 0, KEY_READ, &mut h_key) == 0 {
                    found = true;
                    RegCloseKey(h_key);
                    break;
                }
            }

            if !found {
                let error_msg = "Beyond Better requires the Microsoft Visual C++ Redistributable 2015-2022.

To fix this:
1. Download the installer from:
   https://aka.ms/vs/17/release/vc_redist.x64.exe
2. Run the installer
3. Start Beyond Better again

This is a one-time installation that may be needed by other Windows applications.";
                eprintln!("{}", error_msg);
                panic!("{}", error_msg);
            }
        }
    }

    // Check WebView2 before starting Tauri
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Com::*;
        use windows_sys::Win32::System::Registry::*;
        use std::ffi::CString;

        unsafe {
            // Initialize COM
            let hr = CoInitializeEx(std::ptr::null_mut(), COINIT_MULTITHREADED);
            if hr < 0 {
                let error_msg = format!("Failed to initialize COM: {}", hr);
                eprintln!("{}", error_msg);
                panic!("{}", error_msg);
            }

            // Check WebView2 Runtime registry keys
            let mut h_key = 0;
            let key_path = to_wide_string("SOFTWARE\\Microsoft\\EdgeUpdate\\ClientState\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}");
            let result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                key_path.as_ptr(),
                0,
                KEY_READ,
                &mut h_key
            );

            if result != 0 {
                let error_msg = "WebView2 Runtime not found. Please install WebView2 Runtime from https://developer.microsoft.com/en-us/microsoft-edge/webview2/";
                eprintln!("{}", error_msg);
                panic!("{}", error_msg);
            }

            if h_key != 0 {
                RegCloseKey(h_key);
            }

            CoUninitialize();
        }
    }

    // If we get here, try to start the app
    eprintln!("Starting Tauri application...");
    run();
}