/**
 * Tiered Pricing Utilities
 *
 * Generic utilities for handling tiered token pricing across all providers.
 * Supports unlimited pricing tiers, content types, cache types, and reasoning tokens.
 */

// Core interfaces
export interface TierConfig {
	tier: number;
	name: string;
	threshold: { min: number; max: number | null };
	price: number;
}

export interface ExplicitPricingTier {
	tier: number;
	price: number;
}

export interface CacheTypeConfig {
	description: string;
	inheritsTiers: boolean;
	multiplier: number;
	explicitPricing?: {
		tiers: ExplicitPricingTier[];
	};
}

export interface ContentTypeConfig {
	multiplier: number;
	explicitPricing?: {
		tiers: ExplicitPricingTier[];
	};
}

export interface TieredPricingConfig {
	tiers?: TierConfig[];
	tierDeterminedBy?: 'totalInputTokens' | 'inputTokens' | 'totalTokens';
	basePrice?: number;
	cacheTypes?: Record<string, CacheTypeConfig>;
	contentTypes?: Record<string, ContentTypeConfig>;
}

export interface TierResult {
	tier: number;
	name: string;
	thresholdValue: number;
	price: number;
}

export interface GenericTokenUsage {
	input: number;
	output: number;
	thought?: number;
	cache_read?: number;
	cache_write_time1?: number;
	cache_write_time2?: number;
	cache_write_time3?: number;
}

export interface TokenTypeComponents {
	baseType: 'input' | 'output' | 'thought';
	tier?: number;
	contentType?: 'text' | 'audio' | 'image' | 'video';
	cacheType?: 'read' | 'write_time1' | 'write_time2' | 'write_time3';
}

/**
 * Generate a token type key from components
 *
 * Examples:
 * - { baseType: 'input', tier: 1 } -> 'input_tier1'
 * - { baseType: 'input', cacheType: 'read', tier: 0 } -> 'cache_read_tier0'
 * - { baseType: 'output', contentType: 'image', tier: 2 } -> 'output_image_tier2'
 */
export function generateTokenType(components: TokenTypeComponents): string {
	const parts: string[] = [];

	// Start with cache type if present, otherwise base type
	if (components.cacheType) {
		parts.push(`cache_${components.cacheType}`);
	} else {
		parts.push(components.baseType);
	}

	if (components.contentType && components.contentType !== 'text') {
		parts.push(components.contentType);
	}

	if (components.tier !== undefined) {
		parts.push(`tier${components.tier}`);
	}

	return parts.join('_');
}

/**
 * Determine which pricing tier applies based on token usage
 *
 * @param config Tiered pricing configuration
 * @param tokenUsage Token usage across all types
 * @returns Tier information or null if no tiered pricing
 */
export function determineTier(
	config: TieredPricingConfig,
	tokenUsage: GenericTokenUsage,
): TierResult | null {
	if (!config.tiers || !config.tierDeterminedBy) {
		return null; // No tiered pricing
	}

	const determinantValue = calculateDeterminantValue(config.tierDeterminedBy, tokenUsage);

	const tier = config.tiers.find((t) =>
		determinantValue >= t.threshold.min &&
		(t.threshold.max === null || determinantValue < t.threshold.max)
	) || config.tiers[config.tiers.length - 1]; // fallback to highest tier

	return {
		tier: tier.tier,
		name: tier.name,
		thresholdValue: determinantValue,
		price: tier.price,
	};
}

/**
 * Calculate the determinant value for tier determination
 */
function calculateDeterminantValue(
	tierDeterminedBy: string,
	tokenUsage: GenericTokenUsage,
): number {
	switch (tierDeterminedBy) {
		case 'totalInputTokens':
			return (tokenUsage.input || 0) +
				(tokenUsage.cache_read || 0) +
				(tokenUsage.cache_write_time1 || 0) +
				(tokenUsage.cache_write_time2 || 0) +
				(tokenUsage.cache_write_time3 || 0);
		case 'inputTokens':
			return tokenUsage.input || 0;
		case 'totalTokens':
			return Object.values(tokenUsage).reduce((sum, count) => sum + (count || 0), 0);
		default:
			return tokenUsage.input || 0;
	}
}

/**
 * Resolve pricing for a token type considering explicit pricing and multipliers
 *
 * @param basePrice Base tier price (from tier config)
 * @param tier Tier number
 * @param cacheConfig Cache type configuration (if applicable)
 * @param contentConfig Content type configuration (if applicable)
 * @returns Final price in cents
 */
export function resolvePricing(
	basePrice: number,
	tier: number,
	cacheConfig?: CacheTypeConfig,
	contentConfig?: ContentTypeConfig,
): number {
	let price = basePrice;

	// Apply content type pricing (explicit first, then multiplier)
	if (contentConfig) {
		const explicitContentPrice = contentConfig.explicitPricing?.tiers.find((t) => t.tier === tier);
		if (explicitContentPrice) {
			price = explicitContentPrice.price;
		} else {
			price = basePrice * contentConfig.multiplier;
		}
	}

	// Apply cache type pricing (explicit first, then multiplier)
	if (cacheConfig) {
		const explicitCachePrice = cacheConfig.explicitPricing?.tiers.find((t) => t.tier === tier);
		if (explicitCachePrice) {
			return explicitCachePrice.price;
		} else {
			return price * cacheConfig.multiplier;
		}
	}

	return price;
}
