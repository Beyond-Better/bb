import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { url } = toolInput as { url: string };
	return stripIndents`
    ${colors.bold('Capturing screenshot of web page:')} ${colors.cyan(url)}
  `;
};

export const getImageContent = (contentParts: LLMMessageContentParts): string => {
	const content = contentParts[0] || { source: { data: '' } };
	if ('source' in content) {
		return content.source.data;
	}
	return '';
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { toolResult, bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url } = bbResponse.data as { url: string };
		const filename = 'Screenshot.png';
		const content = getImageContent(toolResult as LLMMessageContentParts);
		//return `File=name=${filename};inline=1:${content}`;
		return `Screenshot captured from ${url}:
		
\u001b]1337;File=name=${filename};inline=1:${content}\u0007`;
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
