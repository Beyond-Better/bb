/**
 * Feature Access Utilities
 * Shared helper functions for feature access across API and BUI
 * Accepts Supabase client directly for maximum flexibility
 * Uses singleton pattern per client to maintain caching benefits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClientWithSchema } from '../types/supabase.types.ts';
import { FeatureAccessService, FEATURE_KEYS } from './feature_access_service.utils.ts';

// Cache for service instances per client pair to maintain caching benefits
// Use Map with composite key since WeakMap doesn't work with multiple keys
const serviceCache = new Map<string, { service: FeatureAccessService; coreRef: WeakRef<any>; billingRef: WeakRef<any> }>();

// Additional tracking for manual cleanup in long-running processes
// Map client references to service creation timestamps
const serviceTimestamps = new Map<string, number>();
const activeServices = new Set<string>();

// Cleanup configuration
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_CLIENT_AGE = 30 * 60 * 1000; // 30 minutes

// Start cleanup timer for long-running processes (API)
let cleanupTimer: number | null = null;

/**
 * Get or create a feature access service instance for the provided Supabase clients
 * Uses singleton pattern per client pair to maintain caching benefits
 */
export const getFeatureService = (
  coreClient: SupabaseClientWithSchema<'abi_core'>,
  billingClient: SupabaseClientWithSchema<'abi_billing'>
): FeatureAccessService => {
  // Create a composite cache key
  const cacheKey = `${(coreClient as any).__clientId || 'core'}_${(billingClient as any).__clientId || 'billing'}`;
  
  // Check if we already have a service for this client pair
  let cached = serviceCache.get(cacheKey);
  
  // Verify the cached service still has valid client references
  if (cached) {
    const coreRef = cached.coreRef.deref();
    const billingRef = cached.billingRef.deref();
    if (coreRef && billingRef) {
      return cached.service;
    } else {
      // Clean up stale cache entry
      serviceCache.delete(cacheKey);
      serviceTimestamps.delete(cacheKey);
      activeServices.delete(cacheKey);
    }
  }
  
  // Create new service instance
  const service = new FeatureAccessService(coreClient, billingClient);
  service.startCacheCleanup(); // Start cleanup for this instance
  
  // Cache it with weak references to the clients
  serviceCache.set(cacheKey, {
    service,
    coreRef: new WeakRef(coreClient),
    billingRef: new WeakRef(billingClient)
  });
  
  // Track for manual cleanup
  serviceTimestamps.set(cacheKey, Date.now());
  activeServices.add(cacheKey);
  
  // Start cleanup timer if this is the first service and we're in a long-running process
  if (cleanupTimer === null && typeof Deno !== 'undefined') {
    startServiceCacheCleanup();
  }
  
  return service;
};

/**
 * Check if user has access to a specific feature
 */
export const checkFeatureAccess = async (
  coreClient: SupabaseClientWithSchema<'abi_core'>,
  billingClient: SupabaseClientWithSchema<'abi_billing'>,
  userId: string,
  featureKey: string
): Promise<boolean> => {
  try {
    const service = getFeatureService(coreClient, billingClient);
    const result = await service.checkFeatureAccess(userId, featureKey);
    return result.access_granted;
  } catch (error) {
    console.error('Error checking feature access:', error);
    return false; // Fail closed for security
  }
};

/**
 * Get feature access with detailed information
 */
export const getFeatureAccess = async (
  coreClient: SupabaseClientWithSchema<'abi_core'>,
  billingClient: SupabaseClientWithSchema<'abi_billing'>,
  userId: string,
  featureKey: string
) => {
  try {
    const service = getFeatureService(coreClient, billingClient);
    return await service.checkFeatureAccess(userId, featureKey);
  } catch (error) {
    console.error('Error getting feature access:', error);
    return {
      access_granted: false,
      feature_value: null,
      access_reason: 'error',
      resolved_from: 'system'
    };
  }
};

/**
 * Model Access Helpers
 */
export const ModelAccess = {
  /**
   * Check if user has access to Claude models
   */
  hasClaude: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.BASE);
  },

  /**
   * Check if user has access to Claude Opus
   */
  hasClaudeOpus: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.OPUS);
  },

  /**
   * Check if user has access to Claude Sonnet
   */
  hasClaudeSonnet: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.SONNET);
  },

  /**
   * Check if user has access to Claude Haiku
   */
  hasClaudeHaiku: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.CLAUDE.HAIKU);
  },

  /**
   * Check if user has access to OpenAI models
   */
  hasOpenAI: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.BASE);
  },

  /**
   * Check if user has access to GPT-4
   */
  hasGPT4: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT4);
  },

  /**
   * Check if user has access to GPT-3.5
   */
  hasGPT3: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT3);
  },

  /**
   * Check if user has access to any specific model
   */
  hasModel: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string, modelKey: string): Promise<boolean> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.hasModelAccess(userId, modelKey);
    } catch (error) {
      console.error('Error checking model access:', error);
      return false;
    }
  },

  /**
   * Get all available models for a user
   */
  getAvailableModels: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<string[]> => {
    const models = [];
    
    if (await ModelAccess.hasClaudeHaiku(coreClient, billingClient, userId)) models.push('claude.haiku');
    if (await ModelAccess.hasClaudeSonnet(coreClient, billingClient, userId)) models.push('claude.sonnet');
    if (await ModelAccess.hasClaudeOpus(coreClient, billingClient, userId)) models.push('claude.opus');
    if (await ModelAccess.hasGPT3(coreClient, billingClient, userId)) models.push('openai.gpt3');
    if (await ModelAccess.hasGPT4(coreClient, billingClient, userId)) models.push('openai.gpt4');
    
    return models;
  }
};

