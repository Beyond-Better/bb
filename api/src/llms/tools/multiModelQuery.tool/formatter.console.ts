import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolMultiModelQueryInput, LLMToolMultiModelQueryResult } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (
	toolInput: LLMToolInputSchema,
): LLMToolLogEntryFormattedResult => {
	const { query, models } = toolInput as LLMToolMultiModelQueryInput;

	const content = stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query:')} ${query}

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Models:')}
        ${models.map((model) => LLMTool.TOOL_STYLES_CONSOLE.content.toolName(model)).join('\n')}
    `;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Multi Model Query'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`Querying ${models.length} models`),
		content,
		preview: `Querying ${models.length} models with prompt`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { data } = bbResponse as LLMToolMultiModelQueryResult['bbResponse'];

		const successContent = data.querySuccess.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.completed('Successful Queries')}
                ${
				data.querySuccess.map((query) =>
					stripIndents`
                    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Model:')} ${
						LLMTool.TOOL_STYLES_CONSOLE.content.toolName(query.modelIdentifier)
					}
                    ${query.answer}
                `
				).join('\n\n')
			}`
			: '';

		const errorContent = data.queryError.length > 0
			? stripIndents`
                ${LLMTool.TOOL_STYLES_CONSOLE.content.status.failed('Failed Queries')}
                ${
				data.queryError.map((query) =>
					stripIndents`
                    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Model:')} ${
						LLMTool.TOOL_STYLES_CONSOLE.content.toolName(query.modelIdentifier)
					}
                    ${LLMTool.TOOL_STYLES_CONSOLE.status.error(query.error)}
                `
				).join('\n\n')
			}`
			: '';

		const content = [successContent, errorContent].filter(Boolean).join('\n\n');
		const successCount = data.querySuccess.length;
		const errorCount = data.queryError.length;
		const subtitle = `${successCount} successful, ${errorCount} failed`;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Multi Model Query'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(subtitle),
			content,
			preview: `${successCount} models queried, ${errorCount} failed`,
		};
	} else {
		logger.error('LLMToolMultiModelQuery: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Multi Model Query'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Error'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error('Unexpected response format'),
			preview: 'Error: Invalid response format',
		};
	}
};
