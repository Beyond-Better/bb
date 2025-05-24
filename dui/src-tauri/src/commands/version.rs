// This file contains core version checking functionality.
// Installation/upgrade functionality has been moved to commands/upgrade.rs

use crate::api::get_bb_api_path;
use log::{debug, error, info, warn};
use once_cell::sync::Lazy;
use reqwest;
use semver::Version;
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::command;

const GITHUB_API_URL: &str = "https://api.github.com/repos/Beyond-Better/bb/releases/latest";
const GITHUB_CACHE_DURATION: Duration = Duration::from_secs(3600); // 1 hour

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
}

#[derive(Debug, Clone)]
struct VersionCache {
    version: String,
    timestamp: Instant,
}

static GITHUB_VERSION_CACHE: Lazy<Mutex<Option<VersionCache>>> = Lazy::new(|| Mutex::new(None));

#[derive(Serialize)]
pub struct VersionInfo {
    version: String,
    #[serde(rename = "installLocation")]
    install_location: String,
    #[serde(rename = "canAutoUpdate")]
    can_auto_update: bool,
}

#[derive(Serialize)]
pub struct VersionCompatibility {
    compatible: bool,
    #[serde(rename = "currentVersion")]
    current_version: String,
    #[serde(rename = "requiredVersion")]
    required_version: String,
    #[serde(rename = "updateAvailable")]
    update_available: bool,
    #[serde(rename = "latestVersion")]
    latest_version: Option<String>,
}

fn compare_versions(current: &str, required: &str) -> bool {
    match (Version::parse(current), Version::parse(required)) {
        (Ok(current_ver), Ok(required_ver)) => current_ver >= required_ver,
        (Err(e1), _) => {
            error!("Error parsing current version '{}': {}", current, e1);
            false
        }
        (_, Err(e2)) => {
            error!("Error parsing required version '{}': {}", required, e2);
            false
        }
    }
}

fn clean_version_string(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_digit(10) || *c == '.')
        .collect::<String>()
}

async fn fetch_latest_version() -> Option<String> {
    // Check cache first
    if let Ok(cache) = GITHUB_VERSION_CACHE.lock() {
        if let Some(cached) = cache.as_ref() {
            if cached.timestamp.elapsed() < GITHUB_CACHE_DURATION {
                return Some(cached.version.clone());
            }
        }
    }

    // Only fetch from GitHub if we don't have a valid cache
    debug!("Version cache miss, fetching from GitHub API");
    match reqwest::Client::new()
        .get(GITHUB_API_URL)
        .header("User-Agent", "BB-DUI/0.4.1")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
    {
        Ok(response) => {
            if response.status() == reqwest::StatusCode::FORBIDDEN {
                warn!("GitHub API rate limit exceeded");
                return None;
            }

            if !response.status().is_success() {
                error!(
                    "GitHub API error: {} - {}",
                    response.status(),
                    response
                        .status()
                        .canonical_reason()
                        .unwrap_or("Unknown error")
                );
                return None;
            }

            match response.json::<GithubRelease>().await {
                Ok(release) => {
                    let version = release.tag_name.trim_start_matches('v').to_string();
                    // Update cache
                    debug!("Successfully fetched latest version: {}", version);
                    if let Ok(mut cache) = GITHUB_VERSION_CACHE.lock() {
                        *cache = Some(VersionCache {
                            version: version.clone(),
                            timestamp: Instant::now(),
                        });
                    }
                    Some(version)
                }
                Err(e) => {
                    error!("Failed to parse GitHub API response: {}", e);
                    None
                }
            }
        }
        Err(e) => {
            error!("Failed to fetch latest release from GitHub: {}", e);
            None
        }
    }
}

