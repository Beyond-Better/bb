import { WebSocketManagerBaseImpl } from './websocketManagerBase.utils.ts';
import type {
	CollaborationContinue,
	InteractionId,
	CollaborationResponse,
	InteractionStats,
	TokenUsage,
} from 'shared/types.ts';
import type { LLMAttachedFile, LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
import type { WebSocketConfigChat } from '../types/websocket.types.ts';
import type { CollaborationLogEntry } from 'api/storage/collaborationLogger.ts';
import type { StatementParams } from 'shared/types/collaborationParams.ts';

interface WebSocketMessage {
	conversationId: string;
	projectId: string;
	task: 'greeting' | 'converse' | 'cancel';
	statement: string;
	options?: { maxTurns?: number };
	statementParams?: StatementParams;
	filesToAttach?: string[];
}

// interface WebSocketLogEntry {
// 	timestamp: string;
// 	logEntry: CollaborationLogEntry;
// 	formattedContent: string;
// }

interface WebSocketResponse {
	type:
		| 'collaborationNew'
		| 'collaborationDeleted'
		| 'collaborationReady'
		| 'collaborationContinue'
		| 'collaborationAnswer'
		| 'collaborationError'
		| 'collaborationCancelled'
		| 'progressStatus'
		| 'promptCacheTimer';
	data: {
		logEntry?: CollaborationLogEntry;
		timestamp?: string;
		collaborationTitle?: string;
		messageId: string;
		parentMessageId: string | null;
		agentInteractionId: string | null;
		tokenUsageStats: {
			tokenUsageTurn?: TokenUsage;
			tokenUsageStatement?: TokenUsage;
			tokenUsageInteraction?: TokenUsage;
		};
		interactionStats?: InteractionStats;
		statementParams: StatementParams;
		formattedContent?: string;
		error?: string;
	};
}

export class WebSocketManagerChat extends WebSocketManagerBaseImpl {
	private conversationId: InteractionId | null = null;
	private projectId: string;

	constructor(config: WebSocketConfigChat) {
		super(config);
		if (!config.projectId) throw new Error('Project ID is required');
		this.projectId = config.projectId;
	}

	async setConversationId(id: InteractionId) {
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

	// deno-lint-ignore require-await
	async sendConverse(
		message: string,
		statementParams?: StatementParams,
		attachedFiles?: LLMAttachedFiles,
	): Promise<void> {
		if (!this.socket || !this.conversationId || !this._status.isReady) {
			throw new Error('WebSocket is not ready');
		}
		//console.log('WebSocketManagerChat: sendConverse-attachedFiles', attachedFiles);

		// Get file IDs for successfully uploaded files
		const filesToAttach = attachedFiles
			? attachedFiles
				.filter((file: LLMAttachedFile) => file.uploadStatus === 'complete' && file.fileId)
				.map((file: LLMAttachedFile) => file.fileId!)
				.filter(Boolean)
			: [];
		//console.log('WebSocketManagerChat: sendConverse-filesToAttach', filesToAttach);

		const wsMessage: WebSocketMessage = {
			conversationId: this.conversationId,
			projectId: this.projectId,
			task: 'converse',
			statement: message,
			options: {}, // statement options
			statementParams, // LLM request params
			filesToAttach,
		};

		this.socket.send(JSON.stringify(wsMessage));
	}

	// deno-lint-ignore require-await
	async sendCancellation(): Promise<void> {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.conversationId) {
			throw new Error('WebSocket not ready to send cancellation');
		}

		this.socket.send(JSON.stringify({
			conversationId: this.conversationId,
			projectId: this.projectId,
			task: 'cancel',
		}));
	}

	protected handleMessage(event: MessageEvent): void {
		try {
			const msg = JSON.parse(event.data) as WebSocketResponse;
			console.log('WebSocketManagerChat: Received message:', msg.type);

			const generateLogDataEntry = (
				msgData: WebSocketResponse,
				_msgType: 'continue' | 'answer',
			): CollaborationContinue | CollaborationResponse => {
				const baseEntry = {
					conversationId: this.conversationId!,
					collaborationTitle: '',
					messageId: msgData.data.messageId,
					parentMessageId: msgData.data.parentMessageId,
					agentInteractionId: msgData.data.agentInteractionId,
					//timestamp: msgData.data.logEntry?.timestamp || new Date().toISOString(),
					timestamp: msgData.data.timestamp || new Date().toISOString(),
					logEntry: msgData.data.logEntry,
					statementParams: msgData.data.statementParams,
					tokenUsageStats: {
						tokenUsageTurn: msgData.data.tokenUsageStats.tokenUsageTurn || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
						tokenUsageStatement: msgData.data.tokenUsageStats.tokenUsageStatement || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
						tokenUsageInteraction: msgData.data.tokenUsageStats.tokenUsageInteraction || {
							totalTokens: 0,
							inputTokens: 0,
							outputTokens: 0,
						},
					},
					interactionStats: msgData.data.interactionStats || {
						statementCount: 0,
						statementTurnCount: 0,
						interactionTurnCount: 0,
					},
					formattedContent: msgData.data.formattedContent,
				};

				return baseEntry as CollaborationContinue | CollaborationResponse;
			};

			switch (msg.type) {
				case 'collaborationNew':
					this.emit('message', {
						msgType: 'collaborationNew',
						logDataEntry: msg.data,
					});
					break;

				case 'collaborationDeleted':
					this.emit('message', {
						msgType: 'collaborationDeleted',
						logDataEntry: msg.data,
					});
					break;

				case 'collaborationReady':
					this._status.isConnecting = false;
					this._status.isReady = true;
					this.emit('readyChange', true);
					this.emit('statusChange', true);
					this.emit('clearError');
					this.startHealthCheck();
					break;

				case 'collaborationContinue':
					this.emit('message', {
						msgType: 'continue',
						logDataEntry: generateLogDataEntry(msg, 'continue') as CollaborationContinue,
					});
					break;

				case 'collaborationAnswer':
					this.emit('message', {
						msgType: 'answer',
						logDataEntry: generateLogDataEntry(msg, 'answer') as CollaborationResponse,
					});
					break;

				case 'collaborationCancelled':
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

				case 'collaborationError':
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
