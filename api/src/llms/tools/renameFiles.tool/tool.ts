import { dirname, join } from '@std/path';
import { exists } from '@std/fs';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type { LLMToolRenameFilesInput, LLMToolRenameFilesResult } from './types.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { isPathWithinDataSource } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolRenameFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				dataSource: {
					type: 'string',
					description:
						"Data source name to operate on. Defaults to the primary data source if omitted. Examples: 'primary', 'filesystem-1', 'db-staging'. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
				},
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							source: {
								type: 'string',
								description:
									'The current path of the file or directory to rename, relative to data source root. Must exist and be within data source. Examples:\n* "src/old-name.ts"\n* "tests/old_dir"\n* "config/legacy.json"',
							},
							destination: {
								type: 'string',
								description:
									'The new path for the file or directory, relative to data source root. Must be within data source. Parent directories will be created if createMissingDirectories is true. Examples:\n* "src/new-name.ts"\n* "tests/new_dir"\n* "config/current.json"',
							},
						},
						required: ['source', 'destination'],
					},
					description: `Array of rename operations to perform. Important considerations:

1. Path Requirements:
   * All paths must be relative to data source root
   * Both source and destination must be within data source
   * Source must exist (unless overwrite is true)
   * Parent directories in destination path must exist (unless createMissingDirectories is true)

2. Common Rename Patterns:
   * File extension update: "file.js" -> "file.ts"
   * Name convention change: "oldName.ts" -> "new-name.ts"
   * Directory restructure: "old/path/file.ts" -> "new/path/file.ts"

3. Safety Considerations:
   * Check for existing files at destination
   * Consider impact on imports and references
   * Batch related renames together
   * Use overwrite with caution

4. Examples of Batch Operations:
   * Rename file and its test:
     [
       { source: "src/handler.ts", destination: "src/processor.ts" },
       { source: "tests/handler.test.ts", destination: "tests/processor.test.ts" }
     ]
   * Move directory with contents:
     [
       { source: "old/config", destination: "new/config" }
     ]`,
				},
				overwrite: {
					type: 'boolean',
					description:
						'When true, allows overwriting existing files at destination paths. Use with caution as this can cause data loss. Default is false for safety.',
					default: false,
				},
				createMissingDirectories: {
					type: 'boolean',
					description:
						'When true, creates any missing parent directories in destination paths. Useful when restructuring data source layout. Example: "new/nested/dir/file.ts" will create all parent directories.',
					default: false,
				},
			},
			required: ['operations'],
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
			operations,
			overwrite = false,
			createMissingDirectories = false,
			dataSource: dataSourceId = undefined,
		} = toolInput as LLMToolRenameFilesInput;

		const { primaryDataSource, dataSources, notFound } = this.getDataSources(
			projectEditor,
			dataSourceId ? [dataSourceId] : undefined,
		);
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
		// [TODO] check that dataSourceToUse is type filesystem

		try {
			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const renamedSuccess: Array<{ source: string; destination: string }> = [];
			const renamedError: Array<{ source: string; destination: string; error: string }> = [];
			let noFilesRenamed = true;

			for (const { source, destination } of operations) {
				if (
					!isPathWithinDataSource(dataSourceRoot, source) ||
					!isPathWithinDataSource(dataSourceRoot, destination)
				) {
					toolResultContentParts.push({
						type: 'text',
						text:
							`Error renaming file ${source}: Source or destination path is outside the data source directory`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({
						source,
						destination,
						error: 'Source or destination path is outside the data source directory.',
					});
					continue;
				}
				const fullSourcePath = join(dataSourceRoot, source);
				const fullDestPath = join(dataSourceRoot, destination);

				try {
					// Check if destination exists
					if ((await exists(fullDestPath)) && !overwrite) {
						toolResultContentParts.push({
							type: 'text',
							text: `Destination ${destination} already exists and overwrite is false`,
						} as LLMMessageContentPartTextBlock);
						renamedError.push({
							source,
							destination,
							error: `Destination ${destination} already exists and overwrite is false.`,
						});
						continue;
					}

					// Create missing directories if needed
					if (createMissingDirectories) {
						await Deno.mkdir(dirname(fullDestPath), { recursive: true });
					}

					// Perform the rename
					await Deno.rename(fullSourcePath, fullDestPath);

					toolResultContentParts.push({
						type: 'text',
						text: `File/Directory renamed: ${source} -> ${destination}`,
					} as LLMMessageContentPartTextBlock);
					renamedSuccess.push({ source, destination });
					noFilesRenamed = false;
				} catch (error) {
					toolResultContentParts.push({
						type: 'text',
						text: `${source}: ${(error as Error).message}`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({ source, destination, error: (error as Error).message });
				}
			}

			const renamedFiles = [];
			const renamedContent = [];
			for (const renamed of renamedSuccess) {
				renamedFiles.push(renamed.source);
				renamedContent.push(`${renamed.source} renamed to ${renamed.destination}`);
			}
			await projectEditor.orchestratorController.logChangeAndCommit(
				interaction,
				dataSourceRoot,
				renamedFiles,
				renamedContent,
			);

			const toolResponses = [];
			if (renamedSuccess.length > 0) {
				toolResponses.push(
					`Renamed files:\n${renamedSuccess.map((f) => `- ${f.source} -> ${f.destination}`).join('\n')}`,
				);
			}
			if (renamedError.length > 0) {
				toolResponses.push(
					`Failed to rename files:\n${
						renamedError.map((f) => `- ${f.source} -> ${f.destination}: ${f.error}`).join('\n')
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
			const toolResponse = dataSourceStatus + '\n\n' + (noFilesRenamed ? 'No files renamed\n' : '') +
				toolResponses.join('\n\n');
			const bbResponse: LLMToolRenameFilesResult['bbResponse'] = {
				data: {
					filesRenamed: renamedSuccess,
					filesError: renamedError,
					dataSourceId: dataSourceId || '',
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(`LLMToolRenameFiles: Error renaming files: ${(error as Error).message}`);

			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to rename files. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to rename files. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