fn get_min_version() -> String {
    let version_file = include_str!("../../../../version.ts");
    debug!("Parsing minimum version from version.ts");
    debug!("Version file contents:\n{}", version_file);

    for line in version_file.lines() {
        if line.contains("REQUIRED_API_VERSION") {
            if let Some(raw_version) = line.split('=').nth(1).map(|s| {
                // Remove all non-version characters
                let cleaned = s
                    .trim()
                    .trim_matches('"')
                    .trim_matches('\'')
                    .trim_matches(';')
                    .trim();

                // Further clean to ensure only digits and dots remain
                clean_version_string(cleaned)
            }) {
                // Validate that we have a proper semver string
                match Version::parse(&raw_version) {
                    Ok(_) => return raw_version,
                    Err(e) => error!(
                        "Invalid semver format after cleaning '{}': {}",
                        raw_version, e
                    ),
                }
            }
        }
    }

    warn!("Could not find REQUIRED_API_VERSION in version.ts, falling back to DUI version");

    env!("CARGO_PKG_VERSION").to_string() // Default to DUI version
}

#[command]
pub async fn get_version_info() -> Result<VersionInfo, String> {
    Ok(VersionInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        install_location: "user".to_string(),
        can_auto_update: false,
    })
}

#[command]
pub async fn get_binary_version() -> Result<Option<String>, String> {
    let bb_api_path = get_bb_api_path()?;
    debug!("Checking binary version at path: {:?}", bb_api_path);

    let output = Command::new(bb_api_path)
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    debug!("Binary version command output: {:?}", output);
    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let version_line = stdout
        .lines()
        .find(|line| line.trim().starts_with("BB API version "));

    match version_line {
        Some(line) => {
            let raw_version = line["BB API version ".len()..].trim().to_string();
            let cleaned_version = clean_version_string(&raw_version);

            match Version::parse(&cleaned_version) {
                Ok(_) => {
                    debug!("Successfully parsed binary version: {}", cleaned_version);
                    Ok(Some(cleaned_version))
                }
                Err(e) => {
                    error!(
                        "Failed to parse binary version '{}': {}",
                        cleaned_version, e
                    );
                    Ok(None)
                }
            }
        }
        None => {
            warn!("No valid version string found in output");
            Ok(None)
        }
    }
}

#[command]
pub async fn check_version_compatibility() -> Result<VersionCompatibility, String> {
    info!("Checking version compatibility");
    let api_version = get_binary_version().await?;
    let min_version = get_min_version();

    debug!(
        "Current API version: {:?}, minimum required version: {}",
        api_version, min_version
    );
    // First check if API is installed
    let api_installed = api_version.is_some();

    // Check compatibility with required version
    let compatible = if !api_installed {
        false
    } else {
        match api_version {
            Some(ref version) => compare_versions(version, &min_version),
            None => false,
        }
    };

    debug!(
        "API installed: {}, compatible with minimum version: {}",
        api_installed, compatible
    );
    // Only check GitHub if we're not compatible with required version
    let latest_version = if !compatible {
        None // Skip GitHub check if we already know we need to update
    } else {
        let latest = fetch_latest_version().await;
        debug!("Latest version from GitHub: {:?}", latest);
        latest
    };

    // Check if update is available
    // An update is available if either:
    // 1. The current version is below the required version, OR
    // 2. There's a newer version available on GitHub
    let update_available = if let Some(current) = api_version.as_ref() {
        let needs_min_update = match Version::parse(current) {
            Ok(current_ver) => match Version::parse(&min_version) {
                Ok(min_ver) => current_ver < min_ver,
                Err(_) => false,
            },
            Err(_) => false,
        };

        let needs_latest_update = if let Some(latest) = latest_version.as_ref() {
            match (Version::parse(current), Version::parse(latest)) {
                (Ok(current_ver), Ok(latest_ver)) => latest_ver > current_ver,
                _ => false,
            }
        } else {
            false
        };

        needs_min_update || needs_latest_update
    } else {
        false
    };

    // Clone min_version for use in both required_version and version comparison
    let min_version_clone = min_version.clone();

    Ok(VersionCompatibility {
        compatible,
        current_version: api_version.unwrap_or_else(|| "not installed".to_string()),
        required_version: min_version,
        update_available,
        latest_version: if update_available {
            Some(min_version_clone) // Always use required version when update needed
        } else {
            latest_version // Only show latest version when we're compatible but there's a newer version
        },
    })
}
