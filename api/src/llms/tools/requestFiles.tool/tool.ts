//import type { JSX } from 'preact';

import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type { LLMToolRequestFilesInput } from './types.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { logger } from 'shared/logger.ts';

export default class LLMToolRequestFiles extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				fileNames: {
					type: 'array',
					items: {
						type: 'string',
					},
					description: `Array of file paths to add to the conversation. Important usage notes:

1. Path Requirements:
   * Use paths relative to project root
   * Paths must be within the project
   * Convert absolute paths by removing project root prefix
   * Handle OS-specific path separators appropriately

2. Batch Requests:
   * Request multiple related files in one call
   * Include test files when requesting source files
   * Include imported/dependent files when relevant

3. File Review:
   * Always review file contents before:
     - Making suggestions about the file
     - Proposing changes to the file
     - Commenting on relationships between files
     - Answering questions about the file

4. Mental Tracking:
   * Mark requested files as "Active" in mental status
   * Consider relationships with other active files
   * Update status when files become irrelevant

Examples:
* ["src/config.ts"]
* ["src/handler.ts", "tests/handler.test.ts"]
* ["package.json", "package-lock.json"]

Note: If you don't know the exact paths, use search_project tool first.`,
				},
			},
			required: ['fileNames'],
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
		const { toolInput } = toolUse;
		const { fileNames } = toolInput as LLMToolRequestFilesInput;

		try {
			const filesAdded = await projectEditor.prepareFilesForConversation(fileNames);

			const toolResultContentParts: LLMMessageContentPartTextBlock[] = [];
			const filesSuccess: Array<{ name: string }> = [];
			const filesError: Array<{ name: string; error: string }> = [];
			let allFilesFailed = true;

			for (const fileToAdd of filesAdded) {
				if (fileToAdd.metadata.error) {
					toolResultContentParts.push({
						'type': 'text',
						'text': `Error adding file ${fileToAdd.fileName}: ${fileToAdd.metadata.error}`,
					});
					filesError.push({
						name: fileToAdd.fileName,
						error: fileToAdd.metadata.error,
					});
				} else {
					toolResultContentParts.push({
						'type': 'text',
						'text': `File added: ${fileToAdd.fileName}`,
					});
					filesSuccess.push({ name: fileToAdd.fileName });
					allFilesFailed = false;
				}
			}

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
				errorMessage = (error as Error).message;
			}
			logger.error(`LLMToolRequestFiles: Error adding files to conversation: ${errorMessage}`);

			const toolResults = `⚠️  ${errorMessage}`;
			const bbResponse = `BB failed to add files. Error: ${errorMessage}`;
			const toolResponse = `Failed to add files. Error: ${errorMessage}`;
			return { toolResults, toolResponse, bbResponse };

			// 			logger.error(`LLMToolRequestFiles: Error adding files to conversation: ${error.message}`);
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
