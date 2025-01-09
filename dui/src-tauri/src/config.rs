use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use dirs;
use log::{debug, error};


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
pub struct ApiConfig {
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub tls: TlsConfig,
    #[serde(rename(serialize = "maxTurns", deserialize = "maxTurns"))]
    #[serde(default)]
    pub max_turns: u32,
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
    #[serde(default)]
    pub user_tool_directories: Vec<String>,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub tool_configs: serde_json::Value,
    #[serde(rename(serialize = "llmKeys", deserialize = "llmKeys"))]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub llm_keys: Option<LlmKeys>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct LlmKeys {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub anthropic: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub openai: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voyageai: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub environment: Option<String>,
	// #[serde(rename = "supabaseUrl")]
	// pub supabase_url: String,
	// #[serde(rename = "supabaseAnonKey")]
	// pub supabase_anon_key: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all(serialize = "camelCase", deserialize = "camelCase"))]
pub struct DuiConfig {
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
pub struct GlobalConfig {
    #[serde(default)]
    pub version: String,
    #[serde(rename(serialize = "myPersonsName", deserialize = "myPersonsName"))]
    #[serde(default)]
    pub my_persons_name: String,
    #[serde(rename(serialize = "myAssistantsName", deserialize = "myAssistantsName"))]
    #[serde(default)]
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
    #[serde(default)]
    pub bb_exe_name: String,
    #[serde(rename = "bbApiExeName")]
    #[serde(default)]
    pub bb_api_exe_name: String,
    #[serde(rename = "bbBuiExeName")]
    #[serde(default)]
    pub bb_bui_exe_name: String,
}

// Platform-specific log path helper


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

impl Default for ApiConfig {
    fn default() -> Self {
        ApiConfig {
            hostname: "localhost".to_string(),  // Hardcode to match TypeScript default
            port: 3162,
            tls: TlsConfig::default(),  // Will have useTls: false by default
            max_turns: 25,
            log_level: "info".to_string(),
            log_file: get_default_log_path("api.log"),  // Platform-specific log path
            log_file_hydration: false,
            ignore_llm_request_cache: false,
            use_prompt_caching: true,
            user_tool_directories: vec!["./tools".to_string()],
            tool_configs: serde_json::Value::Object(serde_json::Map::new()),
            llm_keys: None,
            environment: None,
        }
    }
}

impl Default for BuiConfig {
    fn default() -> Self {
        //let mut tls = TlsConfig::default();
        //tls.use_tls = true;  // BUI uses TLS by default
        BuiConfig {
            hostname: "localhost".to_string(),
            port: 8080,  // Default BUI port
            tls: TlsConfig::default(),  // Will have useTls: false by default
            log_level: "info".to_string(),
            log_file: get_default_log_path("bui.log"),  // Platform-specific log path
			// supabase_url: "https://asyagnmzoxgyhqprdaky.supabase.co".to_string(),
			// supabase_anon_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzeWFnbm16b3hneWhxcHJkYWt5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzMzAxMTQsImV4cCI6MjA1MTkwNjExNH0.sgTu1ig0B5O946KRqix4wV-nUrv3ktNrI1ulOabXxmw".to_string(),
            environment: None,
        }
    }
}

impl Default for DuiConfig {
    fn default() -> Self {
        DuiConfig {
            environment: None,
            default_api_config: serde_json::Value::Object(serde_json::Map::new()),
            projects_directory: "./projects".to_string(),  // Match TypeScript default
            recent_projects: 5,  // Match TypeScript default
        }
    }
}

impl Default for CliConfig {
    fn default() -> Self {
        CliConfig {
            environment: None,
            default_editor: None,
            history_size: 1000,  // Match TypeScript default
        }
    }
}

impl Default for GlobalConfig {
    fn default() -> Self {
        GlobalConfig {
            version: "2.0.0".to_string(),  // Match TypeScript default
            my_persons_name: std::env::var("USER").unwrap_or_else(|_| "User".to_string()),
            my_assistants_name: "Claude".to_string(),
            no_browser: false,
            api: ApiConfig::default(),
            bui: BuiConfig::default(),
            cli: CliConfig::default(),
            dui: DuiConfig::default(),
            bb_exe_name: if cfg!(target_os = "windows") { "bb.exe".to_string() } else { "bb".to_string() },
            bb_api_exe_name: if cfg!(target_os = "windows") { "bb-api.exe".to_string() } else { "bb-api".to_string() },
            bb_bui_exe_name: if cfg!(target_os = "windows") { "bb-bui.exe".to_string() } else { "bb-bui".to_string() },
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
        Some(format!("/var/log/{}/{}", APP_NAME.to_lowercase(), filename))
    }
}

pub fn get_global_config_dir() -> Result<PathBuf, std::io::Error> {
    let config_dir = if cfg!(target_os = "windows") {
        // On Windows, use %APPDATA%\bb
        dirs::config_dir().ok_or_else(|| {
            let err = std::io::Error::new(std::io::ErrorKind::NotFound, "Could not find AppData directory");
            error!("AppData directory not found");
            err
        })?.join("bb")
    } else {
        // On Unix systems (Linux/macOS), use ~/.config/bb
        dirs::home_dir().ok_or_else(|| {
            let err = std::io::Error::new(std::io::ErrorKind::NotFound, "Could not find home directory");
            error!("Home directory not found");
            err
        })?.join(".config").join("bb")
    };
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
            Ok(config.api)
        },
        Err(e) => {
            error!("Failed to read config for API config: {}", e);
            Err(format!("Failed to read config: {}", e))
        }
    }
}

#[tauri::command]
pub async fn get_bui_config() -> Result<BuiConfig, String> {
    match read_global_config() {
        Ok(config) => {
            Ok(config.bui)
        },
        Err(e) => {
            error!("Failed to read config for BUI config: {}", e);
            Err(format!("Failed to read config: {}", e))
        }
    }
}
