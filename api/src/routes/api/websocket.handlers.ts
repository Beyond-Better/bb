import type { Context, RouterContext } from '@oak/oak';

import { projectEditorManager } from '../../editor/projectEditorManager.ts';
import { logger } from 'shared/logger.ts';
import type { ConversationId } from 'shared/types.ts';
import EventManager from 'shared/eventManager.ts';
import type { EventMap, EventName } from 'shared/eventManager.ts';

class WebSocketHandler {
	private listeners: Map<
		ConversationId,
		Array<{ event: EventName<keyof EventMap>; callback: (data: unknown) => void }>
	> = new Map();
	private activeConnections: Map<ConversationId, WebSocket> = new Map();

	constructor(private eventManager: EventManager) {
	}

	handleConnection(ws: WebSocket, conversationId: ConversationId) {
		try {
			// Check if there's an existing connection for this conversation ID
			const existingConnection = this.activeConnections.get(conversationId);
			if (existingConnection) {
				logger.warn(`Closing existing connection for conversationId: ${conversationId}`);
				existingConnection.close(1000, 'New connection established');
				this.removeConnection(existingConnection, conversationId);
			}

			// Set the new connection
			this.activeConnections.set(conversationId, ws);
			ws.onopen = () => {
				logger.info(`WebSocketHandler: WebSocket connection opened for conversationId: ${conversationId}`);
			};

			ws.onmessage = async (event) => {
				try {
					const message = JSON.parse(event.data);
					await this.handleMessage(conversationId, message);
				} catch (error) {
					logger.error(
						`WebSocketHandler: Error handling message for conversationId: ${conversationId}:`,
						error,
					);
					ws.send(JSON.stringify({ error: 'Invalid message format' }));
				}
			};

			ws.onclose = () => {
				logger.info(`WebSocketHandler: WebSocket connection closed for conversationId: ${conversationId}`);
				this.removeConnection(ws, conversationId);
			};

			ws.onerror = (event: Event | ErrorEvent) => {
				const errorMessage = event instanceof ErrorEvent ? event.message : 'Unknown WebSocket error';
				logger.error(`WebSocketHandler: WebSocket error for conversationId: ${conversationId}:`, errorMessage);
			};

			this.setupEventListeners(ws, conversationId);
		} catch (error) {
			logger.error(`Error in handleConnection for conversationId ${conversationId}:`, error);
			ws.close(1011, 'Internal Server Error');
			this.removeConnection(ws, conversationId);
		}
	}

