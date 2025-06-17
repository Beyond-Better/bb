import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolSearchAndReplaceInput, LLMToolSearchAndReplaceResult } from './types.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath, operations, createIfMissing } = toolInput as LLMToolSearchAndReplaceInput;
	const opCount = operations.length;
	const opText = opCount === 1 ? 'operation' : 'operations';
	const content = stripIndents`
    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)}
    ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(createIfMissing ?? false, 'enabled/disabled')}

    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations:')}
    ${
		operations.map((op, index) =>
			stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Operation ${index + 1}:`)}
      ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.replaceAll ?? false, 'all/first')}
      ${LLMTool.TOOL_STYLES_CONSOLE.content.boolean(op.caseSensitive ?? true, 'case-sensitive/case-insensitive')}

      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Search:')}
      ${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.search)}

      ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Replace:')}
      ${LLMTool.TOOL_STYLES_CONSOLE.content.code(op.replace)}
      `
		).join('\n')
	}
  `;
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Search And Replace'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${opCount} ${opText}`),
		content,
		preview: `Modifying ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as LLMToolSearchAndReplaceResult;
	const results = getContentArrayFromToolResult(toolResult);
	// Check if operation was successful
	const isSuccess = !bbResponse.toLowerCase().includes('error') &&
		!bbResponse.toLowerCase().includes('failed');

	// Count the number of changes
	const changeCount = results.filter((r) =>
		r.toLowerCase().includes('replaced') ||
		r.toLowerCase().includes('created')
	).length;

	const content = stripIndents`
    ${LLMTool.TOOL_STYLES_CONSOLE.content.status[isSuccess ? 'success' : 'error'](bbResponse)}

    ${results.map((content) => LLMTool.TOOL_STYLES_CONSOLE.content.code(content)).join('\n')}
  `;
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Search And Replace'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(isSuccess ? `${changeCount} changes` : 'failed'),
		content,
		preview: isSuccess ? bbResponse : 'Operation failed',
	};
};
