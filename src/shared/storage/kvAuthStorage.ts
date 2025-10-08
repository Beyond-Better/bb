import { join } from '@std/path';
import { getBbDataDir, getGlobalConfigDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

export type KVAuthStorageOptions = {
	prefix?: string;
	projectId?: string; // If provided, uses project-specific storage
	filename?: string; // Custom filename for the KV store
};

/**
 * KVAuthStorage manages authentication-related key-value storage using static pattern
 * - Implements Storage interface using Deno.Kv
 * - Maintains memory cache for synchronous operations
 * - Provides static singleton management for auth storage
 */
export class KVAuthStorage implements Storage {
	private static instance: KVAuthStorage | null = null;
	private static closing = false;
	private kv: Deno.Kv | null = null;
	private prefix: string;
	private projectId?: string;
	private filename: string;
	private cache: Map<string, string>;

	private constructor(options: KVAuthStorageOptions = {}) {
		this.prefix = options.prefix || 'supabase_auth';
		this.projectId = options.projectId;
		this.filename = options.filename || 'auth.kv';
		this.cache = new Map();
	}

	private async initialize(): Promise<void> {
		try {
			const kvPath = await this.getKvPath();
			this.kv = await Deno.openKv(kvPath);
			logger.debug(`KVAuthStorage: initialized at: ${kvPath}`);

			// Load initial data into cache
			await this.loadCache();
		} catch (error) {
			logger.error('KVAuthStorage: Failed to initialize KVAuthStorage:', error);
			throw error;
		}
	}

	/**
	 * Get or create the singleton KVAuthStorage instance
	 * userId will be used to constrain storage to matching prefixes when we implement multi-user support
	 */
	static async getStorage(_userId: string): Promise<KVAuthStorage> {
		if (!KVAuthStorage.instance) {
			KVAuthStorage.instance = new KVAuthStorage();
			await KVAuthStorage.instance.initialize();
			logger.info('KVAuthStorage: Singleton instance created and initialized');
		}
		return KVAuthStorage.instance;
	}

	/**
	 * Close the singleton instance and clean up resources
	 */
	static async close(): Promise<void> {
		if (KVAuthStorage.closing) return;
		KVAuthStorage.closing = true;

		try {
			if (KVAuthStorage.instance) {
				logger.info('KVAuthStorage: Closing singleton instance');
				await KVAuthStorage.instance.close();
				KVAuthStorage.instance = null;
			}
		} finally {
			KVAuthStorage.closing = false;
		}
	}

	private async loadCache(): Promise<void> {
		this.ensureInitialized();
		this.cache.clear();

		const entries = this.kv!.list({ prefix: [this.prefix] });
		//logger.debug(`KVAuthStorage: Entries for prefix: '${this.prefix}'`, entries);
		for await (const entry of entries) {
			//logger.debug(`KVAuthStorage: entry`, entry);
			const key = entry.key[entry.key.length - 1] as string;
			const value = entry.value as string;
			this.cache.set(key, value);
		}
		//logger.debug('KVAuthStorage: Cache:', Object.fromEntries(this.cache));
	}

	private async getKvPath(): Promise<string> {
		try {
			if (this.projectId) {
				// Use project-specific storage in .bb/data directory
				const dataDir = await getBbDataDir(this.projectId);
				return join(dataDir, this.filename);
			} else {
				// Use global storage in user's config directory
				const globalDir = await getGlobalConfigDir();
				return join(globalDir, this.filename);
			}
		} catch (error) {
			logger.error('KVAuthStorage: Failed to determine KV path:', error);
			throw error;
		}
	}

	private ensureInitialized(): void {
		if (!this.kv) {
			throw new Error('KVAuthStorage: not initialized. Use KVAuthStorage.getStorage() instead.');
		}
	}

	// Synchronous Storage interface implementation
	get length(): number {
		return this.cache.size;
	}

	clear(): void {
		this.ensureInitialized();
		this.cache.clear();
		// Async cleanup in background
		this.clearAsync().catch((error) => {
			logger.error('KVAuthStorage: Error in async clear:', error);
		});
	}

	getItem(key: string): string | null {
		//logger.debug(`KVAuthStorage: getItem:`, {key});
		return this.cache.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.cache.set(key, value);
		//logger.debug(`KVAuthStorage: setItem:`, {key, value});
		// Async persist in background
		this.setItemAsync(key, value).catch((error) => {
			logger.error('KVAuthStorage: Error in async setItem:', error);
		});
	}

	removeItem(key: string): void {
		this.cache.delete(key);
		// Async cleanup in background
		this.removeItemAsync(key).catch((error) => {
			logger.error('KVAuthStorage: Error in async removeItem:', error);
		});
	}

	key(index: number): string | null {
		return Array.from(this.cache.keys())[index] ?? null;
	}

	// Private async operations
	private async clearAsync(): Promise<void> {
		this.ensureInitialized();
		const entries = this.kv!.list({ prefix: [this.prefix] });
		const atomic = this.kv!.atomic();

		for await (const entry of entries) {
			atomic.delete(entry.key);
		}

		await atomic.commit();
	}

	private async setItemAsync(key: string, value: string): Promise<void> {
		this.ensureInitialized();
		await this.kv!.set([this.prefix, key], value);
	}

	//private async getItemAsync(key: string): Promise<unknown> {
	//	this.ensureInitialized();
	//	return await this.kv!.get([this.prefix, key]);
	//}

	private async removeItemAsync(key: string): Promise<void> {
		this.ensureInitialized();
		await this.kv!.delete([this.prefix, key]);
	}

	// Additional methods for proper cleanup
	private async close(): Promise<void> {
		if (this.kv) {
			logger.debug('KVAuthStorage: Closing Deno.Kv instance');
			try {
				this.kv.close();
			} catch (error) {
				if (!(error instanceof Deno.errors.BadResource)) {
					throw error;
				}
			}
			this.kv = null;
		}
		this.cache.clear();
	}

	// Method to force sync cache with KV store
	async sync(): Promise<void> {
		await this.loadCache();
	}
}
