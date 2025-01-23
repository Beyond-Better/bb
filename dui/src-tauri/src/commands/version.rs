use tauri::command;
use std::process::Command;

#[command]
pub fn get_binary_version() -> Result<String, String> {
    let output = Command::new("bb")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    
    // Find the line containing the version
    for line in output_str.lines() {
        if line.contains("BB API version") {
            return Ok(line.trim().to_string());
        }
    }

    Err("Version information not found in output".to_string())
}