use log::{debug, error};
use serde::{Deserialize, Serialize};
use tauri::{Manager, WebviewWindow};
use tauri_plugin_store::StoreExt;
use serde_json::json;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowState {
    pub width: f64,
    pub height: f64,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub scale_factor: f64,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            width: 800.0,
            height: 600.0,
            x: None,
            y: None,
            scale_factor: 1.0,
        }
    }
}

pub fn setup_window_state_handler(window: &WebviewWindow) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Moved(position) => {
                debug!("Window moved to {:?}", position);
                save_window_state(&window_clone);
            }
            tauri::WindowEvent::Resized(size) => {
                debug!("Window resized to {:?}", size);
                save_window_state(&window_clone);
            }
            tauri::WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
                debug!("Window scale factor changed to {}", scale_factor);
                save_window_state(&window_clone);
            }
            _ => {}
        }
    });
}

pub fn load_window_state(window: &WebviewWindow) -> WindowState {
    match window.app_handle().store("bb-window-state.json") {
        Ok(store) => {
            let state = store.get("mainWindow");
            match state {
                Some(state) => {
                    debug!("Loaded window state: {:?}", state);
                    serde_json::from_value(state.clone()).unwrap_or_default()
                }
                None => {
                    debug!("No saved window state found, using defaults");
                    WindowState::default()
                }
            }
        }
        Err(e) => {
            error!("Error accessing store: {}", e);
            WindowState::default()
        }
    }
}

fn save_window_state(window: &WebviewWindow) {
    // Clone necessary values before moving into the closure
    let position = window.outer_position().unwrap_or_default();
    let size = window.outer_size().unwrap_or_default();
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let app_handle = window.app_handle();

    // Create the state outside the async block
    let state = WindowState {
        width: size.width as f64,
        height: size.height as f64,
        x: Some(position.x as f64),
        y: Some(position.y as f64),
        scale_factor,
    };

    // Convert to JSON value
    let state_json = json!({
        "width": state.width,
        "height": state.height,
        "x": state.x,
        "y": state.y,
        "scale_factor": state.scale_factor,
    });

    match app_handle.store("bb-window-state.json") {
        Ok(store) => {
            store.set("mainWindow".to_string(), state_json);
            if let Err(e) = store.save() {
                error!("Error saving store: {}", e);
            }
        }
        Err(e) => error!("Error accessing store: {}", e),
    }
}

pub fn apply_window_state(window: &WebviewWindow, state: &WindowState) {
    if let (Some(x), Some(y)) = (state.x, state.y) {
        if let Err(e) = window.set_position(tauri::Position::Physical(
            tauri::PhysicalPosition {
//                 x: (x / state.scale_factor) as i32,
//                 y: (y / state.scale_factor) as i32,
                x: (x) as i32,
                y: (y) as i32,
            }
        )) {
            error!("Error setting window position: {}", e);
        }
    }

    if let Err(e) = window.set_size(tauri::Size::Physical(
        tauri::PhysicalSize {
//             width: (state.width / state.scale_factor) as u32,
//             height: (state.height / state.scale_factor) as u32,
            width: (state.width) as u32,
            height: (state.height) as u32,
        }
    )) {
        error!("Error setting window size: {}", e);
    }
}