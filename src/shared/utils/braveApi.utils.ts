/**
 * Brave Search API Client
 *
 * Centralized utility for interacting with the Brave Search API.
 * Used by both the searchWeb tool and the ACS api-proxy service.
 *
 * Features:
 * - Type-safe request/response interfaces
 * - Request validation and sanitization
 * - Error handling and rate limiting awareness
 * - Support for all Brave Search API parameters
 * - Comprehensive result type definitions
 */

import { logger } from 'shared/logger.ts';

// =============================================================================
// Request Types and Interfaces
// =============================================================================

export interface BraveSearchRequest {
	q: string; // Search query (required, max 400 chars, 50 words)
	country?: string; // Search country (2-char code, default: 'US')
	search_lang?: string; // Search language (2+ char code, default: 'en')
	ui_lang?: string; // UI language (format: lang-country, default: 'en-US')
	count?: number; // Results count (1-20, default: 20)
	offset?: number; // Pagination offset (0-9, default: 0)
	safesearch?: 'off' | 'moderate' | 'strict'; // Content filtering
	freshness?: string; // Time filter (pd, pw, pm, py, or date range)
	text_decorations?: boolean; // Include highlighting (default: true)
	spellcheck?: boolean; // Enable spellcheck (default: true)
	result_filter?: string; // Comma-separated result types
	extra_snippets?: boolean; // Additional excerpts (premium feature)
	summary?: boolean; // Enable summary generation
	units?: 'metric' | 'imperial'; // Measurement units
}

export interface BraveApiOptions {
	baseUrl?: string; // API base URL (default: Brave's official)
	timeout?: number; // Request timeout in ms (default: 10000)
	retryAttempts?: number; // Number of retry attempts (default: 2)
	userAgent?: string; // Custom user agent
}

// =============================================================================
// Response Types and Interfaces
// =============================================================================

export interface BraveQuery {
	original: string; // Original query
	show_strict_warning?: boolean; // More content available but restricted
	altered?: string; // Modified query after spellcheck
	safesearch?: boolean; // Whether safesearch was enabled
	is_navigational?: boolean; // Whether query is navigational
	is_geolocal?: boolean; // Whether query has location relevance
	local_decision?: string; // Location sensitivity decision
	is_trending?: boolean; // Whether query is trending
	is_news_breaking?: boolean; // Whether query has breaking news
	ask_for_location?: boolean; // Whether query needs location for better results
	language?: {
		main: string; // Main language detected
	};
	country?: string; // Country used for search
	lat?: string; // Location latitude
	long?: string; // Location longitude
	city?: string; // Location city
	state?: string; // Location state
	more_results_available?: boolean; // Whether more results are available
}

export interface BraveMetaUrl {
	scheme: string; // Protocol scheme (http/https)
	netloc: string; // Network location
	hostname?: string; // Domain name
	favicon: string; // Favicon URL
	path: string; // URL path
}

export interface BraveThumbnail {
	src: string; // Thumbnail URL
	original?: string; // Original image URL
}

export interface BraveSearchResult {
	type: 'search_result';
	subtype: 'generic';
	title: string; // Page title
	url: string; // Page URL
	description?: string; // Page description/snippet
	is_source_local?: boolean;
	is_source_both?: boolean;
	page_age?: string; // Page age
	page_fetched?: string; // When page was fetched
	meta_url?: BraveMetaUrl; // URL metadata
	thumbnail?: BraveThumbnail; // Page thumbnail
	language?: string; // Page language
	family_friendly: boolean; // Whether content is family-friendly
	extra_snippets?: string[]; // Additional excerpts (if requested)
}

export interface BraveWebResults {
	type: 'search';
	results: BraveSearchResult[]; // Array of search results
	family_friendly: boolean; // Whether results are family-friendly
}

