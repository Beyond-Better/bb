import { WebSocketManagerBaseImpl } from './websocketManagerBase.utils.ts';
import type {
	CollaborationContinue,
	CollaborationParams,
	CollaborationResponse,
	CollaborationType,
	InteractionId,
	InteractionStats,
	ProjectId,
	TokenUsage,
} from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE_REQUIRED } from 'shared/types.ts';
import type { LLMAttachedFile, LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
import type { WebSocketConfigChat } from '../types/websocket.types.ts';
import type { CollaborationLogEntry } from 'api/storage/collaborationLogger.ts';
import type { StatementParams } from 'shared/types/collaborationParams.ts';

interface WebSocketMessage {
	collaborationId: string;
	projectId: ProjectId;
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
		collaborationType: CollaborationType;
		collaborationParams: CollaborationParams;
		projectId: ProjectId;
		createdAt: string;
		updatedAt: string;
		totalInteractions: number;
		interactionIds: InteractionId[];
		interactionId: string;
		messageId: string;
		parentMessageId: string | null;
		agentInteractionId: string | null;
		tokenUsageStatsForCollaboration: {
			tokenUsageTurn?: TokenUsage;
			tokenUsageStatement?: TokenUsage;
			tokenUsageInteraction?: TokenUsage;
			tokenUsageCollaboration?: TokenUsage;
		};
		interactionStats?: InteractionStats;
		statementParams: StatementParams;
		formattedContent?: string;
		error?: string;
	};
}

export class WebSocketManagerChat extends WebSocketManagerBaseImpl {
	private collaborationId: InteractionId | null = null;
	private projectId: ProjectId;

	constructor(config: WebSocketConfigChat) {
		super(config);
		if (!config.projectId) throw new Error('Project ID is required');
		this.projectId = config.projectId;
	}

	async setCollaborationId(id: InteractionId) {
		if (!id) throw new Error('Collaboration ID cannot be empty');

		console.log('WebSocketManagerChat: Setting collaboration ID:', {
			newId: id,
			currentId: this.collaborationId,
			socketState: this.socket?.readyState,
			isReady: this._status.isReady,
		});

		// If we're already connected to this collaboration, do nothing
		if (
			this.collaborationId === id &&
			this.socket?.readyState === WebSocket.OPEN &&
			this._status.isReady
		) {
			console.log('WebSocketManagerChat: Already connected to this collaboration');
			return;
		}

		// Reset connection state
		this.retryCount = 0;
		this.collaborationId = id;

		// Start new connection
		await this.connect();
	}

	protected getWebSocketUrl(): string {
		if (!this.collaborationId) {
			throw new Error('No collaboration ID set');
		}
		return `${this.wsUrl}/collaboration/${this.collaborationId}`;
	}

	protected override onSocketOpen(): void {
		this.sendGreeting();
	}

	private sendGreeting(): void {
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.collaborationId) {
			console.log('WebSocketManagerChat: Cannot send greeting - socket not ready');
			return;
		}

		const message: WebSocketMessage = {
			collaborationId: this.collaborationId,
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
		if (!this.socket || !this.collaborationId || !this._status.isReady) {
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
		//console.log('WebSocketManagerChat: sendConverse-statementParams', statementParams);

		const wsMessage: WebSocketMessage = {
			collaborationId: this.collaborationId,
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
		if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.collaborationId) {
			throw new Error('WebSocket not ready to send cancellation');
		}

		this.socket.send(JSON.stringify({
			collaborationId: this.collaborationId,
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
					collaborationId: this.collaborationId!,
					collaborationTitle: '',
					messageId: msgData.data.messageId,
					parentMessageId: msgData.data.parentMessageId,
					agentInteractionId: msgData.data.agentInteractionId,
					interactionId: msgData.data.interactionId,
					collaborationType: msgData.data.collaborationType,
					collaborationParams: msgData.data.collaborationParams,
					projectId: msgData.data.projectId,
					createdAt: msgData.data.createdAt,
					updatedAt: msgData.data.updatedAt,
					totalInteractions: msgData.data.totalInteractions,
					interactionIds: msgData.data.interactionIds,
					//timestamp: msgData.data.logEntry?.timestamp || new Date().toISOString(),
					timestamp: msgData.data.timestamp || new Date().toISOString(),
					logEntry: msgData.data.logEntry,
					statementParams: msgData.data.statementParams,
					tokenUsageStatsForCollaboration: {
						tokenUsageTurn: msgData.data.tokenUsageStatsForCollaboration.tokenUsageTurn ||DEFAULT_TOKEN_USAGE_REQUIRED(),
						tokenUsageStatement: msgData.data.tokenUsageStatsForCollaboration.tokenUsageStatement ||DEFAULT_TOKEN_USAGE_REQUIRED(),
						tokenUsageInteraction: msgData.data.tokenUsageStatsForCollaboration.tokenUsageInteraction ||DEFAULT_TOKEN_USAGE_REQUIRED(),
						tokenUsageCollaboration: msgData.data.tokenUsageStatsForCollaboration.tokenUsageCollaboration ||DEFAULT_TOKEN_USAGE_REQUIRED(),
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
					console.error('WebSocketManagerChat: Collaboration error:', msg.data);
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
		// Clear collaboration ID before disconnect to prevent any late cleanup events
		this.collaborationId = null;
		// Remove all event listeners before disconnecting
		this.eventHandlers.clear();
		super.disconnect();
	}
}

export function createWebSocketManagerChat(config: WebSocketConfigChat): WebSocketManagerChat {
	return new WebSocketManagerChat(config);
}
