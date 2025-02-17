use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs::{self, File};
use log::{debug, info, error};
use std::io::{self, Write};
use tauri::{command, AppHandle, Emitter};
use dirs;
use reqwest;
use tempfile::TempDir;
#[cfg(not(target_os = "windows"))]
use flate2::read::GzDecoder;
#[cfg(not(target_os = "windows"))]
use tar::Archive;
#[cfg(target_os = "windows")]
use zip::ZipArchive;

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
    debug!("Installation progress: {} - {}% - {:?}", stage, progress, message);
    let progress = InstallProgress {
        stage: stage.to_string(),
        progress,
        message,
    };
    app.emit("install-progress", progress)
}

#[cfg(target_os = "windows")]
fn check_windows_path_length(path: &PathBuf) -> io::Result<()> {
    const MAX_PATH: usize = 260;
    if path.to_string_lossy().len() > MAX_PATH {
        error!("Path exceeds Windows MAX_PATH limit: {:?}", path);
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("Installation path too long (Windows limit is {} characters)", MAX_PATH)
        ));
    }
    Ok(())
}

fn get_install_location() -> io::Result<InstallLocation> {
    debug!("Determining installation location");
    // Try user-specific location first
    if let Some(home) = dirs::home_dir() {
        let user_install = if cfg!(target_os = "windows") {
            let path = home.join("AppData").join("Local").join("BeyondBetter").join("bin");
            #[cfg(target_os = "windows")]
            check_windows_path_length(&path)?;
            path
        } else if cfg!(target_os = "macos") {
            home.join(".bb").join("bin")
        } else {
            // Linux
            home.join(".local").join("bin")
        };
        debug!("Checking user install location: {:?}", user_install);

        // Check if directory exists and is writable
        if let Ok(metadata) = fs::metadata(&user_install) {
            let writable = metadata.permissions().readonly();
            debug!("User install location exists, writable: {}", !writable);
            return Ok(InstallLocation {
                path: user_install,
                writable: !writable,
                is_user_install: true,
            });
        }

        // Try to create the directory
        if fs::create_dir_all(&user_install).is_ok() {
            debug!("Created user install location: {:?}", user_install);
            return Ok(InstallLocation {
                path: user_install,
                writable: true,
                is_user_install: true,
            });
        }
    }

    debug!("Falling back to system installation location");
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

    debug!("System install location: {:?}, writable: {}", system_install, writable);
    Ok(InstallLocation {
        path: system_install,
        writable,
        is_user_install: false,
    })
}

