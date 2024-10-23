import type { JSX } from 'preact';

import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { searchFilesContent, searchFilesMetadata } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

import { stripIndents } from 'common-tags';

export default class LLMToolSearchProject extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
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
						'Glob pattern(s) to filter files by name. Use pipe | to separate multiple patterns. Examples:\n* "*.ts" for TypeScript files\n* "src/**/*.ts" for TypeScript files in src and subdirectories\n* "*.js|*.ts" for both JavaScript and TypeScript files\n* "test_*.py|*_test.py" for Python test files with prefix or suffix',
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

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(resultContent) : formatToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { contentPattern, caseSensitive = false, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } =
			toolInput as {
				contentPattern?: string;
				caseSensitive?: boolean;
				filePattern?: string;
				dateAfter?: string;
				dateBefore?: string;
				sizeMin?: number;
				sizeMax?: number;
			};
		// caseSensitive controls the regex flag
		// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions#advanced_searching_with_flags

		try {
			let files: string[] = [];
			let errorMessage: string | null = null;

			let result;
			if (contentPattern) {
				// searchContent or searchContentInFiles
				result = await searchFilesContent(projectEditor.projectRoot, contentPattern, caseSensitive, {
					filePattern,
					dateAfter,
					dateBefore,
					sizeMin,
					sizeMax,
				});
			} else {
				// searchForFiles (metadata-only search)
				result = await searchFilesMetadata(projectEditor.projectRoot, {
					filePattern,
					dateAfter,
					dateBefore,
					sizeMin,
					sizeMax,
				});
			}
			files = result.files;
			errorMessage = result.errorMessage;

			const searchCriteria = [
				contentPattern && `content pattern "${contentPattern}"`,
				// only include case sensitivity details if content pattern was supplied
				contentPattern && `${caseSensitive ? 'case-sensitive' : 'case-insensitive'}`,
				filePattern && `file pattern "${filePattern}"`,
				dateAfter && `modified after ${dateAfter}`,
				dateBefore && `modified before ${dateBefore}`,
				sizeMin !== undefined && `minimum size ${sizeMin} bytes`,
				sizeMax !== undefined && `maximum size ${sizeMax} bytes`,
			].filter(Boolean).join(', ');

			const toolResults = stripIndents`
				${
				errorMessage
					? `Error: ${errorMessage}
				
				`
					: ''
			}${files.length} files match the search criteria: ${searchCriteria}${
				files.length > 0
					? `
				<files>
				${files.join('\n')}
				</files>`
					: ''
			}
			`;
			const toolResponse = `Found ${files.length} files matching the search criteria: ${searchCriteria}`;
			const bbResponse = `BB found ${files.length} files matching the search criteria: ${searchCriteria}`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`Error searching project: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error searching project: ${error.message}`, {
				name: 'search-project',
				filePath: projectEditor.projectRoot,
				operation: 'search-project',
			});
		}
	}
}
