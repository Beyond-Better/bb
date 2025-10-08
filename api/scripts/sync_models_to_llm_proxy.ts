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
 *   --supabase-config-url=URL           Override Supabase config URL
 *   --auth-token=TOKEN           Authentication token (can also use env var)
 *   --dry-run                    Show what would be synced without making changes
 *   --force                      Update all models regardless of changes
 */

import { parseArgs } from '@std/cli';
import { exists } from '@std/fs';
import { dirname, fromFileUrl, join } from '@std/path';
import { isError } from 'shared/error.ts';
// Remove old import since we define UpdatedModelCapabilities locally
// import type { ModelCapabilities } from 'api/types/modelCapabilities.types.ts';
import type {
	PartialTokenPricing,
	//TokenTypeEnum
} from 'shared/types/models.ts';
import {
	type CacheTypeConfig,
	type ContentTypeConfig,
	generateTokenType,
	type TieredPricingConfig,
} from 'shared/tieredPricing.ts';
import { createClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from 'api/auth/config.ts';

/**
 * LLM-Proxy model interface (matches new database schema)
 */
interface LLMProxyModel {
	//model_id: string;
	provider_name: string;
	model_name: string;
	model_type: string;
	token_pricing: PartialTokenPricing; // Dynamic token pricing structure
	is_available: boolean;
	settings: Record<string, unknown>;
	created_at?: string;
	updated_at?: string;
	// Legacy fields for backward compatibility
	cost_input?: number;
	cost_output?: number;
	cost_anthropic_cache_read?: number;
	cost_anthropic_cache_write_5min?: number;
}

/**
 * Model update payload for the edge function (new dynamic structure)
 */
interface ModelUpdatePayload {
	provider_name: string;
	model_name: string;
	model_type: string;
	token_pricing: PartialTokenPricing; // Dynamic token pricing structure
	is_available: boolean;
	settings: Record<string, unknown>;
}

/**
 * Script configuration
 */
interface SyncConfig {
	inputPath: string;
	environment: 'staging' | 'production';
	supabaseConfigUrl?: string;
	authToken?: string;
	dryRun: boolean;
	force: boolean;
}

/**
 * Sync result for a single model
 */
interface SyncResult {
	modelName: string;
	provider: string;
	action: 'created' | 'updated' | 'skipped' | 'failed';
	error?: string;
}

// Update ModelCapabilities interface to match new structure
interface UpdatedModelCapabilities {
	displayName: string;
	contextWindow: number;
	featureKey: string;
	maxOutputTokens: number;
	token_pricing?: PartialTokenPricing; // New dynamic pricing structure
	pricing_metadata?: {
		currency: string;
		effectiveDate: string;
	};
	// Legacy pricing structure for backward compatibility
	pricing?: {
		inputTokens: {
			basePriceCentsUsd: number;
			cachedPriceCentsUsd?: number;
		};
		outputTokens: {
			basePriceCentsUsd: number;
		};
		currency: string;
		effectiveDate: string;
	};
	// NEW: Tiered pricing configuration fields
	inputTokensTieredConfig?: TieredPricingConfig;
	inputTokensCacheTypes?: Record<string, CacheTypeConfig>;
	inputTokensContentTypes?: Record<string, ContentTypeConfig>;
	outputTokensTieredConfig?: TieredPricingConfig;
	outputTokensCacheTypes?: Record<string, CacheTypeConfig>;
	outputTokensContentTypes?: Record<string, ContentTypeConfig>;
	thoughtTokensConfig?: {
		basePrice: number;
		tieredPricing?: TieredPricingConfig;
		description?: string;
	};
	supportedFeatures: {
		functionCalling: boolean;
		json: boolean;
		streaming: boolean;
		vision: boolean;
		promptCaching?: boolean;
		extendedThinking?: boolean;
	};
	defaults: {
		temperature: number;
		maxTokens: number;
		extendedThinking: boolean;
	};
	constraints: {
		temperature: { min: number; max: number };
	};
	systemPromptBehavior: string;
	responseSpeed: string;
	cost: string;
	intelligence: string;
	trainingCutoff?: string;
	releaseDate?: string;
	hidden?: boolean;
}

type ExtendedModelCapabilities = Record<string, UpdatedModelCapabilities>;
type SyncerModelCapabilities = Record<string, ExtendedModelCapabilities>;
/**
 * Main model synchronization class
 */
class ModelSyncer {
	private config: SyncConfig;
	private capabilities: SyncerModelCapabilities = {};
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

		// Post-sync validation
		if (!this.config.dryRun) {
			await this.validatePricingRecords();
		}

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
			const data = JSON.parse(content) as SyncerModelCapabilities;

			// Extract model capabilities, excluding metadata
			const { _metadata, ...capabilities } = data;
			this.capabilities = capabilities;

			const totalModels = Object.values(capabilities).reduce(
				(sum, models) => sum + Object.keys(models).length,
				0,
			);
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
			const supabaseConfig = await fetchSupabaseConfig({
				supabaseConfigUrl: this.config.supabaseConfigUrl,
			});

			console.log(`🔍 Fetching current models from llm-proxy at ${supabaseConfig.url} ...`);

			const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);

			const { data, error } = await supabaseClient.functions.invoke('provider-models', {
				method: 'GET',
				headers: this.config.authToken
					? {
						'Authorization': `Bearer ${this.config.authToken}`,
					}
					: undefined,
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

			for (const [modelName, capabilities] of Object.entries(models)) {
				// Skip hidden models
				if (capabilities.hidden) {
					console.log(`⏭️ Skipping hidden model: ${provider}/${modelName}`);
					continue;
				}

				// Convert to LLM-Proxy format
				const payload = this.convertToLLMProxyFormat(provider, modelName, capabilities);

				// Check if model needs updating
				if (this.config.force || this.shouldUpdateModel(payload)) {
					modelsToSync.push(payload);
				} else {
					this.syncResults.push({
						modelName: modelName,
						provider,
						action: 'skipped',
					});
				}
			}
		}

		console.log(`📤 Prepared ${modelsToSync.length} models for synchronization`);
		return modelsToSync;
	}

	/**
	 * Convert model capabilities to LLM-Proxy format (new dynamic structure)
	 */
	private convertToLLMProxyFormat(
		provider: string,
		modelName: string,
		capabilities: UpdatedModelCapabilities,
	): ModelUpdatePayload {
		// Convert from new token_pricing structure or fallback to legacy pricing structure
		let token_pricing: PartialTokenPricing = {};

		if (capabilities.token_pricing) {
			// New format: use token_pricing directly
			token_pricing = { ...capabilities.token_pricing };
		} else if (capabilities.pricing) {
			// Legacy format: convert from old pricing structure
			token_pricing.input = capabilities.pricing.inputTokens.basePriceCentsUsd;
			token_pricing.output = capabilities.pricing.outputTokens.basePriceCentsUsd;

			if (capabilities.pricing.inputTokens.cachedPriceCentsUsd !== undefined) {
				if (provider === 'anthropic') {
					token_pricing.anthropic_cache_read = capabilities.pricing.inputTokens.cachedPriceCentsUsd;
					// Estimate cache write cost as 1.25x base cost
					token_pricing.anthropic_cache_write_5min = capabilities.pricing.inputTokens.basePriceCentsUsd *
						1.25;
				} else {
					token_pricing.cache_read = capabilities.pricing.inputTokens.cachedPriceCentsUsd;
				}
			}
		}

		return {
			provider_name: provider,
			model_name: modelName,
			model_type: 'text', // Default to text, could be enhanced based on capabilities
			token_pricing: token_pricing, // Dynamic pricing structure
			is_available: true,
			settings: {
				// Existing settings
				displayName: capabilities.displayName,
				contextWindow: capabilities.contextWindow,
				maxOutputTokens: capabilities.maxOutputTokens,
				supportedFeatures: capabilities.supportedFeatures,
				featureKey: capabilities.featureKey,
				responseSpeed: capabilities.responseSpeed,
				cost: capabilities.cost,
				intelligence: capabilities.intelligence,
				systemPromptBehavior: capabilities.systemPromptBehavior,
				defaults: capabilities.defaults,
				constraints: capabilities.constraints,
				...(capabilities.trainingCutoff && { trainingCutoff: capabilities.trainingCutoff }),
				...(capabilities.releaseDate && { releaseDate: capabilities.releaseDate }),
				...(capabilities.pricing_metadata && { pricing_metadata: capabilities.pricing_metadata }),

				// NEW: Complete tiered pricing configuration stored directly in settings
				...(capabilities.inputTokensTieredConfig && {
					inputTokensTieredConfig: capabilities.inputTokensTieredConfig,
				}),
				...(capabilities.inputTokensCacheTypes && {
					inputTokensCacheTypes: capabilities.inputTokensCacheTypes,
				}),
				...(capabilities.inputTokensContentTypes && {
					inputTokensContentTypes: capabilities.inputTokensContentTypes,
				}),
				...(capabilities.outputTokensTieredConfig && {
					outputTokensTieredConfig: capabilities.outputTokensTieredConfig,
				}),
				...(capabilities.outputTokensCacheTypes && {
					outputTokensCacheTypes: capabilities.outputTokensCacheTypes,
				}),
				...(capabilities.outputTokensContentTypes && {
					outputTokensContentTypes: capabilities.outputTokensContentTypes,
				}),
				...(capabilities.thoughtTokensConfig && {
					thoughtTokensConfig: capabilities.thoughtTokensConfig,
				}),

				// Convenience flag for quick tier support detection
				supportsTieredPricing:
					!!(capabilities.inputTokensTieredConfig?.tiers || capabilities.outputTokensTieredConfig?.tiers),
			},
		};
	}

	/**
	 * Check if a model should be updated
	 */
	private shouldUpdateModel(payload: ModelUpdatePayload): boolean {
		const existing = this.currentLLMProxyModels.find(
			(m) => m.model_name === payload.model_name && m.provider_name === payload.provider_name,
		);

		if (!existing) {
			return true; // New model
		}

		// Check for changes in key fields
		return (
			JSON.stringify(existing.token_pricing) !== JSON.stringify(payload.token_pricing) ||
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
					(m) => m.model_name === model.model_name && m.provider_name === model.provider_name,
				);
				const action = existing ? 'UPDATE' : 'CREATE';
				const tokenTypes = Object.keys(model.token_pricing).join(', ');
				console.log(
					`  ${action}: ${model.provider_name}/${model.model_name} - ${model.settings.displayName} (${tokenTypes})`,
				);
			}
			return;
		}

		console.log(`🔄 Syncing ${modelsToSync.length} models...`);

		const supabaseConfig = await fetchSupabaseConfig({
			supabaseConfigUrl: this.config.supabaseConfigUrl,
		});

		const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey);

		for (let i = 0; i < modelsToSync.length; i++) {
			const model = modelsToSync[i];
			const progress = `[${i + 1}/${modelsToSync.length}]`;

			try {
				console.log(`${progress} Syncing ${model.provider_name}/${model.model_name}...`);

				const { data: _data, error } = await supabaseClient.functions.invoke('sync-model', {
					method: 'POST',
					headers: this.config.authToken
						? {
							'Authorization': `Bearer ${this.config.authToken}`,
						}
						: undefined,
					body: model,
				});

				if (error) {
					throw new Error(error.message);
				}

				const existing = this.currentLLMProxyModels.find(
					(m) => m.model_name === model.model_name && m.provider_name === model.provider_name,
				);

				this.syncResults.push({
					modelName: model.model_name,
					provider: model.provider_name,
					action: existing ? 'updated' : 'created',
				});

				const tokenCount = Object.keys(model.token_pricing).length;
				console.log(
					`  ✅ ${progress} Successfully synced ${model.provider_name}/${model.model_name} (${tokenCount} token types)`,
				);
			} catch (error) {
				const errorMessage = isError(error) ? error.message : String(error);

				this.syncResults.push({
					modelName: model.model_name,
					provider: model.provider_name,
					action: 'failed',
					error: errorMessage,
				});

				console.log(
					`  ❌ ${progress} Failed to sync ${model.provider_name}/${model.model_name}: ${errorMessage}`,
				);
			}

			// Small delay between requests to be respectful
			if (i < modelsToSync.length - 1) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}
	}

	/**
	 * Validate that all synced models have essential pricing records
	 */
	private async validatePricingRecords(): Promise<void> {
		console.log('🔍 Validating pricing records for synced models...');

		try {
			const supabaseConfig = await fetchSupabaseConfig({
				supabaseConfigUrl: this.config.supabaseConfigUrl,
			});

			const supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
				db: { schema: 'abi_llm' },
			});

			// Check for models missing essential pricing
			const { data: modelsWithoutPricing, error } = await supabaseClient.rpc('validate_model_pricing');

			if (error) {
				console.error('❌ Error validating pricing records:', error.message);
				return;
			}

			if (modelsWithoutPricing && modelsWithoutPricing.length > 0) {
				console.warn(`⚠️ Found ${modelsWithoutPricing.length} models with missing essential pricing:`);
				for (const model of modelsWithoutPricing) {
					console.warn(
						`  - ${model.provider_name}/${model.model_name}: missing ${model.missing_types.join(', ')}`,
					);
				}

				// These models should have been marked as unavailable by sync-model function
				console.log('💡 Models with missing pricing have been marked as unavailable');
			} else {
				console.log('✅ All synced models have essential pricing records');
			}

			// Check for fallback usage patterns (if models have tiered config but using base pricing)
			const { data: tieredModelsWithoutRecords, error: tieredError } = await supabaseClient
				.from('provider_models')
				.select(`
					model_id,
					model_name,
					provider_name,
					settings
				`)
				.eq('is_available', true)
				.not('settings->>supportsTieredPricing', 'is', null);

			if (!tieredError && tieredModelsWithoutRecords) {
				const problematicModels = [];

				for (const model of tieredModelsWithoutRecords) {
					if (model.settings?.supportsTieredPricing) {
						// Check if model has any tiered pricing records
						const { data: tieredRecords } = await supabaseClient
							.from('provider_model_pricing')
							.select('token_type')
							.eq('model_id', model.model_id)
							.like('token_type', '%_tier%')
							.is('effective_until', null);

						if (!tieredRecords || tieredRecords.length === 0) {
							problematicModels.push(`${model.provider_name}/${model.model_name}`);
						}
					}
				}

				if (problematicModels.length > 0) {
					console.warn(`⚠️ Models claiming tiered pricing but missing tiered records:`);
					for (const model of problematicModels) {
						console.warn(`  - ${model}`);
					}
					console.log('💡 These models will fallback to base pricing during usage');
				}
			}
		} catch (error) {
			console.error('❌ Error during pricing validation:', isError(error) ? error.message : error);
		}
	}

	/**
	 * Report synchronization results
	 */
	private reportResults(): void {
		console.log('\n📊 Synchronization Results:');

		const created = this.syncResults.filter((r) => r.action === 'created');
		const updated = this.syncResults.filter((r) => r.action === 'updated');
		const skipped = this.syncResults.filter((r) => r.action === 'skipped');
		const failed = this.syncResults.filter((r) => r.action === 'failed');

		console.log(`  ✅ Created: ${created.length} models`);
		console.log(`  🔄 Updated: ${updated.length} models`);
		console.log(`  ⏭️ Skipped: ${skipped.length} models (no changes)`);
		console.log(`  ❌ Failed: ${failed.length} models`);

		if (failed.length > 0) {
			console.log('\n❌ Failed Models:');
			for (const result of failed) {
				console.log(`  - ${result.provider}/${result.modelName}: ${result.error}`);
			}
		}

		if (created.length > 0) {
			console.log('\n✅ Created Models:');
			for (const result of created) {
				console.log(`  + ${result.provider}/${result.modelName}`);
			}
		}

		if (updated.length > 0) {
			console.log('\n🔄 Updated Models:');
			for (const result of updated) {
				console.log(`  ~ ${result.provider}/${result.modelName}`);
			}
		}
	}
}

/**
 * Load environment-specific configuration
 */
async function loadEnvironmentConfig(environment: string): Promise<{ authToken?: string; supabaseConfigUrl?: string }> {
	const scriptDir = dirname(fromFileUrl(import.meta.url));
	const envFile = join(scriptDir, `.env.${environment}`);

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
				supabaseConfigUrl: config.SUPABASE_CONFIG_URL,
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
		string: ['input', 'environment', 'supabase-config-url', 'auth-token'],
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
		supabaseConfigUrl: args['supabase-config-url'] || envConfig.supabaseConfigUrl,
		authToken: args['auth-token'] || envConfig.authToken || Deno.env.get('LLM_PROXY_AUTH_TOKEN'),
		dryRun: args['dry-run'],
		force: args.force,
	};

	// Validate auth token
	if (!config.authToken && !config.dryRun) {
		console.error(
			'❌ Authentication token required. Provide via --auth-token, .env file, or LLM_PROXY_AUTH_TOKEN env var',
		);
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
