import { WebSocketManagerBaseImpl } from './websocketManagerBase.utils.ts';
import type {
	ConversationContinue,
	ConversationId,
	ConversationResponse,
	ConversationStats,
	TokenUsage,
} from 'shared/types.ts';
import type { WebSocketConfigChat } from '../types/websocket.types.ts';

interface WebSocketMessage {
	conversationId: string;
	projectId: string;
	task: 'greeting' | 'converse' | 'cancel';
	statement: string;
}

interface WebSocketResponse {
	type:
		| 'conversationNew'
		| 'conversationDeleted'
		| 'conversationReady'
		| 'conversationContinue'
		| 'conversationAnswer'
		| 'conversationError'
		| 'conversationCancelled'
		| 'progressStatus'
		| 'promptCacheTimer';
	data: {
		logEntry?: any;
		conversationTitle?: string;
		tokenUsageTurn?: TokenUsage;
		tokenUsageStatement?: TokenUsage;
		tokenUsageConversation?: TokenUsage;
		conversationStats?: ConversationStats;
		error?: string;
	};
}

export class WebSocketManagerChat extends WebSocketManagerBaseImpl {
	private conversationId: ConversationId | null = null;
	private projectId: string;

	constructor(config: WebSocketConfigChat) {
		super(config);
		if (!config.projectId) throw new Error('Project ID is required');
		this.projectId = config.projectId;
	}

	async setConversationId(id: ConversationId) {
		if (!id) throw new Error('Conversation ID cannot be empty');

		console.log('WebSocketManagerChat: Setting conversation ID:', {
			newId: id,
			currentId: this.conversationId,
			socketState: this.socket?.readyState,
			isReady: this._status.isReady,
		});

		// If we're already connected to this conversation, do nothing
		if (
			this.conversationId === id &&
			this.socket?.readyState === WebSocket.OPEN &&
			this._status.isReady
		) {
			console.log('WebSocketManagerChat: Already connected to this conversation');
			return;
		}

		// Reset connection state
		this.retryCount = 0;
		this.conversationId = id;

		// Start new connection
		await this.connect();
	}

	protected getWebSocketUrl(): string {
		if (!this.conversationId) {
			throw new Error('No conversation ID set');
		}
		return `${this.wsUrl}/conversation/${this.conversationId}`;
	}

	protected override onSocketOpen(): void {
		this.sendGreeting();
	}

	private sendGreeting(): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.conversationId) {
			console.log('WebSocketManagerChat: Cannot send greeting - socket not ready');
			return;
		}

		const message: WebSocketMessage = {
			conversationId: this.conversationId,
			projectId: this.projectId,
			task: 'greeting',
			statement: '',
		};

		console.log('WebSocketManagerChat: Sending greeting');
		this.socket.send(JSON.stringify(message));
	}

	async sendConverse(message: string): Promise<void> {
		if (!this.socket || !this.conversationId || !this._status.isReady) {
			throw new Error('WebSocket is not ready');
		}

		const wsMessage: WebSocketMessage = {
			conversationId: this.conversationId,
			projectId: this.projectId,
			task: 'converse',
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
			task: 'cancel',
		}));
	}

	protected handleMessage(event: MessageEvent): void {
		try {
			const msg = JSON.parse(event.data) as WebSocketResponse;
			console.log('WebSocketManagerChat: Received message:', msg.type);

			const generateLogEntryData = (
				msgData: WebSocketResponse,
				msgType: 'continue' | 'answer',
			): ConversationContinue | ConversationResponse => {
				const baseEntry = {
					conversationId: this.conversationId!,
					conversationTitle: '',
					timestamp: msgData.data.logEntry?.timestamp || new Date().toISOString(),
					logEntry: msgData.data.logEntry,
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
					tokenUsageConversation: msgData.data.tokenUsageConversation || {
						totalTokens: 0,
						inputTokens: 0,
						outputTokens: 0,
					},
					conversationStats: msgData.data.conversationStats || {
						statementCount: 0,
						statementTurnCount: 0,
						conversationTurnCount: 0,
					},
					formattedContent: msgData.data.logEntry?.formattedContent,
				};

				return baseEntry as any;
			};

			switch (msg.type) {
				case 'conversationNew':
					this.emit('message', {
						msgType: 'conversationNew',
						logEntryData: msg.data,
					});
					break;

				case 'conversationDeleted':
					this.emit('message', {
						msgType: 'conversationDeleted',
						logEntryData: msg.data,
					});
					break;

				case 'conversationReady':
					this._status.isConnecting = false;
					this._status.isReady = true;
					this.emit('readyChange', true);
					this.emit('statusChange', true);
					this.emit('clearError');
					this.startHealthCheck();
					break;

				case 'conversationContinue':
					this.emit('message', {
						msgType: 'continue',
						logEntryData: generateLogEntryData(msg, 'continue'),
					});
					break;

				case 'conversationAnswer':
					this.emit('message', {
						msgType: 'answer',
						logEntryData: generateLogEntryData(msg, 'answer'),
					});
					break;

				case 'conversationCancelled':
					this._status.isReady = true;
					this.emit('readyChange', true);
					this.emit('cancelled', msg.data);
					break;

				case 'progressStatus':
					console.log('WebSocketManagerChat: Received progressStatus:', msg.data);
					this.emit('progressStatus', msg.data);
					break;

				case 'promptCacheTimer':
					console.log('WebSocketManagerChat: Received promptCacheTimer:', msg.data);
					this.emit('promptCacheTimer', msg.data);
					break;

				case 'conversationError':
					console.error('WebSocketManagerChat: Conversation error:', msg.data);
					if (msg.data.error) {
						this.handleError(new Error(msg.data.error));
					}
					break;

				default:
					console.warn('WebSocketManagerChat: Unknown message type:', msg.type);
			}
		} catch (error) {
			console.error('WebSocketManagerChat: Error processing message:', error);
			this.handleError(error as Error);
		}
	}

	override disconnect(): void {
		// Clear conversation ID before disconnect to prevent any late cleanup events
		this.conversationId = null;
		// Remove all event listeners before disconnecting
		this.eventHandlers.clear();
		super.disconnect();
	}
}

export function createWebSocketManagerChat(config: WebSocketConfigChat): WebSocketManagerChat {
	return new WebSocketManagerChat(config);
}