import type { VersionInfo } from 'shared/types/version.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';

/**
 * Base configuration for WebSocket managers.
 * Used to initialize both app-level and chat-level WebSocket connections.
 */
export interface WebSocketConfigBase {
    /** WebSocket server URL */
    url: string;
    /** Handler for incoming messages */
    onMessage?: (message: any) => void;
    /** Handler for connection errors */
    onError?: (error: Error) => void;
    /** Handler for connection close events */
    onClose?: () => void;
    /** Handler for successful connection events */
    onOpen?: () => void;
}

/**
 * Common WebSocket connection status.
 * Used to track connection state for both app and chat WebSockets.
 */
export interface WebSocketStatus {
    /** Whether a connection attempt is in progress */
    isConnecting: boolean;
    /** Whether the connection is established and ready for messages */
    isReady: boolean;
    /** Whether the connection is loading initial data */
    isLoading: boolean;
    /** Current error message, if any */
    error: string | null;
}

/**
 * Base state interface for WebSocket-based features.
 * Provides common state structure for both app and chat contexts.
 */
export interface WebSocketStateBase {
    /** WebSocket connection manager */
    wsManager: WebSocketManagerBase | null;
    /** API client for REST endpoints */
    apiClient: ApiClient | null;
    /** Current connection status */
    status: WebSocketStatus;
    /** Current error state */
    error: string | null;
}

/**
 * Base interface for WebSocket managers.
 * Defines required functionality for both app and chat WebSocket implementations.
 */
export interface WebSocketManagerBase {
    /** Establish WebSocket connection */
    connect(): Promise<void>;
    /** Close WebSocket connection and cleanup */
    disconnect(): void;
    /** Register event handler */
    on(event: string, handler: Function): void;
    /** Remove event handler */
    off(event: string, handler: Function): void;
    /** Current connection status */
    readonly status: { isConnecting: boolean; isReady: boolean };
}

/**
 * App-specific WebSocket configuration.
 * Extends base config for app-level requirements.
 */
export interface AppConfig extends WebSocketConfigBase {
    /** API server URL for REST endpoints */
    apiUrl: string;
}

/**
 * App-level state interface.
 * Manages global application state via WebSocket connection.
 */
export interface AppState extends WebSocketStateBase {
    /** Current connection status */
    status: WebSocketStatus;
    /** BB version information */
    versionInfo?: VersionInfo;
}