/**
 * Datasource Access Helpers
 */
export const DatasourceAccess = {
  /**
   * Check if user has filesystem access
   */
  hasFilesystem: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.hasDatasourceAccess(userId, 'filesystem', operation);
    } catch (error) {
      console.error('Error checking filesystem access:', error);
      return false;
    }
  },

  /**
   * Check if user has GitHub access
   */
  hasGitHub: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.hasDatasourceAccess(userId, 'github', operation);
    } catch (error) {
      console.error('Error checking GitHub access:', error);
      return false;
    }
  },

  /**
   * Check if user has Notion access
   */
  hasNotion: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.hasDatasourceAccess(userId, 'notion', operation);
    } catch (error) {
      console.error('Error checking Notion access:', error);
      return false;
    }
  },

  /**
   * Check if user has Supabase access
   */
  hasSupabase: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.hasDatasourceAccess(userId, 'supabase', operation);
    } catch (error) {
      console.error('Error checking Supabase access:', error);
      return false;
    }
  },

  /**
   * Get all available datasources for a user
   */
  getAvailableDatasources: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<{ name: string; read: boolean; write: boolean }[]> => {
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
    
    const notion = await DatasourceAccess.hasNotion(coreClient, billingClient, userId, 'read');
    const notionWrite = await DatasourceAccess.hasNotion(coreClient, billingClient, userId, 'write');
    if (notion) {
      datasources.push({ name: 'notion', read: true, write: notionWrite });
    }
    
    const supabase = await DatasourceAccess.hasSupabase(coreClient, billingClient, userId, 'read');
    const supabaseWrite = await DatasourceAccess.hasSupabase(coreClient, billingClient, userId, 'write');
    if (supabase) {
      datasources.push({ name: 'supabase', read: true, write: supabaseWrite });
    }
    
    return datasources;
  }
};

/**
 * Tools Access Helpers
 */
export const ToolsAccess = {
  /**
   * Check if user has built-in tools access
   */
  hasBuiltinTools: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.TOOLS.BUILTIN);
  },

  /**
   * Check if user has external tools (MCP) access
   */
  hasExternalTools: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.TOOLS.EXTERNAL);
  },

  /**
   * Get available tools for a user
   */
  getAvailableTools: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<string[]> => {
    const tools = [];
    
    if (await ToolsAccess.hasBuiltinTools(coreClient, billingClient, userId)) tools.push('builtin');
    if (await ToolsAccess.hasExternalTools(coreClient, billingClient, userId)) tools.push('external');
    
    return tools;
  }
};

/**
 * Rate Limit Helpers
 */
export const RateLimits = {
  /**
   * Get user's tokens per minute limit
   */
  getTokensPerMinute: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.getRateLimit(userId, 'tokens_per_minute');
    } catch (error) {
      console.error('Error getting tokens per minute limit:', error);
      return 0;
    }
  },

  /**
   * Get user's requests per minute limit
   */
  getRequestsPerMinute: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.getRateLimit(userId, 'requests_per_minute');
    } catch (error) {
      console.error('Error getting requests per minute limit:', error);
      return 0;
    }
  },

  /**
   * Get all rate limits for a user
   */
  getAllLimits: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<{ tokensPerMinute: number; requestsPerMinute: number }> => {
    const [tokensPerMinute, requestsPerMinute] = await Promise.all([
      RateLimits.getTokensPerMinute(coreClient, billingClient, userId),
      RateLimits.getRequestsPerMinute(coreClient, billingClient, userId)
    ]);
    
    return { tokensPerMinute, requestsPerMinute };
  }
};

/**
 * Support & Features Access Helpers
 */
export const SupportAccess = {
  /**
   * Check if user has community support
   */
  hasCommunitySupport: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.COMMUNITY);
  },

  /**
   * Check if user has email support
   */
  hasEmailSupport: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.EMAIL);
  },

  /**
   * Check if user has priority queue access
   */
  hasPriorityQueue: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.SUPPORT.PRIORITY_QUEUE);
  },

  /**
   * Check if user has early access features
   */
  hasEarlyAccess: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.EARLY_ACCESS);
  },

  /**
   * Check if user has workspace isolation
   */
  hasWorkspaceIsolation: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.WORKSPACE_ISOLATION);
  },

  /**
   * Check if user has SSO access
   */
  hasSSO: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.SSO);
  },

  /**
   * Check if user has dedicated CSM
   */
  hasDedicatedCSM: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.DEDICATED_CSM);
  },

  /**
   * Check if user has on-premises option
   */
  hasOnPremises: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(coreClient, billingClient, userId, FEATURE_KEYS.FEATURES.ON_PREM);
  }
};

