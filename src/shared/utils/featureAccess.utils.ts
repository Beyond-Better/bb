/**
 * Feature Access Utilities
 * Shared helper functions for feature access across API and BUI
 * Accepts Supabase client directly for maximum flexibility
 * Uses singleton pattern per client to maintain caching benefits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientWithSchema } from '../types/supabase.types.ts';
import { FEATURE_KEYS, FeatureAccessService } from './featureAccessService.utils.ts'; // needs to remain relative path since api & acs use different import maps
import { logger } from 'shared/logger.ts';

// Export feature keys for convenience
export { FEATURE_KEYS };

// Cache feature access results (not service instances)
export interface CachedFeatureResult {
	access_granted: boolean;
	feature_value: any;
	expires: Date;
	userIdHash: string;
}

const featureResultCache = new Map<string, CachedFeatureResult>();
const FEATURE_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

/**
 * Create a feature access service instance (no caching)
 * Simple and reliable - creates fresh instance each time
 */
export const createFeatureService = (
	coreClient: SupabaseClientWithSchema<'abi_core'>,
	billingClient: SupabaseClientWithSchema<'abi_billing'>,
): FeatureAccessService => {
	return new FeatureAccessService(coreClient, billingClient);
};

/**
 * Get feature access with detailed information
 */
export const getFeatureAccess = async (
	coreClient: SupabaseClientWithSchema<'abi_core'>,
	billingClient: SupabaseClientWithSchema<'abi_billing'>,
	userId: string,
	featureKey: string,
	useCache: boolean = false,
) => {
	try {
		// Check cache first if enabled
		if (useCache) {
			const cacheKey = `${userId}:${featureKey}`;
			const cached = featureResultCache.get(cacheKey);
			if (cached && cached.expires > new Date()) {
				logger.debug(`FeatureAccessShared: Using cached result for ${featureKey}`);
				//return cached.result;
				return {
					access_granted: cached.access_granted,
					feature_value: cached.feature_value,
					access_reason: 'cached',
					resolved_from: 'cache',
				};
			}
		}

		const service = createFeatureService(coreClient, billingClient);
		const result = await service.getFeatureAccess(userId, featureKey);

		// Cache the result if caching is enabled
		if (useCache) {
			const cacheKey = `${userId}:${featureKey}`;
			featureResultCache.set(cacheKey, {
				access_granted: result.access_granted,
				feature_value: result.feature_value,
				expires: new Date(Date.now() + FEATURE_CACHE_EXPIRY),
				userIdHash: userId.substring(0, 8), // For debugging
			});
		}

		return result;
	} catch (error) {
		logger.error('FeatureAccessShared: Error getting feature access:', error);
		return {
			access_granted: false,
			feature_value: null,
			access_reason: 'error',
			resolved_from: 'system',
		};
	}
};

/**
 * Check if user has access to a specific feature with optional caching
 */
export const checkFeatureAccess = async (
	coreClient: SupabaseClientWithSchema<'abi_core'>,
	billingClient: SupabaseClientWithSchema<'abi_billing'>,
	userId: string,
	featureKey: string,
	useCache: boolean = false,
): Promise<boolean> => {
	try {
		const result = await getFeatureAccess(coreClient, billingClient, userId, featureKey, useCache);
		return result.access_granted;
	} catch (error) {
		logger.error('FeatureAccessShared: Error checking feature access:', error);
		return false; // Fail closed for security
	}
};

/**
 * Model Access Helpers
 */
