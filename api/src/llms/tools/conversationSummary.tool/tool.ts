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
//import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMAnswerToolUse,
	LLMMessageContentPartToolResultBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMProviderMessageResponse } from 'api/types/llms.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

// [TODO] Use tokenUsage.jsonl for more accurate and efficient token counting
// [TODO] Add project-specific significance patterns (e.g., research conclusions, architectural decisions)
//        Consider adding configuration options for custom patterns and domain-specific indicators
// [TODO] Implement performance optimizations for large conversations (e.g., batch processing)
// [TODO] Add restore functionality for conversation backups to support undo operations
// [TODO] Allow selective message removal by messageId for more granular conversation management

export interface ConversationSummarySection {
	files: Array<{
		path: string;
		revision: string;
		operations: string[];
	}>;
	tools: Array<{
		name: string;
		uses: number;
		keyResults: string[];
	}>;
	decisions: string[];
	requirements: string[];
	externalReferences: Array<{
		url: string;
		context: string;
	}>;
	codeChanges: Array<{
		description: string;
		files: string[];
	}>;
	projectContext: string[];
}

export interface ConversationSummaryMetadata {
	messageRange: {
		start: { id: string; timestamp: string };
		end: { id: string; timestamp: string };
	};
	originalTokenCount: number;
	summaryTokenCount: number;
	model: string;
	fallbackUsed?: boolean;
}

export interface LLMToolConversationSummaryData {
	summary: string;
	keptMessages: LLMMessage[];
	originalTokenCount: number;
	newTokenCount: number;
	originalMessageCount: number;
	summaryLength: 'short' | 'medium' | 'long';
	metadata: ConversationSummaryMetadata;
}

export interface LLMToolConversationBbResponseData {
	summary: string;
	maxTokensToKeep: number;
	summaryLength: 'short' | 'medium' | 'long';
	requestSource: 'tool' | 'user';
	originalTokenCount: number;
	newTokenCount: number;
	originalMessageCount: number;
	metadata: ConversationSummaryMetadata;
	keptMessageCount: number;
	removedMessageCount: number;
}

