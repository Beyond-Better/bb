import { JSX } from 'preact';
import LLMTool, { LLMToolInputSchema, LLMToolRunResult, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatters/rewriteFileTool.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatters/rewriteFileTool.console.ts';
import LLMConversationInteraction from '../interactions/conversationInteraction.ts';
import ProjectEditor from '../../editor/projectEditor.ts';
import { isPathWithinProject } from '../../utils/fileHandling.utils.ts';
import { createError, ErrorType } from '../../utils/error.utils.ts';
import { FileHandlingErrorOptions } from '../../errors/error.ts';
import { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { logger } from 'shared/logger.ts';
import { ensureDir } from '@std/fs';
import { dirname, join } from '@std/path';
// Removed unused import

export default class LLMToolRewriteFile extends LLMTool {
	constructor() {
		super(
			'rewrite_file',
			'Rewrite an entire file or create a new one',
		);
		this.fileName = 'rewriteFileTool.ts';
	}

	get input_schema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: { type: 'string', description: 'The path of the file to be rewritten or created' },
				content: { type: 'string', description: 'The new content of the file' },
				createIfMissing: {
					type: 'boolean',
					description: 'Create the file if it does not exist',
					default: true,
				},
			},
			required: ['filePath', 'content'],
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(toolResult: LLMToolRunResultContent, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(toolResult) : formatToolResultBrowser(toolResult);
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
		logger.info(`Handling rewrite for file: ${fullFilePath}`);

		try {
			let isNewFile = false;
			try {
				await Deno.stat(fullFilePath);
			} catch (error) {
				if (error instanceof Deno.errors.NotFound && createIfMissing) {
					isNewFile = true;
					logger.info(`File ${fullFilePath} not found. Creating new file.`);
					// Create missing directories
					await ensureDir(dirname(fullFilePath));
					logger.info(`Created directory structure for ${fullFilePath}`);
				} else {
					throw error;
				}
			}

			if (!content) {
				const noChangesMessage =
					`No changes were made to the file: ${filePath}. The content for the file is empty.`;
				logger.info(noChangesMessage);
				throw createError(ErrorType.FileHandling, noChangesMessage, {
					name: 'rewrite-file',
					filePath: filePath,
					operation: 'rewrite-file',
				} as FileHandlingErrorOptions);
			}

			await Deno.writeTextFile(fullFilePath, content);

			logger.info(`Saving conversation rewrite file: ${interaction.id}`);
			await projectEditor.orchestratorController.logPatchAndCommit(
				interaction,
				filePath,
				content,
			);

			const toolResults = `File ${filePath} ${isNewFile ? 'created' : 'rewritten'} with new contents.`;
			const toolResponse = isNewFile ? 'Created a new file' : 'Rewrote existing file';
			const bbaiResponse = `BBai ${isNewFile ? 'created' : 'rewrote'} file: ${filePath}`;

			return { toolResults, toolResponse, bbaiResponse };
		} catch (error) {
			if (error.name === 'rewrite-file') {
				throw error;
			}
			let errorMessage = `Failed to write contents to ${filePath}: ${error.message}`;
			logger.error(errorMessage);

			throw createError(ErrorType.FileHandling, errorMessage, {
				name: 'rewrite-file',
				filePath: filePath,
				operation: 'rewrite-file',
			} as FileHandlingErrorOptions);
		}
	}
}
