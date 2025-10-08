/**
 * Frontend types for pricing and tiered pricing functionality
 * These types are adapted from the backend tiered pricing utils for UI use
 */

export interface PricingTier {
	tier: number;
	name: string;
	threshold: { min: number; max: number | null };
	// Note: Actual pricing must be loaded from backend edge function, not from JSON
	price?: number; // Placeholder for future backend-loaded pricing (cents per million tokens)
}

export interface TieredPricingConfig {
	tiers: PricingTier[];
	tierDeterminedBy: 'totalInputTokens' | 'inputTokens' | 'totalTokens';
}

export interface ModelPricingInfo {
	// IMPORTANT: All pricing values below are RAW model registry data
	// Actual user pricing must be loaded from backend edge functions

	// Basic token pricing (flat rate models) - RAW DATA ONLY
	token_pricing?: {
		input: number; // Raw price - NOT user pricing
		output: number; // Raw price - NOT user pricing
	};

	// Tiered pricing configurations - Token thresholds are valid, prices are RAW
	inputTokensTieredConfig?: TieredPricingConfig;
	outputTokensTieredConfig?: TieredPricingConfig;

	// Cache pricing (for prompt caching enabled models) - RAW DATA ONLY
	inputTokensCacheTypes?: Record<string, {
		description: string;
		inheritsTiers: boolean;
		multiplier: number; // Raw multiplier - NOT user pricing
		explicitPricing?: {
			tiers: Array<{ tier: number; price: number }>; // Raw prices - NOT user pricing
		};
	}>;

	// Content type pricing (for multimodal models) - RAW DATA ONLY
	inputTokensContentTypes?: Record<string, {
		multiplier: number; // Raw multiplier - NOT user pricing
		explicitPricing?: {
			tiers: Array<{ tier: number; price: number }>; // Raw prices - NOT user pricing
		};
	}>;

	// Pricing metadata
	pricing_metadata?: {
		currency: string;
		effectiveDate: string;
	};
}

/**
 * Calculate current pricing tier for given token usage
 */
export function calculateCurrentTier(
	config: TieredPricingConfig,
	usedTokens: number,
): PricingTier | null {
	if (!config.tiers) return null;

	return config.tiers.find((tier) =>
		usedTokens >= tier.threshold.min &&
		(tier.threshold.max === null || usedTokens < tier.threshold.max)
	) || config.tiers[config.tiers.length - 1];
}

/**
 * Format price for display (convert cents to dollars)
 */
export function formatPrice(priceInCents: number): string {
	const dollars = priceInCents / 100;
	if (dollars >= 1) {
		return `$${dollars.toFixed(2)}`;
	} else {
		return `${priceInCents}¢`;
	}
}

/**
 * Format token count with appropriate units
 */
export function formatTokenCount(tokens: number): string {
	if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
	if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
	return tokens.toString();
}
