//import type { JSX } from 'preact';
import { basename, join } from '@std/path';
import { exists } from '@std/fs';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { DataSourceHandlingErrorOptions, FileHandlingErrorOptions } from 'api/errors/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isPathWithinDataSource } from 'api/utils/fileHandling.ts';
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
				dataSource: {
					type: 'string',
					description:
						"Data source name to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				sources: {
					type: 'array',
					items: { type: 'string' },
					description: `Array of files or directories to move, relative to data source root. Important notes:

1. Path Requirements:
   * All paths must be relative to data source root
   * Sources must exist and be within data source
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
   * Consider impact on data source structure
   * Move related files together (source + test files)`,
				},
				destination: {
					type: 'string',
					description: `Target directory for moved files, relative to data source root. Important notes:

1. Directory Behavior:
   * Must be a directory path, not a file path
   * Files maintain their original names
   * Creates nested path if createMissingDirectories is true
   Examples:
   * "src/utils/new-location"
   * "tests/new-fixtures"
   * "docs/archive"

2. Path Requirements:
   * Must be within data source
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
						'When true, creates any missing directories in the destination path. Useful when moving files to a new data source structure. Example: Moving to "new/nested/dir" will create all parent directories.',
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
		const {
			sources,
			destination,
			overwrite = false,
			createMissingDirectories = false,
			dataSource: dataSourceId = undefined,
		} = toolInput as LLMToolMoveFilesInput;

		const { primaryDataSource, dataSources, notFound } = this.getDataSources(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
		//logger.info(`LLMToolMoveFiles: getDataSources`, { primaryDataSource, dataSources, notFound });
		if (!primaryDataSource) {
			throw createError(ErrorType.DataSourceHandling, `No primary data source`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dataSourceToUse = dataSources[0] || primaryDataSource;
		const dataSourceToUseId = dataSourceToUse.id;
		if (!dataSourceToUseId) {
			throw createError(ErrorType.DataSourceHandling, `No data source id`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}

		const dataSourceRoot = dataSourceToUse.getDataSourceRoot();
		if (!dataSourceRoot) {
			throw createError(ErrorType.DataSourceHandling, `No data source root`, {
				name: 'data-source',
				dataSourceIds: dataSourceId ? [dataSourceId] : undefined,
			} as DataSourceHandlingErrorOptions);
		}
		//logger.info(`LLMToolMoveFiles: dataSourceRoot: ${dataSourceRoot}`);
		// [TODO] check that dataSourceToUse is type filesystem

		try {
			// Validate paths
			if (!isPathWithinDataSource(dataSourceRoot, destination)) {
				throw createError(
					ErrorType.FileHandling,
					`Access denied: ${destination} is outside the data source directory`,
					{
						name: 'move-file',
						filePath: destination,
						operation: 'move',
					} as FileHandlingErrorOptions,
				);
			}

			const toolResultContentParts: LLMMessageContentParts = [];
			const movedSuccess: Array<{ name: string }> = [];
			const movedError: Array<{ name: string; error: string }> = [];
			let noFilesMoved = true;

			for (const source of sources) {
				if (!isPathWithinDataSource(dataSourceRoot, source)) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error moving file ${source}: Source path is outside the data source directory`,
					} as LLMMessageContentPartTextBlock);
					movedError.push({ name: source, error: 'Source path is outside the data source directory.' });
					continue;
				}

				try {
					const fullSourcePath = join(dataSourceRoot, source);

					const fullDestDirPath = join(dataSourceRoot, destination);
					const destPath = join(destination, basename(source));
					const fullDestPath = join(dataSourceRoot, destPath);

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
				dataSourceRoot,
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

			const dataSourceStatus = notFound.length > 0
				? `Could not find data source for: [${notFound.join(', ')}]`
				: `Data source: ${dataSourceToUse.name} [${dataSourceToUse.id}]`;
			toolResultContentParts.unshift({
				type: 'text',
				text: `Used data source: ${dataSourceToUse.name}`,
			});

			const toolResults = toolResultContentParts;
			const toolResponse = dataSourceStatus + '\n\n' + (noFilesMoved ? 'No files moved\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					filesMoved: movedSuccess.map((f) => f.name),
					filesError: movedError.map((f) => f.name),
					destination,
					dataSourceId,
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
