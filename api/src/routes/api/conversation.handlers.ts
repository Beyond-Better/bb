import type { Context, RouterContext } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { projectEditorManager } from '../../editor/projectEditorManager.ts';
import type { ConversationId, ConversationResponse } from 'shared/types.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import ConversationLogger from 'api/storage/conversationLogger.ts';
import type { SessionManager } from '../../auth/session.ts';

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   post:
 *     summary: Chat in an conversation
 *     description: Continues an existing conversation with the AI assistant using the OrchestratorController
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to continue
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - statement
 *               - projectId
 *             properties:
 *               statement:
 *                 type: string
 *                 description: The statement to continue the conversation
 *               projectId:
 *                 type: string
 *                 description: The starting directory for the project
 *     responses:
 *       200:
 *         description: Successful response with conversation continuation
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */

export const chatConversation = async (
	{ params, request, response, app }: RouterContext<'/v1/conversation/:id', { id: string }>,
) => {
	logger.debug('ConversationHandler: chatConversation called');

	const { id: conversationId } = params;

	try {
		const body = await request.body.json();
		const { statement, projectId, maxTurns } = body;

		logger.info(
			`ConversationHandler: chatConversation for conversationId: ${conversationId}, Prompt: "${
				statement?.substring(0, 50)
			}..."`,
		);

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!statement) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: Missing statement for conversationId: ${conversationId}`,
			);
			response.status = 400;
			response.body = { error: 'Missing statement' };
			return;
		}

		if (!projectId) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: Missing projectId for conversationId: ${conversationId}`,
			);
			response.status = 400;
			response.body = { error: 'Missing projectId' };
			return;
		}

		if (projectEditorManager.isConversationActive(conversationId)) {
			response.status = 400;
			response.body = { error: 'Conversation is already in use' };
			return;
		}

		logger.debug(
			`ConversationHandler: HandlerContinueConversation: Creating ProjectEditor for conversationId: ${conversationId} using projectId: ${projectId}`,
		);
		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, projectId, sessionManager);

		const result: ConversationResponse = await projectEditor.handleStatement(statement, conversationId, {
			maxTurns,
		});

		logger.debug(
			`ConversationHandler: HandlerContinueConversation: Response received from handleStatement for conversationId: ${conversationId}`,
		);
		response.status = 200;
		response.body = {
			conversationId: result.conversationId,
			logEntry: result.logEntry,
			conversationTitle: result.conversationTitle,
			conversationStats: result.conversationStats,
			tokenUsageStats: result.tokenUsageStats,
		};
	} catch (error) {
		logger.error(
			`ConversationHandler: Error in chatConversation for conversationId: ${conversationId}: ${
				(error as Error).message
			}`,
			error,
		);
		response.status = 500;
		response.body = { error: 'Failed to generate response', details: (error as Error).message };
	}
};

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   get:
 *     summary: Get conversation details
 *     description: Retrieves details of a specific conversation using the OrchestratorController
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to retrieve
 *     responses:
 *       200:
 *         description: Successful response with conversation details
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
export const getConversation = async (
	{ params, request, response, app }: RouterContext<'/v1/conversation/:id', { id: string }>,
) => {
	let projectEditor;
	let orchestratorController;
	try {
		const conversationId = params.id as ConversationId;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		logger.debug(`ConversationHandler: Creating ProjectEditor for dir: ${projectId}`);
		projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, projectId, sessionManager);

		orchestratorController = projectEditor.orchestratorController;
		if (!orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const interaction = orchestratorController.interactionManager.getInteraction(conversationId);

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		const logEntries = await ConversationLogger.getLogEntries(projectId, conversationId);
		//logger.info(`ConversationHandler: logEntries`, logEntries);
		response.status = 200;
		response.body = {
			id: interaction.id,
			llmProviderName: interaction.llmProviderName,
			title: interaction.title,
			system: interaction.baseSystem,
			model: interaction.model,
			maxTokens: interaction.maxTokens,
			temperature: interaction.temperature,
			statementTurnCount: orchestratorController.statementTurnCount,
			totalTokenUsage: orchestratorController.totalTokensTotal,
			logEntries,
			conversationStats: {
				statementTurnCount: interaction.statementTurnCount,
				conversationTurnCount: interaction.conversationTurnCount,
				statementCount: interaction.statementCount,
			},
			tokenUsageStats: {
				tokenUsageConversation: interaction.tokenUsageInteraction,
			},
		};
	} catch (error) {
		logger.error(`ConversationHandler: Error in getConversation: ${(error as Error).message}`);
		response.status = 404;
		response.body = { error: 'Conversation not found' };
	}
};

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   delete:
 *     summary: Delete a conversation
 *     description: Deletes a specific conversation
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to delete
 *     responses:
 *       200:
 *         description: Successful response with deletion confirmation
 *       404:
 *         description: Conversation not found
 *       500:
 *         description: Internal server error
 */
