import { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';
import { LLMModelToProvider, LLMProviderLabel } from 'api/types/llms.ts';

/**
 * @openapi
 * /api/v1/model:
 *   get:
 *     summary: List available models
 *     description: Returns a list of all available models with their provider information
 *     parameters:
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: pageSize
 *         in: query
 *         description: Number of models per page
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of models
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 models:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: claude-3-5-sonnet-20241022
 *                       provider:
 *                         type: string
 *                         example: anthropic
 *                       providerLabel:
 *                         type: string
 *                         example: Anthropic
 *                       contextWindow:
 *                         type: integer
 *                         example: 200000
 *                       responseSpeed:
 *                         type: string
 *                         enum: [fast, medium, slow]
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     pageCount:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
export const listModels = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		logger.info('ModelHandler: listModels called');

		// Initialize the model capabilities manager
		const capabilitiesManager = ModelCapabilitiesManager.getInstance();
		await capabilitiesManager.initialize();

		// Parse pagination parameters
		const url = new URL(request.url);
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = parseInt(url.searchParams.get('pageSize') || '20');

		// Get all available models from LLMModelToProvider mapping
		const allModels = Object.entries(LLMModelToProvider).map(([modelId, provider]) => {
			// Get model capabilities
			const capabilities = capabilitiesManager.getModelCapabilities(modelId, provider);

			return {
				id: modelId,
				displayName: capabilities.displayName,
				provider,
				providerLabel: LLMProviderLabel[provider] || 'Unknown',
				contextWindow: capabilities.contextWindow,
				responseSpeed: capabilities.responseSpeed || 'medium',
			};
		});

		// Apply pagination
		const total = allModels.length;
		const startIndex = (page - 1) * pageSize;
		const endIndex = startIndex + pageSize;
		const paginatedModels = allModels.slice(startIndex, endIndex);

		// Calculate pagination metadata
		const pageCount = Math.ceil(total / pageSize);

		response.status = 200;
		response.body = {
			models: paginatedModels,
			pagination: {
				total,
				page,
				pageSize,
				pageCount,
			},
		};
	} catch (error) {
		logger.error(`ModelHandler: Error in listModels: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to list models', details: (error as Error).message };
	}
};

/**
 * @openapi
 * /api/v1/model/{modelId}:
 *   get:
 *     summary: Get model capabilities
 *     description: Returns detailed capabilities for a specific model
 *     parameters:
 *       - name: modelId
 *         in: path
 *         required: true
 *         description: The model identifier
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Model capabilities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 model:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     providerLabel:
 *                       type: string
 *                     capabilities:
 *                       type: object
 *       404:
 *         description: Model not found
 *       500:
 *         description: Internal server error
 */
export const getModelCapabilities = async (
	{ params, response }: { params: { modelId: string }; response: Context['response'] },
) => {
	try {
		//logger.info(`ModelHandler: getModelCapabilities called for model ${params.modelId}`);

		// Get the model ID from params
		const modelId = params.modelId;

		// Initialize the model capabilities manager
		const capabilitiesManager = await ModelCapabilitiesManager.getInstance().initialize();

		// Get the model's capabilities
		const capabilities = capabilitiesManager.getModelCapabilities(modelId);

		if (!capabilities) {
			response.status = 404;
			response.body = { error: `Model not found: ${modelId}` };
			return;
		}

		// Look up the provider for this model
		const provider = LLMModelToProvider[modelId];

		response.status = 200;
		response.body = {
			model: {
				id: modelId,
				displayName: capabilities.displayName,
				provider,
				providerLabel: LLMProviderLabel[provider] || 'Unknown',
				capabilities,
			},
		};
	} catch (error) {
		logger.error(`ModelHandler: Error in getModelCapabilities: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to get model capabilities', details: (error as Error).message };
	}
};
