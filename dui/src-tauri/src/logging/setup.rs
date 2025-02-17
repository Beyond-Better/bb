use std::path::PathBuf;
use log4rs::Handle;

pub fn setup_app_logging(log_dir: PathBuf) -> std::io::Result<Handle> {
    // Copy config file to log directory if it doesn't exist
    let config_path = log_dir.join("log4rs.yaml");
    if !config_path.exists() {
        let mut config_content = include_str!("../../config/log4rs.yaml").to_string();
        
        // Replace the path placeholders with actual paths
        let app_log_path = log_dir.join("Beyond Better.log")
            .to_string_lossy()
            .to_string()
            .replace("\\", "\\\\");  // Escape backslashes for YAML
        let proxy_log_path = log_dir.join("proxy-access.log")
            .to_string_lossy()
            .to_string()
            .replace("\\", "\\\\");  // Escape backslashes for YAML
        
        config_content = config_content.replace(
            "path: \"Beyond Better.log\"",
            &format!("path: \"{}\"", app_log_path)
        );
        config_content = config_content.replace(
            "path: \"proxy-access.log\"",
            &format!("path: \"{}\"", proxy_log_path)
        );
        
        // Update the roller patterns with full paths
        config_content = config_content.replace(
            "pattern: \"Beyond Better.{}.log\"",
            &format!("pattern: \"{}.{{}}.log\"", log_dir.join("Beyond Better")
                .to_string_lossy()
                .to_string()
                .replace("\\", "\\\\"))
        );
        config_content = config_content.replace(
            "pattern: \"proxy-access.{}.log\"",
            &format!("pattern: \"{}.{{}}.log\"", log_dir.join("proxy-access")
                .to_string_lossy()
                .to_string()
                .replace("\\", "\\\\"))
        );
        
        std::fs::write(&config_path, config_content)?;
    }

    // Parse and initialize logging with the YAML config
    let config = log4rs::config::load_config_file(&config_path, Default::default())
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
    
    log4rs::init_config(config)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
}