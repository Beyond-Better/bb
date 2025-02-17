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


    // Only check for WebView2 as it's required for the app
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::Registry::*;
        let webview2_key = "SOFTWARE\\Microsoft\\EdgeUpdate\\ClientState\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
        let key_path = to_wide_string(webview2_key);
        let mut h_key = 0;
        
        unsafe {
            let result = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                key_path.as_ptr(),
                0,
                KEY_READ,
                &mut h_key
            );
            
            if result != 0 {
                eprintln!("WebView2 Runtime not found. Please install from https://developer.microsoft.com/en-us/microsoft-edge/webview2/");
            }
            
            if h_key != 0 {
                RegCloseKey(h_key);
            }
        }
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