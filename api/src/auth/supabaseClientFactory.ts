import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient, SupabaseClientOptions } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from 'api/auth/config.ts';
import { logger } from 'shared/logger.ts';
import { KVAuthStorage } from 'shared/kvAuthStorage.ts';
import type { SupabaseConfig } from 'api/types/auth.ts';
import type {
	// SupabaseClientAuth,
	// SupabaseClientBilling,
	// SupabaseClientCore,
	// SupabaseClientLlm,
	// SupabaseClientMarketing,
	SupabaseClientWithSchema,
} from 'shared/types/supabase.ts';
import type { UserContext } from 'shared/types/app.ts';

type BbAbiSchema = 'abi_api' | 'abi_billing' | 'abi_llm' | 'abi_auth' | 'abi_core' | 'abi_marketing' | 'public';
/**
 * Standalone Supabase Client Factory
 * Creates schema-specific Supabase clients for different use cases
 *
 * Usage:
 * - clientNoAuth: For operations that don't require user authentication (signup, login, reset password)
 * - clientWithAuth: For operations that require user authentication (user updates, authorized API calls)
 */
export class SupabaseClientFactory {
	private static config: SupabaseConfig | null = null;
	private static clientCache = new Map<string, SupabaseClient>();
	private static closing = false;
	private static isInitialized = false;

	/**
	 * Initialize the factory with Supabase configuration
	 */
	static async initialize(): Promise<void> {
		if (SupabaseClientFactory.isInitialized) return;
		if (!SupabaseClientFactory.config) {
			SupabaseClientFactory.config = await fetchSupabaseConfig();
		}
		SupabaseClientFactory.isInitialized = true;
	}

	/**
	 * Create a Supabase client for a specific schema
	 * @param schema - The database schema to use (e.g., 'abi_core', 'public')
	 * @param useAuth - Whether to include auth configuration (default: false)
	 * @returns Configured Supabase client
	 */
	static async createClient<
		T extends BbAbiSchema,
	>(
		schema: T,
		useAuth = false,
		userContext?: UserContext | null, // login needs client with storage, but no userConext yet
	): Promise<SupabaseClientWithSchema<T>> {
		await SupabaseClientFactory.initialize();

		if (!SupabaseClientFactory.config) {
			throw new Error('SupabaseClientFactory: Configuration not initialized');
		}

		// Use cache key to avoid creating duplicate clients
		const cacheKey = `${schema}_${useAuth ? 'auth' : 'noauth'}`;
		const cachedClient = SupabaseClientFactory.clientCache.get(cacheKey);
		if (cachedClient) {
			return cachedClient;
		}

		const clientOptions: SupabaseClientOptions<BbAbiSchema> = {
			db: { schema },
		};

		// Only add auth configuration if requested
		if (useAuth) {
			const storage = await KVAuthStorage.getStorage(userContext?.userId || ''); // we should allow null to indicate no key/prefix yet, so new entries can be added

			clientOptions.auth = {
				storage,
				autoRefreshToken: true,
				persistSession: true,
				detectSessionInUrl: false,
			};
		}

		// Use type assertion to ensure the client is properly typed with the schema
		const client = createClient(
			SupabaseClientFactory.config.url,
			SupabaseClientFactory.config.anonKey,
			clientOptions,
		) as SupabaseClientWithSchema<T>;

		// Cache the client
		SupabaseClientFactory.clientCache.set(cacheKey, client);

		return client;
	}

	/**
	 * Create a client without authentication (for signup, login, reset password operations)
	 * @param schema - The database schema to use (typically 'public' for auth operations)
	 * @returns Non-authenticated Supabase client
	 */
	static async createClientNoAuth<
		T extends BbAbiSchema,
	>(
		schema: T,
	): Promise<SupabaseClientWithSchema<T>> {
		logger.debug(`SupabaseClientFactory: Creating clientNoAuth for schema: ${schema}`);
		return await SupabaseClientFactory.createClient(schema, false);
	}

	/**
	 * Create a client with authentication (for operations requiring user context)
	 * @param schema - The database schema to use
	 * @returns Authenticated Supabase client
	 */
	static async createClientWithAuth<
		T extends BbAbiSchema,
	>(
		schema: T,
		userContext: UserContext | null, // login needs client with storage, but no userConext yet
	): Promise<SupabaseClientWithSchema<T>> {
		logger.debug(`SupabaseClientFactory: Creating clientWithAuth for schema: ${schema}`);
		return await SupabaseClientFactory.createClient(schema, true, userContext);
	}

	static async getCoreClient<T extends BbAbiSchema = 'abi_core'>(
		userContext: UserContext,
	): Promise<SupabaseClientWithSchema<T>> {
		return await SupabaseClientFactory.createClientWithAuth('abi_core', userContext);
	}
	static async getAuthClient<T extends BbAbiSchema = 'abi_auth'>(
		userContext: UserContext,
	): Promise<SupabaseClientWithSchema<T>> {
		return await SupabaseClientFactory.createClientWithAuth('abi_auth', userContext);
	}
	static async getBillingClient<T extends BbAbiSchema = 'abi_billing'>(
		userContext: UserContext,
	): Promise<SupabaseClientWithSchema<T>> {
		return await SupabaseClientFactory.createClientWithAuth('abi_billing', userContext);
	}
	static async getClient<T extends BbAbiSchema = 'public'>(
		userContext: UserContext | null, // login needs client with storage, but no userConext yet
	): Promise<SupabaseClientWithSchema<T>> {
		return await SupabaseClientFactory.createClientWithAuth('public', userContext);
	}
	static async getClientNoAuth<T extends BbAbiSchema = 'public'>(): Promise<SupabaseClientWithSchema<T>> {
		return await SupabaseClientFactory.createClientNoAuth('public');
	}

	/**
	 * Get the cached configuration
	 */
	static getConfig(): SupabaseConfig | null {
		return SupabaseClientFactory.config;
	}

	/**
	 * Close Supabase clients and clear caches (called during API shutdown)
	 * Note: Auth storage is managed by KVAuthStorage
	 */
	// deno-lint-ignore require-await
	static async close(): Promise<void> {
		if (SupabaseClientFactory.closing) return;
		SupabaseClientFactory.closing = true;

		try {
			// Clear client cache on shutdown
			SupabaseClientFactory.clientCache.clear();
			logger.debug('SupabaseClientFactory: Client cache cleared');
		} finally {
			SupabaseClientFactory.closing = false;
		}
	}

	/**
	 * Clear the client cache (useful for testing or cleanup)
	 */
	static clearCache(): void {
		SupabaseClientFactory.clientCache.clear();
	}
}
