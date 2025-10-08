import { logger } from 'shared/logger.ts';
import type { Session, SupabaseConfig } from 'api/types/auth.ts';
import type { SupabaseClientWithSchema } from 'shared/types/supabase.ts';
import { SupabaseClientFactory } from 'api/auth/supabaseClientFactory.ts';
import { KVAuthStorage } from 'shared/kvAuthStorage.ts';
import type { UserContext } from 'shared/types/userContext.ts';

/**
 * Manages Supabase authentication session
 * - Initializes Supabase client with Deno KV Storage
 * - Handles session refresh
 * - Manages single auth session
 */
export class UserAuthSession {
	private supabaseClient: SupabaseClientWithSchema<'public'> | null = null;
	private supabaseClientAuth: SupabaseClientWithSchema<'abi_auth'> | null = null;
	private supabaseClientBilling: SupabaseClientWithSchema<'abi_billing'> | null = null;
	private supabaseClientCore: SupabaseClientWithSchema<'abi_core'> | null = null;
	private config: SupabaseConfig | null = null;

	constructor(private userId: string) {}

	/**
	 * Initialize the session manager
	 * - Uses shared KVStorage from SupabaseClientFactory
	 * - Fetches Supabase config
	 * - Sets up Supabase client with shared storage
	 * - Starts auto refresh
	 */
	async initialize(): Promise<UserAuthSession> {
		try {
			// Initialize the factory (which handles shared KVStorage)
			await SupabaseClientFactory.initialize();
			this.config = SupabaseClientFactory.getConfig();

			const userContext: UserContext = {
				userId: this.userId,
				user: {
					id: this.userId,
					email: '',
				},
				userAuthSession: this,
			};

			this.supabaseClient = await SupabaseClientFactory.getClient(userContext);
			this.supabaseClientAuth = await SupabaseClientFactory.getAuthClient(userContext);
			this.supabaseClientBilling = await SupabaseClientFactory.getBillingClient(userContext);
			this.supabaseClientCore = await SupabaseClientFactory.getCoreClient(userContext);
			logger.info('UserAuthSession: created supabase clients');

			// Enable auto refresh
			if (this.supabaseClient) {
				await this.supabaseClient.auth.startAutoRefresh();
			}
			logger.info('UserAuthSession: initialized successfully');

			return this;
		} catch (error) {
			logger.error('UserAuthSession: Failed to initialize UserAuthSession:', error);
			throw error;
		}
	}

	/**
	 * Get the current session if any
	 */
	async getSession(): Promise<Session | null> {
		if (!this.supabaseClient) {
			throw new Error('UserAuthSession not initialized');
		}

		try {
			const { data: { session }, error } = await this.supabaseClient.auth.getSession();

			if (error) {
				throw error;
			}

			return session;
		} catch (error) {
			logger.error('UserAuthSession: Error getting session:', error);
			return null;
		}
	}

	/**
	 * Clear the current session
	 */
	async clearSession(): Promise<void> {
		if (!this.supabaseClient) {
			throw new Error('UserAuthSession not initialized');
		}

		try {
			await this.supabaseClient.auth.signOut();
			// Clear shared auth storage
			const storage = await KVAuthStorage.getStorage(this.userId);
			storage.clear();
			logger.info('UserAuthSession: Session cleared successfully');
		} catch (error) {
			logger.error('UserAuthSession: Error clearing session:', error);
			throw error;
		}
	}

	/**
	 * Clean up resources
	 * Note: Shared KVAuthStorage is managed centrally, not closed here
	 */
	async destroy(): Promise<void> {
		if (this.supabaseClient) {
			await this.supabaseClient.auth.stopAutoRefresh();
			this.supabaseClient = null;
		}
		this.config = null;
	}

	/**
	 * Get the verification URL for email signups
	 * Throws if not initialized
	 */
	getVerifyUrl(): string {
		if (!this.config) {
			throw new Error('UserAuthSession not initialized');
		}
		return this.config.verifyUrl;
	}

	/**
	 * Get the Supabase client instance
	 * @deprecated Use SupabaseClientFactory.createClient() instead
	 * Throws if not initialized
	 */
	getClient(): SupabaseClientWithSchema<'public'> {
		logger.warn(
			'UserAuthSession: 🚨 DEPRECATED: userAuthSession.getClient() called - migrate to SupabaseClientFactory.createClient()',
		);
		logger.warn(
			'UserAuthSession: 🚨 Called from:',
			new Error().stack?.split('\n')[2]?.trim() || 'unknown location',
		);
		if (!this.supabaseClient) {
			throw new Error('UserAuthSession not initialized');
		}
		return this.supabaseClient;
	}
	/**
	 * @deprecated Use SupabaseClientFactory.createClient('abi_auth') instead
	 */
	getAuthClient(): SupabaseClientWithSchema<'abi_auth'> {
		logger.warn(
			"UserAuthSession: 🚨 DEPRECATED: userAuthSession.getAuthClient() called - migrate to SupabaseClientFactory.createClient('abi_auth')",
		);
		logger.warn(
			'UserAuthSession: 🚨 Called from:',
			new Error().stack?.split('\n')[2]?.trim() || 'unknown location',
		);
		if (!this.supabaseClientAuth) {
			throw new Error('UserAuthSession not initialized');
		}
		return this.supabaseClientAuth;
	}
	/**
	 * @deprecated Use SupabaseClientFactory.createClient('abi_billing') instead
	 */
	getBillingClient(): SupabaseClientWithSchema<'abi_billing'> {
		logger.warn(
			"UserAuthSession: 🚨 DEPRECATED: userAuthSession.getBillingClient() called - migrate to SupabaseClientFactory.createClient('abi_billing')",
		);
		logger.warn(
			'UserAuthSession: 🚨 Called from:',
			new Error().stack?.split('\n')[2]?.trim() || 'unknown location',
		);
		if (!this.supabaseClientBilling) {
			throw new Error('UserAuthSession not initialized');
		}
		return this.supabaseClientBilling;
	}
	/**
	 * @deprecated Use SupabaseClientFactory.createClient('abi_core') instead
	 */
	getCoreClient(): SupabaseClientWithSchema<'abi_core'> {
		logger.warn(
			"UserAuthSession: 🚨 DEPRECATED: userAuthSession.getCoreClient() called - migrate to SupabaseClientFactory.createClient('abi_core')",
		);
		logger.warn(
			'UserAuthSession: 🚨 Called from:',
			new Error().stack?.split('\n')[2]?.trim() || 'unknown location',
		);
		if (!this.supabaseClientCore) {
			throw new Error('UserAuthSession not initialized');
		}
		return this.supabaseClientCore;
	}
}
