import type { WebSocketManagerBase, WebSocketConfigBase } from '../types/websocket.types.ts';

/**
 * Base WebSocket manager implementation.
 * Handles connection management, retries, and browser events.
 */
export abstract class WebSocketManagerBaseImpl implements WebSocketManagerBase {
    protected socket: WebSocket | null = null;
    protected wsUrl: string;

    protected _status = {
        isConnecting: false,
        isReady: false,
    };

    protected connectionTimeout: number | null = null;
    protected retryTimeout: number | null = null;
    protected healthCheckTimer: number | null = null;
    protected retryCount: number = 0;

    protected readonly MAX_RETRIES = 500;
    protected readonly MAX_RETRY_DELAY = 32000; // 32 seconds
    protected readonly INITIAL_RETRY_DELAY = 1000; // 1 second
    protected readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

    protected eventHandlers = new Map<string, Set<Function>>();
    protected visibilityHandler: ((event: Event) => void) | null = null;
    protected focusHandler: ((event: Event) => void) | null = null;

    constructor(config: WebSocketConfigBase) {
        if (!config.url) throw new Error('WebSocket URL is required');
        this.wsUrl = config.url;

        // Set up event handlers from config
        if (config.onMessage) this.on('message', config.onMessage);
        if (config.onError) this.on('error', config.onError);
        if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
        if (config.onOpen) this.on('statusChange', (status: boolean) => status && config.onOpen?.());

        this.setupBrowserEventHandlers();
    }

