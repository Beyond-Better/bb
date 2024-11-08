/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { getContentFromToolResult } from 'api/utils/llms.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { url } = toolInput as { url: string };
	return (
		<div className='tool-use'>
			<p>
				<strong>Fetching web page:</strong> <a href={url} target='_blank' rel='noopener noreferrer'>{url}</a>
			</p>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { toolResult, bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { url, html: _html } = bbResponse.data as { url: string; html: string };
		const content = getContentFromToolResult(toolResult);
		const contentPreview = content.length > 500 ? content.slice(0, 500) + '...' : content;
		return (
			<div className='tool-result'>
				<p>
					<strong>
						BB has fetched web page content from {url}.
					</strong>
				</p>
				<pre style='background-color: #f0f0f0; padding: 10px; white-space: pre-wrap;'>{contentPreview}</pre>
			</div>
		);
		/* // the rendered html is missing stylesheets and more so doesn't look right, so just use text of contentPreview
				<div
					style='background-color: #f0f0f0; padding: 10px'
					dangerouslySetInnerHTML={{ __html: html }}
				/>
		 */
	} else {
		logger.error('LLMToolFetchWebPage: Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
