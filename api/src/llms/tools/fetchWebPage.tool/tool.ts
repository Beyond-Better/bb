import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolConfig, LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
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
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import FetchManager from 'shared/fetchManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { logger } from 'shared/logger.ts';
import { type DOMConfig, extractTextFromHtml, validateHtml } from '../../../utils/dom.utils.ts';

interface LLMToolFetchWebPageConfig extends LLMToolConfig {
	domConfig?: DOMConfig;
}

export default class LLMToolFetchWebPage extends LLMTool {
	private domConfig: DOMConfig;

	constructor(name: string, description: string, toolConfig: LLMToolFetchWebPageConfig) {
		super(name, description, toolConfig);
		this.domConfig = toolConfig.domConfig || {};
		//logger.debug(`LLMToolFetchWebPage: domConfig`, this.domConfig);
	}

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description: `The complete URL of the web page to fetch. Important considerations:

1. URL Requirements:
   * Must include protocol (http:// or https://)
   * Should be properly encoded
   * Must be publicly accessible
   Examples:
   * "https://example.com/page"
   * "https://api.github.com/repos/owner/repo/readme"
   * "http://localhost:8000/docs" (for local development)

2. Content Types:
   * HTML pages: Returns clean text content with:
     - Scripts, styles, and ads removed
     - Optional link URLs preserved
     - Structure maintained for readability
     - Page title included
   * Plain text: Returns as-is
   * Other formats: May not render properly
   For visual content, use fetch_web_screenshot instead

3. Common Issues:
   * Rate limiting or IP blocking
   * Authentication requirements
   * Robots.txt restrictions
   * CORS policies
   * Size limitations
   * Timeouts

4. Best Practices:
   * Check site's terms of service
   * Respect robots.txt
   * Handle errors gracefully
   * Consider using fetch_web_screenshot for layout-dependent content`,
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
			const html: string = await fetchManager.fetchPage(url);

			// Validate HTML and get metadata
			const validation = await validateHtml(html);
			if (!validation.isValid) {
				throw new Error(`Invalid HTML content: ${validation.error}`);
			}

			// Extract clean text content
			const text = await extractTextFromHtml(html, this.domConfig);

			return {
				toolResults: text,
				toolResponse: `Successfully fetched and cleaned content from ${url}${
					validation.title ? ` (${validation.title})` : ''
				}`,
				bbResponse: {
					data: {
						url,
						html,
						title: validation.title,
						length: validation.length,
					},
				},
			};
		} catch (error) {
			logger.error(`Failed to fetch web page: ${error.message}`);

			const toolResults = `⚠️  ${error.message}`;
			const bbResponse = `BB failed to fetch web page. Error: ${error.message}`;
			const toolResponse = `Failed to fetch web page. Error: ${error.message}`;
			return { toolResults, toolResponse, bbResponse };
		}
	}
}
