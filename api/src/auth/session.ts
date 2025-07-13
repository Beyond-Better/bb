import { createClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from './config.ts';
import { logger } from 'shared/logger.ts';
import { KVStorage } from 'shared/kvStorage.ts';
import type { Session, SupabaseConfig } from '../types/auth.ts';
import type {
	SupabaseClientAuth,
	SupabaseClientBilling,
	SupabaseClientCore,
	SupabaseClientLlm,
	SupabaseClientMarketing,
	SupabaseClientWithSchema,
} from 'shared/types/supabase.ts';

/**
 * Supabase Client Factory
 * Creates schema-specific Supabase clients for different use cases
 */
export class SupabaseClientFactory {
	private static config: SupabaseConfig | null = null;
	private static clientCache = new Map<string, any>();

	/**
	 * Initialize the factory with Supabase configuration
	 */
	static async initialize(): Promise<void> {
		if (!SupabaseClientFactory.config) {
			SupabaseClientFactory.config = await fetchSupabaseConfig();
		}
	}

	/**
	 * Create a Supabase client for a specific schema
	 * @param schema - The database schema to use (e.g., 'abi_core', 'public')
	 * @param useAuth - Whether to include auth configuration (default: false)
	 * @returns Configured Supabase client
	 */
	static async createClient<T extends 'abi_billing' | 'abi_llm' | 'abi_auth' | 'abi_core' | 'abi_marketing' | 'public'>(
		schema: T,
		useAuth = false
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

		const clientOptions: any = {
			db: { schema },
		};

		// Only add auth configuration if requested (for session management)
		if (useAuth) {
			const storage = new KVStorage({
				prefix: 'supabase_auth',
				filename: 'auth.kv',
			});
			await storage.initialize();

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
			clientOptions
		) as SupabaseClientWithSchema<T>;

		// Cache the client
		SupabaseClientFactory.clientCache.set(cacheKey, client);

		return client;
	}

	/**
	 * Get the cached configuration
	 */
	static getConfig(): SupabaseConfig | null {
		return SupabaseClientFactory.config;
	}

	/**
	 * Clear the client cache (useful for testing or cleanup)
	 */
	static clearCache(): void {
		SupabaseClientFactory.clientCache.clear();
	}
}

/**
 * Manages Supabase authentication session
 * - Initializes Supabase client with Deno KV Storage
 * - Handles session refresh
 * - Manages single auth session
 */
export class SessionManager {
	private supabaseClient: SupabaseClientWithSchema<'public'> | null = null;
	private config: SupabaseConfig | null = null;
	private storage: KVStorage;

	constructor() {
		// Initialize KVStorage with auth-specific settings
		this.storage = new KVStorage({
			prefix: 'supabase_auth',
			filename: 'auth.kv', // Store auth data in separate file
		});
	}

	/**
	 * Initialize the session manager
	 * - Initializes KV storage
	 * - Fetches Supabase config
	 * - Sets up Supabase client with storage
	 * - Starts auto refresh
	 */
	async initialize(): Promise<void> {
		try {
			// Initialize KV storage first
			await this.storage.initialize();

			// Initialize the factory and get auth-enabled client
			await SupabaseClientFactory.initialize();
			this.config = SupabaseClientFactory.getConfig();
			this.supabaseClient = await SupabaseClientFactory.createClient('public', true);

			// Enable auto refresh
			if (this.supabaseClient) {
				await this.supabaseClient.auth.startAutoRefresh();
			}
			logger.info('SessionManager: initialized successfully');
		} catch (error) {
			logger.error('SessionManager: Failed to initialize SessionManager:', error);
			throw error;
		}
	}

	/**
	 * Get the current session if any
	 */
	async getSession(): Promise<Session | null> {
		if (!this.supabaseClient) {
			throw new Error('SessionManager not initialized');
		}

		try {
			const { data: { session }, error } = await this.supabaseClient.auth.getSession();

			if (error) {
				throw error;
			}

			return session;
		} catch (error) {
			logger.error('SessionManager: Error getting session:', error);
			return null;
		}
	}

	/**
	 * Clear the current session
	 */
	async clearSession(): Promise<void> {
		if (!this.supabaseClient) {
			throw new Error('SessionManager not initialized');
		}

		try {
			await this.supabaseClient.auth.signOut();
			this.storage.clear();
			logger.info('SessionManager: Session cleared successfully');
		} catch (error) {
			logger.error('SessionManager: Error clearing session:', error);
			throw error;
		}
	}

	/**
	 * Clean up resources
	 */
	async destroy(): Promise<void> {
		if (this.supabaseClient) {
			await this.supabaseClient.auth.stopAutoRefresh();
			this.supabaseClient = null;
		}
		this.storage.clear();
		await this.storage.close(); // Ensure proper cleanup
		this.config = null;
	}

	/**
	 * Get the verification URL for email signups
	 * Throws if not initialized
	 */
	getVerifyUrl(): string {
		if (!this.config) {
			throw new Error('SessionManager not initialized');
		}
		return this.config.verifyUrl;
	}

	/**
	 * Get the Supabase client instance
	 * Throws if not initialized
	 */
	getClient(): SupabaseClientWithSchema<'public'> {
		if (!this.supabaseClient) {
			throw new Error('SessionManager not initialized');
		}
		return this.supabaseClient;
	}
}
