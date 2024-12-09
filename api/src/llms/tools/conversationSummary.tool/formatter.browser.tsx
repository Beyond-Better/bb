/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationSummaryInput, LLMToolConversationSummaryResultData } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export const formatLogEntryToolUse = (toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	const { maxTokensToKeep, summaryLength } = toolInput as LLMToolConversationSummaryInput;

	const content = (
		<div className='bb-tool-use'>
			<ul>
				{maxTokensToKeep && (
					<li>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Max Tokens:')} {maxTokensToKeep}
					</li>
				)}
				{summaryLength && (
					<li>
						{LLMTool.TOOL_TAGS_BROWSER.base.label('Summary Length:')} {summaryLength}
					</li>
				)}
			</ul>
		</div>
	);

	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Conversation Summary'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Summarizing conversation...'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(content),
		preview: maxTokensToKeep ? `Truncating to ${maxTokensToKeep} tokens` : 'Generating summary',
	};
};

export const formatLogEntryToolResult = (
	resultContent: ConversationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const data = bbResponse.data as LLMToolConversationSummaryResultData;

		const content = (
			<div className='bb-tool-result'>
				<div className='bb-summary-section'>
					<h4>Summary ({data.summaryLength}):</h4>
					{LLMTool.TOOL_TAGS_BROWSER.base.pre(data.summary)}
				</div>

				<div className='bb-metrics-section'>
					<h4>Message Counts:</h4>
					{LLMTool.TOOL_TAGS_BROWSER.base.list([
						`Original: ${data.originalMessageCount}`,
						`Kept: ${data.keptMessageCount}`,
						`Removed: ${data.originalMessageCount - data.keptMessageCount}`,
					])}

					<h4>Token Counts:</h4>
					{LLMTool.TOOL_TAGS_BROWSER.base.list([
						`Original: ${LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(data.originalTokenCount)}`,
						`New: ${LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(data.newTokenCount)}`,
						`Summary: ${LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(data.metadata.summaryTokenCount)}`,
					])}

					<h4>Metadata:</h4>
					{LLMTool.TOOL_TAGS_BROWSER.base.list([
						`Model: ${data.metadata.model}`,
						`Summary Type: ${data.summaryLength}`,
						`Start: ${LLMTool.TOOL_TAGS_BROWSER.content.date(data.metadata.messageRange.start.timestamp)}`,
						`End: ${LLMTool.TOOL_TAGS_BROWSER.content.date(data.metadata.messageRange.end.timestamp)}`,
					])}
				</div>
			</div>
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Conversation Summary'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				`${data.originalMessageCount - data.keptMessageCount} messages summarized`,
			),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(content),
			preview: `Summarized ${data.originalMessageCount - data.keptMessageCount} messages`,
		};
	} else {
		logger.error('LLMToolConversationSummary: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Error', 'Conversation Summary'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Failed to process summary'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(<p>{bbResponse}</p>),
			preview: 'Error processing summary',
		};
	}
};
