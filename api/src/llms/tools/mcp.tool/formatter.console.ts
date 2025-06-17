import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContent } from 'shared/types.ts';
import type {
	//LLMToolMCPInput,
	LLMToolMCPResult,
} from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { stripIndents } from 'common-tags';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(
	toolInput: LLMToolInputSchema,
	toolName: string,
): LLMToolLogEntryFormattedResult {
	//const { toolName } = toolInput as LLMToolMCPInput;

	const content = stripIndents`
		${LLMTool.TOOL_STYLES_CONSOLE.base.label('MCP Tool Called')} 
		${JSON.stringify(toolInput, null, 2)}
	  `;
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'MCP Tool'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(`MCP Tool (${toolName})`),
		content,
		//preview: `MCP Tool (${toolName})`,
		preview: `MCP Tools don't provide feedback`,
	};
}

export function formatLogEntryToolResult(
	resultContent: CollaborationLogEntryContent,
	toolName: string,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as LLMToolMCPResult;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const content = stripIndents`
			${LLMTool.TOOL_STYLES_CONSOLE.base.label('MCP Tool Result')}
			${JSON.stringify(bbResponse.data, null, 2)}
	   `;
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'MCP Tool'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`MCP Tool (${toolName})`,
			),
			content,
			//preview: `MCP Tool (${toolName})`,
			preview: `MCP Tools don't provide feedback`,
		};
	} else {
		logger.error('LLMToolMCP: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'MCP Tool'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('failed'),
			content: LLMTool.TOOL_STYLES_CONSOLE.status.error(String(bbResponse)),
			preview: 'Operation failed',
		};
	}
}
