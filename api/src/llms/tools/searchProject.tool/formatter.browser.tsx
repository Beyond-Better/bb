/** @jsxImportSource preact */
import type { JSX } from 'preact';

import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { contentPattern, caseSensitive, filePattern, dateAfter, dateBefore, sizeMin, sizeMax } = toolInput as {
		contentPattern?: string;
		caseSensitive?: boolean;
		filePattern?: string;
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	};
	return (
		<div className='tool-use'>
			<h3>Project Search Parameters:</h3>
			{contentPattern && (
				<p>
					<strong>Content pattern:</strong>{' '}
					<span style='color: #DAA520;'>
						{contentPattern}, {caseSensitive ? 'case-sensitive' : 'case-insensitive'}
					</span>
				</p>
			)}
			{filePattern && (
				<p>
					<strong>File pattern:</strong> <span style='color: #4169E1;'>{filePattern}</span>
				</p>
			)}
			{dateAfter && (
				<p>
					<strong>Modified after:</strong> <span style='color: #008000;'>{dateAfter}</span>
				</p>
			)}
			{dateBefore && (
				<p>
					<strong>Modified before:</strong> <span style='color: #008000;'>{dateBefore}</span>
				</p>
			)}
			{sizeMin && (
				<p>
					<strong>Minimum size:</strong> <span style='color: #FF00FF;'>{sizeMin.toString()} bytes</span>
				</p>
			)}
			{sizeMax && (
				<p>
					<strong>Maximum size:</strong> <span style='color: #FF00FF;'>{sizeMax.toString()} bytes</span>
				</p>
			)}
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { toolResult, bbResponse } = resultContent;
	const lines = getContentFromToolResult(toolResult).split('\n');
	const fileList = lines.slice(2, -1).join('\n');
	return (
		<div className='tool-result'>
			<p>
				<strong>{bbResponse}</strong>
			</p>
			<pre style='background-color: #F0F8FF; padding: 10px;'>{fileList}</pre>
		</div>
	);
};
