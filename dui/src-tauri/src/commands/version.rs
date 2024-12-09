// This file contains core version checking functionality.
// Installation/upgrade functionality has been moved to commands/upgrade.rs

use tauri::command;
use std::process::Command;
use serde::{Deserialize, Serialize};
use semver::Version;
use reqwest;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use once_cell::sync::Lazy;

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
            println!("[compare_versions] Error parsing current version: {}", e1);
            false
        },
        (_, Err(e2)) => {
            println!("[compare_versions] Error parsing required version: {}", e2);
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
    println!("[fetch_latest_version] Cache miss, fetching from GitHub");
    match reqwest::Client::new()
        .get(GITHUB_API_URL)
        .header("User-Agent", "BB-DUI/0.4.1")
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await {
            Ok(response) => {
                if response.status() == reqwest::StatusCode::FORBIDDEN {
                    println!("[fetch_latest_version] GitHub rate limit exceeded");
                    return None;
                }
                
                if !response.status().is_success() {
                    println!("[fetch_latest_version] GitHub API error: {}", response.status());
                    return None;
                }

                match response.json::<GithubRelease>().await {
                    Ok(release) => {
                        let version = release.tag_name.trim_start_matches('v').to_string();
                        // Update cache
                        if let Ok(mut cache) = GITHUB_VERSION_CACHE.lock() {
                            *cache = Some(VersionCache {
                                version: version.clone(),
                                timestamp: Instant::now(),
                            });
                        }
                        Some(version)
                    },
                    Err(e) => {
                        println!("[fetch_latest_version] Failed to parse GitHub response: {}", e);
                        None
                    }
                }
            },
            Err(e) => {
                println!("[fetch_latest_version] Failed to fetch latest release: {}", e);
                None
            }
        }
}

fn get_min_version() -> String {
    let version_file = include_str!("../../../../version.ts");
    
    for line in version_file.lines() {
        if line.contains("REQUIRED_API_VERSION") {
            if let Some(raw_version) = line
                .split('=')
                .nth(1)
                .map(|s| {
                    // Remove all non-version characters
                    let cleaned = s.trim()
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
                    Err(e) => println!("[get_min_version] Invalid semver format after cleaning: {}", e)
                }
            }
        }
    }
    
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
    let output = Command::new("bb-api")
        .arg("--version")
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Ok(None);
    }

    let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    
    if version_str.starts_with("BB API version ") {
        let raw_version = version_str["BB API version ".len()..].trim().to_string();
        let cleaned_version = clean_version_string(&raw_version);
        
        match Version::parse(&cleaned_version) {
            Ok(_) => Ok(Some(cleaned_version)),
            Err(_) => Ok(None)
        }
    } else {
        Ok(None)
    }
}

#[command]
pub async fn check_version_compatibility() -> Result<VersionCompatibility, String> {
    let api_version = get_binary_version().await?;
    let min_version = get_min_version();

    // First check if API is installed
    let api_installed = api_version.is_some();

    // Check compatibility with required version
    let compatible = if !api_installed {
        false
    } else {
        match api_version {
            Some(ref version) => compare_versions(version, &min_version),
            None => false
        }
    };

    // Only check GitHub if we're not compatible with required version
    let latest_version = if !compatible {
        None // Skip GitHub check if we already know we need to update
    } else {
        fetch_latest_version().await
    };

    // Check if update is available
    // An update is available if either:
    // 1. The current version is below the required version, OR
    // 2. There's a newer version available on GitHub
    let update_available = if let Some(current) = api_version.as_ref() {
        let needs_min_update = match Version::parse(current) {
            Ok(current_ver) => {
                match Version::parse(&min_version) {
                    Ok(min_ver) => current_ver < min_ver,
                    Err(_) => false
                }
            },
            Err(_) => false
        };

        let needs_latest_update = if let Some(latest) = latest_version.as_ref() {
            match (Version::parse(current), Version::parse(latest)) {
                (Ok(current_ver), Ok(latest_ver)) => latest_ver > current_ver,
                _ => false
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