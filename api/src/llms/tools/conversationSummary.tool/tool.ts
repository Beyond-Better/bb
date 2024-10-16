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
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
//import { getConversationPath, saveConversation } from 'api/storage/conversationPersistence.ts';

export interface LLMToolConversationSummaryData {
	summary: string;
	truncatedConversation: LLMMessage[];
	originalTokenCount: number;
	newTokenCount: number;
	summaryLength: 'short' | 'medium' | 'long';
}

export default class LLMToolConversationSummary extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				maxTokens: {
					type: 'number',
					description: 'Maximum number of tokens to keep in the truncated conversation',
				},
				summaryLength: {
					type: 'string',
					enum: ['short', 'medium', 'long'],
					description: 'Desired length of the summary',
					default: 'medium',
				},
			},
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
		toolUse: LLMAnswerToolUse,
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { maxTokens, summaryLength = 'medium' } = toolInput as {
			maxTokens?: number;
			summaryLength?: 'short' | 'medium' | 'long';
		};

		try {
			const messages = interaction.getMessages();
			const result = await this.summarizeAndTruncateConversation(interaction, messages, maxTokens, summaryLength);

			const toolResults = JSON.stringify(result, null, 2);
			const toolResponse = `Conversation summarized and truncated successfully.`;
			const bbResponse = `BB has summarized the conversation and truncated it if requested.`;

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`Error summarizing and truncating conversation: ${error.message}`);

			throw createError(
				ErrorType.ToolHandling,
				`Error summarizing and truncating conversation: ${error.message}`,
				{
					name: 'summarize-and-truncate',
					toolName: 'conversation_summary',
					operation: 'tool-run',
				},
			);
		}
	}

	private async summarizeAndTruncateConversation(
		interaction: LLMConversationInteraction,
		messages: LLMMessage[],
		maxTokens?: number,
		summaryLength: 'short' | 'medium' | 'long' = 'medium',
	): Promise<LLMToolConversationSummaryData> {
		const originalTokenCount = messages.reduce(
			(sum, msg) => sum + (msg.providerResponse?.usage.totalTokens || 0),
			0,
		);

		// Generate summary
		const summary = await this.generateSummary(interaction, messages, summaryLength);

		// Truncate conversation if maxTokens is specified
		let truncatedConversation = messages;
		let newTokenCount = originalTokenCount;
		if (maxTokens && originalTokenCount > maxTokens) {
			truncatedConversation = await this.truncateConversation(interaction, messages, maxTokens);
			newTokenCount = truncatedConversation.reduce(
				(sum, msg) => sum + (msg.providerResponse?.usage.totalTokens || 0),
				0,
			);
		}

		return {
			summary,
			truncatedConversation, //: truncatedConversation.map((msg) => ({ role: msg.role, content: msg.content })),
			originalTokenCount,
			newTokenCount,
			summaryLength,
		};
	}

	private async generateSummary(
		interaction: LLMConversationInteraction,
		messages: LLMMessage[],
		summaryLength: 'short' | 'medium' | 'long',
	): Promise<string> {
		//const llmProvider = interaction.getLLMProvider();
		const prompt = this.createSummaryPrompt(messages, summaryLength);

		try {
			const speakOptions: LLMSpeakWithOptions = {};
			const response: LLMSpeakWithResponse = await interaction.speakWithLLM(prompt, speakOptions);

			return response.messageResponse.answer || '';
		} catch (error) {
			logger.error('Error generating summary:', error);
			//throw this.createError('Failed to generate conversation summary', { cause: error });
			throw new Error('Failed to generate conversation summary', { cause: error });
		}
	}

	private createSummaryPrompt(_messages: LLMMessage[], summaryLength: 'short' | 'medium' | 'long'): string {
		//const conversationText = messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n');
		const lengthInstruction = summaryLength === 'short'
			? 'a brief'
			: summaryLength === 'medium'
			? 'a moderate-length'
			: 'a detailed';

		//return `Please provide ${lengthInstruction} summary of the following conversation:\n\n${conversationText}\n\nSummary:`;
		return `Please provide ${lengthInstruction} summary of the current conversation.`;
	}

	private async truncateConversation(
		interaction: LLMConversationInteraction,
		messages: LLMMessage[],
		maxTokens: number,
	): Promise<LLMMessage[]> {
		//const conversationId = interaction.conversationId;
		const conversationPersistence = interaction.conversationPersistence;

		// Create backup files
		await conversationPersistence.createBackups();

		let tokenCount = 0;
		const truncatedMessages: LLMMessage[] = [];

		// Start from the most recent message and work backwards
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			const messageTokens = message.providerResponse?.usage.totalTokens || 0;

			if (tokenCount + messageTokens <= maxTokens) {
				truncatedMessages.unshift(message);
				tokenCount += messageTokens;
			} else {
				// If we can't fit the entire message, break the loop
				break;
			}
		}

		// Update the conversation with truncated messages
		interaction.setMessages(truncatedMessages);

		// Save the truncated conversation
		await conversationPersistence.saveConversation(interaction);

		const timestamp = new Date().toISOString();
		// Update the conversation log
		await interaction.conversationLogger.logAuxiliaryMessage(
			`truncate-${timestamp}`,
			`Conversation truncated to ${truncatedMessages.length} messages`,
		);
		await interaction.conversationLogger.logAuxiliaryMessage(
			`truncate-${timestamp}`,
			`Conversation truncated to ${truncatedMessages.length} messages`,
		);

		return truncatedMessages;
	}
}
