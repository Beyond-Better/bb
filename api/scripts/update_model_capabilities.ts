#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * Enhanced Model Capabilities Fetcher
 *
 * Script to fetch and update model capabilities from various providers using
 * source JSON files with comprehensive research data. This script generates
 * the modelCapabilities.json file used by BB for customer billing and model selection.
 *
 * Usage:
 *   deno run --allow-net --allow-read --allow-write --allow-env api/scripts/update_model_capabilities.ts
 *
 * Options:
 *   --output=PATH                Output file path (default: api/src/data/modelCapabilities.json)
 *   --providers=PROVIDERS        Comma-separated list of providers to process (default: all)
 *   --source-dir=DIR             Source JSON files directory (default: api/src/data/model_sources)
 *   --validate-only              Only validate existing capabilities file
 *   --use-api-validation         Validate against live API endpoints (requires API keys)
 *   --skip-llm-proxy-check       Skip checking against llm-proxy availability
 */

import { parseArgs } from '@std/cli';
import { ensureDir, exists } from '@std/fs';
import { dirname, fromFileUrl, join } from '@std/path';
import { isError } from 'shared/error.ts';
import type { ModelCapabilities } from 'api/types/modelCapabilities.types.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { createClient } from '@supabase/supabase-js';
import { fetchSupabaseConfig } from 'api/auth/config.ts';

/**
 * Source model data structure from research JSON files
 */
interface SourceModelData {
	lastUpdated: string;
	source: string;
	pricingUnit: string;
	notes: string;
	models: SourceModel[];
	deprecatedModels?: DeprecatedModel[];
	technicalDetails?: Record<string, unknown>;
	[key: string]: unknown;
}

interface SourceModel {
	modelId: string;
	displayName: string;
	family?: string;
	contextWindow: number;
	maxOutputTokens: number;
	pricing: {
		inputTokens: { 
			basePrice: number;
			cachedPrice?: number;
			tieredPricing?: Record<string, number>;
			multimodal?: Record<string, number>;
		};
		outputTokens: { 
			basePrice: number;
			tieredPricing?: Record<string, number>;
		};
		currency: string;
		effectiveDate: string;
		note?: string;
	};
	supportedFeatures: {
		functionCalling: boolean;
		json: boolean;
		streaming: boolean;
		vision: boolean;
		promptCaching?: boolean;
		extendedThinking?: boolean;
		multimodal?: boolean;
		parallelToolCalling?: boolean;
	};
	defaults: {
		temperature: number;
		maxTokens: number;
		extendedThinking: boolean;
	};
	constraints: {
		temperature: { min: number; max: number };
	};
	systemPromptBehavior: 'required' | 'optional';
	trainingCutoff?: string;
	releaseDate?: string;
	responseSpeed: 'very-fast' | 'fast' | 'medium' | 'slow';
	cost: 'low' | 'medium' | 'high' | 'very-high' | 'free';
	intelligence: 'low' | 'medium' | 'high' | 'very-high';
	modality: 'text' | 'text-and-vision' | 'multimodal';
	description?: string;
	deprecated?: boolean;
	replacement?: string;
	status?: 'production' | 'preview' | 'experimental';
	[key: string]: unknown;
}

interface DeprecatedModel {
	modelId: string;
	deprecationDate: string;
	shutdownDate: string;
	replacement: string;
}

/**
 * BB-Sass model interface (from edge function response)
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
	created_at: string;
	updated_at: string;
}

/**
 * Script configuration
 */
interface FetcherConfig {
	outputPath: string;
	sourceDir: string;
	providersToProcess: string[];
	validateOnly: boolean;
	useApiValidation: boolean;
	skipLLMProxyCheck: boolean;
}

/**
 * Main capabilities fetcher class
 */
class ModelCapabilitiesFetcher {
	private config: FetcherConfig;
	private allCapabilities: Record<string, Record<string, ModelCapabilities & { hidden?: boolean }>> = {};
	private llmProxyModels: LLMProxyModel[] = [];
	private sourceData: Record<string, SourceModelData> = {};

	constructor(config: FetcherConfig) {
		this.config = config;
	}