#[command]
pub async fn perform_install(app: AppHandle) -> Result<(), String> {
    info!("Starting fresh installation process");
    emit_progress(&app, "preparing", 0.0, Some("Checking installation location...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    let install_location = get_install_location().map_err(|e| e.to_string())?;
    
    if !install_location.writable {
        #[cfg(target_os = "windows")]
        {
            error!("Installation location not writable: {:?}", install_location.path);
            return Err("Installation requires administrator privileges. Please run DUI as administrator.".to_string());
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err("Installation location is not writable. Please run with elevated privileges.".to_string());
        }
    }

    // Create installation directory if it doesn't exist
    emit_progress(&app, "preparing", 10.0, Some("Creating installation directory...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    fs::create_dir_all(&install_location.path)
        .map_err(|e| { error!("Failed to create directory {:?}: {}", install_location.path, e); e })
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
    info!("Starting upgrade process");
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
    debug!("Fetching latest release from GitHub API");
    let client = reqwest::Client::new();
    let response = client
        .get(GITHUB_API_URL)
        .header("User-Agent", "BB-DUI")
        .send()
        .await
        .map_err(|e| { error!("GitHub API request failed: {}", e); e })
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !response.status().is_success() {
        error!("GitHub API error: {} - {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown error"));
        return Err(format!("GitHub API error: {} - {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown error")));
    }

    response
        .json::<GithubRelease>()
        .await
        .map_err(|e| format!("Failed to parse GitHub response: {}", e))
}

async fn install_binaries(app: &AppHandle, release: &GithubRelease, location: &InstallLocation) -> Result<(), String> {
    info!("Starting binary installation process");
    // Determine platform-specific asset name
    let os = if cfg!(target_os = "windows") {
        "pc-windows-msvc"
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

    let asset_name = if cfg!(target_os = "windows") {
        format!("bb-{}-{}-{}.zip", arch, os, release.tag_name)
    } else {
        format!("bb-{}-{}-{}.tar.gz", arch, os, release.tag_name)
    };
    debug!("Looking for release asset: {}", asset_name);
    
    // Find matching asset
    let asset = release.assets
        .iter()
        .find(|a| a.name == asset_name)
        .map_or_else(|| { error!("No matching asset found for {}", asset_name); None }, Some)
        .ok_or_else(|| format!("No compatible release found for {}-{}", arch, os))?;

    debug!("Found matching asset: {} at URL: {}", asset.name, asset.browser_download_url);
    emit_progress(app, "downloading", 50.0, Some(format!("Downloading {} from GitHub...", asset_name)))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Create temporary directory for download
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let download_path = temp_dir.path().join(if cfg!(target_os = "windows") { "bb.zip" } else { "bb.tar.gz" });

    // Download the asset
    let response = reqwest::get(&asset.browser_download_url)
        .await
        .map_err(|e| { error!("Failed to download asset: {}", e); e })
        .map_err(|e| format!("Failed to download release: {}", e))?;

    if !response.status().is_success() {
        error!("Asset download failed: {} - {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown error"));
        return Err(format!("Download failed: {} - {}", response.status(), response.status().canonical_reason().unwrap_or("Unknown error")));
    }

    emit_progress(app, "downloading", 70.0, Some("Saving download...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Save the download
    let content = response.bytes()
        .await
        .map_err(|e| { error!("Failed to read download content: {}", e); e })
        .map_err(|e| format!("Failed to read download: {}", e))?;
    
    let mut file = File::create(&download_path)
        .map_err(|e| { error!("Failed to create file at {:?}: {}", download_path, e); e })
        .map_err(|e| format!("Failed to create download file: {}", e))?;
    
    file.write_all(&content)
        .map_err(|e| { error!("Failed to write content to {:?}: {}", download_path, e); e })
        .map_err(|e| format!("Failed to write download: {}", e))?;

    emit_progress(app, "installing", 80.0, Some(format!("Extracting archive to {:?}...", temp_dir.path())))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Extract the archive
    #[cfg(target_os = "windows")]
    {
        debug!("Extracting Windows zip archive");
        let file = File::open(&download_path)
            .map_err(|e| { error!("Failed to open zip archive: {}", e); e })
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        
        let mut archive = ZipArchive::new(file)
            .map_err(|e| { error!("Failed to read zip archive: {}", e); e })
            .map_err(|e| format!("Failed to read archive: {}", e))?;
        
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)
                .map_err(|e| { error!("Failed to read zip entry: {}", e); e })
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;
            
            let outpath = temp_dir.path().join(file.name());
            debug!("Extracting to {:?}", outpath);
            
            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)
                    .map_err(|e| { error!("Failed to create directory {:?}: {}", outpath, e); e })
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| { error!("Failed to create parent directory {:?}: {}", p, e); e })
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| { error!("Failed to create file {:?}: {}", outpath, e); e })
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| { error!("Failed to write file {:?}: {}", outpath, e); e })
                    .map_err(|e| format!("Failed to write file: {}", e))?;
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        debug!("Extracting Unix tar.gz archive");
        let tar_gz = File::open(&download_path)
            .map_err(|e| format!("Failed to open archive: {}", e))?;
        
        let tar = GzDecoder::new(tar_gz);
        let mut archive = Archive::new(tar);
        
        archive.unpack(temp_dir.path())
            .map_err(|e| { error!("Failed to extract archive: {}", e); e })
            .map_err(|e| format!("Failed to extract archive: {}", e))?;
    }

    emit_progress(app, "installing", 90.0, Some("Installing binaries...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Install the binaries
    let binaries = if cfg!(target_os = "windows") {
        vec!["bb.exe", "bb-api.exe", "bb-bui.exe"]
    } else {
        vec!["bb", "bb-api", "bb-bui"]
    };

    for binary in binaries {
        let source = temp_dir.path().join(binary);
        let target = location.path.join(binary);
        debug!("Installing binary from {:?} to {:?}", source, target);

        #[cfg(target_os = "windows")]
        {
            // Windows: Try to remove existing file first (handles file locking better)
            if target.exists() {
                debug!("Removing existing binary at {:?}", target);
                if let Err(e) = fs::remove_file(&target) {
                    error!("Failed to remove existing binary {:?}: {}", target, e);
                }
            }

            // Try copy with retries for Windows file system delays
            let mut retries = 3;
            let mut last_error = None;
            while retries > 0 {
                match fs::copy(&source, &target) {
                    Ok(_) => {
                        debug!("Successfully installed {} after {} retries", binary, 3 - retries);
                        break;
                    },
                    Err(e) => {
                        error!("Attempt {} failed to copy {} to {:?}: {}", 4 - retries, binary, target, e);
                        last_error = Some(e);
                        retries -= 1;
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
            if retries == 0 {
                return Err(format!("Failed to install {} after multiple attempts: {}", 
                    binary, 
                    last_error.map(|e| e.to_string()).unwrap_or_else(|| "Unknown error".to_string())
                ));
            }
        }

        #[cfg(not(target_os = "windows"))]
        fs::copy(&source, &target)
            .map_err(|e| { error!("Failed to copy {} to {:?}: {}", binary, target, e); e })
            .map_err(|e| format!("Failed to install {}: {}", binary, e))?;

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&target, fs::Permissions::from_mode(0o755))
                .map_err(|e| { error!("Failed to set permissions for {:?}: {}", target, e); e })
                .map_err(|e| format!("Failed to set permissions for {}: {}", binary, e))?;
        }
    }

    Ok(())
}

fn backup_current_installation(location: &InstallLocation) -> Result<(), String> {
    debug!("Creating backup of current installation from {:?}", location.path);
    let backup_dir = tempfile::tempdir()
        .map_err(|e| format!("Failed to create backup directory: {}", e))?;

    let binaries = if cfg!(target_os = "windows") {
        vec!["bb.exe", "bb-api.exe", "bb-bui.exe"]
    } else {
        vec!["bb", "bb-api", "bb-bui"]
    };

    for binary in binaries {
        let source = location.path.join(binary);
        if source.exists() {
            debug!("Backing up binary: {:?}", source);
            let backup = backup_dir.path().join(binary);
            fs::copy(&source, &backup)
                .map_err(|e| format!("Failed to backup {}: {}", binary, e))?;
        }
    }

    Ok(())
}