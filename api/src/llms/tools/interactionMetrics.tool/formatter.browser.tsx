/** @jsxImportSource preact */
//import type { JSX } from 'preact';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolInteractionMetricsResultData } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';

export function formatLogEntryToolUse(_toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult {
	return {
		title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Use', 'Conversation Metrics'),
		subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Calculating conversation metrics...'),
		content: LLMTool.TOOL_TAGS_BROWSER.base.container(
			<div className='bb-tool-use'>
				<p>Analyzing turns, message types, and token usage...</p>
			</div>,
		),
		preview: 'Analyzing conversation metrics',
	};
}

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const metrics = bbResponse.data as LLMToolInteractionMetricsResultData;

		const content = (
			<div className='bb-tool-result'>
				<div className='bb-metrics-section'>
					<h3>Basic Statistics</h3>
					<div className='bb-metric-group'>
						<div>Total Turns: {LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.totalTurns)}</div>

						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Message Types:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list([
								<div>
									User: {LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.messageTypes.user)}
								</div>,
								<div>
									Assistant:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.messageTypes.assistant)}
								</div>,
								<div>
									Tool: {LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.messageTypes.tool)}
								</div>,
								<div>
									System:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.messageTypes.system)}
								</div>,
							])}
						</div>

						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Files and Tools:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list([
								<div>
									Active Files:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.activeFiles)}
								</div>,
								<div>
									Unique Tools:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.uniqueToolsUsed)}
								</div>,
								<div>
									Duration: {LLMTool.TOOL_TAGS_BROWSER.content.duration(metrics.timing.totalDuration)}
								</div>,
							])}
						</div>
					</div>
				</div>

				<div className='bb-metrics-section'>
					<h3>Token Usage</h3>
					<div className='bb-metric-group'>
						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Total Usage:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list([
								<div>
									Input:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.totalUsage.input)}
								</div>,
								<div>
									Output:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.totalUsage.output)}
								</div>,
								<div>
									Total:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.totalUsage.total)}
								</div>,
							])}
						</div>

						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Cache Impact:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list([
								<div>
									Potential Cost: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(
										metrics.tokens.cacheImpact.potentialCost,
									)}
								</div>,
								<div>
									Actual Cost: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(
										metrics.tokens.cacheImpact.actualCost,
									)}
								</div>,
								<div>
									Total Savings: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(
										metrics.tokens.cacheImpact.savingsTotal,
									)}
								</div>,
								<div>
									Savings: {LLMTool.TOOL_TAGS_BROWSER.content.percentage(
										metrics.tokens.cacheImpact.savingsPercentage,
									)}
								</div>,
							])}
						</div>

						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('By Role:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list([
								<div>
									User: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.byRole.user)}
								</div>,
								<div>
									Assistant:{' '}
									{LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.byRole.assistant)}
								</div>,
								<div>
									Tool: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.byRole.tool)}
								</div>,
								<div>
									System: {LLMTool.TOOL_TAGS_BROWSER.content.tokenUsage(metrics.tokens.byRole.system)}
								</div>,
							])}
						</div>
					</div>
				</div>

				<div className='bb-metrics-section'>
					<h3>Tool Performance</h3>
					<div className='bb-metric-group'>
						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Most Used Tools:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list(
								metrics.tools.usage
									.sort((a, b) => b.uses - a.uses)
									.slice(0, 3)
									.map((tool) => (
										<div>
											{LLMTool.TOOL_TAGS_BROWSER.content.toolName(tool.name)}:{' '}
											{LLMTool.TOOL_TAGS_BROWSER.content.counts(tool.uses)}{' '}
											uses ({LLMTool.TOOL_TAGS_BROWSER.content.percentage(
												tool.successes / tool.uses * 100,
											)} success)
										</div>
									)),
							)}
						</div>

						{metrics.tools.sequences.length > 0 && (
							<div className='bb-metric'>
								{LLMTool.TOOL_TAGS_BROWSER.base.label('Common Tool Sequences:')}
								{LLMTool.TOOL_TAGS_BROWSER.base.list(
									metrics.tools.sequences
										.slice(0, 2)
										.map((seq) => (
											<div>
												{seq.tools.map((t, i) => (
													<>
														{i > 0 && ' → '}
														{LLMTool.TOOL_TAGS_BROWSER.content.toolName(t)}
													</>
												))}
												{' ('}
												{LLMTool.TOOL_TAGS_BROWSER.content.counts(seq.occurrences)} times)
											</div>
										)),
								)}
							</div>
						)}
					</div>
				</div>

				<div className='bb-metrics-section'>
					<h3>File Operations</h3>
					<div className='bb-metric-group'>
						<div className='bb-metric'>
							{LLMTool.TOOL_TAGS_BROWSER.base.label('Most Accessed:')}
							{LLMTool.TOOL_TAGS_BROWSER.base.list(
								metrics.files.mostAccessed
									.slice(0, 3)
									.map((file) => <div>{LLMTool.TOOL_TAGS_BROWSER.content.filename(file)}</div>),
							)}
						</div>
					</div>
				</div>

				<div className='bb-metrics-section'>
					<h3>Quality Metrics</h3>
					<div className='bb-metric-group'>
						{LLMTool.TOOL_TAGS_BROWSER.base.list([
							<div>
								Error Rate:{' '}
								{LLMTool.TOOL_TAGS_BROWSER.content.percentage(metrics.quality.errorRate * 100)}
							</div>,
							<div>
								Tool Success Rate:{' '}
								{LLMTool.TOOL_TAGS_BROWSER.content.percentage(metrics.quality.averageToolSuccess * 100)}
							</div>,
							<div>
								Retries: {LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.quality.retryCount)} attempts
							</div>,
							<div>
								User Corrections:{' '}
								{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.quality.userCorrections)} corrections
							</div>,
						])}
					</div>
				</div>

				<div className='bb-metrics-section'>
					<h3>Timing</h3>
					<div className='bb-metric-group'>
						{LLMTool.TOOL_TAGS_BROWSER.base.list([
							<div>
								Start Time:{' '}
								{LLMTool.TOOL_TAGS_BROWSER.content.timeAgo(new Date(metrics.summary.startTime))}
							</div>,
							<div>
								Last Update:{' '}
								{LLMTool.TOOL_TAGS_BROWSER.content.timeAgo(new Date(metrics.summary.lastUpdateTime))}
							</div>,
						])}
					</div>
				</div>
			</div>
		);

		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Result', 'Conversation Metrics'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle(
				<span>
					{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.totalTurns)} turns analyzed over{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.duration(metrics.timing.totalDuration)}
				</span>,
			),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(content),
			preview: (
				<span>
					Analyzed {LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.totalTurns)} turns using{' '}
					{LLMTool.TOOL_TAGS_BROWSER.content.counts(metrics.summary.uniqueToolsUsed)} unique tools
				</span>
			),
		};
	} else {
		logger.error('LLMToolInteractionMetrics: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_TAGS_BROWSER.content.title('Tool Error', 'Conversation Metrics'),
			subtitle: LLMTool.TOOL_TAGS_BROWSER.content.subtitle('Failed to process metrics'),
			content: LLMTool.TOOL_TAGS_BROWSER.base.container(<p>{bbResponse}</p>),
			preview: 'Error processing metrics',
		};
	}
};
