/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchAndReplaceMultilineCodeInput, LLMToolSearchAndReplaceMultilineCodeResult } from './types.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath } = toolInput as LLMToolSearchAndReplaceMultilineCodeInput;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.label('File:')} {LLMTool.TOOL_TAGS_BROWSER.content.filename(filePath)}
			{LLMTool.TOOL_TAGS_BROWSER.base.pre('Tool is currently disabled')}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Search And Replace Multiline'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Disabled'),
		content,
		preview: 'Tool is disabled',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolSearchAndReplaceMultilineCodeResult;

	const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
		<>
			{LLMTool.TOOL_TAGS_BROWSER.base.pre(bbResponse)}
			{LLMTool.TOOL_TAGS_BROWSER.base.pre('Tool is currently disabled')}
		</>,
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Search And Replace Multiline'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Disabled'),
		content,
		preview: 'Tool is disabled',
	};
};
