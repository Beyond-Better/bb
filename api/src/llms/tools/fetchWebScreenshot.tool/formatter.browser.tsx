/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import type { LLMToolFetchWebScreenshotInput, LLMToolFetchWebScreenshotResult } from './types.ts';

export const getImageContent = (contentParts: LLMMessageContentParts): string => {
	const content = contentParts[0] || { source: { data: '' } };
	if ('source' in content) {
		return content.source.data;
	}
	return '';
};

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { url } = toolInput as LLMToolFetchWebScreenshotInput;
	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('Capturing screenshot of web page:')}{' '}
			{LLMTool.TOOL_TAGS_BROWSER.content.url(url)}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Fetch Web Screenshot'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Capturing screenshot'),
		content,
		preview: `Capturing screenshot of ${url}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as LLMToolFetchWebScreenshotResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url } = bbResponse.data;
		const content = getImageContent(toolResult as LLMMessageContentParts);

		const contentElement = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				<p>
					{LLMTool.TOOL_TAGS_BROWSER.base.label('BB has captured screenshot from')}{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.url(url)}
				</p>
				<img
					src={`data:image/png;base64,${content}`}
					alt='Web page screenshot'
					className='max-w-full h-auto mt-2 rounded-lg border border-gray-200'
				/>
			</>,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Fetch Web Screenshot'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Screenshot captured'),
			content: contentElement,
			preview: `Screenshot captured from ${url}`,
		};
	} else {
		logger.error('LLMToolFetchWebScreenshot: Unexpected bbResponse format:', bbResponse);
		const errorContent = LLMTool.TOOL_TAGS_BROWSER.base.container(
			<p>
				{LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse))}
			</p>,
			LLMTool.TOOL_STYLES_BROWSER.status.error,
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Fetch Web Screenshot'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('failed'),
			content: errorContent,
			preview: 'Operation failed',
		};
	}
};
