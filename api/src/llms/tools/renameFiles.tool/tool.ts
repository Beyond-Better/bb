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
							source: { type: 'string', description: 'The source path for the file or directory' },
							destination: {
								type: 'string',
								description: 'The destination path for the file or directory',
							},
						},
						required: ['source', 'destination'],
					},
					description: 'Array of rename operations, each containing source and destination paths',
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
			logger.error(`Error renaming files: ${error.message}`);

			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to rename files. Error: ${error.message}`;
			const toolResponse = `Failed to rename files. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