export interface BraveNewsResult {
	type?: string;
	title: string; // News article title
	url: string; // Article URL
	description?: string; // Article description
	meta_url?: BraveMetaUrl; // URL metadata
	source?: string; // News source
	breaking?: boolean; // Whether this is breaking news
	is_live?: boolean; // Whether this is live news
	thumbnail?: BraveThumbnail; // Article thumbnail
	age?: string; // Article age
	extra_snippets?: string[]; // Additional excerpts
}

export interface BraveNewsResults {
	type: 'news';
	results: BraveNewsResult[]; // Array of news results
}

export interface BraveVideoResult {
	type: 'video_result';
	title: string; // Video title
	url: string; // Video URL
	description?: string; // Video description
	meta_url?: BraveMetaUrl; // URL metadata
	thumbnail?: BraveThumbnail; // Video thumbnail
	age?: string; // Video age
	video?: {
		duration?: string; // Video duration
		views?: string; // View count
		creator?: string; // Video creator
		publisher?: string; // Video publisher
	};
}

export interface BraveVideoResults {
	type: 'videos';
	results: BraveVideoResult[]; // Array of video results
}

export interface BraveLocationResult {
	type: 'location_result';
	id?: string; // Temporary ID for additional info
	title: string; // Location name
	url: string; // Location URL
	description?: string; // Location description
	provider_url: string; // Provider URL
	coordinates?: number[]; // [lat, lng] coordinates
	thumbnail?: BraveThumbnail; // Location image
	postal_address?: {
		country?: string;
		postalCode?: string;
		streetAddress?: string;
		addressRegion?: string;
		addressLocality?: string;
		displayAddress: string;
	};
	contact?: {
		email?: string;
		telephone?: string;
	};
	rating?: {
		ratingValue: number;
		bestRating: number;
		reviewCount?: number;
	};
}

export interface BraveLocationResults {
	type: 'locations';
	results: BraveLocationResult[]; // Array of location results
}

export interface BraveFaqResult {
	question: string; // FAQ question
	answer: string; // FAQ answer
	title: string; // Source title
	url: string; // Source URL
	meta_url?: BraveMetaUrl; // URL metadata
}

export interface BraveFaqResults {
	type: 'faq';
	results: BraveFaqResult[]; // Array of FAQ results
}

export interface BraveDiscussionResult {
	type: 'discussion';
	title?: string;
	url?: string;
	description?: string;
	data?: {
		forum_name: string; // Forum name
		num_answers?: number; // Number of answers
		score?: string; // Post score
		title?: string; // Post title
		question?: string; // Question asked
		top_comment?: string; // Top comment
	};
}

export interface BraveDiscussionResults {
	type: 'discussions';
	results: BraveDiscussionResult[]; // Array of discussion results
}

export interface BraveInfobox {
	type: 'infobox';
	position: number; // Position on page
	label?: string; // Entity label
	category?: string; // Entity category
	long_desc?: string; // Long description
	thumbnail?: BraveThumbnail; // Entity thumbnail
	attributes?: string[][]; // Entity attributes
	website_url?: string; // Official website
}

export interface BraveGraphInfobox {
	type: 'graph';
	results: BraveInfobox; // Infobox data
}

export interface BraveSummarizer {
	type: 'summarizer';
	key: string; // Summary key for retrieval
}

export interface BraveSearchResponse {
	type: 'search'; // Response type
	query?: BraveQuery; // Query information
	web?: BraveWebResults; // Web search results
	news?: BraveNewsResults; // News results
	videos?: BraveVideoResults; // Video results
	locations?: BraveLocationResults; // Location results
	discussions?: BraveDiscussionResults; // Discussion results
	faq?: BraveFaqResults; // FAQ results
	infobox?: BraveGraphInfobox; // Infobox results
	summarizer?: BraveSummarizer; // Summary key
	mixed?: {
		type: 'mixed';
		main?: Array<{ type: string; index?: number; all?: boolean }>;
		top?: Array<{ type: string; index?: number; all?: boolean }>;
		side?: Array<{ type: string; index?: number; all?: boolean }>;
	};
}

