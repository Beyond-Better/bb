import { eventManager } from 'shared/eventManager.ts';
import type { EventName, EventPayloadMap } from 'shared/eventManager.ts';
//import type { ApiStatus, InteractionId, ProgressStatusMessage, PromptCacheTimerMessage } from 'shared/types.ts';
import type { InteractionId } from 'shared/types.ts';
import ApiClient from 'cli/apiClient.ts';
import { getProjectId, getWorkingRootFromStartDir } from 'shared/dataDir.ts';

export default class WebsocketManager {
	private cancellationRequested: boolean = false;
	public ws: WebSocket | null = null;
	private MAX_RETRIES = 5;
	private BASE_DELAY = 1000; // 1 second
	private retryCount = 0;
	private currentInteractionId!: InteractionId;
	private projectId!: string;

	async setupWebsocket(
		conversationId: InteractionId,
		projectId: string,
		hostname?: string,
		port?: number,
	): Promise<void> {
		this.currentInteractionId = conversationId;
		this.projectId = projectId;
		const connectWebSocket = async (): Promise<WebSocket> => {
			//console.log(`WebsocketManager: Connecting websocket for conversation: ${conversationId}`);
			try {
				const apiClient = await ApiClient.create(projectId, hostname, port);
				// apiClient.connectWebSocket returns a promise, so we return that promise rather than awaiting
				return apiClient.connectWebSocket(`/api/v1/ws/conversation/${conversationId}`);
			} catch (error) {
				await this.handleRetry(error as Error);
				return connectWebSocket();
			}
		};

		this.ws = await connectWebSocket();
		this.retryCount = 0; // Reset retry count on successful connection

		//console.log(`WebsocketManager: Setting up ws listeners for conversation: ${conversationId}`);
		this.setupEventListeners();

		//console.log(`WebsocketManager: Sending greeting for conversation: ${conversationId}`);
		await this.sendGreeting();
	}

	private removeEventListeners(): void {
		if (this.ws) {
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;
			this.ws.onopen = null;
		}
	}

	private setupEventListeners(): void {
		if (!this.ws) {
			throw new Error('WebSocket is not initialized');
		}

		// Remove any existing listeners
		this.removeEventListeners();

		this.ws!.onmessage = this.handleMessage.bind(this);
		this.ws!.onclose = this.handleClose.bind(this);
		this.ws!.onerror = this.handleError.bind(this);
		this.ws!.onopen = this.handleOpen.bind(this);
		// return new Promise<void>((resolve) => {
		// 	this.ws!.onmessage = this.handleMessage.bind(this);
		// 	this.ws!.onclose = this.handleClose.bind(this);
		// 	this.ws!.onerror = this.handleError.bind(this);
		// 	this.ws!.onopen = ((event: Event) => {
		// 		this.handleOpen(event);
		// 		resolve();
		// 	}).bind(this);
		// });
	}

	private handleOpen(_event: Event): void {
		//console.log('WebSocket connection opened');
		// Greeting is now sent after listener setup in setupWebsocket
	}

