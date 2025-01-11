//import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
//import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
//import LLMChatInteraction from 'api/llms/chatInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import type {
	CacheImpact,
	ConversationId,
	ConversationMetrics,
	ConversationStats,
	ObjectivesData,
	ResourceMetrics,
	TokenUsage,
	TokenUsageDifferential,
	TokenUsageRecord,
	ToolStats,
} from 'shared/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
	LLMMessageProviderResponse,
} from 'api/llms/llmMessage.ts';
import type { LLMProviderMessageResponseRole } from 'api/types/llms.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import ConversationLogger from 'api/storage/conversationLogger.ts';
import type { ConversationLogEntry } from 'api/storage/conversationLogger.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';
import { logger } from 'shared/logger.ts';

class LLMInteraction {
	public id: string;
	public title: string = '';
	public createdAt: Date = new Date();
	public updatedAt: Date = new Date();
	protected _interactionType: 'base' | 'chat' | 'conversation';

	private _totalProviderRequests: number = 0;
	// count of turns for most recent statement
	protected _statementTurnCount: number = 0;
	// count of turns for all statements (whole conversation)
	protected _conversationTurnCount: number = 0;
	// count of statements
	protected _statementCount: number = 0;
	// token usage for most recent turn
	protected _tokenUsageTurn: TokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	// token usage for most recent statement
	protected _tokenUsageStatement: TokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	// token usage for for all statements
	protected _tokenUsageInteraction: TokenUsage = {
		totalTokens: 0,
		inputTokens: 0,
		outputTokens: 0,
	};
	// Task-oriented metrics
	protected _objectives: ObjectivesData;
	protected _resources: ResourceMetrics = {
		accessed: new Set<string>(),
		modified: new Set<string>(),
		active: new Set<string>(),
	};
	protected _toolStats: Map<string, ToolStats> = new Map();
	protected _currentToolSet?: string;

	// [TODO] change llm to protected attribute and create a getter for other classes to call
	public llm: LLM;
	protected messages: LLMMessage[] = [];
	protected tools: Map<string, LLMTool> = new Map();
	protected _baseSystem: string = '';
	public conversationPersistence!: ConversationPersistence;
	public conversationLogger!: ConversationLogger;
	protected projectConfig!: ProjectConfig;

	private _model: string = '';

	protected _maxTokens: number = 8192;
	protected _temperature: number = 0.2;
	protected _currentPrompt: string = '';

	constructor(llm: LLM, conversationId?: ConversationId) {
		this.id = conversationId ?? generateConversationId();
		this.llm = llm;
		this._interactionType = 'base';
		// Ensure objectives are properly initialized
		this._objectives = {
			conversation: undefined,
			statement: [],
			timestamp: new Date().toISOString(),
		};
	}

	public async init(parentId?: ConversationId): Promise<LLMInteraction> {
		try {
			const projectId = await this.llm.invoke(LLMCallbackType.PROJECT_ID);
			const logEntryHandler = async (
				timestamp: string,
				logEntry: ConversationLogEntry,
				conversationStats: ConversationStats,
				tokenUsageTurn: TokenUsage,
				tokenUsageStatement: TokenUsage,
				tokenUsageConversation: TokenUsage,
			): Promise<void> => {
				await this.llm.invoke(
					LLMCallbackType.LOG_ENTRY_HANDLER,
					timestamp,
					logEntry,
					conversationStats,
					tokenUsageTurn,
					tokenUsageStatement,
					tokenUsageConversation,
				);
			};
			const projectEditor = await this.llm.invoke(LLMCallbackType.PROJECT_EDITOR);
			this.conversationPersistence = await new ConversationPersistence(parentId ?? this.id, projectEditor).init();
			this.conversationLogger = await new ConversationLogger(projectId, parentId ?? this.id, logEntryHandler)
				.init();
			this.projectConfig = projectEditor.projectConfig;
		} catch (error) {
			logger.error('Failed to initialize LLMInteraction:', error as Error);
			throw error;
		}
		return this;
	}

	public get interactionType(): 'chat' | 'conversation' | 'base' {
		return this._interactionType;
	}

	public get conversationStats(): ConversationStats {
		return {
			statementCount: this._statementCount,
			statementTurnCount: this._statementTurnCount,
			conversationTurnCount: this._conversationTurnCount,
		};
	}
	public set conversationStats(stats: ConversationStats) {
		this._statementCount = stats.statementCount;
		this._statementTurnCount = stats.statementTurnCount;
		this._conversationTurnCount = stats.conversationTurnCount;
	}