export type BraveSearchResultType = 'web' | 'news' | 'video' | 'location' | 'discussion' | 'faq' | 'infobox';

// =============================================================================
// Error Types
// =============================================================================

export class BraveApiError extends Error {
	constructor(
		message: string,
		public statusCode?: number,
		public responseBody?: unknown,
		public requestDetails?: {
			url: string;
			method: string;
			headers?: Record<string, string>;
			body?: unknown;
		},
	) {
		super(message);
		this.name = 'BraveApiError';
	}

	override toString(): string {
		return `${this.name}: ${this.message}${this.statusCode ? ` (HTTP ${this.statusCode})` : ''}`;
	}
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates and sanitizes a Brave Search API request
 */
export function validateBraveSearchRequest(request: BraveSearchRequest): {
	isValid: boolean;
	errors: string[];
	sanitizedRequest: BraveSearchRequest;
} {
	const errors: string[] = [];
	const sanitized = { ...request };

	// Validate query
	if (!request.q || typeof request.q !== 'string') {
		errors.push('Query (q) is required and must be a string');
	} else if (request.q.trim().length === 0) {
		errors.push('Query cannot be empty');
	} else if (request.q.length > 400) {
		errors.push('Query cannot exceed 400 characters');
	} else {
		// Count words (simple split by whitespace)
		const wordCount = request.q.trim().split(/\s+/).length;
		if (wordCount > 50) {
			errors.push('Query cannot exceed 50 words');
		}
		sanitized.q = request.q.trim();
	}

	// Validate country code
	if (request.country && (typeof request.country !== 'string' || request.country.length !== 2)) {
		errors.push('Country must be a 2-character country code');
	}

	// Validate search language
	if (request.search_lang && (typeof request.search_lang !== 'string' || request.search_lang.length < 2)) {
		errors.push('Search language must be at least 2 characters');
	}

	// Validate UI language
	if (request.ui_lang && (typeof request.ui_lang !== 'string' || !request.ui_lang.match(/^[a-z]{2}(-[A-Z]{2})?$/))) {
		errors.push('UI language must be in format "en" or "en-US"');
	}

	// Validate count
	if (request.count !== undefined) {
		if (typeof request.count !== 'number' || !Number.isInteger(request.count)) {
			errors.push('Count must be an integer');
		} else if (request.count < 1 || request.count > 20) {
			errors.push('Count must be between 1 and 20');
		}
	}

	// Validate offset
	if (request.offset !== undefined) {
		if (typeof request.offset !== 'number' || !Number.isInteger(request.offset)) {
			errors.push('Offset must be an integer');
		} else if (request.offset < 0 || request.offset > 9) {
			errors.push('Offset must be between 0 and 9');
		}
	}

	// Validate safesearch
	if (request.safesearch && !['off', 'moderate', 'strict'].includes(request.safesearch)) {
		errors.push('Safesearch must be "off", "moderate", or "strict"');
	}

	// Validate units
	if (request.units && !['metric', 'imperial'].includes(request.units)) {
		errors.push('Units must be "metric" or "imperial"');
	}

	// Validate result_filter
	if (request.result_filter) {
		const validFilters = [
			'discussions',
			'faq',
			'infobox',
			'news',
			'query',
			'summarizer',
			'videos',
			'web',
			'locations',
		];
		const filters = request.result_filter.split(',').map((f) => f.trim());
		const invalidFilters = filters.filter((f) => !validFilters.includes(f));
		if (invalidFilters.length > 0) {
			errors.push(
				`Invalid result filters: ${invalidFilters.join(', ')}. Valid filters: ${validFilters.join(', ')}`,
			);
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
		sanitizedRequest: sanitized,
	};
}

/**
 * Validates that a response looks like a valid Brave Search API response
 */
export function validateBraveSearchResponse(response: unknown): response is BraveSearchResponse {
	if (!response || typeof response !== 'object') {
		return false;
	}

	const resp = response as Record<string, unknown>;

	// Must have type 'search'
	if (resp.type !== 'search') {
		return false;
	}

	// Should have at least one result type
	const hasResults = ['web', 'news', 'videos', 'locations', 'discussions', 'faq', 'infobox'].some(
		(key) => key in resp && resp[key] !== null && resp[key] !== undefined,
	);

	return hasResults;
}

// =============================================================================
// Main API Client Class
// =============================================================================

/**
 * Brave Search API Client
 *
 * Provides a clean, type-safe interface to the Brave Search API.
 */
export class BraveApiClient {
	private apiKey: string;
	private options: Required<BraveApiOptions>;

	constructor(apiKey: string, options: BraveApiOptions = {}) {
		if (!apiKey || typeof apiKey !== 'string') {
			throw new Error('Brave API key is required');
		}

		this.apiKey = apiKey;
		this.options = {
			baseUrl: options.baseUrl || 'https://api.search.brave.com/res/v1',
			timeout: options.timeout || 10000,
			retryAttempts: options.retryAttempts || 2,
			userAgent: options.userAgent || 'BB-WebSearch/1.0',
		};
	}

	/**
	 * Performs a web search using the Brave Search API
	 */
	async webSearch(request: BraveSearchRequest): Promise<BraveSearchResponse> {
		// Validate request
		const validation = validateBraveSearchRequest(request);
		if (!validation.isValid) {
			throw new BraveApiError(
				`Invalid search request: ${validation.errors.join(', ')}`,
				400,
				validation.errors,
			);
		}

		const sanitizedRequest = validation.sanitizedRequest;

		// Build URL and query parameters
		const url = new URL(`${this.options.baseUrl}/web/search`);
		//logger.info(`BraveApiClient: sanitizedRequest to ${url.toString()}`, sanitizedRequest);

		// Add query parameters
		Object.entries(sanitizedRequest).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.set(key, String(value));
			}
		});
		//logger.info(`BraveApiClient: URL`, url.toString());
		//logger.info(`BraveApiClient: apiKey`, this.apiKey);

