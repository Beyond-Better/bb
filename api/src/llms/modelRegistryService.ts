/**
 * ModelRegistryService
 *
 * Unified service for managing model information across all providers
 * Combines static model data with dynamically discovered models (like Ollama)
 * Replaces the enum-based approach with a flexible registry system
 */

import { logger } from 'shared/logger.ts';
import { isError } from 'api/errors/error.ts';
import type { LLMModelConfig, LLMProvider } from 'api/types.ts';
import type { ModelCapabilities, ModelInfo } from 'api/types/modelCapabilities.ts';
import type { LLMProviderConfig, ProjectConfig } from 'shared/config/types.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
//import type { PartialTokenPricing } from 'shared/types/models.ts';

// Generic types for model selection (used across BB, not just MCP)
export interface ModelSelectionPreferences {
	/** Cost priority (0.0 = don't care, 1.0 = minimize cost) */
	costPriority?: number;
	/** Speed priority (0.0 = don't care, 1.0 = maximize speed) */
	speedPriority?: number;
	/** Intelligence priority (0.0 = don't care, 1.0 = maximize capabilities) */
	intelligencePriority?: number;
	/** Model hints for preferred models or providers */
	hints?: ModelSelectionHint[];
}

export interface ModelSelectionHint {
	/** Hint name (model ID, provider name, or capability) */
	name: string;
	/** Optional description of why this hint is preferred */
	description?: string;
}

// Import the built-in capabilities data
import builtinCapabilities from '../data/modelCapabilities.json' with { type: 'json' };

/**
 * Configuration for Ollama model discovery
 */
export interface OllamaConfig {
	enabled: boolean;
	baseUrl?: string;
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
	private preferredProviders: string[] = ['anthropic'];

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
	 * Set preferred providers for model selection
	 * @param providers Array of provider names in order of preference
	 */
	public setPreferredProviders(providers: string[]): void {
		this.preferredProviders = [...providers];
		logger.info('ModelRegistryService: Updated preferred providers', { providers });
	}