	/**
	 * Run the fetcher for all specified providers
	 */
	public async run(): Promise<void> {
		console.log('🚀 Starting enhanced model capabilities fetcher...');

		// If validate-only mode, just validate and exit
		if (this.config.validateOnly) {
			await this.validateExistingCapabilities();
			return;
		}

		// Load source data from JSON files
		await this.loadSourceData();

		// Fetch llm-proxy models if not skipping
		if (!this.config.skipLLMProxyCheck) {
			await this.fetchLLMProxyModels();
		}

		// Try to load existing capabilities first for comparison
		await this.loadExistingCapabilities();

		// Process each provider's source data
		for (const provider of this.config.providersToProcess) {
			try {
				console.log(`📊 Processing ${provider} models...`);
				await this.processProviderModels(provider);
			} catch (error) {
				console.error(`❌ Error processing ${provider}: ${isError(error) ? error.message : error}`);
				throw error;
			}
		}

		// Check for models not in llm-proxy and report them
		if (!this.config.skipLLMProxyCheck) {
			await this.reportModelsNotInLLMProxy();
		}

		// Validate the final capabilities
		await this.validateCapabilities();

		// Save the updated capabilities
		await this.saveCapabilities();

		console.log('✅ Finished updating model capabilities.');
	}

	/**
	 * Load source data from JSON files
	 */
	private async loadSourceData(): Promise<void> {
		console.log('📁 Loading source data files...');

		for (const provider of this.config.providersToProcess) {
			const sourceFile = join(this.config.sourceDir, `${provider}_models.json`);
			
			try {
				if (await exists(sourceFile)) {
					const content = await Deno.readTextFile(sourceFile);
					this.sourceData[provider] = JSON.parse(content);
					
					// Handle different model array names for different providers
					let modelCount = 0;
					if (provider === 'ollama') {
						// Ollama uses toolCapableModels instead of models
						modelCount = this.sourceData[provider].toolCapableModels?.length || 0;
					} else {
						modelCount = this.sourceData[provider].models?.length || 0;
					}
					
					console.log(`  ✅ Loaded ${provider} source data (${modelCount} models)`);
				} else {
					console.warn(`  ⚠️ Source file not found: ${sourceFile}`);
				}
			} catch (error) {
				console.error(`  ❌ Error loading ${sourceFile}: ${isError(error) ? error.message : error}`);
				throw error;
			}
		}
	}

	/**
	 * Load existing capabilities file if it exists
	 */
	private async loadExistingCapabilities(): Promise<void> {
		try {
			if (await exists(this.config.outputPath)) {
				const content = await Deno.readTextFile(this.config.outputPath);
				this.allCapabilities = JSON.parse(content);
				console.log(`📄 Loaded existing capabilities from ${this.config.outputPath}`);
			}
		} catch (error) {
			console.warn(`⚠️ Could not load existing capabilities: ${isError(error) ? error.message : error}`);
			this.allCapabilities = {};
		}
	}

	/**
	 * Process models for a specific provider
	 */
	private async processProviderModels(provider: string): Promise<void> {
		const sourceData = this.sourceData[provider];
		if (!sourceData) {
			console.warn(`⚠️ No source data for provider: ${provider}`);
			return;
		}

		let processedCount = 0;
		let skippedCount = 0;

		// Handle different model array names for different providers
		const models = provider === 'ollama' ? sourceData.toolCapableModels : sourceData.models;
		if (!models || !Array.isArray(models)) {
			console.warn(`⚠️ No models found for provider: ${provider}`);
			return;
		}

		for (const sourceModel of models) {
			try {
				// Convert source model to BB model capabilities format
				const capabilities = this.convertSourceModelToCapabilities(sourceModel, provider, sourceData);
				
				// Check if model should be hidden (not in llm-proxy)
				const isAvailable = this.config.skipLLMProxyCheck || this.isModelAvailableInLLMProxy(provider, sourceModel.modelId);
				capabilities.hidden = !isAvailable;

				// Register the model
				this.registerModel(provider, sourceModel.modelId, capabilities);
				processedCount++;

				if (!isAvailable) {
					console.log(`  ⚠️ ${provider}/${sourceModel.modelId} - Not in llm-proxy (will be hidden)`);
				}
			} catch (error) {
				console.error(`  ❌ Error processing ${provider}/${sourceModel.modelId}: ${isError(error) ? error.message : error}`);
				skippedCount++;
			}
		}

		console.log(`  ✅ Processed ${processedCount} models, skipped ${skippedCount} for ${provider}`);
	}

