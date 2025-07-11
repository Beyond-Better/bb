/**
 * Feature Access Service
 * Provides a unified interface for checking feature access across all BB components
 * Supports hierarchical inheritance, caching, and real-time updates
 * Updated to accept Supabase client directly for maximum flexibility
 */

import type { SupabaseClient } from '@supabase/supabase-js';

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
  private supabase: SupabaseClient;
  private cache: Map<string, { result: CachedFeatureAccessResult; expires: Date }> = new Map();
  private cacheExpiry: number = 60 * 60 * 1000; // 1 hour in milliseconds

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Check if a user has access to a specific feature
   * This is the main method you'll use throughout your application
   */
  async checkFeatureAccess(userId: string, featureKey: string, useCache: boolean = true): Promise<FeatureAccessResult> {
    try {
      // Try cache first if enabled
      if (useCache) {
        const cacheKey = `${userId}:${featureKey}`;
        const cached = this.cache.get(cacheKey);
        if (cached && cached.expires > new Date()) {
          return {
            access_granted: cached.result.access_granted,
            feature_value: cached.result.feature_value,
            access_reason: 'cached',
            resolved_from: 'cache'
          };
        }
      }

      // Get from database using RPC
      const { data, error } = await this.supabase
        .rpc('check_feature_access', {
          p_user_id: userId,
          p_feature_key: featureKey
        });

      if (error) {
        console.error('Error checking feature access:', error);
        return {
          access_granted: false,
          feature_value: null,
          access_reason: 'error',
          resolved_from: 'system'
        };
      }

      const result = data?.[0];
      if (!result) {
        return {
          access_granted: false,
          feature_value: null,
          access_reason: 'not_found',
          resolved_from: 'system'
        };
      }

      // Update cache
      if (useCache) {
        const cacheKey = `${userId}:${featureKey}`;
        this.cache.set(cacheKey, {
          result: {
            access_granted: result.access_granted,
            feature_value: result.feature_value,
            from_cache: false
          },
          expires: new Date(Date.now() + this.cacheExpiry)
        });
      }

      return result;
    } catch (error) {
      console.error('Exception in checkFeatureAccess:', error);
      return {
        access_granted: false,
        feature_value: null,
        access_reason: 'exception',
        resolved_from: 'system'
      };
    }
  }

  /**
   * Get cached feature access with fallback to live check
   * Uses the database-level cache for better performance
   */
  async getCachedFeatureAccess(userId: string, featureKey: string): Promise<CachedFeatureAccessResult> {
    try {
      const { data, error } = await this.supabase
        .rpc('check_feature_access_cached', {
          p_user_id: userId,
          p_feature_key: featureKey
        });

      if (error) {
        console.error('Error getting cached feature access:', error);
        return {
          access_granted: false,
          feature_value: null,
          from_cache: false
        };
      }

      return data?.[0] || {
        access_granted: false,
        feature_value: null,
        from_cache: false
      };
    } catch (error) {
      console.error('Exception in getCachedFeatureAccess:', error);
      return {
        access_granted: false,
        feature_value: null,
        from_cache: false
      };
    }
  }

  /**
   * Get all features for a user (useful for admin interfaces)
   */
  async getUserFeatures(userId: string): Promise<UserFeature[]> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_user_features', {
          p_user_id: userId
        });

      if (error) {
        console.error('Error getting user features:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception in getUserFeatures:', error);
      return [];
    }
  }

  /**
   * Get user's current subscription plan
   */
  async getUserPlan(userId: string): Promise<UserPlan | null> {
    try {
      const { data, error } = await this.supabase
        .from('abi_billing.user_subscriptions')
        .select(`
          plan_id,
          subscription_status,
          abi_billing.subscription_plans!inner(
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
        console.error('Error getting user plan:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      const planData = data.abi_billing?.subscription_plans as any;
      return {
        plan_id: data.plan_id,
        plan_name: planData?.plan_name || 'Unknown',
        plan_type: planData?.plan_type || 'unknown',
        subscription_status: data.subscription_status
      };
    } catch (error) {
      console.error('Exception in getUserPlan:', error);
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
      const { data, error } = await this.supabase
        .rpc('refresh_feature_cache', {
          p_user_id: userId
        });

      if (error) {
        console.error('Error refreshing feature cache:', error);
        return 0;
      }

      return data || 0;
    } catch (error) {
      console.error('Exception in refreshFeatureCache:', error);
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
      const { data, error } = await this.supabase
        .from('abi_core.feature_access_cache')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error clearing feature cache:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Exception in clearFeatureCache:', error);
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
    requestContext?: any
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .rpc('log_feature_access', {
          p_user_id: userId,
          p_feature_key: featureKey,
          p_access_granted: accessGranted,
          p_access_reason: accessReason,
          p_request_context: requestContext
        });

      if (error) {
        console.error('Error logging feature access:', error);
      }
    } catch (error) {
      console.error('Exception in logFeatureAccess:', error);
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
    createdBy?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('create_feature_override', {
          p_user_id: userId,
          p_feature_key: featureKey,
          p_override_value: overrideValue,
          p_override_reason: overrideReason,
          p_expires_at: expiresAt?.toISOString() || null,
          p_created_by: createdBy || null
        });

      if (error) {
        console.error('Error creating feature override:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Exception in createFeatureOverride:', error);
      return false;
    }
  }

  /**
   * Remove a feature override for a user
   */
  async removeFeatureOverride(userId: string, featureKey: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .rpc('remove_feature_override', {
          p_user_id: userId,
          p_feature_key: featureKey
        });

      if (error) {
        console.error('Error removing feature override:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Exception in removeFeatureOverride:', error);
      return false;
    }
  }

  /**
   * Get all feature overrides for a user
   */
  async getUserFeatureOverrides(userId: string): Promise<FeatureOverride[]> {
    try {
      const { data, error } = await this.supabase
        .from('abi_core.user_feature_overrides')
        .select(`
          override_id,
          user_id,
          override_value,
          override_reason,
          expires_at,
          created_by,
          abi_core.feature_definitions!inner(feature_key)
        `)
        .eq('user_id', userId);

      if (error) {
        console.error('Error getting user feature overrides:', error);
        return [];
      }

      return (data || []).map(item => ({
        override_id: item.override_id,
        user_id: item.user_id,
        feature_key: (item.abi_core?.feature_definitions as any)?.feature_key || 'unknown',
        override_value: item.override_value,
        override_reason: item.override_reason,
        expires_at: item.expires_at,
        created_by: item.created_by
      }));
    } catch (error) {
      console.error('Exception in getUserFeatureOverrides:', error);
      return [];
    }
  }

  /**
   * Helper method to check if user has access to a model
   */
  async hasModelAccess(userId: string, modelKey: string): Promise<boolean> {
    const result = await this.checkFeatureAccess(userId, `models.${modelKey}`);
    return result.access_granted;
  }

  /**
   * Helper method to check datasource access
   */
  async hasDatasourceAccess(userId: string, datasourceKey: string, operation: 'read' | 'write' = 'read'): Promise<boolean> {
    const result = await this.checkFeatureAccess(userId, `datasources.${datasourceKey}`);
    if (!result.access_granted) return false;

    // Check specific operation access
    if (result.feature_value && typeof result.feature_value === 'object') {
      return result.feature_value[operation] === true;
    }

    return result.access_granted;
  }

  /**
   * Helper method to get rate limit for a user
   */
  async getRateLimit(userId: string, limitType: 'tokens_per_minute' | 'requests_per_minute'): Promise<number> {
    const result = await this.checkFeatureAccess(userId, `limits.${limitType}`);
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
    const result = await this.checkFeatureAccess(userId, 'tools.external');
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
}

// Export commonly used feature keys as constants
export const FEATURE_KEYS = {
  MODELS: {
    CLAUDE: {
      BASE: 'models.claude',
      SONNET: 'models.claude.sonnet',
      OPUS: 'models.claude.opus',
      HAIKU: 'models.claude.haiku'
    },
    OPENAI: {
      BASE: 'models.openai',
      GPT4: 'models.openai.gpt4',
      GPT3: 'models.openai.gpt3'
    }
  },
  DATASOURCES: {
    FILESYSTEM: 'datasources.filesystem',
    GITHUB: 'datasources.github',
    NOTION: 'datasources.notion',
    SUPABASE: 'datasources.supabase'
  },
  TOOLS: {
    BUILTIN: 'tools.builtin',
    EXTERNAL: 'tools.external'
  },
  LIMITS: {
    TOKENS_PER_MINUTE: 'limits.tokens_per_minute',
    REQUESTS_PER_MINUTE: 'limits.requests_per_minute'
  },
  SUPPORT: {
    COMMUNITY: 'support.community',
    EMAIL: 'support.email',
    PRIORITY_QUEUE: 'support.priority_queue'
  },
  FEATURES: {
    EARLY_ACCESS: 'features.early_access',
    WORKSPACE_ISOLATION: 'features.workspace_isolation',
    SSO: 'features.sso',
    DEDICATED_CSM: 'features.dedicated_csm',
    ON_PREM: 'features.on_prem'
  }
} as const;