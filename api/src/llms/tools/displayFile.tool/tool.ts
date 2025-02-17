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
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { ResourceManager } from '../../resourceManager.ts';
import { encodeBase64 } from '@std/encoding';
import { logger } from 'shared/logger.ts';
import type {
	DisplayResult,
	FileMetadata,
	LLMToolDisplayFileInput,
	//LLMToolDisplayFileResultData,
} from './types.ts';
//import {
//    TEXT_DISPLAY_LIMIT,
//    TEXT_HARD_LIMIT,
//    IMAGE_DISPLAY_LIMIT,
//    IMAGE_HARD_LIMIT,
//} from './types.ts';

export default class LLMToolDisplayFile extends LLMTool {
	//private resourceManager: ResourceManager|null = null;

	// constructor() {
	//     super();
	//     // ResourceManager will be initialized in runTool when we have access to ProjectEditor
	//     this.resourceManager = null as unknown as ResourceManager;
	// }
	// public override async init(): Promise<LLMToolDisplayFile> {
	// 	await super.init();
	// 	this.resourceManager = new ResourceManager(projectEditor);
	// 	return this;
	// }

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				filePath: {
					type: 'string',
					description: 'The path of the file to display, relative to the project root. The tool will:\n' +
						'1. Read and display the file contents based on type:\n' +
						'   * Text files: Displayed with syntax highlighting when possible\n' +
						'   * Images: Displayed inline with appropriate sizing\n' +
						'   * Other formats: Shows metadata and format information\n' +
						'\n' +
						'2. Size Limits:\n' +
						'   * Text files: 1MB display limit, 10MB hard limit\n' +
						'   * Images: 5MB display limit, 20MB hard limit\n' +
						'   * Files exceeding limits show truncated content or error\n' +
						'\n' +
						'3. Format Support:\n' +
						'   * Text: All text formats including code and markdown\n' +
						'   * Images: All browser-supported formats (PNG, JPEG, GIF, etc.)\n' +
						'   * Other: Basic metadata display\n',
				},
			},
			required: ['filePath'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser' = 'console',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser' = 'console',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { filePath } = toolUse.toolInput as LLMToolDisplayFileInput;

		try {
			const resourceManager = new ResourceManager(projectEditor);

			const resource = await resourceManager.loadResource(
				{ type: 'file', location: filePath },
				{}, // { maxSize: TEXT_HARD_LIMIT }
			);
			const displayResult: DisplayResult = {
				type: resource.metadata?.mimeType?.startsWith('image/') ? 'image' : 'text',
				content: resource.content instanceof Uint8Array ? encodeBase64(resource.content) : resource.content,
				metadata: {
					name: filePath,
					size: resource.metadata?.size || 0,
					mimeType: resource.metadata?.mimeType || 'application/octet-stream',
					lastModified: resource.metadata?.lastModified, // new Date(),
				} as FileMetadata,
				truncated: resource.truncated,
			};

			const toolResults =
				`File: ${filePath} - Size: ${displayResult.metadata.size} - MimeType: ${displayResult.metadata.mimeType} - LastModified: ${displayResult.metadata.lastModified}`;
			const toolResponse = `Displayed file: ${filePath}`;

			return {
				toolResults,
				toolResponse,
				bbResponse: { data: displayResult },
			};
		} catch (error) {
			logger.error(`LLMToolDisplayFile: Failed to display file: ${(error as Error).message}`);

			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to display file. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to display file. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
