use crate::config::get_dui_debug_mode;
use log::{error, info};
use once_cell::sync::OnceCell;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::time::Duration;
use tauri::{Manager, WebviewWindow};
use tauri_plugin_store::StoreExt;
use tokio::time::sleep;

// Debounce configuration
const DEBOUNCE_DURATION: Duration = Duration::from_millis(500);
static SAVE_HANDLE: OnceCell<tokio::sync::Mutex<Option<tauri::async_runtime::JoinHandle<()>>>> =
    OnceCell::new();

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub scale_factor: f64,
}

impl WindowState {
    // Get system scale factor from app handle
    fn get_system_scale_factor(app_handle: Option<&tauri::AppHandle>) -> f64 {
        let debug_enabled = get_dui_debug_mode();
        let scale_factor = if let Some(handle) = app_handle {
            // Try to get primary monitor's scale factor
            if let Ok(monitors) = handle.primary_monitor() {
                if let Some(monitor) = monitors {
                    if debug_enabled {
                        info!(
                            "[DEBUG] Got primary monitor scale factor: {}",
                            monitor.scale_factor()
                        );
                    }
                    monitor.scale_factor()
                } else {
                    if debug_enabled {
                        info!("[DEBUG] No primary monitor found, using default scale factor: 1.0");
                    }
                    1.0
                }
            } else {
                if debug_enabled {
                    info!("[DEBUG] Failed to get monitors, using default scale factor: 1.0");
                }
                1.0
            }
        } else {
            if debug_enabled {
                info!("[DEBUG] No app handle provided, using default scale factor: 1.0");
            }
            1.0
        };
        if debug_enabled {
            info!("[DEBUG] Final system scale factor: {}", scale_factor);
        }
        scale_factor
    }
}

impl Default for WindowState {
    fn default() -> Self {
        let debug_enabled = get_dui_debug_mode();
        // Default logical sizes (will be multiplied by scale factor)
        let logical_width = 700.0;
        let logical_height = 480.0;
        let scale_factor = 1.0; // Will be updated with actual system value
        if debug_enabled {
            info!("[DEBUG] Creating default window state:");
            info!(
                "[DEBUG] - Logical size: {}x{}",
                logical_width, logical_height
            );
            info!("[DEBUG] - Initial scale factor: {}", scale_factor);
        }

        // Create initial state - physical sizes will be adjusted after creation
        Self {
            width: logical_width,   // Store logical size initially
            height: logical_height, // Will be multiplied by actual scale factor later
            x: Some(100.0),         // Logical position
            y: Some(100.0),         // Will be scaled appropriately
            scale_factor,
        }
    }
}

impl WindowState {
    // Calculate default position relative to main window
    pub fn default_relative_to(main_window: &WebviewWindow) -> Result<Self, String> {
        let debug_enabled = get_dui_debug_mode();
        let main_pos = main_window
            .outer_position()
            .map_err(|e| format!("Failed to get main window position: {}", e))?;
        let scale_factor = main_window.scale_factor().unwrap_or(1.0);
        if debug_enabled {
            info!("[DEBUG] Creating chat window state:");
            info!("[DEBUG] - Scale factor: {}", scale_factor);
        }

        // Fixed logical sizes for chat window
        let logical_width = 1200.0; // Base chat window width
        let logical_height = 650.0; // Base chat window height
        let gap = 20.0; // Gap between windows (logical pixels)

        // Calculate logical position relative to main window
        let logical_x = main_pos.x as f64 / scale_factor + 700.0 + gap; // Main logical width + gap
        let logical_y = main_pos.y as f64 / scale_factor; // Same Y as main window

        if debug_enabled {
            info!("[DEBUG] Chat window logical dimensions:");
            info!("[DEBUG] - Size: {}x{}", logical_width, logical_height);
            info!("[DEBUG] - Position: {}x{}", logical_x, logical_y);
        }

        // Return logical values - they will be scaled later
        Ok(Self {
            width: logical_width,
            height: logical_height,
            x: Some(logical_x),
            y: Some(logical_y),
            scale_factor: 1.0, // Will be updated with actual scale factor
        })
    }
}

