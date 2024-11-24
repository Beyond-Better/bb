import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { JSX } from 'preact';
import { renderToString } from 'preact-render-to-string';

import LogEntryFormatterManager from '../logEntries/logEntryFormatterManager.ts';
//import ConversationLogFormatter from 'cli/conversationLogFormatter.ts';
import type { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import { getBbDataDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManager } from 'shared/configManager.ts';
import type {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunBbResponse,
	LLMToolRunResultContent,
} from 'api/llms/llmTool.ts';

export type ConversationLogEntryType =
	| 'user'
	| 'assistant'
	| 'tool_use'
	| 'tool_result'
	| 'answer'
	| 'auxiliary'
	| 'error'; //text_change

export interface ConversationLogEntryContentToolResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolRunBbResponse;
}

export type ConversationLogEntryContent = string | LLMToolInputSchema | ConversationLogEntryContentToolResult;

export interface ConversationLogEntry {
	entryType: ConversationLogEntryType;
	content: ConversationLogEntryContent;
	thinking?: string;
	toolName?: string;
}

const globalConfig = await ConfigManager.globalConfig();

export default class ConversationLogger {
	private logFileRaw!: string;
	private logFileJson!: string;
	private conversationLogsDir!: string;
	private ensuredDir: boolean = false;
	private static readonly ENTRY_SEPARATOR = '<<<BB_LOG_ENTRY_SEPARATOR>>>';
	private static readonly entryTypeLabels: Record<
		ConversationLogEntryType,
		string
	> = {
		user: globalConfig.myPersonsName || 'Person',
		assistant: globalConfig.myAssistantsName || 'Assistant',
		answer: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
		tool_use: 'Tool Input',
		tool_result: 'Tool Output',
		auxiliary: 'Auxiliary Chat',
		error: 'Error',
	};
	private logEntryFormatterManager!: LogEntryFormatterManager;

	constructor(
		private startDir: string,
		private conversationId: ConversationId,
		private logEntryHandler: (
			timestamp: string,
			logEntry: ConversationLogEntry,
			conversationStats: ConversationMetrics,
			tokenUsageTurn: TokenUsage,
			tokenUsageStatement: TokenUsage,
			tokenUsageConversation: ConversationTokenUsage,
		) => Promise<void>,
	) {}

	async init(): Promise<ConversationLogger> {
		const fullConfig = await ConfigManager.fullConfig(this.startDir);
		this.logEntryFormatterManager = await new LogEntryFormatterManager(fullConfig).init();

		this.conversationLogsDir = await ConversationLogger.getLogFileDirPath(this.startDir, this.conversationId);

		this.logFileRaw = await ConversationLogger.getLogFileRawPath(this.startDir, this.conversationId);
		this.logFileJson = await ConversationLogger.getLogFileJsonPath(this.startDir, this.conversationId);

		ConversationLogger.entryTypeLabels.user = fullConfig.myPersonsName || 'Person';
		ConversationLogger.entryTypeLabels.assistant = fullConfig.myAssistantsName || 'Assistant';

		return this;
	}

	async ensureConversationLogsDir(): Promise<void> {
		if (this.ensuredDir) return;
		await ensureDir(this.conversationLogsDir);
		this.ensuredDir = true;
	}
	static async getLogFileDirPath(startDir: string, conversationId: string): Promise<string> {
		const bbDataDir = await getBbDataDir(startDir);
		const conversationLogsDir = join(bbDataDir, 'conversations', conversationId);
		//await ensureDir(conversationLogsDir);
		return conversationLogsDir;
	}
	static async getLogFileRawPath(startDir: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(startDir, conversationId);
		return join(conversationLogsDir, 'conversation.log');
	}
	static async getLogFileJsonPath(startDir: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(startDir, conversationId);
		return join(conversationLogsDir, 'conversation.jsonl');
	}

	static async getLogEntries(startDir: string, conversationId: string): Promise<Array<ConversationLogEntry>> {
		const conversationLogFile = await ConversationLogger.getLogFileJsonPath(startDir, conversationId);
		const content = await Deno.readTextFile(conversationLogFile);
		return content.trim().split('\n').map((line) => JSON.parse(line));
	}

	private async appendToRawLog(content: string) {
		await this.ensureConversationLogsDir();
		await Deno.writeTextFile(this.logFileRaw, content + '\n', { append: true });
	}
	private async appendToJsonLog(content: string) {
		await this.ensureConversationLogsDir();
		await Deno.writeTextFile(this.logFileJson, content + '\n', { append: true });
	}