	updateConversation(conversationId: InteractionId): void {
		this.currentInteractionId = conversationId;
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.close();
		}
		this.setupWebsocket(conversationId, this.projectId);
	}

	private handleMessage(event: MessageEvent): void {
		const msgData = JSON.parse(event.data);
		//console.log(`WebsocketManager: WebSocket handling message for type: ${msgData.type}`);
		//if (!msgData.data.conversationId) console.log(`WebsocketManager: WebSocket handling message for type: ${msgData.type} - missing conversationId`, msgData.data);
		switch (msgData.type) {
			case 'collaborationNew':
				eventManager.emit(
					'cli:collaborationNew',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:collaborationNew'],
				);
				break;
			case 'collaborationReady':
				eventManager.emit(
					'cli:collaborationReady',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:collaborationReady'],
				);
				eventManager.emit(
					'cli:conversationWaitForReady',
					{
						conversationId: msgData.data.conversationId,
					} as EventPayloadMap['cli']['cli:conversationWaitForReady'],
				);
				break;
			case 'collaborationContinue':
				eventManager.emit(
					'cli:collaborationContinue',
					{ ...msgData.data, expectingMoreInput: true } as EventPayloadMap['cli']['cli:collaborationContinue'],
				);
				break;
			case 'collaborationAnswer':
				eventManager.emit(
					'cli:collaborationAnswer',
					{ ...msgData.data, expectingMoreInput: false } as EventPayloadMap['cli']['cli:collaborationAnswer'],
				);
				eventManager.emit(
					'cli:conversationWaitForAnswer',
					{
						conversationId: msgData.data.conversationId,
					} as EventPayloadMap['cli']['cli:conversationWaitForAnswer'],
				);
				break;
			case 'collaborationError':
				//console.error(`WebsocketManager: Received conversation error:`, msgData.data);
				eventManager.emit(
					'cli:collaborationError',
					{ ...msgData.data } as EventPayloadMap['cli']['cli:collaborationError'],
				);
				break;
			case 'progressStatus':
				eventManager.emit(
					'cli:progressStatus',
					{ ...msgData } as EventPayloadMap['cli']['cli:progressStatus'], //ProgressStatusMessage
				);
				break;
			case 'promptCacheTimer':
				eventManager.emit(
					'cli:promptCacheTimer',
					{ ...msgData } as EventPayloadMap['cli']['cli:promptCacheTimer'], //PromptCacheTimerMessage
				);
				break;
			default:
				console.error(`WebsocketManager: Received unknown message type: ${msgData.type}`);
		}
	}

	private async handleClose(): Promise<void> {
		this.removeEventListeners();
		await this.handleRetry(new Error('WebSocket connection closed'));
		await this.setupWebsocket(this.currentInteractionId, this.projectId);
		eventManager.emit(
			'cli:websocketReconnected',
			{ conversationId: this.currentInteractionId } as EventPayloadMap['cli']['cli:websocketReconnected'],
		);
	}

	private async handleError(event: Event): Promise<void> {
		this.removeEventListeners();
		const error = event instanceof ErrorEvent ? event.error : new Error('Unknown WebSocket error');
		await this.handleRetry(error);
		await this.setupWebsocket(this.currentInteractionId, this.projectId);
		eventManager.emit(
			'cli:websocketReconnected',
			{ conversationId: this.currentInteractionId } as EventPayloadMap['cli']['cli:websocketReconnected'],
		);
	}

	private async sendGreeting(): Promise<void> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			const workingRoot = await getWorkingRootFromStartDir(Deno.cwd());
			const projectId = await getProjectId(workingRoot);
			this.ws.send(
				JSON.stringify({
					conversationId: this.currentInteractionId,
					projectId: projectId,
					task: 'greeting',
					statement: '',
				}),
			);
		} else {
			console.error('WebSocket is not open when trying to send greeting. ReadyState:', this.ws?.readyState);
		}
	}

	async waitForReady(conversationId: InteractionId): Promise<void> {
		//console.log(`WebsocketManager: Waiting for ready event for conversation ${conversationId}`);
		await eventManager.once('cli:conversationWaitForReady' as EventName<'cli'>, conversationId) as Promise<
			EventPayloadMap['cli']['cli:conversationWaitForReady']
		>;
		//console.log(`WebsocketManager: Received ready event for conversation ${conversationId}`);
	}

	async waitForAnswer(conversationId: InteractionId): Promise<void> {
		//console.log(`WebsocketManager: Waiting for answer event for conversation ${conversationId}`);
		while (!this.cancellationRequested) {
			try {
				await Promise.race([
					eventManager.once('cli:conversationWaitForAnswer' as EventName<'cli'>, conversationId) as Promise<
						EventPayloadMap['cli']['cli:conversationWaitForAnswer']
					>,
					new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1000)),
				]);
				this.cancellationRequested = false;
				return;
			} catch (error) {
				if ((error as Error).message !== 'Timeout') throw error;
			}
		}
		this.cancellationRequested = false;
		//throw new Error('Operation cancelled');
		//console.log(`WebsocketManager: Waiting for answer event for conversation ${conversationId}`);
		await eventManager.once('cli:conversationWaitForAnswer' as EventName<'cli'>, conversationId) as Promise<
			EventPayloadMap['cli']['cli:conversationWaitForAnswer']
		>;
		//console.log(`WebsocketManager: Received answer event for conversation ${conversationId}`);
	}

	private async handleRetry(error: Error): Promise<void> {
		if (this.retryCount >= this.MAX_RETRIES) {
			console.error(
				`WebsocketManager: Failed to connect after ${this.MAX_RETRIES} attempts: ${error.message}`,
			);
			throw new Error(`Failed to connect after ${this.MAX_RETRIES} attempts: ${error.message}`);
		}
		if (this.retryCount >= 5) {
			console.log('WebsocketManager: WebSocket connection closed. Attempting to reconnect...');
			console.log(
				`WebsocketManager: Still unable to connect after ${this.retryCount} attempts: ${error.message}`,
			);
		} else if (this.retryCount >= 3) {
			console.log('WebsocketManager: WebSocket connection closed. Attempting to reconnect...');
		}
		this.retryCount++;
		const delay = Math.min(this.BASE_DELAY * Math.pow(2, this.retryCount) + Math.random() * 1000, 30000);
		//console.log(`WebsocketManager: Connection attempt failed. Retrying in ${delay / 1000} seconds...`);
		await new Promise((resolve) => setTimeout(resolve, delay));
	}

	sendCancellationMessage(conversationId: InteractionId): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.cancellationRequested = true;
			this.ws.send(JSON.stringify({ conversationId, task: 'cancel' }));
		} else {
			console.error('WebsocketManager: WebSocket is not open. Cannot send cancellation message.');
		}
	}
}

export const websocketManager = new WebsocketManager();
