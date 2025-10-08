use crate::config::get_dui_debug_mode;
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// OAuth result data structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OAuthResult {
    pub success: bool,
    pub provider: String,
    #[serde(rename = "serverId")]
    pub server_id: Option<String>,  // For MCP OAuth flows
    pub code: Option<String>,
    pub state: Option<String>,
    pub error: Option<String>,
}

/// OAuth flow parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct OAuthFlowParams {
    pub provider: String,
    pub oauth_url: String,
    pub window_title: Option<String>,
    pub window_width: Option<f64>,
    pub window_height: Option<f64>,
}

/// Start OAuth flow by creating a new OAuth window
/// 
/// This creates a temporary OAuth window that navigates to the provider's OAuth URL.
/// The window will handle the OAuth flow and communicate results back to the bb_chat window.
/// 
/// # Arguments
/// * `params` - OAuth flow parameters including provider, URL, and window options
/// * `app_handle` - Tauri app handle for window management
/// 
/// # Returns
/// * `Result<String, String>` - Window label on success, error message on failure
#[tauri::command]
pub async fn start_oauth_flow(
    params: OAuthFlowParams,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let debug_enabled = get_dui_debug_mode();
    
    if debug_enabled {
        info!("[DEBUG] Starting OAuth flow for provider: {}", params.provider);
        info!("[DEBUG] OAuth URL: {}", params.oauth_url);
    }

    // Generate unique window label with timestamp to avoid conflicts
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let window_label = format!("oauth_window_{}_{}", params.provider, timestamp);
    
    if debug_enabled {
        info!("[DEBUG] Creating OAuth window with label: {}", window_label);
    }

    // Window configuration following existing patterns
    let window_title = params.window_title
        .unwrap_or_else(|| format!("Sign in to {}", params.provider));
    let window_width = params.window_width.unwrap_or(500.0);
    let window_height = params.window_height.unwrap_or(650.0);

    // Parse OAuth URL
    let oauth_url = params.oauth_url.parse::<url::Url>()
        .map_err(|e| format!("Invalid OAuth URL: {}", e))?;

    if debug_enabled {
        info!("[DEBUG] Window configuration:");
        info!("[DEBUG] - Title: {}", window_title);
        info!("[DEBUG] - Size: {}x{}", window_width, window_height);
        info!("[DEBUG] - URL: {}", oauth_url);
    }

    // Create OAuth window
    let oauth_window = WebviewWindowBuilder::new(
        &app_handle,
        &window_label,
        WebviewUrl::External(oauth_url)
    )
    .title(window_title)
    .inner_size(window_width, window_height)
    .center()
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .always_on_top(false)
    .skip_taskbar(false)
    .build()
    .map_err(|e| {
        error!("Failed to create OAuth window: {}", e);
        format!("Failed to create OAuth window: {}", e)
    })?;

    if debug_enabled {
        info!("[DEBUG] OAuth window created successfully: {}", window_label);
    }

    // Store provider information for this window
    if let Err(e) = oauth_window.emit("oauth-window-ready", &params.provider) {
        error!("Failed to emit oauth-window-ready event: {}", e);
    }

    Ok(window_label)
}

/// Complete OAuth flow and send results to bb_chat window
/// 
/// This is called from the OAuth callback page to send results back to the bb_chat window
/// and close the OAuth window.
/// 
/// # Arguments
/// * `result` - OAuth result containing tokens or error information
/// * `window` - The OAuth window that initiated the request
/// 
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn complete_oauth_flow(
    result: OAuthResult,
    window: WebviewWindow,
) -> Result<(), String> {
    let debug_enabled = get_dui_debug_mode();
    let window_label = window.label().to_string();
    
    if debug_enabled {
        info!("[DEBUG] Completing OAuth flow for window: {}", window_label);
        info!("[DEBUG] Result success: {}", result.success);
        if result.success {
            info!("[DEBUG] Provider: {}", result.provider);
           //  if let Some(expires_in) = result.expires_in {
           //      info!("[DEBUG] Token expires in: {} seconds", expires_in);
           //  }
        } else if let Some(error) = &result.error {
            info!("[DEBUG] OAuth error: {}", error);
        }
    }

    // Send result to bb_chat window via event
    let bb_chat_window = window.app_handle()
        .get_webview_window("bb_chat")
        .ok_or("BB Chat window not found")?;

    if debug_enabled {
        info!("[DEBUG] Sending OAuth result to bb_chat window");
    }

    bb_chat_window
        .emit("oauth-result", &result)
        .map_err(|e| {
            error!("Failed to emit oauth-result event: {}", e);
            format!("Failed to emit oauth-result event: {}", e)
        })?;

    if debug_enabled {
        info!("[DEBUG] OAuth result sent, closing OAuth window: {}", window_label);
    }

    // Close OAuth window
    window.close().map_err(|e| {
        error!("Failed to close OAuth window: {}", e);
        format!("Failed to close OAuth window: {}", e)
    })?;

    if debug_enabled {
        info!("[DEBUG] OAuth flow completed successfully");
    }

    Ok(())
}

/// Get OAuth window information
/// 
/// Helper command to get information about active OAuth windows
/// 
/// # Arguments
/// * `app_handle` - Tauri app handle
/// 
/// # Returns
/// * `Result<HashMap<String, String>, String>` - Map of window labels to providers
#[tauri::command]
pub async fn get_oauth_windows(
    app_handle: tauri::AppHandle,
) -> Result<HashMap<String, String>, String> {
    let debug_enabled = get_dui_debug_mode();
    
    if debug_enabled {
        info!("[DEBUG] Getting OAuth window information");
    }

    let mut oauth_windows = HashMap::new();
    
    // Get all windows and filter OAuth windows
    let windows = app_handle.webview_windows();
    for (label, _window) in windows.iter() {
        if label.starts_with("oauth_window_") {
            // Extract provider from window label
            if let Some(provider_part) = label.strip_prefix("oauth_window_") {
                if let Some(provider) = provider_part.split('_').next() {
                    oauth_windows.insert(label.clone(), provider.to_string());
                }
            }
        }
    }

    if debug_enabled {
        info!("[DEBUG] Found {} OAuth windows", oauth_windows.len());
        for (label, provider) in &oauth_windows {
            info!("[DEBUG] - {}: {}", label, provider);
        }
    }

    Ok(oauth_windows)
}

/// Close OAuth window by label
/// 
/// Helper command to programmatically close an OAuth window
/// 
/// # Arguments
/// * `window_label` - Label of the OAuth window to close
/// * `app_handle` - Tauri app handle
/// 
/// # Returns
/// * `Result<(), String>` - Success or error message
#[tauri::command]
pub async fn close_oauth_window(
    window_label: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let debug_enabled = get_dui_debug_mode();
    
    if debug_enabled {
        info!("[DEBUG] Closing OAuth window: {}", window_label);
    }

    let window = app_handle
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("OAuth window {} not found", window_label))?;

    window.close().map_err(|e| {
        error!("Failed to close OAuth window {}: {}", window_label, e);
        format!("Failed to close OAuth window: {}", e)
    })?;

    if debug_enabled {
        info!("[DEBUG] OAuth window {} closed successfully", window_label);
    }

    Ok(())
}