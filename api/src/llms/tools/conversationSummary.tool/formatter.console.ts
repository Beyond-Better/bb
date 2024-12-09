import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationSummaryInput, LLMToolConversationSummaryResultData } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { maxTokensToKeep, summaryLength } = toolInput as LLMToolConversationSummaryInput;

	const content = stripIndents`
        ${maxTokensToKeep ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Max Tokens:')} ${maxTokensToKeep}` : ''}
        ${summaryLength ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Summary Length:')} ${summaryLength}` : ''}
    `.trim();

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Conversation Summary'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Summarizing conversation...'),
		content,
		preview: maxTokensToKeep ? `Truncating to ${maxTokensToKeep} tokens` : 'Generating summary',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as LLMToolConversationSummaryResultData;

		const content = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Summary (${data.summaryLength}):`)}
            ${data.summary}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Message Counts:')}
            Original: ${data.originalMessageCount}
            Kept: ${data.keptMessageCount}
            Removed: ${data.originalMessageCount - data.keptMessageCount}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Token Counts:')}
            Original: ${data.originalTokenCount}
            New: ${data.newTokenCount}
            Summary: ${data.metadata.summaryTokenCount}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Metadata:')}
            Model: ${data.metadata.model}
            Summary Type: ${data.summaryLength}
            Start: ${new Date(data.metadata.messageRange.start.timestamp).toLocaleString()}
            End: ${new Date(data.metadata.messageRange.end.timestamp).toLocaleString()}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Conversation Summary'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`${data.originalMessageCount - data.keptMessageCount} messages summarized`,
			),
			content,
			preview: `Summarized ${data.originalMessageCount - data.keptMessageCount} messages`,
		};
	} else {
		logger.error('LLMToolConversationSummary: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Error', 'Conversation Summary'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Failed to process summary'),
			content: bbResponse,
			preview: 'Error processing summary',
		};
	}
};
