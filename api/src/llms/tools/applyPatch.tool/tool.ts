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
import type { LLMAnswerToolUse, LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { dirname, join } from '@std/path';
import { ensureDir } from '@std/fs';
import * as diff from 'diff';

export default class LLMToolApplyPatch extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to be patched. Optional for multi-file patches.',
				},
				patch: {
					type: 'string',
					description: 'The carefully written and well-formed patch to be applied in unified diff format',
				},
			},
			required: ['patch'],
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
		const patchedFiles: string[] = [];
		const patchContents: string[] = [];
		const { toolInput } = toolUse;
		const { filePath, patch } = toolInput as { filePath?: string; patch: string };

		const parsedPatch = diff.parsePatch(patch);
		const modifiedFiles: string[] = [];
		const newFiles: string[] = [];

		try {
			for (const patchPart of parsedPatch) {
				const currentFilePath = patchPart.newFileName || filePath;
				if (!currentFilePath) {
					throw new Error('File path is undefined');
				}
				logger.info(`Checking location of file: ${currentFilePath}`);

				if (!await isPathWithinProject(projectEditor.projectRoot, currentFilePath)) {
					throw createError(
						ErrorType.FileHandling,
						`Access denied: ${currentFilePath} is outside the project directory`,
						{
							name: 'apply-patch',
							filePath: currentFilePath,
							operation: 'apply-patch',
						} as FileHandlingErrorOptions,
					);
				}

				const fullFilePath = join(projectEditor.projectRoot, currentFilePath);

				if (patchPart.oldFileName === '/dev/null') {
					// This is a new file
					newFiles.push(currentFilePath);
					const newFileContent = patchPart.hunks.map((h) =>
						h.lines.filter((l) => l[0] === '+').map((l) => l.slice(1)).join('\n')
					).join('\n');

					await ensureDir(dirname(fullFilePath));
					await Deno.writeTextFile(fullFilePath, newFileContent);
					logger.info(`Created new file: ${currentFilePath}`);
				} else {
					// Existing file, apply patch
					modifiedFiles.push(currentFilePath);
					const currentContent = await Deno.readTextFile(fullFilePath);

					const patchedContent = diff.applyPatch(currentContent, patchPart, {
						fuzzFactor: 2,
					});

					if (patchedContent === false) {
						const errorMessage =
							`Failed to apply patch to ${currentFilePath}. The patch does not match the current file content. ` +
							'Consider using the `search_and_replace` tool for more precise modifications.';
						throw createError(ErrorType.FileHandling, errorMessage, {
							name: 'apply-patch',
							filePath: currentFilePath,
							operation: 'change',
						} as FileHandlingErrorOptions);
					}

					await Deno.writeTextFile(fullFilePath, patchedContent);
					logger.info(`Patch applied to existing file: ${currentFilePath}`);
				}

				// [TODO] the `logChangeAndCommit` (used below) is already adding to patchedFiles and patchContents
				// Is this legacy usage and should be removed, or do we need it for multi-part patches
				projectEditor.changedFiles.add(currentFilePath);
				// [TODO] for multiple patch parts - will subsequent overwrite the first??
				projectEditor.changeContents.set(currentFilePath, patch);
			}

			// Prepare arrays for logChangeAndCommit
			patchedFiles.push(...modifiedFiles, ...newFiles);
			patchContents.push(...patchedFiles.map((file) => projectEditor.changeContents.get(file) || ''));

			// Log patch and commit for all modified files
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				patchedFiles,
				patchContents,
			);

			const toolResultContentParts: LLMMessageContentParts = [
				{
					type: 'text',
					text: `✅ Patch applied successfully to ${modifiedFiles.length + newFiles.length} file(s)`,
				},
				...modifiedFiles.map((
					file,
				) => ({ type: 'text', text: `📝 Modified: ${file}` } as LLMMessageContentPartTextBlock)),
				...newFiles.map((
					file,
				) => ({ type: 'text', text: `📄 Created: ${file}` } as LLMMessageContentPartTextBlock)),
			];

			const toolResults = toolResultContentParts;
			const toolResponse = `Applied patch successfully to ${modifiedFiles.length + newFiles.length} file(s)`;
			const bbResponse = {
				data: {
					modifiedFiles,
					newFiles,
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `File not found: ${error.message}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied: ${error.message}`;
			} else {
				errorMessage = `Failed to apply patch: ${error.message}`;
			}
			logger.error(errorMessage);

			const toolResultContentParts: LLMMessageContentParts = [
				{
					type: 'text',
					text: `⚠️  ${errorMessage}`,
				},
			];

			const bbResponse = `BB failed to apply patch. Error: ${errorMessage}`;
			const toolResponse = `Failed to apply patch. Error: ${errorMessage}`;
			return { toolResults: toolResultContentParts, toolResponse, bbResponse };
		}
	}
}
