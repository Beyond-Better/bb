/**
 * ModelRegistryService
 *
 * Unified service for managing model information across all providers
 * Combines static model data with dynamically discovered models (like Ollama)
 * Replaces the enum-based approach with a flexible registry system
 */

import { logger } from 'shared/logger.ts';
import { isError } from 'api/errors/error.ts';
import type { LLMProvider } from 'api/types.ts';
import type { ModelCapabilities, ModelInfo } from 'api/types/modelCapabilities.types.ts';
import type { LLMProviderConfig, ProjectConfig } from 'shared/config/types.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
//import type { PartialTokenPricing } from 'shared/types/models.ts';

// Import the built-in capabilities data
import builtinCapabilities from '../data/modelCapabilities.json' with { type: 'json' };

/**
 * Configuration for Ollama model discovery
 */
export interface OllamaConfig {
	enabled: boolean;
	baseURL?: string;
	timeout?: number;
}

/**
 * Default capabilities for fallback
 */
const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
	displayName: 'Unknown Model',
	contextWindow: 4096,
	maxOutputTokens: 2048,
	token_pricing: {
		input: 0,
		output: 0,
	},
	pricing_metadata: {
		currency: 'USD',
		effectiveDate: new Date().toISOString().split('T')[0],
	},
	// // Legacy pricing structure for backward compatibility
	// pricing: {
	// 	inputTokens: {
	// 		basePrice: 0.0,
	// 	},
	// 	outputTokens: {
	// 		basePrice: 0.0,
	// 	},
	// 	currency: 'USD',
	// 	effectiveDate: new Date().toISOString().split('T')[0],
	// },
	supportedFeatures: {
		functionCalling: false,
		json: false,
		streaming: true,
		vision: false,
		extendedThinking: false,
		promptCaching: false,
	},
	defaults: {
		temperature: 0.7,
		maxTokens: 2048,
		extendedThinking: false,
	},
	constraints: {
		temperature: { min: 0.0, max: 1.0 },
	},
	systemPromptBehavior: 'optional',
	responseSpeed: 'medium',
};

/**
 * Service for managing the unified model registry
 */
export class ModelRegistryService {
	private static instance: ModelRegistryService;
	private modelRegistry: Map<string, ModelInfo> = new Map();
	private providerModels: Map<LLMProvider, string[]> = new Map();
	private initialized = false;
	private llmProviders!: Partial<Record<LLMProvider, LLMProviderConfig>>;

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {}

	/**
	 * Get the singleton instance
	 */
	public static async getInstance(projectConfig?: ProjectConfig): Promise<ModelRegistryService> {
		if (!ModelRegistryService.instance) {
			ModelRegistryService.instance = new ModelRegistryService();
			await ModelRegistryService.instance.init(projectConfig);
		}
		return ModelRegistryService.instance;
	}

