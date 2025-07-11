/**
 * Feature Access Utilities
 * Shared helper functions for feature access across API and BUI
 * Accepts Supabase client directly for maximum flexibility
 * Uses singleton pattern per client to maintain caching benefits
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FeatureAccessService, FEATURE_KEYS } from './feature_access_service.utils.ts';

// Cache for service instances per client to maintain caching benefits
// WeakMap automatically cleans up when client is garbage collected
const serviceCache = new WeakMap<SupabaseClient, FeatureAccessService>();

// Additional tracking for manual cleanup in long-running processes
// Map client references to service creation timestamps
const serviceTimestamps = new WeakMap<SupabaseClient, number>();
const activeClients = new Set<WeakRef<SupabaseClient>>();

// Cleanup configuration
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_CLIENT_AGE = 30 * 60 * 1000; // 30 minutes

// Start cleanup timer for long-running processes (API)
let cleanupTimer: number | null = null;

/**
 * Get or create a feature access service instance for the provided Supabase client
 * Uses singleton pattern per client to maintain caching benefits
 */
export const getFeatureService = (supabaseClient: SupabaseClient): FeatureAccessService => {
  // Check if we already have a service for this client
  let service = serviceCache.get(supabaseClient);
  
  if (!service) {
    // Create new service instance
    service = new FeatureAccessService(supabaseClient);
    service.startCacheCleanup(); // Start cleanup for this instance
    
    // Cache it using WeakMap (automatically cleaned up when client is garbage collected)
    serviceCache.set(supabaseClient, service);
    
    // Track for manual cleanup
    serviceTimestamps.set(supabaseClient, Date.now());
    activeClients.add(new WeakRef(supabaseClient));
    
    // Start cleanup timer if this is the first client and we're in a long-running process
    if (cleanupTimer === null && typeof Deno !== 'undefined') {
      startServiceCacheCleanup();
    }
  }
  
  return service;
};

/**
 * Check if user has access to a specific feature
 */