	public get totalProviderRequests(): number {
		return this._totalProviderRequests;
	}
	public set totalProviderRequests(count: number) {
		this._totalProviderRequests = count;
	}

	// count of turns for most recent statement
	public get statementTurnCount(): number {
		return this._statementTurnCount;
	}
	public set statementTurnCount(count: number) {
		this._statementTurnCount = count;
	}
	// count of turns for all statement
	public get conversationTurnCount(): number {
		return this._conversationTurnCount;
	}
	public set conversationTurnCount(count: number) {
		this._conversationTurnCount = count;
	}
	// count of statements
	public get statementCount(): number {
		return this._statementCount;
	}
	public set statementCount(count: number) {
		this._statementCount = count;
	}

	public get tokenUsageTurn(): TokenUsage {
		return this._tokenUsageTurn;
	}
	public set tokenUsageTurn(tokenUsage: TokenUsage) {
		this._tokenUsageTurn = tokenUsage;
	}

	public get tokenUsageStatement(): TokenUsage {
		return this._tokenUsageStatement;
	}
	public set tokenUsageStatement(tokenUsage: TokenUsage) {
		this._tokenUsageStatement = tokenUsage;
	}

	public get tokenUsageInteraction(): TokenUsage {
		return this._tokenUsageInteraction;
	}
	public set tokenUsageInteraction(tokenUsage: TokenUsage) {
		this._tokenUsageInteraction = tokenUsage;
	}

	public get inputTokensTotal(): number {
		return this._tokenUsageInteraction.inputTokens;
	}

	public outputTokensTotal(): number {
		return this._tokenUsageInteraction.outputTokens;
	}

	public get totalTokensTotal(): number {
		return this._tokenUsageInteraction.totalTokens;
	}

	protected calculateDifferentialUsage(
		tokenUsage: TokenUsage,
	): TokenUsageDifferential {
		const lastMessage = this.getLastMessage();
		// For assistant messages, use output tokens directly
		if (lastMessage && lastMessage.role === 'assistant') {
			return {
				inputTokens: 0, // Assistant doesn't add to input differential
				outputTokens: tokenUsage.outputTokens,
				totalTokens: tokenUsage.outputTokens,
			};
		}

		// For user messages, calculate input token difference
		const previousMessage = this.getPreviousAssistantMessage();
		const previousTokens = previousMessage?.providerResponse?.usage?.inputTokens ?? 0;
		const inputDiff = Math.max(0, tokenUsage.inputTokens - previousTokens);

		return {
			inputTokens: inputDiff,
			outputTokens: 0, // User messages don't generate output tokens
			totalTokens: inputDiff,
		};
	}

	protected calculateCacheImpact(tokenUsage: TokenUsage): CacheImpact {
		// Calculate potential cost without cache
		const potentialCost = tokenUsage.inputTokens;

		// Calculate actual cost with cache
		const actualCost = (tokenUsage.cacheReadInputTokens ?? 0) + (tokenUsage.cacheCreationInputTokens ?? 0);

		// Calculate savings
		const savings = Math.max(0, potentialCost - actualCost);

		return {
			potentialCost,
			actualCost,
			savings,
		};
	}

	protected createTokenUsageRecord(
		tokenUsage: TokenUsage,
		model: string,
	): TokenUsageRecord {
		const lastMessage = this.getLastMessage();
		return {
			messageId: this.getLastMessageId(),
			statementCount: this.statementCount,
			statementTurnCount: this.statementTurnCount,
			timestamp: new Date().toISOString(),
			model,
			role: lastMessage.role,
			type: this.interactionType,
			rawUsage: tokenUsage,
			differentialUsage: this.calculateDifferentialUsage(tokenUsage),
			cacheImpact: this.calculateCacheImpact(tokenUsage),
		};
	}