	/**
	 * Get current preferred providers
	 */
	public getPreferredProviders(): string[] {
		return [...this.preferredProviders];
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
	// deno-lint-ignore require-await
	private async loadStaticModels(): Promise<void> {
		try {
			// Destructure to separate metadata from provider data
			const { _metadata, ...providers } = (builtinCapabilities as unknown) as {
				_metadata?: Record<string, string | number>;
			} & Record<string, Record<string, ModelCapabilities & { hidden?: boolean }>>;

			for (const [provider, models] of Object.entries(providers)) {
				const providerEnum = provider as LLMProvider;

				// Skip Ollama models from static data - they are handled by dynamic discovery
				if (providerEnum === 'ollama') {
					logger.info(
						'ModelRegistryService: Skipping static Ollama models - using dynamic discovery instead',
					);
					continue;
				}

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
		const baseUrl = ollamaConfig.baseUrl || 'http://localhost:11434';
		const timeout = ollamaConfig.timeout || 5000;

		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const response = await fetch(`${baseUrl}/api/tags`, {
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
					// Add feature key for access control
					featureKey: 'models.ollama',
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
					localOnly: true, // Ollama models are only available in local mode
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
	 * Get model capabilities by ID
	 */
	public getModelConfig(modelId: string): LLMModelConfig {
		const modelCapabilities = this.getModelCapabilities(modelId);

		const modelConfig = {
			model: modelId,
			temperature: modelCapabilities.defaults.temperature ?? 0.7,
			maxTokens: modelCapabilities.defaults.maxTokens ?? 16384,
			extendedThinking: {
				enabled: modelCapabilities.supportedFeatures.extendedThinking ?? false,
				// enabled: modelCapabilities.supportedFeatures.extendedThinking ??
				// 	(projectConfig.api?.extendedThinking?.enabled ?? globalConfig.api.extendedThinking?.enabled ?? true),
				budgetTokens: 4096,
				// budgetTokens: projectConfig.api?.extendedThinking?.budgetTokens ||
				// 	globalConfig.api.extendedThinking?.budgetTokens || 4096,
			},
			usePromptCaching: modelCapabilities.supportedFeatures.promptCaching,
			// usePromptCaching: modelCapabilities.supportedFeatures.promptCaching ??
			// 	(projectConfig.api?.usePromptCaching ?? globalConfig.api.usePromptCaching ?? true),
		};

		return modelConfig;
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

	// ============================================================================
	// SMART MODEL SELECTION METHODS
	// ============================================================================

	/**
	 * Select the best model based on preferences using intelligent scoring
	 * This is the main entry point for smart model selection across BB
	 */
	public selectModelByPreferences(preferences?: ModelSelectionPreferences): string {
		//logger.info('ModelRegistryService: selecting model based on preferences', preferences);
		if (!this.initialized) {
			logger.warn('ModelRegistryService: Service not initialized, returning smart default');
			return this.getSmartDefaultModel();
		}

		// If no preferences provided, use smart default logic
		if (!preferences) {
			//logger.info('ModelRegistryService: No preferences provided, using smart default');
			return this.getSmartDefaultModel();
		}

		const allModels = this.getAllModels();
		if (allModels.length === 0) {
			logger.warn('ModelRegistryService: No models available, returning fallback default');
			return this.getFallbackDefaultModel();
		}

		// Process hints first if provided
		if (preferences.hints?.length) {
			for (const hint of preferences.hints) {
				// Skip hints with invalid names
				if (!hint.name || typeof hint.name !== 'string' || hint.name.trim() === '') {
					logger.warn('ModelRegistryService: Skipping invalid hint with empty/undefined name:', hint);
					continue;
				}

				//logger.info('ModelRegistryService: choosing model from hints: ', hint.name);
				const mappedModel = this.mapHintToModel(allModels, hint.name);
				if (mappedModel) {
					//logger.info(`ModelRegistryService: Mapped hint '${hint.name}' to model '${mappedModel}'`);
					return mappedModel;
				}
			}
			//logger.info('ModelRegistryService: No suitable model found for hints, using capability priorities');
		}

		// Use capability-based selection
		const selectedModel = this.selectModelByCapabilities(allModels, {
			cost: preferences.costPriority || 0.5,
			speed: preferences.speedPriority || 0.5,
			intelligence: preferences.intelligencePriority || 0.5,
		});

		logger.info('ModelRegistryService: Selected model using capability scoring', {
			selectedModel,
			preferences: {
				cost: preferences.costPriority,
				speed: preferences.speedPriority,
				intelligence: preferences.intelligencePriority,
			},
		});

		return selectedModel;
	}

	/**
	 * Map model hints to available models using comprehensive matching logic
	 */
	public mapHintToModel(allModels: ModelInfo[], hint: string): string | null {
		// Validate input parameters
		if (!hint || typeof hint !== 'string' || hint.trim() === '') {
			logger.warn('ModelRegistryService: Invalid hint provided to mapHintToModel:', hint);
			return null;
		}

		if (!allModels || allModels.length === 0) {
			logger.warn('ModelRegistryService: No models provided to mapHintToModel');
			return null;
		}

		const normalizedHint = hint.trim();

		// 1. Check for case-insensitive exact model ID match
		const caseInsensitiveMatch = allModels.find((m) => m.id.toLowerCase() === normalizedHint.toLowerCase());
		if (caseInsensitiveMatch) {
			return caseInsensitiveMatch.id;
		}

		// 2. Create dynamic model mappings based on available models
		const modelMappings: Record<string, string[]> = {
			// Claude variants
			'claude-3-sonnet': allModels
				.filter((m) => m.id.includes('claude-3') && m.id.includes('sonnet'))
				.map((m) => m.id),
			'claude-sonnet': allModels
				.filter((m) => m.id.includes('claude') && m.id.includes('sonnet'))
				.map((m) => m.id),
			'claude-3-haiku': allModels
				.filter((m) => m.id.includes('claude-3') && m.id.includes('haiku'))
				.map((m) => m.id),
			'claude-haiku': allModels.filter((m) => m.id.includes('claude') && m.id.includes('haiku')).map((m) => m.id),
			'claude-3-opus': allModels
				.filter((m) => m.id.includes('claude-3') && m.id.includes('opus'))
				.map((m) => m.id),
			'claude-opus': allModels.filter((m) => m.id.includes('claude') && m.id.includes('opus')).map((m) => m.id),
			'claude': allModels.filter((m) => m.id.includes('claude')).map((m) => m.id),

			// GPT variants
			'gpt-4o': allModels.filter((m) => m.id.includes('gpt-4o')).map((m) => m.id),
			'gpt-4': allModels.filter((m) => m.id.includes('gpt-4')).map((m) => m.id),
			'gpt': allModels.filter((m) => m.id.includes('gpt')).map((m) => m.id),
			'openai': allModels.filter((m) => m.provider === 'openai').map((m) => m.id),

			// Gemini variants
			'gemini-pro': allModels
				.filter((m) => m.id.includes('gemini') && m.id.includes('pro'))
				.map((m) => m.id),
			'gemini': allModels.filter((m) => m.id.includes('gemini')).map((m) => m.id),
			'google': allModels.filter((m) => m.provider === 'google').map((m) => m.id),

			// Ollama
			'ollama': allModels.filter((m) => m.provider === 'ollama').map((m) => m.id),
		};

		// 3. Check exact pattern matches
		const exactMatch = modelMappings[normalizedHint.toLowerCase()];
		if (exactMatch && exactMatch.length > 0) {
			// Apply provider preference to pattern matches
			const preferredMatch = this.applyProviderPreference(
				exactMatch.map((id) => allModels.find((m) => m.id === id)!).filter(Boolean),
			);
			return preferredMatch ? preferredMatch.id : exactMatch[0];
		}

		// 4. Check for partial pattern matches
		for (const [pattern, models] of Object.entries(modelMappings)) {
			if (normalizedHint.toLowerCase().includes(pattern.toLowerCase()) && models.length > 0) {
				// Apply provider preference to pattern matches
				const preferredMatch = this.applyProviderPreference(
					models.map((id) => allModels.find((m) => m.id === id)!).filter(Boolean),
				);
				return preferredMatch ? preferredMatch.id : models[0];
			}
		}

		// 5. Check if the hint is contained in any model ID
		const partialMatch = allModels.find((m) => m.id.toLowerCase().includes(normalizedHint.toLowerCase()));
		if (partialMatch) {
			return partialMatch.id;
		}

		return null;
	}

	/**
	 * Apply provider preference to a list of models
	 * Returns the first model from the most preferred provider, or null if no models match preferences
	 */
	private applyProviderPreference(models: ModelInfo[]): ModelInfo | null {
		if (models.length === 0) return null;
		if (models.length === 1) return models[0];

		// Try to find models from preferred providers in order
		for (const preferredProvider of this.preferredProviders) {
			const matchingModels = models.filter((m) => m.provider === preferredProvider);
			if (matchingModels.length > 0) {
				return matchingModels[0]; // Return first match from this preferred provider
			}
		}

		// If no preferred provider matches, return the first model
		return models[0];
	}

	/**
	 * Select model based on capability priorities using intelligent scoring
	 */
	public selectModelByCapabilities(
		allModels: ModelInfo[],
		priorities: {
			cost: number;
			speed: number;
			intelligence: number;
		},
	): string {
		if (allModels.length === 0) {
			return this.getFallbackDefaultModel();
		}

		// Score each model based on priorities
		let bestModel = allModels[0];
		let bestScore = -1;

		for (const model of allModels) {
			const capabilities = model.capabilities;

			// Calculate scores for each priority (0-1 range)
			const costScore = this.calculateCostScore(capabilities);
			const speedScore = this.calculateSpeedScore(capabilities);
			const intelligenceScore = this.calculateIntelligenceScore(capabilities);

			// Weighted combination of scores
			let totalScore = costScore * priorities.cost + speedScore * priorities.speed +
				intelligenceScore * priorities.intelligence;

			// Apply provider preference bonus (up to 0.1 points)
			const providerBonus = this.calculateProviderPreferenceScore(model.provider);
			totalScore += providerBonus;

			if (totalScore > bestScore) {
				bestScore = totalScore;
				bestModel = model;
			}
		}

		logger.debug('ModelRegistryService: Selected model using capability scoring', {
			selectedModel: bestModel.id,
			bestScore,
			priorities,
			preferredProviders: this.preferredProviders,
		});

		return bestModel.id;
	}

	/**
	 * Calculate cost score (lower cost = higher score)
	 */
	public calculateCostScore(capabilities: ModelCapabilities): number {
		const inputPrice = capabilities.token_pricing?.input || 0;
		const outputPrice = capabilities.token_pricing?.output || 0;
		const avgPrice = (inputPrice + outputPrice) / 2;

		// Normalize price to 0-1 score (assuming max price of $0.10 per 1K tokens)
		const maxPrice = 0.1;
		return Math.max(0, 1 - avgPrice / maxPrice);
	}

	/**
	 * Calculate speed score based on model response speed rating
	 */
	public calculateSpeedScore(capabilities: ModelCapabilities): number {
		const speedRating = capabilities.responseSpeed || 'medium';
		switch (speedRating) {
			case 'very_fast':
				return 1.0;
			case 'fast':
				return 0.8;
			case 'medium':
				return 0.6;
			case 'slow':
				return 0.4;
			case 'very_slow':
				return 0.2;
			default:
				return 0.6;
		}
	}

	/**
	 * Calculate intelligence score based on model capabilities and features
	 */
	public calculateIntelligenceScore(capabilities: ModelCapabilities): number {
		let score = 0.5; // Base score

		// Bonus for advanced features
		if (capabilities.supportedFeatures?.functionCalling) score += 0.1;
		if (capabilities.supportedFeatures?.json) score += 0.1;
		if (capabilities.supportedFeatures?.vision) score += 0.1;
		if (capabilities.supportedFeatures?.extendedThinking) score += 0.1;
		if (capabilities.supportedFeatures?.promptCaching) score += 0.05;

		// Bonus for larger context windows (normalized to max 200k tokens)
		const contextBonus = Math.min(0.15, (capabilities.contextWindow / 200000) * 0.15);
		score += contextBonus;

		return Math.min(1.0, score);
	}

	/**
	 * Calculate provider preference score bonus
	 * Returns a bonus score (0-0.1) based on provider preference ranking
	 */
	public calculateProviderPreferenceScore(provider: LLMProvider): number {
		const providerIndex = this.preferredProviders.indexOf(provider);
		if (providerIndex === -1) {
			// Provider not in preferences, no bonus
			return 0;
		}

		// Higher preference = higher bonus (0.1 for first, decreasing by 0.02 for each subsequent)
		const maxBonus = 0.1;
		const decreasePerRank = 0.02;
		return Math.max(0, maxBonus - (providerIndex * decreasePerRank));
	}

	/**
	 * Get smart default model using intelligent logic instead of hard-coded values
	 * Selects a balanced model that works well for most use cases
	 */
	public getSmartDefaultModel(): string {
		if (!this.initialized) {
			return this.getFallbackDefaultModel();
		}

		const allModels = this.getAllModels();
		if (allModels.length === 0) {
			return this.getFallbackDefaultModel();
		}

		// First try to get a model from preferred providers
		for (const preferredProvider of this.preferredProviders) {
			const providerModels = allModels.filter((m) => m.provider === preferredProvider);
			if (providerModels.length > 0) {
				// Use balanced priorities for default selection within preferred provider
				const balancedPreferences: ModelSelectionPreferences = {
					costPriority: 0.3, // Some cost consideration
					speedPriority: 0.3, // Some speed consideration
					intelligencePriority: 0.7, // Prefer intelligence for general use
				};

				const selectedModel = this.selectModelByCapabilities(providerModels, {
					cost: balancedPreferences.costPriority!,
					speed: balancedPreferences.speedPriority!,
					intelligence: balancedPreferences.intelligencePriority!,
				});

				logger.info('ModelRegistryService: Selected smart default model from preferred provider', {
					selectedModel,
					preferredProvider,
					preferences: balancedPreferences,
				});

				return selectedModel;
			}
		}

		// Fallback to all models if no preferred provider has models
		const balancedPreferences: ModelSelectionPreferences = {
			costPriority: 0.3, // Some cost consideration
			speedPriority: 0.3, // Some speed consideration
			intelligencePriority: 0.7, // Prefer intelligence for general use
		};

		const selectedModel = this.selectModelByCapabilities(allModels, {
			cost: balancedPreferences.costPriority!,
			speed: balancedPreferences.speedPriority!,
			intelligence: balancedPreferences.intelligencePriority!,
		});

		logger.info('ModelRegistryService: Selected smart default model (fallback to all models)', {
			selectedModel,
			preferences: balancedPreferences,
			preferredProviders: this.preferredProviders,
		});

		return selectedModel;
	}

	/**
	 * Get fallback default model when smart logic fails
	 * This should only be used when ModelRegistryService is not properly initialized
	 */
	private getFallbackDefaultModel(): string {
		// Conservative fallback - should rarely be used
		logger.warn('ModelRegistryService: Using hard-coded fallback default model');
		return 'claude-sonnet-4-5-20250929';
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

	// ============================================================================
	// PARAMETER RESOLUTION METHODS (existing)
	// ============================================================================

	/**
	 * Resolves a parameter value based on priority
	 */
	public resolveParameter<T>(
		paramName: keyof ModelCapabilities['defaults'],
		model: string,
		explicitValue?: T,
		userPreference?: T,
		interactionPreference?: T,
	): T {
		// If explicitly provided, use that value
		if (explicitValue !== undefined) {
			return this.validateParameterValue(paramName, model, explicitValue);
		}

		// If user has configured a preference, use that
		if (userPreference !== undefined) {
			return this.validateParameterValue(paramName, model, userPreference);
		}

		// If interaction has a specific preference, use that
		if (interactionPreference !== undefined) {
			return this.validateParameterValue(paramName, model, interactionPreference);
		}

		// Otherwise use the model's default value
		const capabilities = this.getModelCapabilities(model);
		const defaultValue = capabilities.defaults[paramName as keyof ModelCapabilities['defaults']];

		return defaultValue as unknown as T;
	}

	/**
	 * Resolves the temperature parameter with validation
	 */
	public resolveTemperature(
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
	): number {
		const temperature = this.resolveParameter<number>(
			'temperature',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
		);

		// Validate against model constraints
		const capabilities = this.getModelCapabilities(model);
		const { min, max } = capabilities.constraints.temperature;
		return Math.max(min, Math.min(max, temperature));
	}

	/**
	 * Resolves the maxTokens parameter with validation
	 */
	public resolveMaxTokens(
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
	): number {
		const requestedTokens = this.resolveParameter<number>(
			'maxTokens',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
		);

		// Ensure tokens don't exceed the model's maximum
		const capabilities = this.getModelCapabilities(model);
		return Math.min(requestedTokens, capabilities.maxOutputTokens);
	}

	/**
	 * Resolves the extendedThinking parameter with validation
	 */
	public resolveExtendedThinking(
		model: string,
		explicitValue?: boolean,
		userPreference?: boolean,
		interactionPreference?: boolean,
	): boolean {
		const wantsExtendedThinking = this.resolveParameter<boolean | undefined>(
			'extendedThinking',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
		);

		// Ensure tokens don't exceed the model's maximum
		const capabilities = this.getModelCapabilities(model);
		return wantsExtendedThinking ?? capabilities.supportedFeatures.extendedThinking ?? false;
	}

	/**
	 * Validates and normalizes parameter values based on model constraints
	 */
	private validateParameterValue<T>(
		parameter: keyof ModelCapabilities['defaults'],
		model: string,
		value: T,
	): T {
		const capabilities = this.getModelCapabilities(model);

		// Handle special cases that need validation
		if (parameter === 'temperature') {
			const range = capabilities.constraints.temperature;
			const temperature = value as unknown as number;
			return Math.max(range.min, Math.min(range.max, temperature)) as unknown as T;
		}

		if (parameter === 'maxTokens') {
			const maxAllowed = capabilities.maxOutputTokens;
			const tokens = value as unknown as number;
			return Math.min(maxAllowed, tokens > 0 ? tokens : maxAllowed) as unknown as T;
		}

		if (parameter === 'extendedThinking') {
			const extendedThinkingAllowed = capabilities.supportedFeatures.extendedThinking;
			const extendedThinking = value as unknown as boolean;
			return (extendedThinkingAllowed ? extendedThinking : false) as unknown as T;
		}

		// For other parameters, just return as is
		return value;
	}
}