/**
 * Cache Management Helpers
 */
export const CacheManagement = {
  /**
   * Refresh feature cache for a user
   */
  refreshCache: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.refreshFeatureCache(userId);
    } catch (error) {
      console.error('Error refreshing feature cache:', error);
      return 0;
    }
  },

  /**
   * Clear feature cache for a user
   */
  clearCache: async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(coreClient, billingClient);
      return await service.clearFeatureCache(userId);
    } catch (error) {
      console.error('Error clearing feature cache:', error);
      return 0;
    }
  }
};

/**
 * Complete User Profile Helper
 */
export const getUserFeatureProfile = async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string) => {
  try {
    const [
      models,
      datasources,
      tools,
      limits,
      support
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
        SupportAccess.hasOnPremises(coreClient, billingClient, userId)
      ])
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
        onPremises: support[7]
      }
    };
  } catch (error) {
    console.error('Error getting user feature profile:', error);
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
        onPremises: false
      }
    };
  }
};

/**
 * Middleware Helper for API Routes
 */
export const requireFeature = (featureKey: string) => {
  return async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
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
  return async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
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
  return async (coreClient: SupabaseClientWithSchema<'abi_core'>, billingClient: SupabaseClientWithSchema<'abi_billing'>, userId: string): Promise<boolean> => {
    const service = getFeatureService(coreClient, billingClient);
    const hasAccess = await service.hasDatasourceAccess(userId, datasourceKey, operation);
    if (!hasAccess) {
      throw new Error(`Datasource '${datasourceKey}' ${operation} access is not available on your current plan`);
    }
    return true;
  };
};

/**
 * Manual cleanup for service cache in long-running processes
 * This complements automatic cleanup when clients are garbage collected
 */
function cleanupStaleServices(): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Check all tracked services
  const servicesToRemove: string[] = [];
  
  for (const serviceKey of activeServices) {
    const cached = serviceCache.get(serviceKey);
    
    if (!cached) {
      // Service was already removed, clean up tracking
      servicesToRemove.push(serviceKey);
      serviceTimestamps.delete(serviceKey);
      cleanedCount++;
    } else {
      // Check if clients are still alive
      const coreClient = cached.coreRef.deref();
      const billingClient = cached.billingRef.deref();
      
      if (!coreClient || !billingClient) {
        // One or both clients were garbage collected
        serviceCache.delete(serviceKey);
        servicesToRemove.push(serviceKey);
        serviceTimestamps.delete(serviceKey);
        cleanedCount++;
      } else {
        // Check if service is too old
        const timestamp = serviceTimestamps.get(serviceKey);
        if (timestamp && (now - timestamp) > MAX_CLIENT_AGE) {
          // Force cleanup of old service
          if (typeof cached.service.clearCache === 'function') {
            cached.service.clearCache();
          }
          serviceCache.delete(serviceKey);
          servicesToRemove.push(serviceKey);
          serviceTimestamps.delete(serviceKey);
          cleanedCount++;
        }
      }
    }
  }
  
  // Remove stale references
  servicesToRemove.forEach(key => activeServices.delete(key));
  
  return cleanedCount;
}

/**
 * Start periodic cleanup for long-running processes
 */
function startServiceCacheCleanup(): void {
  if (cleanupTimer !== null) return;
  
  cleanupTimer = setInterval(() => {
    const cleaned = cleanupStaleServices();
    if (cleaned > 0) {
      console.debug(`FeatureService: Cleaned up ${cleaned} stale service cache entries`);
    }
    
    // Stop cleanup if no active services
    if (activeServices.size === 0) {
      stopServiceCacheCleanup();
    }
  }, CLEANUP_INTERVAL) as any;
  
  console.debug('FeatureService: Started cache cleanup timer');
}

/**
 * Stop periodic cleanup
 */
function stopServiceCacheCleanup(): void {
  if (cleanupTimer !== null) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.debug('FeatureService: Stopped cache cleanup timer');
  }
}

/**
 * Manual cleanup function for explicit cache management
 * Useful for testing or explicit resource management
 */
export const cleanupFeatureServiceCache = (): number => {
  return cleanupStaleServices();
};

/**
 * Get cache statistics for monitoring
 */
export const getFeatureServiceCacheStats = () => {
  const activeServiceCount = Array.from(activeServices).filter(key => {
    const cached = serviceCache.get(key);
    return cached && cached.coreRef.deref() && cached.billingRef.deref();
  }).length;
  
  return {
    activeServices: activeServiceCount,
    trackedServices: activeServices.size,
    cachedServices: serviceCache.size,
    cleanupActive: cleanupTimer !== null,
    cleanupInterval: CLEANUP_INTERVAL,
    maxClientAge: MAX_CLIENT_AGE
  };
};

// Export feature keys for convenience
export { FEATURE_KEYS };