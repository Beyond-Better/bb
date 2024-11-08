import type { JSX } from 'preact';

import { dirname, join } from '@std/path';
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
import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';

interface RenameFilesParams {
	operations: Array<{ source: string; destination: string }>;
	createMissingDirectories?: boolean;
	overwrite?: boolean;
}

export default class LLMToolRenameFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				operations: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							source: {
								type: 'string',
								description:
									'The current path of the file or directory to rename, relative to project root. Must exist and be within project. Examples:\n* "src/old-name.ts"\n* "tests/old_dir"\n* "config/legacy.json"',
							},
							destination: {
								type: 'string',
								description:
									'The new path for the file or directory, relative to project root. Must be within project. Parent directories will be created if createMissingDirectories is true. Examples:\n* "src/new-name.ts"\n* "tests/new_dir"\n* "config/current.json"',
							},
						},
						required: ['source', 'destination'],
					},
					description: `Array of rename operations to perform. Important considerations:

1. Path Requirements:
   * All paths must be relative to project root
   * Both source and destination must be within project
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
						'When true, creates any missing parent directories in destination paths. Useful when restructuring project layout. Example: "new/nested/dir/file.ts" will create all parent directories.',
					default: false,
				},
			},
			required: ['operations'],
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
		const { operations, overwrite = false, createMissingDirectories = false } = toolInput as RenameFilesParams;

		try {
			const toolResultContentParts = [];
			const renamedSuccess: Array<{ source: string; destination: string }> = [];
			const renamedError: Array<{ source: string; destination: string; error: string }> = [];
			let noFilesRenamed = true;

			for (const { source, destination } of operations) {
				if (
					!isPathWithinProject(projectEditor.projectRoot, source) ||
					!isPathWithinProject(projectEditor.projectRoot, destination)
				) {
					toolResultContentParts.push({
						'type': 'text',
						'text':
							`Error renaming file ${source}: Source or destination path is outside the project directory`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({
						source,
						destination,
						error: 'Source or destination path is outside the project directory.',
					});
					continue;
				}
				const fullSourcePath = join(projectEditor.projectRoot, source);
				const fullDestPath = join(projectEditor.projectRoot, destination);

				try {
					// Check if destination exists
					if ((await exists(fullDestPath)) && !overwrite) {
						toolResultContentParts.push({
							'type': 'text',
							'text': `Destination ${destination} already exists and overwrite is false`,
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
						'type': 'text',
						'text': `File/Directory renamed: ${source} -> ${destination}`,
					} as LLMMessageContentPartTextBlock);
					renamedSuccess.push({ source, destination });
					noFilesRenamed = false;
				} catch (error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `${source}: ${error.message}`,
					} as LLMMessageContentPartTextBlock);
					renamedError.push({ source, destination, error: error.message });
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

			const toolResults = toolResultContentParts;
			const toolResponse = (noFilesRenamed ? 'No files renamed\n' : '') + toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					filesRenamed: renamedSuccess,
					filesError: renamedError,
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
			};
		} catch (error) {
			logger.error(`LLMToolRenameFiles: Error renaming files: ${error.message}`);

			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to rename files. Error: ${error.message}`;
			const toolResponse = `Failed to rename files. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