export const deleteConversation = async (
	{ params, request, response, app }: RouterContext<'/v1/conversation/:id', { id: string }>,
	//	{ params, response }: { params: { id: string }; response: Context['response'] },
) => {
	try {
		const { id: conversationId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(
			conversationId as ConversationId,
			projectId,
			sessionManager,
		);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		projectEditor.orchestratorController.deleteConversation(conversationId as ConversationId);

		response.status = 200;
		response.body = { message: `Conversation ${conversationId} deleted` };
	} catch (error) {
		logger.error(`ConversationHandler: Error in deleteConversation: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to delete conversation' };
	}
};

/**
 * @openapi
 * /api/v1/conversations:
 *   get:
 *     summary: List conversations
 *     description: Retrieves a list of conversations with pagination and filtering options
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter conversations starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter conversations up to this date
 *       - in: query
 *         name: llmProviderName
 *         schema:
 *           type: string
 *         description: Filter conversations by LLM provider name
 *     responses:
 *       200:
 *         description: Successful response with list of conversations
 *       500:
 *         description: Internal server error
 */
export const listConversations = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const projectId = request.url.searchParams.get('projectId');
	//logger.info(`ConversationHandler: listConversations called with projectId: ${projectId}`);
	try {
		const params = request.url.searchParams;
		const page = parseInt(params.get('page') || '1');
		const limit = parseInt(params.get('limit') || '10');
		const startDate = params.get('startDate');
		const endDate = params.get('endDate');
		const llmProviderName = params.get('llmProviderName');

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		//logger.info('ConversationHandler: Calling ConversationPersistence.listConversations');
		const { conversations, totalCount } = await ConversationPersistence.listConversations({
			page: page,
			limit: limit,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			llmProviderName: llmProviderName || undefined,
			projectId: projectId,
		});

		response.status = 200;
		response.body = {
			conversations: conversations.map((conv) => ({
				id: conv.id,
				title: conv.title,
				createdAt: conv.createdAt,
				updatedAt: conv.updatedAt,
				llmProviderName: conv.llmProviderName,
				model: conv.model,
				conversationStats: conv.conversationStats,
				tokenUsageStats:  conv.tokenUsageStats,
				requestParams:  conv.requestParams,
			})),
			pagination: {
				page: page,
				pageSize: limit,
				totalPages: Math.ceil(totalCount / limit),
				totalItems: totalCount,
			},
		};
	} catch (error) {
		const errorMessage = (error as Error).message;
		logger.error(`ConversationHandler: Error in listConversations: ${errorMessage}`, error);
		response.status = 500;
		response.body = { error: 'Failed to list conversations', details: errorMessage };
	}
};

export const clearConversation = async (
	{ params, request, response, app }: RouterContext<'/v1/conversation/:id/clear', { id: string }>,
) => {
	try {
		const { id: conversationId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(
			conversationId as ConversationId,
			projectId,
			sessionManager,
		);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const interaction = projectEditor.orchestratorController.interactionManager.getInteraction(
			conversationId as ConversationId,
		);
		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		interaction.clearMessages();

		response.status = 200;
		response.body = { message: `Conversation ${conversationId} cleared` };
	} catch (error) {
		logger.error(`ConversationHandler: Error in clearConversation: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to clear conversation' };
	}
};

/*
export const undoConversation = async (
	{ params, request, response, app }: RouterContext<'/v1/conversation/:id/undo', { id: string }>,
) => {
	try {
		const { id: conversationId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(conversationId as ConversationId, projectId, sessionManager);

		// orchestratorController already defined
		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		const interaction = projectEditor.orchestratorController.interactionManager.getInteraction(conversationId as ConversationId);
		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Conversation not found' };
			return;
		}

		await interaction.revertLastChange();

		response.status = 200;
		response.body = { message: `Last change in conversation ${conversationId} undone` };
	} catch (error) {
		logger.error(`ConversationHandler: Error in undoConversation: ${error.message}`);
		response.status = 500;
		response.body = { error: 'Failed to undo last change in conversation' };
	}
};

 */
