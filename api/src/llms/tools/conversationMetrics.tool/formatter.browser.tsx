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
					<h3>Token Usage</h3>
					<div class='metric-group'>
						<div class='metric'>
							<strong>Total:</strong> {metrics.tokens.total}
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
