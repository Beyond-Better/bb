/**
 * Feature Access Wrapper for API Tools
 * Provides clean, minimal interface for checking permissions in tools
 * Handles userAuthSession to Supabase clients conversion internally
 */

import type { UserAuthSession } from 'api/auth/userAuthSession.ts';
import type { UserContext } from 'shared/types/app.ts';
import { SessionRegistry } from 'api/auth/sessionRegistry.ts';
import { FEATURE_KEYS, type FeatureAccessResult, FeatureAccessService } from 'shared/featureAccessService.ts';
import {
	type CachedFeatureResult,
	CacheManagement,
	getUserFeatureProfile as getUserFeatureProfileFromUtils,
	RateLimits,
	type UserFeatureProfile,
} from 'shared/featureAccess.ts';
import type { SupabaseClientWithSchema } from 'shared/types/supabase.ts';
import { SupabaseClientFactory } from 'api/auth/supabaseClientFactory.ts';
import { logger } from 'shared/logger.ts';

// Cache recent access checks to avoid repeated DB calls within same execution
const accessCache = new Map<string, { result: boolean; expires: Date }>();
const featureResultCache = new Map<string, CachedFeatureResult>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for short-term caching

type UserContextOrSession = UserContext | UserAuthSession;

// const resolveUserContextOrSession = (userContextOrSession: UserContextOrSession): UserAuthSession => {
// 	return 'userAuthSession' in userContextOrSession ? userContextOrSession.userAuthSession : userContextOrSession;
// };

const getUserId = async (userContextOrSession: UserContextOrSession): Promise<string> => {
	return 'userAuthSession' in userContextOrSession
		? ((await userContextOrSession.userAuthSession.getSession())?.user.id || '')
		: (userContextOrSession as unknown as UserContext).userId;
};
const getUserContext = async (userContextOrSession: UserContextOrSession): Promise<UserContext> => {
	if ('userAuthSession' in userContextOrSession) {
		const session = await userContextOrSession.userAuthSession.getSession();
		if (!session?.user.id) throw new Error('Invalid session');
		const userContext = SessionRegistry.getInstance().getUserContext(session.user.id);
		if (!userContext) throw new Error('User context not found');
		return userContext;
	}
	return userContextOrSession as unknown as UserContext;
};

/**
 * Get Supabase clients from session manager
 */
async function getSupabaseClients(userContext: UserContext): Promise<{
	coreClient: SupabaseClientWithSchema<'abi_core'>;
	billingClient: SupabaseClientWithSchema<'abi_billing'>;
}> {
	const coreClient = await SupabaseClientFactory.getCoreClient(userContext);
	const billingClient = await SupabaseClientFactory.getBillingClient(userContext);
	return { coreClient, billingClient };
}

/**
 * Internal helper to get access with optional caching
 */
export async function getFeatureAccess(
	userContextOrSession: UserContextOrSession,
	featureKey: string,
	useCache: boolean = true,
	teamUserId?: string,
): Promise<FeatureAccessResult> {
	const emptyFeature = {
		access_granted: true,
		feature_value: '',
		access_reason: 'default',
		resolved_from: 'default',
	};

	// Allow all access during unit tests
	if (Deno.env.get('BB_UNIT_TESTS') === '1') {
		return emptyFeature;
	}

	try {
		const userOrTeamId = teamUserId || await getUserId(userContextOrSession);
		if (!userOrTeamId) {
			return emptyFeature;
		}

		const cacheKey = `${userOrTeamId}:${featureKey}`;

		// Check cache first
		if (useCache) {
			const cached = featureResultCache.get(cacheKey);
			if (cached && cached.expires > new Date()) {
				return {
					access_granted: cached.access_granted,
					feature_value: cached.feature_value,
					access_reason: 'cached',
					resolved_from: 'cache',
				};
			}
		}

		const { coreClient, billingClient } = await getSupabaseClients(await getUserContext(userContextOrSession));
		const service = new FeatureAccessService(coreClient, billingClient);

		const result = await service.getFeatureAccess(userOrTeamId, featureKey);

		// Cache the result
		if (useCache) {
			featureResultCache.set(cacheKey, {
				access_granted: result.access_granted,
				feature_value: result.feature_value,
				expires: new Date(Date.now() + CACHE_DURATION),
				userIdHash: userOrTeamId.substring(0, 8), // For debugging
			});
		}

		return result;
	} catch (error) {
		logger.error(`Error getting feature access for ${featureKey}:`, error);
		return emptyFeature; // Fail closed for security
	}
}