	/**
	 * Convert source model data to BB ModelCapabilities format
	 */
	private convertSourceModelToCapabilities(
		sourceModel: SourceModel, 
		provider: string, 
		sourceData: SourceModelData
	): ModelCapabilities & { hidden?: boolean } {
		// Handle pricing - Ollama models are local/free
		let inputPrice = 0;
		let outputPrice = 0;
		let currency = 'USD';
		let effectiveDate = new Date().toISOString().split('T')[0];
		
		if (sourceModel.pricing && sourceModel.pricing.inputTokens && sourceModel.pricing.outputTokens) {
			// Convert pricing to per-token (BB internal format)
			inputPrice = this.convertPricingToPerToken(sourceModel.pricing.inputTokens.basePrice, sourceData.pricingUnit);
			outputPrice = this.convertPricingToPerToken(sourceModel.pricing.outputTokens.basePrice, sourceData.pricingUnit);
			currency = sourceModel.pricing.currency;
			effectiveDate = sourceModel.pricing.effectiveDate;
		}
		
		const capabilities: ModelCapabilities & { hidden?: boolean } = {
			displayName: sourceModel.displayName,
			contextWindow: sourceModel.contextWindow,
			maxOutputTokens: sourceModel.maxOutputTokens,
			pricing: {
				inputTokens: { 
					basePrice: inputPrice
				},
				outputTokens: { 
					basePrice: outputPrice 
				},
				currency: currency,
				effectiveDate: effectiveDate
			},
			supportedFeatures: {
				functionCalling: sourceModel.supportedFeatures.functionCalling,
				json: sourceModel.supportedFeatures.json,
				streaming: sourceModel.supportedFeatures.streaming,
				vision: sourceModel.supportedFeatures.vision,
				promptCaching: sourceModel.supportedFeatures.promptCaching || false,
				extendedThinking: sourceModel.supportedFeatures.extendedThinking || false
			},
			defaults: {
				temperature: sourceModel.defaults.temperature,
				maxTokens: sourceModel.defaults.maxTokens,
				extendedThinking: sourceModel.defaults.extendedThinking
			},
			constraints: {
				temperature: sourceModel.constraints.temperature
			},
			systemPromptBehavior: sourceModel.systemPromptBehavior,
			responseSpeed: sourceModel.responseSpeed,
			cost: sourceModel.cost === 'free' ? 'low' : sourceModel.cost,
			intelligence: sourceModel.intelligence,
			hidden: false
		};

		// Add cached pricing if available
		if (sourceModel.pricing && sourceModel.pricing.inputTokens && sourceModel.pricing.inputTokens.cachedPrice !== undefined) {
			capabilities.pricing.inputTokens.cachedPrice = this.convertPricingToPerToken(
				sourceModel.pricing.inputTokens.cachedPrice, 
				sourceData.pricingUnit
			);
		}

		// Add optional fields if present
		if (sourceModel.trainingCutoff) {
			capabilities.trainingCutoff = sourceModel.trainingCutoff;
		}
		if (sourceModel.releaseDate) {
			capabilities.releaseDate = sourceModel.releaseDate;
		}

		return capabilities;
	}

	/**
	 * Convert pricing from source unit to per-token
	 */
	private convertPricingToPerToken(price: number, sourceUnit: string): number {
		switch (sourceUnit) {
			case 'per_1M_tokens':
				return price / 1_000_000;
			case 'per_1K_tokens':
				return price / 1_000;
			case 'per_token':
				return price;
			case 'local_deployment':
				return 0; // Local models have no per-token cost
			default:
				console.warn(`⚠️ Unknown pricing unit: ${sourceUnit}, assuming per_1M_tokens`);
				return price / 1_000_000;
		}
	}

	/**
	 * Validate existing capabilities file
	 */
	private async validateExistingCapabilities(): Promise<void> {
		console.log('🔍 Validating existing capabilities file...');

		if (!await exists(this.config.outputPath)) {
			throw new Error(`Capabilities file not found: ${this.config.outputPath}`);
		}

		try {
			const content = await Deno.readTextFile(this.config.outputPath);
			const capabilities = JSON.parse(content);
			this.allCapabilities = capabilities;

			await this.validateCapabilities();
			console.log('✅ Capabilities file is valid');
		} catch (error) {
			console.error('❌ Capabilities file validation failed:', isError(error) ? error.message : error);
			throw error;
		}
	}

