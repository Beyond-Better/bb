#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * Model Sync to LLM-Proxy Script
 *
 * Syncs model capabilities from the local JSON file to the llm-proxy service.
 * Makes individual requests for each model to provide detailed progress reporting.
 * Supports staging and production environments with separate configurations.
 *
 * Usage:
 *   deno run --allow-net --allow-read --allow-write --allow-env api/scripts/sync_models_to_llm_proxy.ts
 *
 * Options:
 *   --input=PATH                 Input capabilities file (default: api/src/data/modelCapabilities.json)
 *   --environment=ENV            Environment: staging|production (default: staging)
 *   --supabase-url=URL           Override Supabase config URL
 *   --auth-token=TOKEN           Authentication token (can also use env var)
 *   --dry-run                    Show what would be synced without making changes
 *   --force                      Update all models regardless of changes
 */

import { parseArgs } from '@std/cli';
import { exists } from '@std/fs';
import { dirname, fromFileUrl, join } from '@std/path';
import { isError } from 'shared/error.ts';
import type { ModelCapabilities } from 'api/types/modelCapabilities.types.ts';
import { createClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from 'api/auth/config.ts';

/**
 * LLM-Proxy model interface (matches database schema)
 */
interface LLMProxyModel {
	model_id: string;
	provider_name: string;
	model_name: string;
	model_type: string;
	cost_input: number;
	cost_output: number;
	cost_cache_read?: number;
	cost_cache_create?: number;
	is_available: boolean;
	settings: Record<string, unknown>;
	created_at?: string;
	updated_at?: string;
}

/**
 * Model update payload for the edge function
 */
interface ModelUpdatePayload {
	model_id: string;
	provider_name: string;
	model_name: string;
	model_type: string;
	cost_input: number;
	cost_output: number;
	cost_cache_read?: number;
	cost_cache_create?: number;
	is_available: boolean;
	settings: Record<string, unknown>;
}

/**
 * Script configuration
 */
interface SyncConfig {
	inputPath: string;
	environment: 'staging' | 'production';
	supabaseUrl?: string;
	authToken?: string;
	dryRun: boolean;
	force: boolean;
}

/**
 * Sync result for a single model
 */
interface SyncResult {
	modelId: string;
	provider: string;
	action: 'created' | 'updated' | 'skipped' | 'failed';
	error?: string;
}

/**
 * Main model synchronization class
 */
class ModelSyncer {
	private config: SyncConfig;
	private capabilities: Record<string, Record<string, ModelCapabilities & { hidden?: boolean }>> = {};
	private currentLLMProxyModels: LLMProxyModel[] = [];
	private syncResults: SyncResult[] = [];

	constructor(config: SyncConfig) {
		this.config = config;
	}

	/**
	 * Run the synchronization process
	 */
	public async run(): Promise<void> {
		console.log('🔄 Starting model synchronization to llm-proxy...');
		console.log(`📍 Environment: ${this.config.environment}`);
		console.log(`📄 Input file: ${this.config.inputPath}`);
		console.log(`🧪 Dry run: ${this.config.dryRun ? 'YES' : 'NO'}`);

		// Load model capabilities
		await this.loadModelCapabilities();

		// Get current models from llm-proxy
		await this.fetchCurrentLLMProxyModels();

		// Filter and prepare models for sync
		const modelsToSync = this.prepareModelsForSync();

		// Sync models
		await this.syncModels(modelsToSync);

		// Report results
		this.reportResults();

		console.log('✅ Model synchronization completed.');
	}

	/**
	 * Load model capabilities from JSON file
	 */
	private async loadModelCapabilities(): Promise<void> {
		try {
			if (!await exists(this.config.inputPath)) {
				throw new Error(`Model capabilities file not found: ${this.config.inputPath}`);
			}

			const content = await Deno.readTextFile(this.config.inputPath);
			const data = JSON.parse(content);
			
			// Extract model capabilities, excluding metadata
			const { _metadata, ...capabilities } = data;
			this.capabilities = capabilities;

			const totalModels = Object.values(capabilities).reduce((sum, models) => sum + Object.keys(models).length, 0);
			console.log(`📊 Loaded ${totalModels} models from ${Object.keys(capabilities).length} providers`);
		} catch (error) {
			console.error(`❌ Failed to load model capabilities: ${isError(error) ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Fetch current models from llm-proxy
	 */
	private async fetchCurrentLLMProxyModels(): Promise<void> {
		try {
			console.log('🔍 Fetching current models from llm-proxy...');
			
			const supabaseConfig = await fetchSupabaseConfig({
				supabaseConfigUrl: this.config.supabaseUrl
			});
			
			const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);

			const { data, error } = await supabaseClient.functions.invoke('provider-models', { 
				method: 'GET',
				headers: this.config.authToken ? {
					'Authorization': `Bearer ${this.config.authToken}`
				} : undefined
			});

			if (error) {
				console.warn(`⚠️ Failed to fetch current models: ${error.message}`);
				this.currentLLMProxyModels = [];
				return;
			}

			if (!data?.provider_models) {
				console.warn('⚠️ No provider_models in response');
				this.currentLLMProxyModels = [];
				return;
			}

			this.currentLLMProxyModels = data.provider_models;
			console.log(`✅ Fetched ${this.currentLLMProxyModels.length} current models from llm-proxy`);
		} catch (error) {
			console.warn(`⚠️ Error fetching current models: ${isError(error) ? error.message : error}`);
			this.currentLLMProxyModels = [];
		}
	}

	/**
	 * Prepare models for synchronization
	 */
	private prepareModelsForSync(): ModelUpdatePayload[] {
		const modelsToSync: ModelUpdatePayload[] = [];

		for (const [provider, models] of Object.entries(this.capabilities)) {
			// Skip Ollama models
			if (provider === 'ollama') {
				console.log(`⏭️ Skipping Ollama models (local deployment)`);
				continue;
			}

			for (const [modelId, capabilities] of Object.entries(models)) {
				// Skip hidden models
				if (capabilities.hidden) {
					console.log(`⏭️ Skipping hidden model: ${provider}/${modelId}`);
					continue;
				}

				// Convert to LLM-Proxy format
				const payload = this.convertToLLMProxyFormat(provider, modelId, capabilities);
				
				// Check if model needs updating
				if (this.config.force || this.shouldUpdateModel(payload)) {
					modelsToSync.push(payload);
				} else {
					this.syncResults.push({
						modelId,
						provider,
						action: 'skipped'
					});
				}
			}
		}

		console.log(`📤 Prepared ${modelsToSync.length} models for synchronization`);
		return modelsToSync;
	}

	/**
	 * Convert model capabilities to LLM-Proxy format
	 */
	private convertToLLMProxyFormat(
		provider: string, 
		modelId: string, 
		capabilities: ModelCapabilities
	): ModelUpdatePayload {
		return {
			model_id: modelId,
			provider_name: provider,
			model_name: modelId, // Using modelId as model_name
			model_type: 'text', // Default to text, could be enhanced based on capabilities
			cost_input: capabilities.pricing.inputTokens.basePrice,
			cost_output: capabilities.pricing.outputTokens.basePrice,
			cost_cache_read: capabilities.pricing.inputTokens.cachedPrice,
			cost_cache_create: capabilities.pricing.inputTokens.cachedPrice ? 
				capabilities.pricing.inputTokens.cachedPrice * 1.25 : undefined, // Assume 1.25x for cache creation
			is_available: true,
			settings: {
				displayName: capabilities.displayName,
				contextWindow: capabilities.contextWindow,
				maxOutputTokens: capabilities.maxOutputTokens,
				supportedFeatures: capabilities.supportedFeatures,
				responseSpeed: capabilities.responseSpeed,
				cost: capabilities.cost,
				intelligence: capabilities.intelligence,
				systemPromptBehavior: capabilities.systemPromptBehavior,
				defaults: capabilities.defaults,
				constraints: capabilities.constraints,
				...(capabilities.trainingCutoff && { trainingCutoff: capabilities.trainingCutoff }),
				...(capabilities.releaseDate && { releaseDate: capabilities.releaseDate })
			}
		};
	}

	/**
	 * Check if a model should be updated
	 */
	private shouldUpdateModel(payload: ModelUpdatePayload): boolean {
		const existing = this.currentLLMProxyModels.find(
			m => m.model_id === payload.model_id && m.provider_name === payload.provider_name
		);

		if (!existing) {
			return true; // New model
		}

		// Check for changes in key fields
		return (
			existing.cost_input !== payload.cost_input ||
			existing.cost_output !== payload.cost_output ||
			existing.cost_cache_read !== payload.cost_cache_read ||
			existing.cost_cache_create !== payload.cost_cache_create ||
			existing.is_available !== payload.is_available ||
			JSON.stringify(existing.settings) !== JSON.stringify(payload.settings)
		);
	}

	/**
	 * Sync models to llm-proxy
	 */
	private async syncModels(modelsToSync: ModelUpdatePayload[]): Promise<void> {
		if (modelsToSync.length === 0) {
			console.log('📭 No models need synchronization');
			return;
		}

		if (this.config.dryRun) {
			console.log('🧪 DRY RUN - Would sync the following models:');
			for (const model of modelsToSync) {
				const existing = this.currentLLMProxyModels.find(
					m => m.model_id === model.model_id && m.provider_name === model.provider_name
				);
				const action = existing ? 'UPDATE' : 'CREATE';
				console.log(`  ${action}: ${model.provider_name}/${model.model_id} - ${model.settings.displayName}`);
			}
			return;
		}

		console.log(`🔄 Syncing ${modelsToSync.length} models...`);

		const supabaseConfig = await fetchSupabaseConfig({
			supabaseConfigUrl: this.config.supabaseUrl
		});
		
		const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);

		for (let i = 0; i < modelsToSync.length; i++) {
			const model = modelsToSync[i];
			const progress = `[${i + 1}/${modelsToSync.length}]`;
			
			try {
				console.log(`${progress} Syncing ${model.provider_name}/${model.model_id}...`);

				const { data, error } = await supabaseClient.functions.invoke('sync-model', {
					method: 'POST',
					headers: this.config.authToken ? {
						'Authorization': `Bearer ${this.config.authToken}`
					} : undefined,
					body: model
				});

				if (error) {
					throw new Error(error.message);
				}

				const existing = this.currentLLMProxyModels.find(
					m => m.model_id === model.model_id && m.provider_name === model.provider_name
				);
				
				this.syncResults.push({
					modelId: model.model_id,
					provider: model.provider_name,
					action: existing ? 'updated' : 'created'
				});

				console.log(`  ✅ ${progress} Successfully synced ${model.provider_name}/${model.model_id}`);
			} catch (error) {
				const errorMessage = isError(error) ? error.message : String(error);
				
				this.syncResults.push({
					modelId: model.model_id,
					provider: model.provider_name,
					action: 'failed',
					error: errorMessage
				});

				console.log(`  ❌ ${progress} Failed to sync ${model.provider_name}/${model.model_id}: ${errorMessage}`);
			}

			// Small delay between requests to be respectful
			if (i < modelsToSync.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
		}
	}

	/**
	 * Report synchronization results
	 */
	private reportResults(): void {
		console.log('\n📊 Synchronization Results:');
		
		const created = this.syncResults.filter(r => r.action === 'created');
		const updated = this.syncResults.filter(r => r.action === 'updated');
		const skipped = this.syncResults.filter(r => r.action === 'skipped');
		const failed = this.syncResults.filter(r => r.action === 'failed');

		console.log(`  ✅ Created: ${created.length} models`);
		console.log(`  🔄 Updated: ${updated.length} models`);
		console.log(`  ⏭️ Skipped: ${skipped.length} models (no changes)`);
		console.log(`  ❌ Failed: ${failed.length} models`);

		if (failed.length > 0) {
			console.log('\n❌ Failed Models:');
			for (const result of failed) {
				console.log(`  - ${result.provider}/${result.modelId}: ${result.error}`);
			}
		}

		if (created.length > 0) {
			console.log('\n✅ Created Models:');
			for (const result of created) {
				console.log(`  + ${result.provider}/${result.modelId}`);
			}
		}

		if (updated.length > 0) {
			console.log('\n🔄 Updated Models:');
			for (const result of updated) {
				console.log(`  ~ ${result.provider}/${result.modelId}`);
			}
		}
	}
}

/**
 * Load environment-specific configuration
 */
async function loadEnvironmentConfig(environment: string): Promise<{ authToken?: string; supabaseUrl?: string }> {
	const envFile = `.env.${environment}`;
	
	try {
		if (await exists(envFile)) {
			const content = await Deno.readTextFile(envFile);
			const config: Record<string, string> = {};
			
			for (const line of content.split('\n')) {
				const trimmed = line.trim();
				if (trimmed && !trimmed.startsWith('#')) {
					const [key, ...valueParts] = trimmed.split('=');
					if (key && valueParts.length > 0) {
						config[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
					}
				}
			}
			
			console.log(`📁 Loaded environment config from ${envFile}`);
			return {
				authToken: config.LLM_PROXY_AUTH_TOKEN,
				supabaseUrl: config.SUPABASE_CONFIG_URL
			};
		}
	} catch (error) {
		console.warn(`⚠️ Could not load ${envFile}: ${isError(error) ? error.message : error}`);
	}
	
	return {};
}

/**
 * Main function to run the script
 */
async function main() {
	// Get script directory for relative paths
	const scriptDir = dirname(fromFileUrl(import.meta.url));
	const defaultInputPath = join(scriptDir, '../src/data/modelCapabilities.json');

	// Parse command line arguments
	const args = parseArgs(Deno.args, {
		string: ['input', 'environment', 'supabase-url', 'auth-token'],
		boolean: ['dry-run', 'force'],
		default: {
			input: defaultInputPath,
			environment: 'staging',
			'dry-run': false,
			force: false,
		},
	});

	// Validate environment
	if (!['staging', 'production'].includes(args.environment)) {
		console.error('❌ Environment must be either "staging" or "production"');
		Deno.exit(1);
	}

	// Load environment-specific config
	const envConfig = await loadEnvironmentConfig(args.environment);

	// Setup configuration with priority: CLI args > env file > env vars
	const config: SyncConfig = {
		inputPath: args.input,
		environment: args.environment as 'staging' | 'production',
		supabaseUrl: args['supabase-url'] || envConfig.supabaseUrl,
		authToken: args['auth-token'] || envConfig.authToken || Deno.env.get('LLM_PROXY_AUTH_TOKEN'),
		dryRun: args['dry-run'],
		force: args.force,
	};

	// Validate auth token
	if (!config.authToken && !config.dryRun) {
		console.error('❌ Authentication token required. Provide via --auth-token, .env file, or LLM_PROXY_AUTH_TOKEN env var');
		console.error('💡 Use --dry-run to test without authentication');
		Deno.exit(1);
	}

	// Create and run the syncer
	const syncer = new ModelSyncer(config);
	await syncer.run();
}

// Run the script
if (import.meta.main) {
	main().catch((err) => {
		console.error('💥 Fatal error:', err);
		Deno.exit(1);
	});
}