/**
 * Internal helper to check access with optional caching
 */
async function checkFeatureAccess(
	userContextOrSession: UserContextOrSession,
	featureKey: string,
	useCache: boolean = true,
	teamUserId?: string,
): Promise<boolean> {
	// Allow all access during unit tests
	if (Deno.env.get('BB_UNIT_TESTS') === '1') {
		return true;
	}

	try {
		const userOrTeamId = teamUserId || await getUserId(userContextOrSession);
		if (!userOrTeamId) {
			return false;
		}

		const cacheKey = `${userOrTeamId}:${featureKey}`;

		// Check cache first
		if (useCache) {
			const cached = accessCache.get(cacheKey);
			if (cached && cached.expires > new Date()) {
				return cached.result;
			}
		}

		const result = await getFeatureAccess(userContextOrSession, featureKey, useCache, teamUserId);
		const hasAccess = result.access_granted;

		// Cache the result
		if (useCache) {
			accessCache.set(cacheKey, {
				result: hasAccess,
				expires: new Date(Date.now() + CACHE_DURATION),
			});
		}

		return hasAccess;
	} catch (error) {
		logger.error(`Error checking feature access for ${featureKey}:`, error);
		return false; // Fail closed for security
	}
}

/**
 * DATASOURCE ACCESS CHECKS
 * These are the main functions tools will use
 */

/**
 * Check if user has filesystem access
 * @param userAuthSession Session manager instance
 * @param operation Read or write operation (defaults to 'read')
 * @returns Promise<boolean>
 */
export async function hasFilesystemAccess(
	userContextOrSession: UserContextOrSession,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	return await hasDatasourceAccess(userContextOrSession, 'filesystem', operation);
}

/**
 * Check if user has Supabase access
 */
export async function hasSupabaseAccess(
	userContextOrSession: UserContextOrSession,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	return await hasDatasourceAccess(userContextOrSession, 'supabase', operation);
}

/**
 * Check if user has GitHub access
 */
export async function hasGitHubAccess(
	userContextOrSession: UserContextOrSession,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	return await hasDatasourceAccess(userContextOrSession, 'github', operation);
}

/**
 * Generic datasource access check
 * @param userContextOrSession Session manager instance
 * @param datasourceType Type of datasource (filesystem, notion, etc.)
 * @param operation Read or write operation
 */
export async function hasDatasourceAccess(
	userContextOrSession: UserContextOrSession,
	datasourceType: string,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	// Allow all datasource access during unit tests
	if (Deno.env.get('BB_UNIT_TESTS') === '1') {
		return true;
	}

	try {
		const userId = await getUserId(userContextOrSession);
		if (!userId) {
			logger.info('FeatureAccess: hasDatasourceAccess - no user or session');
			return false;
		}

		const { coreClient, billingClient } = await getSupabaseClients(await getUserContext(userContextOrSession));
		const service = new FeatureAccessService(coreClient, billingClient);

		// Use the service's hasDatasourceAccess method which handles the JSON feature_value logic
		return await service.hasDatasourceAccess(userId, datasourceType, operation);
	} catch (error) {
		logger.error(`Error checking datasource access for ${datasourceType}:`, error);
		return false; // Fail closed for security
	}
}

/**
 * Get all available datasources for a user
 */
export async function getAvailableDatasources(
	userContextOrSession: UserContextOrSession,
): Promise<{ name: string; read: boolean; write: boolean }[]> {
	const datasources = [];

	const filesystem = await hasFilesystemAccess(userContextOrSession, 'read');
	const filesystemWrite = await hasFilesystemAccess(userContextOrSession, 'write');
	if (filesystem) {
		datasources.push({ name: 'filesystem', read: true, write: filesystemWrite });
	}

	const github = await hasGitHubAccess(userContextOrSession, 'read');
	const githubWrite = await hasGitHubAccess(userContextOrSession, 'write');
	if (github) {
		datasources.push({ name: 'github', read: true, write: githubWrite });
	}

	const supabase = await hasSupabaseAccess(userContextOrSession, 'read');
	const supabaseWrite = await hasSupabaseAccess(userContextOrSession, 'write');
	if (supabase) {
		datasources.push({ name: 'supabase', read: true, write: supabaseWrite });
	}

	return datasources;
}