export const checkFeatureAccess = async (
  supabaseClient: SupabaseClient,
  userId: string,
  featureKey: string
): Promise<boolean> => {
  try {
    const service = getFeatureService(supabaseClient);
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
  supabaseClient: SupabaseClient,
  userId: string,
  featureKey: string
) => {
  try {
    const service = getFeatureService(supabaseClient);
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
  hasClaude: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.CLAUDE.BASE);
  },

  /**
   * Check if user has access to Claude Opus
   */
  hasClaudeOpus: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.CLAUDE.OPUS);
  },

  /**
   * Check if user has access to Claude Sonnet
   */
  hasClaudeSonnet: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.CLAUDE.SONNET);
  },

  /**
   * Check if user has access to Claude Haiku
   */
  hasClaudeHaiku: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.CLAUDE.HAIKU);
  },

  /**
   * Check if user has access to OpenAI models
   */
  hasOpenAI: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.OPENAI.BASE);
  },

  /**
   * Check if user has access to GPT-4
   */
  hasGPT4: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT4);
  },

  /**
   * Check if user has access to GPT-3.5
   */
  hasGPT3: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.MODELS.OPENAI.GPT3);
  },

  /**
   * Check if user has access to any specific model
   */
  hasModel: async (supabaseClient: SupabaseClient, userId: string, modelKey: string): Promise<boolean> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.hasModelAccess(userId, modelKey);
    } catch (error) {
      console.error('Error checking model access:', error);
      return false;
    }
  },

  /**
   * Get all available models for a user
   */
  getAvailableModels: async (supabaseClient: SupabaseClient, userId: string): Promise<string[]> => {
    const models = [];
    
    if (await ModelAccess.hasClaudeHaiku(supabaseClient, userId)) models.push('claude.haiku');
    if (await ModelAccess.hasClaudeSonnet(supabaseClient, userId)) models.push('claude.sonnet');
    if (await ModelAccess.hasClaudeOpus(supabaseClient, userId)) models.push('claude.opus');
    if (await ModelAccess.hasGPT3(supabaseClient, userId)) models.push('openai.gpt3');
    if (await ModelAccess.hasGPT4(supabaseClient, userId)) models.push('openai.gpt4');
    
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
  hasFilesystem: async (supabaseClient: SupabaseClient, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.hasDatasourceAccess(userId, 'filesystem', operation);
    } catch (error) {
      console.error('Error checking filesystem access:', error);
      return false;
    }
  },

  /**
   * Check if user has GitHub access
   */
  hasGitHub: async (supabaseClient: SupabaseClient, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.hasDatasourceAccess(userId, 'github', operation);
    } catch (error) {
      console.error('Error checking GitHub access:', error);
      return false;
    }
  },

  /**
   * Check if user has Notion access
   */
  hasNotion: async (supabaseClient: SupabaseClient, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.hasDatasourceAccess(userId, 'notion', operation);
    } catch (error) {
      console.error('Error checking Notion access:', error);
      return false;
    }
  },

  /**
   * Check if user has Supabase access
   */
  hasSupabase: async (supabaseClient: SupabaseClient, userId: string, operation: 'read' | 'write' = 'read'): Promise<boolean> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.hasDatasourceAccess(userId, 'supabase', operation);
    } catch (error) {
      console.error('Error checking Supabase access:', error);
      return false;
    }
  },

  /**
   * Get all available datasources for a user
   */
  getAvailableDatasources: async (supabaseClient: SupabaseClient, userId: string): Promise<{ name: string; read: boolean; write: boolean }[]> => {
    const datasources = [];
    
    const filesystem = await DatasourceAccess.hasFilesystem(supabaseClient, userId, 'read');
    const filesystemWrite = await DatasourceAccess.hasFilesystem(supabaseClient, userId, 'write');
    if (filesystem) {
      datasources.push({ name: 'filesystem', read: true, write: filesystemWrite });
    }
    
    const github = await DatasourceAccess.hasGitHub(supabaseClient, userId, 'read');
    const githubWrite = await DatasourceAccess.hasGitHub(supabaseClient, userId, 'write');
    if (github) {
      datasources.push({ name: 'github', read: true, write: githubWrite });
    }
    
    const notion = await DatasourceAccess.hasNotion(supabaseClient, userId, 'read');
    const notionWrite = await DatasourceAccess.hasNotion(supabaseClient, userId, 'write');
    if (notion) {
      datasources.push({ name: 'notion', read: true, write: notionWrite });
    }
    
    const supabase = await DatasourceAccess.hasSupabase(supabaseClient, userId, 'read');
    const supabaseWrite = await DatasourceAccess.hasSupabase(supabaseClient, userId, 'write');
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
  hasBuiltinTools: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.TOOLS.BUILTIN);
  },

  /**
   * Check if user has external tools (MCP) access
   */
  hasExternalTools: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.TOOLS.EXTERNAL);
  },

  /**
   * Get available tools for a user
   */
  getAvailableTools: async (supabaseClient: SupabaseClient, userId: string): Promise<string[]> => {
    const tools = [];
    
    if (await ToolsAccess.hasBuiltinTools(supabaseClient, userId)) tools.push('builtin');
    if (await ToolsAccess.hasExternalTools(supabaseClient, userId)) tools.push('external');
    
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
  getTokensPerMinute: async (supabaseClient: SupabaseClient, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.getRateLimit(userId, 'tokens_per_minute');
    } catch (error) {
      console.error('Error getting tokens per minute limit:', error);
      return 0;
    }
  },

  /**
   * Get user's requests per minute limit
   */
  getRequestsPerMinute: async (supabaseClient: SupabaseClient, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.getRateLimit(userId, 'requests_per_minute');
    } catch (error) {
      console.error('Error getting requests per minute limit:', error);
      return 0;
    }
  },

  /**
   * Get all rate limits for a user
   */
  getAllLimits: async (supabaseClient: SupabaseClient, userId: string): Promise<{ tokensPerMinute: number; requestsPerMinute: number }> => {
    const [tokensPerMinute, requestsPerMinute] = await Promise.all([
      RateLimits.getTokensPerMinute(supabaseClient, userId),
      RateLimits.getRequestsPerMinute(supabaseClient, userId)
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
  hasCommunitySupport: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.SUPPORT.COMMUNITY);
  },

  /**
   * Check if user has email support
   */
  hasEmailSupport: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.SUPPORT.EMAIL);
  },

  /**
   * Check if user has priority queue access
   */
  hasPriorityQueue: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.SUPPORT.PRIORITY_QUEUE);
  },

  /**
   * Check if user has early access features
   */
  hasEarlyAccess: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.FEATURES.EARLY_ACCESS);
  },

  /**
   * Check if user has workspace isolation
   */
  hasWorkspaceIsolation: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.FEATURES.WORKSPACE_ISOLATION);
  },

  /**
   * Check if user has SSO access
   */
  hasSSO: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.FEATURES.SSO);
  },

  /**
   * Check if user has dedicated CSM
   */
  hasDedicatedCSM: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.FEATURES.DEDICATED_CSM);
  },

  /**
   * Check if user has on-premises option
   */
  hasOnPremises: async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    return await checkFeatureAccess(supabaseClient, userId, FEATURE_KEYS.FEATURES.ON_PREM);
  }
};

