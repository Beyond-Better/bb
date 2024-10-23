import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationMetricsData } from './tool.ts';
import { logger } from 'shared/logger.ts';
import { colors } from 'cliffy/ansi/colors.ts';
import { stripIndents } from 'common-tags';

export const formatToolUse = (_toolInput: LLMToolInputSchema): string => {
	return stripIndents`
    ${colors.bold('Calculating Conversation Metrics')}
    Analyzing turns, message types, and token usage...
  `.trim();
};

export const formatToolResult = (resultContent: ConversationLogEntryContentToolResult): string => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const metrics = bbResponse.data as LLMToolConversationMetricsData;
		return stripIndents`
${colors.bold('Conversation Metrics Summary')}

${colors.bold('Basic Statistics:')}
${colors.cyan('Total Turns:')} ${metrics.summary.totalTurns}
${colors.cyan('Message Types:')}
  User: ${metrics.summary.messageTypes.user}
  Assistant: ${metrics.summary.messageTypes.assistant}
  Tool: ${metrics.summary.messageTypes.tool}
  System: ${metrics.summary.messageTypes.system}
${colors.cyan('Active Files:')} ${metrics.summary.activeFiles}
${colors.cyan('Unique Tools Used:')} ${metrics.summary.uniqueToolsUsed}
${colors.cyan('Duration:')} ${(metrics.timing.totalDuration / 1000 / 60).toFixed(2)} minutes

${colors.bold('Token Usage:')}
${colors.cyan('Total:')} ${metrics.tokens.total}
${colors.cyan('Average per Turn:')} ${metrics.tokens.averagePerTurn.toFixed(1)}
${colors.cyan('By Role:')}
  User: ${metrics.tokens.byRole.user}
  Assistant: ${metrics.tokens.byRole.assistant}
  Tool: ${metrics.tokens.byRole.tool}
  System: ${metrics.tokens.byRole.system}

${colors.bold('Tool Performance:')}
${colors.cyan('Most Used Tools:')}
${
			metrics.tools.usage
				.sort((a, b) => b.uses - a.uses)
				.slice(0, 3)
				.map((tool) =>
					`  ${tool.name}: ${tool.uses} uses (${(tool.successes / tool.uses * 100).toFixed(1)}% success)`
				)
				.join('\n')
		}

${
			metrics.tools.sequences.length > 0
				? `${colors.cyan('Common Tool Sequences:')}
${
					metrics.tools.sequences
						.slice(0, 2)
						.map((seq) => `  ${seq.tools.join(' → ')} (${seq.occurrences}x)`)
						.join('\n')
				}`
				: ''
		}

${colors.bold('File Operations:')}
${colors.cyan('Most Accessed:')}
${
			metrics.files.mostAccessed
				.slice(0, 3)
				.map((file) => `  ${file}`)
				.join('\n')
		}

${colors.bold('Quality Metrics:')}
${colors.cyan('Error Rate:')} ${(metrics.quality.errorRate * 100).toFixed(1)}%
${colors.cyan('Tool Success Rate:')} ${(metrics.quality.averageToolSuccess * 100).toFixed(1)}%
${colors.cyan('Retries:')} ${metrics.quality.retryCount}
${colors.cyan('User Corrections:')} ${metrics.quality.userCorrections}

${colors.bold('Timing:')}
${colors.cyan('Start Time:')} ${new Date(metrics.summary.startTime).toLocaleString()}
${colors.cyan('Last Update:')} ${new Date(metrics.summary.lastUpdateTime).toLocaleString()}
  `;
	} else {
		logger.error('Unexpected bbResponse format:', bbResponse);
		return bbResponse;
	}
};
