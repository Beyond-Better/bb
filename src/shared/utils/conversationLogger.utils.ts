import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import { getBbaiDataDir } from 'shared/dataDir.ts';
import { LogFormatter } from 'shared/logFormatter.ts';
import { logger } from 'shared/logger.ts';
import {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';

export type ConversationLoggerEntryType = 'user' | 'assistant' | 'tool_use' | 'tool_result' | 'auxiliary' | 'error'; //text_change

export class ConversationLogger {
	private logFile!: string;

	constructor(
		private startDir: string,
		private conversationId: ConversationId,
		private logEntryHandler: (
			type: ConversationLoggerEntryType,
			timestamp: string,
			content: string,
			conversationStats: ConversationMetrics,
			tokenUsageTurn: TokenUsage,
			tokenUsageStatement: TokenUsage,
			tokenUsageConversation: ConversationTokenUsage,
		) => {},
	) {}

	async init(): Promise<ConversationLogger> {
		const bbaiDataDir = await getBbaiDataDir(this.startDir);
		const conversationLogsDir = join(bbaiDataDir, 'conversations', this.conversationId);
		await ensureDir(conversationLogsDir);
		this.logFile = join(conversationLogsDir, 'conversation.log');
		return this;
	}

	private async appendToLog(content: string) {
		await Deno.writeTextFile(this.logFile, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(
		type: ConversationLoggerEntryType,
		message: string,
		conversationStats: ConversationMetrics = { statementCount: 0, turnCount: 0, totalTurnCount: 0 },
		tokenUsageTurn: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		},
		tokenUsageStatement: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
		},
		tokenUsageConversation: ConversationTokenUsage = {
			inputTokensTotal: 0,
			outputTokensTotal: 0,
			totalTokensTotal: 0,
		},
	) {
		const timestamp = this.getTimestamp();

		try {
			await this.logEntryHandler(
				type,
				timestamp,
				message,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			console.error('Error in logEntryHandler:', error);
		}

		const entry = LogFormatter.createRawEntryWithSeparator(
			type,
			timestamp,
			message,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);

		try {
			await this.appendToLog(entry);
		} catch (error) {
			console.error('Error appending to log:', error);
		}
	}

	async logUserMessage(message: string, conversationStats?: ConversationMetrics) {
		await this.logEntry('user', message, conversationStats);
	}

	async logAssistantMessage(
		message: string,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		await this.logEntry(
			'assistant',
			message,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAuxiliaryMessage(message: string) {
		await this.logEntry(
			'auxiliary',
			message,
		);
	}

	async logToolUse(
		toolName: string,
		toolInput: object,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		let message: string;
		try {
			message = `Tool: ${toolName}\nInput: \n${JSON.stringify(toolInput, null, 2)}`;
		} catch (error) {
			console.error(`Error formatting tool use for ${toolName}:`, error);
			message = `Tool: ${toolName}\nInput: [Error formatting input]`;
		}
		try {
			await this.logEntry(
				'tool_use',
				message,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			console.error('Error in logEntry:', error);
		}
	}

	async logToolResult(
		toolName: string,
		result: string | LLMMessageContentPart | LLMMessageContentParts,
		//conversationStats?: ConversationMetrics,
		//tokenUsageTurn?: TokenUsage,
		//tokenUsageStatement?: TokenUsage,
		//tokenUsageConversation?: ConversationTokenUsage,
	) {
		let message: string;
		try {
			//const formatter = LLMToolManager.getToolFormatter(toolName);
			//if (formatter) {
			//	message = formatter.formatToolResult(toolName, result);
			//} else {
			message = `Tool: ${toolName}\nResult: ${this.formatDefaultToolResult(result)}`;
			//}
		} catch (error) {
			console.error(`Error formatting tool result for ${toolName}:`, error);
			message = `Tool: ${toolName}\nResult: [Error formatting result]`;
		}
		await this.logEntry('tool_result', message);
	}

	async logError(error: string) {
		await this.logEntry('error', error);
	}

	//async logTextChange(filePath: string, patch: string) {
	//	const message = `Diff Patch for ${filePath}:\n${patch}`;
	//	await this.logEntry('text_change', message);
	//}

	private formatDefaultToolResult(result: string | LLMMessageContentPart | LLMMessageContentParts): string {
		try {
			if (Array.isArray(result)) {
				return 'text' in result[0]
					? (result[0] as LLMMessageContentPartTextBlock).text
					: JSON.stringify(result[0], null, 2);
			} else if (typeof result !== 'string') {
				return 'text' in result
					? (result as LLMMessageContentPartTextBlock).text
					: JSON.stringify(result, null, 2);
			} else {
				return result;
			}
		} catch (error) {
			console.error('Error in formatDefaultToolResult:', error);
			return '[Error formatting result]';
		}
	}
}
