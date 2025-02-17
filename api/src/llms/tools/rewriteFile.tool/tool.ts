//import type { JSX } from 'preact';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type { LLMToolRewriteFileInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

import { ensureDir } from '@std/fs';
import { dirname, join } from '@std/path';

//const ACKNOWLEDGMENT_STRING = 'I confirm this is the complete file content with no omissions or placeholders';
const ACKNOWLEDGMENT_STRING =
	'I have checked for existing file contents and confirm this is the complete file content with no omissions or placeholders';

function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function getLineCount(content: string): number {
	if (!content) return 0;
	const normalized = normalizeLineEndings(content);
	// Handle empty file (0 bytes) and single empty line as equivalent
	if (normalized === '' || normalized === '\n') return 0;
	// Count lines, handling final newline
	const lines = normalized.split('\n');
	return lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
}

function validateLineCount(actualCount: number, expectedCount: number): { valid: boolean; tolerance: number } {
	// Define tolerance based on file size
	let tolerance: number;
	if (actualCount < 10) {
		tolerance = 0; // Exact match for small files
	} else if (actualCount < 100) {
		tolerance = 2; // ±2 lines for medium files
	} else {
		tolerance = Math.ceil(actualCount * 0.05); // 5% tolerance for large files
	}

	const difference = Math.abs(actualCount - expectedCount);
	return {
		valid: difference <= tolerance,
		tolerance,
	};
}

function validateAcknowledgment(acknowledgment: string): boolean {
	// Case-insensitive comparison
	const normalized = acknowledgment.trim().toLowerCase();
	const expected = ACKNOWLEDGMENT_STRING.toLowerCase();

	// Remove any final punctuation
	const withoutPunctuation = normalized.replace(/[.!?]$/, '');

	return withoutPunctuation === expected;
}

// Additional Enforcement Option:
// - Add a required parameter to rewrite_file: "existingContentChecked": boolean
// - Add a required parameter: "contentComparison": string - must include diff or "new file"
// - Make the tool fail if these aren't provided
// - Force explicit acknowledgment of content changes

export default class LLMToolRewriteFile extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description:
						'The path of the file to be rewritten or created, relative to the project root. Must be within the project directory.',
				},
				content: {
					type: 'string',
					description:
						"The complete new content that will replace the file's existing content. IMPORTANT: Must include the entire desired file contents - partial content or placeholders are not allowed. The file will be completely overwritten with this content.",
				},
				createIfMissing: {
					type: 'boolean',
					description:
						'Whether to create the file if it does not exist. When true, missing parent directories will also be created.',
					default: true,
				},
				allowEmptyContent: {
					type: 'boolean',
					description:
						'Whether to allow empty content (0 bytes) or a single empty line. Default is false to prevent accidental file emptying.',
					default: false,
				},
				acknowledgement: {
					type: 'string',
					description:
						'Required confirmation string acknowledging that the content is complete. Must be exactly: "' +
						ACKNOWLEDGMENT_STRING + '" (case insensitive, may include final punctuation)',
				},
				expectedLineCount: {
					type: 'number',
					description:
						'The expected number of lines in the content. Be sure to include empty lines in your count. Must match the actual line count within tolerance:\n' +
						'- <10 lines: Exact match required\n' +
						'- <100 lines: ±2 lines tolerance\n' +
						'- ≥100 lines: ±5% tolerance\n' +
						'Empty files (0 bytes) and single empty lines are treated as 0 lines.',
				},
			},
			required: ['filePath', 'content', 'acknowledgement', 'expectedLineCount'],
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
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const {
			filePath,
			content,
			createIfMissing = true,
			allowEmptyContent = false,
			acknowledgement,
			expectedLineCount,
		} = toolInput as LLMToolRewriteFileInput;

		// Validate acknowledgment string
		if (!validateAcknowledgment(acknowledgement)) {
			const errorMessage = 'Invalid acknowledgement string. Must be exactly: "' + ACKNOWLEDGMENT_STRING +
				'" (case insensitive, may include final punctuation).\n\n' +
				'This validation ensures you are aware that:\n' +
				'1. The provided content will completely replace the file\n' +
				'2. Any existing content not included will be permanently lost\n' +
				'3. Placeholder comments like "// Rest of file remains..." are not allowed\n' +
				'4. You must provide ALL imports, types, and code';

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}

		// Validate line count
		const actualLineCount = getLineCount(content);
		const lineCountValidation = validateLineCount(actualLineCount, expectedLineCount);
		let lineCountErrorMessage = '';
		if (!lineCountValidation.valid) {
			lineCountErrorMessage =
				`Line count mismatch. Content has ${actualLineCount} lines but expected ${expectedLineCount} lines.`;

			/*
			const errorMessage =
				`Line count mismatch. Content has ${actualLineCount} lines but expected ${expectedLineCount} lines.\n\n` +
				`For files with ${actualLineCount} lines, the tolerance is ±${lineCountValidation.tolerance} lines.\n\n` +
				'Common fixes:\n' +
				'1. Count the actual lines in your content\n' +
				'2. Include all necessary imports and code\n' +
				'3. Remove any placeholder comments\n' +
				'4. Ensure no content is accidentally omitted\n' +
				'5. Check for missing closing braces or tags';

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
			 */
		}

		if (!await isPathWithinProject(projectEditor.projectRoot, filePath)) {
			throw createError(ErrorType.FileHandling, `Access denied: ${filePath} is outside the project directory`, {
				name: 'rewrite-file',
				filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}

		const fullFilePath = join(projectEditor.projectRoot, filePath);
		logger.info(`LLMToolRewriteFile: Handling rewrite for file: ${fullFilePath}`);

		try {
			let isNewFile = false;
			try {
				await Deno.stat(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					isNewFile = true;
					logger.info(`LLMToolRewriteFile: File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`LLMToolRewriteFile: Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			if (!content && !allowEmptyContent) {
				const noChangesMessage =
					`No changes were made to the file: ${filePath}. The content is empty and allowEmptyContent is false.\n\n` +
					'To intentionally empty a file, set allowEmptyContent: true';
				logger.info(`LLMToolRewriteFile: ${noChangesMessage}`);
				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'rewrite-file',
					filePath: filePath,
					operation: 'rewrite-file',
				} as FileHandlingErrorOptions);
			}

			await Deno.writeTextFile(fullFilePath, content);

			logger.info(`LLMToolRewriteFile: Saving conversation rewrite file: ${interaction.id}`);
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				filePath,
				content,
			);

			const toolResults = `File ${filePath} ${
				isNewFile ? 'created' : 'rewritten'
			} with new contents (${actualLineCount} lines).`;
			const toolResponse = `${
				isNewFile ? 'Created' : 'Rewrote'
			} ${filePath} with ${actualLineCount} lines of content`;
			// const bbResponse = `BB ${
			// 	isNewFile ? 'created' : 'rewrote'
			// } file ${filePath} with new contents (${actualLineCount} lines).${
			// 	lineCountErrorMessage ? `\n${lineCountErrorMessage}` : ''
			// }`;

			return {
				toolResults,
				toolResponse,
				bbResponse: {
					data: {
						filePath,
						lineCount: actualLineCount,
						isNewFile,
						lineCountError: lineCountErrorMessage || undefined,
					},
				},
			};
		} catch (error) {
			if ((error as Error).name === 'rewrite-file') {
				throw error;
			}
			const errorMessage = `Failed to write contents to ${filePath}: ${(error as Error).message}`;
			logger.error(`LLMToolRewriteFile: ${errorMessage}`);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath: filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}
	}
}
