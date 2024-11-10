/** @jsxImportSource preact */
import type { JSX } from 'preact';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationMetricsData } from './tool.ts';
import { logger } from 'shared/logger.ts';

export function formatToolUse(_toolInput: LLMToolInputSchema): JSX.Element {
	return (
		<div class='tool-use'>
			<p>Calculating conversation metrics...</p>
		</div>
	);
}

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): JSX.Element => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const metrics = bbResponse.data as LLMToolConversationMetricsData;
		return (
			<div class='tool-result'>
				<div class='metrics-section'>
					<h3>Basic Statistics</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Total Turns:</strong> {metrics.summary.totalTurns}
						</div>
						<div class='metric'>
							<strong>Message Types:</strong>
							<ul>
								<li>
									<strong>User:</strong> {metrics.summary.messageTypes.user}
								</li>
								<li>
									<strong>Assistant:</strong> {metrics.summary.messageTypes.assistant}
								</li>
								<li>
									<strong>Tool:</strong> {metrics.summary.messageTypes.tool}
								</li>
								<li>
									<strong>System:</strong> {metrics.summary.messageTypes.system}
								</li>
							</ul>
						</div>
						<div class='metric'>
							<strong>Active Files:</strong> {metrics.summary.activeFiles}
						</div>
						<div class='metric'>
							<strong>Unique Tools Used:</strong> {metrics.summary.uniqueToolsUsed}
						</div>
						<div class='metric'>
							<strong>Duration:</strong> {(metrics.timing.totalDuration / 1000 / 60).toFixed(2)} minutes
						</div>
					</div>
				</div>

				<div class='metrics-section'>
					<h3>Chat Token Usage</h3>
					<div class='metric-group'>
						{metrics.chatTokens
							? (
								<>
									<div class='metric'>
										<strong>Total Usage:</strong>
										<ul>
											<li>
												<strong>Input:</strong> {metrics.chatTokens.totalUsage.input}
											</li>
											<li>
												<strong>Output:</strong> {metrics.chatTokens.totalUsage.output}
											</li>
											<li>
												<strong>Total:</strong> {metrics.chatTokens.totalUsage.total}
											</li>
										</ul>
									</div>
									<div class='metric'>
										<strong>Cache Impact:</strong>
										<ul>
											<li>
												<strong>Total Savings:</strong>{' '}
												{metrics.chatTokens.cacheImpact.totalSavings}
											</li>
											<li>
												<strong>Savings Percentage:</strong>{' '}
												{metrics.chatTokens.cacheImpact.savingsPercentage.toFixed(2)}%
											</li>
										</ul>
									</div>
								</>
							)
							: <div class='metric'>No auxiliary chat activity</div>}
					</div>
				</div>

				<div class='metrics-section'>
					<h3>Main Conversation Token Usage</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Total Usage:</strong>
							<ul>
								<li>
									<strong>Input:</strong> {metrics.tokens.totalUsage.input}
								</li>
								<li>
									<strong>Output:</strong> {metrics.tokens.totalUsage.output}
								</li>
								<li>
									<strong>Total:</strong> {metrics.tokens.totalUsage.total}
								</li>
							</ul>
						</div>
						<div class='metric'>
							<strong>Differential Usage:</strong>
							<ul>
								<li>
									<strong>Input:</strong> {metrics.tokens.differentialUsage.input}
								</li>
								<li>
									<strong>Output:</strong> {metrics.tokens.differentialUsage.output}
								</li>
								<li>
									<strong>Total:</strong> {metrics.tokens.differentialUsage.total}
								</li>
							</ul>
						</div>
						<div class='metric'>
							<strong>Cache Impact:</strong>
							<ul>
								<li>
									<strong>Potential Cost:</strong> {metrics.tokens.cacheImpact.potentialCost}
								</li>
								<li>
									<strong>Actual Cost:</strong> {metrics.tokens.cacheImpact.actualCost}
								</li>
								<li>
									<strong>Total Savings:</strong> {metrics.tokens.cacheImpact.totalSavings}
								</li>
								<li>
									<strong>Savings Percentage:</strong>{' '}
									{metrics.tokens.cacheImpact.savingsPercentage.toFixed(2)}%
								</li>
							</ul>
						</div>
						<div class='metric'>
						</div>
						<div class='metric'>
							<strong>Average per Turn:</strong> {metrics.tokens.averagePerTurn.toFixed(1)}
						</div>
						<div class='metric'>
							<strong>By Role:</strong>
							<ul>
								<li>
									<strong>User:</strong> {metrics.tokens.byRole.user}
								</li>
								<li>
									<strong>Assistant:</strong> {metrics.tokens.byRole.assistant}
								</li>
								<li>
									<strong>Tool:</strong> {metrics.tokens.byRole.tool}
								</li>
								<li>
									<strong>System:</strong> {metrics.tokens.byRole.system}
								</li>
							</ul>
						</div>
					</div>
				</div>

				<div class='metrics-section'>
					<h3>Tool Performance</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Most Used Tools:</strong>
							<ul>
								{metrics.tools.usage
									.sort((a, b) => b.uses - a.uses)
									.slice(0, 3)
									.map((tool) => (
										<li>
											{tool.name}: {tool.uses}{' '}
											uses ({(tool.successes / tool.uses * 100).toFixed(1)}% success)
										</li>
									))}
							</ul>
						</div>
						{metrics.tools.sequences.length > 0 && (
							<div class='metric'>
								<strong>Common Tool Sequences:</strong>
								<ul>
									{metrics.tools.sequences.slice(0, 2).map((seq) => (
										<li>
											{seq.tools.join(' → ')} ({seq.occurrences}x)
										</li>
									))}
								</ul>
							</div>
						)}
					</div>
				</div>

				<div class='metrics-section'>
					<h3>File Operations</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Most Accessed:</strong>
							<ul>
								{metrics.files.mostAccessed.slice(0, 3).map((file) => <li>{file}</li>)}
							</ul>
						</div>
					</div>
				</div>

				<div class='metrics-section'>
					<h3>Quality Metrics</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Error Rate:</strong> {(metrics.quality.errorRate * 100).toFixed(1)}%
						</div>
						<div class='metric'>
							<strong>Tool Success Rate:</strong> {(metrics.quality.averageToolSuccess * 100).toFixed(1)}%
						</div>
						<div class='metric'>
							<strong>Retries:</strong> {metrics.quality.retryCount}
						</div>
						<div class='metric'>
							<strong>User Corrections:</strong> {metrics.quality.userCorrections}
						</div>
					</div>
				</div>

				<div class='metrics-section'>
					<h3>Timing</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Start Time:</strong> {new Date(metrics.summary.startTime).toLocaleString()}
						</div>
						<div class='metric'>
							<strong>Last Update:</strong> {new Date(metrics.summary.lastUpdateTime).toLocaleString()}
						</div>
					</div>
				</div>
			</div>
		);
	} else {
		logger.error('LLMToolConversationMetrics: Unexpected bbResponse format:', bbResponse);
		return (
			<div className='tool-result'>
				<p>
					<strong>{bbResponse}</strong>
				</p>
			</div>
		);
	}
};