export default class LLMToolConversationSummary extends LLMTool {
	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				requestSource: {
					type: 'string',
					enum: ['user', 'tool'],
					description:
						'Indicates whether the summary was requested by the user or automatically by the tool. Used to determine post-summary context handling.',
					default: 'tool',
				},
				maxTokensToKeep: {
					type: 'number',
					description:
						"Maximum number of tokens to keep in the truncated conversation. Must be at least 1000 tokens to ensure meaningful context, and no more than the model's context window (e.g., 128K for Claude-3). When truncating, the most recent messages are preserved up to this token limit to maintain immediate context while reducing overall token usage.",
					minimum: 1000,
					maximum: 128000,
					default: 64000,
				},
				summaryLength: {
					type: 'string',
					enum: ['short', 'medium', 'long'],
					description:
						'Controls the verbosity and detail level of the generated summary. Each level includes specific sections:\n\n* short: Concise summary with essential sections only:\n  - Files Referenced (key modifications and discussions)\n  - Tools Used (main tools and key results)\n  - Key Decisions (significant project impacts)\n\n* medium (default): Balanced summary adding context and details:\n  - All short sections plus:\n  - Requirements Established\n  - Code Changes\n  - Project Context\n\n* long: Comprehensive summary with full context:\n  - All medium sections plus:\n  - External References\n  - Detailed relationships and implications\n  - Complete historical context\n\nChoose based on how much historical context needs to be preserved.',
					default: 'long',
				},
			},
			//required: ['requestSource'],
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
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { maxTokensToKeep = 64000, summaryLength = 'long', requestSource = 'tool' } = toolInput as {
			maxTokensToKeep?: number;
			summaryLength?: 'short' | 'medium' | 'long';
			requestSource?: 'tool' | 'user';
		};

		// Validate maxTokensToKeep constraints if provided
		if (maxTokensToKeep < 1000) {
			throw createError(
				ErrorType.ToolHandling,
				'maxTokensToKeep must be at least 1000 to ensure meaningful context',
				{
					name: 'validate-max-tokens',
					toolName: 'conversation_summary',
					operation: 'tool-input',
				},
			);
		}
		if (maxTokensToKeep > 128000) {
			throw createError(
				ErrorType.ToolHandling,
				'maxTokensToKeep cannot exceed model context window (128K tokens)',
				{
					name: 'validate-max-tokens',
					toolName: 'conversation_summary',
					operation: 'tool-input',
				},
			);
		}

		if (summaryLength !== 'short' && summaryLength !== 'medium' && summaryLength !== 'long') {
			throw createError(
				ErrorType.ToolHandling,
				'summaryLength must be allowed value (short|medium|long)',
				{
					name: 'validate-summary-length',
					toolName: 'conversation_summary',
					operation: 'tool-input',
				},
			);
		}

		if (requestSource !== 'tool' && requestSource !== 'user') {
			throw createError(
				ErrorType.ToolHandling,
				'requestSource must be allowed value (tool|user)',
				{
					name: 'validate-request-source',
					toolName: 'conversation_summary',
					operation: 'tool-input',
				},
			);
		}

		try {
			const messages = interaction.getMessages();
			const result = await this.summarizeAndTruncateConversation(
				interaction,
				messages,
				maxTokensToKeep,
				summaryLength,
				requestSource,
				projectEditor,
			);

			const toolResults = `Conversation Summary Results:

Original Token Count: ${result.originalTokenCount}
New Token Count: ${result.newTokenCount}
Token Reduction: ${((result.originalTokenCount - result.newTokenCount) / result.originalTokenCount * 100).toFixed(1)}%

Messages:
- Kept: ${result.keptMessages.length}
- Removed: ${result.originalMessageCount - result.keptMessages.length}

Summary Type: ${result.summaryLength}
Model Used: ${result.metadata.model}

A summary of the removed messages has been added to the start of the conversation.`;

			const toolResponse = `Conversation ${maxTokensToKeep ? 'truncated and ' : ''}summarized successfully. Unless specifically asked to continue with other tasks, no further action is needed. ${
				maxTokensToKeep
					? `Reduced token count from ${result.originalTokenCount} to ${result.newTokenCount}.`
					: ''
			}`;

			const bbResponse = {
				data: {
					originalTokenCount: result.originalTokenCount,
					newTokenCount: result.newTokenCount,
					originalMessageCount: result.originalMessageCount,
					keptMessageCount: result.keptMessages.length,
					removedMessageCount: result.originalMessageCount - result.keptMessages.length,
					metadata: result.metadata,
					summary: result.summary, // Include summary in log but not in toolResults
					maxTokensToKeep,
					summaryLength,
					requestSource,
				} as LLMToolConversationBbResponseData,
			};

			return { toolResults, toolResponse, bbResponse };
		} catch (error) {
			logger.error(`LLMToolConversationSummary: Error summarizing and truncating conversation: ${error.message}`);

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
		maxTokensToKeep: number,
		summaryLength: 'short' | 'medium' | 'long' = 'medium',
		requestSource: 'tool' | 'user' = 'tool',
		projectEditor: ProjectEditor,
	): Promise<LLMToolConversationSummaryData> {
		// [TODO] Allow selective message removal by messageId for more granular conversation management
		// [TODO] Implement performance optimizations for large conversations (e.g., batch processing)
		// [TODO] Add restore functionality for conversation backups to support undo operations
		// Only count tokens from assistant messages as they contain the token usage information
		// User messages don't have token counts as they haven't been processed by the LLM
		const originalTokenCount = messages.reduce(
			(sum, msg) => msg.role === 'assistant' ? sum + (msg.providerResponse?.usage.totalTokens || 0) : sum,
			0,
		);

		// Truncate conversation if maxTokensToKeep is specified
		let keptMessages = messages;
		let newTokenCount = originalTokenCount;
		let summaryTokenCount: number;
		let model: string;
		let summary = '';

		try {
			if (maxTokensToKeep && originalTokenCount > maxTokensToKeep) {
				// Get kept messages and generate summary for removed ones
				const result = await this.truncateConversation(
					interaction,
					messages,
					maxTokensToKeep,
					summaryLength,
					requestSource,
					projectEditor,
				);
				keptMessages = result.keptMessages;
				summary = result.summary;
				summaryTokenCount = result.providerResponse.usage.outputTokens;
				model = result.providerResponse.model;

				// Calculate new token count for kept messages
				newTokenCount = keptMessages.reduce(
					(sum, msg) => msg.role === 'assistant' ? sum + (msg.providerResponse?.usage.totalTokens || 0) : sum,
					0,
				);
			} else {
				// If no truncation needed, generate summary of entire conversation
				const summaryPrompt = this.generatePromptWithMessageHistory(messages, [], summaryLength);
				const chat = await projectEditor.orchestratorController.createChatInteraction(
					interaction.id,
					'Generate conversation summary',
				);
				const response = await chat.chat(summaryPrompt);
				// Validate response structure
				if (!response.messageResponse?.answerContent) {
					throw createError(
						ErrorType.ToolHandling,
						'Invalid response structure from LLM: missing answerContent',
						{
							name: 'validate-response',
							toolName: 'conversation_summary',
							operation: 'tool-run',
						},
					);
				}

				//summary = response.messageResponse.answer || 'no answer from LLM';
				summary = extractTextFromContent(response.messageResponse.answerContent);
				summaryTokenCount = response.messageResponse.usage.outputTokens;
				model = response.messageResponse.model;

				// Validate summary structure based on summaryLength
				const requiredSections = ['## Removed Conversation Context'];

				// Essential sections required for all summary lengths
				requiredSections.push(
					'### Files Referenced',
					'### Tools Used',
					'### Key Decisions',
				);

				// Additional sections for medium and long summaries
				if (summaryLength !== 'short') {
					requiredSections.push(
						'### Requirements Established',
						'### Code Changes',
						'### Project Context',
					);
				}

				// External References required only for long summaries
				if (summaryLength === 'long') {
					requiredSections.push('### External References');
				}

				const missingSections = requiredSections.filter((section) => !summary.includes(section));
				if (missingSections.length > 0) {
					throw createError(
						ErrorType.ToolHandling,
						`Generated ${summaryLength} summary is missing required sections: ${
							missingSections.join(', ')
						}`,
						{
							name: 'validate-summary',
							toolName: 'conversation_summary',
							operation: 'tool-run',
						},
					);
				}
			}
			// Create metadata
			const metadata: ConversationSummaryMetadata = {
				messageRange: {
					start: {
						id: messages[0]?.id || '',
						timestamp: messages[0]?.timestamp || '',
					},
					end: {
						id: messages[messages.length - 1]?.id || '',
						timestamp: messages[messages.length - 1]?.timestamp || '',
					},
				},
				originalTokenCount,
				summaryTokenCount,
				model,
				fallbackUsed: false,
			};

			return {
				summary,
				keptMessages,
				originalTokenCount,
				newTokenCount,
				originalMessageCount: messages.length,
				summaryLength,
				metadata,
			};
		} catch (error) {
			throw createError(
				ErrorType.ToolHandling,
				`Failed to summarize and truncate conversation: ${error.message}`,
				{
					name: 'summarize-and-truncate',
					toolName: 'conversation_summary',
					operation: 'tool-run',
				},
			);
		}
	}

	private getSummarySections(summaryLength: 'short' | 'medium' | 'long'): string {
		// Always include essential sections
		let sections = `### Statement Objectives
${
			summaryLength === 'short'
				? '[List key objectives that guided the conversation, showing task progression]'
				: summaryLength === 'medium'
				? '[List objectives chronologically, showing how tasks and goals evolved]'
				: '[Provide detailed progression of objectives, including relationships between tasks and their outcomes]'
		}

### Files Referenced
${
			summaryLength === 'short'
				? '[List key files that were modified or significantly discussed, only including files with JSON metadata (delimited by ---bb-file-metadata---) or matching the file placeholder pattern: "Note: File {filePath} (this revision: {messageId}) is up-to-date at turn {turnIndex} with revision {messageId}." Ignore any other file mentions in general discussion.]'
				: summaryLength === 'medium'
				? '[List files that were referenced (from JSON metadata blocks or file placeholders), with their revisions and how they were used (modified, reviewed, discussed). Include only files that were actually accessed, not just mentioned in discussion.]'
				: '[List all files referenced (from JSON metadata blocks or file placeholders), including their revisions, how they were used, and their relationships to other files and changes. Track file states across the conversation but only for files that were actually accessed.]'
		}

### Tools Used
${
			summaryLength === 'short'
				? '[List main tools used and their key results, focusing on project modifications]'
				: summaryLength === 'medium'
				? '[List tools used, number of uses, and key results. Distinguish between tools that modified the project and query tools]'
				: '[Provide detailed analysis of tool usage, including all results, relationships between tool uses, and their impact on the project]'
		}

### Key Decisions
${
			summaryLength === 'short'
				? '[List key decisions that significantly impacted the project]'
				: summaryLength === 'medium'
				? '[List important decisions made during this part of the conversation]'
				: '[Document all decisions, including their context, rationale, and implications for the project]'
		}`;

		// Add medium and long sections
		if (summaryLength !== 'short') {
			sections += `

### Requirements Established
${
				summaryLength === 'medium'
					? '[List any requirements or constraints that were established]'
					: '[Document all requirements and constraints, including their context and implications]'
			}

### Code Changes
${
				summaryLength === 'medium'
					? '[Summarize code changes discussed or implemented]'
					: '[Provide detailed analysis of all code changes, including implementation details and their impact]'
			}

### Project Context
${
				summaryLength === 'medium'
					? '[List any project-specific terminology or concepts that were introduced or discussed]'
					: '[Document all project terminology and concepts, including their relationships and significance]'
			}`;
		}

		// Add long-only sections
		if (summaryLength === 'long') {
			sections += `

### External References
[Document all external references with detailed context and their relevance to the project]`;
		}

		// Add note to assistant about objectives after the summary
		sections += `

>> NOTE TO ASSISTANT <<
The objectives listed above are historical context only. Before proceeding:
1. Review subsequent messages carefully for new objectives
2. Pay special attention to tool use/result pairs and their associated objectives
3. If this truncation was user-requested, the last objective in the conversation may be completed
4. Look for the most recent objective in the remaining conversation to determine current focus`;

		return sections;
	}

	private generatePromptWithMessageHistory(
		keptMessages: LLMMessage[],
		removedMessages: LLMMessage[],
		summaryLength: 'short' | 'medium' | 'long' = 'medium',
	): string {
		const keptRange = {
			start: keptMessages[0]?.timestamp || '',
			end: keptMessages[keptMessages.length - 1]?.timestamp || '',
		};
		const removedRange = {
			start: removedMessages[0]?.timestamp || '',
			end: removedMessages[removedMessages.length - 1]?.timestamp || '',
		};

		// Format messages with clear separation and content parts
		const formatMessage = (msg: LLMMessage) => {
			return `=== Message ===
Role: ${msg.role}
Timestamp: ${msg.timestamp}
Content:
${JSON.stringify(msg.content, null, 2)}`;
		};

		const verbosityGuide = summaryLength === 'short'
			? 'Create a concise summary focusing on the most critical information. Prioritize key decisions, file changes, and essential context.'
			: summaryLength === 'medium'
			? 'Create a balanced summary that captures important details while maintaining clarity. Include context about decisions and their rationale.'
			: 'Create a detailed summary that thoroughly documents the conversation. Include comprehensive context, decision rationales, and relationships between different aspects.';

		return `You are helping to maintain conversation context while reducing token usage. You need to create a ${summaryLength} summary of removed messages while being aware of the kept messages for context.

${verbosityGuide}

Kept Messages (${keptRange.start} to ${keptRange.end}):
${keptMessages.map(formatMessage).join('\n\n')}

Removed Messages (${removedRange.start} to ${removedRange.end}):
${removedMessages.map(formatMessage).join('\n\n')}

Please provide a ${summaryLength} summary of the removed messages in this format:

## Removed Conversation Context
*From ${removedRange.start} to ${removedRange.end}*

${this.getSummarySections(summaryLength)}

Ensure your summary accurately captures all important context from the removed messages while considering the kept messages for relevance.`;
	}

	/**
	 * Validates that tool uses and results are properly paired
	 * @returns true if valid, false if any tool use/result pairing is incorrect
	 * Note: It's valid for the last message to be a tool use without a result,
	 * as BB will be in the process of generating the result
	 */
	private validateToolSequences(messages: LLMMessage[]): boolean {
		logger.info(
			'LLMToolConversationSummary: validateToolSequences - messages:',
			messages.map((m) => ({
				role: m.role,
				content: m.content.map((c) => c.type),
			})),
		);

		let expectingResult = false;
		let currentToolId: string | undefined;

		for (const message of messages) {
			if (this.hasToolUse(message)) {
				logger.info(
					`LLMToolConversationSummary: Found tool use in message: role=${message.role}, content=${
						JSON.stringify(message.content)
					}`,
				);
				if (expectingResult) {
					// Found tool use while expecting result
					return false;
				}
				const toolUse = message.content.find((part): part is LLMMessageContentPartToolUseBlock =>
					part.type === 'tool_use'
				);
				if (!toolUse) continue;
				currentToolId = toolUse.id;
				expectingResult = true;
			} else if (this.hasToolResult(message)) {
				logger.info(
					`LLMToolConversationSummary: Found tool result in message: role=${message.role}, content=${
						JSON.stringify(message.content)
					}`,
				);
				if (!expectingResult) {
					// Found result without preceding use
					return false;
				}
				const toolResult = message.content.find((part): part is LLMMessageContentPartToolResultBlock =>
					part.type === 'tool_result'
				);
				if (!toolResult) continue;

				// Check if this result matches current tool and isn't an error
				if (toolResult.tool_use_id !== currentToolId || toolResult.is_error) {
					return false;
				}
				expectingResult = false;
				currentToolId = undefined;
			}
		}
		// It's ok to be expecting a result at the end (BB will be generating it)
		// But if we're expecting a result and we're not at the end, that's an error
		return !expectingResult || (expectingResult && messages[messages.length - 1].role === 'assistant');
	}

	/**
	 * Validates that messages follow the correct user/assistant alternation pattern
	 * @returns true if valid, false if needs correction
	 */
	private validateMessageAlternation(messages: LLMMessage[]): boolean {
		logger.info('LLMToolConversationSummary: validateMessageAlternation - messages:', messages.length);
		for (let i = 1; i < messages.length; i++) {
			const prevRole = messages[i - 1].role;
			const currRole = messages[i].role;
			logger.info(
				`LLMToolConversationSummary: validateMessageAlternation - checking messages ${
					i - 1
				} and ${i}: ${prevRole} -> ${currRole}`,
			);
			if (currRole === prevRole) {
				logger.info(
					`LLMToolConversationSummary: validateMessageAlternation - found broken alternation at index ${i}: ${prevRole} -> ${currRole}`,
				);
				return false;
			}
		}
		return true;
	}

	/**
	 * Checks if a message contains a tool use
	 */
	private hasToolUse(message: LLMMessage): boolean {
		return message.role === 'assistant' && message.content.some((part) => part.type === 'tool_use');
	}

	/**
	 * Checks if a message contains tool results
	 */
	private hasToolResult(message: LLMMessage): boolean {
		return message.role === 'user' && message.content.some((part) => part.type === 'tool_result');
	}

	/**
	 * Removes any tool sequences where the result has is_error=true
	 * @returns Array of messages with interrupted sequences removed
	 */
	private removeInterruptedSequences(messages: LLMMessage[]): LLMMessage[] {
		/*
		logger.info(
			'LLMToolConversationSummary: removeInterruptedSequences - processing messages:',
			messages.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);
 */

		// First pass: collect tool uses and their indices
		const toolUses = new Map<string, number>();
		for (let i = 0; i < messages.length; i++) {
			if (this.hasToolUse(messages[i])) {
				const toolUse = messages[i].content.find((part): part is LLMMessageContentPartToolUseBlock =>
					part.type === 'tool_use'
				);
				if (toolUse) {
					toolUses.set(toolUse.id, i);
					logger.info(`LLMToolConversationSummary: Found tool use at index ${i}:`, { id: toolUse.id });
				}
			}
		}

		// Second pass: collect tool results and match with uses
		const toolResults = new Map<string, { index: number; isError: boolean }>();
		for (let i = 0; i < messages.length; i++) {
			if (this.hasToolResult(messages[i])) {
				const toolResult = messages[i].content.find((part): part is LLMMessageContentPartToolResultBlock =>
					part.type === 'tool_result'
				);
				if (toolResult && toolResult.tool_use_id) {
					toolResults.set(toolResult.tool_use_id, {
						index: i,
						isError: toolResult.is_error || false,
					});
					logger.info(`LLMToolConversationSummary: Found tool result at index ${i}:`, {
						id: toolResult.tool_use_id,
						isError: toolResult.is_error,
					});
				}
			}
		}

		// Build set of indices to keep
		const indicesToKeep = new Set<number>();
		for (let i = 0; i < messages.length; i++) {
			// Keep non-tool messages
			if (!this.hasToolUse(messages[i]) && !this.hasToolResult(messages[i])) {
				indicesToKeep.add(i);
				continue;
			}

			// Handle tool uses
			if (this.hasToolUse(messages[i])) {
				const toolUse = messages[i].content.find((part): part is LLMMessageContentPartToolUseBlock =>
					part.type === 'tool_use'
				);
				if (!toolUse) continue;

				const result = toolResults.get(toolUse.id);
				if (!result) {
					// Keep tool use without result only if it's the last message
					if (i === messages.length - 1) {
						indicesToKeep.add(i);
					}
					continue;
				}

				// Skip both messages if result is error
				if (result.isError) {
					logger.info(`LLMToolConversationSummary: Skipping error sequence:`, { toolId: toolUse.id });
					continue;
				}

				// Keep both messages for successful sequence
				logger.info(`LLMToolConversationSummary: Keeping successful sequence:`, { toolId: toolUse.id });
				indicesToKeep.add(i);
				indicesToKeep.add(result.index);
			}
		}

		// Build final result array
		const result = messages.filter((_, i) => indicesToKeep.has(i));

		/*
		logger.info(
			'LLMToolConversationSummary: removeInterruptedSequences - result:',
			result.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);

		logger.info(
			'LLMToolConversationSummary: removeInterruptedSequences - result:',
			result.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);
 */
		return result;
	}

	/**
	 * Checks if splitting at this point would break a tool use/result pair
	 */
	// 	private wouldBreakToolSequence(messages: LLMMessage[], index: number): boolean {
	// 		const currentMessage = messages[index];
	// 		const nextMessage = messages[index + 1];
	// 		const prevMessage = messages[index - 1];
	//
	// 		// Check if we're between a tool use and its result
	// 		if (this.hasToolUse(currentMessage) && nextMessage && this.hasToolResult(nextMessage)) {
	// 			return true;
	// 		}
	// 		// Check if we're between a tool result and its use
	// 		if (this.hasToolResult(currentMessage) && prevMessage && this.hasToolUse(prevMessage)) {
	// 			return true;
	// 		}
	//
	// 		return false;
	// 	}

	private async truncateConversation(
		interaction: LLMConversationInteraction,
		messages: LLMMessage[],
		maxTokensToKeep: number,
		summaryLength: 'short' | 'medium' | 'long',
		requestSource: 'tool' | 'user',
		projectEditor: ProjectEditor,
	): Promise<{ keptMessages: LLMMessage[]; summary: string; providerResponse: LLMProviderMessageResponse }> {
		// Validate message alternation first
		logger.info('LLMToolConversationSummary: truncateConversation - validating message alternation');
		if (!this.validateMessageAlternation(messages)) {
			const messageSequence = messages.map((msg, i) => `${i}: ${msg.role}`).join('\n');
			logger.error('LLMToolConversationSummary: Message alternation validation failed:\n' + messageSequence);
			throw createError(
				ErrorType.ToolHandling,
				`Failed to maintain correct message alternation pattern. Message sequence:\n${messageSequence}`,
				{
					name: 'validate-messages',
					toolName: 'conversation_summary',
					operation: 'tool-run',
				},
			);
		}

		logger.info('LLMToolConversationSummary: truncateConversation - messages:', messages.length);
		logger.info('LLMToolConversationSummary: truncateConversation - maxTokensToKeep:', maxTokensToKeep);
		const conversationPersistence = interaction.conversationPersistence;

		// Create backup files
		await conversationPersistence.createBackups();

		// Calculate token counts and find valid split point
		let totalTokens = 0;
		let splitIndex = messages.length;

		// First, find the minimum number of messages we need to keep from the end
		let lastPairIndex = messages.length - 1;
		logger.info('LLMToolConversationSummary: Finding last complete message pair:');
		logger.info(
			`LLMToolConversationSummary: Starting from index ${lastPairIndex}: ${messages[lastPairIndex].role}`,
		);
		while (lastPairIndex > 0 && messages[lastPairIndex].role === messages[lastPairIndex - 1].role) {
			lastPairIndex--;
			logger.info(`LLMToolConversationSummary: Moved to index ${lastPairIndex}: ${messages[lastPairIndex].role}`);
		}
		if (lastPairIndex > 0) {
			lastPairIndex--; // Include the complete pair
			logger.info(`LLMToolConversationSummary: Including complete pair, final index: ${lastPairIndex}`);
		}

		// Calculate tokens backwards from the end
		for (let i = messages.length - 1; i >= 0; i--) {
			const message = messages[i];
			const messageTokens = message.role === 'assistant' ? (message.providerResponse?.usage.totalTokens || 0) : 0;
			logger.info(`LLMToolConversationSummary: Message ${i}: role=${message.role}, tokens=${messageTokens}`);

			// Always keep messages from the minimum pair onwards
			if (i >= lastPairIndex) {
				logger.info(
					`LLMToolConversationSummary: Keeping message ${i} (part of minimum pair): role=${message.role}, tokens=${messageTokens}`,
				);
				totalTokens += messageTokens;
				continue;
			}

			// Check if adding this message would exceed token limit
			if (totalTokens + messageTokens > maxTokensToKeep) {
				logger.info(
					`LLMToolConversationSummary: Would exceed token limit at index ${i}: ${totalTokens} + ${messageTokens} > ${maxTokensToKeep}`,
				);
				splitIndex = i + 1; // Keep messages from next index onwards
				break;
			}

			totalTokens += messageTokens;
		}

		// Get initial kept messages and remove interrupted sequences
		const initialKeptMessages = messages.slice(splitIndex);
		logger.info(
			'LLMToolConversationSummary: truncateConversation - initial kept messages:',
			initialKeptMessages.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);

		logger.info(
			'LLMToolConversationSummary: truncateConversation - removing interrupted sequences from kept messages',
		);
		const keptMessages = this.removeInterruptedSequences(initialKeptMessages);
		logger.info(
			'LLMToolConversationSummary: truncateConversation - kept messages after cleaning:',
			keptMessages.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);

		const removedMessages = messages.slice(0, splitIndex);
		/*
		logger.info(
			'LLMToolConversationSummary: truncateConversation - removed messages:',
			removedMessages.map((m) => ({
				role: m.role,
				content: m.content.map((c) => ({
					type: c.type,
					...(c.type === 'tool_use' ? { id: (c as LLMMessageContentPartToolUseBlock).id } : {}),
					...(c.type === 'tool_result'
						? {
							tool_use_id: (c as LLMMessageContentPartToolResultBlock).tool_use_id,
							is_error: (c as LLMMessageContentPartToolResultBlock).is_error,
						}
						: {}),
				})),
			})),
		);
 */

		// Validate remaining tool sequences
		logger.info('LLMToolConversationSummary: truncateConversation - validating tool sequences');
		if (!this.validateToolSequences(keptMessages)) {
			throw createError(ErrorType.ToolHandling, 'Found incomplete tool use/result pairs in messages', {
				name: 'validate-tool-sequences',
				toolName: 'conversation_summary',
				operation: 'tool-run',
			});
		}

		logger.info('LLMToolConversationSummary: truncateConversation - splitIndex:', splitIndex);
		logger.info('LLMToolConversationSummary: truncateConversation - keptMessages:', keptMessages.length);
		logger.info('LLMToolConversationSummary: truncateConversation - removedMessages:', removedMessages.length);

		// Verify the kept messages maintain valid tool sequences
		logger.info('LLMToolConversationSummary: Verifying tool sequences in kept messages:');
		if (!this.validateToolSequences(keptMessages)) {
			// If sequences are broken, try including more messages
			logger.info('LLMToolConversationSummary: Tool sequences broken, adjusting split point...');
			let newSplitIndex = splitIndex;
			while (newSplitIndex > 0) {
				newSplitIndex--;
				const newKeptMessages = messages.slice(newSplitIndex);
				if (this.validateToolSequences(newKeptMessages)) {
					logger.info(`LLMToolConversationSummary: Found valid split point at index ${newSplitIndex}`);
					splitIndex = newSplitIndex;
					break;
				}
			}
		}

		// Get final message sets (already cleaned of interrupted sequences)
		const finalKeptMessages = keptMessages;
		const finalRemovedMessages = messages.slice(0, splitIndex);

		// Generate summary of removed messages
		let summary = '';
		try {
			const summaryPrompt = this.generatePromptWithMessageHistory(
				finalKeptMessages,
				finalRemovedMessages,
				summaryLength,
			);
			const chat = await projectEditor.orchestratorController.createChatInteraction(
				interaction.id,
				'Generate conversation summary',
			);
			const response = await chat.chat(summaryPrompt);
			//const answer = response.messageResponse.answer || 'no answer from LLM';
			const answer = extractTextFromContent(response.messageResponse.answerContent);

			// Validate summary structure based on summaryLength
			const requiredSections = ['## Removed Conversation Context'];

			// Essential sections required for all summary lengths
			requiredSections.push(
				'### Files Referenced',
				'### Tools Used',
				'### Key Decisions',
			);

			// Additional sections for medium and long summaries
			if (summaryLength !== 'short') {
				requiredSections.push(
					'### Requirements Established',
					'### Code Changes',
					'### Project Context',
				);
			}

			// External References required only for long summaries
			if (summaryLength === 'long') {
				requiredSections.push('### External References');
			}

			const missingSections = requiredSections.filter((section) => !answer.includes(section));
			if (missingSections.length > 0) {
				throw createError(
					ErrorType.ToolHandling,
					`Generated ${summaryLength} summary is missing required sections: ${missingSections.join(', ')}`,
					{
						name: 'validate-summary',
						toolName: 'conversation_summary',
						operation: 'tool-run',
					},
				);
			}

			summary = answer;

			const lastConversationStats = finalRemovedMessages[finalRemovedMessages.length - 1]?.conversationStats ?? {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};

			// Create initial user message to start the conversation
			const initialMessage = new LLMMessage(
				'user',
				[{
					type: 'text',
					text:
						'Please incorporate the context from the previous conversation messages that have been summarized below',
				}],
				lastConversationStats,
			);

			// Create summary message with stats from last removed message
			const summaryMessage = new LLMMessage(
				'assistant',
				[{ type: 'text', text: summary }],
				lastConversationStats,
			);

			// Add summary and initial messages
			//logger.info('LLMToolConversationSummary: Messages before adding summary:', finalKeptMessages.map(m => ({ role: m.role, content: m.content })));
			finalKeptMessages.unshift(summaryMessage);
			finalKeptMessages.unshift(initialMessage);

			// For user-requested summaries, add a note to the last assistant message if present
			if (requestSource === 'user') {
				const lastMessage = finalKeptMessages[finalKeptMessages.length - 1];
				if (lastMessage?.role === 'assistant') {
					lastMessage.content.push({
						type: 'text',
						text:
							'Note: The conversation has been truncated and summarized by user request. Please review the new objectives in the subsequent messages to determine the current focus before proceeding.',
					});
				}
			}
			//logger.info('LLMToolConversationSummary: Messages after adding summary:', finalKeptMessages.map(m => ({ role: m.role, content: m.content })));

			// If first kept message is assistant, add dummy user message to maintain alternation
			if (finalKeptMessages[2]?.role === 'assistant') {
				const dummyMessage = new LLMMessage(
					'user',
					[{ type: 'text', text: 'Continue with the conversation based on the context above' }],
					lastConversationStats,
				);
				finalKeptMessages.splice(2, 0, dummyMessage);
			}

			// Only validate message alternation after adding summary
			if (!this.validateMessageAlternation(finalKeptMessages)) {
				throw createError(ErrorType.ToolHandling, 'Failed to maintain correct message alternation pattern', {
					name: 'validate-messages',
					toolName: 'conversation_summary',
					operation: 'tool-run',
				});
			}

			// Update the conversation with kept messages including summary
			interaction.setMessages(finalKeptMessages);

			// Save the updated conversation
			await conversationPersistence.saveConversation(interaction);

			const timestamp = new Date().toISOString();
			// Update the conversation log
			await interaction.conversationLogger.logAuxiliaryMessage(
				`truncate-${timestamp}`,
				`Conversation truncated to ${finalKeptMessages.length} messages. ${finalRemovedMessages.length} messages summarized.`,
			);

			return { keptMessages: finalKeptMessages, summary, providerResponse: response.messageResponse };
		} catch (error) {
			throw createError(ErrorType.ToolHandling, `Failed to generate and validate summary: ${error.message}`, {
				name: 'generate-summary',
				toolName: 'conversation_summary',
				operation: 'tool-run',
			});
		}
	}
}
