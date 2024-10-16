/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { tasks } = toolInput as { tasks: string[] };
	return (
		<div className='tool-use'>
			<p>
				<strong>Tasks to delegate:</strong>
			</p>
			<ul>
				{tasks.map((task, index) => <li key={index}>{task}</li>)}
			</ul>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { toolResult, bbResponse } = resultContent;
	const results = getContentArrayFromToolResult(toolResult);
	return (
		<div className='tool-result'>
			<p>
				<strong>{bbResponse}</strong>
			</p>
			{results.map((content, index) => {
				return (
					<p key={index}>
						<strong>{content}</strong>
					</p>
				);
			})}
		</div>
	);
};
