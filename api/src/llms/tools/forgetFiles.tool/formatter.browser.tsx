/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { fileNames } = toolInput as { fileNames: string[] };
	return (
		<div className='tool-use'>
			<p>
				<strong>Forgetting files:</strong>
			</p>
			<ul>
				{fileNames.map((fileName, index) => <li key={index}>{fileName}</li>)}
			</ul>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	return (
		<div className='tool-result'>
			<p>
				<strong>{bbResponse}</strong>
			</p>
		</div>
	);
};
