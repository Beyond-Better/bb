import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { JSX } from 'preact';
import { renderToString } from 'preact-render-to-string';

import LogEntryFormatterManager from '../logEntries/logEntryFormatterManager.ts';
//import ConversationLogFormatter from 'cli/conversationLogFormatter.ts';
import type { ConversationId, ConversationStats, TokenUsage } from 'shared/types.ts';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import { getBbDataDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
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

export type ConversationLogEntryContent =
	| string
	| AuxiliaryChatContent
	| LLMToolInputSchema
	| ConversationLogEntryContentToolResult;

export interface ConversationLogEntry {
	entryType: ConversationLogEntryType;
	content: ConversationLogEntryContent;
	thinking?: string;
	toolName?: string;
}

const configManager = await ConfigManagerV2.getInstance();
const globalConfig = await configManager.getGlobalConfig();

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
		private projectId: string,
		private conversationId: ConversationId,
		private logEntryHandler: (
			timestamp: string,
			logEntry: ConversationLogEntry,
			conversationStats: ConversationStats,
			tokenUsageTurn: TokenUsage,
			tokenUsageStatement: TokenUsage,
			tokenUsageConversation: TokenUsage,
		) => Promise<void>,
	) {}

	async init(): Promise<ConversationLogger> {
		const projectConfig = await configManager.getProjectConfig(this.projectId);
		this.logEntryFormatterManager = await new LogEntryFormatterManager(projectConfig).init();

		this.conversationLogsDir = await ConversationLogger.getLogFileDirPath(this.projectId, this.conversationId);

		this.logFileRaw = await ConversationLogger.getLogFileRawPath(this.projectId, this.conversationId);
		this.logFileJson = await ConversationLogger.getLogFileJsonPath(this.projectId, this.conversationId);

		ConversationLogger.entryTypeLabels.user = globalConfig.myPersonsName || 'Person';
		ConversationLogger.entryTypeLabels.assistant = globalConfig.myAssistantsName || 'Assistant';

		return this;
	}

	async ensureConversationLogsDir(): Promise<void> {
		if (this.ensuredDir) return;
		await ensureDir(this.conversationLogsDir);
		this.ensuredDir = true;
	}
	static async getLogFileDirPath(projectId: string, conversationId: string): Promise<string> {
		const bbDataDir = await getBbDataDir(projectId);
		const conversationLogsDir = join(bbDataDir, 'conversations', conversationId);
		//await ensureDir(conversationLogsDir);
		return conversationLogsDir;
	}
	static async getLogFileRawPath(projectId: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(projectId, conversationId);
		return join(conversationLogsDir, 'conversation.log');
	}
	static async getLogFileJsonPath(projectId: string, conversationId: string): Promise<string> {
		const conversationLogsDir = await ConversationLogger.getLogFileDirPath(projectId, conversationId);
		return join(conversationLogsDir, 'conversation.jsonl');
	}

	static async getLogEntries(projectId: string, conversationId: string): Promise<Array<ConversationLogEntry>> {
		const conversationLogFile = await ConversationLogger.getLogFileJsonPath(projectId, conversationId);
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
		conversationStats: ConversationStats = { statementCount: 0, statementTurnCount: 0, conversationTurnCount: 0 },
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
		tokenUsageConversation: TokenUsage = {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
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

	async logUserMessage(messageId: string, message: string, conversationStats: ConversationStats) {
		await this.logEntry(messageId, { entryType: 'user', content: message }, conversationStats);
	}

	async logAssistantMessage(
		messageId: string,
		message: string,
		conversationStats: ConversationStats,
		tokenUsageTurn: TokenUsage,
		tokenUsageStatement: TokenUsage,
		tokenUsageConversation: TokenUsage,
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
		conversationStats: ConversationStats,
		tokenUsageTurn: TokenUsage,
		tokenUsageStatement: TokenUsage,
		tokenUsageConversation: TokenUsage,
	) {
		await this.logEntry(
			messageId,
			{ entryType: 'answer', content: answer },
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logAuxiliaryMessage(
		messageId: string,
		message: string | AuxiliaryChatContent,
		conversationStats?: ConversationStats,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: TokenUsage,
	) {
		await this.logEntry(
			messageId,
			{ entryType: 'auxiliary', content: message },
			conversationStats,
			tokenUsageTurn,
			tokenUsageStatement,
			tokenUsageConversation,
		);
	}

	async logToolUse(
		messageId: string,
		toolName: string,
		toolInput: LLMToolInputSchema,
		conversationStats: ConversationStats,
		tokenUsageTurn: TokenUsage,
		tokenUsageStatement: TokenUsage,
		tokenUsageConversation: TokenUsage,
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
		_conversationStats: ConversationStats,
		_tokenUsage: TokenUsage,
		_tokenUsageStatement?: TokenUsage,
		_tokenUsageConversation?: TokenUsage,
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
			: renderToString(formattedContent.content as JSX.Element);

		const label = ConversationLogger.entryTypeLabels[logEntry.entryType] || 'Unknown';
		return `## ${label} [${timestamp}]\n${rawEntryContent.trim()}`;
	}

	async createRawEntryWithSeparator(
		timestamp: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationStats,
		tokenUsage: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: TokenUsage,
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
