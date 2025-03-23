/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type {
	//LLMToolMCPInput,
	LLMToolMCPResult,
} from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(toolInput: LLMToolInputSchema, toolName: string): LLMToolLogEntryFormattedResult {
	//const { toolName } = toolInput as LLMToolMCPInput;
	const content = (
		<div class='tool-use'>
			<div class='tool-use-header'>MCP Tool Called</div>
			<div class='tool-use-content'>
				<pre>{JSON.stringify(toolInput, null, 2)}</pre>
			</div>
		</div>
	);
	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'MCP Tool'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`MCP Tool (${toolName})`),
		content,
		//preview: `MCP Tool (${toolName})`,
		preview: `MCP Tools don't provide feedback`,
	};
}

export function formatLogEntryToolResult(
	resultContent: ConversationLogEntryContentToolResult,
	toolName: string,
): LLMToolLogEntryFormattedResult {
	const { bbResponse } = resultContent as LLMToolMCPResult;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const content = (
			<div class='tool-result'>
				<div class='tool-result-header'>MCP Tool Result</div>
				<div class='tool-result-content'>
					<pre>{JSON.stringify(bbResponse.data, null, 2)}</pre>
				</div>
			</div>
		);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'MCP Tool'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(`MCP Tool (${toolName})`),
			content,
			//preview: `MCP Tool (${toolName})`,
			preview: `MCP Tools don't provide feedback`,
		};
	} else {
		logger.error('LLMToolMCP: Unexpected bbResponse format:', bbResponse);
		const content = LLMTool.TOOL_TAGS_BROWSER.base.container(
			LLMTool.TOOL_TAGS_BROWSER.base.label(String(bbResponse)),
		);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'MCP Tool'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				`MCP Tool (${toolName}) failed`,
			),
			content,
			preview: `Operation failed`,
		};
	}
}