/**
 * Cache Management Helpers
 */
export const CacheManagement = {
  /**
   * Refresh feature cache for a user
   */
  refreshCache: async (supabaseClient: SupabaseClient, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(supabaseClient);
      return await service.refreshFeatureCache(userId);
    } catch (error) {
      console.error('Error refreshing feature cache:', error);
      return 0;
    }
  },

  /**
   * Clear feature cache for a user
   */
  clearCache: async (supabaseClient: SupabaseClient, userId: string): Promise<number> => {
    try {
      const service = getFeatureService(supabaseClient);
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
export const getUserFeatureProfile = async (supabaseClient: SupabaseClient, userId: string) => {
  try {
    const [
      models,
      datasources,
      tools,
      limits,
      support
    ] = await Promise.all([
      ModelAccess.getAvailableModels(supabaseClient, userId),
      DatasourceAccess.getAvailableDatasources(supabaseClient, userId),
      ToolsAccess.getAvailableTools(supabaseClient, userId),
      RateLimits.getAllLimits(supabaseClient, userId),
      Promise.all([
        SupportAccess.hasCommunitySupport(supabaseClient, userId),
        SupportAccess.hasEmailSupport(supabaseClient, userId),
        SupportAccess.hasPriorityQueue(supabaseClient, userId),
        SupportAccess.hasEarlyAccess(supabaseClient, userId),
        SupportAccess.hasWorkspaceIsolation(supabaseClient, userId),
        SupportAccess.hasSSO(supabaseClient, userId),
        SupportAccess.hasDedicatedCSM(supabaseClient, userId),
        SupportAccess.hasOnPremises(supabaseClient, userId)
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
  return async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    const hasAccess = await checkFeatureAccess(supabaseClient, userId, featureKey);
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
  return async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    const hasAccess = await ModelAccess.hasModel(supabaseClient, userId, modelKey);
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
  return async (supabaseClient: SupabaseClient, userId: string): Promise<boolean> => {
    const service = getFeatureService(supabaseClient);
    const hasAccess = await service.hasDatasourceAccess(userId, datasourceKey, operation);
    if (!hasAccess) {
      throw new Error(`Datasource '${datasourceKey}' ${operation} access is not available on your current plan`);
    }
    return true;
  };
};

/**
 * Manual cleanup for service cache in long-running processes
 * This complements WeakMap's automatic cleanup
 */
function cleanupStaleServices(): number {
  const now = Date.now();
  let cleanedCount = 0;
  
  // Check all tracked clients
  const clientsToRemove: WeakRef<SupabaseClient>[] = [];
  
  for (const clientRef of activeClients) {
    const client = clientRef.deref();
    
    if (!client) {
      // Client was garbage collected, remove the weak reference
      clientsToRemove.push(clientRef);
      cleanedCount++;
    } else {
      // Check if client is too old
      const timestamp = serviceTimestamps.get(client);
      if (timestamp && (now - timestamp) > MAX_CLIENT_AGE) {
        // Force cleanup of old client
        // Note: We can't remove from WeakMap directly, but we can remove our tracking
        serviceTimestamps.delete(client);
        clientsToRemove.push(clientRef);
        cleanedCount++;
        
        // Optionally: clear the service's internal cache
        const service = serviceCache.get(client);
        if (service && typeof service.clearCache === 'function') {
          service.clearCache();
        }
      }
    }
  }
  
  // Remove stale references
  clientsToRemove.forEach(ref => activeClients.delete(ref));
  
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
    
    // Stop cleanup if no active clients
    if (activeClients.size === 0) {
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
  const activeClientCount = Array.from(activeClients).filter(ref => ref.deref()).length;
  
  return {
    activeClients: activeClientCount,
    trackedReferences: activeClients.size,
    cleanupActive: cleanupTimer !== null,
    cleanupInterval: CLEANUP_INTERVAL,
    maxClientAge: MAX_CLIENT_AGE
  };
};

// Export feature keys for convenience
export { FEATURE_KEYS };