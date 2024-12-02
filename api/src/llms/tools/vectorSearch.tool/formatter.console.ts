import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolVectorSearchInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolVectorSearchInput;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Vector Search'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Searching embeddings...'),
		content: stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Query:')} ${input.query}`,
		preview: 'Vector search in progress',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Vector Search'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Search complete'),
		content: String(bbResponse),
		preview: 'Vector search complete',
	};
};
