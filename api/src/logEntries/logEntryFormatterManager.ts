//import type { ConversationStats, TokenUsage } from 'shared/types.ts';
import type { LLMToolFormatterDestination, LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { JSX } from 'preact';
//import { renderToString } from 'preact-render-to-string';
import LLMToolManager from '../llms/llmToolManager.ts';
import type { ConversationLogEntry, ConversationLogEntryContent, ConversationLogEntryType } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { GlobalConfig, ProjectConfig } from 'shared/config/types.ts';
import type { AuxiliaryChatContent, LogEntryFormattedResult, LogEntryTitleData } from 'api/logEntries/types.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import {
	formatLogEntryContent as formatLogEntryContentForConsole,
	formatLogEntryPreview as formatLogEntryPreviewForConsole,
	formatLogEntryTitle as formatLogEntryTitleForConsole,
} from './formatters.console.ts';
import {
	formatLogEntryContent as formatLogEntryContentForBrowser,
	formatLogEntryPreview as formatLogEntryPreviewForBrowser,
	formatLogEntryTitle as formatLogEntryTitleForBrowser,
} from './formatters.browser.tsx';

export default class LogEntryFormatterManager {
	private toolManager!: LLMToolManager;
	private globalConfig!: GlobalConfig;
	private projectConfig: ProjectConfig;

	constructor(
		private projectEditor: ProjectEditor,
	) {
		this.projectConfig = this.projectEditor.projectConfig;
	}

	public async init(): Promise<LogEntryFormatterManager> {
		const configManager = await getConfigManager();
		this.globalConfig = await configManager.getGlobalConfig();
		this.toolManager = await new LLMToolManager(this.projectConfig, 'core').init(); // Pass MCPManager to LLMToolManager
		//logger.debug(`LogEntryFormatterManager: Initialized toolManager:`, this.toolManager.getAllToolsMetadata());
		return this;
	}

	async formatLogEntry(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		options?: unknown,
	): Promise<LogEntryFormattedResult> {
		let formatted: LogEntryFormattedResult;
		//logger.info(`LogEntryFormatterManager: formatLogEntry:`, logEntry);
		switch (logEntry.entryType as ConversationLogEntryType) {
			case 'user':
				formatted = destination === 'console'
					? this.formatLogEntryBasicConsole(logEntry, this.globalConfig.myPersonsName || 'User')
					: this.formatLogEntryBasicBrowser(logEntry, this.globalConfig.myPersonsName || 'User');
				break;
			case 'orchestrator':
				formatted = destination === 'console'
					? this.formatLogEntryBasicConsole(
						logEntry,
						`${this.globalConfig.myAssistantsName || 'Assistant'} as Orchestrator`,
					)
					: this.formatLogEntryBasicBrowser(
						logEntry,
						`${this.globalConfig.myAssistantsName || 'Assistant'} as Orchestrator`,
					);
				break;
			case 'assistant':
				formatted = destination === 'console'
					? this.formatLogEntryBasicConsole(logEntry, this.globalConfig.myAssistantsName || 'Assistant')
					: this.formatLogEntryBasicBrowser(logEntry, this.globalConfig.myAssistantsName || 'Assistant');
				break;
			case 'answer':
				formatted = destination === 'console'
					? this.formatLogEntryBasicConsole(
						logEntry,
						`Answer from ${this.globalConfig.myAssistantsName || 'Assistant'}`,
					)
					: this.formatLogEntryBasicBrowser(
						logEntry,
						`Answer from ${this.globalConfig.myAssistantsName || 'Assistant'}`,
					);
				break;
			case 'auxiliary':
				formatted = destination === 'console'
					? this.formatAuxiliaryConsole(logEntry)
					: this.formatAuxiliaryBrowser(logEntry);
				break;
			case 'tool_use':
			case 'tool_result':
				if (!logEntry.toolName) {
					throw new Error('Tool name is required for tool formatters');
				}
				formatted = await this.formatLogEntryTool(destination, logEntry, options);
				break;
			case 'error':
				formatted = destination === 'console'
					? this.formatLogEntryBasicConsole(logEntry, 'Error')
					: this.formatLogEntryBasicBrowser(logEntry, 'Error');
				break;
			default:
				throw new Error(`Unknown log entry type: ${logEntry.entryType}`);
		}
		//logger.info(`LogEntryFormatterManager: formatLogEntry:`, JSON.stringify(formatted));
		return formatted;
	}

	private formatLogEntryBasicConsole(logEntry: ConversationLogEntry, title: string): LogEntryFormattedResult {
		return {
			title: this.formatLogEntryTitleConsole({ title }),
			content: this.formatLogEntryContentConsole(logEntry),
			preview: this.formatLogEntryPreviewConsole(logEntry),
		};
	}

	private formatLogEntryBasicBrowser(logEntry: ConversationLogEntry, title: string): LogEntryFormattedResult {
		return {
			title: this.formatLogEntryTitleBrowser({ title }),
			content: this.formatLogEntryContentBrowser(logEntry, this.projectEditor.projectId),
			preview: this.formatLogEntryPreviewBrowser(logEntry),
		};
	}