	/**
	 * Initialize the service
	 */
	public async init(projectConfig?: ProjectConfig): Promise<void> {
		if (this.initialized) return;

		if (projectConfig) {
			this.llmProviders = projectConfig.api?.llmProviders || {};
		} else {
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			this.llmProviders = globalConfig.api?.llmProviders || {};
		}

		try {
			// Load static models from built-in capabilities
			await this.loadStaticModels();

			// Discover dynamic models (Ollama)
			await this.discoverDynamicModels();

			this.initialized = true;
			logger.info(`ModelRegistryService: Initialized with ${this.modelRegistry.size} models`);
		} catch (error) {
			logger.error(`ModelRegistryService: Failed to initialize: ${isError(error) ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Load static models from built-in capabilities JSON
	 */
	private async loadStaticModels(): Promise<void> {
		try {
			const capabilities = builtinCapabilities as Record<
				string,
				Record<string, ModelCapabilities & { hidden?: boolean }>
			>;

			for (const [provider, models] of Object.entries(capabilities)) {
				const providerEnum = provider as LLMProvider;
				const modelIds: string[] = [];

				for (const [modelId, modelCapabilities] of Object.entries(models)) {
					const modelInfo: ModelInfo = {
						id: modelId,
						displayName: modelCapabilities.displayName,
						provider: providerEnum,
						capabilities: modelCapabilities,
						source: 'static',
						hidden: modelCapabilities.hidden || false,
					};

					this.modelRegistry.set(modelId, modelInfo);
					modelIds.push(modelId);
				}

				this.providerModels.set(providerEnum, modelIds);
			}

			logger.info(`ModelRegistryService: Loaded ${this.modelRegistry.size} static models`);
		} catch (error) {
			logger.error(
				`ModelRegistryService: Error loading static models: ${isError(error) ? error.message : error}`,
			);
			throw error;
		}
	}

	/**
	 * Discover dynamic models (currently Ollama)
	 */
	private async discoverDynamicModels(): Promise<void> {
		// Only check Ollama if enabled in config
		const ollamaConfig = this.llmProviders?.ollama;
		//logger.info('ModelRegistryService: llmProviders', this.llmProviders );
		if (!ollamaConfig?.enabled) {
			logger.info('ModelRegistryService: Ollama discovery disabled in configuration');
			return;
		}

		try {
			if (ollamaConfig.enabled === undefined) ollamaConfig.enabled = false;
			const ollamaModels = await this.discoverOllamaModels(ollamaConfig as OllamaConfig);
			logger.info(`ModelRegistryService: Discovered ${ollamaModels.length} Ollama models`);
		} catch (error) {
			logger.warn(
				`ModelRegistryService: Error discovering Ollama models: ${isError(error) ? error.message : error}`,
			);
			// Don't throw - Ollama discovery failure shouldn't prevent startup
		}
	}

	/**
	 * Discover available Ollama models
	 */
	private async discoverOllamaModels(ollamaConfig: OllamaConfig): Promise<string[]> {
		const baseURL = ollamaConfig.baseURL || 'http://localhost:11434';
		const timeout = ollamaConfig.timeout || 5000;

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const response = await fetch(`${baseURL}/api/tags`, {
				signal: controller.signal,
				headers: {
					'Content-Type': 'application/json',
				},
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			const models = data.models || [];

			// Register discovered Ollama models
			const ollamaModelIds: string[] = [];
			for (const model of models) {
				const modelId = model.name;
				//const displayName = model.details?.family || model.name;
				const displayName = model.details?.family ? `${model.name} (${model.details.family})` : model.name;

				// Create capabilities for Ollama models
				const capabilities: ModelCapabilities = {
					...DEFAULT_MODEL_CAPABILITIES,
					displayName,
					// Ollama models are local, so no cost
					token_pricing: {
						input: 0,
						output: 0,
					},
					pricing_metadata: {
						currency: 'USD',
						effectiveDate: new Date().toISOString().split('T')[0],
					},
					// Try to infer some capabilities from model details
					contextWindow: model.details?.parameter_size ? Math.min(32768, 8192) : 4096,
					maxOutputTokens: model.details?.parameter_size ? Math.min(8192, 4096) : 2048,
					supportedFeatures: {
						functionCalling: this.modelSupportsTools(modelId),
						json: true,
						streaming: true,
						vision: this.modelSupportsVision(modelId),
						extendedThinking: false,
						promptCaching: false,
					},
				};

				const modelInfo: ModelInfo = {
					id: modelId,
					displayName,
					provider: 'ollama' as LLMProvider,
					capabilities,
					source: 'dynamic',
				};

				this.modelRegistry.set(modelId, modelInfo);
				ollamaModelIds.push(modelId);
			}

			// Update provider models list
			const existingOllamaModels = this.providerModels.get('ollama' as LLMProvider) || [];
			this.providerModels.set('ollama' as LLMProvider, [...existingOllamaModels, ...ollamaModelIds]);

			return ollamaModelIds;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Ollama discovery timeout after ${timeout}ms`);
			}
			throw error;
		}
	}

	/**
	 * Heuristic to determine if a model supports tool/function calling
	 */
	private modelSupportsTools(modelId: string): boolean {
		const toolSupportingPatterns = [
			'command-r',
			'firefunction',
			'tool-use',
			'function',
			'qwen',
			'llama3-groq',
		];

		return toolSupportingPatterns.some((pattern) => modelId.toLowerCase().includes(pattern.toLowerCase()));
	}

	/**
	 * Heuristic to determine if a model supports vision
	 */
	private modelSupportsVision(modelId: string): boolean {
		const visionPatterns = [
			'vision',
			'llava',
			'multimodal',
		];

		return visionPatterns.some((pattern) => modelId.toLowerCase().includes(pattern.toLowerCase()));
	}

	/**
	 * Get all available models (excluding hidden ones)
	 */
	public getAllModels(): ModelInfo[] {
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning empty list');
			return [];
		}

		return Array.from(this.modelRegistry.values()).filter((model) => !model.hidden);
	}

	/**
	 * Get all models including hidden ones (for admin/diagnostic purposes)
	 */
	public getAllModelsIncludingHidden(): ModelInfo[] {
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning empty list');
			return [];
		}

		return Array.from(this.modelRegistry.values());
	}

	/**
	 * Get models for a specific provider (excluding hidden ones)
	 */
	public getModelsByProvider(provider: LLMProvider): ModelInfo[] {
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning empty list');
			return [];
		}

		const modelIds = this.providerModels.get(provider) || [];
		return modelIds.map((id) => this.modelRegistry.get(id)!).filter(Boolean).filter((model) => !model.hidden);
	}

	/**
	 * Get all models for a specific provider (including hidden ones)
	 */
	public getModelsByProviderIncludingHidden(provider: LLMProvider): ModelInfo[] {
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning empty list');
			return [];
		}

		const modelIds = this.providerModels.get(provider) || [];
		return modelIds.map((id) => this.modelRegistry.get(id)!).filter(Boolean);
	}

	/**
	 * Get model information by ID
	 */
	public getModel(modelId: string): ModelInfo | undefined {
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning undefined');
			return undefined;
		}

		return this.modelRegistry.get(modelId);
	}

	/**
	 * Get model capabilities by ID
	 */
	public getModelCapabilities(modelId: string): ModelCapabilities {
		const model = this.getModel(modelId);
		if (!model) {
			logger.warn(`ModelRegistryService: Model not found: ${modelId}, using defaults`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		return model.capabilities;
	}

	/**
	 * Get the provider for a model
	 */
	public getModelProvider(modelId: string): LLMProvider | undefined {
		const model = this.getModel(modelId);
		return model?.provider;
	}

	/**
	 * Check if a model supports a specific feature
	 */
	public supportsFeature(
		modelId: string,
		feature: keyof ModelCapabilities['supportedFeatures'],
	): boolean {
		const capabilities = this.getModelCapabilities(modelId);
		return !!(capabilities.supportedFeatures && capabilities.supportedFeatures[feature]);
	}

	/**
	 * Create a model-to-provider mapping (for backwards compatibility)
	 */
	public getModelToProviderMapping(): Record<string, LLMProvider> {
		const mapping: Record<string, LLMProvider> = {};

		for (const [modelId, modelInfo] of this.modelRegistry) {
			mapping[modelId] = modelInfo.provider;
		}

		return mapping;
	}

	/**
	 * Refresh dynamic models (useful for manual updates)
	 */
	public async refreshDynamicModels(): Promise<void> {
		if (!this.initialized) {
			throw new Error('ModelRegistryService: Service not initialized');
		}

		await this.discoverDynamicModels();
	}

	/**
	 * Get default model for a provider
	 */
	public getDefaultModelForProvider(provider: LLMProvider): string | undefined {
		const models = this.getModelsByProvider(provider);

		// Return the first model for the provider
		// Could be enhanced with more sophisticated logic
		return models.length > 0 ? models[0].id : undefined;
	}
}
