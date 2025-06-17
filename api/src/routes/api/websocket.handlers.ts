import type { Context, RouterContext } from '@oak/oak';

import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import { logger } from 'shared/logger.ts';
import type { InteractionId } from 'shared/types.ts';
//import type { LLMRequestParams } from 'api/types/llms.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import EventManager from 'shared/eventManager.ts';
import type { EventMap, EventName } from 'shared/eventManager.ts';
import { getVersionInfo } from 'shared/version.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { isError, isLLMError } from 'api/errors/error.ts';

class WebSocketChatHandler {
	private listeners: Map<
		InteractionId,
		Array<{ event: EventName<keyof EventMap>; callback: (data: unknown) => void }>
	> = new Map();
	private activeConnections: Map<InteractionId, WebSocket> = new Map();

	constructor(private eventManager: EventManager) {
	}

	private readonly LOAD_TIMEOUT = 10000; // 10 seconds timeout for loading conversations

	handleConnection(ws: WebSocket, conversationId: InteractionId, sessionManager: SessionManager) {
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

			// Set timeout for conversation loading
			const loadTimeout = setTimeout(() => {
				if (this.activeConnections.has(conversationId)) {
					logger.error(`WebSocketChatHandler: Timeout loading conversation: ${conversationId}`);
					this.eventManager.emit('projectEditor:collaborationError', {
						conversationId,
						error: 'Timeout loading conversation',
						code: 'LOAD_TIMEOUT',
					});
					this.removeConnection(ws, conversationId);
				}
			}, this.LOAD_TIMEOUT);

			ws.onopen = () => {
				logger.info(`WebSocketChatHandler: WebSocket connection opened for conversationId: ${conversationId}`);
			};

			ws.onmessage = async (event) => {
				try {
					// Clear load timeout on first message
					clearTimeout(loadTimeout);

					const message = JSON.parse(event.data);
					await this.handleMessage(conversationId, message, sessionManager);
				} catch (error) {
					logger.error(
						`WebSocketChatHandler: Error handling message for conversationId: ${conversationId}:`,
						error,
					);
					ws.send(JSON.stringify({ error: 'Invalid message format' }));
				}
			};

			ws.onclose = () => {
				// Clear load timeout on close
				clearTimeout(loadTimeout);
				logger.info(`WebSocketChatHandler: WebSocket connection closed for conversationId: ${conversationId}`);
				this.removeConnection(ws, conversationId);
			};

			ws.onerror = (event: Event | ErrorEvent) => {
				const errorMessage = event instanceof ErrorEvent ? event.message : 'Unknown WebSocket error';
				logger.error(
					`WebSocketChatHandler: WebSocket error for conversationId: ${conversationId}:`,
					errorMessage,
				);
			};

			this.setupEventListeners(ws, conversationId);
		} catch (error) {
			logger.error(`Error in handleConnection for conversationId ${conversationId}:`, error);
			ws.close(1011, 'Internal Server Error');
			this.removeConnection(ws, conversationId);
		}
	}

	private async handleMessage(
		conversationId: InteractionId,
		message: {
			task: string;
			statement: string;
			projectId: string;
			options?: { maxTurns?: number }; // statement options
			statementParams: StatementParams; // LLM request params
			filesToAttach?: string[]; // Array of file IDs to include in message
			dataSourceIdForAttach?: string; // Data source to load attached files from
		},
		sessionManager: SessionManager,
	) {
		try {
			const { task, statement, projectId, options, statementParams, filesToAttach, dataSourceIdForAttach } =
				message;
			logger.info(`WebSocketChatHandler: handleMessage for conversationId ${conversationId}, task: ${task}`);
			//logger.info('WebSocketChatHandler: sessionManager', sessionManager);

			if (!projectId) {
				logger.error(
					`WebSocketChatHandler: projectId is required for conversationId: ${conversationId}`,
				);
				this.eventManager.emit('projectEditor:collaborationError', {
					conversationId,
					error: 'Project ID is required',
					code: 'PROJECT_ID_REQUIRED',
				});
				return;
			}

			const projectEditor = await projectEditorManager.getOrCreateEditor(
				conversationId,
				projectId,
				sessionManager,
			);

			//if (!projectEditor && task !== 'greeting' && task !== 'cancel') {
			if (!projectEditor) {
				logger.error(
					`WebSocketChatHandler: No projectEditor for conversationId: ${conversationId}`,
				);
				this.eventManager.emit('projectEditor:collaborationError', {
					conversationId,
					error: 'No active conversation',
					code: 'NO_ACTIVE_CONVERSATION',
				});
				return;
			}

			if (task === 'greeting') {
				try {
					const versionInfo = await getVersionInfo();
					const interaction = projectEditor.orchestratorController.interactionManager.getInteractionStrict(
						conversationId,
					);
					this.eventManager.emit('projectEditor:collaborationReady', {
						conversationId: conversationId,
						collaborationTitle: interaction.title,
						interactionStats: {
							statementCount: interaction.statementCount,
						},
						versionInfo,
					});
				} catch (error) {
					logger.error(
						`WebSocketChatHandler: Error creating project editor for conversationId: ${conversationId}:`,
						error,
					);
					this.eventManager.emit('projectEditor:collaborationError', {
						conversationId,
						error: 'Failed to create project editor',
						code: 'PROJECT_EDITOR_CREATION_FAILED',
					});
				}
				return;
			} else if (task === 'converse') {
				try {
					//logger.info('WebSocketChatHandler: filesToAttach', filesToAttach);
					await projectEditor?.handleStatement(
						statement,
						conversationId,
						options,
						statementParams,
						filesToAttach,
						dataSourceIdForAttach,
					);
				} catch (error) {
					logger.error(
						`WebSocketChatHandler: Error handling statement for conversationId ${conversationId}:`,
						error,
					);
					if (!isLLMError(error)) {
						// orchestratorController will emit collaborationError for LLMError - we do it for all other types
						const errorMessage = isError(error)
							? `Error handling statement: ${error.message}`
							: 'Error handling statement';
						this.eventManager.emit('projectEditor:collaborationError', {
							conversationId,
							error: errorMessage,
							code: 'STATEMENT_ERROR',
						});
					}
				}
			} else if (task === 'cancel') {
				logger.error(`WebSocketChatHandler: Cancelling statement for conversationId ${conversationId}`);
				try {
					projectEditor?.orchestratorController.cancelCurrentOperation(conversationId);
					this.eventManager.emit('projectEditor:collaborationCancelled', {
						conversationId,
						message: 'Operation cancelled',
					});
				} catch (error) {
					logger.error(
						`WebSocketChatHandler: Error cancelling operation for conversationId: ${conversationId}:`,
						error,
					);
					const errorMessage = isError(error)
						? `Error cancelling operation: ${error.message}`
						: 'Error cancelling operation';
					this.eventManager.emit('projectEditor:collaborationError', {
						conversationId,
						error: errorMessage,
						code: 'CANCELLATION_ERROR',
					});
				}
			} else {
				logger.error(
					`WebSocketChatHandler: Error handling statement for conversationId ${conversationId}, unknown task: ${task}`,
				);
				this.eventManager.emit('projectEditor:collaborationError', {
					conversationId,
					error: `Error handling statement, unknown task: ${task}`,
					code: 'STATEMENT_ERROR',
				});
			}
		} catch (error) {
			logger.error(`Unhandled error in handleMessage for conversationId ${conversationId}:`, error);
			this.eventManager.emit('projectEditor:collaborationError', {
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

	private setupEventListeners(ws: WebSocket, conversationId: InteractionId) {
		// Remove any existing listeners for this conversation ID
		this.removeEventListeners(conversationId);

		const listeners: Array<{ event: EventName<keyof EventMap>; callback: (data: unknown) => void }> = [
			{
				event: 'projectEditor:collaborationNew',
				callback: (data) => this.sendMessage(ws, 'collaborationNew', data),
			},
			{
				event: 'projectEditor:collaborationDeleted',
				callback: (data) => this.sendMessage(ws, 'collaborationDeleted', data),
			},
			{
				event: 'projectEditor:collaborationReady',
				callback: (data) => this.sendMessage(ws, 'collaborationReady', data),
			},
			{
				event: 'projectEditor:collaborationCancelled',
				callback: (data) => this.sendMessage(ws, 'collaborationCancelled', data),
			},
			{
				event: 'projectEditor:collaborationContinue',
				callback: (data) => this.sendMessage(ws, 'collaborationContinue', data),
			},
			{
				event: 'projectEditor:collaborationAnswer',
				callback: (data) => this.sendMessage(ws, 'collaborationAnswer', data),
			},
			{
				event: 'projectEditor:collaborationError',
				callback: (data) => this.sendMessage(ws, 'collaborationError', data),
			},
			{
				event: 'projectEditor:progressStatus',
				callback: (data) => this.sendMessage(ws, 'progressStatus', data),
			},
			{
				event: 'projectEditor:promptCacheTimer',
				callback: (data) => this.sendMessage(ws, 'promptCacheTimer', data),
			},
		];

		listeners.forEach((listener) => this.eventManager.on(listener.event, listener.callback, conversationId));

		// Store listeners for this conversation ID
		this.listeners.set(conversationId, listeners);

		// Remove listeners when the connection closes
		ws.addEventListener('close', () => this.removeEventListeners(conversationId));
	}

	private removeEventListeners(conversationId: InteractionId) {
		const listeners = this.listeners.get(conversationId);
		if (listeners) {
			listeners.forEach((listener) => {
				this.eventManager.off(listener.event, listener.callback, conversationId);
				logger.debug(
					`WebSocketChatHandler: Removed listener for event ${listener.event} for conversationId ${conversationId}`,
				);
			});
			this.listeners.delete(conversationId);
		}
	}

	private removeConnection(ws: WebSocket, conversationId: InteractionId) {
		// Only perform cleanup once
		if (this.activeConnections.has(conversationId)) {
			this.activeConnections.delete(conversationId);
			projectEditorManager.releaseEditor(conversationId);

			// Only close if the socket is still open
			if (ws.readyState === ws.OPEN) {
				ws.close(1000, 'Connection removed');
			}
		}
		// removeEventListeners is called by the 'close' event listener
		// so we don't need to call it explicitly here
	}

	// Method to send messages back to the client
	private sendMessage = (ws: WebSocket, type: string, data: unknown) => {
		logger.info(`WebSocketChatHandler: Sending message of type: ${type}`);
		if (type === 'collaborationError') logger.info(`WebSocketChatHandler: error:`, data);
		ws.send(JSON.stringify({ type, data }));
	};
}

class WebSocketAppHandler {
	private activeConnections: Set<WebSocket> = new Set();

	constructor() {}

	handleConnection(ws: WebSocket) {
		try {
			this.activeConnections.add(ws);

			ws.onopen = () => {
				logger.info('WebSocketAppHandler: WebSocket connection opened');
			};

			ws.onmessage = async (event) => {
				try {
					const message = JSON.parse(event.data);
					await this.handleMessage(ws, message);
				} catch (error) {
					logger.error('WebSocketAppHandler: Error handling message:', error);
					ws.send(JSON.stringify({
						type: 'error',
						data: { error: 'Invalid message format' },
					}));
				}
			};

			ws.onclose = () => {
				logger.info('WebSocketAppHandler: WebSocket connection closed');
				this.removeConnection(ws);
			};

			ws.onerror = (event: Event | ErrorEvent) => {
				const errorMessage = event instanceof ErrorEvent ? event.message : 'Unknown WebSocket error';
				logger.error('WebSocketAppHandler: WebSocket error:', errorMessage);
			};
		} catch (error) {
			logger.error('WebSocketAppHandler: Error in handleConnection:', error);
			ws.close(1011, 'Internal Server Error');
			this.removeConnection(ws);
		}
	}

	private async handleMessage(ws: WebSocket, message: { type: string }) {
		try {
			const { type } = message;
			logger.info(`WebSocketAppHandler: handleMessage type: ${type}`);

			if (type === 'greeting') {
				try {
					const versionInfo = await getVersionInfo();
					this.sendMessage(ws, 'hello', { versionInfo });
				} catch (error) {
					logger.error('WebSocketAppHandler: Error getting version info:', error);
					this.sendMessage(ws, 'error', {
						error: 'Failed to get version info',
						code: 'VERSION_INFO_FAILED',
					});
				}
			} else {
				logger.error(`WebSocketAppHandler: Unknown message type: ${type}`);
				this.sendMessage(ws, 'error', {
					error: `Unknown message type: ${type}`,
					code: 'UNKNOWN_MESSAGE_TYPE',
				});
			}
		} catch (error) {
			logger.error('WebSocketAppHandler: Unhandled error in handleMessage:', error);
			this.sendMessage(ws, 'error', {
				error: 'Internal Server Error',
				code: 'INTERNAL_ERROR',
			});
			this.removeConnection(ws);
		}
	}

	private removeConnection(ws: WebSocket) {
		this.activeConnections.delete(ws);
		if (ws.readyState === ws.OPEN) {
			ws.close(1000, 'Connection removed');
		}
	}

	private sendMessage(ws: WebSocket, type: string, data: unknown) {
		logger.info(`WebSocketAppHandler: Sending message of type: ${type}`);
		if (type === 'error') logger.info('WebSocketAppHandler: error:', data);
		ws.send(JSON.stringify({ type, data }));
	}
}

// Create instances of handlers
const eventManager = EventManager.getInstance();
const chatHandler = new WebSocketChatHandler(eventManager);
const appHandler = new WebSocketAppHandler();

// Router endpoint handlers
export const websocketConversation = (ctx: Context) => {
	logger.debug('WebSocketHandler: websocketConversation called from router');
	//logger.info('WebSocketHandler: sessionManager', ctx.app.state.auth.sessionManager);

	try {
		const { id } = (ctx as RouterContext<'/conversation/:id', { id: string }>).params;
		const conversationId: InteractionId = id;
		const sessionManager: SessionManager = ctx.app.state.auth.sessionManager;

		if (!sessionManager) {
			ctx.throw(400, 'No session manager configured');
		}
		if (!ctx.isUpgradable) {
			ctx.throw(400, 'Cannot upgrade to WebSocket');
		}
		const ws = ctx.upgrade();
		chatHandler.handleConnection(ws, conversationId, sessionManager);
		ctx.response.status = 200;
	} catch (error) {
		logger.error(`WebSocketHandler: Error in websocketConversation: ${(error as Error).message}`, error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to generate response', details: (error as Error).message };
	}
};

export const websocketApp = (ctx: Context) => {
	logger.debug('WebSocketHandler: websocketApp called from router');

	try {
		if (!ctx.isUpgradable) {
			ctx.throw(400, 'Cannot upgrade to WebSocket');
		}
		const ws = ctx.upgrade();
		appHandler.handleConnection(ws);
		ctx.response.status = 200;
	} catch (error) {
		logger.error(`WebSocketHandler: Error in websocketApp: ${(error as Error).message}`, error);
		ctx.response.status = 500;
		ctx.response.body = { error: 'Failed to generate response', details: (error as Error).message };
	}
};