	/**
	 * Validate the capabilities structure and content
	 */
	private async validateCapabilities(): Promise<void> {
		if (!this.allCapabilities || typeof this.allCapabilities !== 'object') {
			throw new Error('Invalid capabilities data: must be an object');
		}

		let totalModels = 0;
		const issues: string[] = [];

		// Validate provider entries
		for (const [provider, models] of Object.entries(this.allCapabilities)) {
			// Skip metadata entries
			if (provider === '_metadata') {
				continue;
			}
			
			if (!models || typeof models !== 'object') {
				issues.push(`Invalid capabilities for provider ${provider}: must be an object`);
				continue;
			}

			// Validate model entries
			for (const [model, capabilities] of Object.entries(models)) {
				totalModels++;

				if (!capabilities || typeof capabilities !== 'object') {
					issues.push(`Invalid capabilities for model ${provider}/${model}: must be an object`);
					continue;
				}

				// Check required properties
				const requiredProps = [
					'displayName',
					'contextWindow',
					'maxOutputTokens',
					'pricing',
					'supportedFeatures',
					'defaults',
					'constraints',
				];

				for (const prop of requiredProps) {
					if (!(prop in capabilities)) {
						issues.push(`Model ${provider}/${model}: missing required property ${prop}`);
					}
				}

				// Validate pricing structure
				if (capabilities.pricing) {
					if (
						capabilities.pricing.inputTokens?.basePrice === undefined ||
						capabilities.pricing.inputTokens?.basePrice < 0
					) {
						issues.push(`Model ${provider}/${model}: invalid pricing.inputTokens.basePrice`);
					}
					if (
						capabilities.pricing.outputTokens?.basePrice === undefined ||
						capabilities.pricing.outputTokens?.basePrice < 0
					) {
						issues.push(`Model ${provider}/${model}: invalid pricing.outputTokens.basePrice`);
					}
				}

				// Validate feature flags
				if (capabilities.supportedFeatures) {
					const requiredFeatures = ['functionCalling', 'json', 'streaming', 'vision'];
					for (const feature of requiredFeatures) {
						if (typeof capabilities.supportedFeatures[feature] !== 'boolean') {
							issues.push(`Model ${provider}/${model}: supportedFeatures.${feature} must be boolean`);
						}
					}
				}

				// Validate constraints
				if (capabilities.constraints?.temperature) {
					const { min, max } = capabilities.constraints.temperature;
					if (typeof min !== 'number' || typeof max !== 'number' || min >= max) {
						issues.push(`Model ${provider}/${model}: invalid temperature constraints`);
					}
				}

				// Validate pricing is in reasonable range (per-token pricing should be very small)
				if (capabilities.pricing?.inputTokens?.basePrice > 0.01) {
					issues.push(`Model ${provider}/${model}: inputTokens.basePrice seems too high (${capabilities.pricing.inputTokens.basePrice}) - check pricing unit conversion`);
				}
				if (capabilities.pricing?.outputTokens?.basePrice > 0.1) {
					issues.push(`Model ${provider}/${model}: outputTokens.basePrice seems too high (${capabilities.pricing.outputTokens.basePrice}) - check pricing unit conversion`);
				}
			}
		}

		if (issues.length > 0) {
			console.error('❌ Validation issues found:');
			issues.forEach((issue) => console.error(`  - ${issue}`));
			throw new Error(`Validation failed with ${issues.length} issues`);
		}

		console.log(
			`✅ Validation passed for ${totalModels} models across ${
				Object.keys(this.allCapabilities).length
			} providers`,
		);
	}

