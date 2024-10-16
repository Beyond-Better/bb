import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMToolConversationSummaryData } from './tool.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (toolInput: LLMToolInputSchema): string => {
	const { maxTokens, summaryLength } = toolInput as { maxTokens?: number; summaryLength?: string };
	return stripIndents`
    ${colors.bold('Summarizing and Truncating Conversation')}
    ${maxTokens ? `${colors.cyan('Max Tokens:')} ${maxTokens}` : ''}
    ${summaryLength ? `${colors.cyan('Summary Length:')} ${summaryLength}` : ''}
  `.trim();
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { conversation } = bbResponse.data as { conversation: LLMToolConversationSummaryData };
		return stripIndents`
			${colors.bold('Conversation Summary and Truncation')}
			
			${colors.cyan(`Summary (${conversation.summaryLength}):`)}
			${conversation.summary}
			
			${colors.cyan('Truncated Conversation:')}
			${
			conversation.truncatedConversation.map((msg: LLMMessage) => `${colors.bold(msg.role)}: ${msg.content}`)
				.join('\n')
		}
			
			${colors.cyan('Token Counts:')}
			Original: ${conversation.originalTokenCount}
			New: ${conversation.newTokenCount}
		  `;
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
