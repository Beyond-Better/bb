import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationMetricsData } from './tool.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (_toolInput: LLMToolInputSchema): string => {
	return stripIndents`
    ${colors.bold('Calculating Conversation Metrics')}
    Analyzing turns, message types, and token usage...
  `.trim();
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { metrics } = bbResponse.data as { metrics: LLMToolConversationMetricsData };
		return stripIndents`
    ${colors.bold('Conversation Metrics')}
    
    ${colors.cyan('Total Turns:')} ${metrics.totalTurns}
    
    ${colors.cyan('Message Types:')}
    User: ${metrics.messageTypes.user}
    Assistant: ${metrics.messageTypes.assistant}
    Tool: ${metrics.messageTypes.tool}
    
    ${colors.cyan('Token Usage:')}
    Total: ${metrics.tokenUsage.total}
    User: ${metrics.tokenUsage.user}
    Assistant: ${metrics.tokenUsage.assistant}
    Tool: ${metrics.tokenUsage.tool}
  `;
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