	public updateTotals({
		usage: tokenUsage,
		model,
	}: { usage: TokenUsage; model: string }): void {
		//logger.info(`BaseInteraction - token usage`, tokenUsage);

		if (tokenUsage.cacheCreationInputTokens === undefined) tokenUsage.cacheCreationInputTokens = 0;
		if (tokenUsage.cacheReadInputTokens === undefined) tokenUsage.cacheReadInputTokens = 0;
		if (
			tokenUsage.inputTokens > 0 ||
			tokenUsage.outputTokens > 0 ||
			tokenUsage.cacheCreationInputTokens > 0 ||
			tokenUsage.cacheReadInputTokens > 0
		) {
			// Record token usage with interactionType
			const usageRecord = this.createTokenUsageRecord(tokenUsage, model);
			this.conversationPersistence.writeTokenUsage(usageRecord, this.interactionType).then(() =>
				logger.debug('BaseInteraction - token usage written to JSON log', tokenUsage)
			);
		}

		if (this.conversationTurnCount === 0) {
			this.tokenUsageInteraction.totalTokens = 0;
			this.tokenUsageInteraction.inputTokens = 0;
			this.tokenUsageInteraction.outputTokens = 0;
			this.tokenUsageInteraction.cacheCreationInputTokens = 0;
			this.tokenUsageInteraction.cacheReadInputTokens = 0;
		}
		if (this.statementTurnCount === 0) {
			this.tokenUsageStatement.totalTokens = 0;
			this.tokenUsageStatement.inputTokens = 0;
			this.tokenUsageStatement.outputTokens = 0;
			this.tokenUsageStatement.cacheCreationInputTokens = 0;
			this.tokenUsageStatement.cacheReadInputTokens = 0;
		}

		if (this.tokenUsageInteraction.cacheCreationInputTokens === undefined) {
			this.tokenUsageInteraction.cacheCreationInputTokens = 0;
		}
		if (this.tokenUsageInteraction.cacheReadInputTokens === undefined) {
			this.tokenUsageInteraction.cacheReadInputTokens = 0;
		}
		if (this.tokenUsageStatement.cacheCreationInputTokens === undefined) {
			this.tokenUsageStatement.cacheCreationInputTokens = 0;
		}
		if (this.tokenUsageStatement.cacheReadInputTokens === undefined) {
			this.tokenUsageStatement.cacheReadInputTokens = 0;
		}

		this.tokenUsageInteraction.totalTokens += tokenUsage.totalTokens;
		this.tokenUsageInteraction.inputTokens += tokenUsage.inputTokens;
		this.tokenUsageInteraction.outputTokens += tokenUsage.outputTokens;
		this.tokenUsageInteraction.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
		this.tokenUsageInteraction.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;

		this.tokenUsageStatement.totalTokens += tokenUsage.totalTokens;
		this.tokenUsageStatement.inputTokens += tokenUsage.inputTokens;
		this.tokenUsageStatement.outputTokens += tokenUsage.outputTokens;
		this.tokenUsageStatement.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
		this.tokenUsageStatement.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;

		this.tokenUsageTurn = tokenUsage;

		logger.error('LLMInteraction: updateTotals - ', {
			tokenUsageInteraction: this.tokenUsageInteraction,
			tokenUsageStatement: this.tokenUsageStatement,
			tokenUsageTurn: this.tokenUsageTurn,
		});

		this.statementTurnCount++;
		this.conversationTurnCount++;
	}

	public updateToolStats(toolName: string, success: boolean): void {
		const stats = this._toolStats.get(toolName) || {
			count: 0,
			success: 0,
			failure: 0,
			lastUse: { success: false, timestamp: '' },
		};
		stats.count++;
		if (success) stats.success++;
		else stats.failure++;
		stats.lastUse = {
			success,
			timestamp: new Date().toISOString(),
		};
		this._toolStats.set(toolName, stats);
	}

	public updateResourceAccess(resource: string, modified: boolean = false): void {
		this._resources.accessed.add(resource);
		if (modified) this._resources.modified.add(resource);
		this._resources.active.add(resource);
	}

	public setObjectives(conversation?: string, statement?: string): void {
		// Initialize objectives if not set
		if (!this._objectives) {
			this._objectives = {
				conversation: undefined,
				statement: [],
				timestamp: new Date().toISOString(),
			};
		}

		// Update conversation goal if provided
		if (conversation) {
			this._objectives.conversation = String(conversation);
		}

		// Append new statement objective if provided
		if (statement) {
			this._objectives.statement.push(String(statement));
		}

		// Update timestamp
		this._objectives.timestamp = new Date().toISOString();
		logger.debug('Set objectives:', this._objectives);
	}

	public getObjectives(): ObjectivesData {
		return this._objectives;
	}

