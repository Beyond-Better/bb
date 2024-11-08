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
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

import { ensureDir } from '@std/fs';
import { dirname, join } from '@std/path';

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
			},
			required: ['filePath', 'content'],
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
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { filePath, content, createIfMissing = true } = toolInput as {
			filePath: string;
			content: string;
			createIfMissing?: boolean;
		};

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

			if (!content) {
				const noChangesMessage =
					`No changes were made to the file: ${filePath}. The content for the file is empty.`;
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

			const toolResults = `File ${filePath} ${isNewFile ? 'created' : 'rewritten'} with new contents.`;
			const toolResponse = isNewFile ? 'Created a new file' : 'Rewrote existing file';
			const bbResponse = `BB ${isNewFile ? 'created' : 'rewrote'} file ${filePath} with new contents.`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			if (error.name === 'rewrite-file') {
				throw error;
			}
			const errorMessage = `Failed to write contents to ${filePath}: ${error.message}`;
			logger.error(`LLMToolRewriteFile: ${errorMessage}`);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath: filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}
	}
}
