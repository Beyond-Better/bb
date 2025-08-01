//import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
//import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
//import LLMChatInteraction from 'api/llms/chatInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import {
	type LLMCallbacks,
	LLMCallbackType,
	type LLMExtendedThinkingOptions,
	type LLMModelConfig,
	type LLMProvider,
} from 'api/types.ts';
import type {
	CacheImpact,
	CollaborationId,
	InteractionId,
	InteractionMetrics,
	InteractionStats,
	InteractionType,
	ObjectivesData,
	ResourceMetrics,
	TokenUsage,
	TokenUsageDifferential,
	TokenUsageRecord,
	TokenUsageStatsForCollaboration,
	TokenUsageStatsForInteraction,
	ToolStats,
} from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
	LLMMessageProviderResponse,
} from 'api/llms/llmMessage.ts';
import { getLLMModelToProvider, type LLMProviderMessageResponseRole } from 'api/types/llms.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type Collaboration from 'api/collaborations/collaboration.ts';
import InteractionPersistence from 'api/storage/interactionPersistence.ts';
import CollaborationLogger from 'api/storage/collaborationLogger.ts';
import type { CollaborationLogEntry } from 'api/storage/collaborationLogger.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/generateIds.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import { logger } from 'shared/logger.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { InteractionPreferences, ModelCapabilities } from 'api/types/modelCapabilities.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import LLMFactory from '../llmProvider.ts';
import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { LLMSpeakWithResponse } from 'api/types.ts';

class LLMInteraction {
	public id: string;
	public parentInteractionId?: string;
	public title: string | null = null;
	public createdAt: Date = new Date();
	public updatedAt: Date = new Date();
	protected _interactionType: InteractionType;

	private _totalProviderRequests: number = 0;
	// count of turns for most recent statement
	protected _statementTurnCount: number = 0;
	// count of turns for all statements (whole conversation)
	protected _interactionTurnCount: number = 0;
	// count of statements
	protected _statementCount: number = 0;
	// token usage for most recent turn
	protected _tokenUsageTurn: TokenUsage = DEFAULT_TOKEN_USAGE();
	// token usage for most recent statement
	protected _tokenUsageStatement: TokenUsage = DEFAULT_TOKEN_USAGE();
	// token usage for for all statements
	protected _tokenUsageInteraction: TokenUsage = DEFAULT_TOKEN_USAGE();
	// Task-oriented metrics
	protected _objectives: ObjectivesData;
	protected _resourceMetrics: ResourceMetrics = {
		accessed: new Set<string>(),
		modified: new Set<string>(),
		active: new Set<string>(),
	};
	protected _toolStats: Map<string, ToolStats> = new Map();
	protected _currentToolSet?: string;

	protected messages: LLMMessage[] = [];
	protected tools: Map<string, LLMTool> = new Map();
	protected _extendedThinking: LLMExtendedThinkingOptions | undefined;
	protected _baseSystem: string = '';
	public interactionPersistence!: InteractionPersistence;
	protected collaborationRef!: WeakRef<Collaboration>;
	public collaborationLogger!: CollaborationLogger;
	protected projectConfig!: ProjectConfig;

	private _llmProvider!: LLM;
	private _llmModelToProvider!: Record<string, LLMProvider>;
	private _interactionCallbacks!: LLMCallbacks;
	private _model: string = '';
	private _localMode: boolean = false;

	protected _maxTokens: number = 16384; //8192;
	protected _temperature: number = 0.2;
	protected _currentPrompt: string = '';

	protected _modelConfig?: LLMModelConfig;
	// 	protected _modelConfig: LLMModelConfig = {
	// 		model: '',
	// 		temperature: 0,
	// 		maxTokens: 0,
	// 		extendedThinking: { enabled: false, budgetTokens: 0 },
	// 		usePromptCaching: false,
	// 	};

	constructor(collaboration: Collaboration, interactionId?: InteractionId) {
		this.collaborationRef = new WeakRef(collaboration);

		this.id = interactionId ?? shortenInteractionId(generateInteractionId());
		this._interactionType = 'base';

		// Ensure objectives are properly initialized
		this._objectives = {
			collaboration: undefined,
			statement: [],
			timestamp: new Date().toISOString(),
		};
	}

