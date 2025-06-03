/**
 * ModelCapabilitiesManager
 *
 * DEPRECATED: This class is being replaced by ModelRegistryService
 * Kept for backwards compatibility during transition
 *
 * This is now a wrapper around ModelRegistryService to maintain API compatibility
 */

import type { LLMProvider } from 'api/types.ts';
import type {
	InteractionPreferences,
	ModelCapabilities,
	ModelInfo,
	UserModelPreferences,
} from 'api/types/modelCapabilities.types.ts';
import { logger } from 'shared/logger.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

/**
 * @deprecated Use ModelRegistryService instead
 * Manages access to model capabilities and parameter resolution
 */
export class ModelCapabilitiesManager {
	private static instance: ModelCapabilitiesManager;
	private registryService?: ModelRegistryService;
	private initialized = false;

	/**
	 * Private constructor for singleton pattern
	 */
	private constructor() {}

	/**
	 * Get the singleton instance
	 * @deprecated Use ModelRegistryService.getInstance() instead
	 */
	public static async getInstance(projectConfig?: ProjectConfig): Promise<ModelCapabilitiesManager> {
		if (!ModelCapabilitiesManager.instance) {
			ModelCapabilitiesManager.instance = new ModelCapabilitiesManager();
			await ModelCapabilitiesManager.instance.init(projectConfig);
		}
		return ModelCapabilitiesManager.instance;
	}

	/**
	 * Initialize the manager by delegating to ModelRegistryService
	 */
	public async init(projectConfig?: ProjectConfig): Promise<ModelCapabilitiesManager> {
		if (this.initialized) return this;

		try {
			this.registryService = await ModelRegistryService.getInstance(projectConfig);
			this.initialized = true;
			logger.info('ModelCapabilitiesManager: Initialized (delegating to ModelRegistryService)');
			return this;
		} catch (error) {
			logger.error(
				`ModelCapabilitiesManager: Failed to initialize: ${error instanceof Error ? error.message : error}`,
			);
			throw error;
		}
	}

	/**
	 * @deprecated Use ModelRegistryService.refreshDynamicModels() instead
	 */
	public async refreshCapabilities(): Promise<void> {
		if (this.registryService) {
			await this.registryService.refreshDynamicModels();
		}
	}

	/**
	 * Gets all available models and their capabilities
	 * @deprecated Use ModelRegistryService.getAllModels() instead
	 */
	public getAllModels(): Array<{ modelId: string; provider: string; capabilities: ModelCapabilities }> {
		if (!this.registryService) {
			logger.warn('ModelCapabilitiesManager: Not initialized, returning empty array');
			return [];
		}

		return this.registryService.getAllModels().map((model: ModelInfo) => ({
			modelId: model.id,
			provider: model.provider,
			capabilities: model.capabilities,
		}));
	}

	/**
	 * Gets capabilities for a specific model
	 * @deprecated Use ModelRegistryService.getModelCapabilities() instead
	 */
	public getModelCapabilities(model: string, provider?: string): ModelCapabilities {
		if (!this.registryService) {
			logger.warn('ModelCapabilitiesManager: Not initialized, using defaults');
			// Return a basic default
			return {
				displayName: 'Unknown Model',
				contextWindow: 4096,
				maxOutputTokens: 2048,
				pricing: {
					inputTokens: { basePrice: 0.0 },
					outputTokens: { basePrice: 0.0 },
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
					maxTokens: 2048,
					extendedThinking: false,
				},
				constraints: {
					temperature: { min: 0.0, max: 1.0 },
				},
				systemPromptBehavior: 'optional',
				responseSpeed: 'medium',
			};
		}

		return this.registryService.getModelCapabilities(model);
	}

	/**
	 * Checks if a model supports a specific feature
	 * @deprecated Use ModelRegistryService.supportsFeature() instead
	 */
	public supportsFeature(
		model: string,
		feature: keyof ModelCapabilities['supportedFeatures'],
		provider?: string,
	): boolean {
		if (!this.registryService) {
			return false;
		}

		return this.registryService.supportsFeature(model, feature);
	}

	/**
	 * Resolves a parameter value based on priority
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
 */
export function getUserModelPreferences(
	provider: LLMProvider,
	projectConfig: ProjectConfig,
): UserModelPreferences | undefined {
	try {
		return projectConfig?.api?.llmProviders?.[provider]?.userPreferences;
	} catch (error) {
		logger.warn(`Error getting user model preferences: ${error instanceof Error ? error.message : error}`);
		return undefined;
	}
}
