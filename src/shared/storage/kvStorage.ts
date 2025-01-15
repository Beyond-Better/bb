import { join } from '@std/path';
import { getBbDataDir, getGlobalConfigDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

export type KVStorageOptions = {
	prefix?: string;
	projectId?: string; // If provided, uses project-specific storage
	filename?: string; // Custom filename for the KV store
};

/**
 * KVStorage implements the Storage interface using Deno.Kv
 * Maintains a memory cache for synchronous operations required by the Storage interface
 */
export class KVStorage implements Storage {
	private kv: Deno.Kv | null = null;
	private prefix: string;
	private projectId?: string;
	private filename: string;
	private cache: Map<string, string>;

	constructor(options: KVStorageOptions = {}) {
		this.prefix = options.prefix || 'auth';
		this.projectId = options.projectId;
		this.filename = options.filename || 'bb.kv';
		this.cache = new Map();
	}

	async initialize(): Promise<void> {
		try {
			const kvPath = await this.getKvPath();
			this.kv = await Deno.openKv(kvPath);
			logger.info(`KVStorage: initialized at: ${kvPath}`);

			// Load initial data into cache
			await this.loadCache();
		} catch (error) {
			logger.error('KVStorage: Failed to initialize KVStorage:', error);
			throw error;
		}
	}

	private async loadCache(): Promise<void> {
		this.ensureInitialized();
		this.cache.clear();

		const entries = this.kv!.list({ prefix: [this.prefix] });
		//logger.info(`KVStorage: Entries for prefix: '${this.prefix}'`, entries);
		for await (const entry of entries) {
			//logger.info(`KVStorage: entry`, entry);
			const key = entry.key[entry.key.length - 1] as string;
			const value = entry.value as string;
			this.cache.set(key, value);
		}
		//logger.info('KVStorage: Cache:', Object.fromEntries(this.cache));
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
			logger.error('KVStorage: Failed to determine KV path:', error);
			throw error;
		}
	}

	private ensureInitialized(): void {
		if (!this.kv) {
			throw new Error('KVStorage: not initialized. Call initialize() first.');
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
			logger.error('KVStorage: Error in async clear:', error);
		});
	}

	getItem(key: string): string | null {
		//logger.info(`KVStorage: getItem:`, {key});
		return this.cache.get(key) ?? null;
	}

	setItem(key: string, value: string): void {
		this.cache.set(key, value);
		//logger.info(`KVStorage: setItem:`, {key, value});
		// Async persist in background
		this.setItemAsync(key, value).catch((error) => {
			logger.error('KVStorage: Error in async setItem:', error);
		});
	}

	removeItem(key: string): void {
		this.cache.delete(key);
		// Async cleanup in background
		this.removeItemAsync(key).catch((error) => {
			logger.error('KVStorage: Error in async removeItem:', error);
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
	async close(): Promise<void> {
		if (this.kv) {
			await this.kv.close();
			this.kv = null;
		}
		this.cache.clear();
	}

	// Method to force sync cache with KV store
	async sync(): Promise<void> {
		await this.loadCache();
	}
}