export async function getUserFeatureProfile(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<UserFeatureProfile> {
	const emptyFeatureProfile = {
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

	try {
		const userOrTeamId = teamUserId || await getUserId(userContextOrSession);
		if (!userOrTeamId) {
			logger.info('FeatureAccess: getUserFeatureProfile - no user or session');
			return emptyFeatureProfile;
		}

		const { coreClient, billingClient } = await getSupabaseClients(await getUserContext(userContextOrSession));

		return getUserFeatureProfileFromUtils(coreClient, billingClient, userOrTeamId);
	} catch (error) {
		logger.error('FeatureAccess: Error getting user feature profile:', error);
		return emptyFeatureProfile;
	}
}

/**
 * MODEL ACCESS CHECKS
 */

/**
 * Check if user has access to a specific model
 * @param userContextOrSession Session manager instance
 * @param modelKey Model key (e.g., 'claude.opus', 'openai.gpt4')
 */
export async function hasModelAccess(
	userContextOrSession: UserContextOrSession,
	modelKey: string,
	teamUserId?: string,
): Promise<boolean> {
	const resolvedKey = modelKey.startsWith('models.') ? modelKey : `models.${modelKey}`;
	return await checkFeatureAccess(userContextOrSession, resolvedKey, true, teamUserId);
}

/**
 * CONVENIENCE FUNCTIONS (matching existing FeatureAccess patterns)
 */

/**
 * Check if user has access to Claude models
 */
export async function hasClaudeAccess(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.CLAUDE.BASE, true, teamUserId);
}

/**
 * Check if user has access to Claude Opus
 */
export async function hasClaudeOpusAccess(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.CLAUDE.OPUS, true, teamUserId);
}

/**
 * Check if user has access to Claude Sonnet
 */
export async function hasClaudeSonnetAccess(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.CLAUDE.SONNET, true, teamUserId);
}

/**
 * Check if user has access to Claude Haiku
 */
export async function hasClaudeHaikuAccess(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.CLAUDE.HAIKU, true, teamUserId);
}

/**
 * Check if user has access to OpenAI models
 */
export async function hasOpenAIAccess(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.OPENAI.BASE, true, teamUserId);
}

/**
 * Check if user has access to GPT-4
 */
export async function hasGPT4Access(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.OPENAI.GPT4, true, teamUserId);
}

/**
 * Check if user has access to GPT-3.5
 */
export async function hasGPT3Access(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.MODELS.OPENAI.GPT3, true, teamUserId);
}

/**
 * Get all available models for a user
 */
export async function getAvailableModels(
	userContextOrSession: UserContextOrSession,
	teamUserId?: string,
): Promise<string[]> {
	const models = [];

	if (await hasClaudeHaikuAccess(userContextOrSession, teamUserId)) models.push('claude.haiku');
	if (await hasClaudeSonnetAccess(userContextOrSession, teamUserId)) models.push('claude.sonnet');
	if (await hasClaudeOpusAccess(userContextOrSession, teamUserId)) models.push('claude.opus');
	if (await hasGPT3Access(userContextOrSession, teamUserId)) models.push('openai.gpt3');
	if (await hasGPT4Access(userContextOrSession, teamUserId)) models.push('openai.gpt4');

	return models;
}

/**
 * TOOL ACCESS CHECKS
 */

/**
 * Check if user has external tools (MCP) access
 */
export async function hasExternalToolsAccess(userContextOrSession: UserContextOrSession): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.TOOLS.EXTERNAL);
}

/**
 * Check if user has built-in tools access
 */
export async function hasBuiltinToolsAccess(userContextOrSession: UserContextOrSession): Promise<boolean> {
	return await checkFeatureAccess(userContextOrSession, FEATURE_KEYS.TOOLS.BUILTIN);
}

/**
 * RATE LIMIT CHECKS
 */

/**
 * Get rate limits for user
 */
