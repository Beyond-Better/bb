use dirs;
#[cfg(not(target_os = "windows"))]
use flate2::read::GzDecoder;

use log::{debug, error, info, warn};
use reqwest;
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Write};
use std::path::PathBuf;
#[cfg(not(target_os = "windows"))]
use tar::Archive;
use tauri::{command, AppHandle, Emitter};
use tokio;
use tauri_plugin_updater::UpdaterExt;
use tempfile::TempDir;
#[cfg(target_os = "windows")]
use zip::ZipArchive;

// Import stop functions for robust termination
use crate::api::stop_api;
use crate::bui::stop_bui;

const RELEASE_API_URL: &str = "https://asyagnmzoxgyhqprdaky.storage.supabase.co/storage/v1/object/releases/latest.json";
//const DUI_UPDATE_CHECK_INTERVAL: std::time::Duration = std::time::Duration::from_secs(300); // 5 minutes

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

fn emit_progress(
    app: &AppHandle,
    stage: &str,
    progress: f32,
    message: Option<String>,
) -> tauri::Result<()> {
    debug!(
        "Installation progress: {} - {}% - {:?}",
        stage, progress, message
    );
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
            format!(
                "Installation path too long (Windows limit is {} characters)",
                MAX_PATH
            ),
        ));
    }
    Ok(())
}

#[command]
pub async fn check_dui_update(app: AppHandle) -> Result<Option<DuiUpdateInfo>, String> {
    info!("Checking for application updates");
    
    // For testing: return mock update info
    #[cfg(debug_assertions)]
    {
        if std::env::var("BB_TEST_DUI_UPDATE").is_ok() {
            info!("Returning mock application update for testing");
            return Ok(Some(DuiUpdateInfo {
                version: "0.9.0".to_string(),
                date: Some("2025-06-28T03:00:00Z".to_string()),
                body: "Test application update with new features and improvements.".to_string(),
                download_url: "".to_string(),
            }));
        }
    }
    
    match app.updater().map_err(|e| format!("Failed to get updater: {}", e))?.check().await.map_err(|e| format!("Failed to check for updates: {}", e))? {
        Some(update) => {
            info!("Application update available: version {}", update.version);
            Ok(Some(DuiUpdateInfo {
                version: update.version,
                date: update.date.map(|d| d.to_string()),
                body: update.body.unwrap_or_default(),
                download_url: "".to_string(), // Not needed for Tauri updater
            }))
        }
        None => {
            debug!("No application update available");
            Ok(None)
        }
    }
}

