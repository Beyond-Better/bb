import { Signal, signal } from '@preact/signals';
import {
	ConversationContinue,
	ConversationEntry,
	ConversationId,
	ConversationLogEntry,
	ConversationMetrics,
	ConversationResponse,
	ConversationTokenUsage,
	TokenUsage,
} from 'shared/types.ts';

interface WebSocketMessage {
	conversationId: string;
	startDir: string;
	task: 'greeting' | 'converse';
	statement: string;
}

interface WebSocketResponse {
	type:
		| 'conversationReady'
		| 'conversationContinue'
		| 'conversationAnswer'
		| 'conversationError'
		| 'conversationCancelled';
	data: {
		logEntry?: ConversationLogEntry;
		conversationTitle?: string;
		tokenUsageConversation?: ConversationTokenUsage;
		tokenUsageTurn?: TokenUsage;
		tokenUsageStatement?: TokenUsage;
		conversationStats?: ConversationMetrics;
		error?: string;
	};
}

interface WebSocketManagerConfig {
	url: string;
	startDir: string;
	onMessage?: (message: any) => void;
	onError?: (error: Error) => void;
	onClose?: () => void;
	onOpen?: () => void;
}

type EventType = 'statusChange' | 'readyChange' | 'message' | 'error' | 'cancelled';

export class WebSocketManager {
	private socket: WebSocket | null = null;
	private wsUrl: string;
	private conversationId: ConversationId | null = null;
	private startDir: string;

	private _status = signal<{ isConnecting: boolean; isReady: boolean }>({
		isConnecting: false,
		isReady: false,
	});

	private connectionTimeout: number | null = null;
	private retryTimeout: number | null = null;
	private healthCheckTimer: number | null = null;
	private retryCount: number = 0;

	private readonly MAX_RETRIES = 5;
	private readonly MAX_RETRY_DELAY = 32000; // 32 seconds
	private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
	private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

	private eventHandlers = new Map<EventType, Set<Function>>();
	private visibilityHandler: ((event: Event) => void) | null = null;
	private focusHandler: ((event: Event) => void) | null = null;

	constructor(config: WebSocketManagerConfig) {
		if (!config.url) throw new Error('WebSocket URL is required');
		if (!config.startDir) throw new Error('Start directory is required');

		this.wsUrl = config.url;
		this.startDir = config.startDir;

		if (config.onMessage) this.on('message', config.onMessage);
		if (config.onError) this.on('error', config.onError);
		if (config.onClose) this.on('statusChange', (status: boolean) => !status && config.onClose?.());
		if (config.onOpen) this.on('statusChange', (status: boolean) => status && config.onOpen?.());

		// Initialize browser event handlers
		//this.setupBrowserEventHandlers();
	}

	on(event: EventType, handler: Function) {
		if (!this.eventHandlers.has(event)) {
			this.eventHandlers.set(event, new Set());
		}
		this.eventHandlers.get(event)!.add(handler);
	}

	off(event: EventType, handler: Function) {
		this.eventHandlers.get(event)?.delete(handler);
	}

	private emit(event: EventType, ...args: any[]) {
		this.eventHandlers.get(event)?.forEach((handler) => handler(...args));
	}

	async setConversationId(id: ConversationId) {
		if (!id) throw new Error('Conversation ID cannot be empty');

		console.log('WebSocketManager: Setting conversation ID:', {
			newId: id,
			currentId: this.conversationId,
			socketState: this.socket?.readyState,
			isReady: this._status.value.isReady,
		});

		// If we're already connected to this conversation, do nothing
		if (
			this.conversationId === id &&
			this.socket?.readyState === WebSocket.OPEN &&
			this._status.value.isReady
		) {
			console.log('WebSocketManager: Already connected to this conversation');
			return;
		}

		// Reset connection state
		this.retryCount = 0;
		this.conversationId = id;

		// Start new connection
		await this.connect();
	}

