/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationMetricsData } from './tool.ts';
import { logger } from 'shared/logger.ts';

export const formatToolUse = (_toolInput: LLMToolInputSchema): JSX.Element => {
	return (
		<div className='tool-use'>
			<h3>Calculating Conversation Metrics</h3>
			<p>Analyzing turns, message types, and token usage...</p>
		</div>
	);
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const { metrics } = bbResponse.data as { metrics: LLMToolConversationMetricsData };
		return (
			<div className='tool-result'>
				<h3>Conversation Metrics</h3>
				<p>
					<strong>Total Turns:</strong> {metrics.totalTurns}
				</p>
				<h4>Message Types:</h4>
				<ul>
					<li>
						<strong>User:</strong> {metrics.messageTypes.user}
					</li>
					<li>
						<strong>Assistant:</strong> {metrics.messageTypes.assistant}
					</li>
					<li>
						<strong>Tool:</strong> {metrics.messageTypes.tool}
					</li>
				</ul>
				<h4>Token Usage:</h4>
				<ul>
					<li>
						<strong>Total:</strong> {metrics.tokenUsage.total}
					</li>
					<li>
						<strong>User:</strong> {metrics.tokenUsage.user}
					</li>
					<li>
						<strong>Assistant:</strong> {metrics.tokenUsage.assistant}
					</li>
					<li>
						<strong>Tool:</strong> {metrics.tokenUsage.tool}
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
