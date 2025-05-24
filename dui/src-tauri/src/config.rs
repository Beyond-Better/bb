use dirs;
use log::{debug, error};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

pub const APP_NAME: &str = "dev.beyondbetter.app";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct TlsConfig {
    #[serde(default)]
    pub use_tls: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cert_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_ca_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_pem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cert_pem: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_ca_pem: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct LlmProviderConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct LlmProviders {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<LlmProviderConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct LlmKeys {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct ApiConfig {
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
    #[serde(default)]
    pub log_level: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_file: Option<String>,
    #[serde(default)]
    pub log_file_hydration: bool,
    #[serde(default)]
    pub ignore_llm_request_cache: bool,
    #[serde(default)]
    pub use_prompt_caching: bool,
    #[serde(rename = "supabaseConfigUrl")]
    #[serde(default)]
    pub supabase_config_url: String,
    #[serde(default)]
    pub max_turns: u32,
    #[serde(default)]
    pub user_tool_directories: Vec<String>,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub tool_configs: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(default)]
    pub local_mode: bool,
    #[serde(default)]
    pub llm_providers: LlmProviders,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct BuiConfig {
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
    #[serde(default)]
    pub log_level: String,
    #[serde(rename = "kvSessionPath")]
    #[serde(default)]
    pub kv_session_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(default)]
    pub local_mode: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct DuiConfig {
    #[serde(default)]
    pub debug_mode: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(rename = "defaultApiConfig")]
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub default_api_config: serde_json::Value,
    #[serde(rename = "projectsDirectory")]
    #[serde(default)]
    pub projects_directory: String,
    #[serde(rename = "recentProjects")]
    #[serde(default)]
    pub recent_projects: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct CliConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_editor: Option<String>,
    #[serde(default)]
    pub history_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct DefaultModels {
    pub orchestrator: String,
    pub agent: String,
    pub chat: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct GlobalConfig {
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub my_persons_name: String,
    #[serde(default)]
    pub my_assistants_name: String,
    #[serde(default)]
    pub default_models: DefaultModels,
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
    #[serde(default)]
    pub bb_exe_name: String,
    #[serde(rename = "bbApiExeName")]
    #[serde(default)]
    pub bb_api_exe_name: String,
    #[serde(rename = "bbBuiExeName")]
    #[serde(default)]
    pub bb_bui_exe_name: String,
}

impl Default for TlsConfig {
    fn default() -> Self {
        TlsConfig {
            use_tls: false,
            key_file: None,
            cert_file: None,
            root_ca_file: None,
            key_pem: None,
            cert_pem: None,
            root_ca_pem: None,
        }
    }
}

impl Default for LlmProviderConfig {
    fn default() -> Self {
        LlmProviderConfig { api_key: None }
    }
}

impl Default for LlmProviders {
    fn default() -> Self {
        LlmProviders { anthropic: None }
    }
}

impl Default for LlmKeys {
    fn default() -> Self {
        LlmKeys { anthropic: None }
    }
}

impl Default for ApiConfig {
    fn default() -> Self {
        ApiConfig {
            hostname: "localhost".to_string(),
            port: 3162,
            tls: TlsConfig::default(),
            log_level: "info".to_string(),
            log_file: get_default_log_path("api.log"),
            log_file_hydration: false,
            ignore_llm_request_cache: false,
            use_prompt_caching: true,
            supabase_config_url: "https://www.beyondbetter.dev/api/v1/config/supabase".to_string(),
            max_turns: 25,
            user_tool_directories: vec!["./tools".to_string()],
            tool_configs: serde_json::Value::Object(serde_json::Map::new()),
            environment: None,
            local_mode: false,
            llm_providers: LlmProviders::default(),
        }
    }
}

impl Default for BuiConfig {
    fn default() -> Self {
        BuiConfig {
            hostname: "localhost".to_string(),
            port: 8080,
            tls: TlsConfig::default(),
            log_level: "info".to_string(),
            log_file: get_default_log_path("bui.log"),
            kv_session_path: "auth.kv".to_string(),
            environment: None,
            local_mode: false,
        }
    }
}

impl Default for DuiConfig {
    fn default() -> Self {
        DuiConfig {
            debug_mode: false,
            environment: None,
            default_api_config: serde_json::Value::Object(serde_json::Map::new()),
            projects_directory: "./projects".to_string(),
            recent_projects: 5,
        }
    }
}

impl Default for CliConfig {
    fn default() -> Self {
        CliConfig {
            environment: None,
            default_editor: None,
            history_size: 1000,
        }
    }
}

impl Default for DefaultModels {
    fn default() -> Self {
        DefaultModels {
            orchestrator: "claude-3-7-sonnet-20250219".to_string(),
            agent: "claude-3-7-sonnet-20250219".to_string(),
            chat: "claude-3-haiku-20240307".to_string(),
        }
    }
}

impl Default for GlobalConfig {
    fn default() -> Self {
        GlobalConfig {
            version: "2.2.0".to_string(),
            my_persons_name: std::env::var("USER").unwrap_or_else(|_| "User".to_string()),
            my_assistants_name: "Claude".to_string(),
            default_models: DefaultModels::default(),
            no_browser: false,
            api: ApiConfig::default(),
            bui: BuiConfig::default(),
            cli: CliConfig::default(),
            dui: DuiConfig::default(),
            bb_exe_name: if cfg!(target_os = "windows") {
                "bb.exe".to_string()
            } else {
                "bb".to_string()
            },
            bb_api_exe_name: if cfg!(target_os = "windows") {
                "bb-api.exe".to_string()
            } else {
                "bb-api".to_string()
            },
            bb_bui_exe_name: if cfg!(target_os = "windows") {
                "bb-bui.exe".to_string()
            } else {
                "bb-bui".to_string()
            },
        }
    }
}

pub fn get_default_log_path(filename: &str) -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir().map(|home| {
            home.join("Library")
                .join("Logs")
                .join(APP_NAME)
                .join(filename)
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
                .join(filename)
                .to_string_lossy()
                .into_owned()
        })
    }

    #[cfg(target_os = "linux")]
    {
        dirs::home_dir().map(|home| {
            home.join(".bb")
                .join("logs")
                .join(filename)
                .to_string_lossy()
                .into_owned()
        })
    }
}

pub fn get_global_config_dir() -> Result<PathBuf, std::io::Error> {
    let config_dir = if cfg!(target_os = "windows") {
        dirs::config_dir()
            .ok_or_else(|| {
                let err = std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Could not find AppData directory",
                );
                error!("AppData directory not found");
                err
            })?
            .join("bb")
    } else {
        dirs::home_dir()
            .ok_or_else(|| {
                let err = std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Could not find home directory",
                );
                error!("Home directory not found");
                err
            })?
            .join(".config")
            .join("bb")
    };
    debug!("Config directory path: {:?}", config_dir);
    Ok(config_dir)
}

