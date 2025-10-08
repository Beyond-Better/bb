import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
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
	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('Capturing screenshot of web page:')} ${
		LLMTool.TOOL_STYLES_CONSOLE.content.url(url)
	}
	`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Fetch Web Screenshot'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Capturing screenshot'),
		content,
		preview: `Capturing screenshot of ${url}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResults, bbResponse } = resultContent as LLMToolFetchWebScreenshotResult;

	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url } = bbResponse.data;
		const filename = 'Screenshot.png';
		const content = getImageContent(toolResults as LLMMessageContentParts);

		const formattedContent = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('BB has captured screenshot from')} ${
			LLMTool.TOOL_STYLES_CONSOLE.content.url(url)
		}
			
			\u001b]1337;File=name=${filename};inline=1:${content}\u0007
		`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Fetch Web Screenshot'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Screenshot captured'),
			content: formattedContent,
			preview: `Screenshot captured from ${url}`,
		};
	} else {
		logger.error('LLMToolFetchWebScreenshot: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Fetch Web Screenshot'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
};