	/**
	 * Save the capabilities to the output file
	 */
	private async saveCapabilities(): Promise<void> {
		try {
			// Ensure the directory exists
			await ensureDir(dirname(this.config.outputPath));

			// Sort providers and models for consistent output
			const sortedCapabilities: Record<string, Record<string, ModelCapabilities>> = {};
			const sortedProviders = Object.keys(this.allCapabilities).sort();
			
			for (const provider of sortedProviders) {
				sortedCapabilities[provider] = {};
				const sortedModels = Object.keys(this.allCapabilities[provider]).sort();
				for (const model of sortedModels) {
					// Remove the hidden flag before saving (it's for internal use only)
					const { hidden, ...capabilities } = this.allCapabilities[provider][model];
					sortedCapabilities[provider][model] = capabilities;
				}
			}

			// Add generation metadata
			const output = {
				_metadata: {
					generatedAt: new Date().toISOString(),
					generatedBy: 'update_model_capabilities.ts',
					totalProviders: Object.keys(sortedCapabilities).length,
					totalModels: Object.values(sortedCapabilities).reduce((sum, models) => sum + Object.keys(models).length, 0)
				},
				...sortedCapabilities
			};

			await Deno.writeTextFile(
				this.config.outputPath,
				JSON.stringify(output, null, '\t'),
			);

			console.log(`💾 Saved capabilities to ${this.config.outputPath}`);
		} catch (error) {
			console.error(`❌ Error saving capabilities: ${isError(error) ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Fetch available models from llm-proxy
	 */
	private async fetchLLMProxyModels(): Promise<void> {
		try {
			console.log('🔍 Fetching available models from llm-proxy...');
			const config = await fetchSupabaseConfig();
			const supabaseClient = createClient(config.url, config.anonKey);

			const { data, error } = await supabaseClient.functions.invoke('provider-models', { method: 'GET' });

			if (error) {
				console.warn(`⚠️ Failed to fetch llm-proxy models: ${error.message}`);
				this.llmProxyModels = [];
				return;
			}

			if (!data?.provider_models) {
				console.warn('⚠️ No provider_models in llm-proxy response');
				this.llmProxyModels = [];
				return;
			}

			this.llmProxyModels = data.provider_models.filter((model: any) => model.is_available);
			console.log(`✅ Fetched ${this.llmProxyModels.length} available models from llm-proxy`);
		} catch (error) {
			console.warn(`⚠️ Error fetching llm-proxy models: ${isError(error) ? error.message : error}`);
			this.llmProxyModels = [];
		}
	}

	/**
	 * Check if a model is available in llm-proxy
	 */
	private isModelAvailableInLLMProxy(provider: string, modelId: string): boolean {
		return this.llmProxyModels.some(
			(bbModel) => bbModel.model_name === modelId && bbModel.provider_name === provider,
		);
	}

	/**
	 * Report models that are not available in llm-proxy
	 */
	private async reportModelsNotInLLMProxy(): Promise<void> {
		console.log('\n📋 Models not available in llm-proxy (will be hidden):');

		const hiddenModels: Array<{ provider: string; model: string }> = [];

		for (const [provider, models] of Object.entries(this.allCapabilities)) {
			// Skip metadata entries
			if (provider === '_metadata') {
				continue;
			}
			
			for (const [modelId, capabilities] of Object.entries(models)) {
				// Ensure capabilities is an object with displayName
				if (typeof capabilities !== 'object' || !capabilities.displayName) {
					continue;
				}
				
				if (!this.isModelAvailableInLLMProxy(provider, modelId)) {
					hiddenModels.push({ provider, model: modelId });
					capabilities.hidden = true;
					console.log(`  ❌ ${provider}/${modelId} - ${capabilities.displayName}`);
				} else {
					// Ensure the model is not hidden if it exists in llm-proxy
					capabilities.hidden = false;
				}
			}
		}

		if (hiddenModels.length === 0) {
			console.log('  ✅ All models are available in llm-proxy!');
		} else {
			console.log(`\n💡 Found ${hiddenModels.length} models that need to be added to llm-proxy.`);
			console.log('   Consider adding these models to the llm-proxy provider-models if needed.');
		}
	}

	/**
	 * Register a model with its capabilities
	 */
	private registerModel(provider: string, modelId: string, capabilities: ModelCapabilities & { hidden?: boolean }): void {
		// Initialize provider object if it doesn't exist
		if (!this.allCapabilities[provider]) {
			this.allCapabilities[provider] = {};
		}

		// Add the model capabilities
		this.allCapabilities[provider][modelId] = capabilities;
	}
}

/**
 * Main function to run the script
 */
async function main() {
	// Get script directory for relative paths
	const scriptDir = dirname(fromFileUrl(import.meta.url));
	const defaultOutputPath = join(scriptDir, '../src/data/modelCapabilities.json');
	const defaultSourceDir = join(scriptDir, '../src/data/model_sources');

	// Parse command line arguments
	const args = parseArgs(Deno.args, {
		string: ['output', 'providers', 'source-dir'],
		boolean: ['validate-only', 'use-api-validation', 'skip-llm-proxy-check'],
		default: {
			output: defaultOutputPath,
			providers: 'anthropic,openai,google,deepseek,groq,ollama',
			'source-dir': defaultSourceDir,
			'validate-only': false,
			'use-api-validation': false,
			'skip-llm-proxy-check': false,
		},
	});

	// Setup configuration
	const config: FetcherConfig = {
		outputPath: args.output,
		sourceDir: args['source-dir'],
		providersToProcess: args.providers.split(',').map((p) => p.trim()),
		validateOnly: args['validate-only'],
		useApiValidation: args['use-api-validation'],
		skipLLMProxyCheck: args['skip-llm-proxy-check'],
	};

	console.log('⚙️ Configuration:');
	console.log(`  📁 Source directory: ${config.sourceDir}`);
	console.log(`  📄 Output file: ${config.outputPath}`);
	console.log(`  🏪 Providers: ${config.providersToProcess.join(', ')}`);
	console.log(`  🔍 Validate only: ${config.validateOnly}`);
	console.log(`  🌐 Skip llm-proxy check: ${config.skipLLMProxyCheck}`);

	// Create and run the fetcher
	const fetcher = new ModelCapabilitiesFetcher(config);
	await fetcher.run();
}

// Run the script
if (import.meta.main) {
	main().catch((err) => {
		console.error('💥 Fatal error:', err);
		Deno.exit(1);
	});
}