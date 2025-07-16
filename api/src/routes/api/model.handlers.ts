import type { Context } from '@oak/oak';
import { logger } from 'shared/logger.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { type LLMProvider, LLMProviderLabel } from 'api/types/llms.ts';
import type { ModelInfo } from 'api/types/modelCapabilities.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { SupabaseClientFactory } from 'api/auth/session.ts';
import { ModelAccess } from 'shared/features.ts';

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
 *       - name: provider
 *         in: query
 *         description: Filter by specific provider
 *         schema:
 *           type: string
 *           enum: [anthropic, openai, google, groq, deepseek, ollama]
 *       - name: source
 *         in: query
 *         description: Filter by model source (static or dynamic)
 *         schema:
 *           type: string
 *           enum: [static, dynamic]
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
 *                         example: claude-3-7-sonnet-20250219
 *                       displayName:
 *                         type: string
 *                         example: Claude Sonnet 3.7
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
 *                       source:
 *                         type: string
 *                         enum: [static, dynamic]
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
	ctx: Context,
) => {
	const { request, response } = ctx;
	try {
		logger.info('ModelHandler: listModels called');

		// Initialize the model registry service
		// [TODO] Ideally we pass projectConfig to getInstance since project may have different llmProviders
		const registryService = await ModelRegistryService.getInstance();

		// Get configuration to check localMode
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const isLocalMode = globalConfig.api.localMode ?? false;

		// Parse pagination and filter parameters
		const url = new URL(request.url);
		const page = parseInt(url.searchParams.get('page') || '1');
		const pageSize = parseInt(url.searchParams.get('pageSize') || '50');
		const providerFilter = url.searchParams.get('provider');
		const sourceFilter = url.searchParams.get('source') as 'static' | 'dynamic' | null;

		// Get all available models from the registry service
		let allModels = registryService.getAllModels();

		// Filter out local-only models when not in local mode
		if (!isLocalMode) {
			allModels = allModels.filter((model: ModelInfo) => !model.localOnly);
		}
		//logger.info('ModelHandler: listModels', allModels);

		// Apply filters
		if (providerFilter) {
			allModels = allModels.filter((model: ModelInfo) => model.provider === providerFilter);
		}

		if (sourceFilter) {
			allModels = allModels.filter((model: ModelInfo) => model.source === sourceFilter);
		}

		// Get user session for feature access checks
		const session = ctx.state?.session;
		let userHasAccess: Record<string, boolean> = {};

		//logger.info('ModelHandler: session', session);

		// Perform feature access checks if user is authenticated
		if (session?.user?.id) {
			try {
				// Create Supabase clients for both schemas
				const supabaseCore = await SupabaseClientFactory.createClient('abi_core', true);
				const supabaseBilling = await SupabaseClientFactory.createClient('abi_billing', true);
				
				// Batch check feature access for all models
				const accessChecks = await Promise.allSettled(
					allModels.map(async (model) => {
						if (!model.capabilities.featureKey) return { modelId: model.id, hasAccess: true };
						
						const hasAccess = await ModelAccess.hasModel(
							supabaseCore,
							supabaseBilling,
							session.user.id,
							model.capabilities.featureKey
						);
						return { modelId: model.id, hasAccess };
					})
				);
				
				// Process results
				accessChecks.forEach((result, index) => {
					if (result.status === 'fulfilled') {
						userHasAccess[result.value.modelId] = result.value.hasAccess;
					} else {
						// On error, default to no access for security
						userHasAccess[allModels[index].id] = false;
						logger.warn(`Feature access check failed for model ${allModels[index].id}:`, result.reason);
					}
				});
			} catch (error) {
				logger.error('Failed to perform feature access checks:', error);
				// Default to no access for all models on error
				allModels.forEach(model => {
					userHasAccess[model.id] = false;
				});
			}
		} else {
			// No authenticated user, default to no access
			allModels.forEach(model => {
				userHasAccess[model.id] = false;
			});
		}

		// Transform models for API response
		const transformedModels = allModels.map((model: ModelInfo) => ({
			id: model.id,
			displayName: model.displayName,
			provider: model.provider,
			providerLabel: LLMProviderLabel[model.provider as LLMProvider] || 'Unknown',
			contextWindow: model.capabilities.contextWindow,
			maxOutputTokens: model.capabilities.maxOutputTokens,
			responseSpeed: model.capabilities.responseSpeed || 'medium',
			cost: model.capabilities.cost || 'medium',
			intelligence: model.capabilities.intelligence || 'medium',
			supportedFeatures: model.capabilities.supportedFeatures,
			releaseDate: model.capabilities.releaseDate,
			trainingCutoff: model.capabilities.trainingCutoff,
			source: model.source,
			featureKey: model.capabilities.featureKey,
			userHasAccess: userHasAccess[model.id] ?? false,
		}));

		// Apply pagination
		const total = transformedModels.length;
		const startIndex = (page - 1) * pageSize;
		const endIndex = startIndex + pageSize;
		const paginatedModels = transformedModels.slice(startIndex, endIndex);
		//logger.info('ModelHandler: paginatedModels', paginatedModels);

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
 *                     displayName:
 *                       type: string
 *                     provider:
 *                       type: string
 *                     providerLabel:
 *                       type: string
 *                     source:
 *                       type: string
 *                     capabilities:
 *                       type: object
 *       404:
 *         description: Model not found
 *       500:
 *         description: Internal server error
 */
export const getModelCapabilities = async (
	ctx: Context & { params: { modelId: string } },
) => {
	const { params, response } = ctx;
	try {
		// Get the model ID from params
		const modelId = params.modelId;

		// Initialize the model registry service
		const registryService = await ModelRegistryService.getInstance();

		// Get configuration to check localMode
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const isLocalMode = globalConfig.api.localMode ?? false;

		// Get the model information
		const modelInfo = registryService.getModel(modelId);

		if (!modelInfo) {
			response.status = 404;
			response.body = { error: `Model not found: ${modelId}` };
			return;
		}

		// Check if model is local-only and we're not in local mode
		if (modelInfo.localOnly && !isLocalMode) {
			response.status = 403;
			response.body = { error: `Model ${modelId} is only available in local mode` };
			return;
		}

		// Get user session for feature access check
		const session = ctx.state?.session;
		let userHasAccess = false;

		// Perform feature access check if user is authenticated
		if (session?.user?.id && modelInfo.capabilities.featureKey) {
			try {
				// Create Supabase clients for both schemas
				const supabaseCore = await SupabaseClientFactory.createClient('abi_core');
				const supabaseBilling = await SupabaseClientFactory.createClient('abi_billing');
				
				userHasAccess = await ModelAccess.hasModel(
					supabaseCore,
					supabaseBilling,
					session.user.id,
					modelInfo.capabilities.featureKey
				);
			} catch (error) {
				logger.warn(`Feature access check failed for model ${modelId}:`, error);
				userHasAccess = false; // Default to no access on error
			}
		} else if (!modelInfo.capabilities.featureKey) {
			// Models without feature keys are accessible by default (e.g., legacy models)
			userHasAccess = true;
		}

		response.status = 200;
		response.body = {
			model: {
				id: modelInfo.id,
				displayName: modelInfo.displayName,
				provider: modelInfo.provider,
				providerLabel: LLMProviderLabel[modelInfo.provider as LLMProvider] || 'Unknown',
				source: modelInfo.source,
				capabilities: modelInfo.capabilities,
				featureKey: modelInfo.capabilities.featureKey,
				userHasAccess,
			},
		};
	} catch (error) {
		logger.error(`ModelHandler: Error in getModelCapabilities: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to get model capabilities', details: (error as Error).message };
	}
};

/**
 * @openapi
 * /api/v1/model/refresh:
 *   post:
 *     summary: Refresh dynamic models
 *     description: Refreshes dynamically discovered models (e.g., Ollama models)
 *     responses:
 *       200:
 *         description: Models refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 modelsRefreshed:
 *                   type: integer
 *       500:
 *         description: Internal server error
 */
export const refreshDynamicModels = async (
	ctx: Context,
) => {
	const { response } = ctx;
	try {
		logger.info('ModelHandler: refreshDynamicModels called');

		// Initialize the model registry service
		const registryService = await ModelRegistryService.getInstance();

		// Get count before refresh
		const beforeCount = registryService.getAllModels().filter((m: ModelInfo) => m.source === 'dynamic').length;

		// Refresh dynamic models
		await registryService.refreshDynamicModels();

		// Get count after refresh
		const afterCount = registryService.getAllModels().filter((m: ModelInfo) => m.source === 'dynamic').length;

		response.status = 200;
		response.body = {
			message: 'Dynamic models refreshed successfully',
			modelsRefreshed: afterCount,
			modelsChanged: afterCount - beforeCount,
		};
	} catch (error) {
		logger.error(`ModelHandler: Error in refreshDynamicModels: ${(error as Error).message}`);
		response.status = 500;
		response.body = { error: 'Failed to refresh dynamic models', details: (error as Error).message };
	}
};
