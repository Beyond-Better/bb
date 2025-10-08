/**
 * Feature Access Service
 * Provides a unified interface for checking feature access across all BB components
 * Supports hierarchical inheritance, caching, and real-time updates
 * Updated to accept Supabase client directly for maximum flexibility
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientWithSchema } from '../types/supabase.types.ts';
import { logger } from 'shared/logger.ts';

export interface FeatureAccessResult {
	access_granted: boolean;
	feature_value: any;
	access_reason: string;
	resolved_from: string;
}

export interface CachedFeatureAccessResult {
	access_granted: boolean;
	feature_value: any;
	from_cache: boolean;
}

export interface UserFeature {
	feature_key: string;
	feature_name: string;
	feature_type: 'access' | 'limit' | 'configuration';
	access_granted: boolean;
	feature_value: any;
	access_reason: string;
	resolved_from: string;
}

export interface FeatureOverride {
	override_id: string;
	user_id: string;
	feature_key: string;
	override_value: any;
	override_reason: string;
	expires_at?: string;
	created_by?: string;
}

export interface UserPlan {
	plan_id: string;
	plan_name: string;
	plan_type: string;
	subscription_status: string;
}

export class FeatureAccessService {
	private coreClient: SupabaseClientWithSchema<'abi_core'>;
	private billingClient: SupabaseClientWithSchema<'abi_billing'> | null;
	private cache: Map<string, { result: CachedFeatureAccessResult; expires: Date }> = new Map();
	private cacheExpiry: number = 60 * 60 * 1000; // 1 hour in milliseconds

	constructor(
		coreClient: SupabaseClientWithSchema<'abi_core'>,
		billingClient: SupabaseClientWithSchema<'abi_billing'> | null = null,
	) {
		this.coreClient = coreClient;
		this.billingClient = billingClient;
	}

	/**
	 * Check if a user has access to a specific feature
	 * This is the main method you'll use throughout your application
	 */
	async getFeatureAccess(
		userId: string,
		featureKey: string,
		useCache: boolean = false,
	): Promise<FeatureAccessResult> {
		//logger.info(`FeatureAccessService: getFeatureAccess: ${featureKey} for user ${userId} - useCache: ${useCache}`);
		try {
			// Get from database using RPC
			const { data, error } = await this.coreClient
				.rpc('check_feature_access', {
					p_user_id: userId,
					p_feature_key: featureKey,
				});
			//logger.info(`FeatureAccessService: getFeatureAccess: ${featureKey} for user ${userId}`, { data, error });

			if (error) {
				logger.error('FeatureAccessService: Error checking feature access:', error);
				return {
					access_granted: false,
					feature_value: null,
					access_reason: 'error',
					resolved_from: 'system',
				};
			}

			// Handle array data or single result
			const result = Array.isArray(data) ? data[0] : data;
			if (!result) {
				logger.error('FeatureAccessService: No result checking feature access:', error);
				return {
					access_granted: false,
					feature_value: null,
					access_reason: 'not_found',
					resolved_from: 'system',
				};
			}

			return result;
		} catch (error) {
			logger.error('FeatureAccessService: Exception in getFeatureAccess:', error);
			return {
				access_granted: false,
				feature_value: null,
				access_reason: 'exception',
				resolved_from: 'system',
			};
		}
	}

	/**
	 * Get cached feature access with fallback to live check
	 * Uses the database-level cache for better performance
	 */
	async getCachedFeatureAccess(userId: string, featureKey: string): Promise<CachedFeatureAccessResult> {
		try {
			const { data, error } = await this.coreClient
				.rpc('check_feature_access_cached', {
					p_user_id: userId,
					p_feature_key: featureKey,
				});

			if (error) {
				logger.error('FeatureAccessService: Error getting cached feature access:', error);
				return {
					access_granted: false,
					feature_value: null,
					from_cache: false,
				};
			}

			// Handle array data or single result
			const result = Array.isArray(data) ? data[0] : data;
			return result || {
				access_granted: false,
				feature_value: null,
				from_cache: false,
			};
		} catch (error) {
			logger.error('FeatureAccessService: Exception in getCachedFeatureAccess:', error);
			return {
				access_granted: false,
				feature_value: null,
				from_cache: false,
			};
		}
	}

	/**
	 * Get all features for a user (useful for admin interfaces)
	 */
	async getUserFeatures(userId: string): Promise<UserFeature[]> {
		try {
			const { data, error } = await this.coreClient
				.rpc('get_user_features', {
					p_user_id: userId,
				});

			if (error) {
				logger.error('FeatureAccessService: Error getting user features:', error);
				return [];
			}

			// Ensure data is an array and properly typed
			if (Array.isArray(data)) {
				return data as UserFeature[];
			} else if (data && typeof data === 'object' && 'feature_key' in data) {
				// Single UserFeature object
				return [data as UserFeature];
			} else {
				// Empty or invalid data
				return [];
			}
		} catch (error) {
			logger.error('FeatureAccessService: Exception in getUserFeatures:', error);
			return [];
		}
	}

	/**
	 * Get user's current subscription plan
	 */
	async getUserPlan(userId: string): Promise<UserPlan | null> {
		try {
			if (!this.billingClient) throw new Error('billingClient is required to get user plan');
			const { data, error } = await this.billingClient
				.from('user_subscriptions')
				.select(`
				  plan_id,
				  subscription_status,
				  subscription_plans!inner(
					plan_name,
					plan_type
				  )
				`)
				.eq('user_id', userId)
				.eq('subscription_status', 'ACTIVE')
				.order('created_at', { ascending: false })
				.limit(1)
				.single();

			if (error) {
				logger.error('FeatureAccessService: Error getting user plan:', error);
				return null;
			}

			if (!data) {
				return null;
			}

			// Handle both array and object responses
			const planRecord = Array.isArray(data) ? data[0] : data;
			if (!planRecord) {
				return null;
			}

			const planData = (planRecord as any).subscription_plans;
			return {
				plan_id: (planRecord as any).plan_id,
				plan_name: planData?.plan_name || 'Unknown',
				plan_type: planData?.plan_type || 'unknown',
				subscription_status: (planRecord as any).subscription_status,
			};
		} catch (error) {
			logger.error('FeatureAccessService: Exception in getUserPlan:', error);
			return null;
		}
	}

	/**
	 * Refresh feature cache for a user (call when subscription changes)
	 */
	async refreshFeatureCache(userId: string): Promise<number> {
		try {
			// Clear local cache
			for (const [key] of this.cache.entries()) {
				if (key.startsWith(`${userId}:`)) {
					this.cache.delete(key);
				}
			}

			// Refresh database cache
			const { data, error } = await this.coreClient
				.rpc('refresh_feature_cache', {
					p_user_id: userId,
				});

			if (error) {
				logger.error('FeatureAccessService: Error refreshing feature cache:', error);
				return 0;
			}

			// Handle different return types from RPC
			if (typeof data === 'number') {
				return data;
			} else if (Array.isArray(data) && data.length > 0) {
				return typeof data[0] === 'number' ? data[0] : 0;
			} else {
				return 0;
			}
		} catch (error) {
			logger.error('FeatureAccessService: Exception in refreshFeatureCache:', error);
			return 0;
		}
	}

	/**
	 * Clear feature cache for a user
	 */
	async clearFeatureCache(userId: string): Promise<number> {
		try {
			// Clear local cache
			for (const [key] of this.cache.entries()) {
				if (key.startsWith(`${userId}:`)) {
					this.cache.delete(key);
				}
			}

			// Clear database cache
			const { data, error } = await this.coreClient
				.from('feature_access_cache')
				.delete()
				.eq('user_id', userId)
				.select();

			if (error) {
				logger.error('FeatureAccessService: Error clearing feature cache:', error);
				return 0;
			}

			return data?.length || 0;
		} catch (error) {
			logger.error('FeatureAccessService: Exception in clearFeatureCache:', error);
			return 0;
		}
	}

	/**
	 * Log feature access for analytics
	 */
	async logFeatureAccess(
		userId: string,
		featureKey: string,
		accessGranted: boolean,
		accessReason: string,
		requestContext?: any,
	): Promise<void> {
		try {
			const { error } = await this.coreClient
				.rpc('log_feature_access', {
					p_user_id: userId,
					p_feature_key: featureKey,
					p_access_granted: accessGranted,
					p_access_reason: accessReason,
					p_request_context: requestContext,
				});

			if (error) {
				logger.error('FeatureAccessService: Error logging feature access:', error);
			}
		} catch (error) {
			logger.error('FeatureAccessService: Exception in logFeatureAccess:', error);
		}
	}

	/**
	 * Create a feature override for a user
	 */
	async createFeatureOverride(
		userId: string,
		featureKey: string,
		overrideValue: any,
		overrideReason: string,
		expiresAt?: Date,
		createdBy?: string,
	): Promise<boolean> {
		try {
			const { data, error } = await this.coreClient
				.rpc('create_feature_override', {
					p_user_id: userId,
					p_feature_key: featureKey,
					p_override_value: overrideValue,
					p_override_reason: overrideReason,
					p_expires_at: expiresAt?.toISOString() || null,
					p_created_by: createdBy || null,
				});

			if (error) {
				logger.error('FeatureAccessService: Error creating feature override:', error);
				return false;
			}

			return !!data;
		} catch (error) {
			logger.error('FeatureAccessService: Exception in createFeatureOverride:', error);
			return false;
		}
	}

	/**
	 * Remove a feature override for a user
	 */
	async removeFeatureOverride(userId: string, featureKey: string): Promise<boolean> {
		try {
			const { data, error } = await this.coreClient
				.rpc('remove_feature_override', {
					p_user_id: userId,
					p_feature_key: featureKey,
				});

			if (error) {
				logger.error('FeatureAccessService: Error removing feature override:', error);
				return false;
			}

			return !!data;
		} catch (error) {
			logger.error('FeatureAccessService: Exception in removeFeatureOverride:', error);
			return false;
		}
	}

	/**
	 * Get all feature overrides for a user
	 */
	async getUserFeatureOverrides(userId: string): Promise<FeatureOverride[]> {
		try {
			const { data, error } = await this.coreClient
				.from('user_feature_overrides')
				.select(`
				  override_id,
				  user_id,
				  override_value,
				  override_reason,
				  expires_at,
				  created_by,
				  feature_definitions!inner(feature_key)
				`)
				.eq('user_id', userId);

			if (error) {
				logger.error('FeatureAccessService: Error getting user feature overrides:', error);
				return [];
			}

			return (data || []).map((item) => ({
				override_id: item.override_id,
				user_id: item.user_id,
				feature_key: (item.feature_definitions as any)?.feature_key || 'unknown',
				override_value: item.override_value,
				override_reason: item.override_reason,
				expires_at: item.expires_at,
				created_by: item.created_by,
			}));
		} catch (error) {
			logger.error('FeatureAccessService: Exception in getUserFeatureOverrides:', error);
			return [];
		}
	}

	/**
	 * Helper method to check if user has access to a model
	 */
	async hasModelAccess(userId: string, modelKey: string): Promise<boolean> {
		logger.info(`FeatureAccessService: checking for model: ${modelKey}`);
		const resolvedModelKey = modelKey.startsWith('models.') ? modelKey : `models.${modelKey}`;
		const result = await this.getFeatureAccess(userId, resolvedModelKey);
		return result.access_granted;
	}

	/**
	 * Helper method to check datasource access
	 */
	async hasDatasourceAccess(
		userId: string,
		datasourceKey: string,
		operation: 'read' | 'write' = 'read',
	): Promise<boolean> {
		const resolvedDatasourceKey = datasourceKey.startsWith('datasources.')
			? datasourceKey
			: `datasources.${datasourceKey}`;
		//logger.info(`FeatureAccessService: checking for datasource for ${operation}: ${resolvedDatasourceKey}`);
		const result = await this.getFeatureAccess(userId, resolvedDatasourceKey);
		//logger.info(`FeatureAccessService: datasource result: result`, result);
		if (!result.access_granted) return false;

		// Check specific operation access using feature_value JSON structure
		if (result.feature_value && typeof result.feature_value === 'object') {
			// Feature value structure: {"read": true, "write": false, "enabled": true}
			// First check if datasource is enabled
			if (result.feature_value.enabled !== true) {
				return false;
			}
			// Then check the specific operation permission
			return result.feature_value[operation] === true;
		}

		// Fallback: if no feature_value object, just return access_granted
		return result.access_granted;
	}

	/**
	 * Helper method to get rate limit for a user
	 */
	async getRateLimit(userId: string, limitType: 'tokens_per_minute' | 'requests_per_minute'): Promise<number> {
		const result = await this.getFeatureAccess(userId, `limits.${limitType}`);
		if (!result.access_granted) return 0;

		if (result.feature_value && typeof result.feature_value === 'object') {
			return result.feature_value.limit || 0;
		}

		return 0;
	}

	/**
	 * Helper method to check if user has access to external tools
	 */
	async hasExternalToolsAccess(userId: string): Promise<boolean> {
		const result = await this.getFeatureAccess(userId, 'tools.external');
		return result.access_granted;
	}

	/**
	 * Cleanup expired cache entries
	 */
	private cleanupCache(): void {
		const now = new Date();
		for (const [key, value] of this.cache.entries()) {
			if (value.expires <= now) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Start periodic cache cleanup
	 */
	startCacheCleanup(intervalMs: number = 5 * 60 * 1000): void {
		setInterval(() => {
			this.cleanupCache();
		}, intervalMs);
	}

	/**
	 * Clear all cache entries
	 */
	clearCache(): void {
		this.cache.clear();
	}
}

// Export commonly used feature keys as constants
export const FEATURE_KEYS = {
	MODELS: {
		CLAUDE: {
			BASE: 'models.claude',
			SONNET: 'models.claude.sonnet',
			OPUS: 'models.claude.opus',
			HAIKU: 'models.claude.haiku',
		},
		OPENAI: {
			BASE: 'models.openai',
			GPT4: 'models.openai.gpt4',
			GPT3: 'models.openai.gpt3',
		},
	},
	DATASOURCES: {
		FILESYSTEM: 'datasources.filesystem',
		GITHUB: 'datasources.github',
		NOTION: 'datasources.notion',
		SUPABASE: 'datasources.supabase',
		GOOGLE: 'datasources.google',
	},
	TOOLS: {
		BUILTIN: 'tools.builtin',
		EXTERNAL: 'tools.external',
	},
	LIMITS: {
		TOKENS_PER_MINUTE: 'limits.tokens_per_minute',
		REQUESTS_PER_MINUTE: 'limits.requests_per_minute',
	},
	SUPPORT: {
		COMMUNITY: 'support.community',
		EMAIL: 'support.email',
		PRIORITY_QUEUE: 'support.priority_queue',
	},
	FEATURES: {
		EARLY_ACCESS: 'features.early_access',
		WORKSPACE_ISOLATION: 'features.workspace_isolation',
		SSO: 'features.sso',
		DEDICATED_CSM: 'features.dedicated_csm',
		ON_PREM: 'features.on_prem',
	},
} as const;