	public async init(
		interactionModel: string,
		interactionCallbacks: LLMCallbacks,
		parentInteractionId?: InteractionId,
	): Promise<LLMInteraction> {
		try {
			this._model = interactionModel;
			this._interactionCallbacks = interactionCallbacks;
			this.parentInteractionId = parentInteractionId;
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			this._localMode = globalConfig.api.localMode ?? false;
			this._llmModelToProvider = await getLLMModelToProvider();
			this._llmProvider = LLMFactory.getProvider(
				this._interactionCallbacks,
				this._localMode
					//? this._llmModelToProvider[this.projectConfig.defaultModels?.orchestrator ?? 'claude-sonnet-4-20250514']
					? this._llmModelToProvider[this._model]
					: LLMProviderEnum.BB,
				//globalConfig.api.localMode ? LLMProviderEnum.OPENAI : LLMProviderEnum.BB,
				//globalConfig.api.localMode ? LLMProviderEnum.ANTHROPIC : LLMProviderEnum.BB,
			);

			//const projectId = await this.llm.invoke(LLMCallbackType.PROJECT_ID);
			const logEntryHandler = async (
				messageId: string,
				parentMessageId: string | null,
				collaborationId: CollaborationId,
				//parentInteractionId: InteractionId,
				agentInteractionId: InteractionId | null,
				timestamp: string,
				logEntry: CollaborationLogEntry,
				interactionStats: InteractionStats,
				tokenUsageStatsForCollaboration: TokenUsageStatsForCollaboration,
				modelConfig?: LLMModelConfig,
			): Promise<void> => {
				await this.llm.invoke(
					LLMCallbackType.LOG_ENTRY_HANDLER,
					messageId,
					parentMessageId,
					collaborationId,
					//parentInteractionId,
					agentInteractionId,
					timestamp,
					logEntry,
					interactionStats,
					tokenUsageStatsForCollaboration,
					modelConfig,
				);
			};
			const projectEditor = await this.llm.invoke(LLMCallbackType.PROJECT_EDITOR);
			this.interactionPersistence = await new InteractionPersistence(
				this.collaboration.id,
				this.id,
				projectEditor,
				parentInteractionId,
			).init();
			this.collaborationLogger = await new CollaborationLogger(
				projectEditor,
				this.collaboration.id,
				//parentInteractionId ?? this.id,
				logEntryHandler,
			)
				.init();
			this.projectConfig = projectEditor.projectConfig;
		} catch (error) {
			logger.error('Failed to initialize LLMInteraction:', error as Error);
			throw error;
		}
		return this;
	}

	async saveInteraction(
		currentResponse: LLMSpeakWithResponse,
	): Promise<void> {
		try {
			await this.interactionPersistence.saveInteraction(this);

			// Save system prompt and project info if running in local development
			if (this.projectConfig.api?.environment === 'localdev') {
				const system = Array.isArray(currentResponse.messageMeta.system)
					? currentResponse.messageMeta.system[0].text
					: currentResponse.messageMeta.system;
				await this.interactionPersistence.dumpSystemPrompt(system);
				//const projectEditor = await this.llm.invoke(LLMCallbackType.PROJECT_EDITOR);
				//await this.interactionPersistence.dumpProjectInfo(projectEditor.projectInfo);
			}

			logger.info(`LLMInteraction: Saved interaction: ${this.id}`);
		} catch (error) {
			logger.error(`LLMInteraction: Error persisting the interaction:`, error);
			throw error;
		}
	}

	public get collaboration(): Collaboration {
		const collaboration = this.collaborationRef.deref();
		if (!collaboration) throw new Error('No collaboration to deref from collaborationRef');
		return collaboration;
	}
	public set collaboration(collaboration: Collaboration) {
		this.collaborationRef = new WeakRef(collaboration);
	}

	public get interactionType(): InteractionType {
		return this._interactionType;
	}

	public get llm(): LLM {
		return this._llmProvider;
	}
	public get llmProvider(): LLM {
		return this._llmProvider;
	}

	public get interactionStats(): InteractionStats {
		return {
			statementCount: this._statementCount,
			statementTurnCount: this._statementTurnCount,
			interactionTurnCount: this._interactionTurnCount,
		};
	}
	public set interactionStats(stats: InteractionStats) {
		this._statementCount = stats.statementCount;
		this._statementTurnCount = stats.statementTurnCount;
		this._interactionTurnCount = stats.interactionTurnCount;
	}