	private getTimestamp(): string {
		return new Date().toISOString();
	}

	private async logEntry(
		messageId: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationMetrics = { statementCount: 0, statementTurnCount: 0, conversationTurnCount: 0 },
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

		// logEntryHandler handles emitting events for cli and bui
		try {
			await this.logEntryHandler(
				timestamp,
				logEntry,
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			logger.error('Error in logEntryHandler:', error);
		}

		const rawEntry = await this.createRawEntryWithSeparator(
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
		try {
			await this.appendToRawLog(rawEntry);
		} catch (error) {
			logger.error('Error appending to raw log:', error);
		}

		const jsonEntry = JSON.stringify({
			messageId,
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		});
		try {
			await this.appendToJsonLog(jsonEntry);
		} catch (error) {
			logger.error('Error appending to json log:', error as Error);
		}
	}

	async logUserMessage(messageId: string, message: string, conversationStats?: ConversationMetrics) {
		await this.logEntry(messageId, { entryType: 'user', content: message }, conversationStats);
	}

	async logAssistantMessage(
		messageId: string,
		message: string,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		await this.logEntry(
			messageId,
			{ entryType: 'assistant', content: message },
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAnswerMessage(
		messageId: string,
		answer: string,
		conversationStats?: ConversationMetrics,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		await this.logEntry(
			messageId,
			{ entryType: 'answer', content: answer },
			conversationStats,
			{ // tokenUsageTurn
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAuxiliaryMessage(messageId: string, message: string) {
		await this.logEntry(
			messageId,
			{ entryType: 'auxiliary', content: message },
		);
	}

	async logToolUse(
		messageId: string,
		toolName: string,
		toolInput: LLMToolInputSchema,
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	) {
		try {
			await this.logEntry(
				messageId,
				{ entryType: 'tool_use', content: toolInput, toolName },
				conversationStats,
				tokenUsageTurn,
				tokenUsageStatement,
				tokenUsageConversation,
			);
		} catch (error) {
			logger.error('Error in logEntry for logToolUse:', error);
		}
	}

	async logToolResult(
		messageId: string,
		toolName: string,
		toolResult: LLMToolRunResultContent,
		bbResponse: LLMToolRunBbResponse,
	) {
		try {
			await this.logEntry(messageId, {
				entryType: 'tool_result',
				content: { toolResult, bbResponse },
				toolName,
			});
		} catch (error) {
			logger.error('Error in logEntry for logToolResult:', error);
		}
	}

	async logError(messageId: string, error: string) {
		await this.logEntry(messageId, { entryType: 'error', content: error });
	}

	//async logTextChange(filePath: string, change: string) {
	//	const message = `Diff Patch for ${filePath}:\n${change}`;
	//	await this.logEntry('text_change', message);
	//}

	async createRawEntry(
		timestamp: string,
		logEntry: ConversationLogEntry,
		_conversationStats: ConversationMetrics,
		_tokenUsage: TokenUsage,
		_tokenUsageStatement?: TokenUsage,
		_tokenUsageConversation?: ConversationTokenUsage,
	): Promise<string> {
		// [TODO] add token usage to header line
		const formattedContent = await this.logEntryFormatterManager.formatLogEntry(
			'console' as LLMToolFormatterDestination, // [TODO] we need a 'file' destination, use 'console' with ansi stripped
			logEntry,
			{}, // options
		);

		// Convert JSX to HTML string if necessary
		const rawEntryContent = typeof formattedContent === 'string'
			? formattedContent
			: renderToString(formattedContent as JSX.Element);

		const label = ConversationLogger.entryTypeLabels[logEntry.entryType] || 'Unknown';
		return `## ${label} [${timestamp}]\n${rawEntryContent.trim()}`;
	}

	async createRawEntryWithSeparator(
		timestamp: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationMetrics,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): Promise<string> {
		let rawEntry = await this.createRawEntry(
			timestamp,
			logEntry,
			conversationStats,
			tokenUsage,
			tokenUsageStatement,
			tokenUsageConversation,
		);
		// Ensure entry ends with a single newline and the separator
		rawEntry = rawEntry.trimEnd() + '\n' + ConversationLogger.getEntrySeparator() + '\n';
		return rawEntry;
	}

	static getEntrySeparator(): string {
		return this.ENTRY_SEPARATOR.trim();
	}
}
