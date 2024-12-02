/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolVectorSearchInput } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const input = toolInput as LLMToolVectorSearchInput;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Vector Search'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Searching embeddings...'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<>
				{LLMTool.TOOL_TAGS_BROWSER.base.label('Query:')} {input.query}
			</>,
		),
		preview: 'Vector search in progress',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Vector Search'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Search complete'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.pre(String(bbResponse)),
		),
		preview: 'Vector search complete',
	};
};