	public get tokenUsageStatsForInteraction(): TokenUsageStatsForInteraction {
		return {
			tokenUsageTurn: this._tokenUsageTurn,
			tokenUsageStatement: this._tokenUsageStatement,
			tokenUsageInteraction: this._tokenUsageInteraction,
		};
	}
	public set tokenUsageStatsForInteraction(stats: TokenUsageStatsForInteraction) {
		this._tokenUsageTurn = stats.tokenUsageTurn;
		this._tokenUsageStatement = stats.tokenUsageStatement;
		this._tokenUsageInteraction = stats.tokenUsageInteraction;
	}

	public get modelConfig(): LLMModelConfig | undefined {
		return this._modelConfig;
	}
	public set modelConfig(modelConfig: LLMModelConfig | undefined) {
		this._modelConfig = modelConfig;
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
	public get interactionTurnCount(): number {
		return this._interactionTurnCount;
	}
	public set interactionTurnCount(count: number) {
		this._interactionTurnCount = count;
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
		const potentialCost = tokenUsage.inputTokens + tokenUsage.outputTokens +
			(tokenUsage.cacheReadInputTokens ?? 0) + (tokenUsage.cacheCreationInputTokens ?? 0);

		// Calculate actual cost with cache
		const actualCost = (tokenUsage.cacheReadInputTokens ?? 0) + (tokenUsage.cacheCreationInputTokens ?? 0);

		// Calculate savingsTotal and savingsPercentage
		const savingsTotal = Math.max(0, potentialCost - actualCost);
		const savingsPercentage = (savingsTotal / potentialCost) * 100;

		return {
			potentialCost,
			actualCost,
			savingsTotal,
			savingsPercentage,
		};
	}

	protected createTokenUsageRecord(
		tokenUsage: TokenUsage,
		model: string,
	): TokenUsageRecord {
		const lastMessage = this.getLastMessage();
		const rawAllUsage = {
			...tokenUsage,
			totalAllTokens: tokenUsage.totalTokens + (tokenUsage.cacheCreationInputTokens ?? 0) +
				(tokenUsage.cacheReadInputTokens ?? 0) +
				(tokenUsage.thoughtTokens ?? 0),
		};
		return {
			interactionId: this.id,
			messageId: this.getLastMessageId(),
			statementCount: this.statementCount,
			statementTurnCount: this.statementTurnCount,
			timestamp: new Date().toISOString(),
			model,
			role: lastMessage.role,
			type: this.interactionType,
			rawUsage: rawAllUsage,
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
			this.interactionPersistence.writeTokenUsage(usageRecord, this.interactionType).then(() =>
				logger.debug('BaseInteraction - token usage written to JSON log', tokenUsage)
			);
		}

		if (this.interactionTurnCount === 0) {
			this.tokenUsageInteraction.totalTokens = 0;
			this.tokenUsageInteraction.inputTokens = 0;
			this.tokenUsageInteraction.outputTokens = 0;
			this.tokenUsageInteraction.cacheCreationInputTokens = 0;
			this.tokenUsageInteraction.cacheReadInputTokens = 0;
			this.tokenUsageInteraction.thoughtTokens = 0;
			this.tokenUsageInteraction.totalAllTokens = 0;
		}
		if (this.statementTurnCount === 0) {
			this.tokenUsageStatement.totalTokens = 0;
			this.tokenUsageStatement.inputTokens = 0;
			this.tokenUsageStatement.outputTokens = 0;
			this.tokenUsageStatement.cacheCreationInputTokens = 0;
			this.tokenUsageStatement.cacheReadInputTokens = 0;
			this.tokenUsageStatement.thoughtTokens = 0;
			this.tokenUsageStatement.totalAllTokens = 0;
		}

		if (this.tokenUsageInteraction.cacheCreationInputTokens === undefined) {
			this.tokenUsageInteraction.cacheCreationInputTokens = 0;
		}
		if (this.tokenUsageInteraction.cacheReadInputTokens === undefined) {
			this.tokenUsageInteraction.cacheReadInputTokens = 0;
		}
		if (this.tokenUsageInteraction.thoughtTokens === undefined) {
			this.tokenUsageInteraction.thoughtTokens = 0;
		}
		if (this.tokenUsageInteraction.totalAllTokens === undefined) {
			this.tokenUsageInteraction.totalAllTokens = 0;
		}
		if (this.tokenUsageStatement.cacheCreationInputTokens === undefined) {
			this.tokenUsageStatement.cacheCreationInputTokens = 0;
		}
		if (this.tokenUsageStatement.cacheReadInputTokens === undefined) {
			this.tokenUsageStatement.cacheReadInputTokens = 0;
		}
		if (this.tokenUsageStatement.thoughtTokens === undefined) {
			this.tokenUsageStatement.thoughtTokens = 0;
		}
		if (this.tokenUsageStatement.totalAllTokens === undefined) {
			this.tokenUsageStatement.totalAllTokens = 0;
		}

		this.tokenUsageInteraction.totalTokens += tokenUsage.totalTokens;
		this.tokenUsageInteraction.inputTokens += tokenUsage.inputTokens;
		this.tokenUsageInteraction.outputTokens += tokenUsage.outputTokens;
		this.tokenUsageInteraction.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
		this.tokenUsageInteraction.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;
		this.tokenUsageInteraction.thoughtTokens += tokenUsage.thoughtTokens || 0;
		this.tokenUsageInteraction.totalAllTokens += tokenUsage.totalTokens + tokenUsage.cacheCreationInputTokens +
			tokenUsage.cacheReadInputTokens + (tokenUsage.thoughtTokens || 0);

		this.tokenUsageStatement.totalTokens += tokenUsage.totalTokens;
		this.tokenUsageStatement.inputTokens += tokenUsage.inputTokens;
		this.tokenUsageStatement.outputTokens += tokenUsage.outputTokens;
		this.tokenUsageStatement.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
		this.tokenUsageStatement.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;
		this.tokenUsageStatement.thoughtTokens += tokenUsage.thoughtTokens || 0;
		this.tokenUsageStatement.totalAllTokens += tokenUsage.totalTokens + tokenUsage.cacheCreationInputTokens +
			tokenUsage.cacheReadInputTokens + (tokenUsage.thoughtTokens || 0);

		this.tokenUsageTurn = tokenUsage;

		this.collaboration.addTokenUsageCollaboration(tokenUsage);

		// logger.error('LLMInteraction: updateTotals - ', {
		// 	tokenUsageInteraction: this.tokenUsageInteraction,
		// 	tokenUsageStatement: this.tokenUsageStatement,
		// 	tokenUsageTurn: this.tokenUsageTurn,
		// });

		this.statementTurnCount++;
		this.interactionTurnCount++;
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

	public updateResourceAccess(resourceMetric: string, modified: boolean = false): void {
		this._resourceMetrics.accessed.add(resourceMetric);
		if (modified) this._resourceMetrics.modified.add(resourceMetric);
		this._resourceMetrics.active.add(resourceMetric);
	}

	public setObjectives(collaboration?: string, statement?: string): void {
		// Initialize objectives if not set
		if (!this._objectives) {
			this._objectives = {
				collaboration: undefined,
				statement: [],
				timestamp: new Date().toISOString(),
			};
		}

		// Update collaboration goal if provided
		if (collaboration) {
			this._objectives.collaboration = String(collaboration);
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

	public get interactionMetrics(): InteractionMetrics {
		return {
			statementTurnCount: this.statementTurnCount,
			interactionTurnCount: this.interactionTurnCount,
			statementCount: this.statementCount,

			// New task-oriented metrics
			objectives: this._objectives
				? {
					collaboration: this._objectives.collaboration,
					statement: this._objectives.statement,
					timestamp: this._objectives.timestamp,
				}
				: undefined,
			resources: this._resourceMetrics,
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
				this.interactionStats,
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
				this.interactionStats,
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
		const bbResult = isError
			? {
				type: 'text',
				text: `The tool run failed: ${toolRunResultContent}`,
			} as LLMMessageContentPartTextBlock
			: null;

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
				if (bbResult) lastMessage.content.push(bbResult);
				return lastMessage.id;
			}
		} else {
			// Add a new user message with the tool result
			logger.debug(
				'LLMInteraction: Adding new user message with tool result',
				JSON.stringify(toolResult, null, 2),
			);
			const newMessageContent: LLMMessageContentParts = [toolResult];
			if (bbResult) newMessageContent.push(bbResult);
			const newMessage = new LLMMessage('user', newMessageContent, this.interactionStats);
			this.addMessage(newMessage);
			return newMessage.id;
		}
	}

	public addMessage(
		message: {
			role: LLMProviderMessageResponseRole;
			content: LLMMessageContentParts;
			interactionStats: InteractionStats;
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
				message.interactionStats,
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
	 * Returns the most recent message from the assistant in the interaction.
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
	 * Returns the most recent message from the user in the interaction.
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
		const updateProvider = this._model !== value;
		this._model = value;
		if (updateProvider) {
			this._llmProvider = LLMFactory.getProvider(
				this._interactionCallbacks,
				this._localMode ? this._llmModelToProvider[this._model] : LLMProviderEnum.BB,
			);
		}
	}

	get maxTokens(): number {
		return this._maxTokens;
	}

	set maxTokens(value: number) {
		this._maxTokens = value;
	}

	/**
	 * Get the interaction-specific parameter preferences
	 * These preferences are used in the model parameter resolution pipeline
	 * @returns The interaction preferences for this type of interaction
	 */
	public getInteractionPreferences(): InteractionPreferences {
		// Base implementation returns preferences appropriate for the interaction type
		switch (this._interactionType) {
			case 'chat':
				return {
					temperature: 0.7, // More creative for chat
					maxTokens: 4096, // Limited for chat
					extendedThinking: false,
				};
			case 'conversation':
				return {
					temperature: 0.2, // More precise for conversation
					maxTokens: 16384, // Higher for conversation to allow more detailed responses
					extendedThinking: true,
				};
			default:
				return {
					temperature: 0.5,
					maxTokens: 8192,
					extendedThinking: false,
				};
		}
	}

	/**
	 * Resolve model parameters using the ModelRegistryService
	 * This applies the proper parameter resolution hierarchy
	 *
	 * @param provider The LLM provider
	 * @param model The model ID
	 * @param explicitMaxTokens Optional explicit maxTokens value
	 * @param explicitTemperature Optional explicit temperature value
	 * @returns Resolved parameters object with maxTokens and temperature
	 */
	public async resolveModelParameters(
		model: string,
		parameters: {
			maxTokens?: number;
			temperature?: number;
			extendedThinking?: boolean;
		},
		provider?: LLMProvider,
	): Promise<{ maxTokens: number; temperature: number; extendedThinking: boolean }> {
		const registryService = await ModelRegistryService.getInstance(this.projectConfig);

		const modelToProvider = await getLLMModelToProvider();
		const effectiveProvider = provider || modelToProvider[model];
		// Get user preferences from project config
		const userPreferences = this.projectConfig?.api?.llmProviders?.[effectiveProvider]?.userPreferences;

		// Get interaction-specific preferences
		const interactionPreferences = this.getInteractionPreferences();

		const explicitMaxTokens = parameters.maxTokens;
		const explicitTemperature = parameters.temperature;
		const explicitExtendedThinking = parameters.extendedThinking;

		// Resolve maxTokens with proper priority
		const maxTokens = registryService.resolveMaxTokens(
			model,
			explicitMaxTokens, // || this._maxTokens,
			userPreferences?.maxTokens,
			interactionPreferences.maxTokens,
		);

		// Resolve temperature with proper priority
		const temperature = registryService.resolveTemperature(
			model,
			explicitTemperature, // || this._temperature,
			userPreferences?.temperature,
			interactionPreferences.temperature,
		);

		// Resolve temperature with proper priority
		const extendedThinking = registryService.resolveExtendedThinking(
			model,
			explicitExtendedThinking, // || this._extendedThinking.enabled,
			userPreferences?.extendedThinking,
			interactionPreferences.extendedThinking,
		);

		return { maxTokens, temperature, extendedThinking };
	}

	/**
	 * Return model capabilities using the ModelRegistryService
	 *
	 * @returns model capabilities for current model for the interaction
	 */
	public async getModelCapabilities(): Promise<ModelCapabilities> {
		const registryService = await ModelRegistryService.getInstance(this.projectConfig);
		const modelCapabilities = registryService.getModelCapabilities(this.model);
		//logger.info('BaseInteraction: modelCapabilities:', modelCapabilities);
		return modelCapabilities;
	}

	get temperature(): number {
		return this._temperature;
	}

	set temperature(value: number) {
		this._temperature = value;
	}

	get extendedThinking(): LLMExtendedThinkingOptions {
		return this._extendedThinking || { enabled: false, budgetTokens: 1024 };
	}
	set extendedThinking(extendedThinking: LLMExtendedThinkingOptions) {
		this._extendedThinking = extendedThinking;
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
