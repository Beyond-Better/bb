/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentArrayFromToolResult } from 'api/utils/llms.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { filePath, operations, createIfMissing } = toolInput as {
		filePath: string;
		operations: Array<{ search: string; replace: string; caseSensitive?: boolean; replaceAll?: boolean }>;
		createIfMissing: boolean;
	};
	return (
		<div className='tool-use'>
			<p>
				<strong>File:</strong> {filePath}{' '}
				<strong>({createIfMissing ? 'Create if missing' : "Don't create new file"})</strong>
			</p>
			<p>
				<strong>Operations:</strong>
			</p>
			<ul>
				{operations.map((op, index) => (
					<div>
						<h4>
							Operation {index + 1}: <strong>({op.replaceAll ? 'Replace all' : 'Replace first'})</strong>
							{' '}
							<strong>({op.caseSensitive ? 'Case sensitive' : 'Case insensitive'})</strong>
						</h4>
						<p>
							<strong>Search:</strong>
						</p>
						<pre style='color: #DAA520;'>{op.search}</pre>
						<p>
							<strong>Replace:</strong>
						</p>
						<pre style='color: #228B22;'>{op.replace}</pre>
					</div>
				))}
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