	private async handleMessage(
		conversationId: ConversationId,
		message: { task: string; statement: string; startDir: string; options?: { maxTurns?: number } },
	) {
		try {
			const { task, statement, startDir, options } = message;
			//this.connections.set(ws, conversationId);
			//logger.info('WebSocketHandler: handleMessage', message);
			logger.info(`WebSocketHandler: handleMessage for conversationId ${conversationId}, task: ${task}`);

			const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, startDir);

			if (!projectEditor && task !== 'greeting' && task !== 'cancel') {
				this.eventManager.emit('projectEditor:conversationError', {
					conversationId,
					error: 'No active conversation',
					code: 'NO_ACTIVE_CONVERSATION',
				});
				return;
			}

			if (task === 'greeting') {
				if (!startDir) {
					logger.error(
						`WebSocketHandler: Start directory is required for greeting for conversationId: ${conversationId}`,
					);
					this.eventManager.emit('projectEditor:conversationError', {
						conversationId,
						error: 'Start directory is required for greeting',
						code: 'START_DIR_REQUIRED',
					});

					return;
				}

				try {
					//logger.info('WebSocketHandler: Emitting projectEditor:conversationReady event');
					this.eventManager.emit('projectEditor:conversationReady', {
						conversationId: conversationId,
						conversationTitle: projectEditor.orchestratorController.primaryInteraction.title,
						conversationStats: {
							statementCount: projectEditor.orchestratorController.statementCount,
						},
					});
				} catch (error) {
					logger.error(
						`WebSocketHandler: Error creating project editor for conversationId: ${conversationId}:`,
						error,
					);
					this.eventManager.emit('projectEditor:conversationError', {
						conversationId,
						error: 'Failed to create project editor',
						code: 'PROJECT_EDITOR_CREATION_FAILED',
					});
				}
				return;
			} else if (task === 'converse') {
				try {
					await projectEditor?.handleStatement(statement, conversationId, options);

					//const result = await projectEditor?.handleStatement(statement, conversationId);
					//logger.debug(`handleStatement result: ${JSON.stringify(result)}`);
				} catch (error) {
					logger.error(
						`WebSocketHandler: Error handling statement for conversationId: ${conversationId}:`,
						error,
					);
					this.eventManager.emit('projectEditor:conversationError', {
						conversationId,
						error: 'Error handling statement',
						code: 'STATEMENT_ERROR',
					});
				}
			} else if (task === 'cancel') {
				logger.error(`WebSocketHandler: Cancelling statement for conversationId: ${conversationId}`);
				try {
					projectEditor?.orchestratorController.cancelCurrentOperation(conversationId);
					this.eventManager.emit('projectEditor:conversationCancelled', {
						conversationId,
						message: 'Operation cancelled',
					});
				} catch (error) {
					logger.error(
						`WebSocketHandler: Error cancelling operation for conversationId: ${conversationId}:`,
						error,
					);
					this.eventManager.emit('projectEditor:conversationError', {
						conversationId,
						error: 'Error cancelling operation',
						code: 'CANCELLATION_ERROR',
					});
				}
			} else {
				logger.error(
					`WebSocketHandler: Error handling statement for conversationId: ${conversationId}, unknown task: ${task}`,
				);
				this.eventManager.emit('projectEditor:conversationError', {
					conversationId,
					error: `Error handling statement, unknown task: ${task}`,
					code: 'STATEMENT_ERROR',
				});
			}
		} catch (error) {
			logger.error(`Unhandled error in handleMessage for conversationId ${conversationId}:`, error);
			this.eventManager.emit('projectEditor:conversationError', {
				conversationId,
				error: 'Internal Server Error',
				code: 'INTERNAL_ERROR',
			});
			const ws = this.activeConnections.get(conversationId);
			if (ws) {
				this.removeConnection(ws, conversationId);
			}
		}
	}

	private setupEventListeners(ws: WebSocket, conversationId: ConversationId) {
		// Remove any existing listeners for this conversation ID
		this.removeEventListeners(conversationId);

		const listeners: Array<{ event: EventName<keyof EventMap>; callback: (data: unknown) => void }> = [
			{
				event: 'projectEditor:conversationReady',
				callback: (data) => this.sendMessage(ws, 'conversationReady', data),
			},
			{
				event: 'projectEditor:conversationContinue',
				callback: (data) => this.sendMessage(ws, 'conversationContinue', data),
			},
			{
				event: 'projectEditor:conversationAnswer',
				callback: (data) => this.sendMessage(ws, 'conversationAnswer', data),
			},
			{
				event: 'projectEditor:conversationError',
				callback: (data) => this.sendMessage(ws, 'conversationError', data),
			},
		];

		listeners.forEach((listener) => this.eventManager.on(listener.event, listener.callback, conversationId));

		// Store listeners for this conversation ID
		this.listeners.set(conversationId, listeners);

		// Remove listeners when the connection closes
		ws.addEventListener('close', () => this.removeEventListeners(conversationId));
	}

	private removeEventListeners(conversationId: ConversationId) {
		const listeners = this.listeners.get(conversationId);
		if (listeners) {
			listeners.forEach((listener) => {
				this.eventManager.off(listener.event, listener.callback, conversationId);
				logger.debug(
					`WebSocketHandler: Removed listener for event ${listener.event} for conversationId ${conversationId}`,
				);
			});
			this.listeners.delete(conversationId);
		}
	}

	private removeConnection(ws: WebSocket, conversationId: ConversationId) {
		this.activeConnections.delete(conversationId);
		projectEditorManager.releaseEditor(conversationId);
		ws.close();
		this.activeConnections.delete(conversationId);
		projectEditorManager.releaseEditor(conversationId);
		ws.close();
		// removeEventListeners is called by the 'close' event listener
		// so we don't need to call it explicitly here
	}

	// Method to send messages back to the client
	private sendMessage = (ws: WebSocket, type: string, data: unknown) => {
		//logger.debug(`WebSocketHandler: Sending message for conversationId: ${conversationId}: type=${type}, data=${JSON.stringify(data)}`);
		logger.info(`WebSocketHandler: Sending message of type: ${type}`);
		ws.send(JSON.stringify({ type, data }));
	};
}

export default WebSocketHandler;

// Create a single instance of EventManager and WebSocketHandler
const eventManager = EventManager.getInstance();
const wsHandler = new WebSocketHandler(eventManager);

// This is the function that gets mounted to the endpoint in apiRouter
export const websocketConversation = (ctx: Context) => {
	logger.debug('WebSocketHandler: websocketConversation called from router');

	try {
		const { id } = (ctx as RouterContext<'/conversation/:id', { id: string }>).params;
		const conversationId: ConversationId = id;

		if (!ctx.isUpgradable) {
			ctx.throw(400, 'Cannot upgrade to WebSocket');
		}
		const ws = ctx.upgrade();
		wsHandler.handleConnection(ws, conversationId);
		ctx.response.status = 200;
		//ctx.response.body = { status: 'CONNECTED' };
	} catch (error) {
		logger.error(`WebSocketHandler: Error in websocketConversation: ${error.message}`, error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to generate response', details: error.message };
	}
};
