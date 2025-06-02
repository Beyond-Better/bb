import { getConfigManager } from 'shared/config/configManager.ts';
import type { ApiConfig } from 'shared/config/types.ts';
import { logger } from 'shared/logger.ts';

// Module-level storage for the API base URL
let apiBaseUrl: string = 'http://localhost:3162'; // Default fallback

/**
 * Initialize the API base URL from configuration
 * Should be called once during app startup
 */
export async function initApiBaseUrl(): Promise<void> {
	try {
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const apiConfig: ApiConfig = globalConfig.api;
		
		const apiHostname = apiConfig.hostname || 'localhost';
		const apiPort = apiConfig.port || 3162;
		const apiUseTls = apiConfig.tls?.useTls || false;
		
		apiBaseUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
		logger.info(`ApiBaseUrl: Initialized with ${apiBaseUrl}`);
	} catch (error) {
		logger.warn(`ApiBaseUrl: Failed to load config, using default ${apiBaseUrl}:`, error);
	}
}

/**
 * Get the current API base URL
 * Returns the URL that was set during initialization
 */
export function getApiBaseUrl(): string {
	return apiBaseUrl;
}

/**
 * Update the API base URL (useful for dynamic configuration changes)
 * @param newBaseUrl The new base URL to use
 */
export function setApiBaseUrl(newBaseUrl: string): void {
	apiBaseUrl = newBaseUrl;
	logger.debug(`ApiBaseUrl: Updated to ${apiBaseUrl}`);
}