import * as diff from 'diff';

// Hard-coded conversation token limit (192k to leave room for 8k response)
const CONVERSATION_TOKEN_LIMIT = 192000;
//const CONVERSATION_TOKEN_LIMIT = 64000;

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
import AgentController from './agentController.ts';
import PromptManager from '../prompts/promptManager.ts';
import EventManager from 'shared/eventManager.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { ErrorHandlingConfig, LLMProviderMessageResponse, Task } from 'api/types/llms.ts';
import type {
	ConversationContinue,
	ConversationEntry,
	ConversationId,
	ConversationLogEntry,
	//ConversationMetrics,
	ConversationResponse,
	ConversationStart,
	ConversationStats,
	ObjectivesData,
	TokenUsage,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
import { readProjectFileContent } from 'api/utils/fileHandling.ts';
import type { LLMCallbacks, LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import {
	generateConversationObjective,
	generateConversationTitle,
	generateStatementObjective,
} from '../utils/conversation.utils.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
//import { runFormatCommand } from '../utils/project.utils.ts';
import { stageAndCommitAfterChanging } from '../utils/git.utils.ts';
import { getVersionInfo } from 'shared/version.ts';

function getConversationObjective(objectives?: ObjectivesData): string | undefined {
	if (!objectives) return undefined;
	return objectives.conversation;
}

function getCurrentObjective(objectives?: ObjectivesData): string | undefined {
	if (!objectives) return undefined;
	if (!objectives.statement || objectives.statement.length === 0) return undefined;
	// Return the last statement objective as the current one
	return objectives.statement[objectives.statement.length - 1];
}

function formatToolObjectivesAndStats(
	interaction: LLMConversationInteraction,
	turnCount: number,
	maxTurns: number,
): string {
	const metrics = interaction.conversationMetrics;
	const parts = [`Turn ${turnCount}/${maxTurns}`];

	// Add objectives if set
	logger.debug('Raw objectives:', metrics.objectives);
	const conversationObjective = getConversationObjective(metrics.objectives);
	const currentObjective = getCurrentObjective(metrics.objectives);
	logger.debug('Extracted objectives:', { conversationObjective, currentObjective });

	// Add conversation objective if set
	if (conversationObjective) {
		parts.push(`Conversation Goal: ${conversationObjective}`);
	}

	// Add current objective if set
	if (currentObjective) {
		parts.push(`Current Objective: ${currentObjective}`);
	}

	// Add tool usage stats
	const toolStats = metrics.toolUsage?.toolStats;
	if (toolStats && toolStats.size > 0) {
		const toolUsage = Array.from(toolStats.entries())
			.map(([tool, stats]) => `${tool}(${stats.count}: ${stats.success}✓ ${stats.failure}✗)`).join(', ');
		parts.push(`Tools Used: ${toolUsage}`);
	}

	// Add resource stats if any were accessed
	if (metrics.resources && metrics.resources.accessed.size > 0) {
		const resourceStats =
			`Resources: ${metrics.resources.accessed.size} accessed, ${metrics.resources.modified.size} modified`;
		parts.push(resourceStats);
	}

	return parts.join('\n');
}

class OrchestratorController {
	private interactionStats: Map<ConversationId, ConversationStats> = new Map();
	//private interactionMetrics: Map<ConversationId, ConversationMetrics> = new Map();
	private interactionTokenUsage: Map<ConversationId, TokenUsage> = new Map();
	private isCancelled: boolean = false;
	//private currentStatus: ApiStatus = ApiStatus.IDLE;
	private statusSequence: number = 0;
	public interactionManager: InteractionManager;
	public primaryInteractionId: ConversationId | null = null;
	private agentControllers: Map<string, AgentController> = new Map();
	public projectConfig!: ProjectConfig;
	public promptManager!: PromptManager;
	public toolManager!: LLMToolManager;
	public llmProvider!: LLM;
	public eventManager!: EventManager;
	private projectEditorRef!: WeakRef<ProjectEditor>;
	//private _providerRequestCount: number = 0;

	// [TODO] Keep stats and counts simple
	// these counts and token usage are not including chat interactions
	// and currently we only have the primary interaction
	// so I'm disabling these properties and delegating to counts from primaryInteraction
	// when we have multiple interactions, we still probably don't need these since we can
	// grab counts from all interactions as needed.
	//
	// // counts across all interactions
	// // count of turns for most recent statement in most recent interaction
	// private _statementTurnCount: number = 0;
	// // count of turns for all statements across all interactions
	// private _conversationTurnCount: number = 0;
	// // count of statements across all interactions
	// private _statementCount: number = 0;
	// // usage across all interactions
	// protected _tokenUsageConversation: TokenUsage = {
	// 	totalTokens: 0,
	// 	inputTokens: 0,
	// 	outputTokens: 0,
	// };

	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
		this.interactionManager = interactionManager; //new InteractionManager();
	}

	async init(): Promise<OrchestratorController> {
		const configManager = await ConfigManagerV2.getInstance();
		const globalConfig = await configManager.getGlobalConfig();
		this.projectConfig = await configManager.getProjectConfig(this.projectEditor.projectId);
		this.toolManager = await new LLMToolManager(this.projectConfig, 'core').init(); // Assuming 'core' is the default toolset
		this.eventManager = EventManager.getInstance();
		this.promptManager = await new PromptManager().init(this.projectEditor.projectId);

		this.llmProvider = LLMFactory.getProvider(
			this.getInteractionCallbacks(),
			globalConfig.api.localMode ? LLMProviderEnum.ANTHROPIC : LLMProviderEnum.BB,
		);

		return this;
	}

	private handleLLMError(error: Error, interaction: LLMConversationInteraction): void {
		// Extract useful information from the error if it's our custom error type
		const errorDetails = error instanceof Error
			? {
				message: (error as Error).message,
				code: (error as Error).name === 'LLMError' ? 'LLM_ERROR' : 'UNKNOWN_ERROR',
				// Include any additional error properties if available
				details: (error as unknown as { details: unknown }).details || {},
			}
			: {
				message: String(error),
				code: 'UNKNOWN_ERROR',
			};

		this.eventManager.emit(
			'projectEditor:conversationError',
			{
				conversationId: interaction.id,
				conversationTitle: interaction.title || '',
				timestamp: new Date().toISOString(),
				conversationStats: {
					statementCount: this.statementCount,
					statementTurnCount: this.statementTurnCount,
					conversationTurnCount: this.conversationTurnCount,
				},
				error: errorDetails.message,
				code: errorDetails.code,
				details: errorDetails.details,
			} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
		);

		// Always log the full error for debugging
		logger.error(`OrchestratorController: LLM communication error:`, error);
	}

	private emitStatus(status: ApiStatus, metadata?: { toolName?: string; error?: string }) {
		if (!this.primaryInteractionId) {
			logger.warn('OrchestratorController: No primaryInteractionId set, cannot emit status');
			return;
		}
		//this.currentStatus = status;
		this.statusSequence++;
		this.eventManager.emit('projectEditor:progressStatus', {
			type: 'progress_status',
			conversationId: this.primaryInteractionId,
			status,
			timestamp: new Date().toISOString(),
			statementCount: this.statementCount,
			sequence: this.statusSequence,
			metadata,
		});
		logger.warn(`OrchestratorController: Emitted progress_status: ${status}`);
	}

	private emitPromptCacheTimer() {
		if (!this.primaryInteractionId) {
			logger.warn('OrchestratorController: No primaryInteractionId set, cannot emit timer');
			return;
		}
		this.eventManager.emit('projectEditor:promptCacheTimer', {
			type: 'prompt_cache_timer',
			conversationId: this.primaryInteractionId,
			startTimestamp: Date.now(),
			duration: 300000, // 5 minutes in milliseconds
		});
		logger.warn(`OrchestratorController: Emitted prompt_cache_timer`);
	}

	public get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	public get primaryInteraction(): LLMConversationInteraction {
		if (!this.primaryInteractionId) throw new Error('No primaryInteractionId set in orchestrator');
		const primaryInteraction = this.interactionManager.getInteraction(this.primaryInteractionId);
		if (!primaryInteraction) throw new Error('No primaryInteraction to get from interactionManager');
		return primaryInteraction as LLMConversationInteraction;
	}

	public get statementTurnCount(): number {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot get statementTurnCount.');
		}
		return primaryInteraction.statementTurnCount;
	}
	public set statementTurnCount(count: number) {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot set statementTurnCount.');
		}
		primaryInteraction.conversationTurnCount = count;
	}

	public get conversationTurnCount(): number {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot get conversationTurnCount.');
		}
		return primaryInteraction.conversationTurnCount;
	}
	public set conversationTurnCount(count: number) {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot set conversationTurnCount.');
		}
		primaryInteraction.conversationTurnCount = count;
	}

	public get statementCount(): number {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot get statementCount.');
		}
		return primaryInteraction.statementCount;
	}
	public set statementCount(count: number) {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot set statementCount.');
		}
		primaryInteraction.statementCount = count;
	}

	public get tokenUsageInteraction(): TokenUsage {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot get tokenUsageInteraction.');
		}
		return primaryInteraction.tokenUsageInteraction;
	}
	public set tokenUsageInteraction(tokenUsageInteraction: TokenUsage) {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot set tokenUsageInteraction.');
		}
		primaryInteraction.tokenUsageInteraction = tokenUsageInteraction;
	}

	public get inputTokensTotal(): number {
		return this.tokenUsageInteraction.inputTokens;
	}

	public get outputTokensTotal(): number {
		return this.tokenUsageInteraction.outputTokens;
	}

	public get totalTokensTotal(): number {
		return this.tokenUsageInteraction.totalTokens;
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

	private updateStats(conversationId: ConversationId, interactionStats: ConversationStats): void {
		this.interactionStats.set(conversationId, interactionStats);
		this.updateTotalStats();
	}

	private updateTotalStats(): void {
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

	async initializePrimaryInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		this.primaryInteractionId = conversationId;
		let interaction = await this.loadInteraction(conversationId);
		if (!interaction) {
			interaction = await this.createInteraction(conversationId);
		}
		// [TODO] `createInteraction` calls interactionManager.createInteraction which adds it to manager
		// so let `loadInteraction` handle interactionManager.addInteraction
		//this.interactionManager.addInteraction(interaction);
		await this.addToolsToInteraction(interaction);
		return interaction;
	}

	private async loadInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction | null> {
		logger.info(`OrchestratorController: Attempting to load existing conversation: ${conversationId}`);
		try {
			const persistence = await new ConversationPersistence(conversationId, this.projectEditor).init();

			const conversation = await persistence.loadConversation(this.llmProvider);
			if (!conversation) {
				logger.warn(`OrchestratorController: No conversation found for ID: ${conversationId}`);
				return null;
			}
			logger.info(`OrchestratorController: Loaded existing conversation: ${conversationId}`);

			//const metadata = await persistence.getMetadata();

			this.interactionManager.addInteraction(conversation);

			//this._providerRequestCount = conversation.providerRequestCount;
			this.statementTurnCount = conversation.conversationStats.statementTurnCount;
			this.conversationTurnCount = conversation.conversationStats.conversationTurnCount;
			this.statementCount = conversation.conversationStats.statementCount;
			this.tokenUsageInteraction = conversation.tokenUsageInteraction;

			return conversation;
		} catch (error) {
			logger.warn(
				`OrchestratorController: Failed to load conversation ${conversationId}: ${(error as Error).message}`,
			);
			logger.error(`OrchestratorController: Error details:`, error);
			logger.debug(`OrchestratorController: Stack trace:`, (error as Error).stack);
			return null;
		}
	}

	async createInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		logger.info(`OrchestratorController: Creating new conversation: ${conversationId}`);
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
		//logger.info(`OrchestratorController: set system prompt for: ${typeof interaction}`, interaction.baseSystem);
		return interaction as LLMConversationInteraction;
	}

	async createAgentInteraction(parentId: ConversationId, title: string): Promise<LLMConversationInteraction> {
		const interactionId = generateConversationId();
		const agentInteraction = await this.interactionManager.createInteraction(
			'conversation',
			interactionId,
			this.llmProvider,
			parentId,
		) as LLMConversationInteraction;
		agentInteraction.title = title;
		return agentInteraction;
	}
	async createChatInteraction(parentId: ConversationId, title: string): Promise<LLMChatInteraction> {
		const interactionId = generateConversationId();
		const chatInteraction = await this.interactionManager.createInteraction(
			'chat',
			interactionId,
			this.llmProvider,
			parentId,
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
			if (this.projectConfig.settings.api?.environment === 'localdev') {
				const system = Array.isArray(currentResponse.messageMeta.system)
					? currentResponse.messageMeta.system[0].text
					: currentResponse.messageMeta.system;
				await persistence.dumpSystemPrompt(system);
				await persistence.dumpProjectInfo(this.projectEditor.projectInfo);
			}

			logger.info(`OrchestratorController: Saved conversation: ${interaction.id}`);
		} catch (error) {
			logger.error(`OrchestratorController: Error persisting the conversation:`, error);
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

			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (this.projectConfig.settings.api?.environment === 'localdev') {
				const system = Array.isArray(currentResponse.messageMeta.system)
					? currentResponse.messageMeta.system[0].text
					: currentResponse.messageMeta.system;
				await persistence.dumpSystemPrompt(system);
				await persistence.dumpProjectInfo(this.projectEditor.projectInfo);
			}
		} catch (error) {
			logger.error(`OrchestratorController: Error persisting the conversation:`, error);
			throw error;
		}
	}

	createAgentController(): AgentController {
		if (!this.primaryInteractionId || !this.interactionManager.hasInteraction(this.primaryInteractionId)) {
			throw new Error('Primary interaction not initialized or not found');
		}
		const agentController = new AgentController(
			this.interactionManager,
			this.llmProvider,
			this.primaryInteractionId,
		);
		const agentInteractionId = agentController.getId();
		this.agentControllers.set(agentInteractionId, agentController);
		return agentController;
	}

	async manageAgentTasks(
		tasks: Task[],
		_sync: boolean = false,
		errorConfig: ErrorHandlingConfig = { strategy: 'fail_fast' },
	): Promise<void> {
		if (!this.primaryInteractionId || !this.interactionManager.hasInteraction(this.primaryInteractionId)) {
			throw new Error('Primary interaction not initialized or not found');
		}

		const results = await Promise.all(tasks.map(async (task) => {
			if (!this.primaryInteractionId) throw new Error('Primary interaction not initialized or not found');

			const agentInteraction = await this.createAgentInteraction(this.primaryInteractionId, task.title);
			if (!agentInteraction) {
				throw new Error(`Failed to create agent interaction for task: ${task.title}`);
			}

			try {
				//////     start an agent and run handleStatement
				/*
				const result = await this.delegateTasksTool.execute({
					tasks: [task],
					sync: true,
					errorConfig,
					parentInteractionId: agentInteractionId,
				});
				this.interactionManager.setInteractionResult(agentInteractionId, result);
				 */

				return { taskTitle: task.title, result: '', error: null };
			} catch (error) {
				logger.error(`OrchestratorController: Error executing task: ${task.title}`, error);
				return { taskTitle: task.title, result: null, error };
			}
		}));

		const errors = results.filter((r) => r.error);
		if (errors.length > 0) {
			if (errorConfig.strategy === 'fail_fast') {
				throw new Error(`Failed to execute tasks: ${errors.map((e) => e.taskTitle).join(', ')}`);
			} else if (
				errorConfig.strategy === 'continue_on_error' &&
				errors.length > (errorConfig.continueOnErrorThreshold || 0)
			) {
				throw new Error(`Too many tasks failed: ${errors.length} out of ${tasks.length}`);
			}
		}

		logger.info('OrchestratorController: Delegated tasks completed', { results });
	}

	private getInteractionCallbacks(): LLMCallbacks {
		return {
			PROJECT_EDITOR: () => this.projectEditor,
			PROJECT_ID: () => this.projectEditor.projectId,
			PROJECT_ROOT: () => this.projectEditor.projectRoot,
			PROJECT_INFO: () => this.projectEditor.projectInfo,
			PROJECT_CONFIG: () => this.projectEditor.projectConfig,
			PROJECT_FILE_CONTENT: async (filePath: string): Promise<string> =>
				await readProjectFileContent(this.projectEditor.projectRoot, filePath),
			LOG_ENTRY_HANDLER: async (
				timestamp: string,
				logEntry: ConversationLogEntry,
				conversationStats: ConversationStats,
				tokenUsageTurn: TokenUsage,
				tokenUsageStatement: TokenUsage,
				tokenUsageConversation: TokenUsage,
			): Promise<void> => {
				if (logEntry.entryType === 'answer') {
					const statementAnswer: ConversationResponse = {
						timestamp,
						conversationId: this.primaryInteraction.id,
						conversationTitle: this.primaryInteraction.title,
						logEntry,
						conversationStats,
						tokenUsageTurn,
						tokenUsageStatement,
						tokenUsageConversation,
					};
					this.eventManager.emit(
						'projectEditor:conversationAnswer',
						statementAnswer as EventPayloadMap['projectEditor']['projectEditor:conversationAnswer'],
					);
				} else {
					const conversationContinue: ConversationContinue = {
						timestamp,
						conversationId: this.primaryInteraction.id,
						conversationTitle: this.primaryInteraction.title,
						logEntry,
						conversationStats,
						tokenUsageTurn,
						tokenUsageStatement,
						tokenUsageConversation,
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
		};
	}

	cleanupAgentInteractions(parentId: ConversationId): void {
		const descendants = this.interactionManager.getAllDescendantInteractions(parentId);
		for (const descendant of descendants) {
			this.interactionManager.removeInteraction(descendant.id);
		}
	}

	public async generateConversationTitle(statement: string, interactionId: string): Promise<string> {
		const chatInteraction = await this.createChatInteraction(interactionId, 'Create title for conversation');
		return generateConversationTitle(chatInteraction, statement);
	}

	private async addToolsToInteraction(interaction: LLMConversationInteraction): Promise<void> {
		const tools = await this.toolManager.getAllTools();
		//logger.debug(`OrchestratorController: Adding tools to interaction`, tools);
		interaction.addTools(tools);
	}

	private extractThinkingContent(response: LLMProviderMessageResponse): string {
		if (!response.answerContent || !Array.isArray(response.answerContent)) {
			return '';
		}

		let thinkingContent = '';

		for (const part of response.answerContent) {
			if (typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
				const text = part.text;
				const thinkingMatch = text.match(/Thinking:(.*?)(?=(Human:|Assistant:|$))/s);
				if (thinkingMatch) {
					thinkingContent += thinkingMatch[1].trim() + '\n';
				} else {
					// If no specific 'Thinking:' section is found, consider the whole text as thinking content
					thinkingContent += text.trim() + '\n';
				}
			}
		}

		return thinkingContent.trim();
	}

	private async handleToolUse(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		_response: LLMProviderMessageResponse,
	): Promise<{ toolResponse: LLMToolRunToolResponse }> {
		logger.error(`OrchestratorController: Handling tool use for: ${toolUse.toolName}`);
		//logger.error(`OrchestratorController: Handling tool use for: ${toolUse.toolName}`, response);
		await interaction.conversationLogger.logToolUse(
			interaction.getLastMessageId(),
			toolUse.toolName,
			toolUse.toolInput,
			interaction.conversationStats,
			interaction.tokenUsageTurn,
			interaction.tokenUsageStatement,
			interaction.tokenUsageInteraction,
		);

		const {
			messageId,
			toolResults,
			toolResponse,
			bbResponse,
			isError,
		} = await this.toolManager.handleToolUse(
			interaction,
			toolUse,
			this.projectEditor,
		);
		if (isError) {
			interaction.conversationLogger.logError(messageId, `Tool Output (${toolUse.toolName}): ${toolResponse}`);
		}

		await interaction.conversationLogger.logToolResult(
			messageId,
			toolUse.toolName,
			toolResults,
			bbResponse,
		);

		return { toolResponse };
	}

	private resetStatus() {
		this.statusSequence = 0;
		this.emitStatus(ApiStatus.IDLE);
	}

	async handleStatement(
		statement: string,
		conversationId: ConversationId,
		options: { maxTurns?: number } = {},
	): Promise<ConversationResponse> {
		this.isCancelled = false;
		this.resetStatus();
		this.emitStatus(ApiStatus.API_BUSY);
		const interaction = this.interactionManager.getInteraction(conversationId) as LLMConversationInteraction;
		if (!interaction) {
			throw new Error(`No interaction found for ID: ${conversationId}`);
		}
		if (!statement) {
			this.eventManager.emit(
				'projectEditor:conversationError',
				{
					conversationId: interaction.id,
					conversationTitle: interaction.title || '',
					timestamp: new Date().toISOString(),
					conversationStats: {
						statementCount: this.statementCount,
						statementTurnCount: this.statementTurnCount,
						conversationTurnCount: this.conversationTurnCount,
					},
					error: 'Missing statement',
					code: 'EMPTY_PROMPT' as const,
				} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
			);
			throw new Error('Missing statement');
		}
		/*
		logger.info(
			`OrchestratorController: Starting handleStatement. Prompt: "${
				statement.substring(0, 50)
			}...", ConversationId: ${interaction.id}`,
		);
		 */

		if (!interaction.title) {
			interaction.title = await this.generateConversationTitle(statement, interaction.id);
			// Emit new conversation event after title is generated
			this.eventManager.emit(
				'projectEditor:conversationNew',
				{
					conversationId: interaction.id,
					conversationTitle: interaction.title,
					timestamp: new Date().toISOString(),
					tokenUsageConversation: this.tokenUsageInteraction,
					conversationStats: interaction.conversationStats,
				} as EventPayloadMap['projectEditor']['projectEditor:conversationNew'],
			);
		}

		// Get current conversation metrics to check objectives
		const currentMetrics = interaction.conversationMetrics;

		// Generate conversation objective if not set
		if (!currentMetrics.objectives?.conversation) {
			const conversationObjective = await generateConversationObjective(
				await this.createChatInteraction(interaction.id, 'Generate conversation objective'),
				statement,
			);
			interaction.setObjectives(conversationObjective);
			logger.debug('Set conversation objective:', conversationObjective);
		} else {
			// Only create statement objective on subsequent statements; not the first one
			// Generate statement objective with context from previous assistant response
			const previousAssistantMessage = interaction.getPreviousAssistantMessage();
			const previousResponse = previousAssistantMessage && Array.isArray(previousAssistantMessage.content) &&
					previousAssistantMessage.content.length > 0
				? (previousAssistantMessage.content[0] as { type: 'text'; text: string }).text
				: undefined;

			const previousObjectives = interaction.getObjectives().statement || [];
			const previousObjective = previousObjectives[previousObjectives.length - 1];
			logger.info('Previous objective:', previousObjective);

			const statementObjective = await generateStatementObjective(
				await this.createChatInteraction(interaction.id, 'Generate statement objective'),
				statement,
				currentMetrics.objectives?.conversation,
				previousResponse,
				previousObjective,
			);
			interaction.setObjectives(undefined, statementObjective);
			logger.debug('Set statement objective:', statementObjective);
		}

		await this.projectEditor.updateProjectInfo();

		// // handled by `converse` in interaction
		// this.statementTurnCount = 0;
		// this.conversationTurnCount++;
		// this.statementCount++;

		const versionInfo = await getVersionInfo();
		const conversationReady: ConversationStart & {
			conversationStats: ConversationStats;
			conversationHistory: ConversationEntry[];
		} = {
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			timestamp: new Date().toISOString(),
			conversationStats: {
				statementCount: this.statementCount,
				statementTurnCount: this.statementTurnCount,
				conversationTurnCount: this.conversationTurnCount,
			},
			tokenUsageConversation: this.tokenUsageInteraction,
			conversationHistory: [], //this.getConversationHistory(interaction),
			versionInfo,
		};
		this.eventManager.emit(
			'projectEditor:conversationReady',
			conversationReady as EventPayloadMap['projectEditor']['projectEditor:conversationReady'],
		);

		const speakOptions: LLMSpeakWithOptions = {
			//temperature: 0.7,
			//maxTokens: 1000,
		};

		let currentResponse: LLMSpeakWithResponse | null = null;
		const maxTurns = options.maxTurns ?? this.projectConfig.settings.api?.maxTurns ?? 25; // Maximum number of turns for the run loop

		try {
			logger.info(
				`OrchestratorController: Calling conversation.converse for turn ${this.statementTurnCount} with statement: "${
					statement.substring(0, 50)
				}..."`,
			);

			// START OF STATEMENT - REQUEST TO LLM
			this.emitStatus(ApiStatus.LLM_PROCESSING);
			this.emitPromptCacheTimer();

			currentResponse = await interaction.converse(statement, speakOptions);

			this.emitStatus(ApiStatus.API_BUSY);
			logger.info('OrchestratorController: Received response from LLM');
			//logger.debug('OrchestratorController: LLM Response:', currentResponse);

			// Update orchestrator's stats
			this.updateStats(interaction.id, interaction.conversationStats);
		} catch (error) {
			this.handleLLMError(error as Error, interaction);
			throw error;
		}

		// Save the conversation immediately after the first response
		logger.info(
			`OrchestratorController: Saving conversation at beginning of statement: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);
		await this.saveInitialConversationWithResponse(interaction, currentResponse);

		let loopTurnCount = 0;

		while (loopTurnCount < maxTurns && !this.isCancelled) {
			logger.warn(`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns}`);
			try {
				// Handle tool calls and collect toolResponse
				const toolResponses = [];
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					// Extract text and thinking content from the response
					const textContent = extractTextFromContent(currentResponse.messageResponse.answerContent);
					const thinkingContent = this.extractThinkingContent(currentResponse.messageResponse);
					logger.debug(
						`OrchestratorController: Text and Thinking content for tool use for turn ${this.statementTurnCount}:`,
						{ textContent, thinkingContent },
					);

					// Only log assistant message if tools are being used
					if (textContent) {
						const conversationStats: ConversationStats = interaction.conversationStats;

						interaction.conversationLogger.logAssistantMessage(
							interaction.getLastMessageId(),
							textContent,
							conversationStats,
							interaction.tokenUsageTurn,
							interaction.tokenUsageStatement,
							interaction.tokenUsageInteraction,
						);
					}

					for (const toolUse of currentResponse.messageResponse.toolsUsed) {
						logger.info('OrchestratorController: Handling tool', toolUse);
						try {
							this.emitStatus(ApiStatus.TOOL_HANDLING, { toolName: toolUse.toolName });

							// logToolUse is called in handleToolUse
							// logToolResult is called in handleToolUse
							const { toolResponse } = await this.handleToolUse(
								interaction,
								toolUse,
								currentResponse.messageResponse,
							);
							//bbResponses.push(bbResponse);
							toolResponses.push(toolResponse);
							// You can use textContent & thinkingContent here as needed, e.g., add it to a separate array or log it
						} catch (error) {
							logger.warn(
								`OrchestratorController: Error handling tool ${toolUse.toolName}: ${
									(error as Error).message
								}`,
							);
							toolResponses.push(`Error with ${toolUse.toolName}: ${(error as Error).message}`);
						}
					}
				}
				logger.warn(`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns} - handled all tools`);

				loopTurnCount++;

				// Check total token usage including cache operations
				const totalTurnTokens = interaction.tokenUsageTurn.totalTokens +
					(interaction.tokenUsageTurn.cacheCreationInputTokens ?? 0) +
					(interaction.tokenUsageTurn.cacheReadInputTokens ?? 0);
				if (totalTurnTokens > CONVERSATION_TOKEN_LIMIT) {
					logger.warn(
						`OrchestratorController: Turn token limit (${CONVERSATION_TOKEN_LIMIT}) exceeded. ` +
							`Current usage: ${totalTurnTokens} (direct: ${interaction.tokenUsageTurn.totalTokens}, ` +
							`cache creation: ${interaction.tokenUsageTurn.cacheCreationInputTokens}, ` +
							`cache read: ${interaction.tokenUsageTurn.cacheReadInputTokens}). Forcing conversation summary.`,
					);

					// Log auxiliary message about forced summary
					const timestamp = new Date().toISOString();
					await interaction.conversationLogger.logAuxiliaryMessage(
						`force-summary-${timestamp}`,
						{
							message:
								`BB automatically summarized the conversation due to turn token limit (${totalTurnTokens} tokens including cache operations > ${CONVERSATION_TOKEN_LIMIT})`,
							purpose: 'Token Limit Enforcement',
						},
					);

					// Manually construct tool use for conversation summary
					const toolUse: LLMAnswerToolUse = {
						toolName: 'conversation_summary',
						toolInput: {
							requestSource: 'tool',
							// Calculate maxTokensToKeep:
							// - Target keeping 75% of limit for conversation
							// - Ensure minimum of 1000 tokens (tool requirement)
							// - If limit is very low, warn but maintain minimum
							maxTokensToKeep: (() => {
								const targetTokens = Math.floor(CONVERSATION_TOKEN_LIMIT * 0.75);
								if (targetTokens < 1000) {
									logger.warn(
										`OrchestratorController: Conversation token limit (${CONVERSATION_TOKEN_LIMIT}) is very low. ` +
											`Using minimum of 1000 tokens for conversation summary.`,
									);
								}
								return Math.max(1000, targetTokens);
							})(),
							summaryLength: 'long',
						},
						toolUseId: `force-summary-${Date.now()}`,
						toolValidation: { validated: true, results: 'Tool input validation passed' },
					};

					// Handle the tool use directly without adding its response to toolResponses
					await this.handleToolUse(interaction, toolUse, currentResponse.messageResponse);

					// Only add summary note to toolResponses if there are already responses to process
					// This avoids triggering another loop iteration if LLM was done
					if (toolResponses.length > 0) {
						toolResponses.push(
							'\nNote: The conversation has been automatically summarized and truncated to stay within token limits. The summary has been added to the conversation history.',
						);
					}
				}

				// If there's tool toolResponse, send it back to the LLM
				if (toolResponses.length > 0) {
					try {
						await this.projectEditor.updateProjectInfo();

						statement = `Tool results feedback:\n${
							formatToolObjectivesAndStats(interaction, loopTurnCount, maxTurns)
						}\n${toolResponses.join('\n')}`;

						this.emitStatus(ApiStatus.LLM_PROCESSING);
						this.emitPromptCacheTimer();

						currentResponse = await interaction.relayToolResult(statement, speakOptions);

						this.emitStatus(ApiStatus.API_BUSY);
						//logger.info('OrchestratorController: tool response', currentResponse);
					} catch (error) {
						this.handleLLMError(error as Error, interaction);
						throw error; // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool toolResponse, exit the loop
					break;
				}
			} catch (error) {
				logger.error(
					`OrchestratorController: Error in conversation turn ${loopTurnCount}: ${(error as Error).message}`,
				);
				if (loopTurnCount === maxTurns - 1) {
					throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
				}
				// For non-fatal errors, log and continue to the next turn
				currentResponse = {
					messageResponse: {
						answerContent: [{
							type: 'text',
							text: `Error occurred: ${(error as Error).message}. Continuing conversation.`,
						}],
						answer: `Error occurred: ${(error as Error).message}. Continuing conversation.`,
					},
					messageMeta: {},
				} as LLMSpeakWithResponse;
			}
		}
		logger.warn(`OrchestratorController: LOOP: DONE turns ${loopTurnCount}`);

		//if (this.formatCommand) await runFormatCommand(this.projectRoot, this.formatCommand);

		if (this.isCancelled) {
			logger.warn('OrchestratorController: Operation was cancelled.');
		} else if (loopTurnCount >= maxTurns) {
			logger.warn(`OrchestratorController: Reached maximum number of turns (${maxTurns}) in conversation.`);
		}
		// handled by `relayToolResult` in interaction
		// this.statementTurnCount = loopTurnCount;
		// this.conversationTurnCount += loopTurnCount;

		// Final save of the entire conversation at the end of the loop
		logger.debug(
			`OrchestratorController: Saving conversation at end of statement: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);

		await this.saveConversationAfterStatement(interaction, currentResponse);

		logger.info(
			`OrchestratorController: Final save of conversation: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);

		// Extract full answer text
		const answer = currentResponse.messageResponse.answer; // this is the canonical answer
		//const answer = extractTextFromContent(currentResponse.messageResponse.answerContent);

		// Extract thinking content from answer using global regex
		let assistantThinking = '';
		const thinkingRegex = /<thinking>(.*?)<\/thinking>/gs;
		let match;
		while ((match = thinkingRegex.exec(answer)) !== null) {
			assistantThinking += match[1].trim() + '\n';
		}
		assistantThinking = assistantThinking.trim();

		//logger.info(`OrchestratorController: Extracted answer: ${answer}`);
		//logger.info(`OrchestratorController: Extracted assistantThinking: ${assistantThinking}`);

		const statementAnswer: ConversationResponse = {
			logEntry: { entryType: 'answer', content: answer, thinking: assistantThinking },
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			timestamp: new Date().toISOString(),
			conversationStats: {
				statementCount: this.statementCount,
				statementTurnCount: this.statementTurnCount,
				conversationTurnCount: this.conversationTurnCount,
			},
			tokenUsageTurn: this.primaryInteraction.tokenUsageTurn,
			tokenUsageStatement: this.primaryInteraction.tokenUsageStatement,
			tokenUsageConversation: this.primaryInteraction.tokenUsageInteraction,
		};

		interaction.conversationLogger.logAnswerMessage(
			interaction.getLastMessageId(),
			answer,
			statementAnswer.conversationStats,
			statementAnswer.tokenUsageTurn,
			statementAnswer.tokenUsageStatement,
			statementAnswer.tokenUsageConversation,
		);

		this.resetStatus();
		return statementAnswer;
	}

	cancelCurrentOperation(conversationId: ConversationId): void {
		logger.info(`OrchestratorController: Cancelling operation for conversation: ${conversationId}`);
		this.isCancelled = true;
		// TODO: Implement cancellation of current LLM call if possible
		// This might involve using AbortController or similar mechanism
		// depending on how the LLM provider's API is implemented
	}

	/*
	private getConversationHistory(interaction: LLMConversationInteraction): ConversationEntry[] {
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
		filePath: string | string[],
		change: string | string[],
	): Promise<void> {
		const persistence = await new ConversationPersistence(interaction.id, this.projectEditor).init();

		if (Array.isArray(filePath) && Array.isArray(change)) {
			if (filePath.length !== change.length) {
				throw new Error('filePath and change arrays must have the same length');
			}
			for (let i = 0; i < filePath.length; i++) {
				this.projectEditor.changedFiles.add(filePath[i]);
				this.projectEditor.changeContents.set(filePath[i], change[i]);
				await persistence.logChange(filePath[i], change[i]);
			}
		} else if (typeof filePath === 'string' && typeof change === 'string') {
			this.projectEditor.changedFiles.add(filePath);
			this.projectEditor.changeContents.set(filePath, change);
			await persistence.logChange(filePath, change);
		} else {
			throw new Error('filePath and change must both be strings or both be arrays');
		}

		const configManager = await ConfigManagerV2.getInstance();
		const projectConfig = await configManager.getProjectConfig(this.projectEditor.projectId);
		if (projectConfig.type === 'git') {
			await stageAndCommitAfterChanging(
				interaction,
				this.projectEditor.projectRoot,
				this.projectEditor.changedFiles,
				this.projectEditor.changeContents,
				this.projectEditor,
			);
		}

		this.projectEditor.changedFiles.clear();
		this.projectEditor.changeContents.clear();
	}

	async deleteConversation(conversationId: ConversationId): Promise<void> {
		logger.info(`OrchestratorController: Deleting conversation: ${conversationId}`);

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

			logger.info(`OrchestratorController: Successfully deleted conversation: ${conversationId}`);
		} catch (error) {
			logger.error(`OrchestratorController: Error deleting conversation: ${conversationId}`, error);
			throw error;
		}
	}

	async revertLastChange(): Promise<void> {
		const primaryInteraction = this.primaryInteraction;
		if (!primaryInteraction) {
			throw new Error('No active conversation. Cannot revert change.');
		}

		const persistence = await new ConversationPersistence(primaryInteraction.id, this.projectEditor).init();
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
			logger.info(`OrchestratorController: Last change reverted for file: ${filePath}`);

			// Remove the last change from the log
			await persistence.removeLastChange();
		} catch (error) {
			logger.error(`Error reverting last change: ${(error as Error).message}`);
			throw error;
		}
	}
}

export default OrchestratorController;
