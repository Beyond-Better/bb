//import type { JSX } from 'preact';
import { basename, join } from '@std/path';
import { exists } from '@std/fs';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolMoveFilesInput } from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';

export default class LLMToolMoveFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: `Array of files or directories to move, relative to project root. Important notes:

1. Path Requirements:
   * All paths must be relative to project root
   * Sources must exist and be within project
   * File names are preserved during move
   Examples:
   * ["src/utils/old-location/helper.ts"]
   * ["tests/fixtures/data.json"]
   * ["docs/old-location"]

2. Common Move Patterns:
   * Move related files together:
     ["src/components/Button.tsx", "src/components/Button.test.tsx"]
   * Move directory with contents:
     ["src/legacy-utils"]
   * Move multiple files to new location:
     ["src/types/interfaces.ts", "src/types/constants.ts"]

3. Safety Considerations:
   * Check for import/require statements that reference moved files
   * Update any relative imports in moved files
   * Consider impact on project structure
   * Move related files together (source + test files)`,
				},
				destination: {
					type: 'string',
					description: `Target directory for moved files, relative to project root. Important notes:

1. Directory Behavior:
   * Must be a directory path, not a file path
   * Files maintain their original names
   * Creates nested path if createMissingDirectories is true
   Examples:
   * "src/utils/new-location"
   * "tests/new-fixtures"
   * "docs/archive"

2. Path Requirements:
   * Must be within project
   * Parent directory must exist (unless createMissingDirectories is true)
   * Must have write permission`,
				},
				overwrite: {
					type: 'boolean',
					description:
						'When true, allows overwriting existing files at destination. Use with caution as this can cause data loss. Example: If "utils/helper.ts" exists at destination, moving another "helper.ts" with overwrite:true will replace it.',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description:
						'When true, creates any missing directories in the destination path. Useful when moving files to a new project structure. Example: Moving to "new/nested/dir" will create all parent directories.',
					default: false,
				},
			},
			required: ['sources', 'destination'],
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
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { sources, destination, overwrite = false, createMissingDirectories = false } =
			toolInput as LLMToolMoveFilesInput;

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
						'text': `${source}: ${(error as Error).message}`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: (error as Error).message });
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
			logger.error(`LLMToolMoveFiles: Error moving files: ${(error as Error).message}`);
			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to move files. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to move files. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
