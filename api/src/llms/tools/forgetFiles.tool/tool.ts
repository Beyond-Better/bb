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
								description:
									'The path of the file to be removed from the conversation context. When prompt caching is enabled, the file remains in the cached context but should be mentally excluded from consideration.',
							},
							revision: {
								type: 'string',
								description:
									'The revision of the file to be removed. This helps track which version of a file is being excluded, especially important when files have been modified during the conversation.',
							},
						},
						required: ['filePath', 'revision'],
					},
					description:
						`Array of files to remove from the conversation context. Behavior depends on prompt caching:

1. When prompt caching is ENABLED:
   * Files physically remain in the cached context
   * Mark files as "Ignored" in your mental tracking
   * Do not reference or use ignored files
   * Continue to track file status changes
   Example: When asked to ignore tools_manifest.ts, maintain awareness that it exists but don't use its contents

2. When prompt caching is DISABLED:
   * Files are physically removed from the context
   * Reduces token usage and context size
   * Files can be re-added later if needed
   Example: Removing large files that are no longer relevant to the current task`,
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
		const { toolInput } = toolUse;
		const { files } = toolInput as {
			files: Array<{
				filePath: string;
				revision: string;
			}>;
		};

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
			// const fileList = files.map((file) => file.filePath);
			// const toolResults = `Marked the following files to be excluded from consideration: ${fileList.join(', ')}`;
			// const toolResponse = `Marked ${files.length} file(s) to be excluded`;
			// const bbResponse = `BB marked ${files.length} file(s) to be excluded from consideration`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolForgetFiles: Error removing files from conversation: ${(error as Error).message}`);

			throw createError(ErrorType.FileHandling, `Error removing files from conversation: ${(error as Error).message}`, {
				name: 'forget-files',
				filePath: projectEditor.projectRoot,
				operation: 'forget-files',
			});
		}
	}
}
