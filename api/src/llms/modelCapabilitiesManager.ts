/**
 * ModelCapabilitiesManager
 *
 * Manages model capabilities and parameter resolution for LLMs
 * Handles loading, caching, and resolving model-specific capabilities and parameters
 */

//import { join } from '@std/path';
import type { LLMProvider } from 'api/types.ts';
import { LLMModelToProvider } from 'api/types/llms.ts';
import type { InteractionPreferences, ModelCapabilities, UserModelPreferences } from 'api/types/modelCapabilities.ts';
import { logger } from 'shared/logger.ts';
import { isError } from 'api/errors/error.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

// Import the built-in capabilities data
import builtinCapabilities from '../data/modelCapabilities.json' with { type: 'json' };

// URL to fetch updates from BB server (future implementation)
// const CAPABILITIES_URL = 'https://api.beyondbetter.dev/modelCapabilities';
// const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default capabilities for fallback
const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
	displayName: 'Claude',
	contextWindow: 100000,
	maxOutputTokens: 4096,
	pricing: {
		inputTokens: {
			basePrice: 0.0,
		},
		outputTokens: {
			basePrice: 0.0,
		},
		currency: 'USD',
		effectiveDate: new Date().toISOString().split('T')[0],
	},
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
		maxTokens: 4096,
		extendedThinking: false,
	},
	constraints: {
		temperature: { min: 0.0, max: 1.0 },
	},
	systemPromptBehavior: 'optional',
	responseSpeed: 'medium',
};

/**
 * Manages access to model capabilities and parameter resolution
 */
export class ModelCapabilitiesManager {
	private static instance: ModelCapabilitiesManager;
	private capabilities: Record<string, Record<string, ModelCapabilities>>;
	private cache: Map<string, ModelCapabilities> = new Map();
	//private lastFetchTime = 0;
	private initialized = false;

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {
		this.capabilities = builtinCapabilities as Record<string, Record<string, ModelCapabilities>>;
	}

	/**
	 * Get the singleton instance
	 */
	public static getInstance(): ModelCapabilitiesManager {
		if (!ModelCapabilitiesManager.instance) {
			ModelCapabilitiesManager.instance = new ModelCapabilitiesManager();
		}
		return ModelCapabilitiesManager.instance;
	}

	/**
	 * Initialize the manager by loading and validating built-in capabilities
	 */
	// deno-lint-ignore require-await
	public async initialize(): Promise<ModelCapabilitiesManager> {
		if (this.initialized) return this;

		try {
			// Validate built-in capabilities
			this.validateCapabilities(this.capabilities);
			this.initialized = true;
			logger.info('ModelCapabilitiesManager: Initialized with built-in capabilities');

			// Schedule a refresh of capabilities in the background
			this.refreshCapabilities().catch((error) => {
				logger.warn(`ModelCapabilitiesManager: Failed to refresh capabilities: ${error.message}`);
			});
			return this;
		} catch (error) {
			logger.error(`ModelCapabilitiesManager: Failed to initialize: ${isError(error) ? error.message : error}`);
			throw error;
		}
	}

