import type { JSX } from 'preact';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';

export default class LLMToolSearchAndReplace extends LLMTool {
	private static readonly MIN_SEARCH_LENGTH = 1;

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description:
						'The path of the file to be modified or created, relative to the project root. Example: "src/config.ts"',
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							search: {
								type: 'string',
								description:
									'The text to search for in the file. Two modes available:\n\n1. Literal mode (default):\n* Must match the file content EXACTLY, including all whitespace and indentation\n* Special characters are matched literally\n* Example: "  const x = 10;" will only match if the spaces and semicolon exist\n\n2. Regex mode (set regexPattern: true):\n* Use JavaScript regex patterns\n* Can match varying whitespace with patterns like "\\s+"\n* Example: "const\\s+x\\s*=\\s*10" matches various spacing around "const x = 10"',
							},
							replace: {
								type: 'string',
								description:
									'The text to replace matches with. Important notes:\n* In literal mode: Match the indentation level of the original text\n* In regex mode: Use $1, $2, etc. for capture groups\n* Preserve line endings and spacing for clean diffs\nExample: If replacing "  const x = 10;" keep the leading spaces in the replacement',
							},
							regexPattern: {
								type: 'boolean',
								description:
									'When true, treats search as a JavaScript regex pattern. When false (default), matches text literally including all whitespace. Examples:\n* false: "function main" matches that exact text with one space\n* true: "function\\s+main" matches the text with any whitespace between words',
								default: false,
							},
							replaceAll: {
								type: 'boolean',
								description:
									'When true, replaces all occurrences of the search text. When false (default), replaces only the first occurrence. Use carefully with regex patterns.',
								default: false,
							},
							caseSensitive: {
								type: 'boolean',
								description:
									'When true (default), matches must have exact case. When false, matches ignore case. Examples:\n* true: "Constructor" only matches "Constructor"\n* false: "constructor" matches "Constructor" and "constructor"',
								default: true,
							},
						},
						required: ['search', 'replace'],
					},
					description:
						'Array of search and replace operations to apply in sequence. Each operation is applied to the result of previous operations.',
				},
				createIfMissing: {
					type: 'boolean',
					description:
						"When true (recommended), creates the file and any missing parent directories if they don't exist. When false, fails if the file doesn't exist.",
					default: true,
				},
			},
			required: ['filePath', 'operations'],
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
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		let allOperationsFailed = true;
		let allOperationsSucceeded = true;
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, operations, createIfMissing = true } = toolInput as {
			filePath: string;
			operations: Array<
				{
					search: string;
					replace: string;
					regexPattern?: boolean;
					replaceAll?: boolean;
					caseSensitive?: boolean;
				}
			>;
			createIfMissing?: boolean;
		};

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'search-and-replace',
				filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`LLMToolSearchAndReplace: Handling search and replace for file: ${fullFilePath}`);

		try {
			let content: string;
			let isNewFile = false;
			try {
				content = await Deno.readTextFile(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					content = '';
					isNewFile = true;
					logger.info(`LLMToolSearchAndReplace: File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`LLMToolSearchAndReplace: Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			const operationResults = [];
			const successfulOperations = [];
			for (const [index, operation] of operations.entries()) {
				const { search, replace, regexPattern = false, replaceAll = false, caseSensitive = true } = operation;
				const operationWarnings = [];
				let operationSuccess = false;

				// Validate search string
				if (!isNewFile && search.length < LLMToolSearchAndReplace.MIN_SEARCH_LENGTH) {
					operationWarnings.push(
						`Search string is too short (minimum ${LLMToolSearchAndReplace.MIN_SEARCH_LENGTH} character(s)) for existing file.`,
					);
					continue;
				}

				// Validate that search and replace strings are different
				if (search === replace) {
					operationWarnings.push('Search and replace strings are identical.');
					continue;
				}

				const originalContent = content;

				let searchPattern: string | RegExp;

				const escapeRegExp = (str: string) => str.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
				const flags = `${replaceAll ? 'g' : ''}${caseSensitive ? '' : 'i'}`;

				if (regexPattern) {
					searchPattern = new RegExp(search, flags);
				} else if (!caseSensitive) {
					// literal search, but case insensitive so must use a regex - escape regex special characters
					searchPattern = new RegExp(escapeRegExp(search), flags);
				} else {
					// literal search that is case sensitive
					searchPattern = search;
				}
				//logger.info(`LLMToolSearchAndReplace: Searching for pattern: `, searchPattern);

				content = replaceAll && searchPattern instanceof RegExp
					? content.replaceAll(searchPattern, replace)
					: content.replace(searchPattern, replace);

				// Check if the content actually changed
				if (content !== originalContent) {
					operationSuccess = true;
					allOperationsFailed = false;
					successfulOperations.push(operation);
				} else {
					operationWarnings.push(
						'No changes were made. The search string was not found in the file content.',
					);
					allOperationsSucceeded = false;
				}

				if (operationWarnings.length > 0) {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} warnings: ${operationWarnings.join(' ')}`,
					});
					allOperationsSucceeded = false;
				} else if (operationSuccess) {
					operationResults.push({
						operationIndex: index,
						status: 'success',
						message: `Operation ${index + 1} completed successfully`,
					});
				} else {
					operationResults.push({
						operationIndex: index,
						status: 'warning',
						message: `Operation ${index + 1} failed: No changes were made`,
					});
					allOperationsSucceeded = false;
				}
			}

			if (successfulOperations.length > 0 || isNewFile) {
				await Deno.writeTextFile(fullFilePath, content);

				logger.info(
					`LLMToolSearchAndReplace: Saving conversation search and replace operations: ${interaction.id}`,
				);
				await projectEditor.orchestratorController.logChangeAndCommit(
					interaction,
					filePath,
					JSON.stringify(successfulOperations),
				);

				const toolResultContentParts: LLMMessageContentParts = operationResults.map((
					result: { status: string; operationIndex: number; message: string },
				) => ({
					type: 'text',
					text: `${result.status === 'success' ? '✅  ' : '⚠️  '}${result.message}`,
				}));

				const operationStatus = allOperationsSucceeded
					? 'All operations succeeded'
					: (allOperationsFailed ? 'All operations failed' : 'Partial operations succeeded');
				toolResultContentParts.unshift({
					type: 'text',
					text: `${
						isNewFile ? 'File created and s' : 'S'
					}earch and replace operations applied to file: ${filePath}. ${operationStatus}.`,
				});

				const toolResults = toolResultContentParts;
				const toolResponse = operationStatus;
				const bbResponse = `BB applied search and replace operations.`;

				return { toolResults, toolResponse, bbResponse };
			} else {
				const noChangesMessage = `No changes were made to the file: ${filePath}. Results: ${
					JSON.stringify(operationResults)
				}`;
				logger.info(`LLMToolSearchAndReplace: ${noChangesMessage}`);

				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'search-and-replace',
					filePath: filePath,
					operation: 'search-replace',
				} as FileHandlingErrorOptions);

				//const toolResultContentParts: LLMMessageContentParts = [{
				//	type: 'text',
				//	text: noChangesMessage,
				//}];
				//return { toolResults: toolResultContentParts, toolResponse: noChangesMessage, bbResponse: noChangesMessage };
			}
		} catch (error) {
			if ((error as Error).name === 'search-and-replace') {
				throw error;
			}
			const errorMessage = `Failed to apply search and replace to ${filePath}: ${(error as Error).message}`;
			logger.error(`LLMToolSearchAndReplace: ${errorMessage}`);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'search-and-replace',
				filePath: filePath,
				operation: 'search-replace',
			} as FileHandlingErrorOptions);
		}
	}
}
