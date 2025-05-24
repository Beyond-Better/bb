import * as diff from 'diff';

import type InteractionManager from 'api/llms/interactionManager.ts';
import { interactionManager } from 'api/llms/interactionManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
import type LLM from '../llms/providers/baseLLM.ts';
import LLMFactory from '../llms/llmProvider.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunToolResponse } from 'api/llms/llmTool.ts';
import LLMToolManager from '../llms/llmToolManager.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import PromptManager from '../prompts/promptManager.ts';
import EventManager from 'shared/eventManager.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
//import type { ErrorHandlingConfig, LLMProviderMessageResponse, Task } from 'api/types/llms.ts';
import type { LLMProviderMessageResponse, LLMRequestParams } from 'api/types/llms.ts';
import type {
	ConversationContinue,
	//ConversationLogDataEntry,
	ConversationId,
	ConversationLogEntry,
	//ConversationMetrics,
	ConversationResponse,
	//ConversationStart,
	ConversationStats,
	//ObjectivesData,
	TokenUsage,
	TokenUsageStats,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
import { ErrorType, isLLMError, type LLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { createError } from 'api/utils/error.ts';

import { logger } from 'shared/logger.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import { extractThinkingFromContent } from 'api/utils/llms.ts';
import { readFileContent } from 'api/utils/fileHandling.ts';
import type { LLMCallbacks, LLMSpeakWithResponse } from 'api/types.ts';
import { LLMModelToProvider } from 'api/types/llms.ts';
import {
	//generateConversationObjective,
	generateConversationTitle,
	//generateStatementObjective,
} from '../utils/conversation.utils.ts';
import { generateConversationId, shortenConversationId } from 'shared/conversationManagement.ts';
//import { runFormatCommand } from '../utils/project.utils.ts';
import { stageAndCommitAfterChanging } from '../utils/git.utils.ts';
//import { getVersionInfo } from 'shared/version.ts';

class BaseController {
	public projectConfig!: ProjectConfig;
	public interactionManager: InteractionManager;
	public promptManager!: PromptManager;
	public toolManager!: LLMToolManager;
	public llmProvider!: LLM;
	public eventManager!: EventManager;
	protected projectEditorRef!: WeakRef<ProjectEditor>;
	//protected _providerRequestCount: number = 0;
	protected interactionStats: Map<ConversationId, ConversationStats> = new Map();
	//protected interactionMetrics: Map<ConversationId, ConversationMetrics> = new Map();
	protected interactionTokenUsage: Map<ConversationId, TokenUsage> = new Map();

	// Accessor methods for instance inspection
	public getInteractionStatsCount(): number {
		return this.interactionStats.size;
	}

	public getInteractionTokenUsageCount(): number {
		return this.interactionTokenUsage.size;
	}
	protected isCancelled: boolean = false;
	//protected currentStatus: ApiStatus = ApiStatus.IDLE;
	protected statusSequence: number = 0;

	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
		this.interactionManager = interactionManager; //new InteractionManager();
	}

	async init(): Promise<BaseController> {
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		this.projectConfig = await configManager.getProjectConfig(this.projectEditor.projectId);
		this.toolManager = await new LLMToolManager(this.projectConfig, 'core').init();
		this.eventManager = EventManager.getInstance();
		this.promptManager = await new PromptManager().init(this.projectEditor.projectId);

		this.llmProvider = LLMFactory.getProvider(
			this.getInteractionCallbacks(),
			globalConfig.api.localMode
				? LLMModelToProvider[this.projectConfig.defaultModels?.agent ?? 'claude-sonnet-4-20250514']
				: LLMProviderEnum.BB,
			//globalConfig.api.localMode ? LLMProviderEnum.OPENAI : LLMProviderEnum.BB,
			//globalConfig.api.localMode ? LLMProviderEnum.ANTHROPIC : LLMProviderEnum.BB,
		);

		return this;
	}

	protected handleLLMError(error: Error, interaction: LLMConversationInteraction): LLMError {
		logger.error(`BaseController: handleLLMError:`, error);

		if (isLLMError(error)) {
			// Extract useful information from the error if it's our custom error type
			const errorDetails = {
				message: error.message,
				code: error.name === 'LLMError' ? 'LLM_ERROR' : 'UNKNOWN_ERROR',
				// Include any additional error properties if available
				args: error.options?.args || {},
			};
			//logger.error(`BaseController: handleLLMError-error.options.args:`, error.options?.args);
			//logger.error(`BaseController: handleLLMError-errorDetails:`, errorDetails);

			const logEntryInteraction = this.logEntryInteraction(interaction.id);
			const agentInteractionId = interaction.id !== logEntryInteraction.id ? interaction.id : null;
			this.eventManager.emit(
				'projectEditor:conversationError',
				{
					conversationId: interaction.id,
					conversationTitle: interaction.title || '',
					agentInteractionId: agentInteractionId,
					timestamp: new Date().toISOString(),
					conversationStats: {
						statementCount: interaction.statementCount,
						statementTurnCount: interaction.statementTurnCount,
						conversationTurnCount: interaction.conversationTurnCount,
					},
					error: errorDetails.message,
					code: errorDetails.code,
					details: errorDetails.args || {},
				} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
			);
			return error;
		} else {
			// Always log the full error for debugging
			logger.error(`BaseController: LLM communication error:`, error);
			return createError(
				ErrorType.API,
				`Unknown error type: ${error.message}`,
				{
					model: interaction.model,
					//provider: this.llmProviderName,
					conversationId: interaction.id,
					args: {},
				} as LLMErrorOptions,
			);
		}
	}

	protected emitStatus(
		interactionId: ConversationId | null,
		status: ApiStatus,
		metadata?: { toolName?: string; error?: string },
	) {
		if (!interactionId) {
			logger.warn('BaseController: No interactionId set, cannot emit status');
			return;
		}
		const interaction = this.interactionManager.getInteractionStrict(interactionId);
		//this.currentStatus = status;
		this.statusSequence++;
		this.eventManager.emit('projectEditor:progressStatus', {
			type: 'progress_status',
			conversationId: interactionId,
			status,
			timestamp: new Date().toISOString(),
			statementCount: interaction.statementCount,
			sequence: this.statusSequence,
			metadata,
		});
		logger.warn(`BaseController: Emitted progress_status: ${status}`);
	}

	protected emitPromptCacheTimer(interactionId: ConversationId | null) {
		if (!interactionId) {
			logger.warn('BaseController: No interactionId set, cannot emit timer');
			return;
		}
		this.eventManager.emit('projectEditor:promptCacheTimer', {
			type: 'prompt_cache_timer',
			conversationId: interactionId,
			startTimestamp: Date.now(),
			duration: 300000, // 5 minutes in milliseconds
		});
		logger.warn(`BaseController: Emitted prompt_cache_timer`);
	}

	public get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	public logEntryInteraction(interactionId: ConversationId): LLMConversationInteraction {
		const logEntryInteraction = this.interactionManager.getParentInteraction(interactionId) ??
			this.interactionManager.getInteractionStrict(interactionId);
		return logEntryInteraction as LLMConversationInteraction;
	}

	public getAllStats(): { [key: string]: ConversationStats } {
		const allStats: { [key: string]: ConversationStats } = {};
		for (const [id, stats] of this.interactionStats) {
			allStats[id] = stats;
		}
		return allStats;
	}
	public getAllTokenUsage(): { [key: string]: TokenUsage } {
		const allTokenUsage: { [key: string]: TokenUsage } = {};
		for (const [id, usage] of this.interactionTokenUsage) {
			allTokenUsage[id] = usage;
		}
		return allTokenUsage;
	}

	protected updateStats(conversationId: ConversationId, interactionStats: ConversationStats): void {
		this.interactionStats.set(conversationId, interactionStats);
		this.updateTotalStats();
	}

	protected updateTotalStats(): void {
		// See '[TODO] Keep stats and counts simple'
		// this method is a no-op for now
		//
		// //this._providerRequestCount = 0;
		// this.statementTurnCount = 0;
		// this.conversationTurnCount = 0;
		// this.statementCount = 0;
		// //this._tokenUsageConversation = { totalTokens: 0, inputTokens: 0, outputTokens: 0 };
		//
		// for (const stats of this.interactionStats.values()) {
		// 	//this._providerRequestCount += stats.providerRequestCount;
		// 	this.statementTurnCount += stats.statementTurnCount;
		// 	this.conversationTurnCount += stats.conversationTurnCount;
		// 	this.statementCount += stats.statementCount;
		// }
		// //for (const usage of this.interactionTokenUsage.values()) {
		// //	this._tokenUsageConversation.totalTokens += usage.totalTokens;
		// //	this._tokenUsageConversation.inputTokens += usage.inputTokens;
		// //	this._tokenUsageConversation.outputTokens += usage.outputTokens;
		// //}
	}

	protected async loadInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction | null> {
		logger.info(`BaseController: Attempting to load existing conversation: ${conversationId}`);
		try {
			const persistence = await new ConversationPersistence(conversationId, this.projectEditor).init();

			const conversation = await persistence.loadConversation(this.llmProvider);
			if (!conversation) {
				logger.warn(`BaseController: No conversation found for ID: ${conversationId}`);
				return null;
			}
			logger.info(`BaseController: Loaded existing conversation: ${conversationId}`);

			//const metadata = await persistence.getMetadata();

			this.interactionManager.addInteraction(conversation);

			// //this._providerRequestCount = conversation.providerRequestCount;
			// this.statementTurnCount = conversation.conversationStats.statementTurnCount;
			// this.conversationTurnCount = conversation.conversationStats.conversationTurnCount;
			// this.statementCount = conversation.conversationStats.statementCount;
			// this.tokenUsageInteraction = conversation.tokenUsageInteraction;

			return conversation;
		} catch (error) {
			logger.warn(
				`BaseController: Failed to load conversation ${conversationId}: ${(error as Error).message}`,
			);
			logger.error(`BaseController: Error details:`, error);
			logger.debug(`BaseController: Stack trace:`, (error as Error).stack);
			return null;
		}
	}

	async createInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		logger.info(`BaseController: Creating new conversation: ${conversationId}`);
		const interaction = await this.interactionManager.createInteraction(
			'conversation',
			conversationId,
			this.llmProvider,
		);
		const systemPrompt = await this.promptManager.getPrompt('system', {
			userDefinedContent: 'You are an AI assistant helping with code and project management.',
			projectConfig: this.projectEditor.projectConfig,
			interaction,
		});
		interaction.baseSystem = systemPrompt;
		//logger.info(`BaseController: set system prompt for: ${typeof interaction}`, interaction.baseSystem);
		return interaction as LLMConversationInteraction;
	}

	async createChatInteraction(parentInteractionId: ConversationId, title: string): Promise<LLMChatInteraction> {
		const interactionId = shortenConversationId(generateConversationId());
		const chatInteraction = await this.interactionManager.createInteraction(
			'chat',
			interactionId,
			this.llmProvider,
			parentInteractionId,
		) as LLMChatInteraction;
		chatInteraction.title = title;
		return chatInteraction;
	}

	async saveInitialConversationWithResponse(
		interaction: LLMConversationInteraction,
		currentResponse: LLMSpeakWithResponse,
	): Promise<void> {
		try {
			const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();
			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (this.projectConfig.api?.environment === 'localdev') {
				const system = Array.isArray(currentResponse.messageMeta.system)
					? currentResponse.messageMeta.system[0].text
					: currentResponse.messageMeta.system;
				await persistence.dumpSystemPrompt(system);
				await persistence.dumpProjectInfo(this.projectEditor.projectInfo);
			}

			logger.info(`BaseController: Saved conversation: ${interaction.id}`);
		} catch (error) {
			logger.error(`BaseController: Error persisting the conversation:`, error);
			throw error;
		}
	}

	async saveConversationAfterStatement(
		interaction: LLMConversationInteraction,
		currentResponse: LLMSpeakWithResponse,
	): Promise<void> {
		try {
			const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();

			// Include the latest stats and usage in the saved conversation
			//interaction.conversationStats = this.interactionStats.get(interaction.id),
			//interaction.tokenUsageInteraction = this.interactionTokenUsage.get(interaction.id),

			// Include the latest requestParams in the saved conversation
			interaction.requestParams = currentResponse.messageMeta.requestParams;

			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (this.projectConfig.api?.environment === 'localdev') {
				const system = Array.isArray(currentResponse.messageMeta.system)
					? currentResponse.messageMeta.system[0].text
					: currentResponse.messageMeta.system;
				await persistence.dumpSystemPrompt(system);
				await persistence.dumpProjectInfo(this.projectEditor.projectInfo);
			}
		} catch (error) {
			logger.error(`BaseController: Error persisting the conversation:`, error);
			throw error;
		}
	}

	public async generateConversationTitle(statement: string, interactionId: string): Promise<string> {
		const chatInteraction = await this.createChatInteraction(interactionId, 'Create title for conversation');
		return generateConversationTitle(chatInteraction, statement);
	}

	protected async addToolsToInteraction(interaction: LLMConversationInteraction): Promise<void> {
		const tools = await this.toolManager.getAllTools();
		//logger.debug(`BaseController: Adding tools to interaction`, tools);
		interaction.addTools(tools);
	}

	protected extractThinkingContent(response: LLMProviderMessageResponse): string {
		if (!response.answerContent || !Array.isArray(response.answerContent)) {
			return '';
		}

		// Use the ThinkingExtractor utility for consistent extraction
		return extractThinkingFromContent(response.answerContent);
	}

	protected async handleToolUse(
		parentMessageId: string | null,
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_response: LLMProviderMessageResponse,
	): Promise<{ toolResponse: LLMToolRunToolResponse }> {
		logger.info(`BaseController: Handling tool use for: ${toolUse.toolName}`);
		//logger.info(`BaseController: Handling tool use for: ${toolUse.toolName}`, response);

		const logEntryInteraction = this.logEntryInteraction(interaction.id);
		const agentInteractionId = interaction.id !== logEntryInteraction.id ? interaction.id : null;
		await interaction.conversationLogger.logToolUse(
			interaction.getLastMessageId(),
			parentMessageId,
			agentInteractionId,
			toolUse.toolName,
			toolUse.toolInput,
			interaction.conversationStats,
			interaction.tokenUsageStats,
		);

		const {
			messageId,
			toolResults,
			toolResponse,
			bbResponse,
			isError,
		} = await this.toolManager.handleToolUse(
			parentMessageId,
			interaction,
			toolUse,
			this.projectEditor,
		);
		if (isError) {
			interaction.conversationLogger.logError(
				messageId,
				parentMessageId,
				agentInteractionId,
				`Tool Output (${toolUse.toolName}): ${toolResponse}`,
			);
		}

		await interaction.conversationLogger.logToolResult(
			messageId,
			parentMessageId,
			agentInteractionId,
			toolUse.toolName,
			toolResults,
			bbResponse,
		);

		return { toolResponse };
	}

	protected resetStatus(interactionId: ConversationId | null) {
		this.statusSequence = 0;
		this.emitStatus(interactionId, ApiStatus.IDLE);
	}

	protected getInteractionCallbacks(): LLMCallbacks {
		return {
			PROJECT_EDITOR: () => this.projectEditor,
			PROJECT_ID: () => this.projectEditor.projectId,
			//PROJECT_DATA_SOURCES: () => this.projectEditor.dsConnectionsForSystemPrompt,
			PROJECT_DATA_SOURCES: () => this.projectEditor.dsConnections,
			PROJECT_MCP_TOOLS: async () => await this.projectEditor.getMCPToolsForSystemPrompt(),
			PROJECT_INFO: () => this.projectEditor.projectInfo,
			PROJECT_CONFIG: () => this.projectEditor.projectConfig,
			PROJECT_RESOURCE_CONTENT: async (dsConnectionId: string, filePath: string): Promise<string | null> => {
				const dsConnection = this.projectEditor.dsConnection(dsConnectionId);
				if (!dsConnection) return null;
				return await readFileContent(dsConnection.getDataSourceRoot(), filePath);
			},
			// deno-lint-ignore require-await
			LOG_ENTRY_HANDLER: async (
				messageId: string,
				parentMessageId: string | null,
				parentInteractionId: ConversationId,
				agentInteractionId: ConversationId | null,
				timestamp: string,
				logEntry: ConversationLogEntry,
				conversationStats: ConversationStats,
				tokenUsageStats: TokenUsageStats,
				requestParams?: LLMRequestParams,
			): Promise<void> => {
				//logger.info(`BaseController: LOG_ENTRY_HANDLER-requestParams - ${logEntry.entryType}`, {tokenUsageStats, requestParams});
				const logEntryInteraction = this.logEntryInteraction(parentInteractionId || agentInteractionId || '');
				//logger.info(`BaseController: LOG_ENTRY_HANDLER - emit event - ${logEntry.entryType} for ${logEntryInteraction.id} ${logEntryInteraction.title}`);
				//const useParent = logEntryInteraction.id !== agentInteractionId;
				//logger.info(
				//	`BaseController: LOG_ENTRY_HANDLER - emit event - ${logEntry.entryType} using parent: ${
				//		useParent ? 'YES' : 'NO'
				//	} - this.id: ${agentInteractionId} - logEntry.id: ${logEntryInteraction.id}`,
				//);
				//if(useParent) logEntry.agentInteractionId = agentInteractionId!;
				if (logEntry.entryType === 'answer') {
					const statementAnswer: ConversationResponse = {
						timestamp,
						conversationId: logEntryInteraction.id,
						conversationTitle: logEntryInteraction.title,
						messageId,
						parentMessageId,
						agentInteractionId,
						logEntry,
						conversationStats,
						tokenUsageStats,
						requestParams,
					};
					this.eventManager.emit(
						'projectEditor:conversationAnswer',
						statementAnswer as EventPayloadMap['projectEditor']['projectEditor:conversationAnswer'],
					);
				} else {
					const conversationContinue: ConversationContinue = {
						timestamp,
						conversationId: logEntryInteraction.id,
						conversationTitle: logEntryInteraction.title,
						messageId,
						parentMessageId,
						agentInteractionId,
						logEntry,
						conversationStats,
						tokenUsageStats,
						requestParams,
					};
					this.eventManager.emit(
						'projectEditor:conversationContinue',
						conversationContinue as EventPayloadMap['projectEditor']['projectEditor:conversationContinue'],
					);
				}
			},
			PREPARE_SYSTEM_PROMPT: async (system: string, interactionId: string): Promise<string> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				return interaction ? await interaction.prepareSytemPrompt(system) : system;
			},
			PREPARE_MESSAGES: async (messages: LLMMessage[], interactionId: string): Promise<LLMMessage[]> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				return interaction ? await interaction.prepareMessages(messages) : messages;
			},
			PREPARE_TOOLS: async (tools: Map<string, LLMTool>, interactionId: string): Promise<LLMTool[]> => {
				const interaction = this.interactionManager.getInteraction(interactionId);
				//return interaction ? await interaction.prepareTools(tools) : tools;
				return await interaction?.prepareTools(tools) || [];
			},
			// [TODO] PREPARE_DATA_SOURCES
			// [TODO] PREPARE_RESOURCES
		};
	}

	cancelCurrentOperation(conversationId: ConversationId): void {
		logger.info(`BaseController: Cancelling operation for conversation: ${conversationId}`);
		this.isCancelled = true;
		// TODO: Implement cancellation of current LLM call if possible
		// This might involve using AbortController or similar mechanism
		// depending on how the LLM provider's API is implemented
	}

	/*
	private getConversationHistory(interaction: LLMConversationInteraction): ConversationLogDataEntry[] {
		const history = interaction.getMessageHistory();
		return history.map((message: LLMMessage) => ({
			type: message.role,
			timestamp: message.timestamp,
			content: message.content,
			conversationStats: message.conversationStats || {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0
			},
			tokenUsageTurn: message.tokenUsageTurn || {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			},
			tokenUsageStatement: message.tokenUsageStatement || {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			},
			tokenUsageConversation: message.tokenUsageConversation || {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0
			}
		}));
	}
	 */

	async logChangeAndCommit(
		interaction: LLMConversationInteraction,
		dataSourceRoot: string,
		filePath: string | string[],
		change: string | string[],
	): Promise<void> {
		const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();

		if (Array.isArray(filePath) && Array.isArray(change)) {
			if (filePath.length !== change.length) {
				throw new Error('filePath and change arrays must have the same length');
			}
			for (let i = 0; i < filePath.length; i++) {
				this.projectEditor.changedResources.add(filePath[i]);
				this.projectEditor.changeContents.set(filePath[i], change[i]);
				await persistence.logChange(filePath[i], change[i]);
			}
		} else if (typeof filePath === 'string' && typeof change === 'string') {
			this.projectEditor.changedResources.add(filePath);
			this.projectEditor.changeContents.set(filePath, change);
			await persistence.logChange(filePath, change);
		} else {
			throw new Error('filePath and change must both be strings or both be arrays');
		}

		if (dataSourceRoot) {
			await stageAndCommitAfterChanging(
				interaction,
				dataSourceRoot,
				this.projectEditor.changedResources,
				this.projectEditor.changeContents,
				this.projectEditor,
			);
		}

		this.projectEditor.changedResources.clear();
		this.projectEditor.changeContents.clear();
	}

	async deleteConversation(conversationId: ConversationId): Promise<void> {
		logger.info(`BaseController: Deleting conversation: ${conversationId}`);

		try {
			// Emit deletion event before cleanup
			this.eventManager.emit(
				'projectEditor:conversationDeleted',
				{
					conversationId,
					timestamp: new Date().toISOString(),
				} as EventPayloadMap['projectEditor']['projectEditor:conversationDeleted'],
			);

			// Clean up interaction
			this.interactionManager.removeInteraction(conversationId);

			// Clean up stats and usage tracking
			this.interactionStats.delete(conversationId);
			this.interactionTokenUsage.delete(conversationId);

			// Update total stats
			this.updateTotalStats();

			// Clean up persistence
			const persistence = await new ConversationPersistence(conversationId, this.projectEditor).init();
			await persistence.deleteConversation();

			logger.info(`BaseController: Successfully deleted conversation: ${conversationId}`);
		} catch (error) {
			logger.error(`BaseController: Error deleting conversation: ${conversationId}`, error);
			throw error;
		}
	}

	async revertLastChange(interaction: LLMConversationInteraction): Promise<void> {
		const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();
		const changeLog = await persistence.getChangeLog();

		if (changeLog.length === 0) {
			throw new Error('No changes to revert.');
		}

		const lastChange = changeLog[changeLog.length - 1];
		const { filePath, change } = lastChange;

		try {
			const currentContent = await Deno.readTextFile(filePath);

			// Create a reverse change
			const changeResult = diff.applyPatch(currentContent, change);
			if (typeof changeResult === 'boolean') {
				throw new Error('Failed to apply original change. Cannot create reverse change.');
			}
			const reverseChange = diff.createPatch(filePath, changeResult, currentContent);

			// Apply the reverse change
			const revertedContent = diff.applyPatch(currentContent, reverseChange);

			if (revertedContent === false) {
				throw new Error('Failed to revert change. The current file content may have changed.');
			}

			await Deno.writeTextFile(filePath, revertedContent);
			logger.info(`BaseController: Last change reverted for file: ${filePath}`);

			// Remove the last change from the log
			await persistence.removeLastChange();
		} catch (error) {
			logger.error(`Error reverting last change: ${(error as Error).message}`);
			throw error;
		}
	}
}

export default BaseController;