	async connect() {
		if (!this.conversationId) {
			console.log('WebSocketManager: Cannot connect - no conversation ID');
			this.emit('error', new Error('No conversation ID set'));
			return;
		}

		// Prevent multiple simultaneous connections
		if (this._status.value.isConnecting) {
			console.log('WebSocketManager: Connection already in progress');
			return;
		}

		console.log('WebSocketManager: Connecting', {
			conversationId: this.conversationId,
			retryCount: this.retryCount,
			socketReadyState: this.socket?.readyState,
		});

		try {
			this._status.value = { isConnecting: true, isReady: false };
			this.emit('statusChange', true);

			// Ensure cleanup is complete before creating new connection
			await this.cleanup(true);

			const url = `${this.wsUrl}/conversation/${this.conversationId}`;
			console.log('WebSocketManager: Creating new WebSocket connection to:', url);
			this.socket = new WebSocket(url);
			this.setupSocketHandlers();

			// Set connection timeout
			this.connectionTimeout = setTimeout(() => {
				if (this.socket?.readyState !== WebSocket.OPEN) {
					console.log('WebSocketManager: Connection timeout');
					this.handleError(new Error('Connection timeout'));
				}
			}, 5000) as unknown as number;
		} catch (error) {
			console.error('WebSocketManager: Connection error:', error);
			this.handleError(error);
			// Schedule retry
			this.scheduleRetry();
		}
	}

	disconnect() {
		console.log('WebSocketManager: Disconnecting', {
			retryCount: this.retryCount,
			conversationId: this.conversationId,
			socketState: this.socket?.readyState,
		});
		this.clearTimeouts();
		this.cleanup(false);
		this.conversationId = null;
		this.retryCount = 0;
	}

	private cleanup(isReconnecting: boolean = false) {
		console.log('WebSocketManager: Cleanup', {
			isReconnecting,
			retryCount: this.retryCount,
			socketReadyState: this.socket?.readyState,
			conversationId: this.conversationId,
		});

		// Clear any existing timeouts
		this.clearTimeouts();

		// Track if we were connected before cleanup
		const wasConnected = this.socket?.readyState === WebSocket.OPEN;

		// Close existing socket if any
		if (this.socket) {
			const socket = this.socket;
			this.socket = null; // Clear reference first to prevent recursion

			if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
				// [TODO] if state is WebSocket.CONNECTING then wait till connected (setTimeout??) and then close
				socket.close(1000, isReconnecting ? 'Reconnecting' : 'Cleanup');
			}
		}

