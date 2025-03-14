/**
 * ModelCapabilitiesManager
 *
 * Manages model capabilities and parameter resolution for LLMs
 * Handles loading, caching, and resolving model-specific capabilities and parameters
 */

//import { join } from '@std/path';
import type { LLMProvider } from 'api/types.ts';
import type {
	InteractionPreferences,
	ModelCapabilities,
	UserModelPreferences,
} from 'api/types/modelCapabilities.ts';
import { logger } from 'shared/logger.ts';
import { isError } from 'api/errors/error.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';

// Import the built-in capabilities data
import builtinCapabilities from '../data/modelCapabilities.json' with { type: 'json' };

// URL to fetch updates from BB server (future implementation)
// const CAPABILITIES_URL = 'https://api.beyondbetter.dev/modelCapabilities';
// const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Default capabilities for fallback
const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
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
	},
	defaults: {
		temperature: 0.7,
		maxTokens: 4096,
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
	 * Gets capabilities for a specific provider/model combination
	 *
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @returns Model capabilities object, or default capabilities if not found
	 */
	public getModelCapabilities(provider: string, model: string): ModelCapabilities {
		if (!this.initialized) {
			logger.warn('ModelCapabilitiesManager: Accessing before initialization, using defaults');
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		// Check cache first
		const cacheKey = `${provider}:${model}`;
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		// Try to get from loaded capabilities
		const providerCaps = this.capabilities[provider];
		if (!providerCaps) {
			logger.warn(`ModelCapabilitiesManager: No capabilities found for provider ${provider}`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		const modelCaps = providerCaps[model];
		if (!modelCaps) {
			logger.warn(`ModelCapabilitiesManager: No capabilities found for model ${provider}/${model}`);
			return { ...DEFAULT_MODEL_CAPABILITIES };
		}

		// Cache and return
		this.cache.set(cacheKey, modelCaps);
		return modelCaps;
	}

	/**
	 * Checks if a model supports a specific feature
	 *
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @param feature The feature to check
	 * @returns True if the feature is supported, false otherwise
	 */
	public supportsFeature(
		provider: string,
		model: string,
		feature: keyof ModelCapabilities['supportedFeatures'],
	): boolean {
		const capabilities = this.getModelCapabilities(provider, model);
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
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @param explicitValue The explicit value from the request
	 * @param userPreference The user-configured preference
	 * @param interactionPreference The interaction-specific preference
	 * @returns The resolved parameter value
	 */
	public resolveParameter<T>(
		paramName: keyof ModelCapabilities['defaults'],
		provider: string,
		model: string,
		explicitValue?: T,
		userPreference?: T,
		interactionPreference?: T,
	): T {
		// If explicitly provided, use that value
		if (explicitValue !== undefined) {
			return this.validateParameterValue(paramName, provider, model, explicitValue);
		}

		// If user has configured a preference, use that
		if (userPreference !== undefined) {
			return this.validateParameterValue(paramName, provider, model, userPreference);
		}

		// If interaction has a specific preference, use that
		if (interactionPreference !== undefined) {
			return this.validateParameterValue(paramName, provider, model, interactionPreference);
		}

		// Otherwise use the model's default value
		const capabilities = this.getModelCapabilities(provider, model);
		const defaultValue = capabilities.defaults[paramName as keyof ModelCapabilities['defaults']];

		return defaultValue as unknown as T;
	}

	/**
	 * Resolves the temperature parameter with validation
	 *
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @param explicitValue The explicit temperature from the request
	 * @param userPreference The user-configured temperature preference
	 * @param interactionPreference The interaction-specific temperature preference
	 * @returns The resolved temperature value
	 */
	public resolveTemperature(
		provider: string,
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
	): number {
		const temperature = this.resolveParameter<number>(
			'temperature',
			provider,
			model,
			explicitValue,
			userPreference,
			interactionPreference,
		);

		// Validate against model constraints
		const capabilities = this.getModelCapabilities(provider, model);
		const { min, max } = capabilities.constraints.temperature;
		return Math.max(min, Math.min(max, temperature));
	}

	/**
	 * Resolves the maxTokens parameter with validation
	 *
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @param explicitValue The explicit maxTokens from the request
	 * @param userPreference The user-configured maxTokens preference
	 * @param interactionPreference The interaction-specific maxTokens preference
	 * @returns The resolved maxTokens value
	 */
	public resolveMaxTokens(
		provider: string,
		model: string,
		explicitValue?: number,
		userPreference?: number,
		interactionPreference?: number,
	): number {
		const requestedTokens = this.resolveParameter<number>(
			'maxTokens',
			provider,
			model,
			explicitValue,
			userPreference,
			interactionPreference,
		);

		// Ensure tokens don't exceed the model's maximum
		const capabilities = this.getModelCapabilities(provider, model);
		return Math.min(requestedTokens, capabilities.maxOutputTokens);
	}

	/**
	 * Validates and normalizes parameter values based on model constraints
	 *
	 * @param parameter The parameter name
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @param value The parameter value to validate
	 * @returns The validated parameter value
	 */
	private validateParameterValue<T>(
		parameter: keyof ModelCapabilities['defaults'],
		provider: string,
		model: string,
		value: T,
	): T {
		const capabilities = this.getModelCapabilities(provider, model);

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

		// For other parameters, just return as is
		return value;
	}

	/**
	 * Gets appropriate interaction preferences for a model
	 *
	 * @param interactionType The type of interaction
	 * @param provider The LLM provider
	 * @param model The model identifier
	 * @returns Appropriate interaction preferences for the model
	 */
	public getInteractionPreferences(
		interactionType: string,
		provider: string,
		model: string,
	): InteractionPreferences {
		const capabilities = this.getModelCapabilities(provider, model);
		const responseSpeed = capabilities.responseSpeed || 'medium';

		// Base preferences depending on interaction type
		switch (interactionType) {
			case 'chat':
				return {
					temperature: 0.7, // More creative for chat
					maxTokens: Math.min(4096, capabilities.maxOutputTokens), // Limited for chat
				};

			case 'conversation':
				// Adjust based on model's response speed
				if (responseSpeed === 'fast') {
					return {
						temperature: 0.2, // More precise
						maxTokens: Math.min(8192, capabilities.maxOutputTokens),
					};
				} else {
					return {
						temperature: 0.2, // More precise
						maxTokens: Math.min(16384, capabilities.maxOutputTokens), // Higher for detailed conversation
					};
				}

			default:
				// Default preferences for unknown interaction types
				return {
					temperature: capabilities.defaults.temperature,
					maxTokens: capabilities.defaults.maxTokens,
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
		return projectConfig?.settings?.api?.llmProviders?.[provider]?.userPreferences;
	} catch (error) {
		logger.warn(`Error getting user model preferences: ${isError(error) ? error.message : error}`);
		return undefined;
	}
}
