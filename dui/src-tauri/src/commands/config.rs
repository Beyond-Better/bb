use std::fs;
use serde_yaml;
use log::{error, info};

use crate::config::{GlobalConfig, LlmProviderConfig, get_global_config_dir, read_global_config, get_default_log_path};

#[tauri::command]
pub async fn get_log_path(filename: &str) -> Result<Option<String>, String> {
    Ok(get_default_log_path(filename))
}

#[tauri::command]
pub async fn get_api_log_path() -> Result<String, String> {
    let config = read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    
    // Get the log path using the API function
    let path = crate::api::get_api_log_path(&config.api)
        .ok_or_else(|| "Failed to determine API log path".to_string())?;
    
    // Convert to string, handling any non-UTF8 characters
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_bui_log_path() -> Result<String, String> {
    let config = read_global_config().map_err(|e| format!("Failed to read config: {}", e))?;
    
    // Get the log path using the BUI function
    let path = crate::bui::get_bui_log_path(&config.bui)
        .ok_or_else(|| "Failed to determine BUI log path".to_string())?;
    
    // Convert to string, handling any non-UTF8 characters
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn test_read_config() -> Result<String, String> {
    let config_dir = get_global_config_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.yaml");
    
    match fs::read_to_string(&config_path) {
        Ok(contents) => {
            Ok(contents)
        },
        Err(e) => {
            error!("Error reading config: {}", e);
            Err(format!("Failed to read config file: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_global_config() -> Result<GlobalConfig, String> {
    // Get config directory path
    let config_dir = get_global_config_dir().map_err(|e| {
        error!("Failed to get config directory: {}", e);
        e.to_string()
    })?;
    let config_path = config_dir.join("config.yaml");

    // Read and parse config
    let mut config = match fs::read_to_string(&config_path) {
        Ok(contents) => {
            match serde_yaml::from_str::<GlobalConfig>(&contents) {
                Ok(config) => {
                    config
                },
                Err(e) => {
                    error!("Failed to parse config YAML: {}", e);
                    return Err(format!("Failed to parse config: {}", e));
                }
            }
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                info!("Config file not found, using defaults");
                GlobalConfig::default()
            } else {
                error!("Failed to read config file: {}", e);
                return Err(format!("Failed to read config: {}", e));
            }
        }
    };

    // Set the log file path if it's not already set
    if config.api.log_file.is_none() {
        config.api.log_file = get_default_log_path("api.log");
        info!("Setting default log path: {:?}", config.api.log_file);
    }
    if config.bui.log_file.is_none() {
        config.bui.log_file = get_default_log_path("bui.log");
        info!("Setting default log path: {:?}", config.bui.log_file);
    }
    
    // Create a redacted copy for the frontend
    let mut redacted = config.clone();
    
    // Mask the Anthropic API key if it exists and is not empty
    if let Some(ref provider) = redacted.api.llm_providers.anthropic {
        if let Some(ref key) = provider.api_key {
            if !key.is_empty() {
                redacted.api.llm_providers.anthropic = Some(LlmProviderConfig {
                    api_key: Some(format!("{}...", &key[..18.min(key.len())]))
                });
            }
        }
    }
    
    Ok(redacted)
}

#[tauri::command]
pub async fn set_global_config_value(key: String, value: String) -> Result<(), String> {
    //info!("Setting config value - Key: {}, Value: {}", key, value);
    info!("Setting config value - Key: {}, Value: {}", key, if key.contains("api_key") || key.contains("apiKey") {
        "[REDACTED]".to_string()
    } else {
        value.clone()
    });

    // Read current config
    let mut config = read_global_config().map_err(|e| {
        error!("Failed to read config for update: {}", e);
        e.to_string()
    })?;
    
    // Update the value using the dot notation key
    update_config_value(&mut config, &key, &value).map_err(|e| {
        error!("Failed to update config value: {}", e);
        e.to_string()
    })?;
    
    // Write updated config
    let config_dir = get_global_config_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.yaml");
    
    // Ensure config directory exists
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    // Read existing YAML file or create empty map if it doesn't exist
    let mut yaml_value = if config_path.exists() {
        let contents = fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read existing config: {}", e))?;
        serde_yaml::from_str::<serde_yaml::Value>(&contents)
            .map_err(|e| format!("Failed to parse existing config: {}", e))?
    } else {
        serde_yaml::Value::Mapping(serde_yaml::Mapping::new())
    };

    // Update only the specific value using the dot notation path
    update_yaml_value(&mut yaml_value, &key, &value)?;

    // Convert to YAML string
    let yaml_str = serde_yaml::to_string(&yaml_value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    // Write to file
    fs::write(&config_path, &yaml_str)
        .map_err(|e| format!("Failed to write config file: {}", e))?;

    Ok(())
}

fn update_yaml_value(root: &mut serde_yaml::Value, key: &str, value: &str) -> Result<(), String> {
    // Split the key path and convert to camelCase
    let mut path_parts: Vec<String> = Vec::new();
    for part in key.split('.') {
        if part.contains('_') {
            let mut camel = String::new();
            let mut capitalize = false;
            for c in part.chars() {
                if c == '_' {
                    capitalize = true;
                } else if capitalize {
                    camel.push(c.to_ascii_uppercase());
                    capitalize = false;
                } else {
                    camel.push(c);
                }
            }
            path_parts.push(camel);
        } else {
            path_parts.push(part.to_string());
        }
    }

    // Navigate the YAML tree, creating nodes as needed
    let mut current = root;
    for (i, part) in path_parts.iter().enumerate() {
        if i == path_parts.len() - 1 {
            // We're at the final part - set the value
            let mapping = if !current.is_mapping() {
                *current = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
                current.as_mapping_mut().unwrap()
            } else {
                current.as_mapping_mut().unwrap()
            };

            // Set the value based on the key type
            match key {
                "api.logFile" | "bui.logFile" => {
                    mapping.insert(
                        serde_yaml::Value::String(part.clone()),
                        serde_yaml::Value::String(value.to_string())
                    );
                },
                "api.tls.useTls" | "api.localMode" | "bui.tls.useTls" | "bui.localMode" => {
                    if let Ok(bool_value) = value.parse::<bool>() {
                        mapping.insert(
                            serde_yaml::Value::String(part.clone()),
                            serde_yaml::Value::Bool(bool_value)
                        );
                    } else {
                        return Err(format!("Invalid boolean value for {}", key));
                    }
                },
                "api.llmProviders.anthropic.apiKey" => {
                    // Only update if not masked
                    if !value.ends_with("...") {
                        mapping.insert(
                            serde_yaml::Value::String(part.clone()),
                            serde_yaml::Value::String(value.to_string())
                        );
                    }
                },
                _ => return Err(format!("Unknown config key: {}", key))
            };
        } else {
            // Not at final part - create/get the mapping
            let mapping = if !current.is_mapping() {
                *current = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());
                current.as_mapping_mut().unwrap()
            } else {
                current.as_mapping_mut().unwrap()
            };
            current = mapping.entry(serde_yaml::Value::String(part.clone()))
                .or_insert(serde_yaml::Value::Mapping(serde_yaml::Mapping::new()));
        }
    }

    Ok(())
}

fn update_config_value(config: &mut GlobalConfig, key: &str, value: &str) -> Result<(), String> {
    let parts: Vec<&str> = key.split('.').collect();
    
    match parts.as_slice() {
        ["api", "logFile"] => {
            config.api.log_file = Some(value.to_string());
        },
        ["api", "tls", "useTls"] => {
            let use_tls = value.parse::<bool>().map_err(|_| "Invalid boolean for useTls".to_string())?;
            config.api.tls.use_tls = use_tls;
        },
        ["api", "localMode"] => {
            let local_mode = value.parse::<bool>().map_err(|_| "Invalid boolean for localMode".to_string())?;
            config.api.local_mode = local_mode;
        },
        ["api", "llmProviders", "anthropic", "apiKey"] => {
            // Only update if the value has changed (not masked)
            if !value.ends_with("...") {
                config.api.llm_providers.anthropic = Some(LlmProviderConfig {
                    api_key: Some(value.to_string())
                });
            }
        },
        ["bui", "logFile"] => {
            config.bui.log_file = Some(value.to_string());
        },
        ["bui", "tls", "useTls"] => {
            let use_tls = value.parse::<bool>().map_err(|_| "Invalid boolean for useTls".to_string())?;
            config.bui.tls.use_tls = use_tls;
        },
        ["bui", "localMode"] => {
            let local_mode = value.parse::<bool>().map_err(|_| "Invalid boolean for localMode".to_string())?;
            config.bui.local_mode = local_mode;
        },
        _ => {
            error!("Unknown config key: {}", key);
            return Err(format!("Unknown config key: {}", key));
        }
    }
    
    Ok(())
}