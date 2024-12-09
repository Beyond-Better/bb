use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs::{self, File};
use std::io::{self, Write};
use tauri::{command, AppHandle, Emitter};
use dirs;
use reqwest;
use tempfile::TempDir;
use flate2::read::GzDecoder;
use tar::Archive;

const GITHUB_API_URL: &str = "https://api.github.com/repos/Beyond-Better/bb/releases/latest";

#[derive(Debug, Serialize, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GithubRelease {
    tag_name: String,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstallProgress {
    stage: String,
    progress: f32,
    message: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallLocation {
    path: PathBuf,
    writable: bool,
    is_user_install: bool,
}

fn emit_progress(app: &AppHandle, stage: &str, progress: f32, message: Option<String>) -> tauri::Result<()> {
    let progress = InstallProgress {
        stage: stage.to_string(),
        progress,
        message,
    };
    app.emit("install-progress", progress)
}

fn get_install_location() -> io::Result<InstallLocation> {
    // Try user-specific location first
    if let Some(home) = dirs::home_dir() {
        let user_install = if cfg!(target_os = "windows") {
            home.join("AppData").join("Local").join("BeyondBetter").join("bin")
        } else if cfg!(target_os = "macos") {
            home.join(".bb").join("bin")
        } else {
            // Linux
            home.join(".local").join("bin")
        };

        // Check if directory exists and is writable
        if let Ok(metadata) = fs::metadata(&user_install) {
            let writable = metadata.permissions().readonly();
            return Ok(InstallLocation {
                path: user_install,
                writable: !writable,
                is_user_install: true,
            });
        }

        // Try to create the directory
        if fs::create_dir_all(&user_install).is_ok() {
            return Ok(InstallLocation {
                path: user_install,
                writable: true,
                is_user_install: true,
            });
        }
    }

    // Fall back to system location
    let system_install = if cfg!(target_os = "windows") {
        PathBuf::from(r"C:\Program Files\BeyondBetter\bin")
    } else if cfg!(target_os = "macos") {
        PathBuf::from("/usr/local/bin")
    } else {
        PathBuf::from("/usr/local/bin")
    };

    // Check if system location is writable
    let writable = if let Ok(metadata) = fs::metadata(&system_install) {
        !metadata.permissions().readonly()
    } else {
        false
    };

    Ok(InstallLocation {
        path: system_install,
        writable,
        is_user_install: false,
    })
}

#[command]
pub async fn perform_install(app: AppHandle) -> Result<(), String> {
    emit_progress(&app, "preparing", 0.0, Some("Checking installation location...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    let install_location = get_install_location().map_err(|e| e.to_string())?;
    
    if !install_location.writable {
        return Err("Installation location is not writable. Please run with elevated privileges.".to_string());
    }

    // Create installation directory if it doesn't exist
    emit_progress(&app, "preparing", 10.0, Some("Creating installation directory...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    fs::create_dir_all(&install_location.path)
        .map_err(|e| format!("Failed to create installation directory: {}", e))?;

    // Download latest release
    emit_progress(&app, "downloading", 20.0, Some("Fetching latest release information...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    let latest_release = fetch_latest_release().await?;
    
    // Download and install binaries
    emit_progress(&app, "installing", 40.0, Some("Installing binaries...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    install_binaries(&app, &latest_release, &install_location).await?;

    emit_progress(&app, "complete", 100.0, Some("Installation complete".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    Ok(())
}

#[command]
pub async fn perform_upgrade(app: AppHandle) -> Result<(), String> {
    emit_progress(&app, "preparing", 0.0, Some("Checking upgrade location...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    let install_location = get_install_location().map_err(|e| e.to_string())?;
    
    if !install_location.writable {
        return Err("Upgrade location is not writable. Please run with elevated privileges.".to_string());
    }

    // Backup current installation
    emit_progress(&app, "backup", 10.0, Some("Creating backup...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    backup_current_installation(&install_location)?;

    // Download latest release
    emit_progress(&app, "downloading", 20.0, Some("Fetching latest release information...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    let latest_release = fetch_latest_release().await?;
    
    // Download and install binaries
    emit_progress(&app, "installing", 40.0, Some("Installing binaries...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    install_binaries(&app, &latest_release, &install_location).await?;

    emit_progress(&app, "complete", 100.0, Some("Upgrade complete".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    Ok(())
}

async fn fetch_latest_release() -> Result<GithubRelease, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(GITHUB_API_URL)
        .header("User-Agent", "BB-DUI")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }

    response
        .json::<GithubRelease>()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))
}

async fn install_binaries(app: &AppHandle, release: &GithubRelease, location: &InstallLocation) -> Result<(), String> {
    // Determine platform-specific asset name
    let os = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "apple-darwin"
    } else {
        "unknown-linux-gnu"
    };
    
    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        return Err("Unsupported architecture".to_string());
    };

    let asset_name = format!("bb-{}-{}-{}.tar.gz", arch, os, release.tag_name);
    
    // Find matching asset
    let asset = release.assets
        .iter()
        .find(|a| a.name == asset_name)
        .ok_or_else(|| format!("No compatible release found for {}-{}", arch, os))?;

    emit_progress(app, "downloading", 50.0, Some(format!("Downloading {}...", asset_name)))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Create temporary directory for download
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let download_path = temp_dir.path().join("bb.tar.gz");

    // Download the asset
    let response = reqwest::get(&asset.browser_download_url)
        .await
        .map_err(|e| format!("Failed to download release: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: {}", response.status()));
    }

    emit_progress(app, "downloading", 70.0, Some("Saving download...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Save the download
    let content = response.bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;
    
    let mut file = File::create(&download_path)
        .map_err(|e| format!("Failed to create download file: {}", e))?;
    
    file.write_all(&content)
        .map_err(|e| format!("Failed to write download: {}", e))?;

    emit_progress(app, "installing", 80.0, Some("Extracting archive...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Extract the archive
    let tar_gz = File::open(&download_path)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    
    let tar = GzDecoder::new(tar_gz);
    let mut archive = Archive::new(tar);
    
    archive.unpack(temp_dir.path())
        .map_err(|e| format!("Failed to extract archive: {}", e))?;

    emit_progress(app, "installing", 90.0, Some("Installing binaries...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Install the binaries
    let binaries = if cfg!(target_os = "windows") {
        vec!["bb.exe", "bb-api.exe"]
    } else {
        vec!["bb", "bb-api"]
    };

    for binary in binaries {
        let source = temp_dir.path().join(binary);
        let target = location.path.join(binary);

        fs::copy(&source, &target)
            .map_err(|e| format!("Failed to install {}: {}", binary, e))?;

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&target, fs::Permissions::from_mode(0o755))
                .map_err(|e| format!("Failed to set permissions for {}: {}", binary, e))?;
        }
    }

    Ok(())
}

fn backup_current_installation(location: &InstallLocation) -> Result<(), String> {
    let backup_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let binaries = if cfg!(target_os = "windows") {
        vec!["bb.exe", "bb-api.exe"]
    } else {
        vec!["bb", "bb-api"]
    };

    for binary in binaries {
        let source = location.path.join(binary);
        if source.exists() {
            let backup = backup_dir.path().join(binary);
            fs::copy(&source, &backup)
                .map_err(|e| format!("Failed to backup {}: {}", binary, e))?;
        }
    }

    Ok(())
}