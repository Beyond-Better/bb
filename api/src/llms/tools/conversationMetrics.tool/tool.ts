import type { JSX } from 'preact';

import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';

export interface LLMToolConversationMetricsData {
	totalTurns: number;
	messageTypes: {
		user: number;
		assistant: number;
		tool: number;
		system: number; //openai only
	};
	tokenUsage: {
		total: number;
		user: number;
		assistant: number;
		tool: number;
		system: number; //openai only
	};
}

export default class LLMToolConversationMetrics extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {},
		};
	}

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(resultContent) : formatToolResultBrowser(resultContent);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		_toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		try {
			const messages = interaction.getMessages();
			//logger.debug(`tool run messages:`, messages);
			const metrics = this.calculateMetrics(messages);

			const toolResults = JSON.stringify(metrics, null, 2);
			const toolResponse = `Conversation metrics calculated successfully.`;
			const bbResponse = {
				data: {
					metrics,
				},
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`Error calculating conversation metrics: ${error.message}`);

			throw createError(ErrorType.ToolHandling, `Error calculating conversation metrics: ${error.message}`, {
				name: 'conversation-metrics',
				toolName: 'conversation_metrics',
				operation: 'tool-run',
			});
		}
	}

	private calculateMetrics(messages: LLMMessage[]): LLMToolConversationMetricsData {
		const totalTurns = messages.length;
		const messageTypes = {
			user: 0,
			assistant: 0,
			tool: 0,
			system: 0, //openai only
		};
		const tokenUsage = {
			total: 0,
			user: 0,
			assistant: 0,
			tool: 0,
			system: 0, //openai only
		};

		// export interface TokenUsage {
		// 	inputTokens: number;
		// 	outputTokens: number;
		// 	totalTokens: number;
		// 	cacheCreationInputTokens?: number;
		// 	cacheReadInputTokens?: number;
		// }
		for (const message of messages) {
			messageTypes[message.role]++;
			tokenUsage[message.role] += message.providerResponse?.usage.totalTokens || 0;
			tokenUsage.total += message.providerResponse?.usage.totalTokens || 0;
		}

		return {
			totalTurns,
			messageTypes,
			tokenUsage,
		};
	}
}
