//import type { JSX } from 'preact';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMToolConversationMetricsInput,
	LLMToolConversationMetricsResponseData,
	LLMToolConversationMetricsResultData,
	LLMToolFileMetrics,
	LLMToolToolMetrics,
} from './types.ts';

export default class LLMToolConversationMetrics extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				includeTools: {
					type: 'boolean',
					description: 'Include detailed tool usage metrics',
					default: true,
				},
				includeFiles: {
					type: 'boolean',
					description: 'Include file operation metrics',
					default: true,
				},
				includeTokens: {
					type: 'boolean',
					description: 'Include detailed token usage metrics',
					default: true,
				},
				includeTiming: {
					type: 'boolean',
					description: 'Include timing metrics',
					default: true,
				},
				includeQuality: {
					type: 'boolean',
					description: 'Include quality metrics',
					default: true,
				},
				startTurn: {
					type: 'number',
					description: 'Start analysis from this turn number',
				},
				endTurn: {
					type: 'number',
					description: 'End analysis at this turn number',
				},
			},
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		try {
			const {
				includeTools = true,
				includeFiles = true,
				includeTokens = true,
				includeTiming = true,
				includeQuality = true,
				startTurn,
				endTurn,
			} = toolUse.toolInput as LLMToolConversationMetricsInput;

			const messages = interaction.getMessages();
			const filteredMessages = startTurn || endTurn ? messages.slice((startTurn || 1) - 1, endTurn) : messages;

			const metrics = await this.calculateMetrics(filteredMessages, interaction, {
				includeTools,
				includeFiles,
				includeTokens,
				includeTiming,
				includeQuality,
			});

			const toolResults = this.formatMetrics(metrics);
			const toolResponse =
				`Analyzed ${metrics.summary.totalTurns} conversation turns with ${metrics.summary.uniqueToolsUsed} unique tools used. Unless specifically asked to perform additional analysis or tasks, no further action is needed.`;
			const bbResponse: LLMToolConversationMetricsResponseData = {
				data: metrics,
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(
				`LLMToolConversationMetrics: Error calculating conversation metrics: ${(error as Error).message}`,
			);

			throw createError(
				ErrorType.ToolHandling,
				`Error calculating conversation metrics: ${(error as Error).message}`,
				{
					name: 'conversation-metrics',
					toolName: 'conversation_metrics',
					operation: 'tool-run',
				},
			);
		}
	}

	private async calculateMetrics(
		messages: LLMMessage[],
		interaction: LLMConversationInteraction,
		options: {
			includeTools: boolean;
			includeFiles: boolean;
			includeTokens: boolean;
			includeTiming: boolean;
			includeQuality: boolean;
		},
	): Promise<LLMToolConversationMetricsResultData> {
		const metrics: LLMToolConversationMetricsResultData = {
			summary: {
				totalTurns: messages.length,
				messageTypes: {
					user: 0,
					assistant: 0,
					tool: 0,
					system: 0,
				},
				activeFiles: 0,
				uniqueToolsUsed: 0,
				startTime: messages[0]?.timestamp || new Date().toISOString(),
				lastUpdateTime: messages[messages.length - 1]?.timestamp || new Date().toISOString(),
			},
			tokens: {
				// TokenUsageAnalysis fields
				totalUsage: {
					input: 0,
					output: 0,
					total: 0,
					cacheCreationInput: 0,
					cacheReadInput: 0,
					totalAll: 0,
				},
				differentialUsage: {
					input: 0,
					output: 0,
					total: 0,
				},
				cacheImpact: {
					potentialCost: 0,
					actualCost: 0,
					savingsTotal: 0,
					savingsPercentage: 0,
				},
				byRole: {
					user: 0,
					assistant: 0,
					system: 0,
					tool: 0,
				},
				// Legacy fields
				total: 0,
				byTurn: [],
				averagePerTurn: 0,
			},
			timing: {
				totalDuration: 0,
				averageResponseTime: 0,
				byTurn: [],
			},
			tools: {
				usage: [],
				sequences: [],
			},
			files: {
				metrics: [],
				mostAccessed: [],
			},
			quality: {
				errorRate: 0,
				retryCount: 0,
				userCorrections: 0,
				averageToolSuccess: 0,
			},
		};

		// Track tool sequences
		const toolSequence: string[] = [];
		const toolSequences = new Map<string, number>();

		// Track file operations
		const fileOps = new Map<string, LLMToolFileMetrics>();

		// Track tool usage
		const toolUsage = new Map<string, LLMToolToolMetrics>();

		let lastTimestamp: string | null = null;
		let errorCount = 0;
		let toolSuccessCount = 0;
		let toolTotalCount = 0;

		for (const [index, message] of messages.entries()) {
			// Basic metrics
			metrics.summary.messageTypes[message.role]++;

			// Token metrics
			if (options.includeTokens) {
				// Get token analysis from persistence
				const tokenAnalysis = await interaction.conversationPersistence.getTokenUsageAnalysis();

				// Add chat metrics if available
				if (tokenAnalysis.chat.totalUsage.total > 0) {
					metrics.chatTokens = {
						// TokenUsageAnalysis fields
						totalUsage: tokenAnalysis.chat.totalUsage,
						differentialUsage: tokenAnalysis.chat.differentialUsage,
						cacheImpact: tokenAnalysis.chat.cacheImpact,
						byRole: {
							...tokenAnalysis.chat.byRole,
							tool: 0, // Chat interactions don't use tools
						},
						total: tokenAnalysis.chat.totalUsage.total,
						byTurn: [],
						averagePerTurn: 0,
					};
				}

				// Calculate total tool usage from toolStats
				const toolTotal = Array.from(toolUsage.values())
					.reduce((sum, tool) => sum + tool.uses, 0);

				metrics.tokens = {
					totalUsage: tokenAnalysis.conversation.totalUsage,
					differentialUsage: tokenAnalysis.conversation.differentialUsage,
					cacheImpact: tokenAnalysis.conversation.cacheImpact,
					byRole: {
						...tokenAnalysis.conversation.byRole,
						tool: toolTotal, // Set tool usage from actual tool metrics
					},
					// Legacy metrics
					total: tokenAnalysis.conversation.totalUsage.total,
					byTurn: metrics.tokens.byTurn,
					averagePerTurn: tokenAnalysis.conversation.totalUsage.total / messages.length,
				};

				// Only add turn data if we have provider response
				if (message.providerResponse?.usage) {
					const turnTokens = message.providerResponse.usage.totalTokens;
					// Update legacy metrics
					metrics.tokens.total += turnTokens;
					metrics.tokens.byRole[message.role] += turnTokens;
					metrics.tokens.byTurn.push({
						turn: index + 1,
						tokens: turnTokens,
						role: message.role,
					});
				}
			}

			// Timing metrics
			if (options.includeTiming && message.timestamp && lastTimestamp) {
				const duration = new Date(message.timestamp).getTime() - new Date(lastTimestamp).getTime();
				metrics.timing.totalDuration += duration;
				metrics.timing.byTurn.push({
					turn: index + 1,
					duration,
				});
			}
			lastTimestamp = message.timestamp;

			// Tool metrics
			if (options.includeTools && message.providerResponse?.toolsUsed) {
				for (const toolUse of message.providerResponse.toolsUsed) {
					const toolName = toolUse.toolName;
					toolSequence.push(toolName);

					// Update tool metrics
					const tool = toolUsage.get(toolName) || {
						name: toolName,
						uses: 0,
						successes: 0,
						failures: 0,
						averageResponseTime: 0,
					};
					tool.uses++;
					if (!toolUse.toolValidation.validated) {
						tool.failures++;
						errorCount++;
					} else {
						tool.successes++;
						toolSuccessCount++;
					}
					toolTotalCount++;
					toolUsage.set(toolName, tool);
				}

				// Record tool sequence when we see a non-tool message or end
				if (
					toolSequence.length > 0 &&
					(index === messages.length - 1 || !messages[index + 1].providerResponse?.toolsUsed)
				) {
					if (toolSequence.length > 1) {
						const seq = toolSequence.join(',');
						toolSequences.set(seq, (toolSequences.get(seq) || 0) + 1);
					}
					toolSequence.length = 0;
				}
			}

			// File metrics
			if (options.includeFiles) {
				const fileOp = this.extractFileOperation(message);
				if (fileOp) {
					const { path, operation } = fileOp;
					const metric = fileOps.get(path) || {
						path,
						operations: { added: 0, modified: 0, removed: 0 },
						lastOperation: operation,
						currentStatus: 'active',
					};
					metric.operations[operation]++;
					fileOps.set(path, metric);
				}
			}
		}

		// Calculate averages and finalize metrics
		if (options.includeTokens) {
			metrics.tokens.averagePerTurn = metrics.tokens.total / messages.length;
		}

		if (options.includeTiming) {
			metrics.timing.averageResponseTime = metrics.timing.totalDuration / (messages.length - 1);
		}

		if (options.includeTools) {
			metrics.tools.usage = Array.from(toolUsage.values());
			metrics.summary.uniqueToolsUsed = toolUsage.size;
			metrics.tools.sequences = Array.from(toolSequences.entries())
				.map(([tools, occurrences]) => ({
					tools: tools.split(','),
					occurrences,
				}))
				.sort((a, b) => b.occurrences - a.occurrences);
		}

		if (options.includeFiles) {
			metrics.files.metrics = Array.from(fileOps.values());
			metrics.summary.activeFiles = metrics.files.metrics.filter((f) => f.currentStatus === 'active').length;
			metrics.files.mostAccessed = Array.from(fileOps.entries())
				.sort((a, b) => {
					const opsA = Object.values(a[1].operations).reduce((sum, val) => sum + val, 0);
					const opsB = Object.values(b[1].operations).reduce((sum, val) => sum + val, 0);
					return opsB - opsA;
				})
				.slice(0, 5)
				.map(([path]) => path);
		}

		if (options.includeQuality) {
			metrics.quality = {
				errorRate: errorCount / messages.length,
				retryCount: this.countRetries(messages),
				userCorrections: this.countUserCorrections(messages),
				averageToolSuccess: toolTotalCount > 0 ? toolSuccessCount / toolTotalCount : 0,
			};
		}

		return metrics;
	}

	private extractFileOperation(
		message: LLMMessage,
	): { path: string; operation: 'added' | 'modified' | 'removed' } | null {
		if (!message.providerResponse?.toolsUsed?.length) return null;

		// Look at the first tool use (file operations typically don't chain)
		const toolUse = message.providerResponse.toolsUsed[0];
		const toolName = toolUse.toolName.toLowerCase();

		if (toolName.includes('rewrite') || toolName.includes('search_and_replace')) {
			return { path: toolUse.toolInput.filePath as string, operation: 'modified' };
		}
		if (toolName === 'request_files') {
			return { path: (toolUse.toolInput.fileNames as string[])[0], operation: 'added' };
		}
		if (toolName === 'forget_files') {
			return { path: (toolUse.toolInput.files as Array<{ filePath: string }>)[0].filePath, operation: 'removed' };
		}

		return null;
	}

	private countRetries(messages: LLMMessage[]): number {
		let retries = 0;
		for (let i = 1; i < messages.length; i++) {
			const current = messages[i].providerResponse?.toolsUsed?.[0];
			const previous = messages[i - 1].providerResponse?.toolsUsed?.[0];
			if (
				current && previous &&
				current.toolName === previous.toolName &&
				!previous.toolValidation.validated
			) {
				retries++;
			}
		}
		return retries;
	}

	private countUserCorrections(messages: LLMMessage[]): number {
		let corrections = 0;
		for (let i = 1; i < messages.length; i++) {
			const message = messages[i];
			if (message.role === 'user') {
				// Look for correction indicators in text content parts
				const hasCorrection = Array.isArray(message.content) && message.content.some((part) => {
					if (part.type === 'text') {
						const text = (part as LLMMessageContentPartTextBlock).text.toLowerCase();
						return text.includes('incorrect') ||
							text.includes('wrong') ||
							text.includes('error') ||
							text.includes('fix');
					}
					return false;
				});
				if (hasCorrection) corrections++;
			}
		}
		return corrections;
	}

	private formatMetrics(metrics: LLMToolConversationMetricsResultData): string {
		return `Conversation Metrics Summary:

Basic Statistics:
- Total Turns: ${metrics.summary.totalTurns}
- Message Types: ${
			Object.entries(metrics.summary.messageTypes)
				.map(([type, count]) => `${type}: ${count}`).join(', ')
		}
- Active Files: ${metrics.summary.activeFiles}
- Unique Tools Used: ${metrics.summary.uniqueToolsUsed}
- Duration: ${(metrics.timing.totalDuration / 1000 / 60).toFixed(2)} minutes

Token Usage:
- Total Usage:
  * Input: ${metrics.tokens.totalUsage.input}
  * Output: ${metrics.tokens.totalUsage.output}
  * Total: ${metrics.tokens.totalUsage.total}
- Differential Usage:
  * Input: ${metrics.tokens.differentialUsage.input}
  * Output: ${metrics.tokens.differentialUsage.output}
  * Total: ${metrics.tokens.differentialUsage.total}
- Cache Impact:
  * Potential Cost: ${metrics.tokens.cacheImpact.potentialCost}
  * Actual Cost: ${metrics.tokens.cacheImpact.actualCost}
  * Total Savings: ${metrics.tokens.cacheImpact.savingsTotal}
  * Savings Percentage: ${metrics.tokens.cacheImpact.savingsPercentage.toFixed(2)}%
- Average per Turn: ${metrics.tokens.averagePerTurn.toFixed(1)}
- By Role: ${
			Object.entries(metrics.tokens.byRole)
				.map(([role, tokens]) => `${role}: ${tokens}`).join(', ')
		}

Tool Usage:
- Total Tool Tokens: ${metrics.tokens.byRole.tool}

Tool Performance:
- Most Used Tools: ${
			metrics.tools.usage
				.sort((a, b) => b.uses - a.uses)
				.slice(0, 3)
				.map((t) => `${t.name} (${t.uses} uses, ${(t.successes / t.uses * 100).toFixed(1)}% success)`)
				.join(', ')
		}
- Common Tool Sequences: ${
			metrics.tools.sequences
				.slice(0, 2)
				.map((s) => `[${s.tools.join(' → ')}] (${s.occurrences}x)`)
				.join(', ')
		}

File Operations:
- Most Accessed: ${
			metrics.files.mostAccessed
				.slice(0, 3)
				.join(', ')
		}

Detailed Tool Metrics:
${
			metrics.tools.usage
				.sort((a, b) => b.uses - a.uses)
				.map((tool) =>
					`- ${tool.name}:
  * Uses: ${tool.uses}
  * Success Rate: ${(tool.successes / tool.uses * 100).toFixed(1)}%
  * Average Response Time: ${tool.averageResponseTime.toFixed(2)}ms`
				)
				.join('\n')
		}

Quality Metrics:
- Error Rate: ${(metrics.quality.errorRate * 100).toFixed(1)}%
- Tool Success Rate: ${(metrics.quality.averageToolSuccess * 100).toFixed(1)}%
- Retries: ${metrics.quality.retryCount}
- User Corrections: ${metrics.quality.userCorrections}

Start Time: ${metrics.summary.startTime}
Last Update: ${metrics.summary.lastUpdateTime}

${
			metrics.chatTokens
				? `Chat Token Usage:
- Total Usage:
  * Input: ${metrics.chatTokens.totalUsage.input}
  * Output: ${metrics.chatTokens.totalUsage.output}
  * Total: ${metrics.chatTokens.totalUsage.total}
- Cache Impact:
  * Total Savings: ${metrics.chatTokens.cacheImpact.savingsTotal}
  * Savings Percentage: ${metrics.chatTokens.cacheImpact.savingsPercentage.toFixed(2)}%
- By Role:
  * User: ${metrics.chatTokens.byRole.user}
  * Assistant: ${metrics.chatTokens.byRole.assistant}
  * System: ${metrics.chatTokens.byRole.system}
  * Tool: ${metrics.chatTokens.byRole.tool}`
				: '- No auxiliary chat activity'
		}`;
	}
}