		if (isReconnecting) {
			// During reconnection, reset ready state and set connecting
			this._status.value = { isConnecting: true, isReady: false };
			this.emit('readyChange', false);
		} else {
			// Full cleanup
			this.clearHealthCheck();
			//this.removeBrowserEventHandlers();
			this._status.value = { isConnecting: false, isReady: false };
			this.emit('readyChange', false);
			if (wasConnected) {
				this.emit('statusChange', false);
			}
		}
	}

	private sendGreeting() {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.conversationId) {
			console.log('WebSocketManager: Cannot send greeting - socket not ready');
			return;
		}

		const message = {
			conversationId: this.conversationId,
			startDir: this.startDir,
			task: 'greeting' as const,
			statement: '',
		};

		console.log('WebSocketManager: Sending greeting');
		this.socket.send(JSON.stringify(message));
	}

	async sendConverse(message: string) {
		if (!this.socket || !this.conversationId || !this._status.value.isReady) {
			throw new Error('WebSocket is not ready');
		}

		const wsMessage = {
			conversationId: this.conversationId,
			startDir: this.startDir,
			task: 'converse' as const,
			statement: message,
		};

		this.socket.send(JSON.stringify(wsMessage));
	}

	async sendCancellation(): Promise<void> {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.conversationId) {
			throw new Error('WebSocket not ready to send cancellation');
		}

		this.socket.send(JSON.stringify({
			conversationId: this.conversationId,
			task: 'cancel' as const,
		}));
	}

	private setupSocketHandlers() {
		console.log('WebSocketManager: setupSocketHandlers - existing socket:', !!this.socket);
		if (!this.socket) return;

		const currentSocket = this.socket;
		const currentConversationId = this.conversationId;

		this.socket.onopen = () => {
			console.log('WebSocketManager: Socket opened', {
				currentId: this.conversationId,
				handlerId: currentConversationId,
				isCurrentSocket: this.socket === currentSocket,
			});

			// Ignore if this is not the current socket or conversation
			if (this.socket !== currentSocket || this.conversationId !== currentConversationId) {
				console.log('WebSocketManager: Closing stale socket connection');
				currentSocket.close();
				return;
			}

			// Clear timeouts
			this.clearTimeouts();

			// Reset retry count on successful connection
			this.retryCount = 0;
			console.log('WebSocketManager: Reset retry count after successful connection');

			this._status.value = { isConnecting: true, isReady: false };
			this.emit('statusChange', true);

			// Greeting will get a return conversationReady message, set isReady when message is received
			this.sendGreeting();
		};

		this.socket.onmessage = (event) => {
			// Ignore if this is not the current socket or conversation
			if (this.socket !== currentSocket || this.conversationId !== currentConversationId) {
				return;
			}

			const formatLogEntry = (
				msgData: any,
				msgType: 'continue' | 'answer',
			): ConversationContinue | ConversationResponse => {
				const baseEntry = {
					conversationId: this.conversationId!,
					conversationTitle: msgData.data.conversationTitle || 'Untitled Conversation',
					timestamp: msgData.data.timestamp || new Date().toISOString(),
					logEntry: msgData.data.logEntry,
					tokenUsageConversation: msgData.data.tokenUsageConversation || {
						totalTokensTotal: 0,
						inputTokensTotal: 0,
						outputTokensTotal: 0,
					},
					conversationStats: msgData.data.conversationStats || {
						statementCount: 0,
						statementTurnCount: 0,
						conversationTurnCount: 0,
					},
					formattedContent: msgData.data.formattedContent,
				};

				if (msgType === 'continue') {
					return {
						...baseEntry,
						tokenUsageTurn: msgData.data.tokenUsageTurn || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
						tokenUsageStatement: msgData.data.tokenUsageStatement || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
					} as ConversationContinue;
				} else {
					return {
						...baseEntry,
						tokenUsageStatement: msgData.data.tokenUsageStatement || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
						tokenUsageTurn: msgData.data.tokenUsageTurn,
					} as ConversationResponse;
				}
			};

			try {
				const msg = JSON.parse(event.data) as WebSocketResponse;
				console.log('WebSocketManager: Received message:', msg.type);

				switch (msg.type) {
					case 'conversationReady':
						this._status.value = { isConnecting: false, isReady: true };
						this.emit('readyChange', true);
						this.emit('statusChange', true);

						// Start health check after conversation is ready
						this.startHealthCheck();
						break;

					case 'conversationContinue':
						// Format and emit message event with type and data
						this.emit('message', {
							msgType: 'continue',
							logEntryData: formatLogEntry(msg, 'continue'),
						});
						break;

					case 'conversationAnswer':
						// Format and emit message event with type and data
						this.emit('message', {
							msgType: 'answer',
							logEntryData: formatLogEntry(msg, 'answer'),
						});
						break;

					case 'conversationCancelled':
						// Handle cancellation
						this.status.isReady = true;
						this.emit('readyChange', true);
						this.emit('cancelled', msg.data);
						break;

					case 'conversationError':
						console.error('WebSocketManager: Conversation error:', msg.data);
						if (msg.data.error) {
							this.handleError(new Error(msg.data.error));
						}
						break;

					default:
						console.warn('WebSocketManager: Unknown message type:', msg.type);
				}
			} catch (error) {
				console.error('WebSocketManager: Error processing message:', error);
				this.handleError(error);
			}
		};

		this.socket.onclose = (event) => {
			console.log('WebSocketManager: Socket closed', {
				code: event.code,
				reason: event.reason,
				wasClean: event.wasClean,
				currentId: this.conversationId,
				previousId: currentConversationId,
				isCurrentSocket: this.socket === currentSocket,
				retryCount: this.retryCount,
			});

			// Ignore if this is not the current socket or conversation
			if (this.socket !== currentSocket || this.conversationId !== currentConversationId) {
				return;
			}

			const wasCleanClose = event.code === 1000 || event.code === 1001;

			// Only cleanup without reconnecting if it was a clean close
			this.cleanup(!wasCleanClose);

			// Schedule retry for unclean closes
			if (!wasCleanClose && this.conversationId === currentConversationId) {
				console.log('WebSocketManager: Unclean close, attempting retry');
				this.scheduleRetry();
			}
		};

		this.socket.onerror = (error) => {
			console.error('WebSocketManager: Socket error', {
				error,
				currentId: this.conversationId,
				handlerId: currentConversationId,
				isCurrentSocket: this.socket === currentSocket,
				retryCount: this.retryCount,
			});

			// Ignore if this is not the current socket or conversation
			if (this.socket !== currentSocket || this.conversationId !== currentConversationId) {
				return;
			}

			// Just emit the error - let onclose handle the retry
			this.emit('error', new Error('WebSocket error occurred'));
		};
	}

	private setupBrowserEventHandlers() {
		// Handle page visibility changes
		this.visibilityHandler = () => {
			if (document.visibilityState === 'visible') {
				console.log('WebSocketManager: Page became visible, checking connection');
				this.checkConnection();
			} else {
				console.log('WebSocketManager: Page hidden, clearing health check');
				this.clearHealthCheck();
			}
		};
		document.addEventListener('visibilitychange', this.visibilityHandler);

		// Handle window focus changes
		this.focusHandler = (event: Event) => {
			if (event.type === 'focus') {
				console.log('WebSocketManager: Window focused, checking connection');
				this.checkConnection();
			}
		};
		window.addEventListener('focus', this.focusHandler);
		window.addEventListener('blur', this.focusHandler);
	}

	private removeBrowserEventHandlers() {
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

	private startHealthCheck() {
		this.clearHealthCheck();

		// Only start health check if page is visible
		if (document.visibilityState === 'visible') {
			this.healthCheckTimer = setInterval(() => {
				this.checkConnection();
			}, this.HEALTH_CHECK_INTERVAL) as unknown as number;
		}
	}

	private clearHealthCheck() {
		if (this.healthCheckTimer) {
			clearInterval(this.healthCheckTimer);
			this.healthCheckTimer = null;
		}
	}

	private checkConnection() {
		if (!this.socket || !this.conversationId) return;

		// Check if socket appears open but might be stale
		if (this.socket.readyState === WebSocket.OPEN && !this._status.value.isReady) {
			console.log('WebSocketManager: Detected stale connection, reconnecting');
			this.cleanup(true); // isReconnecting:true
			this.connect();
			return;
		}

		// Check if socket is closed or closing when it should be open
		if (
			(this.socket.readyState === WebSocket.CLOSED ||
				this.socket.readyState === WebSocket.CLOSING) &&
			this.conversationId
		) {
			console.log('WebSocketManager: Detected closed connection, reconnecting');
			this.connect();
			return;
		}
	}

	private clearTimeouts() {
		if (this.connectionTimeout) {
			console.log('WebSocketManager: Clearing connection timeout');
			clearTimeout(this.connectionTimeout);
			this.connectionTimeout = null;
		}
		if (this.retryTimeout) {
			console.log('WebSocketManager: Clearing retry timeout');
			clearTimeout(this.retryTimeout);
			this.retryTimeout = null;
		}
	}

	private scheduleRetry() {
		console.log('WebSocketManager: Scheduling retry', {
			retryCount: this.retryCount,
			maxRetries: this.MAX_RETRIES,
			conversationId: this.conversationId,
		});

		if (this.retryCount >= this.MAX_RETRIES) {
			console.log('WebSocketManager: Maximum retry attempts reached');
			this.handleError(new Error('Maximum retry attempts reached'));
			return;
		}

		// Calculate delay with exponential backoff
		const delay = Math.min(
			this.INITIAL_RETRY_DELAY * Math.pow(2, this.retryCount),
			this.MAX_RETRY_DELAY,
		);

		console.log('WebSocketManager: Setting retry timeout', {
			delay,
			retryAttempt: this.retryCount + 1,
		});

		this.retryCount++;
		this.retryTimeout = setTimeout(() => {
			console.log('WebSocketManager: Executing retry attempt', this.retryCount);
			this.retryTimeout = null;
			this.connect();
		}, delay) as unknown as number;
	}

	private handleError(error: Error) {
		console.error('WebSocketManager: Handling error:', {
			error,
			retryCount: this.retryCount,
			conversationId: this.conversationId,
		});

		// Don't cleanup here - let onclose handle it
		this.emit('error', error);
	}

	get status() {
		return this._status.value;
	}
}

export function createWebSocketManager(config: WebSocketManagerConfig): WebSocketManager {
	return new WebSocketManager(config);
}
