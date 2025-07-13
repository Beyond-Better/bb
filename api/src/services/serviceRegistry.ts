import type { ProjectId } from 'shared/types.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { FeatureService } from 'api/features/featureService.ts';
import { logger } from 'shared/logger.ts';

/**
 * Service registry for managing service instances
 * Supports both singleton (current) and per-project (future) modes
 */
export class ServiceRegistry {
	private static instance: ServiceRegistry | null = null;
	private featureServices: Map<ProjectId, FeatureService> = new Map();
	private globalFeatureService: FeatureService | null = null;
	private isMultiUserMode: boolean = false;

	private constructor() {}

	static getInstance(): ServiceRegistry {
		if (!ServiceRegistry.instance) {
			ServiceRegistry.instance = new ServiceRegistry();
		}
		return ServiceRegistry.instance;
	}

	/**
	 * Enable multi-user mode (future feature)
	 */
	enableMultiUserMode(): void {
		this.isMultiUserMode = true;
		logger.info('ServiceRegistry: Multi-user mode enabled');
	}

	/**
	 * Get feature service for a project
	 * In single-user mode, returns global instance
	 * In multi-user mode, returns project-specific instance
	 */
	async getFeatureService(projectId?: ProjectId, sessionManager?: SessionManager): Promise<FeatureService> {
		if (!this.isMultiUserMode) {
			// Single-user mode: use global instance
			if (!this.globalFeatureService) {
				const { getFeatureService } = await import('api/features/featureService.ts');
				this.globalFeatureService = await getFeatureService();
			}
			return this.globalFeatureService;
		}

		// Multi-user mode: use project-specific instances
		if (!projectId) {
			throw new Error('ProjectId is required in multi-user mode');
		}

		if (!this.featureServices.has(projectId)) {
			if (!sessionManager) {
				throw new Error('SessionManager is required for new project feature service');
			}

			const featureService = await FeatureService.createFromProject(
				projectId,
				sessionManager,
				false // Multi-user mode, not local
			);
			this.featureServices.set(projectId, featureService);
		}

		return this.featureServices.get(projectId)!;
	}

	/**
	 * Clear service instances for a project (cleanup)
	 */
	clearProjectServices(projectId: ProjectId): void {
		this.featureServices.delete(projectId);
	}

	/**
	 * Reset all services (for testing)
	 */
	resetAll(): void {
		this.featureServices.clear();
		this.globalFeatureService = null;
		this.isMultiUserMode = false;
	}
}

/**
 * Convenience function to get feature service
 * Follows the same pattern as your existing manager functions
 */
export async function getFeatureServiceForProject(
	projectId?: ProjectId,
	sessionManager?: SessionManager
): Promise<FeatureService> {
	const registry = ServiceRegistry.getInstance();
	return await registry.getFeatureService(projectId, sessionManager);
}