fn validate_window_state(state: &WindowState, _window: Option<&WebviewWindow>) -> WindowState {
    let debug_enabled = get_dui_debug_mode();
    if debug_enabled {
        info!("[DEBUG] Validating window state:");
        info!("[DEBUG] Input state:");
        info!(
            "[DEBUG] - Size (physical): {}x{}",
            state.width, state.height
        );
        info!("[DEBUG] - Position (physical): {:?},{:?}", state.x, state.y);
        info!("[DEBUG] - Scale factor: {}", state.scale_factor);
        info!(
            "[DEBUG] - Logical size would be: {}x{}",
            state.width / state.scale_factor,
            state.height / state.scale_factor
        );
        if let (Some(x), Some(y)) = (state.x, state.y) {
            info!(
                "[DEBUG] - Logical position would be: {}x{}",
                x / state.scale_factor,
                y / state.scale_factor
            );
        }
    }
    // Reasonable limits for physical pixels
    const MAX_DIMENSION: f64 = 8192.0; // Support for very large monitors
    const MIN_DIMENSION: f64 = 200.0; // Minimum usable size

    let mut validated = state.clone();

    // Clamp dimensions to reasonable values
    validated.width = validated.width.clamp(MIN_DIMENSION, MAX_DIMENSION);
    validated.height = validated.height.clamp(MIN_DIMENSION, MAX_DIMENSION);

    // Only do a basic bounds check for reasonable coordinates
    if let (Some(x), Some(y)) = (validated.x, validated.y) {
        if debug_enabled {
            info!("[DEBUG] Checking window position bounds:");
            info!("[DEBUG] - Position: x={}, y={}", x, y);
        }

        // Only invalidate if coordinates are extremely out of bounds
        if x < -MAX_DIMENSION || x > MAX_DIMENSION || y < -MAX_DIMENSION || y > MAX_DIMENSION {
            if debug_enabled {
                info!(
                    "[DEBUG] Window position ({},{}) is out of reasonable bounds, will center",
                    x, y
                );
            }
            validated.x = None;
            validated.y = None;
        } else if debug_enabled {
            info!(
                "[DEBUG] Window position ({},{}) is within reasonable bounds",
                x, y
            );
        }
    }

    // Ensure valid scale factor
    validated.scale_factor = validated.scale_factor.max(1.0);

    validated
}

#[tauri::command]
pub async fn setup_window_state_handler(
    window_label: String,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let window = app_handle
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("Window {} not found", window_label))?;

    setup_window_state_handler_internal(&window);
    Ok(())
}

pub fn setup_window_state_handler_internal(window: &WebviewWindow) {
    let debug_enabled = get_dui_debug_mode();
    if debug_enabled {
        info!(
            "[DEBUG] Setting up window state handlers for window: {}",
            window.label()
        );
    }
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if debug_enabled {
            match event {
                tauri::WindowEvent::Moved(_) => info!(
                    "[DEBUG] Move event received for window: {}",
                    window_clone.label()
                ),
                tauri::WindowEvent::Resized(_) => info!(
                    "[DEBUG] Resize event received for window: {}",
                    window_clone.label()
                ),
                _ => {}
            }
        }

        match event {
            tauri::WindowEvent::Moved(position) => {
                if debug_enabled {
                    info!("[DEBUG] Window moved to position: {:?}", position);
                }
                save_window_state_internal(&window_clone, false);
            }
            tauri::WindowEvent::Resized(size) => {
                if debug_enabled {
                    info!("[DEBUG] Window resized to: {:?}", size);
                }
                save_window_state_internal(&window_clone, false);
            }
            tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                let debug_enabled = get_dui_debug_mode();
                if debug_enabled {
                    info!("[DEBUG] Scale factor changed event:");
                    info!("[DEBUG] - New scale_factor: {}", scale_factor);
                    if let Ok(current_size) = window_clone.outer_size() {
                        info!(
                            "[DEBUG] - Current window size (physical): {}x{}",
                            current_size.width, current_size.height
                        );
                    }
                    if let Ok(current_pos) = window_clone.outer_position() {
                        info!(
                            "[DEBUG] - Current window position (physical): {}x{}",
                            current_pos.x, current_pos.y
                        );
                    }
                }
                if debug_enabled {
                    info!("[DEBUG] Window scale factor changed to: {}", scale_factor);
                }
                save_window_state_internal(&window_clone, false);
            }
            _ => {}
        }
    });
}

