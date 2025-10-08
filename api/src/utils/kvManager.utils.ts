import { join } from '@std/path';
import { getBbDataDir, getGlobalConfigDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';

export type KVManagerOptions = {
	prefix?: string;
	projectId?: string; // If provided, uses project-specific storage
	filename?: string; // Custom filename for the KV store
};
type SetItemOptions = {
	expireIn?: number;
};
export type KVKey = string | string[];

/**
 * Create a KV manager
 * - Usage
 * const storage = new KVManager<LLMSpeakWithResponse>({ prefix: 'llmCache' }).init();
 * await storage.setItem(key, value);
 * // Type-safe operations
 * const response = await storage.getItem(key);
 * await storage.setItem(key, responseData);
 * // Or with explicit type override
 * await storage.getItem<CustomType>(key);
 * // access KV directly
 * const kv = new KVManager({ prefix: 'llmCache' }).init().kv;
 * kv.set<LLMSpeakWithResponse>(key, value);
 */
export class KVManager<T = unknown> {
	// deno-lint-ignore no-explicit-any
	private static instances: Set<KVManager<any>> = new Set();
	private static kvInstances = new Map<string, Deno.Kv>();
	private static closing = false;

	public kv: Deno.Kv | null = null;
	private kvPath: string | null = null;

	private prefix: string;
	private projectId?: string;
	private filename: string;

	constructor(options: KVManagerOptions = {}) {
		this.prefix = options.prefix || 'api';
		this.projectId = options.projectId;
		this.filename = options.filename || 'api.kv';
		//KVManager.instances.add(this);
	}

	/**
	 * Initialize the KV manager
	 * - Initializes KV storage
	 */
	async init(): Promise<KVManager<T>> {
		try {
			this.kvPath = await this.getKvPath();

			// Reuse existing KV instance if available
			if (KVManager.kvInstances.has(this.kvPath)) {
				this.kv = KVManager.kvInstances.get(this.kvPath)!;
				//logger.debug(`KVManager: reusing instance at: ${this.kvPath}`);
			} else {
				this.kv = await Deno.openKv(this.kvPath);
				KVManager.kvInstances.set(this.kvPath, this.kv);
				//logger.debug(`KVManager: initialized new instance at: ${this.kvPath}`);
			}

			KVManager.instances.add(this);
			//logger.debug(`KVManager: all instances by path: `, KVManager.kvInstances.keys());
		} catch (error) {
			logger.error('KVManager: Failed to initialize KVManager:', error);
			throw error;
		}
		// `unload` event is for browsers only - use closeAll in main.ts instead
		//addEventListener("unload", () => this.close());
		return this;
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
			logger.error('KVManager: Failed to determine KV path:', error);
			throw error;
		}
	}

	private normalizeKey(key: KVKey): string[] {
		return typeof key === 'string' ? [this.prefix, key] : [this.prefix, ...key];
	}

	private ensureInitialized(): void {
		if (!this.kv) {
			throw new Error('KVManager: not initialized. Call initialize() first.');
		}
	}

	public static async closeAll(): Promise<void> {
		if (this.closing) return;
		this.closing = true;
		try {
			const closePromises = [...this.kvInstances.values()].map((kv) => {
				try {
					kv.close();
				} catch (error) {
					if (!(error instanceof Deno.errors.BadResource)) {
						throw error;
					}
				}
			});
			await Promise.all(closePromises);
		} finally {
			this.kvInstances.clear();
			this.closing = false;
		}
	}

	public async setItem<K = T>(key: KVKey, value: K, options?: SetItemOptions): Promise<void> {
		this.ensureInitialized();
		await this.kv!.set(
			this.normalizeKey(key),
			value,
			options?.expireIn ? { expireIn: options.expireIn } : undefined,
		);
	}

	public async setItemAtomic<K = T>(key: KVKey, value: K, options?: SetItemOptions): Promise<void> {
		this.ensureInitialized();
		await this.kv!.atomic()
			.set(this.normalizeKey(key), value, options?.expireIn ? { expireIn: options.expireIn } : undefined)
			.commit();
	}

	public async getItem<K = T>(key: KVKey): Promise<K | null> {
		this.ensureInitialized();
		const result = await this.kv!.get<K>(this.normalizeKey(key));
		return result.value;
	}

	public async getItemMeta<K = T>(key: KVKey): Promise<Deno.KvEntryMaybe<K>> {
		this.ensureInitialized();
		//await this.kv.get<K>(this.normalizeKey(key));
		return await this.kv!.get<K>(this.normalizeKey(key));
	}

	public async removeItem(key: KVKey): Promise<void> {
		this.ensureInitialized();
		await this.kv!.delete(this.normalizeKey(key));
	}

	public async setItems<K = T>(items: Array<[KVKey, K]>, options?: SetItemOptions): Promise<void> {
		this.ensureInitialized();
		const atomic = this.kv!.atomic();
		items.forEach(([key, value]) => {
			atomic.set(this.normalizeKey(key), value, options?.expireIn ? { expireIn: options.expireIn } : undefined);
		});
		await atomic.commit();
	}

	// deno-lint-ignore require-await
	public async list<K = T>(key?: KVKey): Promise<AsyncIterableIterator<Deno.KvEntry<K>>> {
		this.ensureInitialized();
		return this.kv!.list<K>({ prefix: this.normalizeKey(key ?? '') });
	}
}
