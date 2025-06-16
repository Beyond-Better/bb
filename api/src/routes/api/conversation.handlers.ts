import type { Context, RouterContext } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import type { CollaborationLogDataEntry, ConversationId, ConversationResponse } from 'shared/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type { LLMRolesModelConfig } from 'api/types/llms.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import CollaborationLogger from 'api/storage/collaborationLogger.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { errorMessage } from 'shared/error.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getLLMModelToProvider } from 'api/types/llms.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

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
				errorMessage(error)
			}`,
			error,
		);
		response.status = 500;
		response.body = { error: 'Failed to generate response', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/conversation/{id}:
 *   get:
 *     summary: Get conversation details or defaults
 *     description: Retrieves details of a specific conversation. If the conversation doesn't exist, returns a template with default configuration values from global/project settings.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the conversation to retrieve
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID for configuration context
 *     responses:
 *       200:
 *         description: Successful response with conversation details or default template
 *       400:
 *         description: Bad request, missing required parameters
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

		logger.info(`ConversationHandler: getConversation for: ${conversationId}`);

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn(
				`ConversationHandler: HandlerContinueConversation: No session manager configured`,
			);
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		let interaction;
		try {
			//logger.info(`ConversationHandler: Creating ProjectEditor for dir: ${projectId}`);
			projectEditor = await projectEditorManager.getOrCreateEditor(conversationId, projectId, sessionManager);
			//logger.info(`ConversationHandler: ProjectEditor created successfully`);

			orchestratorController = projectEditor.orchestratorController;
			if (!orchestratorController) {
				logger.info(`ConversationHandler: Failed to create orchestratorController`);
				throw new Error('Failed to initialize OrchestratorController');
			}

			//logger.info(`ConversationHandler: Getting conversation: ${conversationId}`);
			interaction = orchestratorController.interactionManager.getInteraction(conversationId);
		} catch (error) {
			// getInteraction throws an error when conversation doesn't exist
			logger.info(
				`ConversationHandler: Conversation ${conversationId} not found, will return defaults: ${
					errorMessage(error)
				}`,
			);
			interaction = null;
		}

		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.getProjectConfig(projectId);

		if (!interaction) {
			logger.info(`ConversationHandler: Conversation not found, return defaults`);
			// Return a default conversation template with configuration defaults
			// Use project defaults first, then global defaults
			const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;
			const defaultModelOrchestrator = defaultModels.orchestrator || DefaultModelsConfigDefaults.orchestrator;

			response.status = 200;
			response.body = {
				id: conversationId,
				llmProviderName: (await getLLMModelToProvider())[defaultModelOrchestrator] || 'anthropic', // Default provider
				title: '', // Empty for new conversation
				system: '', // Will be populated when conversation starts
				model: defaultModels.orchestrator,
				maxTokens: 16384,
				temperature: 0.7, // Default temperature
				statementTurnCount: 0,
				totalTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				logDataEntries: [], // Empty for new conversation
				conversationStats: {
					statementTurnCount: 0,
					conversationTurnCount: 0,
					statementCount: 0,
				},
				tokenUsageStats: {
					tokenUsageConversation: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				},
				// Include default request params for this conversation
				collaborationParams: {
					rolesModelConfig: {
						orchestrator: {
							model: defaultModels.orchestrator,
							temperature: 0.7,
							maxTokens: 16384,
							extendedThinking: {
								enabled: projectConfig.api?.extendedThinking?.enabled ??
									globalConfig.api.extendedThinking?.enabled ?? true,
								budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
									globalConfig.api.extendedThinking?.budgetTokens || 4096,
							},
							usePromptCaching: projectConfig.api?.usePromptCaching ??
								globalConfig.api.usePromptCaching ??
								true,
						},
						agent: {
							model: defaultModels.agent,
							temperature: 0.7,
							maxTokens: 16384,
							extendedThinking: {
								enabled: projectConfig.api?.extendedThinking?.enabled ??
									globalConfig.api.extendedThinking?.enabled ?? true,
								budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
									globalConfig.api.extendedThinking?.budgetTokens || 4096,
							},
							usePromptCaching: projectConfig.api?.usePromptCaching ??
								globalConfig.api.usePromptCaching ??
								true,
						},
						chat: {
							model: defaultModels.chat,
							temperature: 0.7,
							maxTokens: 4096,
							extendedThinking: {
								enabled: false,
								budgetTokens: 0,
							},
							usePromptCaching: projectConfig.api?.usePromptCaching ??
								globalConfig.api.usePromptCaching ??
								true,
						},
					},
				},
			};
			return;
		}

		//logger.info(`ConversationHandler: Loading log data entries for conversation ${conversationId}`);
		let logDataEntries: Array<CollaborationLogDataEntry>;
		try {
			logDataEntries = await CollaborationLogger.getLogDataEntries(projectId, conversationId);
			logger.debug(`ConversationHandler: Log data entries loaded successfully`);
		} catch (_error) {
			// New conversations don't have log files yet
			logger.debug(
				`ConversationHandler: No log data found for new conversation ${conversationId}, using empty array`,
			);
			logDataEntries = [];
		}
		//logger.info(`ConversationHandler: logDataEntries`, logDataEntries);
		// logger.info(`ConversationHandler: inputOptions`, {
		// 	model: interaction.model,
		// 	maxTokens: interaction.maxTokens,
		// 	temperature: interaction.temperature,
		// });
		response.status = 200;
		response.body = {
			id: interaction.id,
			llmProviderName: interaction.llmProviderName,
			title: interaction.title,
			system: interaction.baseSystem,
			model: interaction.model,
			maxTokens: interaction.maxTokens,
			temperature: interaction.temperature,
			statementTurnCount: interaction.statementTurnCount,
			totalTokenUsage: interaction.totalTokensTotal,
			logDataEntries,
			conversationStats: {
				statementTurnCount: interaction.statementTurnCount,
				conversationTurnCount: interaction.conversationTurnCount,
				statementCount: interaction.statementCount,
			},
			tokenUsageStats: {
				tokenUsageConversation: interaction.tokenUsageInteraction,
			},
			collaborationParams: interaction.collaboration.collaborationParams,
			//rolesModelConfig: interaction.collaboration.collaborationParams.rolesModelConfig,
			// requestParams: {
			// 	model: interaction.model,
			// 	temperature: interaction.temperature,
			// 	maxTokens: interaction.maxTokens,
			// 	extendedThinking: {
			// 		enabled: projectConfig.api?.extendedThinking?.enabled ??
			// 			globalConfig.api.extendedThinking?.enabled ?? true,
			// 		budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
			// 			globalConfig.api.extendedThinking?.budgetTokens || 4096,
			// 	},
			// 	usePromptCaching: projectConfig.api?.usePromptCaching ?? globalConfig.api.usePromptCaching ?? true,
			// },
		};
	} catch (error) {
		logger.error(`ConversationHandler: Error in getConversation: ${errorMessage(error)}`);
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
		logger.error(`ConversationHandler: Error in deleteConversation: ${errorMessage(error)}`);
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
				tokenUsageStats: conv.tokenUsageStats,
				collaborationParams: conv.collaborationParams,
				//rolesModelConfig: conv.collaborationParams?.rolesModelConfig,
			})),
			pagination: {
				page: page,
				pageSize: limit,
				totalPages: Math.ceil(totalCount / limit),
				totalItems: totalCount,
			},
		};
	} catch (error) {
		logger.error(`ConversationHandler: Error in listConversations: ${errorMessage(error)}`, error);
		response.status = 500;
		response.body = { error: 'Failed to list conversations', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/conversation/defaults:
 *   get:
 *     summary: Get default conversation input options
 *     description: Returns default LLM request parameters based on global and project configuration
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID for configuration context
 *     responses:
 *       200:
 *         description: Successful response with default input options
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const getConversationDefaults = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const projectId = request.url.searchParams.get('projectId') || '';

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		// Get configuration
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.getProjectConfig(projectId);

		// Use project defaults first, then global defaults
		const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;

		const registryService = await ModelRegistryService.getInstance(projectConfig);
		const orchestratorCapabilities = registryService.getModelCapabilities(defaultModels.orchestrator);
		const agentCapabilities = registryService.getModelCapabilities(defaultModels.agent);
		const chatCapabilities = registryService.getModelCapabilities(defaultModels.chat);

		// Create model configs for each role using capabilities
		const orchestratorConfig = {
			model: defaultModels.orchestrator,
			temperature: orchestratorCapabilities?.defaults.temperature ?? 0.7,
			maxTokens: orchestratorCapabilities?.defaults.maxTokens ?? 16384,
			extendedThinking: {
				enabled: orchestratorCapabilities?.supportedFeatures.extendedThinking ??
					(projectConfig.api?.extendedThinking?.enabled ?? globalConfig.api.extendedThinking?.enabled ?? true),
				budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
					globalConfig.api.extendedThinking?.budgetTokens || 4096,
			},
			usePromptCaching: orchestratorCapabilities?.supportedFeatures.promptCaching ??
				(projectConfig.api?.usePromptCaching ?? globalConfig.api.usePromptCaching ?? true),
		};

		const agentConfig = {
			model: defaultModels.agent,
			temperature: agentCapabilities?.defaults.temperature ?? 0.7,
			maxTokens: agentCapabilities?.defaults.maxTokens ?? 16384,
			extendedThinking: {
				enabled: agentCapabilities?.supportedFeatures.extendedThinking ??
					(projectConfig.api?.extendedThinking?.enabled ?? globalConfig.api.extendedThinking?.enabled ?? true),
				budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
					globalConfig.api.extendedThinking?.budgetTokens || 4096,
			},
			usePromptCaching: agentCapabilities?.supportedFeatures.promptCaching ??
				(projectConfig.api?.usePromptCaching ?? globalConfig.api.usePromptCaching ?? true),
		};

		const chatConfig = {
			model: defaultModels.chat,
			temperature: chatCapabilities?.defaults.temperature ?? 0.7,
			maxTokens: chatCapabilities?.defaults.maxTokens ?? 4096,
			extendedThinking: {
				enabled: false, // Chat role typically doesn't need extended thinking
				budgetTokens: 0,
			},
			usePromptCaching: chatCapabilities?.supportedFeatures.promptCaching ??
				(projectConfig.api?.usePromptCaching ?? globalConfig.api.usePromptCaching ?? true),
		};

		response.status = 200;
		response.body = {
			rolesModelConfig: {
				orchestrator: orchestratorConfig,
				agent: agentConfig,
				chat: chatConfig,
			},
		};
	} catch (error) {
		logger.error(`ConversationHandler: Error in getConversationDefaults: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to retrieve default conversation options' };
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
		logger.error(`ConversationHandler: Error in clearConversation: ${errorMessage(error)}`);
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
