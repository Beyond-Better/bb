import type { Context, RouterContext } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { projectEditorManager } from 'api/editor/projectEditorManager.ts';
import type Collaboration from 'api/collaborations/collaboration.ts';
import type {
	CollaborationId,
	CollaborationLogDataEntry,
	CollaborationResponse,
	InteractionId,
} from 'shared/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type { LLMRolesModelConfig } from 'api/types/llms.ts';
import type { CollaborationParams, CollaborationValues } from 'shared/types/collaboration.ts';
import CollaborationPersistence from 'api/storage/collaborationPersistence.ts';
//import InteractionPersistence from 'api/storage/interactionPersistence.ts';
import CollaborationLogger from 'api/storage/collaborationLogger.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { errorMessage } from 'shared/error.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
//import { getLLMModelToProvider } from 'api/types/llms.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/interactionManagement.ts';

/**
 * @openapi
 * /api/v1/collaborations:
 *   get:
 *     summary: List collaborations
 *     description: Retrieves a list of collaborations with pagination and filtering options
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter collaborations starting from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter collaborations up to this date
 *       - in: query
 *         name: llmProviderName
 *         schema:
 *           type: string
 *         description: Filter collaborations by LLM provider name
 *     responses:
 *       200:
 *         description: Successful response with list of collaborations
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const listCollaborations = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const projectId = request.url.searchParams.get('projectId');
	logger.info(`CollaborationHandler: listCollaborations called with projectId: ${projectId}`);

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

		logger.info('CollaborationHandler: Calling CollaborationPersistence.listCollaborations');
		const { collaborations, totalCount } = await CollaborationPersistence.listCollaborations({
			page: page,
			limit: limit,
			startDate: startDate ? new Date(startDate) : undefined,
			endDate: endDate ? new Date(endDate) : undefined,
			llmProviderName: llmProviderName || undefined,
			projectId: projectId,
		});

		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.getProjectConfig(projectId);

		const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;

		const registryService = await ModelRegistryService.getInstance(projectConfig);
		const orchestratorConfig = registryService.getModelConfig(
			defaultModels.orchestrator || DefaultModelsConfigDefaults.orchestrator,
		);
		const agentConfig = registryService.getModelConfig(defaultModels.agent || DefaultModelsConfigDefaults.agent);
		const chatConfig = registryService.getModelConfig(defaultModels.chat || DefaultModelsConfigDefaults.chat);

		response.status = 200;
		response.body = {
			collaborations: collaborations.map((collab: CollaborationValues) => ({
				id: collab.id,
				title: collab.title,
				type: collab.type,
				createdAt: collab.createdAt,
				updatedAt: collab.updatedAt,
				totalInteractions: collab.totalInteractions,
				lastInteractionId: collab.lastInteractionId,
				lastInteractionMetadata: collab.lastInteractionMetadata,
				tokenUsageStats: collab.tokenUsageStats,
				collaborationParams: {
					...(collab.collaborationParams || {}),
					rolesModelConfig: {
						orchestrator: collab.collaborationParams?.rolesModelConfig.orchestrator || orchestratorConfig,
						agent: collab.collaborationParams?.rolesModelConfig.agent || agentConfig,
						chat: collab.collaborationParams?.rolesModelConfig.chat || chatConfig,
					} as LLMRolesModelConfig,
				},
			})),
			pagination: {
				page: page,
				pageSize: limit,
				totalPages: Math.ceil(totalCount / limit),
				totalItems: totalCount,
			},
		};
	} catch (error) {
		logger.error(`CollaborationHandler: Error in listCollaborations: ${errorMessage(error)}`, error);
		response.status = 500;
		response.body = { error: 'Failed to list collaborations', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations:
 *   post:
 *     summary: Create a new collaboration
 *     description: Creates a new collaboration with the specified title and type
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - projectId
 *             properties:
 *               title:
 *                 type: string
 *                 description: The title of the collaboration
 *               type:
 *                 type: string
 *                 enum: [project, workflow, research]
 *                 default: project
 *                 description: The type of collaboration
 *               projectId:
 *                 type: string
 *                 description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with collaboration details
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const createCollaboration = async (
	{ request, response, app }: { request: Context['request']; response: Context['response']; app: Context['app'] },
) => {
	logger.debug('CollaborationHandler: createCollaboration called');

	try {
		const body = await request.body.json();
		const { title, type = 'project', projectId } = body;

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!title) {
			logger.warn('CollaborationHandler: Missing title');
			response.status = 400;
			response.body = { error: 'Missing title' };
			return;
		}

		if (!projectId) {
			logger.warn('CollaborationHandler: Missing projectId');
			response.status = 400;
			response.body = { error: 'Missing projectId' };
			return;
		}

		const collaborationId = shortenInteractionId(generateInteractionId());
		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);

		const collaborationPersistence = new CollaborationPersistence(collaborationId, projectEditor);
		await collaborationPersistence.init();

		await collaborationPersistence.saveCollaboration({
			title,
			type,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		response.status = 200;
		response.body = {
			collaborationId,
			title,
			type,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
	} catch (error) {
		logger.error(`CollaborationHandler: Error in createCollaboration: ${errorMessage(error)}`, error);
		response.status = 500;
		response.body = { error: 'Failed to create collaboration', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/{collaborationId}:
 *   get:
 *     summary: Get collaboration details
 *     description: Retrieves details of a specific collaboration
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the collaboration to retrieve
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID for configuration context
 *     responses:
 *       200:
 *         description: Successful response with collaboration details
 *       400:
 *         description: Bad request, missing required parameters
 *       404:
 *         description: Collaboration not found
 *       500:
 *         description: Internal server error
 */