export const ModelAccess = {
	/**
	 * Check if user has access to Claude models
	 */
	hasClaude: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.BASE);
	},

	/**
	 * Check if user has access to Claude Opus
	 */
	hasClaudeOpus: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.OPUS);
	},

	/**
	 * Check if user has access to Claude Sonnet
	 */
	hasClaudeSonnet: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.SONNET);
	},

	/**
	 * Check if user has access to Claude Haiku
	 */
	hasClaudeHaiku: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.HAIKU);
	},

	/**
	 * Check if user has access to OpenAI models
	 */
	hasOpenAI: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.BASE);
	},

	/**
	 * Check if user has access to GPT-4
	 */
	hasGPT4: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT4);
	},

	/**
	 * Check if user has access to GPT-3.5
	 */
	hasGPT3: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT3);
	},

	/**
	 * Check if user has access to any specific model
	 */
	hasModel: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
		modelKey: string,
	): Promise<boolean> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.hasModelAccess(userId, modelKey);
		} catch (error) {
			logger.error('FeatureAccessShared: Error checking model access:', error);
			return false;
		}
	},

	/**
	 * Get all available models for a user
	 */
	getAvailableModels: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<string[]> => {
		const models = [];

		if (await ModelAccess.hasClaudeHaiku(coreClient, billingClient, userId)) models.push('claude.haiku');
		if (await ModelAccess.hasClaudeSonnet(coreClient, billingClient, userId)) models.push('claude.sonnet');
		if (await ModelAccess.hasClaudeOpus(coreClient, billingClient, userId)) models.push('claude.opus');
		if (await ModelAccess.hasGPT3(coreClient, billingClient, userId)) models.push('openai.gpt3');
		if (await ModelAccess.hasGPT4(coreClient, billingClient, userId)) models.push('openai.gpt4');

		return models;
	},
};

/**
 * Datasource Access Helpers
 */
export const DatasourceAccess = {
	/**
	 * Check if user has filesystem access
	 */
	hasFilesystem: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
		operation: 'read' | 'write' = 'read',
	): Promise<boolean> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.hasDatasourceAccess(userId, 'filesystem', operation);
		} catch (error) {
			logger.error('FeatureAccessShared: Error checking filesystem access:', error);
			return false;
		}
	},

	/**
	 * Check if user has GitHub access
	 */
	hasGitHub: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
		operation: 'read' | 'write' = 'read',
	): Promise<boolean> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.hasDatasourceAccess(userId, 'github', operation);
		} catch (error) {
			logger.error('FeatureAccessShared: Error checking GitHub access:', error);
			return false;
		}
	},

	/**
	 * Check if user has Supabase access
	 */
	hasSupabase: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
		operation: 'read' | 'write' = 'read',
	): Promise<boolean> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.hasDatasourceAccess(userId, 'supabase', operation);
		} catch (error) {
			logger.error('FeatureAccessShared: Error checking Supabase access:', error);
			return false;
		}
	},

	/**
	 * Get all available datasources for a user
	 */
	getAvailableDatasources: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<{ name: string; read: boolean; write: boolean }[]> => {
		const datasources = [];

		const filesystem = await DatasourceAccess.hasFilesystem(coreClient, billingClient, userId, 'read');
		const filesystemWrite = await DatasourceAccess.hasFilesystem(coreClient, billingClient, userId, 'write');
		if (filesystem) {
			datasources.push({ name: 'filesystem', read: true, write: filesystemWrite });
		}

		const github = await DatasourceAccess.hasGitHub(coreClient, billingClient, userId, 'read');
		const githubWrite = await DatasourceAccess.hasGitHub(coreClient, billingClient, userId, 'write');
		if (github) {
			datasources.push({ name: 'github', read: true, write: githubWrite });
		}

		const supabase = await DatasourceAccess.hasSupabase(coreClient, billingClient, userId, 'read');
		const supabaseWrite = await DatasourceAccess.hasSupabase(coreClient, billingClient, userId, 'write');
		if (supabase) {
			datasources.push({ name: 'supabase', read: true, write: supabaseWrite });
		}

		return datasources;
	},
};

/**
 * Tools Access Helpers
 */
export const ToolsAccess = {
	/**
	 * Check if user has built-in tools access
	 */
	hasBuiltinTools: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.TOOLS.BUILTIN);
	},

	/**
	 * Check if user has external tools (MCP) access
	 */
	hasExternalTools: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.TOOLS.EXTERNAL);
	},

	/**
	 * Get available tools for a user
	 */
	getAvailableTools: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<string[]> => {
		const tools = [];

		if (await ToolsAccess.hasBuiltinTools(coreClient, billingClient, userId)) tools.push('builtin');
		if (await ToolsAccess.hasExternalTools(coreClient, billingClient, userId)) tools.push('external');

		return tools;
	},
};