/// Load window state from storage
///
/// # Arguments
/// * `window_label` - The label of the window to load state for
/// * `app_handle` - The Tauri app handle
/// * `use_logical_size` - If true, returns values in logical pixels (scaled by DPI)
#[tauri::command]
pub async fn load_window_state(
    window_label: String,
    app_handle: tauri::AppHandle,
    use_logical_size: Option<bool>,
) -> Result<WindowState, String> {
    let debug_enabled = get_dui_debug_mode();
    // Get the actual scale factor from the system
    let actual_scale_factor = WindowState::get_system_scale_factor(Some(&app_handle));
    if debug_enabled {
        info!(
            "[DEBUG] Loading window state with scale factor: {}",
            actual_scale_factor
        );
    }
    let debug_enabled = get_dui_debug_mode();
    if debug_enabled {
        info!("[DEBUG] Loading saved state for {}", window_label);
        info!("[DEBUG] Attempting to load from store: bb-window-state.json");
    }

    let store = app_handle.store("bb-window-state.json").map_err(|e| {
        if debug_enabled {
            info!("[DEBUG] Failed to access store: {}", e);
        }
        format!("Failed to access store: {}", e)
    })?;

    let state = store.get(&window_label);
    if debug_enabled {
        info!("[DEBUG] Looking for state with key: {}", window_label);
    }

    if debug_enabled {
        info!("[DEBUG] Raw state from store: {:?}", state);
    }

    // Try to get main window for relative positioning
    let main_window = app_handle.get_webview_window("main");

    let result = match state {
        Some(state) => {
            if debug_enabled {
                info!("[DEBUG] Found saved state in store: {:?}", state);
            }
            if debug_enabled {
                info!("[DEBUG] Deserializing JSON state:");
                info!("[DEBUG] Raw JSON: {:?}", state);
            }
            let state: WindowState = serde_json::from_value(state.clone())
                .map_err(|e| format!("Failed to parse state: {}", e))?;
            if debug_enabled {
                info!("[DEBUG] Parsed window state:");
                info!("[DEBUG] - Size: {}x{}", state.width, state.height);
                info!("[DEBUG] - Position: {:?},{:?}", state.x, state.y);
                info!("[DEBUG] - Scale factor: {}", state.scale_factor);
            }

            // Validate state before returning
            let window = app_handle.get_webview_window(&window_label);
            let validated = validate_window_state(&state, window.as_ref());
            if debug_enabled && validated != state {
                info!("[DEBUG] State was adjusted for sanity:");
                info!("[DEBUG] - Original: {:?}", state);
                info!("[DEBUG] - Adjusted: {:?}", validated);
            }
            // Convert to logical values if requested
            if use_logical_size.unwrap_or(false) {
                if debug_enabled {
                    info!(
                        "[DEBUG] Converting to logical values (scale_factor: {})",
                        validated.scale_factor
                    );
                    info!(
                        "[DEBUG] - Before conversion: x={:?}, y={:?}",
                        validated.x, validated.y
                    );
                }
                if debug_enabled {
                    info!("[DEBUG] Converting physical values to logical values");
                    info!("[DEBUG] - Scale factor: {}", validated.scale_factor);
                    info!(
                        "[DEBUG] - Physical size: {}x{}",
                        validated.width, validated.height
                    );
                    if let (Some(x), Some(y)) = (validated.x, validated.y) {
                        info!("[DEBUG] - Physical position: {}x{}", x, y);
                    }
                }

                // Simply convert physical to logical by dividing by scale factor
                if debug_enabled {
                    info!("[DEBUG] Creating logical state:");
                    if let (Some(x), Some(y)) = (validated.x, validated.y) {
                        info!("[DEBUG] - Physical: ({}, {})", x, y);
                        info!(
                            "[DEBUG] - Will convert to: ({}, {})",
                            x / validated.scale_factor,
                            y / validated.scale_factor
                        );
                    }
                }
                let logical = WindowState {
                    width: validated.width / validated.scale_factor,
                    height: validated.height / validated.scale_factor,
                    x: validated.x.map(|x| x / validated.scale_factor),
                    y: validated.y.map(|y| y / validated.scale_factor),
                    scale_factor: validated.scale_factor,
                };

                if debug_enabled {
                    info!("[DEBUG] Converted to logical values:");
                    info!(
                        "[DEBUG] - Logical size: {}x{}",
                        logical.width, logical.height
                    );
                    if let (Some(x), Some(y)) = (logical.x, logical.y) {
                        info!("[DEBUG] - Logical position: {}x{}", x, y);
                    }
                }

                Ok(logical)
            } else {
                Ok(validated)
            }
        }
        None => {
            if debug_enabled {
                info!("[DEBUG] No saved state found");
            }

            // For chat window, try to position relative to main window
            let mut default_state = if window_label == "bb_chat" {
                if debug_enabled {
                    info!(
                        "[DEBUG] Creating chat window state with scale factor: {}",
                        actual_scale_factor
                    );
                }
                if debug_enabled {
                    info!(
                        "[DEBUG] Creating chat window state with scale factor: {}",
                        actual_scale_factor
                    );
                }
                if let Some(main_window) = &main_window {
                    if debug_enabled {
                        info!("[DEBUG] Calculating position relative to main window");
                    }
                    match WindowState::default_relative_to(main_window) {
                        Ok(state) => {
                            if debug_enabled {
                                info!("[DEBUG] Using relative position to main window");
                            }
                            state
                        }
                        Err(e) => {
                            if debug_enabled {
                                info!("[DEBUG] Failed to calculate relative position: {}", e);
                            }
                            WindowState::default()
                        }
                    }
                } else {
                    if debug_enabled {
                        info!("[DEBUG] Main window not found, using default position");
                    }
                    WindowState::default()
                }
            } else {
                if debug_enabled {
                    info!("[DEBUG] Using default window state");
                }
                WindowState::default()
            };

            // Update scale factor and adjust physical sizes
            default_state.scale_factor = actual_scale_factor;
            // Convert logical sizes to physical using actual scale factor
            default_state.width *= actual_scale_factor;
            default_state.height *= actual_scale_factor;
            if let Some(x) = default_state.x {
                default_state.x = Some(x * actual_scale_factor);
            }
            if let Some(y) = default_state.y {
                default_state.y = Some(y * actual_scale_factor);
            }
            if debug_enabled {
                info!(
                    "[DEBUG] Adjusted default state with scale factor {}:",
                    actual_scale_factor
                );
                info!(
                    "[DEBUG] - Physical size: {}x{}",
                    default_state.width, default_state.height
                );
                info!(
                    "[DEBUG] - Physical position: {:?},{:?}",
                    default_state.x, default_state.y
                );
            }

            let state = if use_logical_size.unwrap_or(false) {
                if debug_enabled {
                    info!("[DEBUG] Converting default state to logical values:");
                    info!(
                        "[DEBUG] - Physical size: {}x{}",
                        default_state.width, default_state.height
                    );
                    info!("[DEBUG] - Scale factor: {}", default_state.scale_factor);

                    info!(
                        "[DEBUG] - Logical size: {}x{}",
                        default_state.width / default_state.scale_factor,
                        default_state.height / default_state.scale_factor
                    );
                }
                WindowState {
                    width: default_state.width / default_state.scale_factor,
                    height: default_state.height / default_state.scale_factor,
                    x: default_state.x.map(|x| x / default_state.scale_factor),
                    y: default_state.y.map(|y| y / default_state.scale_factor),
                    scale_factor: default_state.scale_factor,
                }
            } else {
                default_state
            };
            Ok(state)
        }
    };

    result
}

