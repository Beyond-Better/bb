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
				url: {
					type: 'string',
					description: `The complete URL of the web page to screenshot. Important considerations:

1. URL Requirements:
   * Must include protocol (http:// or https://)
   * Should be properly encoded
   * Must be publicly accessible
   Examples:
   * "https://example.com/design"
   * "https://github.com/owner/repo"
   * "http://localhost:3000/preview"

2. Use Cases:
   * Visual layout analysis
   * Design review
   * UI/UX discussions
   * Complex content (charts, diagrams)
   * Responsive design testing
   * When text extraction isn't sufficient

3. Common Issues:
   * Dynamic content loading
   * Authentication requirements
   * Popup/cookie notices
   * Responsive layouts
   * Rate limiting
   * Geoblocking
   * CORS restrictions

4. Best Practices:
   * Allow time for page rendering
   * Check site's terms of service
   * Respect robots.txt
   * Use fetch_web_page for text content
   * Consider page load time
   * Be aware of dynamic content`,
				},
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
				toolResponse: `Successfully captured screenshot of ${url}`,
				// bbResponse:
				// 	`I've captured a screenshot of ${url}. The image data is available as a base64-encoded string.`,
				bbResponse: {
					data: {
						url,
						//mediaType: 'image/png',
						//source: screenshotBase64,
					},
				},
			};
		} catch (error) {
			logger.error(`LLMToolFetchWebScreenshot: Failed to capture screenshot: ${error.message}`);

			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to capture screenshot. Error: ${error.message}`;
			const toolResponse = `Failed to capture screenshot. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