/**
 * Rate Limit Helpers
 */
export const RateLimits = {
	/**
	 * Get user's tokens per minute limit
	 */
	getTokensPerMinute: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<number> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.getRateLimit(userId, 'tokens_per_minute');
		} catch (error) {
			logger.error('FeatureAccessShared: Error getting tokens per minute limit:', error);
			return 0;
		}
	},

	/**
	 * Get user's requests per minute limit
	 */
	getRequestsPerMinute: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<number> => {
		try {
			const service = createFeatureService(coreClient, billingClient);
			return await service.getRateLimit(userId, 'requests_per_minute');
		} catch (error) {
			logger.error('FeatureAccessShared: Error getting requests per minute limit:', error);
			return 0;
		}
	},

	/**
	 * Get all rate limits for a user
	 */
	getAllLimits: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<{ tokensPerMinute: number; requestsPerMinute: number }> => {
		const [tokensPerMinute, requestsPerMinute] = await Promise.all([
			RateLimits.getTokensPerMinute(coreClient, billingClient, userId),
			RateLimits.getRequestsPerMinute(coreClient, billingClient, userId),
		]);

		return { tokensPerMinute, requestsPerMinute };
	},
};

/**
 * Support & Features Access Helpers
 */
export const SupportAccess = {
	/**
	 * Check if user has community support
	 */
	hasCommunitySupport: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.COMMUNITY);
	},

	/**
	 * Check if user has email support
	 */
	hasEmailSupport: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.EMAIL);
	},

	/**
	 * Check if user has priority queue access
	 */
	hasPriorityQueue: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.PRIORITY_QUEUE);
	},

	/**
	 * Check if user has early access features
	 */
	hasEarlyAccess: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.EARLY_ACCESS);
	},

	/**
	 * Check if user has workspace isolation
	 */
	hasWorkspaceIsolation: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.WORKSPACE_ISOLATION);
	},

	/**
	 * Check if user has SSO access
	 */
	hasSSO: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.SSO);
	},

	/**
	 * Check if user has dedicated CSM
	 */
	hasDedicatedCSM: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.DEDICATED_CSM);
	},

	/**
	 * Check if user has on-premises option
	 */
	hasOnPremises: async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.ON_PREM);
	},
};

/**
 * Cache Management Helpers
 */
export const CacheManagement = {
	/**
	 * Clear feature result cache for a user
	 */
	clearUserCache: (userId: string): number => {
		let cleared = 0;
		for (const [key] of featureResultCache.entries()) {
			if (key.startsWith(`${userId}:`)) {
				featureResultCache.delete(key);
				cleared++;
			}
		}
		return cleared;
	},

	/**
	 * Clear all expired cache entries
	 */
	cleanupExpiredCache: (): number => {
		const now = new Date();
		let cleared = 0;
		for (const [key, cached] of featureResultCache.entries()) {
			if (cached.expires <= now) {
				featureResultCache.delete(key);
				cleared++;
			}
		}
		return cleared;
	},

	/**
	 * Get cache statistics
	 */
	getCacheStats: () => {
		const now = new Date();
		let active = 0;
		let expired = 0;

		for (const [, cached] of featureResultCache.entries()) {
			if (cached.expires > now) {
				active++;
			} else {
				expired++;
			}
		}

		return {
			total: featureResultCache.size,
			active,
			expired,
			cacheExpiryMs: FEATURE_CACHE_EXPIRY,
		};
	},
};

// Start periodic cache cleanup
setInterval(() => {
	CacheManagement.cleanupExpiredCache();
}, FEATURE_CACHE_EXPIRY);