#[tauri::command]
pub async fn save_window_state(
    window_label: String,
    app_handle: tauri::AppHandle,
    force: bool,
) -> Result<(), String> {
    let window = app_handle
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("Window {} not found", window_label))?;

    save_window_state_internal(&window, force);
    Ok(())
}

fn save_window_state_internal(window: &WebviewWindow, force: bool) {
    let debug_enabled = get_dui_debug_mode();
    let window_label = window.label().to_string();

    // Initialize the save handle if not already done
    let save_handle = SAVE_HANDLE.get_or_init(|| tokio::sync::Mutex::new(None));

    if !force {
        if debug_enabled {
            info!("[DEBUG] Debouncing save for window: {}", window_label);
        }

        // Cancel any pending save
        let window = window.clone();
        tauri::async_runtime::spawn(async move {
            let mut handle = save_handle.lock().await;
            if let Some(h) = handle.take() {
                h.abort();
            }

            // Schedule new save
            let task = tauri::async_runtime::spawn(async move {
                sleep(DEBOUNCE_DURATION).await;
                do_save(&window);
            });
            *handle = Some(task);
        });
        return;
    }

    if debug_enabled {
        if force {
            info!("[DEBUG] Forced save for window: {}", window_label);
        }
        info!("[DEBUG] ========== Saving Window State ==========");
        info!("[DEBUG] Window: {}", window_label);
    }

    do_save(window);
}

