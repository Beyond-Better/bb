/**
 * Types for the searchWeb LLM tool
 *
 * Provides web search capabilities using the Brave Search API
 * through either user-provided API keys or the proxied ACS service.
 */

import type { BraveSearchRequest, BraveSearchResponse, BraveSearchResultType } from 'shared/braveApi.ts';

// =============================================================================
// Tool Configuration Types
// =============================================================================

export interface ApiProviderConfig {
	apiKey?: string; // User's API key (optional)
	enabled?: boolean; // Whether this provider is enabled
}

export interface SearchWebToolConfig {
	apiProviders?: {
		brave?: ApiProviderConfig;
	};
	proxyUrl?: string; // URL for proxied API service
	defaultProvider?: string; // Default provider to use
}

// =============================================================================
// Tool Input Types
// =============================================================================

export interface LLMToolSearchWebInput {
	query: string; // Search query (required)
	count?: number; // Number of results (1-20)
	country?: string; // Search country (2-char code)
	safesearch?: 'off' | 'moderate' | 'strict'; // Content filtering
	result_filter?: string; // Comma-separated result types
	freshness?: string; // Time filter
	search_lang?: string; // Search language
	ui_lang?: string; // UI language
	extra_snippets?: boolean; // Additional excerpts (premium)
}

// =============================================================================
// Tool Result Types
// =============================================================================

export interface LLMToolSearchWebResponseData {
	data: LLMToolSearchWebResultData;
}

export interface SearchResult {
	title: string;
	url: string;
	description?: string;
	type: BraveSearchResultType;
	metadata?: {
		source?: string; // For news results
		age?: string; // Content age
		thumbnail?: string; // Thumbnail URL
		rating?: number; // For locations
		coordinates?: number[]; // For locations [lat, lng]
		forum_name?: string; // For discussions
		breaking?: boolean; // For breaking news
	};
}

export interface SearchSummary {
	query: {
		original: string;
		corrected?: string; // If query was spell-corrected
		isNavigational?: boolean; // If query seeks a specific site
		isLocal?: boolean; // If query has local intent
	};
	totalResults: number;
	topResults?: SearchResult[];
	resultTypes: string[]; // Types of results found
	searchTime?: number; // Time taken in milliseconds
	provider: string; // Which provider was used
	costMicroUsd?: number; // Cost of the search (if tracked)
}

export interface LLMToolSearchWebResultData {
	results: SearchResult[]; // Processed search results
	summary: SearchSummary; // Search summary and metadata
	rawResponse?: BraveSearchResponse; // Full API response (optional)
	provider: {
		name: string; // Provider name ('brave')
		source: 'user_key' | 'proxy'; // How request was made
		requestId?: string; // Provider's request ID
	};
}

// =============================================================================
// Internal Processing Types
// =============================================================================

export interface SearchRequestContext {
	originalInput: LLMToolSearchWebInput;
	braveRequest: BraveSearchRequest;
	provider: {
		name: string;
		config: ApiProviderConfig;
		source: 'user_key' | 'proxy';
	};
	startTime: number;
	userId: string;
	requestId?: string;
}

export interface SearchResponseContext {
	request: SearchRequestContext;
	braveResponse: BraveSearchResponse;
	processedResults: SearchResult[];
	summary: SearchSummary;
	endTime: number;
	costMicroUsd?: number;
	requestId?: string;
}

// =============================================================================
// Error Types
// =============================================================================

export interface SearchWebError {
	type: 'validation' | 'api' | 'network' | 'quota' | 'configuration';
	message: string;
	details?: {
		provider?: string;
		statusCode?: number;
		retryable?: boolean;
		suggestedAction?: string;
	};
}

// =============================================================================
// Utility Types
// =============================================================================

export type ResultFilterType =
	| 'web'
	| 'news'
	| 'videos'
	| 'locations'
	| 'discussions'
	| 'faq'
	| 'infobox'
	| 'summarizer';

export const VALID_RESULT_FILTERS: ResultFilterType[] = [
	'web',
	'news',
	'videos',
	'locations',
	'discussions',
	'faq',
	'infobox',
	'summarizer',
];

export const DEFAULT_PROXY_URL = 'https://api.beyondbetter.app/api/v1/api-proxy';

// =============================================================================
// Type Guards and Validation
// =============================================================================

export function isValidResultFilter(filter: string): filter is ResultFilterType {
	return VALID_RESULT_FILTERS.includes(filter as ResultFilterType);
}

export function validateResultFilters(filterString?: string): {
	isValid: boolean;
	validFilters: ResultFilterType[];
	invalidFilters: string[];
	sanitizedString?: string;
} {
	if (!filterString) {
		return {
			isValid: true,
			validFilters: [],
			invalidFilters: [],
		};
	}

	const filters = filterString.split(',').map((f) => f.trim());
	const validFilters: ResultFilterType[] = [];
	const invalidFilters: string[] = [];

	filters.forEach((filter) => {
		if (isValidResultFilter(filter)) {
			validFilters.push(filter);
		} else {
			invalidFilters.push(filter);
		}
	});

	return {
		isValid: invalidFilters.length === 0,
		validFilters,
		invalidFilters,
		sanitizedString: validFilters.length > 0 ? validFilters.join(',') : undefined,
	};
}
