import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolSearchAndReplaceMultilineCodeInput, LLMToolSearchAndReplaceMultilineCodeResult } from './types.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { filePath } = toolInput as LLMToolSearchAndReplaceMultilineCodeInput;

	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('File:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(filePath)}
		${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('Tool is currently disabled')}
	`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search And Replace Multiline'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Disabled'),
		content,
		preview: 'Tool is disabled',
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent as LLMToolSearchAndReplaceMultilineCodeResult;

	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.content.code(bbResponse)}
		${LLMTool.TOOL_STYLES_CONSOLE.content.status.warning('Tool is currently disabled')}
	`;

	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search And Replace Multiline'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Disabled'),
		content,
		preview: 'Tool is disabled',
	};
};
