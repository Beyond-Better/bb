//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { LLMToolSearchProjectInput } from './types.ts';

import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { searchFilesContent, searchFilesMetadata } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export default class LLMToolSearchProject extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSources: {
					type: 'array',
					items: { type: 'string' },
					description:
						"Array of data source names to operate on. Defaults to the primary data source if omitted. Specify ['all'] to operate on all available data sources. Examples: ['primary'], ['filesystem-1', 'db-staging'], ['all']. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				contentPattern: {
					type: 'string',
					description: String.raw`A grep-compatible regular expression to search file contents. Examples:
* "function.*search" matches lines containing "function" followed by "search"
* "\bclass\b" matches the word "class" with word boundaries
* "import.*from" matches import statements
Special characters must be escaped with backslash:
* "\." for literal dot
* "\*" for literal asterisk
* "\?" for literal question mark
* "\(" and "\)" for parentheses
Leave empty to search only by file name, date, or size.`,
				},
				caseSensitive: {
					type: 'boolean',
					description:
						'Controls case sensitivity of the contentPattern regex. Default is false (case-insensitive). Examples:\n* true: "Class" matches "Class" but not "class"\n* false: "Class" matches both "Class" and "class"',
					default: false,
				},
				filePattern: {
					type: 'string',
					description:
						'Glob pattern(s) to filter files by name. IMPORTANT PATTERN RULES:\n\n1. Directory Traversal (`**`):\n   * ONLY use between directory separators\n   * Matches one or more directory levels\n   * Example: `src/**/*.ts` matches TypeScript files in src subdirectories\n   * CANNOT use within filenames\n\n2. Character Matching (`*`):\n   * Use within directory or file names\n   * Matches any characters except directory separator\n   * Example: `src/*.ts` matches TypeScript files in src directory only\n\n3. Common Patterns:\n   * `dir/*` - files IN directory only\n   * `dir/**/*` - files in subdirectories only\n   * `dir/*|dir/**/*` - files in directory AND subdirectories\n   * `**/*.test.ts` - test files at any depth\n   * `**/util/*.ts` - TypeScript files in any util directory\n\n4. Multiple Patterns:\n   * Use pipe | to separate\n   * Example: `*.ts|*.js` matches both TypeScript and JavaScript files\n   * Example: `src/*|test/*` matches files in both directories',
					//'Glob pattern(s) to filter files by name. Use pipe | to separate multiple patterns. Examples:\n* "*.ts" for TypeScript files\n* "src/**/*.ts" for TypeScript files in src and subdirectories\n* "*.js|*.ts" for both JavaScript and TypeScript files\n* "test_*.py|*_test.py" for Python test files with prefix or suffix',
				},
				dateAfter: {
					type: 'string',
					description:
						'Include only files modified after this date. Must be in YYYY-MM-DD format. Example: "2024-01-01" for files modified after January 1st, 2024.',
				},
				dateBefore: {
					type: 'string',
					description:
						'Include only files modified before this date. Must be in YYYY-MM-DD format. Example: "2024-12-31" for files modified before December 31st, 2024.',
				},
				sizeMin: {
					type: 'number',
					description:
						'Include only files larger than this size in bytes. Examples:\n* 1024 for files larger than 1KB\n* 1048576 for files larger than 1MB',
				},
				sizeMax: {
					type: 'number',
					description:
						'Include only files smaller than this size in bytes. Examples:\n* 1024 for files smaller than 1KB\n* 1048576 for files smaller than 1MB',
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
		const input = toolUse.toolInput as LLMToolSearchProjectInput;
		const {
			contentPattern,
			caseSensitive = false,
			filePattern,
			dateAfter,
			dateBefore,
			sizeMin,
			sizeMax,
			dataSources: dataSourceIds = [],
		} = input;
		// caseSensitive controls the regex flag
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags

		const { dataSources, notFound } = this.getDataSources(
			projectEditor,
			dataSourceIds,
		);

		if (dataSources.length === 0) {
			throw createError(ErrorType.DataSourceHandling, `No valid data sources found`, {
				name: 'data-source',
				dataSourceIds: dataSourceIds,
			} as DataSourceHandlingErrorOptions);
		}

		const searchOptions = {
			filePattern,
			dateAfter,
			dateBefore,
			sizeMin,
			sizeMax,
		};

		const searchCriteria = [
			contentPattern && `content pattern "${contentPattern}"`,
			contentPattern && `${caseSensitive ? 'case-sensitive' : 'case-insensitive'}`,
			filePattern && `file pattern "${filePattern}"`,
			dateAfter && `modified after ${dateAfter}`,
			dateBefore && `modified before ${dateBefore}`,
			sizeMin !== undefined && `minimum size ${sizeMin} bytes`,
			sizeMax !== undefined && `maximum size ${sizeMax} bytes`,
		].filter(Boolean).join(', ');

		try {
			// Aggregate results across all data sources
			const aggregatedResults = {
				files: [] as string[],
				errorMessages: [] as string[],
				dataSourcesSearched: [] as string[],
			};

			// Process each data source
			for (const dataSource of dataSources) {
				const dataSourceRoot = dataSource.getDataSourceRoot();
				if (!dataSourceRoot) {
					aggregatedResults.errorMessages.push(`No root for data source: ${dataSource.name}`);
					continue;
				}

				logger.warn(
					`LLMToolSearchProject: runTool - Search in ${dataSourceRoot}: ${JSON.stringify(input)}`,
				);

				let result;
				try {
					if (contentPattern) {
						result = await searchFilesContent(dataSourceRoot, contentPattern, caseSensitive, searchOptions);
					} else {
						result = await searchFilesMetadata(dataSourceRoot, searchOptions);
					}

					const { files, errorMessage } = result;

					// Add source prefix to files for clarity
					const prefixedFiles = files.map((file) => `[${dataSource.name}] ${file}`);

					aggregatedResults.files.push(...prefixedFiles);
					if (errorMessage) {
						aggregatedResults.errorMessages.push(`[${dataSource.name}]: ${errorMessage}`);
					}
					aggregatedResults.dataSourcesSearched.push(dataSource.name);
				} catch (error) {
					aggregatedResults.errorMessages.push(`[${dataSource.name}]: ${(error as Error).message}`);
				}
			}

			const dataSourceStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: 'All data sources searched';

			const errorSection = aggregatedResults.errorMessages.length > 0
				? `Errors:\n${aggregatedResults.errorMessages.join('\n')}\n\n`
				: '';

			const toolResults = stripIndents`
			  Searched data sources: [${aggregatedResults.dataSourcesSearched.join(', ')}]
			  ${errorSection}
			  ${aggregatedResults.files.length} files match the search criteria: ${searchCriteria}
			  ${aggregatedResults.files.length > 0 ? `\n<files>\n${aggregatedResults.files.join('\n')}\n</files>` : ''}
			`;

			const toolResponse =
				`${dataSourceStatus}\nFound ${aggregatedResults.files.length} files matching the search criteria: ${searchCriteria}`;
			const bbResponse =
				`BB found ${aggregatedResults.files.length} files matching the search criteria: ${searchCriteria}\n${dataSourceStatus}`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolSearchProject: Error searching project: ${(error as Error).message}`);

			throw createError(ErrorType.FileHandling, `Error searching project: ${(error as Error).message}`, {
				name: 'search-project',
				operation: 'search-project',
			});
		}
	}
}
