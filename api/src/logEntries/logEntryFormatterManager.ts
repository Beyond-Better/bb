//import type { ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import type { LLMToolFormatterDestination, LLMToolInputSchema, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { JSX } from 'preact';
import LLMToolManager from '../llms/llmToolManager.ts';
import type { ConversationLogEntry, ConversationLogEntryContent, ConversationLogEntryType } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import type { FullConfigSchema } from 'shared/configSchema.ts';
import { escape as escapeHtmlEntities } from '@std/html';

export default class LogEntryFormatterManager {
	private toolManager!: LLMToolManager;

	constructor(
		private fullConfig: FullConfigSchema,
	) {}

	public async init(): Promise<LogEntryFormatterManager> {
		this.toolManager = await new LLMToolManager(this.fullConfig).init();
		//logger.debug(`LogEntryFormatterManager: Initialized toolManager:`, this.toolManager.getAllToolsMetadata());
		return this;
	}

	async formatLogEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		options?: any,
	): Promise<string | JSX.Element> {
		switch (logEntry.entryType as ConversationLogEntryType) {
			case 'user':
			case 'assistant':
			case 'answer':
			case 'auxiliary':
			case 'error':
				return this.formatBasicEntry(destination, logEntry, options);
			case 'tool_use':
			case 'tool_result':
				if (!logEntry.toolName) {
					throw new Error('Tool name is required for tool formatters');
				}
				return await this.formatToolEntry(destination, logEntry, options);
			default:
				throw new Error(`Unknown log entry type: ${logEntry.entryType}`);
		}
	}

	private async formatToolEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		_options: any,
	): Promise<string | JSX.Element> {
		if (!logEntry.toolName) throw new Error(`Tool name not provided in log entry: ${logEntry.toolName}`);
		const tool = await this.toolManager.getTool(logEntry.toolName);
		//logger.error(`LogEntryFormatterManager: Got tool ${logEntry.toolName}:`, tool);
		if (!tool) {
			throw new Error(`Tool not found: ${logEntry.toolName}`);
		}

		try {
			if (logEntry.entryType === 'tool_use') {
				return tool.formatToolUse(logEntry.content as LLMToolInputSchema, destination);
			} else {
				return tool.formatToolResult(logEntry.content as ConversationLogEntryContent, destination);
			}
		} catch (error) {
			logger.error(
				`LogEntryFormatterManager: Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}: ${
					(error as Error).message
				}`,
			);
			return `Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}`;
		}
	}

	private formatBasicEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		options?: unknown,
	): string {
		return destination === 'console'
			? this.formatBasicEntryConsole(logEntry, options)
			: this.formatBasicEntryBrowser(logEntry, options);
	}

	private formatBasicEntryConsole(logEntry: ConversationLogEntry, _options: unknown): string {
		// const { content, metadata } = entry;
		// const formattedMetadata = this.formatMetadataConsole(
		// 	metadata?.conversationStats,
		// 	metadata?.tokenUsageTurn,
		// 	metadata?.tokenUsageStatement,
		// 	metadata?.tokenUsageConversation,
		// );
		// return `${formattedContent}\n${formattedMetadata}`;
		const contentArray = this.formatContent(logEntry.content);
		return contentArray
			.map((item) => {
				if (item.type === 'text') {
					return item.content;
				} else if (item.type === 'image') {
					return '[Embedded Image]';
				}
				return '';
			})
			.join('\n');
	}

	private formatBasicEntryBrowser(logEntry: ConversationLogEntry, _options: unknown): string {
		// const { content, metadata } = entry;
		// const formattedMetadata = this.formatMetadataBrowser(
		// 	metadata?.conversationStats,
		// 	metadata?.tokenUsageTurn,
		// 	metadata?.tokenUsageStatement,
		// 	metadata?.tokenUsageConversation,
		// );
		// return `${formattedContent}${formattedMetadata}`;

		//logger.info('LogEntryFormatterManager: formatBasicEntryBrowser - ', logEntry);
		const contentArray = this.formatContent(logEntry.content);
		const formattedContent = contentArray
			.map((item) => {
				if (item.type === 'text') {
					return `<div>${escapeHtmlEntities(item.content)}</div>`;
				} else if (item.type === 'image') {
					const source = JSON.parse(item.content);
					return `<img src="data:${source.media_type};base64,${source.data}" alt="Embedded Image" />`;
				}
				return '';
			})
			.join('');
		return `<div class="${logEntry.entryType}-message">${formattedContent}</div>`;
	}

	private formatContent(
		content: string | LLMToolInputSchema | LLMToolRunResultContent,
	): Array<{ type: string; content: string }> {
		if (typeof content === 'string') {
			return this.formatContentString(content).map((line) => ({ type: 'text', content: line }));
		} else if (Array.isArray(content)) {
			return content.flatMap((part) => {
				if (part.type === 'text' && part.text) {
					return this.formatContentString(part.text).map((line) => ({ type: 'text', content: line }));
				} else if (part.type === 'image' && part.source) {
					return [{ type: 'image', content: JSON.stringify(part.source) }];
				} else if (part.type === 'tool_result' && Array.isArray(part.content)) {
					return this.formatContent(part.content);
				}
				return [];
			});
		}
		return [];
	}

	private formatContentString(content: string): string[] {
		return content
			.replace(/<bb>.*?<\/bb>/gs, '')
			.split('\n')
			.map((line) => line.trim());
		//.filter((line) => line.length > 0);
	}

	/*
	private formatMetadataConsole(
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		return JSON.stringify(
			{ conversationStats, tokenUsageTurn, tokenUsageStatement, tokenUsageConversation },
			null,
			2,
		);
	}

	private formatMetadataBrowser(
		conversationStats?: ConversationMetrics,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: ConversationTokenUsage,
	): string {
		const metadata = JSON.stringify(
			{ conversationStats, tokenUsageTurn, tokenUsageStatement, tokenUsageConversation },
			null,
			2,
		);
		return `<div class="metadata">${metadata}</div>`;
	}
	 */
}