    /**
     * Register event handler
     */
    on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event)!.add(handler);
    }

    /**
     * Remove event handler
     */
    off(event: string, handler: Function): void {
        this.eventHandlers.get(event)?.delete(handler);
    }

    /**
     * Emit event to registered handlers
     */
    protected emit(event: string, ...args: any[]): void {
        this.eventHandlers.get(event)?.forEach((handler) => handler(...args));
    }

    /**
     * Connect to WebSocket server
     */
    async connect(): Promise<void> {
        // Prevent multiple simultaneous connections
        if (this._status.isConnecting) {
            console.log('WebSocketManagerBase: Connection already in progress');
            return;
        }

        console.log('WebSocketManagerBase: Connecting');

        try {
            this._status.isConnecting = true;
            this.emit('statusChange', true);

            // Ensure cleanup before creating new connection
            await this.cleanup(true);

            // Create socket and set up handlers
            this.socket = new WebSocket(this.getWebSocketUrl());
            this.setupSocketHandlers();

            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                if (this.socket?.readyState !== WebSocket.OPEN) {
                    console.log('WebSocketManagerBase: Connection timeout');
                    this.handleError(new Error('Connection timeout'));
                    this.scheduleRetry();
                }
            }, 5000) as unknown as number;
        } catch (error) {
            console.error('WebSocketManagerBase: Connection error:', error);
            this.handleError(error as Error);
            this.scheduleRetry();
        }
    }

    /**
     * Disconnect WebSocket and cleanup
     */
    disconnect(): void {
        console.log('WebSocketManagerBase: Disconnecting');
        this.clearTimeouts();
        this.cleanup(false);
        this.retryCount = 0;
    }

    /**
     * Get current connection status
     */
    get status() {
        return this._status;
    }

    /**
     * Get WebSocket URL - implemented by derived classes
     */
    protected abstract getWebSocketUrl(): string;

    /**
     * Handle incoming messages - implemented by derived classes
     */
    protected abstract handleMessage(event: MessageEvent): void;

    /**
     * Set up socket event handlers
     */
    protected setupSocketHandlers(): void {
        if (!this.socket) return;

        const currentSocket = this.socket;

        this.socket.onopen = () => {
            console.log('WebSocketManagerBase: Socket opened');

            // Ignore if this is not the current socket
            if (this.socket !== currentSocket) {
                console.log('WebSocketManagerBase: Closing stale socket connection');
                currentSocket.close();
                return;
            }

            // Clear timeouts and reset retry count
            this.clearTimeouts();
            this.retryCount = 0;

            this._status.isConnecting = true;
            this._status.isReady = false;
            this.emit('statusChange', true);

            // Derived classes can override this to send initial message
            this.onSocketOpen();
        };

        this.socket.onmessage = (event) => {
            // Ignore if this is not the current socket
            if (this.socket !== currentSocket) return;

            this.handleMessage(event);
        };

        this.socket.onclose = (event) => {
            console.log('WebSocketManagerBase: Socket closed', {
                code: event.code,
                reason: event.reason,
                wasClean: event.wasClean,
            });

            // Ignore if this is not the current socket
            if (this.socket !== currentSocket) return;

            const wasCleanClose = event.code === 1000 || event.code === 1001;

            // Cleanup without reconnecting if it was a clean close
            this.cleanup(!wasCleanClose);

            // Schedule retry for unclean closes
            if (!wasCleanClose) {
                console.log('WebSocketManagerBase: Unclean close, attempting retry');
                this.scheduleRetry();
            }
        };

        this.socket.onerror = (error) => {
            console.error('WebSocketManagerBase: Socket error', error);

            // Ignore if this is not the current socket
            if (this.socket !== currentSocket) return;

            // Just emit the error - let onclose handle the retry
            this.emit('error', new Error('WebSocket error occurred'));
        };
    }

    /**
     * Hook for derived classes to handle socket open
     */
    protected onSocketOpen(): void {
        // Default implementation does nothing
    }

    /**
     * Set up browser visibility and focus handlers
     */
    protected setupBrowserEventHandlers(): void {
        // Handle page visibility changes
        this.visibilityHandler = () => {
            if (document.visibilityState === 'visible') {
                console.log('WebSocketManagerBase: Page became visible, checking connection');
                this.checkConnection();
            } else {
                console.log('WebSocketManagerBase: Page hidden, clearing health check');
                this.clearHealthCheck();
            }
        };
        document.addEventListener('visibilitychange', this.visibilityHandler);

        // Handle window focus changes
        this.focusHandler = (event: Event) => {
            if (event.type === 'focus') {
                console.log('WebSocketManagerBase: Window focused, checking connection');
                this.checkConnection();
            }
        };
        window.addEventListener('focus', this.focusHandler);
        window.addEventListener('blur', this.focusHandler);
    }

    /**
     * Remove browser event handlers
     */
    protected removeBrowserEventHandlers(): void {
        if (this.visibilityHandler) {
            document.removeEventListener('visibilitychange', this.visibilityHandler);
            this.visibilityHandler = null;
        }

        if (this.focusHandler) {
            window.removeEventListener('focus', this.focusHandler);
            window.removeEventListener('blur', this.focusHandler);
            this.focusHandler = null;
        }
    }

    /**
     * Start health check timer
     */
    protected startHealthCheck(): void {
        this.clearHealthCheck();

        // Only start health check if page is visible
        if (document.visibilityState === 'visible') {
            this.healthCheckTimer = setInterval(() => {
                this.checkConnection();
            }, this.HEALTH_CHECK_INTERVAL) as unknown as number;
        }
    }

    /**
     * Clear health check timer
     */
    protected clearHealthCheck(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
    }

    /**
     * Check connection status and reconnect if needed
     */
    protected checkConnection(): void {
        if (!this.socket) return;

        // Check if socket appears open but might be stale
        if (this.socket.readyState === WebSocket.OPEN && !this._status.isReady) {
            console.log('WebSocketManagerBase: Detected stale connection, reconnecting');
            this.cleanup(true);
            this.connect();
            return;
        }

        // Check if socket is closed or closing when it should be open
        if (this.socket.readyState === WebSocket.CLOSED || this.socket.readyState === WebSocket.CLOSING) {
            console.log('WebSocketManagerBase: Detected closed connection, reconnecting');
            this.connect();
            return;
        }
    }

    /**
     * Clear connection and retry timeouts
     */
    protected clearTimeouts(): void {
        if (this.connectionTimeout) {
            console.log('WebSocketManagerBase: Clearing connection timeout');
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        if (this.retryTimeout) {
            console.log('WebSocketManagerBase: Clearing retry timeout');
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    /**
     * Schedule connection retry with exponential backoff
     */
    protected scheduleRetry(): void {
        console.log('WebSocketManagerBase: Scheduling retry', {
            retryCount: this.retryCount,
            maxRetries: this.MAX_RETRIES,
        });

        if (this.retryCount >= this.MAX_RETRIES) {
            console.log('WebSocketManagerBase: Maximum retry attempts reached');
            this.handleError(new Error('Maximum retry attempts reached'));
            return;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
            this.INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount),
            this.MAX_RETRY_DELAY,
        );

        console.log('WebSocketManagerBase: Setting retry timeout', {
            delay,
            retryAttempt: this.retryCount + 1,
        });

        this.retryCount++;
        this.retryTimeout = setTimeout(() => {
            console.log('WebSocketManagerBase: Executing retry attempt', this.retryCount);
            this.retryTimeout = null;
            this._status.isConnecting = false;
            this.connect();
        }, delay) as unknown as number;
    }

    /**
     * Handle WebSocket errors
     */
    protected handleError(error: Error): void {
        console.error('WebSocketManagerBase: Handling error:', error);
        this.emit('error', error);
    }

    /**
     * Clean up WebSocket connection
     */
    protected cleanup(isReconnecting: boolean = false): void {
		// // Clear event handlers first to prevent any late-arriving events
		// this.eventHandlers.clear();
        console.log('WebSocketManagerBase: Cleanup', { isReconnecting });

        // Clear any existing timeouts
        this.clearTimeouts();

        // Track if we were connected before cleanup
        const wasConnected = this.socket?.readyState === WebSocket.OPEN;

        // Close existing socket if any
        if (this.socket) {
            const socket = this.socket;
            this.socket = null; // Clear reference first to prevent recursion

            if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
                socket.close(1000, isReconnecting ? 'Reconnecting' : 'Cleanup');
            }
        }

        if (isReconnecting) {
            // During reconnection, reset ready state and set connecting
            this._status.isConnecting = true;
            this._status.isReady = false;
            this.emit('readyChange', false);
        } else {
            // Full cleanup
            this.clearHealthCheck();
            this.removeBrowserEventHandlers();
            this._status.isConnecting = false;
            this._status.isReady = false;
            this.emit('readyChange', false);
            if (wasConnected) {
                this.emit('statusChange', false);
            }
        }
    }
}