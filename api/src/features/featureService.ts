import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from 'shared/logger.ts';
import { fetchSupabaseConfig } from 'api/auth/config.ts';
import type { ProjectId } from 'shared/types.ts';
import type { SessionManager } from 'api/auth/session.ts';

export interface FeatureCheckRequest {
	feature: string;
	projectId?: ProjectId;
	userId?: string;
	context?: Record<string, unknown>;
}

export interface FeatureCheckResponse {
	allowed: boolean;
	reason?: string;
	metadata?: Record<string, unknown>;
}

/**
 * Feature service for checking user access to features
 * Supports both single-user (current) and multi-user (future) modes
 */
export class FeatureService {
	private supabaseClient: SupabaseClient | null = null;
	private sessionManager: SessionManager | null = null;
	private isLocalMode: boolean = false;

	constructor(
		supabaseClient?: SupabaseClient,
		sessionManager?: SessionManager,
		isLocalMode?: boolean
	) {
		this.supabaseClient = supabaseClient || null;
		this.sessionManager = sessionManager || null;
		this.isLocalMode = isLocalMode ?? false;
	}

	async init(): Promise<FeatureService> {
		if (!this.isLocalMode && !this.supabaseClient) {
			try {
				const config = await fetchSupabaseConfig();
				this.supabaseClient = createClient(config.url, config.anonKey);
				logger.info('FeatureService: Initialized with Supabase client');
			} catch (error) {
				logger.warn(`FeatureService: Failed to initialize Supabase client: ${(error as Error).message}`);
			}
		}
		return this;
	}

	/**
	 * Check if a user/context has access to a feature
	 */
	async checkFeature(request: FeatureCheckRequest): Promise<FeatureCheckResponse> {
		// In local mode, allow all features
		if (this.isLocalMode) {
			return {
				allowed: true,
				reason: 'Local mode - all features enabled'
			};
		}

		// If no Supabase client, deny by default
		if (!this.supabaseClient) {
			return {
				allowed: false,
				reason: 'Feature service not properly initialized'
			};
		}

		// Get user session
		const session = this.sessionManager?.getSession();
		if (!session) {
			return {
				allowed: false,
				reason: 'No active session'
			};
		}

		try {
			// Check feature access in Supabase
			const { data, error } = await this.supabaseClient
				.rpc('check_feature_access', {
					user_id: session.user.id,
					feature_name: request.feature,
					project_id: request.projectId,
					context: request.context || {}
				});

			if (error) {
				logger.error(`FeatureService: Error checking feature ${request.feature}:`, error);
				return {
					allowed: false,
					reason: 'Feature check failed'
				};
			}

			return {
				allowed: data?.allowed ?? false,
				reason: data?.reason,
				metadata: data?.metadata
			};
		} catch (error) {
			logger.error(`FeatureService: Exception checking feature ${request.feature}:`, error);
			return {
				allowed: false,
				reason: 'Feature check exception'
			};
		}
	}

	/**
	 * Create a feature service instance from a project context
	 * This method supports the transition to multi-user mode
	 */
	static async createFromProject(
		projectId: ProjectId,
		sessionManager: SessionManager,
		isLocalMode: boolean = false
	): Promise<FeatureService> {
		const service = new FeatureService(undefined, sessionManager, isLocalMode);
		return await service.init();
	}

	/**
	 * Get a one-time use instance (for testing)
	 */
	static async getOneUseInstance(): Promise<FeatureService> {
		return new FeatureService(undefined, undefined, true);
	}
}

// Singleton instance for current single-user mode
let globalFeatureService: FeatureService | null = null;

/**
 * Get the global feature service instance (single-user mode)
 * This follows the same pattern as getMCPManager, getConfigManager, etc.
 */
export async function getFeatureService(): Promise<FeatureService> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_FEATURE_SERVICE');
	if (noSingleton) return FeatureService.getOneUseInstance();
	
	if (!globalFeatureService) {
		// In single-user mode, we can use a global session manager
		// This will need to be updated for multi-user mode
		const { SessionManager } = await import('api/auth/session.ts');
		const sessionManager = new SessionManager();
		
		// Check if we're in local mode
		const { getConfigManager } = await import('shared/config/configManager.ts');
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const isLocalMode = globalConfig.api.localMode ?? false;
		
		globalFeatureService = await new FeatureService(
			undefined,
			sessionManager,
			isLocalMode
		).init();
	}
	
	return globalFeatureService;
}

/**
 * Reset the global instance (for testing)
 */
export function resetFeatureService(): void {
	globalFeatureService = null;
}