pub fn read_global_config() -> Result<GlobalConfig, Box<dyn std::error::Error>> {
    let config_dir = get_global_config_dir()?;
    let config_path = config_dir.join("config.yaml");

    if !config_dir.exists() {
        debug!("Config directory does not exist: {:?}", config_dir);
        fs::create_dir_all(&config_dir).map_err(|e| {
            error!("Failed to create config directory: {}", e);
            e
        })?;
    }

    match fs::read_to_string(&config_path) {
        Ok(contents) => match serde_yaml::from_str(&contents) {
            Ok(config) => Ok(config),
            Err(e) => {
                error!("Failed to parse config YAML: {}", e);
                Err(Box::new(e))
            }
        },
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
pub fn get_dui_debug_mode() -> bool {
    match read_global_config() {
        Ok(config) => config.dui.debug_mode,
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn set_dui_debug_mode(debug_mode: bool) -> Result<(), String> {
    let config_dir = get_global_config_dir().map_err(|e| e.to_string())?;
    let config_path = config_dir.join("config.yaml");

    let mut config = read_global_config().map_err(|e| e.to_string())?;
    config.dui.debug_mode = debug_mode;

    let yaml = serde_yaml::to_string(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, yaml).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_api_config() -> Result<ApiConfig, String> {
    match read_global_config() {
        Ok(config) => Ok(config.api),
        Err(e) => {
            error!("Failed to read config for API config: {}", e);
            Err(format!("Failed to read config: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_bui_config() -> Result<BuiConfig, String> {
    match read_global_config() {
        Ok(config) => Ok(config.bui),
        Err(e) => {
            error!("Failed to read config for BUI config: {}", e);
            Err(format!("Failed to read config: {}", e))
        }
    }
}
