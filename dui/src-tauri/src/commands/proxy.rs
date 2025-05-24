use crate::proxy::HttpProxy;
use log::{debug, info};
use std::sync::Arc;
use tokio::sync::RwLock;

#[tauri::command]
pub async fn get_proxy_info(
    state: tauri::State<'_, Arc<RwLock<HttpProxy>>>,
) -> Result<crate::proxy::ProxyInfo, String> {
    debug!("get_proxy_info command invoked");
    let proxy = state.read().await;
    let target = proxy.target_url.read().await.clone();
    let is_running = proxy.is_running().await;

    Ok(crate::proxy::ProxyInfo {
        port: proxy.port,
        target,
        is_running,
    })
}

#[tauri::command]
pub async fn start_proxy_server(
    state: tauri::State<'_, Arc<RwLock<HttpProxy>>>,
) -> Result<(), String> {
    debug!("start_proxy_server command invoked");
    let proxy = state.read().await;
    proxy.start().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_proxy_server(
    state: tauri::State<'_, Arc<RwLock<HttpProxy>>>,
) -> Result<(), String> {
    debug!("stop_proxy_server command invoked");
    let proxy = state.read().await;
    proxy.stop().await
}

#[tauri::command]
pub async fn set_debug_mode(
    debug_mode: bool,
    state: tauri::State<'_, Arc<RwLock<HttpProxy>>>,
) -> Result<(), String> {
    debug!("set_debug_mode called with debug_mode: {}", debug_mode);
    let proxy = state.read().await;
    *proxy.debug_mode.write().await = debug_mode;
    debug!("Successfully updated debug mode to: {}", debug_mode);
    Ok(())
}

#[tauri::command]
pub async fn set_proxy_target(
    target: String,
    state: tauri::State<'_, Arc<RwLock<HttpProxy>>>,
) -> Result<(), String> {
    debug!("set_proxy_target called with target: {}", target);
    // Validate target URL
    let parsed_url =
        reqwest::Url::parse(&target).map_err(|e| format!("Invalid target URL: {}", e))?;

    if parsed_url.scheme() != "https" {
        return Err(format!(
            "Invalid URL scheme: {}. Only HTTPS URLs are allowed.",
            parsed_url.scheme()
        ));
    }

    debug!(
        "Parsed target URL - scheme: {}, host: {:?}, port: {:?}",
        parsed_url.scheme(),
        parsed_url.host_str(),
        parsed_url.port()
    );

    debug!("Setting proxy target to: {}", target);
    let proxy = state.read().await;
    *proxy.target_url.write().await = target.clone();
    debug!("Successfully updated proxy target to: {}", target);
    info!("Proxy target updated to: {}", target);
    Ok(())
}
