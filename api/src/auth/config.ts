import { ConfigFetchError, type SupabaseConfig } from '../types/auth.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

/**
 * Validates a Supabase configuration object
 * @throws {ConfigFetchError} if the configuration is invalid
 */
export function validateSupabaseConfig(config: unknown): config is SupabaseConfig {
	try {
		if (!config || typeof config !== 'object') {
			throw new Error('Config must be an object');
		}

		const { url, anonKey } = config as Record<string, unknown>;

		if (typeof url !== 'string' || !url.trim()) {
			throw new Error('url must be a non-empty string');
		}

		if (typeof anonKey !== 'string' || !anonKey.trim()) {
			throw new Error('anonKey must be a non-empty string');
		}

		// Validate URL format
		try {
			new URL(url);
		} catch {
			throw new Error('url must be a valid URL');
		}

		// Validate anonKey format (Supabase anon keys are base64 URL-safe)
		if (!/^[a-zA-Z0-9._-]+$/.test(anonKey)) {
			throw new Error('anonKey contains invalid characters');
		}

		return true;
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown validation error';
		logger.error('AuthConfig: Supabase config validation failed:', message);
		throw new ConfigFetchError(`Invalid config: ${message}`, 0);
	}
}

/**
 * Fetches Supabase configuration from the BUI with retries
 */
export async function fetchSupabaseConfig(options = { maxRetries: 3, retryDelay: 5000 }): Promise<SupabaseConfig> {
	const configManager = await ConfigManagerV2.getInstance();
	const globalConfig = await configManager.getGlobalConfig();
	//logger.info(`AuthConfig: Fetching Supabase config from:`, globalConfig.api.supabaseConfigUrl);
	//const configUrl = globalConfig.api.supabaseConfigUrl || 'https://localhost:8080/api/config/supabase';
	const configUrl = globalConfig.api.supabaseConfigUrl || 'https://chat.beyondbetter.dev/api/config/supabase';
	const { maxRetries, retryDelay } = options;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			logger.info(
				`AuthConfig: Fetching Supabase config from BUI [${configUrl}] (attempt ${attempt}/${maxRetries})`,
			);

			const response = await fetch(configUrl);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const config = await response.json();

			// Validate the config
			validateSupabaseConfig(config);

			logger.info('AuthConfig: Successfully fetched and validated Supabase config from BUI');
			return config;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			logger.error(
				`AuthConfig: Failed to fetch Supabase config (attempt ${attempt}/${maxRetries}):`,
				message,
			);

			if (attempt === maxRetries) {
				logger.error('AuthConfig: Max retry attempts reached. API will not start.');
				throw new ConfigFetchError(message, attempt);
			}

			logger.info(`AuthConfig: Retrying in ${retryDelay / 1000} seconds...`);
			await new Promise((resolve) => setTimeout(resolve, retryDelay));
		}
	}

	// This should never be reached due to throw in the loop, but TypeScript needs it
	throw new ConfigFetchError('Failed to fetch config (unreachable)', maxRetries);
}
