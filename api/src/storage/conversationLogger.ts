import { join } from '@std/path';
import { ensureDir } from '@std/fs';
import type { JSX } from 'preact';
import { renderToString } from 'preact-render-to-string';

import LogEntryFormatterManager from '../logEntries/logEntryFormatterManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import ConversationLogFormatter from 'cli/conversationLogFormatter.ts';
import type { ConversationId, ConversationLogDataEntry, ConversationStats, TokenUsageStats } from 'shared/types.ts';
import type { AuxiliaryChatContent } from 'api/logEntries/types.ts';
import type { LLMRequestParams } from 'api/types/llms.ts';
import { getBbDataDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
//import { ThinkingExtractor } from '../utils/thinkingExtractor.ts';
import type {
	LLMToolFormatterDestination,
	LLMToolInputSchema,
	LLMToolRunBbResponse,
	LLMToolRunResultContent,
} from 'api/llms/llmTool.ts';

export type ConversationLogEntryType =
	| 'user'
	| 'orchestrator' // user role, but prompt generated by LLM
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
		orchestrator: `${globalConfig.myAssistantsName || 'Assistant'} as Orchestrator`,
		assistant: globalConfig.myAssistantsName || 'Assistant',
		answer: `Answer from ${globalConfig.myAssistantsName || 'Assistant'}`,
		tool_use: 'Tool Input',
		tool_result: 'Tool Output',
		auxiliary: 'Auxiliary Chat',
		error: 'Error',
	};
	private logEntryFormatterManager!: LogEntryFormatterManager;
	private projectId: string;

	constructor(
		private projectEditor: ProjectEditor,
		private conversationId: ConversationId,
		private logEntryHandler: (
			messageId: string,
			parentMessageId: string | null,
			conversationId: ConversationId,
			agentInteractionId: ConversationId | null,
			timestamp: string,
			logEntry: ConversationLogEntry,
			conversationStats: ConversationStats,
			tokenUsageStats: TokenUsageStats,
			requestParams?: LLMRequestParams,
		) => Promise<void>,
	) {
		this.projectId = projectEditor.projectId;
	}

	async init(): Promise<ConversationLogger> {
		this.logEntryFormatterManager = await new LogEntryFormatterManager(this.projectEditor).init();

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

	static async getLogDataEntries(
		projectId: string,
		conversationId: string,
	): Promise<Array<ConversationLogDataEntry>> {
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
		parentMessageId: string | null,
		agentInteractionId: ConversationId | null,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationStats = { statementCount: 0, statementTurnCount: 0, conversationTurnCount: 0 },
		tokenUsageStats: TokenUsageStats = {
			tokenUsageTurn: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				totalAllTokens: 0,
			},
			tokenUsageStatement: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				totalAllTokens: 0,
			},
			tokenUsageConversation: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				totalAllTokens: 0,
			},
		},
		requestParams?: LLMRequestParams,
	) {
		const timestamp = this.getTimestamp();

		// logEntryHandler handles emitting events for cli and bui
		try {
			await this.logEntryHandler(
				messageId,
				parentMessageId,
				this.conversationId,
				agentInteractionId,
				timestamp,
				logEntry,
				conversationStats,
				tokenUsageStats,
				requestParams,
			);
		} catch (error) {
			logger.error('Error in logEntryHandler:', error);
		}

		const rawEntry = await this.createRawEntryWithSeparator(
			parentMessageId,
			agentInteractionId,
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageStats,
			requestParams,
		);
		try {
			await this.appendToRawLog(rawEntry);
		} catch (error) {
			logger.error('Error appending to raw log:', error);
		}

		const jsonEntry = JSON.stringify({
			messageId,
			parentMessageId,
			agentInteractionId,
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageStats,
			requestParams,
		});
		try {
			await this.appendToJsonLog(jsonEntry);
		} catch (error) {
			logger.error('Error appending to json log:', error as Error);
		}
	}

	async logUserMessage(
		messageId: string,
		message: string,
		conversationStats: ConversationStats,
	) {
		await this.logEntry(messageId, null, null, { entryType: 'user', content: message }, conversationStats);
	}

	async logOrchestratorMessage(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		message: string,
		conversationStats: ConversationStats,
	) {
		await this.logEntry(
			messageId,
			parentMessageId,
			agentInteractionId,
			{ entryType: 'orchestrator', content: message },
			conversationStats,
		);
	}

	async logAssistantMessage(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		message: string,
		thinking: string,
		conversationStats: ConversationStats,
		tokenUsageStats: TokenUsageStats,
		requestParams?: LLMRequestParams,
	) {
		await this.logEntry(
			messageId,
			parentMessageId,
			agentInteractionId,
			{
				entryType: 'assistant',
				content: message,
				thinking: thinking,
			},
			conversationStats,
			tokenUsageStats,
			requestParams,
		);
	}

	async logAnswerMessage(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		answer: string,
		assistantThinking: string,
		conversationStats: ConversationStats,
		tokenUsageStats: TokenUsageStats,
		requestParams?: LLMRequestParams,
	) {
		await this.logEntry(
			messageId,
			parentMessageId,
			agentInteractionId,
			{
				entryType: 'answer',
				content: answer,
				thinking: assistantThinking,
			},
			conversationStats,
			tokenUsageStats,
			requestParams,
		);
	}

	async logAuxiliaryMessage(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		message: string | AuxiliaryChatContent,
		conversationStats?: ConversationStats,
		tokenUsageStats?: TokenUsageStats,
		requestParams?: LLMRequestParams,
	) {
		await this.logEntry(
			messageId,
			parentMessageId,
			agentInteractionId,
			{ entryType: 'auxiliary', content: message },
			conversationStats,
			tokenUsageStats,
			requestParams,
		);
	}

	async logToolUse(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		toolName: string,
		toolInput: LLMToolInputSchema,
		conversationStats: ConversationStats,
		tokenUsageStats: TokenUsageStats,
		requestParams?: LLMRequestParams,
	) {
		try {
			await this.logEntry(
				messageId,
				parentMessageId,
				agentInteractionId,
				{ entryType: 'tool_use', content: toolInput, toolName },
				conversationStats,
				tokenUsageStats,
				requestParams,
			);
		} catch (error) {
			logger.error('Error in logEntry for logToolUse:', error);
		}
	}

	async logToolResult(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		toolName: string,
		toolResult: LLMToolRunResultContent,
		bbResponse: LLMToolRunBbResponse,
	) {
		try {
			await this.logEntry(messageId, parentMessageId, agentInteractionId, {
				entryType: 'tool_result',
				content: { toolResult, bbResponse },
				toolName,
			});
		} catch (error) {
			logger.error('Error in logEntry for logToolResult:', error);
		}
	}

	async logError(
		messageId: string,
		parentMessageId: string | null,
		agentInteractionId: string | null,
		error: string,
	) {
		await this.logEntry(messageId, parentMessageId, agentInteractionId, { entryType: 'error', content: error });
	}

	//async logTextChange(filePath: string, change: string) {
	//	const message = `Diff Patch for ${filePath}:\n${change}`;
	//	await this.logEntry('text_change', message);
	//}

	async createRawEntry(
		parentMessageId: string | null,
		agentInteractionId: string | null,
		timestamp: string,
		logEntry: ConversationLogEntry,
		_conversationStats: ConversationStats,
		_tokenUsageStats: TokenUsageStats,
		_requestParams?: LLMRequestParams,
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
		return `## ${label} [${timestamp}] [AgentId: ${agentInteractionId || '--'}][Parent MessageId:${
			parentMessageId || '--'
		}]\n${rawEntryContent.trim()}`;
	}

	async createRawEntryWithSeparator(
		parentMessageId: string | null,
		agentInteractionId: string | null,
		timestamp: string,
		logEntry: ConversationLogEntry,
		conversationStats: ConversationStats,
		tokenUsageStats: TokenUsageStats,
		requestParams?: LLMRequestParams,
	): Promise<string> {
		let rawEntry = await this.createRawEntry(
			parentMessageId,
			agentInteractionId,
			timestamp,
			logEntry,
			conversationStats,
			tokenUsageStats,
			requestParams,
		);
		// Ensure entry ends with a single newline and the separator
		rawEntry = rawEntry.trimEnd() + '\n' + ConversationLogger.getEntrySeparator() + '\n';
		return rawEntry;
	}

	static getEntrySeparator(): string {
		return this.ENTRY_SEPARATOR.trim();
	}
}
