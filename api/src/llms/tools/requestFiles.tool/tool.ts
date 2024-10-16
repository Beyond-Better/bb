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
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolRequestFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				fileNames: {
					type: 'array',
					items: { type: 'string' },
					description: 'Array of file names to be added to the chat',
				},
			},
			required: ['fileNames'],
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
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			const filesAdded = await projectEditor.prepareFilesForConversation(fileNames);

			const toolResultContentParts = [];
			const filesSuccess: Array<{ name: string }> = [];
			const filesError: Array<{ name: string; error: string }> = [];
			let allFilesFailed = true;

			for (const fileToAdd of filesAdded) {
				if (fileToAdd.metadata.error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error adding file ${fileToAdd.fileName}: ${fileToAdd.metadata.error}`,
					} as LLMMessageContentPartTextBlock);
					filesError.push({
						name: fileToAdd.fileName,
						error: fileToAdd.metadata.error,
					});
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `File added: ${fileToAdd.fileName}`,
					} as LLMMessageContentPartTextBlock);
					filesSuccess.push({ name: fileToAdd.fileName });
					allFilesFailed = false;
				}
			}

			//const bbResponses = [];
			const toolResponses = [];
			if (filesSuccess.length > 0) {
				toolResponses.push(
					`Added files to the conversation:\n${filesSuccess.map((f) => `- ${f.name}`).join('\n')}`,
				);
			}
			if (filesError.length > 0) {
				toolResponses.push(
					`Failed to add files to the conversation:\n${
						filesError.map((f) => `- ${f.name}: ${f.error}`).join('\n')
					}`,
				);
			}

			const toolResults = toolResultContentParts;
			const toolResponse = (allFilesFailed ? 'No files added\n' : '') + toolResponses.join('\n\n');
			const bbResponse = {
				data: {
					filesAdded: filesSuccess.map((f) => f.name),
					filesError: filesError.map((f) => f.name),
				},
			};

			return {
				toolResults,
				toolResponse,
				bbResponse,
				finalizeCallback: (messageId) => {
					interaction.addFilesForMessage(
						filesAdded,
						messageId,
						toolUse.toolUseId,
					);
				},
			};
		} catch (error) {
			let errorMessage: string;
			if (error instanceof Deno.errors.NotFound) {
				errorMessage = `File not found: ${error.message}`;
			} else if (error instanceof Deno.errors.PermissionDenied) {
				errorMessage = `Permission denied: ${error.message}`;
			} else {
				errorMessage = error.message;
			}
			logger.error(`Error adding files to conversation: ${errorMessage}`);

			const toolResults = `⚠️  ${errorMessage}`;
			const bbResponse = `BB failed to add files. Error: ${errorMessage}`;
			const toolResponse = `Failed to add files. Error: ${errorMessage}`;
			return { toolResults, toolResponse, bbResponse };

			// 			logger.error(`Error adding files to conversation: ${error.message}`);
			//
			// 			throw createError(
			// 				ErrorType.FileHandling,
			// 				`Error adding files to conversation: ${error.message}`,
			// 				{
			// 					name: 'request-files',
			// 					filePath: projectEditor.projectRoot,
			// 					operation: 'request-files',
			// 				},
			// 			);
		}
	}
}
