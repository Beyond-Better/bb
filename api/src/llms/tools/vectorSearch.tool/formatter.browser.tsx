/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	return (
		<div className='tool-use'>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { toolResult, bbResponse } = resultContent;
	return (
		<div className='tool-result'>
		</div>
	);
};
