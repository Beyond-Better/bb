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
	orchestrator: 'claude-sonnet-4-20250514',
	agent: 'claude-sonnet-4-20250514',
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
 * Token types for LLM pricing - must match abi_llm.token_type ENUM in database
 *
 * @see abi/supabase/migrations/20250604220505_create_llm_tables.sql
 */
export type TokenTypeEnum =
	// Universal types (all providers)
	| 'input'
	| 'output'
	| 'cache_read'
	// Anthropic-specific
	| 'anthropic_cache_read'
	| 'anthropic_cache_write_5min'
	| 'anthropic_cache_write_60min'
	// OpenAI-specific
	| 'openai_batch_input'
	| 'openai_batch_output'
	| 'openai_reasoning'
	// Other providers
	| 'cohere_rerank'
	| 'perplexity_search';

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
