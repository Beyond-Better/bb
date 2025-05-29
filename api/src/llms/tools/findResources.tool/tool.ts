//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type {
	LLMToolFindResourcesInput,
	LLMToolFindResourcesResourceMatch,
	LLMToolFindResourcesResourceMatches,
} from './types.ts';

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
					maximum: 10,
				},
				maxMatchesPerFile: {
					type: 'number',
					description:
						'Maximum number of matches to return per file. Only applies when contentPattern is provided. Default is 5.',
					default: 5,
					minimum: 1,
					maximum: 20,
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
		resultContent: ConversationLogEntryContentToolResult,
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
			dataSourceIds = [],
		} = input;
		// caseSensitive controls the regex flag
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags

		const { dsConnections, notFound } = this.getDsConnectionsById(
			projectEditor,
			dataSourceIds,
		);

		if (dsConnections.length === 0) {
			throw createError(ErrorType.DataSourceHandling, `No valid data sources found`, {
				name: 'data-source',
				dataSourceIds: dataSourceIds,
			} as DataSourceHandlingErrorOptions);
		}

		// const searchOptions = {
		// 	resourcePattern,
		// 	dateAfter,
		// 	dateBefore,
		// 	sizeMin,
		// 	sizeMax,
		// 	contextLines,
		// 	maxMatchesPerFile,
		// 	includeContent: !!contentPattern, // Only include content when doing content search
		// };

		const searchCriteria = [
			contentPattern && `content pattern "${contentPattern}"`,
			contentPattern && `${caseSensitive ? 'case-sensitive' : 'case-insensitive'}`,
			resourcePattern && `resource pattern "${resourcePattern}"`,
			dateAfter && `modified after ${dateAfter}`,
			dateBefore && `modified before ${dateBefore}`,
			sizeMin !== undefined && `minimum size ${sizeMin} bytes`,
			sizeMax !== undefined && `maximum size ${sizeMax} bytes`,
		].filter(Boolean).join(', ');

		try {
			// Aggregate results across all data sources
			const aggregatedResults = {
				resources: [] as string[],
				errorMessages: [] as string[],
				dsConnectionsSearched: [] as string[],
				enhancedMatches: [] as LLMToolFindResourcesResourceMatches, // Store enhanced matches for content searches
			};

			// Process each data source
			for (const dsConnection of dsConnections) {
				logger.warn(
					`LLMToolFindResources: runTool - Search in ${dsConnection.name}: ${JSON.stringify(input)}`,
				);

				try {
					// Get the resource accessor for this data source
					const resourceAccessor = await dsConnection.getResourceAccessor();
					if (!resourceAccessor.searchResources) {
						throw createError(
							ErrorType.ToolHandling,
							`No searchResources method on resourceAccessor for ${dsConnection.name}`,
							{
								toolName: 'find_resources',
								operation: 'tool-run',
							} as ToolHandlingErrorOptions,
						);
					}

					// Prepare search options for the accessor
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
						pageSize: 100, // Default page size
						includeContent: !!contentPattern, // Include content when doing content search
					};

					// Use a dummy query string if no content pattern (for basic metadata search)
					const searchQuery = contentPattern || '';

					// Call the accessor's search method
					const searchResult = await resourceAccessor.searchResources(searchQuery, accessorSearchOptions);

					// Extract resource paths from matches
					const resources = searchResult.matches.map((match) => {
						// Extract relative path from URI
						const uri = match.resource.uri;
						// For filesystem resources, extract the path after 'file:./'
						if (uri.startsWith('file:./')) {
							return uri.substring(7); // Remove 'file:./'
						}
						// For other resources, use a more generic approach
						const pathPart = uri.includes('://') ? uri.split('://')[1] : uri;
						return pathPart || uri;
					});

					// Store enhanced matches for formatters (with data source prefix)
					if (contentPattern && searchResult.matches.some((match) => match.contentMatches)) {
						const enhancedMatches = searchResult.matches
							.filter((match) => match.contentMatches)
							.map((match) => ({
								resourcePath: `[${dsConnection.name}] ${
									resources[searchResult.matches.indexOf(match)]
								}`,
								contentMatches: match.contentMatches,
							} as LLMToolFindResourcesResourceMatch));
						aggregatedResults.enhancedMatches.push(...enhancedMatches);
					}

					// Add source prefix to resources for clarity
					const prefixedResources = resources.map((resource: string) => `[${dsConnection.name}] ${resource}`);

					aggregatedResults.resources.push(...prefixedResources);
					if (searchResult.errorMessage) {
						aggregatedResults.errorMessages.push(`[${dsConnection.name}]: ${searchResult.errorMessage}`);
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

			const toolResponse =
				`${dsConnectionStatus}\nFound ${aggregatedResults.resources.length} resources matching the search criteria: ${searchCriteria}`;
			const bbResponse =
				`BB found ${aggregatedResults.resources.length} resources matching the search criteria: ${searchCriteria}\n${dsConnectionStatus}`;
			//dataSource: {
			//	dsConnectionId: dsConnectionToUse.id,
			//	dsConnectionName: dsConnectionToUse.name,
			//	dsProviderType: dsConnectionToUse.providerType,
			//},

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolFindResources: Error searching project: ${(error as Error).message}`);

			throw createError(ErrorType.FileHandling, `Error searching project: ${(error as Error).message}`, {
				name: 'search-project',
				operation: 'search-project',
			});
		}
	}
}