fn do_save(window: &WebviewWindow) {
    let debug_enabled = get_dui_debug_mode();

    // Get current window state in physical pixels
    let position = match window.outer_position() {
        Ok(pos) => pos,
        Err(e) => {
            error!("Error getting window position: {}", e);
            return;
        }
    };
    let size = match window.outer_size() {
        Ok(size) => size,
        Err(e) => {
            error!("Error getting window size: {}", e);
            return;
        }
    };
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let current_monitor = window.current_monitor().ok().flatten();
    let monitor_ref = current_monitor.as_ref();

    if debug_enabled {
        info!("[DEBUG] ========== Monitor Detection ===========");
        if let Ok(monitors) = window.available_monitors() {
            info!("[DEBUG] Available monitors: {}", monitors.len());
            for (i, monitor) in monitors.iter().enumerate() {
                let pos = monitor.position().to_owned();
                let size = monitor.size().to_owned();
                info!(
                    "[DEBUG] Monitor {}: pos=({},{}), size={}x{}",
                    i, pos.x, pos.y, size.width, size.height
                );
            }
        }

        if let Some(monitor) = monitor_ref {
            let pos = monitor.position().to_owned();
            info!("[DEBUG] Current monitor position: ({},{})", pos.x, pos.y);
        } else {
            info!("[DEBUG] No current monitor detected");
        }
    }

    if debug_enabled {
        info!("[DEBUG] ========== Window Scale Factor Info ===========");
        info!("[DEBUG] Window scale_factor from API: {}", scale_factor);
        if let Some(monitor) = monitor_ref {
            let monitor_scale = monitor.scale_factor();
            if monitor_scale > 0.0 {
                info!("[DEBUG] Monitor scale_factor: {}", monitor_scale);
                if (monitor_scale - scale_factor).abs() > 0.01 {
                    info!("[DEBUG] WARNING: Monitor and window scale factors differ!");
                }
            }
        }
        info!(
            "[DEBUG] System scale factor: {}",
            window
                .theme()
                .map(|_| window.scale_factor().unwrap_or(1.0))
                .unwrap_or(1.0)
        );
    }

    // Create the state using physical pixels
    if debug_enabled {
        info!("[DEBUG] Saving window state:");
        info!("[DEBUG] - Physical size: {}x{}", size.width, size.height);
        info!("[DEBUG] - Physical position: {}x{}", position.x, position.y);
        info!("[DEBUG] - Scale factor: {}", scale_factor);
        info!("[DEBUG] - For reference, logical values would be:");
        info!(
            "[DEBUG]   * size: {}x{}",
            size.width as f64 / scale_factor,
            size.height as f64 / scale_factor
        );
        info!(
            "[DEBUG]   * position: {}x{}",
            position.x as f64 / scale_factor,
            position.y as f64 / scale_factor
        );
    }

    // Create state with global coordinates (no monitor offset needed)
    let state = WindowState {
        width: size.width as f64,
        height: size.height as f64,
        x: Some(position.x as f64),
        y: Some(position.y as f64),
        scale_factor,
    };

    // Validate state before saving
    let validated_state = validate_window_state(&state, Some(window));
    if debug_enabled {
        info!("[DEBUG] Saving state to bb-window-state.json:");
        info!("[DEBUG] - Physical pixel values:");
        info!(
            "[DEBUG]   * width: {}, height: {}",
            validated_state.width, validated_state.height
        );
        info!(
            "[DEBUG]   * x: {:?}, y: {:?}",
            validated_state.x, validated_state.y
        );
        info!("[DEBUG]   * scale_factor: {}", validated_state.scale_factor);

        if validated_state != state {
            info!("[DEBUG] State was adjusted for sanity:");
            info!("[DEBUG] - Original: {:?}", state);
            info!("[DEBUG] - Adjusted: {:?}", validated_state);
        }
    }

    if debug_enabled {
        info!("[DEBUG] Converting WindowState to JSON:");
        info!(
            "[DEBUG] - Physical size: {}x{}",
            validated_state.width, validated_state.height
        );
        info!(
            "[DEBUG] - Physical position: {:?},{:?}",
            validated_state.x, validated_state.y
        );
        info!("[DEBUG] - Scale factor: {}", validated_state.scale_factor);
    }

    let state_json = json!({
        "width": validated_state.width,
        "height": validated_state.height,
        "x": validated_state.x,
        "y": validated_state.y,
        "scale_factor": validated_state.scale_factor,
    });

    match window.app_handle().store("bb-window-state.json") {
        Ok(store) => {
            let window_label = window.label().to_string();
            if debug_enabled {
                info!("[DEBUG] Saving state to store with key: {}", window_label);
                info!("[DEBUG] State being saved: {:?}", state_json);
            }
            store.set(window_label, state_json);
            if let Err(e) = store.save() {
                error!("Error saving store: {}", e);
            } else if debug_enabled {
                info!("[DEBUG] Successfully saved window state");
            }
        }
        Err(e) => error!("Error accessing store: {}", e),
    }
}

