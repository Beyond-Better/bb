import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult } from 'api/llms/llmTool.ts';
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import type { LLMToolConversationMetricsResultData } from './types.ts';
import LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
import { stripIndents } from 'common-tags';

export const formatLogEntryToolUse = (_toolInput: LLMToolInputSchema): LLMToolLogEntryFormattedResult => {
	return {
		title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Use', 'Conversation Metrics'),
		subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Calculating conversation metrics...'),
		content: stripIndents`
            Analyzing turns, message types, and token usage...
        `.trim(),
		preview: 'Analyzing conversation metrics',
	};
};

function formatChatMetrics(chatMetrics: LLMToolConversationMetricsResultData['tokens']): string {
	if (chatMetrics.totalUsage.total === 0) {
		return '- No auxiliary chat activity';
	}

	return stripIndents`
        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Total Usage:')}
        Input: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.totalUsage.input)} tokens
        Output: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.totalUsage.output)} tokens
        Total: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.totalUsage.total)} tokens

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Cache Impact:')}
        Potential Cost: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.cacheImpact.potentialCost)} tokens
        Actual Cost: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.cacheImpact.actualCost)} tokens
        Total Savings: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.cacheImpact.savingsTotal)} tokens
        Efficiency: ${LLMTool.TOOL_STYLES_CONSOLE.content.percentage(chatMetrics.cacheImpact.savingsPercentage)} saved

        ${LLMTool.TOOL_STYLES_CONSOLE.base.label('By Role:')}
        User: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.byRole.user)} tokens
        Assistant: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.byRole.assistant)} tokens
        System: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(chatMetrics.byRole.system)} tokens
    `.trim();
}

export const formatLogEntryToolResult = (
	resultContent: CollaborationLogEntryContentToolResult,
): LLMToolLogEntryFormattedResult => {
	const { bbResponse } = resultContent;
	if (typeof bbResponse === 'object' && 'data' in bbResponse) {
		const metrics = bbResponse.data as LLMToolConversationMetricsResultData;
		const content = stripIndents`
            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Basic Statistics:')}
            Total Turns: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.totalTurns)}
            Message Types:
              User: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.messageTypes.user)}
              Assistant: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.messageTypes.assistant)}
              Tool: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.messageTypes.tool)}
              System: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.messageTypes.system)}
            Active Files: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.activeFiles)}
            Unique Tools: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.uniqueToolsUsed)}
            Duration: ${LLMTool.TOOL_STYLES_CONSOLE.content.duration(metrics.timing.totalDuration)}
            Start Time: ${LLMTool.TOOL_STYLES_CONSOLE.content.timeAgo(metrics.summary.startTime)}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Token Usage:')}
            Total Usage:
              Input: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.totalUsage.input)} tokens
              Output: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.totalUsage.output)} tokens
              Total: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.totalUsage.total)} tokens

            Differential Usage:
              Input: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.differentialUsage.input)} tokens
              Output: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.differentialUsage.output)} tokens
              Total: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.differentialUsage.total)} tokens

            Cache Impact:
              Potential Cost: ${
			LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.cacheImpact.potentialCost)
		} tokens
              Actual Cost: ${
			LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.cacheImpact.actualCost)
		} tokens
              Total Savings: ${
			LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.cacheImpact.savingsTotal)
		} tokens
              Efficiency: ${
			LLMTool.TOOL_STYLES_CONSOLE.content.percentage(metrics.tokens.cacheImpact.savingsPercentage)
		} saved

            By Role:
              User: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.byRole.user)} tokens
              Assistant: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.byRole.assistant)} tokens
              Tool: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.byRole.tool)} tokens
              System: ${LLMTool.TOOL_STYLES_CONSOLE.content.tokenUsage(metrics.tokens.byRole.system)} tokens

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Tool Performance:')}
            Most Used Tools:
            ${
			metrics.tools.usage
				.sort((a, b) => b.uses - a.uses)
				.slice(0, 3)
				.map((tool) =>
					`  ${LLMTool.TOOL_STYLES_CONSOLE.content.toolName(tool.name)}: ${
						LLMTool.TOOL_STYLES_CONSOLE.content.counts(tool.uses)
					} uses (${
						LLMTool.TOOL_STYLES_CONSOLE.content.percentage(tool.successes / tool.uses * 100)
					} success rate)`
				)
				.join('\n')
		}

            ${
			metrics.tools.sequences.length > 0
				? `
            Common Tool Sequences:
            ${
					metrics.tools.sequences
						.slice(0, 2)
						.map((seq) =>
							`  ${seq.tools.map((t) => LLMTool.TOOL_STYLES_CONSOLE.content.toolName(t)).join(' → ')} (${
								LLMTool.TOOL_STYLES_CONSOLE.content.counts(seq.occurrences)
							} times)`
						)
						.join('\n')
				}`
				: ''
		}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('File Operations:')}
            Most Accessed Files:
            ${
			metrics.files.mostAccessed
				.slice(0, 3)
				.map((file) => `  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file)}`)
				.join('\n')
		}
            ${
			metrics.files.metrics.length > 0
				? `
            File Statistics:
            ${
					metrics.files.metrics
						.slice(0, 3)
						.map((file) =>
							`  ${LLMTool.TOOL_STYLES_CONSOLE.content.filename(file.path)}: ` +
							`${
								LLMTool.TOOL_STYLES_CONSOLE.content.counts(
									file.operations.added + file.operations.modified + file.operations.removed,
								)
							} operations ` +
							`(${LLMTool.TOOL_STYLES_CONSOLE.content.counts(file.operations.added)} added, ` +
							`${LLMTool.TOOL_STYLES_CONSOLE.content.counts(file.operations.modified)} modified, ` +
							`${LLMTool.TOOL_STYLES_CONSOLE.content.counts(file.operations.removed)} removed)`
						)
						.join('\n')
				}`
				: ''
		}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Quality Metrics:')}
            Error Rate: ${LLMTool.TOOL_STYLES_CONSOLE.content.percentage(metrics.quality.errorRate * 100)}
            Tool Success Rate: ${
			LLMTool.TOOL_STYLES_CONSOLE.content.percentage(metrics.quality.averageToolSuccess * 100)
		}
            Retries: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.quality.retryCount)} attempts
            User Corrections: ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.quality.userCorrections)} corrections

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Timing:')}
            Last Update: ${LLMTool.TOOL_STYLES_CONSOLE.content.timeAgo(metrics.summary.lastUpdateTime)}

            ${LLMTool.TOOL_STYLES_CONSOLE.base.label('Chat Token Usage:')}
            ${metrics.chatTokens ? formatChatMetrics(metrics.chatTokens) : '- No auxiliary chat activity'}
        `;

		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Result', 'Conversation Metrics'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle(
				`${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.totalTurns)} turns analyzed over ${
					LLMTool.TOOL_STYLES_CONSOLE.content.duration(metrics.timing.totalDuration)
				}`,
			),
			content,
			preview: `Analyzed ${LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.totalTurns)} turns using ${
				LLMTool.TOOL_STYLES_CONSOLE.content.counts(metrics.summary.uniqueToolsUsed)
			} unique tools`,
		};
	} else {
		logger.error('LLMToolConversationMetrics: Unexpected bbResponse format:', bbResponse);
		return {
			title: LLMTool.TOOL_STYLES_CONSOLE.content.title('Tool Error', 'Conversation Metrics'),
			subtitle: LLMTool.TOOL_STYLES_CONSOLE.content.subtitle('Failed to process metrics'),
			content: bbResponse,
			preview: 'Error processing metrics',
		};
	}
};
