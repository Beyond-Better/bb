import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolFetchWebPageInput, LLMToolFetchWebPageResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { url } = toolInput as LLMToolFetchWebPageInput;
	const content = stripIndents`
    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Fetching web page:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.url(url)}
  `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Fetch Web Page'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Fetching URL'),
		content,
		preview: `Fetching ${url}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as LLMToolFetchWebPageResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url } = bbResponse.data;
		const content = getContentFromToolResult(toolResult);
		const contentPreview = content.length > 500 ? content.slice(0, 500) + '...' : content;

		const formattedContent = stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('BB has fetched web page content from')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.url(url)
		}

      ${contentPreview}
    `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Fetch Web Page'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Content retrieved'),
			content: formattedContent,
			preview: `Retrieved content from ${url}`,
		};
	} else {
		logger.error('LLMToolFetchWebPage: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Fetch Web Page'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
