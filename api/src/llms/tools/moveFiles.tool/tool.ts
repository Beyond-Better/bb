import type { JSX } from 'preact';
import { basename, join } from '@std/path';
import { exists } from '@std/fs';

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
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';

interface MoveFilesParams {
	sources: string[];
	destination: string;
	overwrite?: boolean;
	createMissingDirectories?: boolean;
}

export default class LLMToolMoveFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: 'Paths of files or directories to be moved',
				},
				destination: {
					type: 'string',
					description: 'Path of the destination directory',
				},
				overwrite: {
					type: 'boolean',
					description: 'Whether to overwrite existing files at the destination',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description: 'Whether to create missing directories in the destination path',
					default: false,
				},
			},
			required: ['sources', 'destination'],
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
		const { sources, destination, overwrite = false, createMissingDirectories = false } =
			toolInput as MoveFilesParams;

		try {
			// Validate paths
			if (!isPathWithinProject(projectEditor.projectRoot, destination)) {
				throw createError(
					ErrorType.FileHandling,
					`Access denied: ${destination} is outside the project directory`,
					{
						name: 'move-file',
						filePath: destination,
						operation: 'move',
					} as FileHandlingErrorOptions,
				);
			}

			const toolResultContentParts = [];
			const movedSuccess: Array<{ name: string }> = [];
			const movedError: Array<{ name: string; error: string }> = [];
			let noFilesMoved = true;

			for (const source of sources) {
				if (!isPathWithinProject(projectEditor.projectRoot, source)) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error moving file ${source}: Source path is outside the project directory`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: 'Source path is outside the project directory.' });
					continue;
				}

				try {
					const fullSourcePath = join(projectEditor.projectRoot, source);

					const fullDestDirPath = join(projectEditor.projectRoot, destination);
					const destPath = join(destination, basename(source));
					const fullDestPath = join(projectEditor.projectRoot, destPath);

					// Check if destination exists
					if ((await exists(fullDestPath)) && !overwrite) {
						toolResultContentParts.push({
							'type': 'text',
							'text': `Destination ${destPath} already exists and overwrite is false`,
						} as LLMMessageContentPartTextBlock);
						movedError.push({
							name: source,
							error: `Destination ${destPath} already exists and overwrite is false.`,
						});
						continue;
					}

					// Create missing directories if needed
					if (createMissingDirectories) {
						await Deno.mkdir(fullDestDirPath, { recursive: true });
					}

					// Perform the move
					await Deno.rename(fullSourcePath, fullDestPath);

					toolResultContentParts.push({
						'type': 'text',
						'text': `File/Directory moved: ${source}`,
					} as LLMMessageContentPartTextBlock);
					movedSuccess.push({ name: source });
					noFilesMoved = false;
				} catch (error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `${source}: ${error.message}`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: error.message });
				}
			}

			const movedFiles = [];
			const movedContent = [];
			for (const moved of movedSuccess) {
				movedFiles.push(moved.name);
				movedContent.push(`${moved.name} moved to ${destination}`);
			}
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				movedFiles,
				movedContent,
			);

			const toolResponses = [];
			if (movedSuccess.length > 0) {
				toolResponses.push(
					`Moved files to ${destination}:\n${movedSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (movedError.length > 0) {
				toolResponses.push(
					`Failed to move files to ${destination}:\n${
						movedError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (noFilesMoved ? 'No files moved\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					filesMoved: movedSuccess.map((f) => f.name),
					filesError: movedError.map((f) => f.name),
					destination,
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(`Error moving files: ${error.message}`);
			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to move files. Error: ${error.message}`;
			const toolResponse = `Failed to move files. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