	public get conversationMetrics(): ConversationMetrics {
		return {
			statementTurnCount: this.statementTurnCount,
			conversationTurnCount: this.conversationTurnCount,
			statementCount: this.statementCount,

			// New task-oriented metrics
			objectives: this._objectives
				? {
					conversation: this._objectives.conversation,
					statement: this._objectives.statement,
					timestamp: this._objectives.timestamp,
				}
				: undefined,
			resources: this._resources,
			toolUsage: {
				currentToolSet: this._currentToolSet,
				toolStats: this._toolStats,
			},
		};
	}

	public prepareSytemPrompt(_system: string): Promise<string> {
		throw new Error("Method 'prepareSytemPrompt' must be implemented.");
	}
	public prepareMessages(_messages: LLMMessage[]): Promise<LLMMessage[]> {
		throw new Error("Method 'prepareMessages' must be implemented.");
	}
	public prepareTools(_tools: Map<string, LLMTool>): Promise<LLMTool[]> {
		throw new Error("Method 'prepareTools' must be implemented.");
	}

	public addMessageForUserRole(content: LLMMessageContentPart | LLMMessageContentParts): string {
		const lastMessage = this.getLastMessage();
		if (lastMessage && lastMessage.role === 'user') {
			// Append content to the content array of the last user message
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id;
		} else {
			// Add a new user message
			const newMessage = new LLMMessage(
				'user',
				Array.isArray(content) ? content : [content],
				this.conversationStats,
			);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	public addMessageForAssistantRole(
		content: LLMMessageContentPart | LLMMessageContentParts,
		tool_call_id?: string,
		providerResponse?: LLMMessageProviderResponse,
	): string {
		const lastMessage = this.getLastMessage();

		if (lastMessage && lastMessage.role === 'assistant') {
			logger.error('LLMInteraction: Why are we adding another assistant message - SOMETHING IS WRONG!');
			// Append content to the content array of the last assistant message
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id;
		} else {
			// Add a new assistant message
			const newMessage = new LLMMessage(
				'assistant',
				Array.isArray(content) ? content : [content],
				this.conversationStats,
				tool_call_id,
				providerResponse,
			);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	public addMessageForToolResult(
		toolUseId: string,
		toolRunResultContent: LLMToolRunResultContent,
		isError: boolean = false,
	): string {
		const toolResult = {
			type: 'tool_result',
			tool_use_id: toolUseId,
			content: Array.isArray(toolRunResultContent) ? toolRunResultContent : [
				typeof toolRunResultContent !== 'string' ? toolRunResultContent : {
					'type': 'text',
					'text': toolRunResultContent,
				} as LLMMessageContentPartTextBlock,
			],
			is_error: isError,
		} as LLMMessageContentPartToolResultBlock;
		// logger.debug('LLMInteraction: Adding tool result', toolResult);

		const lastMessage = this.getLastMessage();
		if (lastMessage && lastMessage.role === 'user') {
			// Check if there's an existing tool result with the same toolUseId
			const existingToolResultIndex = lastMessage.content.findIndex(
				(part): part is LLMMessageContentPartToolResultBlock =>
					part.type === 'tool_result' && part.tool_use_id === toolUseId,
			);

			if (existingToolResultIndex !== -1) {
				// Update existing tool result
				const existingToolResult = lastMessage
					.content[existingToolResultIndex] as LLMMessageContentPartToolResultBlock;
				if (existingToolResult.content && Array.isArray(existingToolResult.content)) {
					existingToolResult.content.push(
						...(Array.isArray(toolResult.content)
							? toolResult.content as (LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock)[]
							: toolResult.content && 'type' in toolResult.content &&
									((toolResult.content as LLMMessageContentPart).type === 'text' ||
										(toolResult.content as LLMMessageContentPart).type === 'image')
							? [toolResult.content as LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock]
							: []),
					);
				} else {
					existingToolResult.content = Array.isArray(toolResult.content)
						? toolResult.content as (LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock)[]
						: toolResult.content && 'type' in toolResult.content &&
								((toolResult.content as LLMMessageContentPart).type === 'text' ||
									(toolResult.content as LLMMessageContentPart).type === 'image')
						? [toolResult.content as LLMMessageContentPartTextBlock | LLMMessageContentPartImageBlock]
						: [];
				}
				existingToolResult.is_error = existingToolResult.is_error || isError;
				logger.debug('LLMInteraction: Updating existing tool result', JSON.stringify(toolResult, null, 2));
				return lastMessage.id;
			} else {
				// Add new tool result to existing user message
				logger.debug(
					'LLMInteraction: Adding new tool result to existing user message',
					JSON.stringify(toolResult, null, 2),
				);
				lastMessage.content.push(toolResult);
				return lastMessage.id;
			}
		} else {
			// Add a new user message with the tool result
			logger.debug(
				'LLMInteraction: Adding new user message with tool result',
				JSON.stringify(toolResult, null, 2),
			);
			const newMessage = new LLMMessage('user', [toolResult], this.conversationStats);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	public addMessage(
		message: {
			role: LLMProviderMessageResponseRole;
			content: LLMMessageContentParts;
			conversationStats: ConversationStats;
			id?: string;
			tool_call_id?: string;
			providerResponse?: LLMMessageProviderResponse;
		} | LLMMessage,
	): void {
		let completeMessage: LLMMessage;
		if (message instanceof LLMMessage) {
			// LLMMessage will call setTimestamp if needed
			//if (message?.timestamp === undefined) message.setTimestamp();
			completeMessage = message;
		} else {
			completeMessage = new LLMMessage(
				message.role,
				message.content,
				message.conversationStats,
				message.tool_call_id,
				message.providerResponse,
				message.id,
			);
		}
		this.messages.push(completeMessage);
	}

	public getMessages(): LLMMessage[] {
		return this.messages;
	}
	public setMessages(messages: LLMMessage[]): void {
		this.messages = messages;
	}

	public getLastMessage(): LLMMessage {
		return this.messages.slice(-1)[0];
	}

	public getLastTwoMessages(): LLMMessage[] {
		return this.messages.slice(-2);
	}

	/**
	 * Returns the most recent message from the assistant in the conversation.
	 * This is more reliable than getLastMessage() when specifically needing an assistant message,
	 * as the last message could be from the user or a tool result.
	 */
	public getPreviousAssistantMessage(): LLMMessage | undefined {
		// Search backwards through messages to find the last assistant message
		for (let i = this.messages.length - 1; i >= 0; i--) {
			if (this.messages[i].role === 'assistant') {
				return this.messages[i];
			}
		}
		return undefined;
	}

	/**
	 * Returns the most recent message from the user in the conversation.
	 * This is more reliable than getLastMessage() when specifically needing an assistant message,
	 * as the last message could be from the user or a tool result.
	 */
	public getPreviousUserMessage(): LLMMessage | undefined {
		// Search backwards through messages to find the last assistant message
		for (let i = this.messages.length - 1; i >= 0; i--) {
			if (this.messages[i].role === 'user') {
				return this.messages[i];
			}
		}
		return undefined;
	}

	public getId(): string {
		return this.id;
	}

	public getLastMessageContent(): LLMMessageContentParts | undefined {
		const lastMessage = this.getLastMessage();
		return lastMessage?.content;
	}

	public getLastMessageId(): string {
		const lastMessage = this.getLastMessage();
		if (!lastMessage) throw new Error('No message found for getLastMessageId');
		return lastMessage.id;
	}

	public clearMessages(): void {
		this.messages = [];
	}

	get llmProviderName(): string {
		return this.llm.llmProviderName;
	}

	get currentPrompt(): string {
		return this._currentPrompt;
	}

	set currentPrompt(value: string) {
		this._currentPrompt = value;
	}

	get baseSystem(): string {
		return this._baseSystem;
	}

	set baseSystem(value: string) {
		this._baseSystem = value;
	}

	get model(): string {
		return this._model;
	}

	set model(value: string) {
		this._model = value;
	}

	get maxTokens(): number {
		return this._maxTokens;
	}

	set maxTokens(value: number) {
		this._maxTokens = value;
	}

	get temperature(): number {
		return this._temperature;
	}

	set temperature(value: number) {
		this._temperature = value;
	}

	addTool(tool: LLMTool): void {
		this.tools.set(tool.name, tool);
	}

	addTools(tools: LLMTool[]): void {
		tools.forEach((tool: LLMTool) => {
			this.addTool(tool);
		});
	}

	getTool(name: string): LLMTool | undefined {
		return this.tools.get(name);
	}

	allTools(): Map<string, LLMTool> {
		return this.tools;
	}

	getAllTools(): LLMTool[] {
		return Array.from(this.tools.values());
	}
	listTools(): string[] {
		return Array.from(this.tools.keys());
	}

	clearTools(): void {
		this.tools.clear();
	}
}

export default LLMInteraction;
