import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';
import type { LLMToolBlockEditInput, LLMToolBlockEditResult } from './types.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { resourcePath, operations } = toolInput as LLMToolBlockEditInput;
	const opCount = operations.length;
	const opText = opCount === 1 ? 'operation' : 'operations';
	const content = stripIndents`
    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Resource:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(resourcePath)}

    ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Operations:')}
    ${
		operations.map((op, index) =>
			stripIndents`
      ${LLMTool.TOOL_STYLES_CONSOLE.base.label(`Operation ${index + 1}:`)} ${LLMTool.TOOL_STYLES_CONSOLE.content.keyword(op.type)}
      ${op.index !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Index:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.index.toString())}` : ''}
      ${op._key ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Key:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.string(op._key)}` : ''}
      ${op.position !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Position:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.position.toString())}` : ''}
      ${op.content ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content Type:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.keyword(op.content._type)}` : ''}
      ${op.content?.style ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Content Style:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.keyword(op.content.style)}` : ''}
      ${op.block ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Block Type:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.keyword(op.block._type)}` : ''}
      ${op.block?.style ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('Block Style:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.keyword(op.block.style)}` : ''}
      ${op.from !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('From:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.from.toString())}` : ''}
      ${op.fromKey ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('From Key:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.string(op.fromKey)}` : ''}
      ${op.to !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('To:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.to.toString())}` : ''}
      ${op.toPosition !== undefined ? `${LLMTool.TOOL_STYLES_CONSOLE.base.label('To Position:')} ${LLMTool.TOOL_STYLES_CONSOLE.content.number(op.toPosition.toString())}` : ''}
      `
		).join('\n')
	}
  `;
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Block Edit'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`${opCount} ${opText}`),
		content,
		preview: `Editing blocks in ${resourcePath}`,
	};
};

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { toolResult, bbResponse } = resultContent as LLMToolBlockEditResult;
	const results = getContentArrayFromToolResult(toolResult);
	// Check if operation was successful
	const isSuccess = !bbResponse.toLowerCase().includes('error') &&
		!bbResponse.toLowerCase().includes('failed');

	// Count successful operations
	const successCount = results.filter((r) =>
		r.includes('✅') || r.toLowerCase().includes('succeeded')
	).length;

	// Extract operation counts from bbResponse if available
	const operationMatch = bbResponse.match(/(\d+)\/(\d+) operations succeeded/);
	const totalOperations = operationMatch ? parseInt(operationMatch[2]) : successCount;

	const content = stripIndents`
    ${LLMTool.TOOL_STYLES_CONSOLE.content.status[isSuccess ? 'success' : 'error'](bbResponse)}

    ${results.map((content) => LLMTool.TOOL_STYLES_CONSOLE.content.code(content)).join('\n')}
  `;
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Block Edit'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
			isSuccess ? `${successCount}/${totalOperations} operations` : 'failed'
		),
		content,
		preview: isSuccess ? bbResponse : 'Operation failed',
	};
};