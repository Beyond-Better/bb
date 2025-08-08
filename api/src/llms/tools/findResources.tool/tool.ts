//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type {
	LLMToolFindResourcesInput,
	LLMToolFindResourcesResourceMatch,
	LLMToolFindResourcesResourceMatches,
} from './types.ts';
import type { FindResourceParams, FindResourceResult, ResultLevel } from 'shared/types/dataSourceResource.ts';

import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, ToolHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';
import type { ResourceSearchOptions } from 'shared/types/dataSourceResource.ts';

export default class LLMToolFindResources extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSourceIds: {
					type: 'array',
					items: { type: 'string' },
					description:
						"Array of data source IDs to operate on. Defaults to the primary data source if omitted. Specify ['all'] to operate on all available data sources. Examples: ['primary'], ['filesystem-1', 'db-staging'], ['all']. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				contentPattern: {
					type: 'string',
					description: String.raw`A grep-compatible regular expression to search resource contents. Examples:
* "function.*search" matches lines containing "function" followed by "search"
* "\bclass\b" matches the word "class" with word boundaries
* "import.*from" matches import statements
Special characters must be escaped with backslash:
* "\." for literal dot
* "\*" for literal asterisk
* "\?" for literal question mark
* "\(" and "\)" for parentheses
Leave empty to search only by resource name, date, or size.`,
				},
				caseSensitive: {
					type: 'boolean',
					description:
						'Controls case sensitivity of the contentPattern regex. Default is false (case-insensitive). Examples:\n* true: "Class" matches "Class" but not "class"\n* false: "Class" matches both "Class" and "class"',
					default: false,
				},
				resourcePattern: {
					type: 'string',
					description:
						'Glob pattern(s) to filter resources by name. IMPORTANT PATTERN RULES:\n\n1. Directory Traversal (`**`):\n   * ONLY use between directory separators\n   * Matches one or more directory levels\n   * Example: `src/**/*.ts` matches TypeScript files in src subdirectories\n   * CANNOT use within filenames\n\n2. Character Matching (`*`):\n   * Use within directory or file names\n   * Matches any characters except directory separator\n   * Example: `src/*.ts` matches TypeScript files in src directory only\n\n3. Common Patterns:\n   * `dir/*` - files IN directory only\n   * `dir/**/*` - files in subdirectories only\n   * `dir/*|dir/**/*` - files in directory AND subdirectories\n   * `**/*.test.ts` - test files at any depth\n   * `**/util/*.ts` - TypeScript files in any util directory\n\n4. Multiple Patterns:\n   * Use pipe | to separate\n   * Example: `*.ts|*.js` matches both TypeScript and JavaScript files\n   * Example: `src/*|test/*` matches files in both directories',
				},
				dateAfter: {
					type: 'string',
					description:
						'Include only resources modified after this date. Must be in YYYY-MM-DD format. Example: "2024-01-01" for resources modified after January 1st, 2024.',
				},
				dateBefore: {
					type: 'string',
					description:
						'Include only resources modified before this date. Must be in YYYY-MM-DD format. Example: "2024-12-31" for resources modified before December 31st, 2024.',
				},
				sizeMin: {
					type: 'number',
					description:
						'Include only resources larger than this size in bytes. Examples:\n* 1024 for resources larger than 1KB\n* 1048576 for resources larger than 1MB',
				},
				sizeMax: {
					type: 'number',
					description:
						'Include only resources smaller than this size in bytes. Examples:\n* 1024 for resources smaller than 1KB\n* 1048576 for resources smaller than 1MB',
				},
				contextLines: {
					type: 'number',
					description:
						'Number of lines to include before and after each match for context. Only applies when contentPattern is provided. Default is 2.',
					default: 2,
					minimum: 0,
					maximum: 25,
				},
				maxMatchesPerFile: {
					type: 'number',
					description:
						'Maximum number of matches to return per file. Only applies when contentPattern is provided. Default is 5.',
					default: 5,
					minimum: 1,
					maximum: 20,
				},
				resultLevel: {
					type: 'string',
					enum: ['resource', 'container', 'fragment', 'detailed'],
					default: 'fragment',
					description:
						'Level of detail in results: resource=just list, container=with containers, fragment=with text fragments, detailed=full context',
				},
				pageSize: {
					type: 'number',
					default: 20,
					minimum: 1,
					maximum: 100,
					description: 'Maximum number of resources to return per page',
				},
				pageToken: {
					type: 'string',
					description: 'Continuation token from previous results',
				},
				regexPattern: {
					type: 'boolean',
					default: false,
					description: 'Whether contentPattern should be treated as a regex (true) or literal text (false)',
				},
				structuredQuery: {
					type: 'object',
					description: 'Provider-specific structured query for advanced search capabilities',
				},
			},
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
		const input = toolUse.toolInput as LLMToolFindResourcesInput;
		const {
			contentPattern,
			caseSensitive = false,
			resourcePattern,
			dateAfter,
			dateBefore,
			sizeMin,
			sizeMax,
			contextLines = 2,
			maxMatchesPerFile = 5,
			resultLevel = 'fragment',
			pageSize = 20,
			pageToken,
			regexPattern = false,
			structuredQuery,
			dataSourceIds = [],
		} = input;

		// Handle both string and array parameters
		const targetDataSourceIds = Array.isArray(dataSourceIds) ? dataSourceIds : [dataSourceIds];

		const { dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			targetDataSourceIds,
		);

		if (dsConnections.length === 0) {
			throw createError(ErrorType.DataSourceHandling, `No valid data sources found`, {
				name: 'data-source',
				dataSourceIds: targetDataSourceIds,
			} as DataSourceHandlingErrorOptions);
		}

		const searchCriteria = [
			contentPattern && `content pattern "${contentPattern}"`,
			contentPattern && `${caseSensitive ? 'case-sensitive' : 'case-insensitive'}`,
			resourcePattern && `resource pattern "${resourcePattern}"`,
			dateAfter && `modified after ${dateAfter}`,
			dateBefore && `modified before ${dateBefore}`,
			sizeMin !== undefined && `minimum size ${sizeMin} bytes`,
			sizeMax !== undefined && `maximum size ${sizeMax} bytes`,
		].filter(Boolean).join(', ');
		//logger.info(`LLMToolFindResources: runTool - Input: ${JSON.stringify(input)}`, {searchCriteria});

		try {
			// Aggregate results across all data sources
			const aggregatedResults = {
				resources: [] as string[],
				errorMessages: [] as string[],
				dsConnectionsSearched: [] as string[],
				enhancedMatches: [] as LLMToolFindResourcesResourceMatches,
				findResults: [] as FindResourceResult[], // Store full findResources results
			};

			// Process each data source
			for (const dsConnection of dsConnections) {
				logger.warn(
					`LLMToolFindResources: runTool - Search in ${dsConnection.name}: ${JSON.stringify(input)}`,
				);

				try {
					// Get the resource accessor for this data source
					const resourceAccessor = await dsConnection.getResourceAccessor();

					// Try the new findResources method first
					if (resourceAccessor.findResources) {
						// Use the new unified operations architecture
						const findParams: FindResourceParams = {
							contentPattern,
							resourcePattern,
							structuredQuery,
							regexPattern,
							options: {
								caseSensitive,
								resultLevel: resultLevel as ResultLevel,
								maxMatchesPerResource: maxMatchesPerFile,
								contextLines,
								pageSize,
								pageToken,
								filters: {
									dateAfter,
									dateBefore,
									sizeMin,
									sizeMax,
								},
							},
						};

						const findResult = await resourceAccessor.findResources(findParams);
						aggregatedResults.findResults.push(findResult);

						// Handle error messages from findResources
						if (findResult.errorMessage) {
							aggregatedResults.errorMessages.push(`[${dsConnection.name}]: ${findResult.errorMessage}`);
						}

						// Extract resource paths for backward compatibility
						const resources = findResult.resources.map((resource) => resource.resourcePath);
						const prefixedResources = resources.map((resource) => `[${dsConnection.name}] ${resource}`);
						aggregatedResults.resources.push(...prefixedResources);

						// Store enhanced matches for content searches
						if (contentPattern && findResult.resources.some((r) => r.contentMatches)) {
							const enhancedMatches = findResult.resources
								.filter((r) => r.contentMatches)
								.map((resource) => ({
									resourcePath: `[${dsConnection.name}] ${resource.resourcePath}`,
									contentMatches: resource.contentMatches,
								} as LLMToolFindResourcesResourceMatch));
							aggregatedResults.enhancedMatches.push(...enhancedMatches);
						}
					} else if (resourceAccessor.searchResources) {
						// Fallback to legacy searchResources method
						const accessorSearchOptions: ResourceSearchOptions = {
							contentPattern,
							resourcePattern,
							caseSensitive,
							dateAfter,
							dateBefore,
							sizeMin,
							sizeMax,
							contextLines,
							maxMatchesPerFile,
							pageSize,
							resultLevel: resultLevel as ResultLevel,
							pageToken,
							regexPattern,
							includeContent: !!contentPattern,
						};

						const searchQuery = contentPattern || '';
						const searchResult = await resourceAccessor.searchResources(searchQuery, accessorSearchOptions);

						// Extract resource paths from matches (using legacy match format)
						const resources = searchResult.matches.map((match: any) => {
							const uri = match.resource?.uri || match.resourceUri;
							if (uri.startsWith('file:./')) {
								return uri.substring(7);
							}
							const pathPart = uri.includes('://') ? uri.split('://')[1] : uri;
							return pathPart || uri;
						});

						// Store enhanced matches for content searches (using legacy match format)
						if (contentPattern && searchResult.matches.some((match: any) => match.contentMatches)) {
							const enhancedMatches = searchResult.matches
								.filter((match: any) => match.contentMatches)
								.map((match: any) => ({
									resourcePath: `[${dsConnection.name}] ${
										resources[searchResult.matches.indexOf(match)]
									}`,
									contentMatches: match.contentMatches,
								} as LLMToolFindResourcesResourceMatch));
							aggregatedResults.enhancedMatches.push(...enhancedMatches);
						}

						const prefixedResources = resources.map((resource) => `[${dsConnection.name}] ${resource}`);
						aggregatedResults.resources.push(...prefixedResources);

						if (searchResult.errorMessage) {
							aggregatedResults.errorMessages.push(
								`[${dsConnection.name}]: ${searchResult.errorMessage}`,
							);
						}
					} else {
						throw createError(
							ErrorType.ToolHandling,
							`No search method available on resourceAccessor for ${dsConnection.name}`,
							{
								toolName: 'find_resources',
								operation: 'tool-run',
							} as ToolHandlingErrorOptions,
						);
					}

					aggregatedResults.dsConnectionsSearched.push(dsConnection.name);
				} catch (error) {
					aggregatedResults.errorMessages.push(`[${dsConnection.name}]: ${(error as Error).message}`);
				}
			}

			const dsConnectionStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: 'All data sources searched';

			const errorSection = aggregatedResults.errorMessages.length > 0
				? `Errors:\n${aggregatedResults.errorMessages.join('\n')}\n\n`
				: '';

			// Generate tool results with enhanced data if available
			let toolResults: string;
			if (contentPattern && aggregatedResults.enhancedMatches.length > 0) {
				// Enhanced format with content matches
				toolResults = stripIndents`
				  Searched data sources: [${aggregatedResults.dsConnectionsSearched.join(', ')}]
				  ${errorSection}
				  ${aggregatedResults.resources.length} resources match the search criteria: ${searchCriteria}
				  
				  <enhanced-results>
				  ${JSON.stringify({ matches: aggregatedResults.enhancedMatches }, null, 2)}
				  </enhanced-results>
				  
				  <resources>
				  ${aggregatedResults.resources.join('\n')}
				  </resources>
				`;
			} else {
				// Simple format (backward compatibility)
				toolResults = stripIndents`
				  Searched data sources: [${aggregatedResults.dsConnectionsSearched.join(', ')}]
				  ${errorSection}
				  ${aggregatedResults.resources.length} resources match the search criteria: ${searchCriteria}
				  ${
					aggregatedResults.resources.length > 0
						? `\n<resources>\n${aggregatedResults.resources.join('\n')}\n</resources>`
						: ''
				}
				`;
			}

			// Include pagination info in response if using findResources
			let paginationInfo = '';
			if (aggregatedResults.findResults.length > 0) {
				const firstResult = aggregatedResults.findResults[0];
				if (firstResult.pagination.hasMore) {
					paginationInfo =
						`\nPage size: ${firstResult.pagination.pageSize}, More results available (use pageToken: "${firstResult.pagination.pageToken}")`;
				}
			}

			const toolResponse =
				`${dsConnectionStatus}\nFound ${aggregatedResults.resources.length} resources matching the search criteria: ${searchCriteria}${paginationInfo}`;

			// Build structured bbResponse
			const dataSources = dsConnections.map((dsConnection) => ({
				dsConnectionId: dsConnection.id || '',
				dsConnectionName: dsConnection.name,
				dsProviderType: dsConnection.providerType,
			}));

			const paginationData =
				aggregatedResults.findResults.length > 0 && aggregatedResults.findResults[0].pagination.hasMore
					? {
						hasMore: aggregatedResults.findResults[0].pagination.hasMore,
						pageSize: aggregatedResults.findResults[0].pagination.pageSize,
						pageToken: aggregatedResults.findResults[0].pagination.pageToken,
					}
					: undefined;

			const bbResponse = {
				data: {
					resources: aggregatedResults.resources,
					matches: aggregatedResults.enhancedMatches,
					errorMessage: aggregatedResults.errorMessages.length > 0
						? aggregatedResults.errorMessages.join('; ')
						: undefined,
					searchCriteria,
					dataSources,
					pagination: paginationData,
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolFindResources: Error searching project: ${(error as Error).message}`);

			const errorMessage = `Error searching project: ${(error as Error).message}`;
			const toolResults = `⚠️  ${errorMessage}`;
			const bbResponse = {
				data: {
					resources: [],
					matches: [],
					errorMessage: errorMessage,
					searchCriteria: 'Error occurred',
					dataSources: [],
				},
			};
			const toolResponse = `Failed to search resources. Error: ${errorMessage}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
