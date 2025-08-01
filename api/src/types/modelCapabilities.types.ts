/**
 * Types for model capabilities management
 * Defines interfaces for storing and accessing model-specific capabilities and settings
 */
import type { LLMProvider } from 'api/types.ts';
import type { PartialTokenPricing } from 'shared/types/models.ts';

/**
 * Model information interface for registry entries
 */
export interface ModelInfo {
	id: string;
	displayName: string;
	provider: LLMProvider;
	capabilities: ModelCapabilities;
	source: 'static' | 'dynamic'; // Whether from JSON or discovered at runtime
	hidden?: boolean; // Whether the model should be hidden from users (e.g., not available in bb-sass)
	localOnly?: boolean; // Whether the model should only be available when localMode is enabled
}

/**
 * Interface for model capabilities including context limits, pricing, and feature support
 */
export interface ModelCapabilities {
	displayName: string;
	// Context window and token limits
	contextWindow: number; // Total context window size (input + output)
	maxInputTokens?: number; // Max tokens for input (if different from context window)
	maxOutputTokens: number; // Max tokens for generation/completion

	// Pricing
	token_pricing?: PartialTokenPricing; // New dynamic pricing structure
	pricing_metadata?: {
		currency: string; // Currency for prices (default USD)
		effectiveDate: string; // Date these prices were effective from
		finetuningAvailable?: boolean; // Whether finetuning is available
		finetuningCost?: { // Finetuning costs if available
			trainingPerToken: number;
			inferencePerToken: number;
		};
		billingTier?: string; // Any special billing tier info
	};
	// Legacy pricing structure for backward compatibility
	pricing?: {
		inputTokens: {
			basePrice: number; // Cost per input token
			cachedPrice?: number; // Cost for cached tokens (if different)
			bulkDiscounts?: Array<{ // Any volume-based discounts
				threshold: number; // Tokens per month threshold
				price: number; // Discounted price per token
			}>;
		};
		outputTokens: {
			basePrice: number; // Cost per output token
			bulkDiscounts?: Array<{ // Any volume-based discounts
				threshold: number; // Tokens per month threshold
				price: number; // Discounted price per token
			}>;
		};
		finetuningAvailable?: boolean; // Whether finetuning is available
		finetuningCost?: { // Finetuning costs if available
			trainingPerToken: number;
			inferencePerToken: number;
		};
		billingTier?: string; // Any special billing tier info
		currency: string; // Currency for prices (default USD)
		effectiveDate: string; // Date these prices were effective from
	};

	// Feature support
	supportedFeatures: {
		functionCalling: boolean;
		json: boolean;
		streaming: boolean;
		vision: boolean;
		extendedThinking?: boolean; // For models that support separate thinking steps
		promptCaching?: boolean; // For models that support separate thinking steps
		multimodal?: boolean; // For models supporting multiple modalities
	};

	// Default parameters
	defaults: {
		temperature: number;
		topP?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		maxTokens: number; // Default max tokens for generation
		extendedThinking?: boolean;
		responseFormat?: string;
	};

	// Parameter constraints
	constraints: {
		temperature: { min: number; max: number };
		topP?: { min: number; max: number };
		frequencyPenalty?: { min: number; max: number };
		presencePenalty?: { min: number; max: number };
	};

	// System prompt handling
	systemPromptBehavior: 'required' | 'optional' | 'notSupported' | 'fixed';

	// Feature access control
	featureKey?: string; // Hierarchical feature key for access control (e.g., 'models.claude.sonnet')

	// Metadata
	trainingCutoff?: string; // When the model's training data ends
	releaseDate?: string; // When the model was released
	deprecated?: boolean; // Whether the model is deprecated
	responseSpeed?: 'fast' | 'medium' | 'slow'; // Relative speed for planning
	cost?: 'low' | 'medium' | 'high' | 'very-high'; // Relative cost based on pricing
	intelligence?: 'medium' | 'high' | 'very-high'; // Relative intelligence/capability level
}

/**
 * Interaction-specific parameter preferences
 * Different interaction types may have different optimal settings
 */
export interface InteractionPreferences {
	maxTokens?: number;
	temperature?: number;
	extendedThinking?: boolean;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
}

/**
 * User-configurable model preferences
 * These override the default model settings but can be overridden by explicit request values
 */
export interface UserModelPreferences {
	temperature?: number;
	maxTokens?: number;
	extendedThinking?: boolean;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	responseFormat?: string;
}
