import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

export const MAIN_WINDOW = 'main';

export interface WindowState {
    width: number;
    height: number;
    x: number | null;
    y: number | null;
    scaleFactor: number;
}

// Default state matches Rust default
const defaultState: WindowState = {
    width: 800,
    height: 600,
    x: null,
    y: null,
    scaleFactor: 1,
};

/**
 * Load window state from storage
 * @param windowName - The name/label of the window
 * @param useLogicalSize - If true, returns values in logical pixels (scaled by DPI). If false, returns physical pixels.
 * @returns WindowState with either logical or physical pixel values
 */
export async function loadWindowState(windowName: string, useLogicalSize: boolean = false): Promise<WindowState> {
    //console.debug('[DEBUG] Attempting to load window state for:', windowName);
    try {
        const state = await invoke<WindowState>('load_window_state', {
            // Tauri automatically provides appHandle
            windowLabel: windowName,
            useLogicalSize,
        });
        //console.debug('[DEBUG] Successfully loaded window state:', { windowName, state });
        return state;
    } catch (error) {
        console.error(`[ERROR] Error loading window state for ${windowName}:`, error);
        return defaultState;
    }
}

export async function saveWindowState(window: WebviewWindow, force: boolean = false): Promise<void> {
    //console.debug('[DEBUG] Attempting to save window state for:', window.label);
    try {
        await invoke('save_window_state', {
            // Tauri automatically provides appHandle
            windowLabel: window.label,
            force
        });
        //console.debug('[DEBUG] Successfully saved window state for:', window.label);
    } catch (error) {
        console.error('[ERROR] Failed to save window state:', { window: window.label, error });
        throw error;
    }
}

/**
 * Set up window state handlers in Rust
 * @param window - The window to set up handlers for
 */
export function setupWindowStateHandlers(window: WebviewWindow): void {
    // Event handlers are now set up in Rust via window_state.rs
    invoke('setup_window_state_handler', { windowLabel: window.label })
        .catch(error => console.error('[ERROR] Failed to set up window state handlers:', error));
}