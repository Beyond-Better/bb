/** @jsxImportSource preact */
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolFetchWebPageInput, LLMToolFetchWebPageResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { url } = toolInput as LLMToolFetchWebPageInput;
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Fetching web page:')} {LLMTool.TOOL_TAGS_BROWSER.content.url(url)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Fetch Web Page'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Fetching URL'),
		content,
		preview: `Fetching ${url}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResults, bbResponse } = resultContent as LLMToolFetchWebPageResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url } = bbResponse.data;
		const content = getContentFromToolResult(toolResults);
		const contentPreview = content.length > 500 ? content.slice(0, 500) + '...' : content;

		const contentElement = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				<p>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('BB has fetched web page content from')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.url(url)}
				</p>
				{LLMTool.TOOL_TAGS_BROWSER.base.pre(contentPreview)}
			</>,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Fetch Web Page'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Content retrieved'),
			content: contentElement,
			preview: `Retrieved content from ${url}`,
		};
	} else {
		logger.error('LLMToolFetchWebPage: Unexpected bbResponse format:', bbResponse);
		const errorContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<p>
				{LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse))}
			</p>,
			LLMTool.TOOL_STYLES_BROWSER.status.error,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Fetch Web Page'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content: errorContent,
			preview: 'Operation failed',
		};
	}
};
