/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { filePath, content, createIfMissing, allowEmptyContent, expectedLineCount } = toolInput as {
		filePath: string;
		content: string;
		createIfMissing: boolean;
		allowEmptyContent: boolean;
		expectedLineCount: number;
	};
	const contentPreview = content.length > 100 ? content.slice(0, 100) + '...' : content;
	return (
		<div className='tool-use'>
			<p>
				<strong>Rewriting file:</strong> {filePath}
			</p>
			<p>
				<strong>Expected line count:</strong> <span style='color: #DAA520;'>{expectedLineCount}</span>
			</p>
			<p>
				<strong>Create if missing:</strong>{' '}
				<span style='color: #DAA520;'>{createIfMissing ? 'Yes' : 'No'}</span>
			</p>
			<p>
				<strong>Allow empty content:</strong>{' '}
				<span style='color: #DAA520;'>{allowEmptyContent ? 'Yes' : 'No'}</span>
			</p>
			<p>
				<strong>New content:</strong>
			</p>
			<pre style='background-color: #f0f0f0; padding: 10px; white-space: pre-wrap;'>{contentPreview}</pre>
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