	/**
	 * Validates the structure of loaded capabilities
	 */
	private validateCapabilities(capabilities: Record<string, Record<string, ModelCapabilities>>): void {
		if (!capabilities || typeof capabilities !== 'object') {
			throw new Error('Invalid capabilities data: must be an object');
		}

		// Validate provider entries
		for (const [provider, models] of Object.entries(capabilities)) {
			if (!models || typeof models !== 'object') {
				throw new Error(`Invalid capabilities for provider ${provider}: must be an object`);
			}

			// Validate model entries
			for (const [model, capabilities] of Object.entries(models)) {
				if (!capabilities || typeof capabilities !== 'object') {
					throw new Error(`Invalid capabilities for model ${provider}/${model}: must be an object`);
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
						throw new Error(
							`Invalid capabilities for model ${provider}/${model}: missing required property ${prop}`,
						);
					}
				}
			}
		}
	}

	/**
	 * Refreshes capabilities from server if needed (future implementation)
	 */
	public async refreshCapabilities(): Promise<void> {
		// TODO: In the future, implement fetching updated capabilities from BB server
		// For now, we'll just use the built-in capabilities
	}

	/**
	 * Gets all available models and their capabilities
	 *
	 * @returns Array of models with their capabilities
	 */
	public getAllModels(): Array<{ modelId: string; provider: string; capabilities: ModelCapabilities }> {
		if (!this.initialized) {
			logger.warn('ModelCapabilitiesManager: Accessing before initialization, using defaults');
			return [];
		}

		// Loop through all providers and models
		const allModels: Array<{ modelId: string; provider: string; capabilities: ModelCapabilities }> = [];

		// Get all models from LLMModelToProvider mapping
		for (const [modelId, provider] of Object.entries(LLMModelToProvider)) {
			const capabilities = this.getModelCapabilities(provider, modelId);
			allModels.push({ modelId, provider, capabilities });
		}

		return allModels;
	}

	/**
	 * Gets capabilities for a specific model, with optional provider override
	 *
	 * @param model The model identifier
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns Model capabilities object, or default capabilities if not found
	 */
	public getModelCapabilities(model: string, provider?: string): ModelCapabilities {
		if (!this.initialized) {
			logger.warn('ModelCapabilitiesManager: Accessing before initialization, using defaults');
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		// Determine provider from model if not provided
		const effectiveProvider = provider || LLMModelToProvider[model];
		if (!effectiveProvider) {
			logger.warn(`ModelCapabilitiesManager: No provider found for model ${model}, using defaults`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		// Check cache first
		const cacheKey = `${effectiveProvider}:${model}`;
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		// Try to get from loaded capabilities
		const providerCaps = this.capabilities[effectiveProvider];
		if (!providerCaps) {
			logger.warn(`ModelCapabilitiesManager: No capabilities found for provider ${effectiveProvider}`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		const modelCaps = providerCaps[model];
		if (!modelCaps) {
			logger.warn(`ModelCapabilitiesManager: No capabilities found for model ${effectiveProvider}/${model}`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		// Cache and return
		this.cache.set(cacheKey, modelCaps);
		return modelCaps;
	}

	/**
	 * Checks if a model supports a specific feature
	 *
	 * @param model The model identifier
	 * @param feature The feature to check
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns True if the feature is supported, false otherwise
	 */
	public supportsFeature(
		model: string,
		feature: keyof ModelCapabilities['supportedFeatures'],
		provider?: string,
	): boolean {
		const capabilities = this.getModelCapabilities(model, provider);
		return !!(capabilities.supportedFeatures && capabilities.supportedFeatures[feature]);
	}

	/**
	 * Resolves a parameter value based on priority:
	 * 1. Explicit value in the request
	 * 2. User configured preference
	 * 3. Interaction-specific preference
	 * 4. Model default capability
	 * 5. Global fallback default
	 *
	 * @param paramName The parameter name to resolve
	 * @param model The model identifier
	 * @param explicitValue The explicit value from the request
	 * @param userPreference The user-configured preference
	 * @param interactionPreference The interaction-specific preference
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns The resolved parameter value
	 */
	public resolveParameter<T>(
		paramName: keyof ModelCapabilities['defaults'],
		model: string,
		explicitValue?: T,
		userPreference?: T,
		interactionPreference?: T,
		provider?: string,
	): T {
		// If explicitly provided, use that value
		if (explicitValue !== undefined) {
			return this.validateParameterValue(paramName, model, explicitValue, provider);
		}

		// If user has configured a preference, use that
		if (userPreference !== undefined) {
			return this.validateParameterValue(paramName, model, userPreference, provider);
		}

		// If interaction has a specific preference, use that
		if (interactionPreference !== undefined) {
			return this.validateParameterValue(paramName, model, interactionPreference, provider);
		}

		// Otherwise use the model's default value
		const capabilities = this.getModelCapabilities(model, provider);
		const defaultValue = capabilities.defaults[paramName as keyof ModelCapabilities['defaults']];

		return defaultValue as unknown as T;
	}

	/**
	 * Resolves the temperature parameter with validation
	 *
	 * @param model The model identifier
	 * @param explicitValue The explicit temperature from the request
	 * @param userPreference The user-configured temperature preference
	 * @param interactionPreference The interaction-specific temperature preference
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns The resolved temperature value
	 */
	public resolveTemperature(
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
		provider?: string,
	): number {
		const temperature = this.resolveParameter<number>(
			'temperature',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
			provider,
		);

		// Validate against model constraints
		const capabilities = this.getModelCapabilities(model, provider);
		const { min, max } = capabilities.constraints.temperature;
		return Math.max(min, Math.min(max, temperature));
	}

	/**
	 * Resolves the maxTokens parameter with validation
	 *
	 * @param model The model identifier
	 * @param explicitValue The explicit maxTokens from the request
	 * @param userPreference The user-configured maxTokens preference
	 * @param interactionPreference The interaction-specific maxTokens preference
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns The resolved maxTokens value
	 */
	public resolveMaxTokens(
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
		provider?: string,
	): number {
		const requestedTokens = this.resolveParameter<number>(
			'maxTokens',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
			provider,
		);

		// Ensure tokens don't exceed the model's maximum
		const capabilities = this.getModelCapabilities(model, provider);
		return Math.min(requestedTokens, capabilities.maxOutputTokens);
	}

	/**
	 * Resolves the extendedThinking parameter with validation
	 *
	 * @param model The model identifier
	 * @param explicitValue The explicit extendedThinking from the request
	 * @param userPreference The user-configured extendedThinking preference
	 * @param interactionPreference The interaction-specific extendedThinking preference
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns The resolved extendedThinking value
	 */
	public resolveExtendedThinking(
		model: string,
		explicitValue?: boolean,
		userPreference?: boolean,
		interactionPreference?: boolean,
		provider?: string,
	): boolean {
		const wantsExtendedThinking = this.resolveParameter<boolean | undefined>(
			'extendedThinking',
			model,
			explicitValue,
			userPreference,
			interactionPreference,
			provider,
		);

		// Ensure tokens don't exceed the model's maximum
		const capabilities = this.getModelCapabilities(model, provider);
		return wantsExtendedThinking ?? capabilities.supportedFeatures.extendedThinking ?? false;
	}

	/**
	 * Validates and normalizes parameter values based on model constraints
	 *
	 * @param parameter The parameter name
	 * @param model The model identifier
	 * @param value The parameter value to validate
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns The validated parameter value
	 */
	private validateParameterValue<T>(
		parameter: keyof ModelCapabilities['defaults'],
		model: string,
		value: T,
		provider?: string,
	): T {
		const capabilities = this.getModelCapabilities(model, provider);

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

	/**
	 * Gets appropriate interaction preferences for a model
	 *
	 * @param interactionType The type of interaction
	 * @param model The model identifier
	 * @param provider Optional LLM provider (if not provided, determined from LLMModelToProvider)
	 * @returns Appropriate interaction preferences for the model
	 */
	public getInteractionPreferences(
		interactionType: string,
		model: string,
		provider?: string,
	): InteractionPreferences {
		const capabilities = this.getModelCapabilities(model, provider);
		const responseSpeed = capabilities.responseSpeed || 'medium';

		// Base preferences depending on interaction type
		switch (interactionType) {
			case 'chat':
				return {
					temperature: 0.7, // More creative for chat
					maxTokens: Math.min(4096, capabilities.maxOutputTokens), // Limited for chat
					extendedThinking: false,
				};

			case 'conversation':
				// Adjust based on model's response speed
				if (responseSpeed === 'fast') {
					return {
						temperature: 0.2, // More precise
						maxTokens: Math.min(4096, capabilities.maxOutputTokens),
						extendedThinking: false,
					};
				} else {
					return {
						temperature: 0.2, // More precise
						maxTokens: Math.min(16384, capabilities.maxOutputTokens), // Higher for detailed conversation
						extendedThinking: true,
					};
				}

			default:
				// Default preferences for unknown interaction types
				return {
					temperature: capabilities.defaults.temperature,
					maxTokens: capabilities.defaults.maxTokens,
					extendedThinking: capabilities.supportedFeatures.extendedThinking,
				};
		}
	}
}

/**
 * Helper function to get user model preferences from config
 *
 * @param provider The LLM provider
 * @param projectConfig The project configuration
 * @returns User model preferences or undefined if not found
 */
export function getUserModelPreferences(
	provider: LLMProvider,
	projectConfig: ProjectConfig, // Using any because the exact config structure may vary
): UserModelPreferences | undefined {
	try {
		return projectConfig?.api?.llmProviders?.[provider]?.userPreferences;
	} catch (error) {
		logger.warn(`Error getting user model preferences: ${isError(error) ? error.message : error}`);
		return undefined;
	}
}
