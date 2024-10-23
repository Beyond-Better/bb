import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from '../../types.ts';
import type LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import type { ConversationId, ConversationMetrics, ConversationTokenUsage, TokenUsage } from 'shared/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
	LLMMessageProviderResponse,
} from '../llmMessage.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import ConversationLogger from 'api/storage/conversationLogger.ts';
import type { ConversationLogEntry } from 'api/storage/conversationLogger.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import type { FullConfigSchema } from 'shared/configManager.ts';
import { logger } from 'shared/logger.ts';

class LLMInteraction {
	public id: string;
	public title: string = '';
	public createdAt: Date = new Date();
	public updatedAt: Date = new Date();
	private _totalProviderRequests: number = 0;
	// count of turns for most recent statement
	protected _statementTurnCount: number = 0;
	// count of turns for all statement
	protected _conversationTurnCount: number = 0;
	// count of statements
	protected _statementCount: number = 0;
	// token usage for most recent statement
	protected _tokenUsageTurn: TokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	// token usage for most recent statement
	protected _tokenUsageStatement: TokenUsage = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
	// token usage for for all statements
	protected _tokenUsageInteraction: ConversationTokenUsage = {
		totalTokensTotal: 0,
		inputTokensTotal: 0,
		outputTokensTotal: 0,
	};

	// [TODO] change llm to protected attribute and create a getter for other classes to call
	public llm: LLM;
	protected messages: LLMMessage[] = [];
	protected tools: Map<string, LLMTool> = new Map();
	protected _baseSystem: string = '';
	public conversationPersistence!: ConversationPersistence;
	public conversationLogger!: ConversationLogger;
	protected fullConfig!: FullConfigSchema;

	private _model: string = '';

	protected _maxTokens: number = 8192;
	protected _temperature: number = 0.2;
	protected _currentPrompt: string = '';

	constructor(llm: LLM, conversationId?: ConversationId) {
		this.id = conversationId ?? generateConversationId();
		this.llm = llm;
	}

	public async init(): Promise<LLMInteraction> {
		try {
			const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
			const logEntryHandler = async (
				timestamp: string,
				logEntry: ConversationLogEntry,
				conversationStats: ConversationMetrics,
				tokenUsageTurn: TokenUsage,
				tokenUsageStatement: TokenUsage,
				tokenUsageConversation: ConversationTokenUsage,
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
			this.conversationPersistence = await new ConversationPersistence(this.id, projectEditor).init();
			this.conversationLogger = await new ConversationLogger(projectRoot, this.id, logEntryHandler).init();
			this.fullConfig = projectEditor.fullConfig;
		} catch (error) {
			logger.error('Failed to initialize LLMInteraction:', error);
			throw error;
		}
		return this;
	}

	public get conversationStats(): ConversationMetrics {
		return {
			statementCount: this._statementCount,
			statementTurnCount: this._statementTurnCount,
			conversationTurnCount: this._conversationTurnCount,
		};
	}
	public set conversationStats(stats: ConversationMetrics) {
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

	public get tokenUsageInteraction(): ConversationTokenUsage {
		return this._tokenUsageInteraction;
	}
	public set tokenUsageInteraction(tokenUsage: ConversationTokenUsage) {
		this._tokenUsageInteraction = tokenUsage;
	}

	public get inputTokensTotal(): number {
		return this._tokenUsageInteraction.inputTokensTotal;
	}

	public outputTokensTotal(): number {
		return this._tokenUsageInteraction.outputTokensTotal;
	}

	public get totalTokensTotal(): number {
		return this._tokenUsageInteraction.totalTokensTotal;
	}

	//public updateTotals(tokenUsage: TokenUsage, providerRequests: number): void {
	public updateTotals(tokenUsage: TokenUsage): void {
		this._tokenUsageInteraction.totalTokensTotal += tokenUsage.totalTokens;
		this._tokenUsageInteraction.inputTokensTotal += tokenUsage.inputTokens;
		this._tokenUsageInteraction.outputTokensTotal += tokenUsage.outputTokens;
		//this._totalProviderRequests += providerRequests;
		this._tokenUsageStatement = tokenUsage;
		this._statementTurnCount++;
		this._conversationTurnCount++;
	}

	public getConversationStats(): ConversationMetrics {
		return {
			statementTurnCount: this._statementTurnCount,
			conversationTurnCount: this._conversationTurnCount,
			statementCount: this._statementCount,
		};
	}
	/*
	public getAllStats(): ConversationMetrics {
		return {
			//totalProviderRequests: this._totalProviderRequests,
			statementTurnCount: this._statementTurnCount,
			conversationTurnCount: this._conversationTurnCount,
			statementCount: this._statementCount,
			tokenUsageTurn: this._tokenUsageTurn,
			tokenUsageStatement: this._tokenUsageStatement,
			tokenUsageInteraction: this._tokenUsageInteraction
		};
	}
 */

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
		//logger.debug('lastMessage for user', lastMessage);
		if (lastMessage && lastMessage.role === 'user') {
			// Append content to the content array of the last user message
			//logger.debug('Adding content to existing user message', JSON.stringify(content, null, 2));
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id;
		} else {
			// Add a new user message
			//logger.debug('Adding content to new user message', JSON.stringify(content, null, 2));
			const newMessage = new LLMMessage('user', Array.isArray(content) ? content : [content]);
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
		//logger.debug('lastMessage for assistant', lastMessage);

		if (lastMessage && lastMessage.role === 'assistant') {
			logger.error('LLMInteraction: Why are we adding another assistant message - SOMETHING IS WRONG!');
			// Append content to the content array of the last assistant message
			//logger.debug('Adding content to existing assistant message', JSON.stringify(content, null, 2));
			if (Array.isArray(content)) {
				lastMessage.content.push(...content);
			} else {
				lastMessage.content.push(content);
			}
			return lastMessage.id;
		} else {
			// Add a new assistant message
			//logger.debug('Adding content to new assistant message', JSON.stringify(content, null, 2));
			const newMessage = new LLMMessage(
				'assistant',
				Array.isArray(content) ? content : [content],
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
			const newMessage = new LLMMessage('user', [toolResult]);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	public addMessage(message: Omit<LLMMessage, 'timestamp'> | LLMMessage): void {
		let completeMessage: LLMMessage;
		if (message instanceof LLMMessage) {
			completeMessage = message;
			completeMessage.setTimestamp();
		} else {
			completeMessage = new LLMMessage(
				message.role,
				message.content,
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

	// speakWithLLM is a lower-level call, to handle tool use/results loop and auxillary messages
	// the caller is responsible for adding to conversationLogger
	async speakWithLLM(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		//logger.debug(`speakWithLLM - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		this.addMessageForUserRole({ type: 'text', text: prompt });

		const response = await this.llm.speakWithRetry(this, speakOptions);

		return response;
	}
}

export default LLMInteraction;