	private formatAuxiliaryConsole(logEntry: ConversationLogEntry): LogEntryFormattedResult {
		const content: ConversationLogEntryContent = logEntry.content;
		if (typeof content === 'object' && 'purpose' in content) {
			const auxContent = content as AuxiliaryChatContent;
			return {
				title: this.formatLogEntryTitleConsole({ title: auxContent.purpose }),
				content: this.formatLogEntryContentConsole({ content: auxContent.message } as ConversationLogEntry),
				preview: this.formatLogEntryPreviewConsole({ content: auxContent.message } as ConversationLogEntry),
			};
		}
		// Fallback for string content
		return {
			title: 'Auxiliary',
			content: this.formatLogEntryContentConsole(logEntry),
			preview: this.formatLogEntryPreviewConsole(logEntry),
		};
	}

	private formatAuxiliaryBrowser(logEntry: ConversationLogEntry): LogEntryFormattedResult {
		const content: ConversationLogEntryContent = logEntry.content;
		if (typeof content === 'object' && 'purpose' in content) {
			const auxContent = content as AuxiliaryChatContent;
			return {
				title: this.formatLogEntryTitleBrowser({ title: auxContent.purpose }),
				content: this.formatLogEntryContentBrowser({ content: auxContent.message } as ConversationLogEntry, this.projectEditor.projectId),
				preview: this.formatLogEntryPreviewBrowser({ content: auxContent.message } as ConversationLogEntry),
			};
		}
		// Fallback for string content
		return {
			title: 'Auxiliary',
			content: this.formatLogEntryContentBrowser(logEntry, this.projectEditor.projectId),
			preview: this.getContentPreview(logEntry.content),
		};
	}

	private async formatLogEntryTool(
		destination: LLMToolFormatterDestination,
		logEntry: ConversationLogEntry,
		_options: unknown,
	): Promise<LogEntryFormattedResult> {
		if (!logEntry.toolName) throw new Error(`Tool name not provided in log entry: ${logEntry.toolName}`);
		const tool = await this.toolManager.getTool(logEntry.toolName);
		//logger.error(`LogEntryFormatterManager: Got tool ${logEntry.toolName}:`, tool);
		if (!tool) {
			throw new Error(`Tool not found: ${logEntry.toolName}`);
		}

		try {
			if (logEntry.entryType === 'tool_use') {
				return tool.formatLogEntryToolUse(logEntry.content as LLMToolInputSchema, destination);
				// const toolUse = tool.formatLogEntryToolUse(logEntry.content as LLMToolInputSchema, destination);
				// logger.error(`LogEntryFormatterManager: toolUse ${logEntry.toolName}:`, renderToString(toolUse.content as JSX.Element));
				// return toolUse;
			} else {
				return tool.formatLogEntryToolResult(logEntry.content as ConversationLogEntryContent, destination);
				//const toolResult =  tool.formatLogEntryToolResult(logEntry.content as ConversationLogEntryContent, destination);
				//logger.error(`LogEntryFormatterManager: toolResult ${logEntry.toolName}:`, renderToString(toolResult.content as JSX.Element));
				//return toolResult;
			}
		} catch (error) {
			logger.error(
				`LogEntryFormatterManager: Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}: ${
					(error as Error).message
				}`,
			);
			return {
				title: 'Error',
				content: `Error formatting ${logEntry.entryType} for tool ${logEntry.toolName}`,
				preview: '',
			};
		}
	}

	private formatLogEntryTitleConsole(titleData: LogEntryTitleData): string {
		return formatLogEntryTitleForConsole(titleData);
	}

	private formatLogEntryContentConsole(logEntry: ConversationLogEntry): string {
		return formatLogEntryContentForConsole(logEntry);
	}

	private formatLogEntryPreviewConsole(logEntry: ConversationLogEntry): string {
		const logEntryContent: ConversationLogEntryContent = logEntry.content;
		return formatLogEntryPreviewForConsole(this.getContentPreview(logEntryContent));
	}

	private formatLogEntryTitleBrowser(titleData: LogEntryTitleData): string | JSX.Element {
		return formatLogEntryTitleForBrowser(titleData);
	}

	private formatLogEntryContentBrowser(logEntry: ConversationLogEntry, projectId?: string): string | JSX.Element {
		return formatLogEntryContentForBrowser(logEntry, projectId);
	}

	private formatLogEntryPreviewBrowser(logEntry: ConversationLogEntry): string | JSX.Element {
		const logEntryContent: ConversationLogEntryContent = logEntry.content;
		return formatLogEntryPreviewForBrowser(this.getContentPreview(logEntryContent));
	}

	private getContentPreview(content: ConversationLogEntryContent): string {
		if (typeof content === 'string') {
			// Remove any XML-style tags and trim
			const cleaned = content.replace(/<[^>]+>/g, '').trim();
			// Take first 50 characters, try to end at a word boundary
			if (cleaned.length <= 400) return cleaned;
			const truncated = cleaned.substring(0, 400);
			const lastSpace = truncated.lastIndexOf(' ');
			return lastSpace > 30 ? truncated.substring(0, lastSpace) : truncated;
			//return lastSpace > 30 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
		}
		// For non-string content, return a generic preview
		return '[Complex content]';
	}

	/*
	private formatMetadataConsole(
		conversationStats?: ConversationStats,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: TokenUsage,
	): string {
		return JSON.stringify(
			{ conversationStats, tokenUsageTurn, tokenUsageStatement, tokenUsageConversation },
			null,
			2,
		);
	}

	private formatMetadataBrowser(
		conversationStats?: ConversationStats,
		tokenUsageTurn?: TokenUsage,
		tokenUsageStatement?: TokenUsage,
		tokenUsageConversation?: TokenUsage,
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
