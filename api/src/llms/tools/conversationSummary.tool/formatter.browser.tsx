/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMToolConversationSummaryData } from './tool.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (toolInput: LLMToolInputSchema): JSX.Element => {
	const { maxTokens, summaryLength } = toolInput as { maxTokens?: number; summaryLength?: string };
	return (
		<div className='tool-use'>
			<h3>Summarizing and Truncating Conversation</h3>
			<ul>
				{maxTokens && (
					<li>
						<strong>Max Tokens:</strong> {maxTokens}
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
		const { conversation } = bbResponse.data as { conversation: LLMToolConversationSummaryData };
		return (
			<div className='tool-result'>
				<h3>Conversation Summary and Truncation</h3>
				<h4>Summary ({conversation.summaryLength}):</h4>
				<p>{conversation.summary}</p>
				<h4>Truncated Conversation:</h4>
				<ul>
					{conversation.truncatedConversation.map((msg: LLMMessage, index: number) => (
						<li key={index}>
							<strong>{msg.role}:</strong> {msg.content}
						</li>
					))}
				</ul>
				<h4>Token Counts:</h4>
				<ul>
					<li>
						<strong>Original:</strong> {conversation.originalTokenCount}
					</li>
					<li>
						<strong>New:</strong> {conversation.newTokenCount}
					</li>
				</ul>
			</div>
		);
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
