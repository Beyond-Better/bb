import LLMTool from 'api/llms/llmTool.ts';
import type {
	LLMToolConfig,
	LLMToolInputSchema,
	LLMToolLogEntryFormattedResult,
	LLMToolRunResult,
} from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { errorMessage } from 'shared/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { ToolHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import {
	BraveApiClient,
	BraveApiError,
	//createSearchRequest,
	summarizeSearchResults,
} from 'shared/braveApi.ts';
import type {
	BraveDiscussionResult,
	BraveFaqResult,
	BraveLocationResult,
	BraveNewsResult,
	BraveSearchRequest,
	BraveSearchResponse,
	BraveSearchResult,
	BraveVideoResult,
} from 'shared/braveApi.ts';
import type {
	LLMToolSearchWebInput,
	LLMToolSearchWebResultData,
	SearchRequestContext,
	SearchResponseContext,
	SearchResult,
	SearchSummary,
	SearchWebToolConfig,
} from './types.ts';
import { DEFAULT_PROXY_URL, VALID_RESULT_FILTERS, validateResultFilters } from './types.ts';

interface LLMToolSearchWebConfig extends LLMToolConfig {
	apiProviders?: {
		brave?: {
			apiKey?: string;
			enabled?: boolean;
		};
	};
	proxyUrl?: string;
	defaultProvider?: string;
}

export default class LLMToolSearchWeb extends LLMTool {
	private config: SearchWebToolConfig;