export type UserFeatureProfile = {
	models: string[];
	datasources: { name: string; read: boolean; write: boolean }[];
	tools: string[];
	limits: {
		tokensPerMinute: number;
		requestsPerMinute: number;
	};
	support: {
		community: boolean;
		email: boolean;
		priorityQueue: boolean;
		earlyAccess: boolean;
		workspaceIsolation: boolean;
		sso: boolean;
		dedicatedCSM: boolean;
		onPremises: boolean;
	};
};

/**
 * Complete User Profile Helper
 */
export const getUserFeatureProfile = async (
	coreClient: SupabaseClientWithSchema<'abi_core'>,
	billingClient: SupabaseClientWithSchema<'abi_billing'>,
	userId: string,
): Promise<UserFeatureProfile> => {
	try {
		const [
			models,
			datasources,
			tools,
			limits,
			support,
		] = await Promise.all([
			ModelAccess.getAvailableModels(coreClient, billingClient, userId),
			DatasourceAccess.getAvailableDatasources(coreClient, billingClient, userId),
			ToolsAccess.getAvailableTools(coreClient, billingClient, userId),
			RateLimits.getAllLimits(coreClient, billingClient, userId),
			Promise.all([
				SupportAccess.hasCommunitySupport(coreClient, billingClient, userId),
				SupportAccess.hasEmailSupport(coreClient, billingClient, userId),
				SupportAccess.hasPriorityQueue(coreClient, billingClient, userId),
				SupportAccess.hasEarlyAccess(coreClient, billingClient, userId),
				SupportAccess.hasWorkspaceIsolation(coreClient, billingClient, userId),
				SupportAccess.hasSSO(coreClient, billingClient, userId),
				SupportAccess.hasDedicatedCSM(coreClient, billingClient, userId),
				SupportAccess.hasOnPremises(coreClient, billingClient, userId),
			]),
		]);

		return {
			models,
			datasources,
			tools,
			limits,
			support: {
				community: support[0],
				email: support[1],
				priorityQueue: support[2],
				earlyAccess: support[3],
				workspaceIsolation: support[4],
				sso: support[5],
				dedicatedCSM: support[6],
				onPremises: support[7],
			},
		};
	} catch (error) {
		logger.error('FeatureAccessShared: Error getting user feature profile:', error);
		return {
			models: [],
			datasources: [],
			tools: [],
			limits: { tokensPerMinute: 0, requestsPerMinute: 0 },
			support: {
				community: false,
				email: false,
				priorityQueue: false,
				earlyAccess: false,
				workspaceIsolation: false,
				sso: false,
				dedicatedCSM: false,
				onPremises: false,
			},
		};
	}
};

/**
 * Middleware Helper for API Routes
 */
export const requireFeature = (featureKey: string) => {
	return async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		const hasAccess = await checkFeatureAccess(coreClient, billingClient, userId, featureKey);
		if (!hasAccess) {
			throw new Error(`Feature '${featureKey}' is not available on your current plan`);
		}
		return true;
	};
};

/**
 * Middleware Helper for Model Access
 */
export const requireModelAccess = (modelKey: string) => {
	return async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		const hasAccess = await ModelAccess.hasModel(coreClient, billingClient, userId, modelKey);
		if (!hasAccess) {
			throw new Error(`Model '${modelKey}' is not available on your current plan`);
		}
		return true;
	};
};

/**
 * Middleware Helper for Datasource Access
 */
export const requireDatasourceAccess = (datasourceKey: string, operation: 'read' | 'write' = 'read') => {
	return async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		const service = createFeatureService(coreClient, billingClient);
		const hasAccess = await service.hasDatasourceAccess(userId, datasourceKey, operation);
		if (!hasAccess) {
			throw new Error(`Datasource '${datasourceKey}' ${operation} access is not available on your current plan`);
		}
		return true;
	};
};

/**
 * Middleware Helper for Datasource Access
 */
export const requireExternalToolsAccess = () => {
	return async (
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'>,
		userId: string,
	): Promise<boolean> => {
		const service = createFeatureService(coreClient, billingClient);
		const hasAccess = await service.hasExternalToolsAccess(userId);
		if (!hasAccess) {
			throw new Error(`ExternalTools access is not available on your current plan`);
		}
		return true;
	};
};