		// Prepare request headers
		const headers: Record<string, string> = {
			'Accept': 'application/json',
			'Accept-Encoding': 'gzip',
			'X-Subscription-Token': this.apiKey,
			'User-Agent': this.options.userAgent,
		};

		let lastError: Error | null = null;

		// Retry logic
		for (let attempt = 0; attempt <= this.options.retryAttempts; attempt++) {
			try {
				logger.info(
					`BraveApiClient: Making search request (attempt ${attempt + 1}/${this.options.retryAttempts + 1})`,
					{
						url: url.toString(),
						query: sanitizedRequest.q,
						count: sanitizedRequest.count,
					},
				);

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

				const response = await fetch(url.toString(), {
					method: 'GET',
					headers,
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					const errorBody = await response.text().catch(() => 'Unknown error');
					throw new BraveApiError(
						`Brave API request failed: ${response.status} ${response.statusText}`,
						response.status,
						errorBody,
						{
							url: url.toString(),
							method: 'GET',
							headers: { ...headers, 'X-Subscription-Token': '[REDACTED]' },
						},
					);
				}

				const responseData = await response.json();

				// Validate response format
				if (!validateBraveSearchResponse(responseData)) {
					throw new BraveApiError(
						'Invalid response format from Brave API',
						200,
						responseData,
					);
				}

				//logger.info('BraveApiClient: Search request successful', {
				//	query: sanitizedRequest.q,
				//	hasWeb: !!responseData.web,
				//	hasNews: !!responseData.news,
				//	hasVideos: !!responseData.videos,
				//	resultCount: responseData.web?.results?.length || 0,
				//});

				return responseData as BraveSearchResponse;
			} catch (error) {
				lastError = error instanceof Error ? error : new Error(String(error));

				// Don't retry on certain errors
				if (error instanceof BraveApiError) {
					if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
						// Client errors - don't retry
						throw error;
					}
				}

				// If this is the last attempt, throw the error
				if (attempt === this.options.retryAttempts) {
					break;
				}

				// Wait before retry (exponential backoff)
				const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
				logger.warn(`BraveApiClient: Request failed, retrying in ${delayMs}ms`, {
					attempt: attempt + 1,
					error: error instanceof Error ? error.message : String(error),
				});

				await new Promise((resolve) => setTimeout(resolve, delayMs));
			}
		}