	constructor(name: string, description: string, toolConfig: LLMToolSearchWebConfig) {
		super(name, description, toolConfig);

		// Initialize configuration with defaults
		this.config = {
			apiProviders: toolConfig.apiProviders || {},
			proxyUrl: toolConfig.proxyUrl || DEFAULT_PROXY_URL,
			defaultProvider: toolConfig.defaultProvider || 'brave',
		};

		// Ensure brave provider config exists
		if (!this.config.apiProviders!.brave) {
			this.config.apiProviders!.brave = { enabled: true };
		}

		//logger.info('LLMToolSearchWeb: Initialized with configuration', {
		//	hasApiKey: !!this.config.apiProviders?.brave?.apiKey,
		//	proxyUrl: this.config.proxyUrl,
		//	defaultProvider: this.config.defaultProvider,
		//});
	}

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description: `Search query string. Requirements:

1. Query Guidelines:
   * Maximum 400 characters and 50 words
   * Use clear, specific search terms
   * Include relevant keywords for better results
   * Examples: "climate change effects 2024", "best restaurants Paris"

2. Search Operators (optional):
   * Use quotes for exact phrases: "machine learning"
   * Use site: to search specific sites: "site:wikipedia.org quantum physics"
   * Use - to exclude terms: "jaguar -car" (animal, not vehicle)
   * Use OR for alternatives: "python OR javascript tutorial"

3. Best Practices:
   * Be specific rather than generic
   * Include context when needed: "React hooks tutorial beginners"
   * Use current year for time-sensitive queries: "iPhone 2024 review"`,
				},
				count: {
					type: 'integer',
					minimum: 1,
					maximum: 20,
					description: 'Number of search results to return (default: 10, maximum: 20)',
				},
				country: {
					type: 'string',
					description:
						'Search country as 2-character country code (e.g., "US", "GB", "DE"). Affects search results relevance and local content prioritization. Default: "US"',
				},
				safesearch: {
					type: 'string',
					enum: ['off', 'moderate', 'strict'],
					description: `Content filtering level:
   * "off": No filtering
   * "moderate": Filter explicit content but allow adult domains (default)
   * "strict": Remove all adult content from results`,
				},
				result_filter: {
					type: 'string',
					description: `Comma-separated list of result types to include. Available types:
   * "web": Web page results (default)
   * "news": News articles
   * "videos": Video content
   * "locations": Local businesses and places
   * "discussions": Forum posts and discussions
   * "faq": Frequently asked questions
   * "infobox": Knowledge panel information
   
Examples:
   * "web,news" - Web pages and news only
   * "locations" - Only local business results
   * "web,videos,news" - Multiple result types
   
Note: Omitting this parameter returns all available result types`,
				},
				freshness: {
					type: 'string',
					description: `Time-based filtering for recent content:
   * "pd": Past day (24 hours)
   * "pw": Past week (7 days)
   * "pm": Past month (31 days)
   * "py": Past year (365 days)
   * Custom range: "YYYY-MM-DDtoYYYY-MM-DD" (e.g., "2024-01-01to2024-06-30")
   
Useful for:
   * Breaking news and current events
   * Recent product reviews
   * Latest research or developments`,
				},
				search_lang: {
					type: 'string',
					description:
						'Search language as 2+ character language code (e.g., "en", "es", "fr", "de"). Affects which language content is prioritized. Default: "en"',
				},
				ui_lang: {
					type: 'string',
					description:
						'User interface language for result labels and metadata in format "lang-country" (e.g., "en-US", "fr-FR", "de-DE"). Default: "en-US"',
				},
				extra_snippets: {
					type: 'boolean',
					description:
						'Request additional alternative excerpts from search results (up to 5 additional snippets per result). Provides more context but may increase response time. Default: false',
				},
			},
			required: ['query'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const input = toolUse.toolInput as LLMToolSearchWebInput;
		const startTime = Date.now();

		try {
			//logger.info('LLMToolSearchWeb: Starting search', {
			//	query: input.query,
			//	count: input.count,
			//	resultFilter: input.result_filter,
			//});

			// Validate and prepare the search request
			const requestContext = await this.prepareSearchRequest(input);

			// Execute the search
			const responseContext = await this.executeSearch(requestContext, projectEditor);
			//logger.warn('LLMToolSearchWeb: runTool', {responseContext});

			// Process and format results
			const resultData = await this.processSearchResults(responseContext);
			//logger.warn('LLMToolSearchWeb: runTool', {resultData});

			const searchTimeMs = Date.now() - startTime;
			const resultCount = resultData.results.length;
			const resultTypes = [...new Set(resultData.results.map((r) => r.type))].join(', ');

			return {
				toolResults: this.formatSearchResults(resultData),
				toolResponse: `Found ${resultCount} search result${resultCount !== 1 ? 's' : ''} for "${input.query}"${
					resultTypes ? ` (${resultTypes})` : ''
				} in ${searchTimeMs}ms`,
				bbResponse: {
					data: resultData,
				},
			};
		} catch (error) {
			logger.error('LLMToolSearchWeb: Search failed', {
				query: input.query,
				error: error instanceof Error ? error.message : String(error),
				duration: Date.now() - startTime,
			});

			const errorMessage = this.formatSearchError(error);

			throw createError(ErrorType.ToolHandling, errorMessage, {
				name: 'search-web',
				//filePath: resourcePath,
				operation: 'tool-run',
			} as ToolHandlingErrorOptions);
			//return {
			//	toolResults: `⚠️ Search failed: ${errorMessage}`,
			//	toolResponse: `Failed to search for "${input.query}": ${errorMessage}`,
			//	bbResponse: `BB failed to perform web search. ${errorMessage}`,
			//};
		}
	}

	/**
	 * Prepares and validates the search request context
	 */
	private async prepareSearchRequest(input: LLMToolSearchWebInput): Promise<SearchRequestContext> {
		// Validate result filters if provided
		if (input.result_filter) {
			const validation = validateResultFilters(input.result_filter);
			if (!validation.isValid) {
				throw new Error(
					`Invalid result filters: ${validation.invalidFilters.join(', ')}. Valid filters: ${
						VALID_RESULT_FILTERS.join(', ')
					}`,
				);
			}
			input.result_filter = validation.sanitizedString;
		}

		// Create Brave API request
		const braveRequest: BraveSearchRequest = {
			q: input.query.trim(),
			count: input.count || 10,
			safesearch: input.safesearch || 'moderate',
			text_decorations: true,
			spellcheck: true,
			...(input.country && { country: input.country }),
			...(input.result_filter && { result_filter: input.result_filter }),
			...(input.freshness && { freshness: input.freshness }),
			...(input.search_lang && { search_lang: input.search_lang }),
			...(input.ui_lang && { ui_lang: input.ui_lang }),
			...(input.extra_snippets && { extra_snippets: input.extra_snippets }),
		};

		// Determine which provider and method to use
		const braveConfig = this.config.apiProviders?.brave || { enabled: true };
		const hasUserApiKey = Boolean(braveConfig.apiKey);

		return {
			originalInput: input,
			braveRequest,
			provider: {
				name: 'brave',
				config: braveConfig,
				source: hasUserApiKey ? 'user_key' : 'proxy',
			},
			startTime: Date.now(),
			userId: 'unknown', // Will be populated by caller if needed
		};
	}

	/**
	 * Executes the search request using the appropriate method
	 */
	private async executeSearch(
		context: SearchRequestContext,
		projectEditor: ProjectEditor,
	): Promise<SearchResponseContext> {
		let braveResponse: BraveSearchResponse;
		let requestId: string | undefined;
		let costMicroUsd: number | undefined;

		if (context.provider.source === 'user_key' && context.provider.config.apiKey) {
			// Use user's API key directly
			braveResponse = await this.searchWithUserApiKey(context);
		} else {
			// Use proxy service
			const proxyResult = await this.searchWithProxy(context, projectEditor);
			//logger.warn('LLMToolSearchWeb: executeSearch', {proxyResult});
			braveResponse = proxyResult.response;
			requestId = proxyResult.requestId;
			costMicroUsd = proxyResult.costMicroUsd;
		}

		// Process search results
		const processedResults = this.convertBraveResults(braveResponse);
		const summary = this.createSearchSummary(context, braveResponse, costMicroUsd);
		//logger.warn('LLMToolSearchWeb: executeSearch', {summary});

		return {
			request: context,
			braveResponse,
			processedResults,
			summary,
			endTime: Date.now(),
			costMicroUsd,
			requestId,
		};
	}

	/**
	 * Performs search using user's Brave API key
	 */
	private async searchWithUserApiKey(context: SearchRequestContext): Promise<BraveSearchResponse> {
		const apiKey = context.provider.config.apiKey!;
		const client = new BraveApiClient(apiKey, {
			userAgent: 'BB-SearchWeb/1.0',
		});

		logger.debug('LLMToolSearchWeb: Using user API key for search');
		return await client.webSearch(context.braveRequest);
	}

	/**
	 * Performs search using the ACS proxy service
	 */
	private async searchWithProxy(context: SearchRequestContext, projectEditor: ProjectEditor): Promise<{
		response: BraveSearchResponse;
		requestId?: string;
		costMicroUsd?: number;
	}> {
		const proxyUrl = `${this.config.proxyUrl}/brave/web-search`;

		logger.info('LLMToolSearchWeb: Using proxy service for search', {
			proxyUrl: this.config.proxyUrl,
		});

		// Get current session for authentication
		const session = await projectEditor.userContext.userAuthSession.getSession();
		//logger.info(`BbLLM:provider[${this.llmProviderName}]: session`, session);

		// Prepare headers - same as what Supabase edge functions receive
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'User-Agent': 'BB-SearchWeb/1.0',
		};

		// Add Authorization header if we have a session
		if (session?.access_token) {
			headers['Authorization'] = `Bearer ${session.access_token}`;
		}

		//logger.info('LLMToolSearchWeb: braveRequest', context.braveRequest);
		const response = await fetch(proxyUrl, {
			method: 'POST',
			headers,
			body: JSON.stringify(context.braveRequest),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => 'Unknown error');
			throw new Error(`Proxy search failed (${response.status}): ${errorText}`);
		}

		const result = await response.json();
		//logger.warn('LLMToolSearchWeb: result', result);

		return {
			response: result.data.results || result,
			requestId: result.metadata?.requestId,
			costMicroUsd: result.metadata?.costMicroUsd,
		};
	}

	/**
	 * Converts Brave API response to standardized search results
	 */
	private convertBraveResults(response: BraveSearchResponse): SearchResult[] {
		const results = response; //.results;
		const convertedResults: SearchResult[] = [];

		// Web results
		if (results.web?.results) {
			results.web.results.forEach((result: BraveSearchResult) => {
				convertedResults.push({
					title: result.title,
					url: result.url,
					description: result.description,
					type: 'web',
					metadata: {
						age: result.page_age,
						thumbnail: result.thumbnail?.src,
					},
				});
			});
		}

		// News results
		if (results.news?.results) {
			results.news.results.forEach((result: BraveNewsResult) => {
				convertedResults.push({
					title: result.title,
					url: result.url,
					description: result.description,
					type: 'news',
					metadata: {
						source: result.source,
						age: result.age,
						breaking: result.breaking,
						thumbnail: result.thumbnail?.src,
					},
				});
			});
		}

		// Video results
		if (results.videos?.results) {
			results.videos.results.forEach((result: BraveVideoResult) => {
				convertedResults.push({
					title: result.title,
					url: result.url,
					description: result.description,
					type: 'video',
					metadata: {
						age: result.age,
						thumbnail: result.thumbnail?.src,
					},
				});
			});
		}

		// Location results
		if (results.locations?.results) {
			results.locations.results.forEach((result: BraveLocationResult) => {
				convertedResults.push({
					title: result.title,
					url: result.url,
					description: result.description,
					type: 'location',
					metadata: {
						rating: result.rating?.ratingValue,
						coordinates: result.coordinates,
						thumbnail: result.thumbnail?.src,
					},
				});
			});
		}

		// Discussion results
		if (results.discussions?.results) {
			results.discussions.results.forEach((result: BraveDiscussionResult) => {
				convertedResults.push({
					title: result.data?.title || result.title || 'Discussion',
					url: result.url || '#',
					description: result.description || result.data?.question,
					type: 'discussion',
					metadata: {
						forum_name: result.data?.forum_name,
					},
				});
			});
		}

		// FAQ results
		if (results.faq?.results) {
			results.faq.results.forEach((result: BraveFaqResult) => {
				convertedResults.push({
					title: result.question,
					url: result.url,
					description: result.answer,
					type: 'faq',
				});
			});
		}

		// Infobox results
		if (results.infobox?.results) {
			const infobox = results.infobox.results;
			convertedResults.push({
				title: infobox.label || 'Information',
				url: infobox.website_url || '#',
				description: infobox.long_desc,
				type: 'infobox',
				metadata: {
					thumbnail: infobox.thumbnail?.src,
				},
			});
		}

		//logger.info('LLMToolSearchWeb: convertedResults',convertedResults);
		return convertedResults;
	}

	/**
	 * Creates search summary from response data
	 */
	private createSearchSummary(
		context: SearchRequestContext,
		response: BraveSearchResponse,
		costMicroUsd?: number,
	): SearchSummary {
		const summary = summarizeSearchResults(response);
		//logger.info('LLMToolSearchWeb: summary',summary);

		return {
			query: summary.query,
			totalResults: summary.totalResults,
			topResults: summary.topResults,
			resultTypes: summary.resultTypes,
			searchTime: Date.now() - context.startTime,
			provider: context.provider.name,
			costMicroUsd,
		};
	}

	/**
	 * Processes final search results and creates result data
	 */
	private async processSearchResults(context: SearchResponseContext): Promise<LLMToolSearchWebResultData> {
		return {
			results: context.processedResults,
			summary: context.summary,
			rawResponse: context.braveResponse,
			provider: {
				name: context.request.provider.name,
				source: context.request.provider.source,
				requestId: context.request.requestId,
			},
		};
	}

	/**
	 * Formats search results for display to the LLM
	 */
	private formatSearchResults(data: LLMToolSearchWebResultData): string {
		const { results, summary } = data;

		if (results.length === 0) {
			return `No results found for "${summary.query.original}".${
				summary.query.corrected ? ` (searched for: "${summary.query.corrected}")` : ''
			}`;
		}

		let formatted = `# Search Results for "${summary.query.original}"\n\n`;

		if (summary.query.corrected && summary.query.corrected !== summary.query.original) {
			formatted += `*Search was corrected to: "${summary.query.corrected}"*\n\n`;
		}

		formatted += `Found ${summary.totalResults} results across ${summary.resultTypes.length} content types.\n\n`;

		// Group results by type for better organization
		const resultsByType = results.reduce((groups, result) => {
			const type = result.type;
			if (!groups[type]) groups[type] = [];
			groups[type].push(result);
			return groups;
		}, {} as Record<string, SearchResult[]>);

		// Display each result type
		const typeOrder = ['web', 'news', 'video', 'location', 'discussion', 'faq', 'infobox'];

		typeOrder.forEach((type) => {
			const typeResults = resultsByType[type];
			if (!typeResults?.length) return;

			formatted += `## ${this.capitalizeFirst(type)} Results\n\n`;

			typeResults.forEach((result, index) => {
				formatted += `**${index + 1}. ${result.title}**\n`;
				formatted += `${result.url}\n`;

				if (result.description) {
					formatted += `${result.description}\n`;
				}

				// Add relevant metadata
				if (result.metadata) {
					const meta: string[] = [];
					if (result.metadata.source) meta.push(`Source: ${result.metadata.source}`);
					if (result.metadata.age) meta.push(`Age: ${result.metadata.age}`);
					if (result.metadata.rating) meta.push(`Rating: ${result.metadata.rating}`);
					if (result.metadata.forum_name) meta.push(`Forum: ${result.metadata.forum_name}`);
					if (result.metadata.breaking) meta.push('Breaking News');

					if (meta.length > 0) {
						formatted += `*${meta.join(' | ')}*\n`;
					}
				}

				formatted += '\n';
			});
		});

		// Add search metadata
		formatted += `---\n\n`;
		formatted += `**Search Details:**\n`;
		formatted += `- Query: ${summary.query.original}\n`;
		formatted += `- Results: ${summary.totalResults}\n`;
		formatted += `- Types: ${summary.resultTypes.join(', ')}\n`;
		formatted += `- Time: ${summary.searchTime}ms\n`;
		formatted += `- Provider: ${summary.provider} (${
			data.provider.source === 'user_key' ? 'user API key' : 'proxy'
		})\n`;

		if (summary.costMicroUsd) {
			formatted += `- Cost: $${(summary.costMicroUsd / 1000000).toFixed(6)}\n`;
		}

		logger.info('LLMToolSearchWeb: formatSearchResults', formatted);
		return formatted;
	}

	/**
	 * Formats search errors for user-friendly display
	 */
	private formatSearchError(error: unknown): string {
		if (error instanceof BraveApiError) {
			if ((error as BraveApiError).statusCode === 401) {
				return 'Invalid or expired API key. Please check your Brave Search API configuration.';
			}
			if ((error as BraveApiError).statusCode === 429) {
				return 'Rate limit exceeded. Please wait before making another search request.';
			}
			if ((error as BraveApiError).statusCode === 402) {
				return 'Insufficient credits or quota exceeded. Please check your Brave Search API account.';
			}
			return errorMessage(error);
		}

		if (error instanceof Error) {
			// Check for common network errors
			if (error.message.includes('fetch failed') || error.message.includes('network')) {
				return 'Network error - please check your internet connection and try again.';
			}
			if (error.message.includes('timeout')) {
				return 'Search request timed out - the service may be experiencing high load.';
			}
			return error.message;
		}

		return 'An unknown error occurred during the search request.';
	}

	/**
	 * Capitalizes the first letter of a string
	 */
	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
}