export async function getAllRateLimits(
	userContextOrSession: UserContextOrSession,
): Promise<{ tokensPerMinute: number; requestsPerMinute: number }> {
	const emptyRateLimits = { tokensPerMinute: 0, requestsPerMinute: 0 };

	try {
		const userId = await getUserId(userContextOrSession);
		if (!userId) {
			logger.info('FeatureAccess: getAllRateLimits - no user or session');
			return emptyRateLimits;
		}

		const { coreClient, billingClient } = await getSupabaseClients(await getUserContext(userContextOrSession));

		return await RateLimits.getAllLimits(coreClient, billingClient, userId);
	} catch (error) {
		logger.error('FeatureAccess: Error getting user rate limits:', error);
		return emptyRateLimits;
	}
}

/**
 * WRAPPER FUNCTIONS (for easy migration from existing code)
 */

/**
 * Check model access (matches ModelAccess.hasModel signature)
 */
export async function checkModelAccess(
	userContextOrSession: UserContextOrSession,
	modelKey: string,
): Promise<boolean> {
	return await hasModelAccess(userContextOrSession, modelKey);
}

/**
 * Check datasource access (matches DatasourceAccess patterns)
 */
export async function checkDatasourceAccess(
	userContextOrSession: UserContextOrSession,
	datasourceType: string,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	return await hasDatasourceAccess(userContextOrSession, datasourceType, operation);
}

/**
 * Check filesystem access (matches DatasourceAccess.hasFilesystem)
 */
export async function checkFilesystemAccess(
	userContextOrSession: UserContextOrSession,
	operation: 'read' | 'write' = 'read',
): Promise<boolean> {
	return await hasFilesystemAccess(userContextOrSession, operation);
}

/**
 * ACCESS CONTROL DECORATORS/WRAPPERS
 */

/**
 * Create an access control wrapper for tools
 * Returns a function that throws an error if access is denied
 */
export function requireDatasourceAccess(
	datasourceType: string,
	operation: 'read' | 'write' = 'read',
) {
	return async (userContextOrSession: UserContextOrSession): Promise<void> => {
		const hasAccess = await hasDatasourceAccess(userContextOrSession, datasourceType, operation);
		if (!hasAccess) {
			throw new Error(
				`Access denied: ${datasourceType} ${operation} access not available on your current plan`,
			);
		}
	};
}

/**
 * Create a model access control wrapper
 */
export function requireModelAccess(modelKey: string) {
	return async (userContextOrSession: UserContextOrSession): Promise<void> => {
		const hasAccess = await hasModelAccess(userContextOrSession, modelKey);
		if (!hasAccess) {
			throw new Error(
				`Access denied: Model '${modelKey}' not available on your current plan`,
			);
		}
	};
}

/**
 * Batch check multiple permissions at once
 * Useful for tools that need multiple permissions
 */
export async function checkMultipleAccess(
	userContextOrSession: UserContextOrSession,
	checks: Array<{
		type: 'datasource' | 'model' | 'feature';
		key: string;
		operation?: 'read' | 'write';
	}>,
): Promise<{ [key: string]: boolean }> {
	const results: { [key: string]: boolean } = {};

	for (const check of checks) {
		switch (check.type) {
			case 'datasource':
				results[check.key] = await hasDatasourceAccess(userContextOrSession, check.key, check.operation);
				break;
			case 'model':
				results[check.key] = await hasModelAccess(userContextOrSession, check.key);
				break;
			case 'feature':
				results[check.key] = await checkFeatureAccess(userContextOrSession, check.key);
				break;
		}
	}

	return results;
}

/**
 * UTILITY FUNCTIONS
 */

/**
 * Clear the short-term access cache
 * Useful for testing or when permissions might have changed
 */
export function clearAccessCache(): void {
	accessCache.clear();
}

export async function clearUserCache(userContextOrSession: UserContextOrSession): Promise<number> {
	const userId = await getUserId(userContextOrSession);
	if (!userId) {
		logger.info('FeatureAccess: clearUserCache - no user or session');
		return 0;
	}
	return CacheManagement.clearUserCache(userId);
}

/**
 * Get cache statistics
 */
export function getAccessCacheStats() {
	const now = new Date();
	let active = 0;
	let expired = 0;

	for (const [, value] of accessCache.entries()) {
		if (value.expires > now) {
			active++;
		} else {
			expired++;
		}
	}

	return {
		total: accessCache.size,
		active,
		expired,
		cacheDuration: CACHE_DURATION,
	};
}
