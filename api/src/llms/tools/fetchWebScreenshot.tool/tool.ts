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
import type { LLMAnswerToolUse, LLMMessageContentPartImageBlock, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import FetchManager from 'shared/fetchManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { encodeBase64 } from '@std/encoding';
import { logger } from 'shared/logger.ts';

export default class LLMToolFetchWebScreenshot extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'The URL of the web page to capture' },
			},
			required: ['url'],
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
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { url } = toolUse.toolInput as { url: string };
		try {
			const fetchManager = await new FetchManager().init();
			const screenshotUint8Array: Uint8Array = await fetchManager.fetchScreenshot(url);
			//Deno.writeFileSync('screenshot.png', screenshotUint8Array);
			const screenshotBase64 = encodeBase64(screenshotUint8Array);

			const toolResultContentPart: LLMMessageContentParts = [{
				'type': 'image',
				'source': {
					'type': 'base64',
					'media_type': 'image/png',
					'data': screenshotBase64,
				},
			} as LLMMessageContentPartImageBlock];

			return {
				toolResults: toolResultContentPart,
				toolResponse: `Successfully fetched screenshot from ${url}`,
				// 				bbResponse:
				// 					`I've captured a screenshot of ${url}. The image data is available as a base64-encoded string.`,
				bbResponse: {
					data: {
						url,
						//mediaType: 'image/png',
						//source: screenshotBase64,
					},
				},
			};
		} catch (error) {
			logger.error(`Failed to fetch web page screenshot: ${error.message}`);

			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to fetch web page screenshot. Error: ${error.message}`;
			const toolResponse = `Failed to fetch web page screenshot. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