		// If we get here, all retries failed
		throw lastError || new BraveApiError('All retry attempts failed');
	}

	/**
	 * Validates the API key by making a simple test request
	 */
	async validateApiKey(): Promise<boolean> {
		try {
			await this.webSearch({ q: 'test', count: 1 });
			return true;
		} catch (error) {
			if (error instanceof BraveApiError && error.statusCode === 401) {
				return false;
			}
			// Other errors might be network-related, so we can't be sure about key validity
			logger.warn('BraveApiClient: Cannot validate API key due to error', {
				error: error instanceof Error ? error.message : String(error),
			});
			return false;
		}
	}

	/**
	 * Gets API client configuration (without sensitive data)
	 */
	getConfig(): Omit<BraveApiOptions, 'apiKey'> & { hasApiKey: boolean } {
		return {
			baseUrl: this.options.baseUrl,
			timeout: this.options.timeout,
			retryAttempts: this.options.retryAttempts,
			userAgent: this.options.userAgent,
			hasApiKey: Boolean(this.apiKey),
		};
	}
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a search request from common parameters
 */
export function createSearchRequest({
	query,
	count = 10,
	safesearch = 'moderate',
	country,
	resultFilter,
	freshness,
}: {
	query: string;
	count?: number;
	safesearch?: 'off' | 'moderate' | 'strict';
	country?: string;
	resultFilter?: string;
	freshness?: string;
}): BraveSearchRequest {
	return {
		q: query,
		count,
		safesearch,
		...(country && { country }),
		...(resultFilter && { result_filter: resultFilter }),
		...(freshness && { freshness }),
		text_decorations: true,
		spellcheck: true,
	};
}

/**
 * Extracts key information from search results for summarization
 */
export function summarizeSearchResults(response: BraveSearchResponse): {
	totalResults: number;
	resultTypes: string[];
	topResults: Array<{ title: string; type: BraveSearchResultType; url: string; snippet?: string }>;
	query: {
		original: string;
		corrected?: string;
		isNavigational?: boolean;
		isLocal?: boolean;
	};
} {
	const resultTypes: string[] = [];
	const topResults: Array<{ title: string; type: BraveSearchResultType; url: string; snippet?: string }> = [];
	let totalResults = 0;
	//logger.info('BraveApiClient: summarizeSearchResults - response',response);

	// Identify result types present
	if (response.web?.results?.length) {
		resultTypes.push('web');
		totalResults += response.web.results.length;

		// Add top web results
		response.web.results.slice(0, 5).forEach((result) => {
			topResults.push({
				title: result.title,
				type: 'web',
				url: result.url,
				snippet: result.description,
			});
		});
	}

	if (response.news?.results?.length) {
		resultTypes.push('news');
		totalResults += response.news.results.length;
	}

	if (response.videos?.results?.length) {
		resultTypes.push('videos');
		totalResults += response.videos.results.length;
	}

	if (response.locations?.results?.length) {
		resultTypes.push('locations');
		totalResults += response.locations.results.length;
	}

	if (response.discussions?.results?.length) {
		resultTypes.push('discussions');
		totalResults += response.discussions.results.length;
	}

	if (response.faq?.results?.length) {
		resultTypes.push('faq');
		totalResults += response.faq.results.length;
	}

	if (response.infobox) {
		resultTypes.push('infobox');
		totalResults += 1;
	}

	return {
		totalResults,
		resultTypes,
		topResults,
		query: {
			original: response.query?.original || '',
			corrected: response.query?.altered,
			isNavigational: response.query?.is_navigational,
			isLocal: response.query?.is_geolocal,
		},
	};
}
