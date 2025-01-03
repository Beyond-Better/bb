import { createClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from './config.ts';
import { logger } from 'shared/logger.ts';
import type { Session, SupabaseConfig } from '../types/auth.ts';

/**
 * Manages Supabase authentication session
 * - Initializes Supabase client with Deno Storage
 * - Handles session refresh
 * - Manages single auth session
 */
export class SessionManager {
	private supabaseClient: ReturnType<typeof createClient> | null = null;
	private config: SupabaseConfig | null = null;
	private storage: Storage;

	constructor() {
		// Use Deno's built-in Storage API
		this.storage = localStorage; // Use persistent storage
	}

	/**
	 * Initialize the session manager
	 * - Fetches Supabase config
	 * - Sets up Supabase client with storage
	 * - Starts auto refresh
	 */
	async initialize(): Promise<void> {
		try {
			this.config = await fetchSupabaseConfig();
			logger.info('SessionManager: initialized with config: ', this.config);

			this.supabaseClient = createClient(this.config.url, this.config.anonKey, {
				auth: {
					storage: this.storage,
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false, // API handles auth callbacks differently
				},
			});
			//logger.info('SessionManager: initialized with supabaseClient: ', this.supabaseClient);

			// Enable auto refresh
			await this.supabaseClient.auth.startAutoRefresh();

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
		this.config = null;
	}

	/**
	 * Get the Supabase client instance
	 * Throws if not initialized
	 */
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
	getClient(): ReturnType<typeof createClient> {
		if (!this.supabaseClient) {
			throw new Error('SessionManager not initialized');
		}
		return this.supabaseClient;
	}
}