#[tauri::command]
pub async fn apply_window_state(
    window_label: String,
    state: WindowState,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let window = app_handle
        .get_webview_window(&window_label)
        .ok_or_else(|| format!("Window {} not found", window_label))?;

    apply_window_state_internal(&window, &state);
    Ok(())
}

pub fn apply_window_state_internal(window: &WebviewWindow, state: &WindowState) {
    let current_monitor = window.current_monitor().ok().flatten();
    let current_scale = window.scale_factor().unwrap_or(1.0);
    let debug_enabled = get_dui_debug_mode();

    if debug_enabled {
        info!("[DEBUG] ========== Scale Factor Analysis ===========");
        info!("[DEBUG] Current window scale_factor: {}", current_scale);
        if let Some(monitor) = current_monitor {
            let monitor_scale = monitor.scale_factor();
            if monitor_scale > 0.0 {
                info!("[DEBUG] Current monitor scale_factor: {}", monitor_scale);
                if (monitor_scale - current_scale).abs() > 0.01 {
                    info!("[DEBUG] WARNING: Monitor and window scale factors differ!");
                }
            }
        }
        info!("[DEBUG] Stored state scale_factor: {}", state.scale_factor);
        if (state.scale_factor - current_scale).abs() > 0.01 {
            info!("[DEBUG] WARNING: Stored and current scale factors differ!");
            info!("[DEBUG] This might cause window size/position issues");
        }

        info!("[DEBUG] ========== Applying Window State ===========");
        info!("[DEBUG] Window: {}", window.label());
        info!("[DEBUG] Stored state (physical pixels):");
        info!("[DEBUG] - Size: {}x{}", state.width, state.height);
        info!("[DEBUG] - Position: x={:?}, y={:?}", state.x, state.y);
        info!("[DEBUG] - Scale factor: {}", state.scale_factor);

        if let Ok(current_size) = window.outer_size() {
            info!(
                "[DEBUG] Current window size (physical): {}x{}",
                current_size.width, current_size.height
            );
        }
        if let Ok(current_pos) = window.outer_position() {
            info!(
                "[DEBUG] Current window position (physical): {}x{}",
                current_pos.x, current_pos.y
            );
        }
        if let Ok(current_scale) = window.scale_factor() {
            info!("[DEBUG] Current scale factor: {}", current_scale);
        }
    }

    // Set window position using physical pixels
    if debug_enabled {
        info!("[DEBUG] ========== Window Metrics Analysis ===========");
        info!("[DEBUG] Current window state:");
        if let Ok(size) = window.outer_size() {
            info!(
                "[DEBUG] - Current size: {}x{} (physical pixels)",
                size.width, size.height
            );
            info!(
                "[DEBUG] - Logical size: {}x{}",
                size.width as f64 / current_scale,
                size.height as f64 / current_scale
            );
        }
        if let Ok(pos) = window.outer_position() {
            info!(
                "[DEBUG] - Current position: {}x{} (physical pixels)",
                pos.x, pos.y
            );
            info!(
                "[DEBUG] - Logical position: {}x{}",
                pos.x as f64 / current_scale,
                pos.y as f64 / current_scale
            );
        }
    }

    // Validate state before applying
    let validated_state = validate_window_state(state, Some(window));
    if debug_enabled && validated_state != *state {
        info!("[DEBUG] State was adjusted for sanity:");
        info!("[DEBUG] - Original: {:?}", state);
        info!("[DEBUG] - Adjusted: {:?}", validated_state);
    }

    // Set window position using physical pixels
    if let (Some(x), Some(y)) = (validated_state.x, validated_state.y) {
        if debug_enabled {
            info!("[DEBUG] Setting window position (physical):");
            info!("[DEBUG] - Position: x={}, y={}", x, y);
        }

        if let Err(e) = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        })) {
            error!("Error setting window position: {}", e);
            if debug_enabled {
                info!("[DEBUG] Failed to set window position: {}", e);
            }
        } else if debug_enabled {
            info!("[DEBUG] Successfully set window position");
        }
    }

    // Set window size using physical pixels
    if debug_enabled {
        info!("[DEBUG] Setting window size (physical):");
        info!(
            "[DEBUG] - Size: {}x{}",
            validated_state.width, validated_state.height
        );
    }

    if let Err(e) = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
        width: validated_state.width as u32,
        height: validated_state.height as u32,
    })) {
        error!("Error setting window size: {}", e);
        if debug_enabled {
            info!("[DEBUG] Failed to set window size: {}", e);
        }
    } else if debug_enabled {
        info!("[DEBUG] Successfully set window size");
    }
}