export const getCollaboration = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId',
		{ collaborationId: string }
	>,
) => {
	try {
		const { collaborationId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		logger.info(`CollaborationHandler: getCollaboration for: ${collaborationId}`);

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);
		const collaborationPersistence = new CollaborationPersistence(collaborationId, projectEditor);
		await collaborationPersistence.init();

		const collaboration = await collaborationPersistence.loadCollaboration() as CollaborationValues;
		if (!collaboration) {
			response.status = 404;
			response.body = { error: 'Collaboration not found' };
			return;
		}

		response.status = 200;
		response.body = collaboration;
	} catch (error) {
		logger.error(`CollaborationHandler: Error in getCollaboration: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to retrieve collaboration', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/{collaborationId}:
 *   delete:
 *     summary: Delete a collaboration
 *     description: Deletes a specific collaboration and all its interactions
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the collaboration to delete
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with deletion confirmation
 *       400:
 *         description: Bad request, missing required parameters
 *       404:
 *         description: Collaboration not found
 *       500:
 *         description: Internal server error
 */
export const deleteCollaboration = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId',
		{ collaborationId: string }
	>,
) => {
	try {
		const { collaborationId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);
		const collaborationPersistence = new CollaborationPersistence(collaborationId, projectEditor);
		await collaborationPersistence.init();

		await collaborationPersistence.deleteCollaboration();

		response.status = 200;
		response.body = { message: `Collaboration ${collaborationId} deleted` };
	} catch (error) {
		logger.error(`CollaborationHandler: Error in deleteCollaboration: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to delete collaboration', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/{collaborationId}/interactions:
 *   post:
 *     summary: Create a new interaction within a collaboration
 *     description: Creates a new interaction as a child of the specified collaboration
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the parent collaboration
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parentInteractionId:
 *                 type: string
 *                 description: Optional parent interaction ID for nested interactions
 *               projectId:
 *                 type: string
 *                 description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with interaction details
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const createInteraction = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId/interactions',
		{ collaborationId: string }
	>,
) => {
	try {
		const { collaborationId } = params;
		const body = await request.body.json();
		const { parentInteractionId, projectId } = body;

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);
		const collaborationPersistence = new CollaborationPersistence(collaborationId, projectEditor);
		await collaborationPersistence.init();

		const interactionPersistence = await collaborationPersistence.createInteraction(
			parentInteractionId,
			app.state.llmCallbacks,
		);

		response.status = 200;
		response.body = {
			interactionId: interactionPersistence.interactionId,
			collaborationId,
		};
	} catch (error) {
		logger.error(`CollaborationHandler: Error in createInteraction: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to create interaction', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/{collaborationId}/interactions/{interactionId}:
 *   get:
 *     summary: Get interaction details
 *     description: Retrieves details of a specific interaction within a collaboration
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the parent collaboration
 *       - in: path
 *         name: interactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the interaction to retrieve
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with interaction details
 *       400:
 *         description: Bad request, missing required parameters
 *       404:
 *         description: Interaction not found
 *       500:
 *         description: Internal server error
 */
export const getInteraction = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId/interactions/:interactionId',
		{ collaborationId: string; interactionId: string }
	>,
) => {
	try {
		const { collaborationId, interactionId } = params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);
		const collaborationPersistence = new CollaborationPersistence(collaborationId, projectEditor);
		await collaborationPersistence.init();

		const interactionPersistence = await collaborationPersistence.getInteraction(interactionId as InteractionId);
		const interaction = await interactionPersistence.getInteractionData();

		if (!interaction) {
			response.status = 404;
			response.body = { error: 'Interaction not found' };
			return;
		}

		// Load log data entries for the interaction
		let logDataEntries: Array<CollaborationLogDataEntry>;
		try {
			logDataEntries = await CollaborationLogger.getLogDataEntries(projectId, interactionId as InteractionId);
		} catch (_error) {
			logDataEntries = [];
		}

		response.status = 200;
		response.body = {
			...interaction,
			logDataEntries,
		};
	} catch (error) {
		logger.error(`CollaborationHandler: Error in getInteraction: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to retrieve interaction', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/{collaborationId}/interactions/{interactionId}:
 *   post:
 *     summary: Chat in an interaction
 *     description: Continues an existing interaction with the AI assistant using the OrchestratorController
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the parent collaboration
 *       - in: path
 *         name: interactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the interaction to continue
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
 *                 description: The statement to continue the interaction
 *               projectId:
 *                 type: string
 *                 description: The project ID
 *               maxTurns:
 *                 type: integer
 *                 description: Maximum number of turns for this interaction
 *     responses:
 *       200:
 *         description: Successful response with interaction continuation
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const chatInteraction = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId/interactions/:interactionId',
		{ collaborationId: string; interactionId: string }
	>,
) => {
	logger.debug('CollaborationHandler: chatInteraction called');

	const { collaborationId, interactionId } = params;

	try {
		const body = await request.body.json();
		const { statement, projectId, maxTurns } = body;

		logger.info(
			`CollaborationHandler: chatInteraction for collaborationId: ${collaborationId}, interactionId: ${interactionId}, Prompt: "${
				statement?.substring(0, 50)
			}..."`,
		);

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!statement) {
			logger.warn(`CollaborationHandler: Missing statement for interactionId: ${interactionId}`);
			response.status = 400;
			response.body = { error: 'Missing statement' };
			return;
		}

		if (!projectId) {
			logger.warn(`CollaborationHandler: Missing projectId for interactionId: ${interactionId}`);
			response.status = 400;
			response.body = { error: 'Missing projectId' };
			return;
		}

		if (projectEditorManager.isCollaborationActive(interactionId)) {
			response.status = 400;
			response.body = { error: 'Interaction is already in use' };
			return;
		}

		logger.debug(
			`CollaborationHandler: Creating ProjectEditor for interactionId: ${interactionId} using projectId: ${projectId}`,
		);
		const projectEditor = await projectEditorManager.getOrCreateEditor(projectId, collaborationId, sessionManager);

		const result: CollaborationResponse = await projectEditor.handleStatement(
			statement,
			collaborationId,
			interactionId,
			{
				maxTurns,
			},
		);

		logger.debug(
			`CollaborationHandler: Response received from handleStatement for interactionId: ${interactionId}`,
		);
		response.status = 200;
		response.body = {
			collaborationId: result.collaborationId,
			interactionId: interactionId,
			logEntry: result.logEntry,
			collaborationTitle: result.collaborationTitle,
			interactionStats: result.interactionStats,
			tokenUsageStats: result.tokenUsageStats,
		};
	} catch (error) {
		logger.error(
			`CollaborationHandler: Error in chatInteraction for interactionId: ${interactionId}: ${
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
 * /api/v1/collaborations/{collaborationId}/interactions/{interactionId}:
 *   delete:
 *     summary: Delete an interaction
 *     description: Deletes a specific interaction within a collaboration
 *     parameters:
 *       - in: path
 *         name: collaborationId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the parent collaboration
 *       - in: path
 *         name: interactionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the interaction to delete
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with deletion confirmation
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const deleteInteraction = async (
	{ params, request, response, app }: RouterContext<
		'/v1/collaborations/:collaborationId/interactions/:interactionId',
		{ collaborationId: string; interactionId: string }
	>,
) => {
	try {
		const { collaborationId, interactionId }: { collaborationId: CollaborationId; interactionId: InteractionId } =
			params;
		const projectId = request.url.searchParams.get('projectId') || '';

		const sessionManager: SessionManager = app.state.auth.sessionManager;
		if (!sessionManager) {
			logger.warn('CollaborationHandler: No session manager configured');
			response.status = 400;
			response.body = { error: 'No session manager configured' };
			return;
		}

		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		const projectEditor = await projectEditorManager.getOrCreateEditor(
			projectId,
			collaborationId,
			sessionManager,
		);

		if (!projectEditor.orchestratorController) {
			throw new Error('Failed to initialize OrchestratorController');
		}

		projectEditor.orchestratorController.deleteInteraction(collaborationId, interactionId as InteractionId);

		response.status = 200;
		response.body = { message: `Interaction ${interactionId} deleted` };
	} catch (error) {
		logger.error(`CollaborationHandler: Error in deleteInteraction: ${errorMessage(error)}`);
		response.status = 500;
		response.body = { error: 'Failed to delete interaction', details: errorMessage(error) };
	}
};

/**
 * @openapi
 * /api/v1/collaborations/defaults:
 *   get:
 *     summary: Get collaboration defaults
 *     description: Retrieves default collaboration parameters including model configurations for each role
 *     parameters:
 *       - in: query
 *         name: projectId
 *         required: true
 *         schema:
 *           type: string
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Successful response with collaboration defaults
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: Empty ID for defaults
 *                 projectId:
 *                   type: string
 *                   description: The project ID
 *                 title:
 *                   type: string
 *                   description: Default collaboration title
 *                 type:
 *                   type: string
 *                   description: Default collaboration type
 *                 collaborationParams:
 *                   type: object
 *                   properties:
 *                     rolesModelConfig:
 *                       type: object
 *                       properties:
 *                         orchestrator:
 *                           type: object
 *                           description: Default model configuration for orchestrator role
 *                         agent:
 *                           type: object
 *                           description: Default model configuration for agent role
 *                         chat:
 *                           type: object
 *                           description: Default model configuration for chat role
 *                 totalInteractions:
 *                   type: integer
 *                   description: Default interaction count (0)
 *                 interactionIds:
 *                   type: array
 *                   description: Default empty interaction IDs array
 *                 tokenUsageStats:
 *                   type: object
 *                   description: Default token usage statistics
 *                 createdAt:
 *                   type: string
 *                   description: Default creation timestamp
 *                 updatedAt:
 *                   type: string
 *                   description: Default update timestamp
 *       400:
 *         description: Bad request, missing required parameters
 *       500:
 *         description: Internal server error
 */
export const getCollaborationDefaults = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	const projectId = request.url.searchParams.get('projectId');
	logger.info(`CollaborationHandler: getCollaborationDefaults called with projectId: ${projectId}`);

	try {
		if (!projectId) {
			response.status = 400;
			response.body = { error: 'Missing projectId parameter' };
			return;
		}

		logger.info('CollaborationHandler: Loading project configuration for collaboration defaults');
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.getProjectConfig(projectId);

		const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;

		const registryService = await ModelRegistryService.getInstance(projectConfig);
		const orchestratorConfig = registryService.getModelConfig(
			defaultModels.orchestrator || DefaultModelsConfigDefaults.orchestrator,
		);
		const agentConfig = registryService.getModelConfig(defaultModels.agent || DefaultModelsConfigDefaults.agent);
		const chatConfig = registryService.getModelConfig(defaultModels.chat || DefaultModelsConfigDefaults.chat);

		const collaborationDefaults: CollaborationValues = {
			id: '' as CollaborationId, // Empty ID for defaults
			projectId: projectId,
			title: 'New Collaboration',
			type: 'project',
			collaborationParams: {
				rolesModelConfig: {
					orchestrator: orchestratorConfig,
					agent: agentConfig,
					chat: chatConfig,
				} as LLMRolesModelConfig,
			},
			totalInteractions: 0,
			interactionIds: [],
			tokenUsageStats: {
				tokenUsageInteraction: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					thoughtTokens: 0,
					totalAllTokens: 0,
				},
				tokenUsageStatement: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					thoughtTokens: 0,
					totalAllTokens: 0,
				},
				tokenUsageTurn: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
					thoughtTokens: 0,
					totalAllTokens: 0,
				},
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		response.status = 200;
		response.body = collaborationDefaults;
	} catch (error) {
		logger.error(`CollaborationHandler: Error in getCollaborationDefaults: ${errorMessage(error)}`, error);
		response.status = 500;
		response.body = { error: 'Failed to get collaboration defaults', details: errorMessage(error) };
	}
};
