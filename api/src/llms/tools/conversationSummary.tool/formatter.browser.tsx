/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMToolConversationSummaryData } from './tool.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { maxTokensToKeep, summaryLength } = toolInput as { maxTokensToKeep?: number; summaryLength?: string };
	return (
		<div className='tool-use'>
			<h3>Summarizing and Truncating Conversation</h3>
			<ul>
				{maxTokensToKeep && (
					<li>
						<strong>Max Tokens:</strong> {maxTokensToKeep}
					</li>
				)}
				{summaryLength && (
					<li>
						<strong>Summary Length:</strong> {summaryLength}
					</li>
				)}
			</ul>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as LLMToolConversationSummaryData;
		return (
			<div className='tool-result'>
				<h3>Conversation Summary and Truncation</h3>
				<h4>Summary ({data.summaryLength}):</h4>
				<p>{data.summary}</p>
				<h4>Message Counts:</h4>
				<ul>
					<li>
						<strong>Original:</strong> {data.originalMessageCount}
					</li>
					<li>
						<strong>Kept:</strong> {data.keptMessages?.length}
					</li>
					<li>
						<strong>Removed:</strong> {data.originalMessageCount - data.keptMessages?.length}
					</li>
				</ul>
				<h4>Token Counts:</h4>
				<ul>
					<li>
						<strong>Original:</strong> {data.originalTokenCount}
					</li>
					<li>
						<strong>New:</strong> {data.newTokenCount}
					</li>
					<li>
						<strong>Summary:</strong> {data.metadata.summaryTokenCount}
					</li>
				</ul>
				<h4>Metadata:</h4>
				<ul>
					<li>
						<strong>Model:</strong> {data.metadata.model}
					</li>
					<li>
						<strong>Summary Type:</strong> {data.summaryLength}
					</li>
				</ul>
			</div>
		);
	} else {
		logger.error('LLMToolConversationSummary: Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
