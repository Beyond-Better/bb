#!/usr/bin/env -S deno run --allow-net --allow-read --allow-write --allow-env

/**
 * Enhanced Model Capabilities Fetcher
 *
 * Script to fetch and update model capabilities from various providers.
 * This script is part of the development process and updates the static model data
 * that BB uses when connecting to the llm-proxy cloud service.
 *
 * Usage:
 *   deno run --allow-net --allow-read --allow-write --allow-env api/scripts/update_model_capabilities.ts
 *
 * Options:
 *   --output=PATH                Output file path (default: api/src/data/modelCapabilities.json)
 *   --providers=PROVIDERS        Comma-separated list of providers to fetch (default: all)
 *   --anthropic-key=KEY          Anthropic API key (can also use ANTHROPIC_API_KEY env var)
 *   --openai-key=KEY             OpenAI API key (can also use OPENAI_API_KEY env var)
 *   --google-key=KEY             Google API key (can also use GOOGLE_API_KEY env var)
 *   --deepseek-key=KEY           DeepSeek API key (can also use DEEPSEEK_API_KEY env var)
 *   --groq-key=KEY               Groq API key (can also use GROQ_API_KEY env var)
 *   --use-cached                 Continue on API failures using existing/cached data
 *   --validate-only              Only validate existing capabilities file
 */

import { parseArgs } from '@std/cli';
import { ensureDir, exists } from '@std/fs';
import { dirname } from '@std/path';
import { isError } from 'shared/error.ts';
import type { ModelCapabilities } from 'api/types/modelCapabilities.types.ts';

/**
 * Enhanced model capabilities interface that includes all metadata
 */
export interface EnhancedModelCapabilities extends ModelCapabilities {
	// Additional metadata for the registry
	modelId: string;
	provider: string;
	family?: string;
	source: 'api' | 'documentation' | 'manual';
	lastUpdated: string;
	releaseDate?: string;
	deprecated?: boolean;
	modality: 'text' | 'text-and-vision' | 'multimodal';
	description?: string;
}

/**
 * Script configuration
 */
interface FetcherConfig {
	outputPath: string;
	providersToFetch: string[];
	apiKeys: Record<string, string>;
	useCached: boolean;
	validateOnly: boolean;
}

/**
 * Main capabilities fetcher class
 */
class ModelCapabilitiesFetcher {
	private config: FetcherConfig;
	private allCapabilities: Record<string, Record<string, ModelCapabilities>> = {};

	constructor(config: FetcherConfig) {
		this.config = config;
	}

	/**
	 * Run the fetcher for all specified providers
	 */
	public async run(): Promise<void> {
		console.log('Starting enhanced model capabilities fetcher...');

		// If validate-only mode, just validate and exit
		if (this.config.validateOnly) {
			await this.validateExistingCapabilities();
			return;
		}

		// Try to load existing capabilities first
		await this.loadExistingCapabilities();

		// Fetch capabilities for each provider
		for (const provider of this.config.providersToFetch) {
			try {
				console.log(`Fetching capabilities for ${provider}...`);
				await this.fetchProviderCapabilities(provider);
			} catch (error) {
				const errorMsg = `Error fetching capabilities for ${provider}: ${isError(error) ? error.message : error}`;
				
				if (this.config.useCached) {
					console.warn(`${errorMsg} (continuing with cached data)`);
				} else {
					console.error(errorMsg);
					throw error;
				}
			}
		}

		// Validate the final capabilities
		await this.validateCapabilities();

		// Save the updated capabilities
		await this.saveCapabilities();

		console.log('Finished fetching model capabilities.');
	}

	/**
	 * Load existing capabilities file if it exists
	 */
	private async loadExistingCapabilities(): Promise<void> {
		try {
			if (await exists(this.config.outputPath)) {
				const content = await Deno.readTextFile(this.config.outputPath);
				this.allCapabilities = JSON.parse(content);
				console.log(`Loaded existing capabilities from ${this.config.outputPath}`);
			}
		} catch (error) {
			console.warn(`Could not load existing capabilities: ${isError(error) ? error.message : error}`);
			this.allCapabilities = {};
		}
	}

