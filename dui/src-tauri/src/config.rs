use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use dirs;
use log::{debug, error};


pub const APP_NAME: &str = "dev.beyondbetter.app";

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct TlsConfig {
    #[serde(default)]
    pub use_tls: bool,
    pub key_file: Option<String>,
    pub cert_file: Option<String>,
    pub root_ca_file: Option<String>,
    pub key_pem: Option<String>,
    pub cert_pem: Option<String>,
    pub root_ca_pem: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct ApiConfig {
    #[serde(default = "default_hostname")]
    pub hostname: String,
    #[serde(default = "default_api_port")]
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
    #[serde(rename(serialize = "maxTurns", deserialize = "maxTurns"))]
    #[serde(default = "default_max_turns")]
    pub max_turns: u32,
    #[serde(default = "default_log_level")]
    pub log_level: String,
    #[serde(default = "default_log_file")]
    pub log_file: Option<String>,
    #[serde(default)]
    pub log_file_hydration: bool,
    #[serde(default)]
    pub ignore_llm_request_cache: bool,
    #[serde(default = "default_use_prompt_caching")]
    pub use_prompt_caching: bool,
    #[serde(default = "default_tool_directories")]
    pub user_tool_directories: Vec<String>,
    #[serde(default)]
    pub tool_configs: serde_json::Value,
    #[serde(rename(serialize = "llmKeys", deserialize = "llmKeys"))]
    pub llm_keys: Option<LlmKeys>,
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct LlmKeys {
    pub anthropic: Option<String>,
    pub openai: Option<String>,
    pub voyageai: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct BuiConfig {
    #[serde(default = "default_hostname")]
    pub hostname: String,
    #[serde(default = "default_bui_port")]
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct DuiConfig {
    pub environment: Option<String>,
    #[serde(rename = "defaultApiConfig")]
    #[serde(default)]
    pub default_api_config: serde_json::Value,
    #[serde(rename = "projectsDirectory")]
    #[serde(default = "default_projects_directory")]
    pub projects_directory: String,
    #[serde(rename = "recentProjects")]
    #[serde(default = "default_recent_projects")]
    pub recent_projects: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct CliConfig {
    pub environment: Option<String>,
    pub default_editor: Option<String>,
    #[serde(default = "default_history_size")]
    pub history_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct GlobalConfig {
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(rename(serialize = "myPersonsName", deserialize = "myPersonsName"))]
    #[serde(default = "default_persons_name")]
    pub my_persons_name: String,
    #[serde(rename(serialize = "myAssistantsName", deserialize = "myAssistantsName"))]
    #[serde(default = "default_assistants_name")]
    pub my_assistants_name: String,
    #[serde(rename = "noBrowser")]
    #[serde(default)]
    pub no_browser: bool,
    #[serde(default)]
    pub api: ApiConfig,
    #[serde(default)]
    pub bui: BuiConfig,
    #[serde(default)]
    pub cli: CliConfig,
    #[serde(default)]
    pub dui: DuiConfig,
    #[serde(rename = "bbExeName")]
    #[serde(default = "default_bb_exe_name")]
    pub bb_exe_name: String,
    #[serde(rename = "bbApiExeName")]
    #[serde(default = "default_bb_api_exe_name")]
    pub bb_api_exe_name: String,
}

// Default value functions
fn default_hostname() -> String {
    "localhost".to_string()
}

fn default_api_port() -> u16 {
    3162
}

fn default_bui_port() -> u16 {
    8000
}

fn default_max_turns() -> u32 {
    25
}

fn default_log_level() -> String {
    "info".to_string()
}

fn default_log_file() -> Option<String> {
    get_default_log_path()
}

fn default_use_prompt_caching() -> bool {
    true
}

fn default_tool_directories() -> Vec<String> {
    vec!["./tools".to_string()]
}

fn default_projects_directory() -> String {
    "./projects".to_string()
}

fn default_recent_projects() -> u32 {
    5
}

fn default_history_size() -> u32 {
    1000
}

fn default_version() -> String {
    "2.0.0".to_string()
}

fn default_persons_name() -> String {
    std::env::var("USER").unwrap_or_else(|_| "User".to_string())
}

fn default_assistants_name() -> String {
    "Claude".to_string()
}

fn default_bb_exe_name() -> String {
    if cfg!(target_os = "windows") {
        "bb.exe".to_string()
    } else {
        "bb".to_string()
    }
}

fn default_bb_api_exe_name() -> String {
    if cfg!(target_os = "windows") {
        "bb-api.exe".to_string()
    } else {
        "bb-api".to_string()
    }
}

pub fn get_default_log_path() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Logs")
                .join(APP_NAME)
                .join("api.log")
                .to_string_lossy()
                .into_owned()
        })
    }

    #[cfg(target_os = "windows")]
    {
        std::env::var("ProgramData").ok().map(|program_data| {
            PathBuf::from(program_data)
                .join(APP_NAME)
                .join("logs")
                .join("api.log")
                .to_string_lossy()
                .into_owned()
        })
    }

    #[cfg(target_os = "linux")]
    {
        Some(format!("/var/log/{}/api.log", APP_NAME.to_lowercase()))
    }
}

pub fn get_global_config_dir() -> Result<PathBuf, std::io::Error> {
    let home_dir = dirs::home_dir().ok_or_else(|| {
        let err = std::io::Error::new(std::io::ErrorKind::NotFound, "Could not find home directory");
        error!("Home directory not found");
        err
    })?;
    let config_dir = home_dir.join(".config").join("bb");
    debug!("Config directory path: {:?}", config_dir);
    Ok(config_dir)
}

pub fn read_global_config() -> Result<GlobalConfig, Box<dyn std::error::Error>> {
    let config_dir = get_global_config_dir()?;
    let config_path = config_dir.join("config.yaml");
    //debug!("Attempting to read config from: {:?}", config_path);
    
    // Check if config directory exists
    if !config_dir.exists() {
        debug!("Config directory does not exist: {:?}", config_dir);
        fs::create_dir_all(&config_dir).map_err(|e| {
            error!("Failed to create config directory: {}", e);
            e
        })?;
    }
    
    // Try to read the config file
    match fs::read_to_string(&config_path) {
        Ok(contents) => {
            //debug!("Successfully read config file, contents:\n{}", contents);
            match serde_yaml::from_str(&contents) {
                Ok(config) => {
                    //debug!("Successfully parsed config: {:?}", config);
                    Ok(config)
                }
                Err(e) => {
                    error!("Failed to parse config YAML: {}", e);
                    Err(Box::new(e))
                }
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            debug!("Config file not found, using defaults");
            Ok(GlobalConfig::default())
        }
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            error!("Permission denied reading config file: {:?}", config_path);
            Err(Box::new(e))
        }
        Err(e) => {
            error!("Failed to read config file: {}", e);
            Err(Box::new(e))
        }
    }
}

#[tauri::command]
pub async fn get_api_config() -> Result<ApiConfig, String> {
    match read_global_config() {
        Ok(config) => {
            //debug!("Returning API config with max_turns: {}", config.api.max_turns);
            Ok(config.api)
        },
        Err(e) => {
            error!("Failed to read config for API config: {}", e);
            Err(format!("Failed to read config: {}", e))
        }
    }
}