#[command]
pub async fn perform_atomic_update(app: AppHandle) -> Result<(), String> {
    info!("Starting atomic update process (server components + application)");
    
    emit_progress(
        &app,
        "preparing",
        0.0,
        Some("Starting atomic update process...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Step 1: Update server components first
    emit_progress(
        &app,
        "upgrading-server",
        10.0,
        Some("Updating server components...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    // Perform server upgrade using existing logic
    if let Err(e) = perform_upgrade(app.clone()).await {
        error!("Server upgrade failed during atomic update: {}", e);
        return Err(format!("Server upgrade failed: {}", e));
    }
    
    emit_progress(
        &app,
        "upgrading-server",
        40.0,
        Some("Server components updated successfully".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Step 2: Check for DUI update
    emit_progress(
        &app,
        "checking-dui",
        50.0,
        Some("Checking for application updates...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    match app.updater().map_err(|e| format!("Failed to get updater: {}", e))?.check().await.map_err(|e| format!("Failed to check for updates: {}", e))? {
        Some(update) => {
            info!("Application update available, proceeding with download and install");
            
            emit_progress(
                &app,
                "downloading-dui",
                60.0,
                Some(format!("Downloading application update v{}...", update.version)),
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;
            
            // For macOS, download first without installing to avoid in-place replacement issues
            #[cfg(target_os = "macos")]
            let downloaded_path = {
                let temp_dir = std::env::temp_dir().join("bb-update");
                std::fs::create_dir_all(&temp_dir)
                    .map_err(|e| format!("Failed to create temp directory: {}", e))?;
                
                let archive_path = temp_dir.join(format!("update-{}.tar.gz", update.version));
                
                // Download the update archive
                let response = reqwest::get(update.download_url.as_str()).await
                    .map_err(|e| format!("Failed to download update: {}", e))?;
                
                if !response.status().is_success() {
                    return Err(format!("Download failed with status: {}", response.status()));
                }
                
                let _total_size = response.content_length();
                let downloaded;
                let mut file = std::fs::File::create(&archive_path)
                    .map_err(|e| format!("Failed to create update file: {}", e))?;
                
                // Read response body in chunks
                let bytes = response.bytes().await
                    .map_err(|e| format!("Failed to read response body: {}", e))?;
                
                use std::io::Write;
                file.write_all(&bytes)
                    .map_err(|e| format!("Failed to write update file: {}", e))?;
                
                downloaded = bytes.len();
                let progress = 90.0;
                let _ = emit_progress(
                    &app,
                    "downloading-dui",
                    progress,
                    Some(format!(
                        "Downloaded {} bytes",
                        downloaded
                    )),
                );
                
                info!("Application download completed to: {:?}", archive_path);
                let _ = emit_progress(
                    &app,
                    "installing-dui",
                    90.0,
                    Some("Preparing to install application update...".to_string()),
                );
                
                archive_path.to_string_lossy().to_string()
            };
            
            #[cfg(not(target_os = "macos"))]
            {
                let mut downloaded = 0;
                
                // On Windows, we need to handle the before-exit callback
                #[cfg(target_os = "windows")]
                let update_builder = app.updater_builder().on_before_exit(|| {
                    info!("Beyond Better app is about to exit on Windows for update installation");
                });
                
                #[cfg(not(target_os = "windows"))]
                let update_builder = app.updater_builder();
                
                let updater = update_builder.build().map_err(|e| {
                    error!("Failed to build updater: {}", e);
                    format!("Failed to build updater: {}", e)
                })?;
                
                let update = updater.check().await.map_err(|e| {
                    error!("Failed to re-check for updates: {}", e);
                    format!("Failed to re-check for updates: {}", e)
                })?.ok_or("Update disappeared during download")?;
                
                // Use standard Tauri updater for non-macOS platforms
                update.download_and_install(
                    |chunk_length, total_length| {
                        downloaded += chunk_length;
                        if let Some(total) = total_length {
                            let progress = 60.0 + (30.0 * downloaded as f32 / total as f32);
                            let _ = emit_progress(
                                &app,
                                "downloading-dui",
                                progress,
                                Some(format!(
                                    "Downloaded {} of {} bytes",
                                    downloaded, total
                                )),
                            );
                        }
                    },
                    || {
                        info!("Application download completed, installing...");
                        let _ = emit_progress(
                            &app,
                            "installing-dui",
                            90.0,
                            Some("Installing application update...".to_string()),
                        );
                    },
                ).await.map_err(|e| {
                    error!("Application update failed: {}", e);
                    format!("Application update failed: {}", e)
                })?;
            }
            
            emit_progress(
                &app,
                "complete",
                100.0,
                Some("Update complete, restarting application...".to_string()),
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;
            
            info!("Application update installed successfully, preparing restart...");
            
            // Small delay to ensure progress is shown and filesystem operations complete
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
            
            // Attempt graceful restart with error handling
            #[cfg(target_os = "macos")]
            restart_application_safely_two_stage(&app, &downloaded_path).await?;
            
            #[cfg(not(target_os = "macos"))]
            restart_application_safely(&app).await?;
            
            // Note: restart_application_safely initiates restart asynchronously
            // and returns immediately, so we return Ok here
            Ok(())
        }
        None => {
            info!("No application update available");
            emit_progress(
                &app,
                "complete",
                100.0,
                Some("Server components updated, no application update needed".to_string()),
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;
            return Ok(());
        }
        // Error cases are handled by the ? operator above
    }
}

#[command]
pub async fn perform_dui_update_only(app: AppHandle) -> Result<(), String> {
    info!("Starting application-only update process");
    
    emit_progress(
        &app,
        "checking-dui",
        0.0,
        Some("Checking for application updates...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    
    match app.updater().map_err(|e| format!("Failed to get updater: {}", e))?.check().await.map_err(|e| format!("Failed to check for updates: {}", e))? {
        Some(update) => {
            info!("Application update available, proceeding with download and install");
            
            emit_progress(
                &app,
                "downloading-dui",
                20.0,
                Some(format!("Downloading application update v{}...", update.version)),
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;
            
            let mut downloaded = 0;
            
            #[cfg(target_os = "windows")]
            let update_builder = app.updater_builder().on_before_exit(|| {
                info!("Application app is about to exit on Windows for update installation");
            });
            
            #[cfg(not(target_os = "windows"))]
            let update_builder = app.updater_builder();
            
            let updater = update_builder.build().map_err(|e| {
                error!("Failed to build updater: {}", e);
                format!("Failed to build updater: {}", e)
            })?;
            
            let update = updater.check().await.map_err(|e| {
                error!("Failed to re-check for updates: {}", e);
                format!("Failed to re-check for updates: {}", e)
            })?.ok_or("Update disappeared during download")?;
            
            // For macOS, download first without installing to avoid in-place replacement issues
            #[cfg(target_os = "macos")]
            let downloaded_path = {
                let temp_dir = std::env::temp_dir().join("bb-update");
                std::fs::create_dir_all(&temp_dir)
                    .map_err(|e| format!("Failed to create temp directory: {}", e))?;
                
                let archive_path = temp_dir.join(format!("update-{}.tar.gz", update.version));
                
                // Download the update archive
                let response = reqwest::get(update.download_url.as_str()).await
                    .map_err(|e| format!("Failed to download update: {}", e))?;
                
                if !response.status().is_success() {
                    return Err(format!("Download failed with status: {}", response.status()));
                }
                
                let _total_size = response.content_length();
                let downloaded;
                let mut file = std::fs::File::create(&archive_path)
                    .map_err(|e| format!("Failed to create update file: {}", e))?;
                
                // Read response body in chunks
                let bytes = response.bytes().await
                    .map_err(|e| format!("Failed to read response body: {}", e))?;
                
                use std::io::Write;
                file.write_all(&bytes)
                    .map_err(|e| format!("Failed to write update file: {}", e))?;
                
                downloaded = bytes.len();
                let progress = 80.0;
                let _ = emit_progress(
                    &app,
                    "downloading-dui",
                    progress,
                    Some(format!(
                        "Downloaded {} bytes",
                        downloaded
                    )),
                );
                
                info!("Application download completed to: {:?}", archive_path);
                let _ = emit_progress(
                    &app,
                    "installing-dui",
                    90.0,
                    Some("Preparing to install application update...".to_string()),
                );
                
                archive_path.to_string_lossy().to_string()
            };
            
            #[cfg(not(target_os = "macos"))]
            {
                update.download_and_install(
                    |chunk_length, total_length| {
                        downloaded += chunk_length;
                        if let Some(total) = total_length {
                            let progress = 20.0 + (60.0 * downloaded as f32 / total as f32);
                            let _ = emit_progress(
                                &app,
                                "downloading-dui",
                                progress,
                                Some(format!(
                                    "Downloaded {} of {} bytes",
                                    downloaded, total
                                )),
                            );
                        }
                    },
                    || {
                        info!("Application download completed, installing...");
                        let _ = emit_progress(
                            &app,
                            "installing-dui",
                            90.0,
                            Some("Installing application update...".to_string()),
                        );
                    },
                ).await.map_err(|e| {
                    error!("Application update failed: {}", e);
                    format!("Application update failed: {}", e)
                })?;
            }
            
            emit_progress(
                &app,
                "complete",
                100.0,
                Some("Application update complete, restarting application...".to_string()),
            )
            .map_err(|e| format!("Failed to emit progress: {}", e))?;
            
            info!("Application update installed successfully, preparing restart...");
            
            // Small delay to ensure progress is shown and filesystem operations complete
            tokio::time::sleep(std::time::Duration::from_millis(2000)).await;
            
            // Attempt graceful restart with error handling
            #[cfg(target_os = "macos")]
            restart_application_safely_two_stage(&app, &downloaded_path).await?;
            
            #[cfg(not(target_os = "macos"))]
            restart_application_safely(&app).await?;
            
            // Note: restart_application_safely initiates restart asynchronously
            // and returns immediately, so we return Ok here
            Ok(())
        }
        None => {
            info!("No Application update available");
            return Err("No Application update available".to_string());
        }
        // Error cases are handled by the ? operator above
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DuiUpdateInfo {
    pub version: String,
    pub date: Option<String>,
    pub body: String,
    pub download_url: String,
}

fn get_install_location() -> io::Result<InstallLocation> {
    debug!("Determining installation location");
    // Try user-specific location first
    if let Some(home) = dirs::home_dir() {
        let user_install = if cfg!(target_os = "windows") {
            let path = home
                .join("AppData")
                .join("Local")
                .join("BeyondBetter")
                .join("bin");
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

    debug!(
        "System install location: {:?}, writable: {}",
        system_install, writable
    );
    Ok(InstallLocation {
        path: system_install,
        writable,
        is_user_install: false,
    })
}

#[command]
pub async fn perform_install(app: AppHandle) -> Result<(), String> {
    info!("Starting fresh installation process");
    emit_progress(
        &app,
        "preparing",
        0.0,
        Some("Checking installation location...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    let install_location = get_install_location().map_err(|e| e.to_string())?;

    if !install_location.writable {
        #[cfg(target_os = "windows")]
        {
            error!(
                "Installation location not writable: {:?}",
                install_location.path
            );
            return Err(
                "Installation requires administrator privileges. Please run application as administrator."
                    .to_string(),
            );
        }

        #[cfg(not(target_os = "windows"))]
        {
            return Err(
                "Installation location is not writable. Please run with elevated privileges."
                    .to_string(),
            );
        }
    }

    // Create installation directory if it doesn't exist
    emit_progress(
        &app,
        "preparing",
        10.0,
        Some("Creating installation directory...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    fs::create_dir_all(&install_location.path)
        .map_err(|e| {
            error!(
                "Failed to create directory {:?}: {}",
                install_location.path, e
            );
            e
        })
        .map_err(|e| format!("Failed to create installation directory: {}", e))?;

    // Download latest release
    emit_progress(
        &app,
        "downloading",
        20.0,
        Some("Fetching latest release information...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    let latest_release = fetch_latest_release().await?;

    // Download and install binaries
    emit_progress(
        &app,
        "installing",
        40.0,
        Some("Installing binaries...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    install_binaries(&app, &latest_release, &install_location).await?;

    emit_progress(
        &app,
        "complete",
        100.0,
        Some("Installation complete".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    Ok(())
}

#[command]
pub async fn perform_upgrade(app: AppHandle) -> Result<(), String> {
    info!("Starting upgrade process");
    emit_progress(
        &app,
        "preparing",
        0.0,
        Some("Checking upgrade location...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    let install_location = get_install_location().map_err(|e| e.to_string())?;

    if !install_location.writable {
        return Err(
            "Upgrade location is not writable. Please run with elevated privileges.".to_string(),
        );
    }

    // Backup current installation
    emit_progress(&app, "backup", 10.0, Some("Creating backup...".to_string()))
        .map_err(|e| format!("Failed to emit progress: {}", e))?;
    backup_current_installation(&install_location)?;

    // Stop all existing processes robustly before upgrade
    emit_progress(
        &app,
        "stopping",
        15.0,
        Some("Stopping existing processes...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    info!("Stopping existing API and BUI processes for upgrade");
    let api_stopped = stop_api()
        .await
        .map_err(|e| format!("Failed to stop API: {}", e))?;
    let bui_stopped = stop_bui()
        .await
        .map_err(|e| format!("Failed to stop BUI: {}", e))?;

    if !api_stopped {
        warn!("Some API processes may still be running after stop attempt");
    }
    if !bui_stopped {
        warn!("Some BUI processes may still be running after stop attempt");
    }

    // Small delay to ensure ports are freed
    std::thread::sleep(std::time::Duration::from_millis(2000));
    info!("Process termination complete, proceeding with upgrade");

    // Download latest release
    emit_progress(
        &app,
        "downloading",
        20.0,
        Some("Fetching latest release information...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    let latest_release = fetch_latest_release().await?;

    // Download and install binaries
    emit_progress(
        &app,
        "installing",
        40.0,
        Some("Installing binaries...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    install_binaries(&app, &latest_release, &install_location).await?;

    emit_progress(
        &app,
        "complete",
        100.0,
        Some("Upgrade complete".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;
    Ok(())
}

async fn fetch_latest_release() -> Result<GithubRelease, String> {
    debug!("Fetching latest release from release server");
    let client = reqwest::Client::new();
    let user_agent = format!("BB-APP/{}", env!("CARGO_PKG_VERSION"));
    let response = client
        .get(RELEASE_API_URL)
        .header("User-Agent", &user_agent)
        .send()
        .await
        .map_err(|e| {
            error!("Release API request failed: {}", e);
            e
        })
        .map_err(|e| format!("Failed to fetch latest release: {}", e))?;

    if !response.status().is_success() {
        error!(
            "Release API error: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        );
        return Err(format!(
            "Release API error: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        ));
    }

    response
        .json::<GithubRelease>()
        .await
        .map_err(|e| format!("Failed to parse release response: {}", e))
}

async fn install_binaries(
    app: &AppHandle,
    release: &GithubRelease,
    location: &InstallLocation,
) -> Result<(), String> {
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
    let asset = release
        .assets
        .iter()
        .find(|a| a.name == asset_name)
        .map_or_else(
            || {
                error!("No matching asset found for {}", asset_name);
                None
            },
            Some,
        )
        .ok_or_else(|| format!("No compatible release found for {}-{}", arch, os))?;

    debug!(
        "Found matching asset: {} at URL: {}",
        asset.name, asset.browser_download_url
    );
    emit_progress(
        app,
        "downloading",
        50.0,
        Some(format!("Downloading {} from GitHub...", asset_name)),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Create temporary directory for download
    let temp_dir = TempDir::new().map_err(|e| format!("Failed to create temp directory: {}", e))?;
    let download_path = temp_dir.path().join(if cfg!(target_os = "windows") {
        "bb.zip"
    } else {
        "bb.tar.gz"
    });

    // Download the asset
    let response = reqwest::get(&asset.browser_download_url)
        .await
        .map_err(|e| {
            error!("Failed to download asset: {}", e);
            e
        })
        .map_err(|e| format!("Failed to download release: {}", e))?;

    if !response.status().is_success() {
        error!(
            "Asset download failed: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        );
        return Err(format!(
            "Download failed: {} - {}",
            response.status(),
            response
                .status()
                .canonical_reason()
                .unwrap_or("Unknown error")
        ));
    }

    emit_progress(
        app,
        "downloading",
        70.0,
        Some("Saving download...".to_string()),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Save the download
    let content = response
        .bytes()
        .await
        .map_err(|e| {
            error!("Failed to read download content: {}", e);
            e
        })
        .map_err(|e| format!("Failed to read download: {}", e))?;

    let mut file = File::create(&download_path)
        .map_err(|e| {
            error!("Failed to create file at {:?}: {}", download_path, e);
            e
        })
        .map_err(|e| format!("Failed to create download file: {}", e))?;

    file.write_all(&content)
        .map_err(|e| {
            error!("Failed to write content to {:?}: {}", download_path, e);
            e
        })
        .map_err(|e| format!("Failed to write download: {}", e))?;

    emit_progress(
        app,
        "installing",
        80.0,
        Some(format!("Extracting archive to {:?}...", temp_dir.path())),
    )
    .map_err(|e| format!("Failed to emit progress: {}", e))?;

    // Extract the archive
    #[cfg(target_os = "windows")]
    {
        debug!("Extracting Windows zip archive");
        let file = File::open(&download_path)
            .map_err(|e| {
                error!("Failed to open zip archive: {}", e);
                e
            })
            .map_err(|e| format!("Failed to open archive: {}", e))?;

        let mut archive = ZipArchive::new(file)
            .map_err(|e| {
                error!("Failed to read zip archive: {}", e);
                e
            })
            .map_err(|e| format!("Failed to read archive: {}", e))?;

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| {
                    error!("Failed to read zip entry: {}", e);
                    e
                })
                .map_err(|e| format!("Failed to read zip entry: {}", e))?;

            let outpath = temp_dir.path().join(file.name());
            debug!("Extracting to {:?}", outpath);

            if file.name().ends_with('/') {
                fs::create_dir_all(&outpath)
                    .map_err(|e| {
                        error!("Failed to create directory {:?}: {}", outpath, e);
                        e
                    })
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            } else {
                if let Some(p) = outpath.parent() {
                    if !p.exists() {
                        fs::create_dir_all(p)
                            .map_err(|e| {
                                error!("Failed to create parent directory {:?}: {}", p, e);
                                e
                            })
                            .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                    }
                }
                let mut outfile = File::create(&outpath)
                    .map_err(|e| {
                        error!("Failed to create file {:?}: {}", outpath, e);
                        e
                    })
                    .map_err(|e| format!("Failed to create file: {}", e))?;
                io::copy(&mut file, &mut outfile)
                    .map_err(|e| {
                        error!("Failed to write file {:?}: {}", outpath, e);
                        e
                    })
                    .map_err(|e| format!("Failed to write file: {}", e))?;
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        debug!("Extracting Unix tar.gz archive");
        let tar_gz =
            File::open(&download_path).map_err(|e| format!("Failed to open archive: {}", e))?;

        let tar = GzDecoder::new(tar_gz);
        let mut archive = Archive::new(tar);

        archive
            .unpack(temp_dir.path())
            .map_err(|e| {
                error!("Failed to extract archive: {}", e);
                e
            })
            .map_err(|e| format!("Failed to extract archive: {}", e))?;
    }

    emit_progress(
        app,
        "installing",
        90.0,
        Some("Installing binaries...".to_string()),
    )
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
                        debug!(
                            "Successfully installed {} after {} retries",
                            binary,
                            3 - retries
                        );
                        break;
                    }
                    Err(e) => {
                        error!(
                            "Attempt {} failed to copy {} to {:?}: {}",
                            4 - retries,
                            binary,
                            target,
                            e
                        );
                        last_error = Some(e);
                        retries -= 1;
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }
                }
            }
            if retries == 0 {
                return Err(format!(
                    "Failed to install {} after multiple attempts: {}",
                    binary,
                    last_error
                        .map(|e| e.to_string())
                        .unwrap_or_else(|| "Unknown error".to_string())
                ));
            }
        }

        #[cfg(not(target_os = "windows"))]
        fs::copy(&source, &target)
            .map_err(|e| {
                error!("Failed to copy {} to {:?}: {}", binary, target, e);
                e
            })
            .map_err(|e| format!("Failed to install {}: {}", binary, e))?;

        #[cfg(not(target_os = "windows"))]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&target, fs::Permissions::from_mode(0o755))
                .map_err(|e| {
                    error!("Failed to set permissions for {:?}: {}", target, e);
                    e
                })
                .map_err(|e| format!("Failed to set permissions for {}: {}", binary, e))?;
        }
    }

    Ok(())
}

#[command]
/// Opens a URL externally in the user's default browser
/// This is a workaround for downloading files that would otherwise be loaded in the webview
pub async fn open_external_url(url: String, _app: AppHandle) -> Result<(), String> {
    info!(
        "[DOWNLOAD HANDLER] Got request to open URL externally: {}",
        url
    );

    // Create command based on platform
    let cmd = if cfg!(target_os = "windows") {
        "cmd"
    } else if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    };

    let args = if cfg!(target_os = "windows") {
        vec!["/c", "start", "", url.as_str()]
    } else if cfg!(target_os = "macos") {
        vec![url.as_str()]
    } else {
        vec![url.as_str()]
    };

    info!(
        "[DOWNLOAD HANDLER] Executing command: {} with args: {:?}",
        cmd, args
    );

    // Open URL using the standard Rust command for compatibility
    match std::process::Command::new(cmd).args(args).spawn() {
        Ok(child) => {
            info!(
                "[DOWNLOAD HANDLER] Successfully spawned process with ID: {:?}",
                child.id()
            );
            Ok(())
        }
        Err(e) => {
            error!("[DOWNLOAD HANDLER] Failed to open URL: {}", e);
            Err(format!("Failed to open URL: {}", e))
        }
    }
}

async fn restart_application_safely_two_stage(_app: &AppHandle, _update_archive_path: &str) -> Result<(), String> {
    info!("Attempting two-stage application restart after update");
    
    #[cfg(target_os = "macos")]
    {
        // Get current app bundle path
        let current_exe = std::env::current_exe()
            .map_err(|e| format!("Failed to get current executable: {}", e))?;
        
        // Navigate up to the .app bundle
        let app_bundle = current_exe
            .ancestors()
            .find(|p| p.extension().map_or(false, |ext| ext == "app"))
            .ok_or("Could not find .app bundle")?;
        
        info!("Found app bundle at: {:?}", app_bundle);
        
        // Create helper script in temp directory
        let temp_dir = std::env::temp_dir();
        let helper_script = temp_dir.join("bb-update-helper.sh");
        
        // Embed the helper script content
        let script_content = include_str!("../../../update-helper.sh");
        
        std::fs::write(&helper_script, script_content)
            .map_err(|e| format!("Failed to write helper script: {}", e))?;
        
        // Make script executable
        std::process::Command::new("chmod")
            .args(["+x", helper_script.to_str().unwrap_or("")])
            .output()
            .map_err(|e| format!("Failed to make helper script executable: {}", e))?;
        
        // Get current process ID
        let current_pid = std::process::id();
        
        info!("Launching update helper script from: {:?}", helper_script);
        
        // Launch the helper script with proper detachment
        std::process::Command::new(&helper_script)
            .args([
                _update_archive_path,
                app_bundle.to_str().unwrap_or(""),
                &current_pid.to_string(),
            ])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to launch update helper: {}", e))?;
        
        info!("Update helper launched, current process will exit");
        
        // Give the helper script a moment to start
        tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        
        // Exit this process cleanly - this will not return
        std::process::exit(0);
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        // For other platforms, fall back to Tauri's built-in restart
        info!("Using Tauri built-in restart for non-macOS platform");
        _app.restart();
        // Note: restart() doesn't return, so this point should not be reached
    }
}

// Keep the original function for non-update restarts
#[allow(dead_code)]
async fn restart_application_safely(app: &AppHandle) -> Result<(), String> {
    info!("Attempting safe application restart (non-update)");
    
    // For simple restarts without updates, use Tauri's built-in method
    let app_clone = app.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        app_clone.restart();
    });
    
    Ok(())
}

fn backup_current_installation(location: &InstallLocation) -> Result<(), String> {
    debug!(
        "Creating backup of current installation from {:?}",
        location.path
    );
    let backup_dir =
        tempfile::tempdir().map_err(|e| format!("Failed to create backup directory: {}", e))?;

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