	/**
	 * Validate existing capabilities file
	 */
	private async validateExistingCapabilities(): Promise<void> {
		console.log('Validating existing capabilities file...');
		
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
					if (!capabilities.pricing.inputTokens?.basePrice && capabilities.pricing.inputTokens?.basePrice !== 0) {
						issues.push(`Model ${provider}/${model}: missing pricing.inputTokens.basePrice`);
					}
					if (!capabilities.pricing.outputTokens?.basePrice && capabilities.pricing.outputTokens?.basePrice !== 0) {
						issues.push(`Model ${provider}/${model}: missing pricing.outputTokens.basePrice`);
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
			}
		}

		if (issues.length > 0) {
			console.error('Validation issues found:');
			issues.forEach(issue => console.error(`  - ${issue}`));
			throw new Error(`Validation failed with ${issues.length} issues`);
		}

		console.log(`✅ Validation passed for ${totalModels} models across ${Object.keys(this.allCapabilities).length} providers`);
	}

	/**
	 * Save the capabilities to the output file
	 */
	private async saveCapabilities(): Promise<void> {
		try {
			// Ensure the directory exists
			await ensureDir(dirname(this.config.outputPath));

			// Save as JSON with consistent formatting
			const sortedCapabilities: Record<string, Record<string, ModelCapabilities>> = {};
			
			// Sort providers and models for consistent output
			const sortedProviders = Object.keys(this.allCapabilities).sort();
			for (const provider of sortedProviders) {
				sortedCapabilities[provider] = {};
				const sortedModels = Object.keys(this.allCapabilities[provider]).sort();
				for (const model of sortedModels) {
					sortedCapabilities[provider][model] = this.allCapabilities[provider][model];
				}
			}

			await Deno.writeTextFile(
				this.config.outputPath,
				JSON.stringify(sortedCapabilities, null, '\t'),
			);

			console.log(`Saved capabilities to ${this.config.outputPath}`);
		} catch (error) {
			console.error(`Error saving capabilities: ${isError(error) ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Fetch capabilities for a specific provider
	 */
	private async fetchProviderCapabilities(provider: string): Promise<void> {
		switch (provider.toLowerCase()) {
			case 'anthropic':
				await this.fetchAnthropicCapabilities();
				break;
			case 'openai':
				await this.fetchOpenAICapabilities();
				break;
			case 'google':
				await this.fetchGoogleCapabilities();
				break;
			case 'deepseek':
				await this.fetchDeepSeekCapabilities();
				break;
			case 'groq':
				await this.fetchGroqCapabilities();
				break;
			default:
				console.warn(`Unsupported provider: ${provider}`);
		}
	}

	/**
	 * Fetch Anthropic model capabilities
	 */
	private async fetchAnthropicCapabilities(): Promise<void> {
		const apiKey = this.config.apiKeys.anthropic;
		if (!apiKey) {
			throw new Error('Anthropic API key not provided');
		}

		try {
			// Anthropic doesn't have a models endpoint, so use documented model info
			// with validation via sample API call

			// Register known Anthropic models with latest information
			const anthropicModels = [
				{
					modelId: 'claude-sonnet-4-20250514',
					displayName: 'Claude Sonnet 4.0',
					family: 'Claude-4',
					contextWindow: 200000,
					maxOutputTokens: 128000,
					pricing: {
						inputTokens: { basePrice: 0.000003, cachedPrice: 0.00000375 },
						outputTokens: { basePrice: 0.000015 },
						currency: 'USD',
						effectiveDate: '2025-05-23',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						promptCaching: true,
						extendedThinking: true,
					},
					defaults: {
						temperature: 0.7,
						maxTokens: 16384,
						extendedThinking: false,
					},
					constraints: {
						temperature: { min: 0.0, max: 1.0 },
					},
					systemPromptBehavior: 'optional' as const,
					trainingCutoff: '2025-03-01',
					releaseDate: '2025-05-23',
					responseSpeed: 'medium' as const,
					modality: 'text-and-vision' as const,
					description: "Anthropic's newest flagship model with advanced reasoning",
				},
				{
					modelId: 'claude-opus-4-20250514',
					displayName: 'Claude Opus 4.0',
					family: 'Claude-4',
					contextWindow: 200000,
					maxOutputTokens: 128000,
					pricing: {
						inputTokens: { basePrice: 0.000015, cachedPrice: 0.00001875 },
						outputTokens: { basePrice: 0.000075 },
						currency: 'USD',
						effectiveDate: '2025-05-23',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						promptCaching: true,
						extendedThinking: true,
					},
					defaults: {
						temperature: 0.7,
						maxTokens: 16384,
						extendedThinking: false,
					},
					constraints: {
						temperature: { min: 0.0, max: 1.0 },
					},
					systemPromptBehavior: 'optional' as const,
					trainingCutoff: '2025-03-01',
					releaseDate: '2025-05-23',
					responseSpeed: 'slow' as const,
					modality: 'text-and-vision' as const,
					description: "Anthropic's most capable model for complex reasoning tasks",
				},
				{
					modelId: 'claude-3-7-sonnet-20250219',
					displayName: 'Claude Sonnet 3.7',
					family: 'Claude-3',
					contextWindow: 200000,
					maxOutputTokens: 128000,
					pricing: {
						inputTokens: { basePrice: 0.000003, cachedPrice: 0.00000375 },
						outputTokens: { basePrice: 0.000015 },
						currency: 'USD',
						effectiveDate: '2025-02-19',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						promptCaching: true,
						extendedThinking: true,
					},
					defaults: {
						temperature: 0.7,
						maxTokens: 16384,
						extendedThinking: false,
					},
					constraints: {
						temperature: { min: 0.0, max: 1.0 },
					},
					systemPromptBehavior: 'optional' as const,
					trainingCutoff: '2024-10-01',
					releaseDate: '2025-02-19',
					responseSpeed: 'medium' as const,
					modality: 'text-and-vision' as const,
					description: "Enhanced model with extended thinking capabilities",
				},
				{
					modelId: 'claude-3-5-sonnet-20241022',
					displayName: 'Claude Sonnet 3.5',
					family: 'Claude-3',
					contextWindow: 200000,
					maxOutputTokens: 128000,
					pricing: {
						inputTokens: { basePrice: 0.000003, cachedPrice: 0.00000015 },
						outputTokens: { basePrice: 0.000015 },
						currency: 'USD',
						effectiveDate: '2024-10-22',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						promptCaching: true,
						extendedThinking: false,
					},
					defaults: {
						temperature: 0.7,
						maxTokens: 8192,
						extendedThinking: false,
					},
					constraints: {
						temperature: { min: 0.0, max: 1.0 },
					},
					systemPromptBehavior: 'optional' as const,
					trainingCutoff: '2023-08-01',
					releaseDate: '2024-10-22',
					responseSpeed: 'medium' as const,
					modality: 'text-and-vision' as const,
					description: "Balanced model for most use cases",
				},
				{
					modelId: 'claude-3-5-haiku-20241022',
					displayName: 'Claude Haiku 3.5',
					family: 'Claude-3',
					contextWindow: 200000,
					maxOutputTokens: 4096,
					pricing: {
						inputTokens: { basePrice: 0.00000025, cachedPrice: 0.0000000125 },
						outputTokens: { basePrice: 0.00000125 },
						currency: 'USD',
						effectiveDate: '2024-10-22',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						promptCaching: true,
						extendedThinking: false,
					},
					defaults: {
						temperature: 0.7,
						maxTokens: 4096,
						extendedThinking: false,
					},
					constraints: {
						temperature: { min: 0.0, max: 1.0 },
					},
					systemPromptBehavior: 'optional' as const,
					trainingCutoff: '2023-08-01',
					releaseDate: '2024-10-22',
					responseSpeed: 'fast' as const,
					modality: 'text-and-vision' as const,
					description: "Fast and cost-effective model for routine tasks",
				},
			];

			// Register all models
			for (const model of anthropicModels) {
				this.registerModel('anthropic', model);
			}

			// Validate API access with a test call
			const response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body: JSON.stringify({
					model: 'claude-3-5-sonnet-20241022',
					max_tokens: 10,
					messages: [{ role: 'user', content: 'Hi' }],
				}),
			});

			if (!response.ok) {
				console.warn(`Could not validate Anthropic API: ${response.status} ${response.statusText}`);
			} else {
				console.log('✅ Successfully validated Anthropic API access');
			}

		} catch (error) {
			console.error('Error fetching Anthropic capabilities:', error);
			throw error;
		}
	}

	/**
	 * Fetch OpenAI model capabilities
	 */
	private async fetchOpenAICapabilities(): Promise<void> {
		const apiKey = this.config.apiKeys.openai;
		if (!apiKey) {
			throw new Error('OpenAI API key not provided');
		}

		try {
			// Get available models from API
			const response = await fetch('https://api.openai.com/v1/models', {
				headers: {
					'Authorization': `Bearer ${apiKey}`,
				},
			});

			if (!response.ok) {
				throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const models = data.data;

			// Known model capabilities
			const knownModels = {
				'gpt-4o': {
					displayName: 'GPT-4o',
					family: 'GPT-4',
					contextWindow: 128000,
					maxOutputTokens: 4096,
					pricing: {
						inputTokens: { basePrice: 0.00001 },
						outputTokens: { basePrice: 0.00003 },
						currency: 'USD',
						effectiveDate: '2024-05-13',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: true,
						multimodal: true,
						promptCaching: false,
					},
					trainingCutoff: '2023-10-01',
					responseSpeed: 'medium' as const,
					modality: 'multimodal' as const,
				},
				'gpt-4-turbo': {
					displayName: 'GPT-4 Turbo',
					family: 'GPT-4',
					contextWindow: 128000,
					maxOutputTokens: 4096,
					pricing: {
						inputTokens: { basePrice: 0.00001 },
						outputTokens: { basePrice: 0.00003 },
						currency: 'USD',
						effectiveDate: '2023-11-06',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: false,
						promptCaching: false,
					},
					trainingCutoff: '2023-04-01',
					responseSpeed: 'medium' as const,
					modality: 'text' as const,
				},
				'gpt-3.5-turbo': {
					displayName: 'GPT-3.5 Turbo',
					family: 'GPT-3.5',
					contextWindow: 16385,
					maxOutputTokens: 4096,
					pricing: {
						inputTokens: { basePrice: 0.0000005 },
						outputTokens: { basePrice: 0.0000015 },
						currency: 'USD',
						effectiveDate: '2023-11-06',
					},
					supportedFeatures: {
						functionCalling: true,
						json: true,
						streaming: true,
						vision: false,
						promptCaching: false,
					},
					trainingCutoff: '2021-09-01',
					responseSpeed: 'fast' as const,
					modality: 'text' as const,
				},
			};

			// Register known models that are available in the API
			for (const model of models) {
				const modelId = model.id;
				const knownModel = knownModels[modelId as keyof typeof knownModels];
				
				if (knownModel) {
					this.registerModel('openai', {
						modelId,
						...knownModel,
						defaults: {
							temperature: 0.7,
							maxTokens: knownModel.maxOutputTokens,
							extendedThinking: false,
						},
						constraints: {
							temperature: { min: 0.0, max: 2.0 },
						},
						systemPromptBehavior: 'optional' as const,
					});
				}
			}

			console.log(`✅ Registered ${Object.keys(knownModels).length} OpenAI models`);
		} catch (error) {
			console.error('Error fetching OpenAI capabilities:', error);
			throw error;
		}
	}

	/**
	 * Fetch Google model capabilities
	 */
	private async fetchGoogleCapabilities(): Promise<void> {
		// Register known Google models based on documentation
		const googleModels = [
			{
				modelId: 'gemini-1.5-flash',
				displayName: 'Gemini 1.5 Flash',
				family: 'Gemini',
				contextWindow: 1000000,
				maxOutputTokens: 8192,
				pricing: {
					inputTokens: { basePrice: 0.00000035 },
					outputTokens: { basePrice: 0.0000014 },
					currency: 'USD',
					effectiveDate: '2024-03-15',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					multimodal: true,
					promptCaching: false,
				},
				trainingCutoff: '2023-08-01',
				responseSpeed: 'fast' as const,
				modality: 'multimodal' as const,
				description: 'Fast and cost-effective multimodal model',
			},
			{
				modelId: 'gemini-2.0-flash',
				displayName: 'Gemini 2.0 Flash',
				family: 'Gemini',
				contextWindow: 1000000,
				maxOutputTokens: 8192,
				pricing: {
					inputTokens: { basePrice: 0.00000035 },
					outputTokens: { basePrice: 0.0000014 },
					currency: 'USD',
					effectiveDate: '2024-08-15',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: true,
					multimodal: true,
					promptCaching: false,
				},
				trainingCutoff: '2024-03-01',
				responseSpeed: 'fast' as const,
				modality: 'multimodal' as const,
				description: 'Latest multimodal model with improved reasoning',
			},
		];

		for (const model of googleModels) {
			this.registerModel('google', {
				...model,
				defaults: {
					temperature: 0.7,
					maxTokens: model.maxOutputTokens,
					extendedThinking: false,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional' as const,
			});
		}

		console.log(`✅ Registered ${googleModels.length} Google models`);
	}

	/**
	 * Fetch DeepSeek model capabilities
	 */
	private async fetchDeepSeekCapabilities(): Promise<void> {
		const deepseekModels = [
			{
				modelId: 'deepseek-chat',
				displayName: 'DeepSeek Chat',
				family: 'DeepSeek',
				contextWindow: 32768,
				maxOutputTokens: 8192,
				pricing: {
					inputTokens: { basePrice: 0.000001 },
					outputTokens: { basePrice: 0.000005 },
					currency: 'USD',
					effectiveDate: '2024-02-01',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				responseSpeed: 'medium' as const,
				modality: 'text' as const,
				description: 'General purpose text model',
			},
			{
				modelId: 'deepseek-reasoner',
				displayName: 'DeepSeek Reasoner',
				family: 'DeepSeek',
				contextWindow: 128000,
				maxOutputTokens: 16384,
				pricing: {
					inputTokens: { basePrice: 0.000002 },
					outputTokens: { basePrice: 0.000008 },
					currency: 'USD',
					effectiveDate: '2024-05-01',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				responseSpeed: 'medium' as const,
				modality: 'text' as const,
				description: 'Advanced reasoning model',
			},
		];

		for (const model of deepseekModels) {
			this.registerModel('deepseek', {
				...model,
				defaults: {
					temperature: 0.7,
					maxTokens: model.maxOutputTokens,
					extendedThinking: false,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional' as const,
			});
		}

		console.log(`✅ Registered ${deepseekModels.length} DeepSeek models`);
	}

	/**
	 * Fetch Groq model capabilities
	 */
	private async fetchGroqCapabilities(): Promise<void> {
		const groqModels = [
			{
				modelId: 'llama3-8b-8192',
				displayName: 'LLaMA 3 8B',
				family: 'LLaMA',
				contextWindow: 8192,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: { basePrice: 0.0000001 },
					outputTokens: { basePrice: 0.0000002 },
					currency: 'USD',
					effectiveDate: '2024-04-18',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				responseSpeed: 'fast' as const,
				modality: 'text' as const,
				description: 'Fast LLaMA 3 8B model on Groq infrastructure',
			},
			{
				modelId: 'llama3-70b-8192',
				displayName: 'LLaMA 3 70B',
				family: 'LLaMA',
				contextWindow: 8192,
				maxOutputTokens: 4096,
				pricing: {
					inputTokens: { basePrice: 0.0000003 },
					outputTokens: { basePrice: 0.0000009 },
					currency: 'USD',
					effectiveDate: '2024-04-18',
				},
				supportedFeatures: {
					functionCalling: true,
					json: true,
					streaming: true,
					vision: false,
					promptCaching: false,
				},
				responseSpeed: 'medium' as const,
				modality: 'text' as const,
				description: "LLaMA 3 70B model on Groq's hardware",
			},
		];

		for (const model of groqModels) {
			this.registerModel('groq', {
				...model,
				defaults: {
					temperature: 0.7,
					maxTokens: model.maxOutputTokens,
					extendedThinking: false,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional' as const,
			});
		}

		console.log(`✅ Registered ${groqModels.length} Groq models`);
	}

	/**
	 * Register a model with its capabilities
	 */
	private registerModel(provider: string, modelCapabilities: Partial<EnhancedModelCapabilities>): void {
		// Initialize provider object if it doesn't exist
		if (!this.allCapabilities[provider]) {
			this.allCapabilities[provider] = {};
		}

		// Fill in default values and ensure all required fields are present
		const capabilities: ModelCapabilities = {
			displayName: modelCapabilities.displayName || 'Unknown Model',
			contextWindow: modelCapabilities.contextWindow || 4096,
			maxOutputTokens: modelCapabilities.maxOutputTokens || 2048,
			pricing: modelCapabilities.pricing || {
				inputTokens: { basePrice: 0 },
				outputTokens: { basePrice: 0 },
				currency: 'USD',
				effectiveDate: new Date().toISOString().split('T')[0],
			},
			supportedFeatures: modelCapabilities.supportedFeatures || {
				functionCalling: false,
				json: false,
				streaming: true,
				vision: false,
				extendedThinking: false,
				promptCaching: false,
			},
			defaults: modelCapabilities.defaults || {
				temperature: 0.7,
				maxTokens: modelCapabilities.maxOutputTokens || 2048,
				extendedThinking: false,
			},
			constraints: modelCapabilities.constraints || {
				temperature: { min: 0.0, max: 1.0 },
			},
			systemPromptBehavior: modelCapabilities.systemPromptBehavior || 'optional',
			responseSpeed: modelCapabilities.responseSpeed || 'medium',
			...( modelCapabilities.trainingCutoff && { trainingCutoff: modelCapabilities.trainingCutoff }),
			...( modelCapabilities.releaseDate && { releaseDate: modelCapabilities.releaseDate }),
		};

		// Add the model capabilities
		const modelId = modelCapabilities.modelId!;
		this.allCapabilities[provider][modelId] = capabilities;
		console.log(`  ✓ Registered ${provider}/${modelId}`);
	}
}

/**
 * Main function to run the script
 */
async function main() {
	// Parse command line arguments
	const args = parseArgs(Deno.args, {
		string: ['output', 'providers', 'anthropic-key', 'openai-key', 'google-key', 'deepseek-key', 'groq-key'],
		boolean: ['use-cached', 'validate-only'],
		default: {
			output: './api/src/data/modelCapabilities.json',
			providers: 'anthropic,openai,google,deepseek,groq',
			'use-cached': false,
			'validate-only': false,
		},
	});

	// Setup configuration
	const config: FetcherConfig = {
		outputPath: args.output,
		providersToFetch: args.providers.split(',').map((p) => p.trim()),
		useCached: args['use-cached'],
		validateOnly: args['validate-only'],
		apiKeys: {
			anthropic: args['anthropic-key'] || Deno.env.get('ANTHROPIC_API_KEY') || '',
			openai: args['openai-key'] || Deno.env.get('OPENAI_API_KEY') || '',
			google: args['google-key'] || Deno.env.get('GOOGLE_API_KEY') || '',
			deepseek: args['deepseek-key'] || Deno.env.get('DEEPSEEK_API_KEY') || '',
			groq: args['groq-key'] || Deno.env.get('GROQ_API_KEY') || '',
		},
	};

	// Create and run the fetcher
	const fetcher = new ModelCapabilitiesFetcher(config);
	await fetcher.run();
}

// Run the script
if (import.meta.main) {
	main().catch((err) => {
		console.error('Fatal error:', err);
		Deno.exit(1);
	});
}