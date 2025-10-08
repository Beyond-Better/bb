export interface DefaultModels {
	orchestrator: string;
	agent: string;
	chat: string;
}

export interface DefaultModelsPartial {
	orchestrator?: string;
	agent?: string;
	chat?: string;
}

export const DefaultModelsConfigDefaults: Readonly<DefaultModels> = {
	orchestrator: 'claude-sonnet-4-5-20250929',
	agent: 'claude-sonnet-4-5-20250929',
	chat: 'claude-3-5-haiku-20241022',
};

/**
 * IMPORTANT: Token type synchronization across three locations
 *
 * When adding new token types, you MUST update all three places:
 * 1. [bb-sass] abi/supabase/migrations/20250604220505_create_llm_tables.sql (abi_llm.token_type ENUM)
 * 2. [bb-sass] abi/supabase/functions/_shared/types/providers.ts (TokenTypeEnum below)
 * 3. [bb] src/shared/types/models.types.ts (TokenTypeEnum)
 *
 * Failure to keep these in sync will cause runtime errors.
 */

/**
 * Token types for LLM pricing - dynamic string type supporting tiered pricing
 *
 * The tiered pricing system generates dynamic token types based on:
 * - Base types: 'input', 'output', 'thought'
 * - Tier suffixes: '_tier0', '_tier1', '_tier2', etc.
 * - Cache prefixes: 'cache_read', 'cache_write_time1', etc.
 * - Content types: 'audio', 'image', 'video', etc.
 *
 * Examples: 'input_tier1', 'cache_read_tier0', 'output_image_tier1', 'thought'
 *
 * @see abi/supabase/migrations/20250813120000_create_pricing_validation_functions.sql
 */
export type TokenTypeEnum = string; // Dynamic token type strings

/**
 * Dynamic token pricing structure
 * Maps token types to their cost per million tokens in USD dollars
 */
export type TokenPricing = Record<TokenTypeEnum, number>;

/**
 * Partial token pricing structure for API payloads
 * Allows subset of token types to be provided
 */
export type PartialTokenPricing = Partial<Record<TokenTypeEnum, number>>;
