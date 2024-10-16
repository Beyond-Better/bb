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
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { isPathWithinProject } from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
//import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolForgetFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				files: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							filePath: {
								type: 'string',
								description: 'The path of the file to be removed from the chat',
							},
							revision: {
								type: 'string',
								description: 'The revision of the file to be removed from the chat',
							},
						},
						required: ['filePath', 'revision'],
					},
					description: 'Array of files to be removed from the chat',
				},
			},
			required: ['files'],
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
		const { files } = toolInput as { files: Array<{ filePath: string; revision: string }> };

		try {
			const toolResultContentParts = [];
			const filesSuccess: Array<{ filePath: string; revision: string }> = [];
			const filesError: Array<{ filePath: string; revision: string; error: string }> = [];
			let allFilesFailed = true;

			for (const { filePath, revision } of files) {
				if (interaction.getFileMetadata(filePath, revision)) {
					interaction.removeFile(filePath, revision);
					toolResultContentParts.push({
						'type': 'text',
						'text': `File removed: ${filePath} (Revision: ${revision})`,
					} as LLMMessageContentPartTextBlock);
					filesSuccess.push({ filePath, revision });
					allFilesFailed = false;
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error removing file ${filePath}: File is not in the conversation history`,
					} as LLMMessageContentPartTextBlock);
					filesError.push({ filePath, revision, error: 'File is not in the conversation history' });
				}
			}

			const bbResponses = [];
			const toolResponses = [];
			if (filesSuccess.length > 0) {
				bbResponses.push(
					`BB has removed these files from the conversation: ${
						filesSuccess.map((f) => `${f.filePath} (Revision: ${f.revision})`).join(', ')
					}`,
				);
				toolResponses.push(
					`Removed files from the conversation:\n${
						filesSuccess.map((f) => `- ${f.filePath} (Revision: ${f.revision})`).join('\n')
					}`,
				);
			}
			if (filesError.length > 0) {
				bbResponses.push(
					`BB failed to remove these files from the conversation:\n${
						filesError.map((f) => `- ${f.filePath} (${f.revision}): ${f.error}`).join('\n')
					}`,
				);
				toolResponses.push(
					`Failed to remove files from the conversation:\n${
						filesError.map((f) => `- ${f.filePath} (${f.revision}): ${f.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (allFilesFailed ? 'No files removed\n' : '') + toolResponses.join('\n\n');
			const bbResponse = bbResponses.join('\n\n');

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`Error removing files from conversation: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error removing files from conversation: ${error.message}`, {
				name: 'forget-files',
				filePath: projectEditor.projectRoot,
				operation: 'forget-files',
			});
		}
	}
}
