use std::fs;
use serde_yaml;
use log::{error, info};


use crate::config::{GlobalConfig, get_global_config_dir, read_global_config, LlmKeys, get_default_log_path};

#[tauri::command]
pub async fn get_log_path() -> Result<Option<String>, String> {
    Ok(get_default_log_path())
}

#[tauri::command]
pub async fn test_read_config() -> Result<String, String> {
    let config_dir = get_global_config_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.yaml");
    
    //info!("Reading config from: {:?}", config_path);
    match fs::read_to_string(&config_path) {
        Ok(contents) => {
            //info!("Raw config contents:\n{}", contents);
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
    //info!("Looking for config file at: {:?}", config_path);

    // Read and parse config
    let mut config = match fs::read_to_string(&config_path) {
        Ok(contents) => {
            //debug!("Raw config contents:\n{}", contents);
            match serde_yaml::from_str::<GlobalConfig>(&contents) {
                Ok(config) => {
                    //info!("Parsed config successfully: {:#?}", config);
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
        config.api.log_file = get_default_log_path();
        info!("Setting default log path: {:?}", config.api.log_file);
    }
    
    //info!("Config values:");
    // debug!("  my_persons_name: {}", config.my_persons_name);
    // debug!("  my_assistants_name: {}", config.my_assistants_name);
    // debug!("  api.max_turns: {}", config.api.max_turns);
    // debug!("  api.llm_keys.anthropic: {}", 
    //        config.api.llm_keys.as_ref()
    //        .and_then(|k| k.anthropic.as_ref())
    //        .map(|k| format!("{}...", &k[..18.min(k.len())]))
    //        .unwrap_or_else(|| "None".to_string()));
    
    // Log the parsed config details
    // info!("Parsed config details:");
    // info!("  Server Config: {:?}", config.api);
    // info!("  LLM Keys present: {}", config.api.llm_keys.is_some());
    //if let Some(ref keys) = config.api.llm_keys {
        // info!("  Anthropic key present: {}", keys.anthropic.is_some());
    //}

    // Create a redacted copy for the frontend
    let mut redacted = config.clone();
    // info!("Creating redacted copy for frontend");
    if let Some(ref mut keys) = redacted.api.llm_keys {
        if let Some(ref key) = keys.anthropic {
            if !key.is_empty() {
                //debug!("Masking Server key: {}...", &key[..18.min(key.len())]);
                keys.anthropic = Some(format!("{}...", &key[..18.min(key.len())]));
            }
        }
    }
    
    // Log the JSON that will be sent to frontend
    //match serde_json::to_string_pretty(&redacted) {
    //    Ok(json) => {
    //        //info!("Config JSON for frontend:\n{}", json);
    //    }
    //    Err(e) => {
    //        error!("Failed to serialize config to JSON: {}", e);
    //    }
    //}
    // Log the raw struct and serialized forms
    //info!("Raw redacted struct: {:#?}", redacted);
    //if let Ok(json) = serde_json::to_string_pretty(&redacted) {
        //info!("As JSON:\n{}", json);
    //}
    //if let Ok(yaml) = serde_yaml::to_string(&redacted) {
        //info!("As YAML:\n{}", yaml);
    //}
    //info!("Sending redacted config to frontend: {:?}", redacted);
    Ok(redacted)
}

#[tauri::command]
pub async fn set_global_config_value(key: String, value: String) -> Result<(), String> {

    info!("Setting config value - Key: {}, Value: {}", key, if key.contains("api_key") || key.contains("llmKeys") {
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
    
    //info!("Writing config to: {:?}", config_path);
    
    // Ensure config directory exists
    fs::create_dir_all(&config_dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    
    // Read existing YAML file or create empty map if it doesn't exist
    //info!("Reading existing YAML file from: {:?}", config_path);
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

    // Convert to YAML string and log
    let yaml_str = serde_yaml::to_string(&yaml_value)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    //debug!("Updated config contents:\n{}", yaml_str);
    //info!("Final YAML content to write:\n{}", yaml_str);
    
    // Write to file
    fs::write(&config_path, &yaml_str)
        .map_err(|e| format!("Failed to write config file: {}", e))?;
    
    //info!("Config updated successfully");
    //info!("Final YAML structure: {:#?}", yaml_value);
    // Log final state
    //if let Ok(final_state) = serde_yaml::to_string(&yaml_value) {
        //info!("Final YAML state:\n{}", final_state);
    //}

    // Log final state after update
    //if let Ok(final_state) = serde_yaml::to_string(&yaml_value) {
        //info!("Final YAML state after update:\n{}", final_state);
    //}


    Ok(())
}



fn update_yaml_value(root: &mut serde_yaml::Value, key: &str, value: &str) -> Result<(), String> {
    // Log the operation
    // info!("Updating YAML - Key: {}, Value: {}", 
    //     key,
    //     if key.contains("llmKeys") { "[REDACTED]" } else { value }
    // );

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
            //info!("Converting {} to {}", part, camel);
            path_parts.push(camel);
        } else {
            path_parts.push(part.to_string());
        }
    }
    //info!("Path parts: {:?}", path_parts);

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
                "myPersonsName" | "myAssistantsName" => {
                    mapping.insert(
                        serde_yaml::Value::String(part.clone()),
                        serde_yaml::Value::String(value.to_string())
                    );
                }
                "api.maxTurns" => {
                    if let Ok(num) = value.parse::<i64>() {
                        mapping.insert(
                            serde_yaml::Value::String(part.clone()),
                            serde_yaml::Value::Number(num.into())
                        );
                    } else {
                        return Err("Invalid number for maxTurns".to_string());
                    }
                }
                "api.llmKeys.anthropic" => {
                    // Only update if not masked
                    if !value.ends_with("...") {
                        mapping.insert(
                            serde_yaml::Value::String(part.clone()),
                            serde_yaml::Value::String(value.to_string())
                        );
                    }
                }
                "api.logFile" => {
                    mapping.insert(
                        serde_yaml::Value::String(part.clone()),
                        serde_yaml::Value::String(value.to_string())
                    );
                },
                "api.tls.useTls" => {
                    if let Ok(use_tls) = value.parse::<bool>() {
                        mapping.insert(
                            serde_yaml::Value::String(part.clone()),
                            serde_yaml::Value::Bool(use_tls)
                        );
                    } else {
                        return Err("Invalid boolean for useTls".to_string());
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
    
    //debug!("Updating config value: path={:?}, value={}", parts, value);
    
    match parts.as_slice() {
        ["myPersonsName"] => {
            config.my_persons_name = value.to_string();
            //debug!("Updated myPersonsName to: {}", value);
        },
        ["myAssistantsName"] => {
            config.my_assistants_name = value.to_string();
            //debug!("Updated myAssistantsName to: {}", value);
        },
        ["api", "maxTurns"] => {
            let turns = value.parse().map_err(|_| "Invalid number for maxTurns".to_string())?;
            config.api.max_turns = turns;
            //debug!("Updated maxTurns to: {}", turns);
        },
        ["api", "llmKeys", "anthropic"] => {
            // Only update if the value has changed (not masked)
            if !value.ends_with("...") {
                //debug!("Updating Anthropic API key");
                if config.api.llm_keys.is_none() {
                    config.api.llm_keys = Some(LlmKeys::default());
                }
                if let Some(ref mut keys) = config.api.llm_keys {
                    keys.anthropic = Some(value.to_string());
                }
                //debug!("API key updated successfully");
            } else {
                //debug!("Skipping masked API key update");
            }
        },
        ["api", "logFile"] => {
            config.api.log_file = Some(value.to_string());
            //debug!("Updated logFile to: {}", value);
        },
        ["api", "tls", "useTls"] => {
            let use_tls = value.parse::<bool>().map_err(|_| "Invalid boolean for useTls".to_string())?;
            config.api.tls.use_tls = use_tls;
            //debug!("Updated api.tls.useTls to: {}", use_tls);
        },
        _ => {
            error!("Unknown config key: {}", key);
            return Err(format!("Unknown config key: {}", key));
        }
    }
    
    Ok(())
}