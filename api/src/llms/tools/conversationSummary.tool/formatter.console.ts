import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationSummaryData } from './tool.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { maxTokensToKeep, summaryLength } = toolInput as { maxTokensToKeep?: number; summaryLength?: string };
	return stripIndents`
    ${colors.bold('Summarizing and Truncating Conversation')}
    ${maxTokensToKeep ? `${colors.cyan('Max Tokens:')} ${maxTokensToKeep}` : ''}
    ${summaryLength ? `${colors.cyan('Summary Length:')} ${summaryLength}` : ''}
  `.trim();
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as LLMToolConversationSummaryData;
		return stripIndents`
			${colors.bold('Conversation Summary and Truncation')}

			${colors.cyan(`Summary (${data.summaryLength}):`)}
			${data.summary}

			${colors.cyan('Message Counts:')}
			Original: ${data.originalMessageCount}
			Kept: ${data.keptMessages?.length}
			Removed: ${data.originalMessageCount - data.keptMessages?.length}

			${colors.cyan('Token Counts:')}
			Original: ${data.originalTokenCount}
			New: ${data.newTokenCount}
			Summary: ${data.metadata.summaryTokenCount}

			${colors.cyan('Metadata:')}
			Model: ${data.metadata.model}
			Summary Type: ${data.summaryLength}
		`;
	} else {
		logger.error('LLMToolConversationSummary: Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
