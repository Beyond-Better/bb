import * as diff from 'diff';

import type InteractionManager from '../llms/interactions/interactionManager.ts';
import { interactionManager } from '../llms/interactions/interactionManager.ts';
import type ProjectEditor from '../editor/projectEditor.ts';
import type { ProjectInfo } from '../editor/projectEditor.ts';
import type LLM from '../llms/providers/baseLLM.ts';
import LLMFactory from '../llms/llmProvider.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolRunToolResponse } from 'api/llms/llmTool.ts';
import LLMToolManager from '../llms/llmToolManager.ts';
import type LLMConversationInteraction from '../llms/interactions/conversationInteraction.ts';
import type LLMChatInteraction from '../llms/interactions/chatInteraction.ts';
import AgentController from './agentController.ts';
import PromptManager from '../prompts/promptManager.ts';
import EventManager from 'shared/eventManager.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import type { ErrorHandlingConfig, LLMProviderMessageResponse, Task } from 'api/types/llms.ts';
import type {
	ConversationContinue,
	ConversationEntry,
	ConversationId,
	ConversationMetrics,
	ConversationResponse,
	ConversationStart,
	ConversationTokenUsage,
	ObjectivesData,
	TokenUsage,
} from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import { readProjectFileContent } from 'api/utils/fileHandling.ts';
import type { LLMCallbacks, LLMSpeakWithOptions, LLMSpeakWithResponse } from '../types.ts';
import type { ConversationLogEntry } from 'shared/types.ts';
import {
	generateConversationObjective,
	generateConversationTitle,
	generateStatementObjective,
} from '../utils/conversation.utils.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
//import { runFormatCommand } from '../utils/project.utils.ts';
import { stageAndCommitAfterChanging } from '../utils/git.utils.ts';
import type { FullConfigSchema } from 'shared/configManager.ts';

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
	const stats = interaction.getConversationStats();
	const parts = [`Turn ${turnCount}/${maxTurns}`];

	// Add objectives if set
	logger.debug('Raw objectives:', stats.objectives);
	const conversationObjective = getConversationObjective(stats.objectives);
	const currentObjective = getCurrentObjective(stats.objectives);
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
	const toolStats = stats.toolUsage?.toolStats;
	if (toolStats && toolStats.size > 0) {
		const toolUsage = Array.from(toolStats.entries())
			.map(([tool, stats]) => `${tool}(${stats.count}: ${stats.success}✓ ${stats.failure}✗)`).join(', ');
		parts.push(`Tools Used: ${toolUsage}`);
	}

	// Add resource stats if any were accessed
	if (stats.resources && stats.resources.accessed.size > 0) {
		const resourceStats =
			`Resources: ${stats.resources.accessed.size} accessed, ${stats.resources.modified.size} modified`;
		parts.push(resourceStats);
	}

	return parts.join('\n');
}

class OrchestratorController {
	private interactionStats: Map<ConversationId, ConversationMetrics> = new Map();
	private interactionTokenUsage: Map<ConversationId, ConversationTokenUsage> = new Map();
	private isCancelled: boolean = false;
	public interactionManager: InteractionManager;
	public primaryInteractionId: ConversationId | null = null;
	private agentControllers: Map<string, AgentController> = new Map();
	public fullConfig!: FullConfigSchema;
	public promptManager!: PromptManager;
	public toolManager!: LLMToolManager;
	public llmProvider: LLM;
	public eventManager!: EventManager;
	private projectEditorRef!: WeakRef<ProjectEditor>;
	//private _providerRequestCount: number = 0;
	// counts across all interactions
	// count of turns for most recent statement in most recent interaction
	private _statementTurnCount: number = 0;
	// count of turns for all statements across all interactions
	private _conversationTurnCount: number = 0;
	// count of statements across all interactions
	private _statementCount: number = 0;
	// usage across all interactions
	protected _tokenUsageTotals: ConversationTokenUsage = {
		totalTokensTotal: 0,
		inputTokensTotal: 0,
		outputTokensTotal: 0,
	};

	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
		this.interactionManager = interactionManager; //new InteractionManager();
		this.llmProvider = LLMFactory.getProvider(this.getInteractionCallbacks());
		this.fullConfig = this.projectEditor.fullConfig;
	}

	async init(): Promise<OrchestratorController> {
		this.toolManager = await new LLMToolManager(this.fullConfig, 'core').init(); // Assuming 'core' is the default toolset
		this.eventManager = EventManager.getInstance();
		this.promptManager = await new PromptManager().init(this.projectEditor.projectRoot);
		//this.fullConfig = await ConfigManager.fullConfig(this.projectEditor.projectRoot);

		return this;
	}

	get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	get primaryInteraction(): LLMConversationInteraction {
		if (!this.primaryInteractionId) throw new Error('No primaryInteractionId set in orchestrator');
		const primaryInteraction = this.interactionManager.getInteraction(this.primaryInteractionId);
		if (!primaryInteraction) throw new Error('No primaryInteraction to get from interactionManager');
		return primaryInteraction as LLMConversationInteraction;
	}
	get statementTurnCount(): number {
		return this._statementTurnCount;
	}
	set statementTurnCount(count: number) {
		this._statementTurnCount = count;
	}
	get conversationTurnCount(): number {
		return this._conversationTurnCount;
	}
	set conversationTurnCount(count: number) {
		this._conversationTurnCount = count;
	}
	get statementCount(): number {
		return this._statementCount;
	}
	set statementCount(count: number) {
		this._statementCount = count;
	}

	public get inputTokensTotal(): number {
		return this._tokenUsageTotals.inputTokensTotal;
	}

	public outputTokensTotal(): number {
		return this._tokenUsageTotals.outputTokensTotal;
	}

	public get totalTokensTotal(): number {
		return this._tokenUsageTotals.totalTokensTotal;
	}

	public getAllStats(): { [key: string]: ConversationMetrics } {
		const allStats: { [key: string]: ConversationMetrics } = {};
		for (const [id, stats] of this.interactionStats) {
			allStats[id] = stats;
		}
		return allStats;
	}
	public getAllTokenUsage(): { [key: string]: ConversationTokenUsage } {
		const allTokenUsage: { [key: string]: ConversationTokenUsage } = {};
		for (const [id, usage] of this.interactionTokenUsage) {
			allTokenUsage[id] = usage;
		}
		return allTokenUsage;
	}

	public get tokenUsageTotals(): ConversationTokenUsage {
		return this._tokenUsageTotals;
	}

	/*
	updateUsageTotals(tokenUsage: TokenUsage): void {
		this._tokenUsageTotals.totalTokensTotal += tokenUsage.totalTokens;
		this._tokenUsageTotals.inputTokensTotal += tokenUsage.inputTokens;
		this._tokenUsageTotals.outputTokensTotal += tokenUsage.outputTokens;
	}
 */

	private updateStats(conversationId: ConversationId, interactionStats: ConversationMetrics): void {
		this.interactionStats.set(conversationId, interactionStats);
		this.updateTotalStats();
	}

	private updateTotalStats(): void {
		//this._providerRequestCount = 0;
		this._statementTurnCount = 0;
		this._conversationTurnCount = 0;
		this._statementCount = 0;
		//this._tokenUsageTotals = { totalTokensTotal: 0, inputTokensTotal: 0, outputTokensTotal: 0 };

		for (const stats of this.interactionStats.values()) {
			//this._providerRequestCount += stats.providerRequestCount;
			this._statementTurnCount += stats.statementTurnCount;
			this._conversationTurnCount += stats.conversationTurnCount;
			this._statementCount += stats.statementCount;
		}
		//for (const usage of this.interactionTokenUsage.values()) {
		//	this._tokenUsageTotals.totalTokensTotal += usage.totalTokensTotal;
		//	this._tokenUsageTotals.inputTokensTotal += usage.inputTokensTotal;
		//	this._tokenUsageTotals.outputTokensTotal += usage.outputTokensTotal;
		//}
	}

	async initializePrimaryInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
		let interaction = await this.loadInteraction(conversationId);
		if (!interaction) {
			interaction = await this.createInteraction(conversationId);
		}
		this.primaryInteractionId = conversationId;
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

			//this._providerRequestCount = conversation.providerRequestCount;
			this._statementTurnCount = conversation.conversationStats.statementTurnCount;
			this._conversationTurnCount = conversation.conversationStats.conversationTurnCount;
			this._statementCount = conversation.conversationStats.statementCount;
			this._tokenUsageTotals = conversation.tokenUsageConversation;

			this.interactionManager.addInteraction(conversation);

			return conversation;
		} catch (error) {
			logger.warn(`OrchestratorController: Failed to load conversation ${conversationId}: ${error.message}`);
			logger.error(`OrchestratorController: Error details:`, error);
			logger.debug(`OrchestratorController: Stack trace:`, error.stack);
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
			fullConfig: this.projectEditor.fullConfig,
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
			if (this.fullConfig.api?.environment === 'localdev') {
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
			//interaction.tokenUsageConversation = this.interactionTokenUsage.get(interaction.id),

			await persistence.saveConversation(interaction);

			// Save system prompt and project info if running in local development
			if (this.fullConfig.api?.environment === 'localdev') {
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
			PROJECT_ROOT: () => this.projectEditor.projectRoot,
			PROJECT_INFO: () => this.projectEditor.projectInfo,
			PROJECT_CONFIG: () => this.projectEditor.fullConfig,
			PROJECT_FILE_CONTENT: async (filePath: string): Promise<string> =>
				await readProjectFileContent(this.projectEditor.projectRoot, filePath),
			LOG_ENTRY_HANDLER: async (
				timestamp: string,
				logEntry: ConversationLogEntry,
				conversationStats: ConversationMetrics,
				tokenUsageTurn: TokenUsage,
				tokenUsageStatement: TokenUsage,
				tokenUsageConversation: ConversationTokenUsage,
			): Promise<void> => {
				if (logEntry.entryType === 'answer') {
					const statementAnswer: ConversationResponse = {
						timestamp,
						conversationId: this.primaryInteraction.id,
						conversationTitle: this.primaryInteraction.title,
						logEntry,
						conversationStats,
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
		response: LLMProviderMessageResponse,
	): Promise<{ toolResponse: LLMToolRunToolResponse; thinkingContent: string }> {
		logger.error(`OrchestratorController: Handling tool use for: ${toolUse.toolName}`);
		//logger.error(`OrchestratorController: Handling tool use for: ${toolUse.toolName}`, response);
		await interaction.conversationLogger.logToolUse(
			interaction.getLastMessageId(),
			toolUse.toolName,
			toolUse.toolInput,
			interaction.conversationStats,
			interaction.tokenUsageTurn,
			interaction.tokenUsageStatement,
			interaction.tokenUsageConversation,
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

		// Extract thinking content from the response
		const thinkingContent = this.extractThinkingContent(response);
		//logger.error(`OrchestratorController: Extracted thinking for tool: ${toolUse.toolName}`, thinkingContent);

		return { toolResponse, thinkingContent };
	}

	async handleStatement(
		statement: string,
		conversationId: ConversationId,
		options: { maxTurns?: number } = {},
	): Promise<ConversationResponse> {
		this.isCancelled = false;
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
		}

		// Get current conversation stats to check objectives
		const currentStats = interaction.getConversationStats();

		// Generate conversation objective if not set
		if (!currentStats.objectives?.conversation) {
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
			const previousResponse =
				previousAssistantMessage && Array.isArray(previousAssistantMessage.content) &&
					previousAssistantMessage.content.length > 0
					? (previousAssistantMessage.content[0] as { type: 'text'; text: string }).text
					: undefined;

			const previousObjectives = interaction.getObjectives().statement || [];
			const previousObjective = previousObjectives[previousObjectives.length - 1];
			logger.info('Previous objective:', previousObjective);

			const statementObjective = await generateStatementObjective(
				await this.createChatInteraction(interaction.id, 'Generate statement objective'),
				statement,
				currentStats.objectives?.conversation,
				previousResponse,
				previousObjective,
			);
			interaction.setObjectives(undefined, statementObjective);
			logger.debug('Set statement objective:', statementObjective);
		}

		await this.projectEditor.updateProjectInfo();

		this._statementTurnCount = 0;
		this._conversationTurnCount++;
		this._statementCount++;

		const conversationReady: ConversationStart & {
			conversationStats: ConversationMetrics;
			conversationHistory: ConversationEntry[];
		} = {
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			timestamp: new Date().toISOString(),
			conversationStats: {
				statementCount: this._statementCount,
				statementTurnCount: this._statementTurnCount,
				conversationTurnCount: this._conversationTurnCount,
			},
			tokenUsageConversation: this.tokenUsageTotals,
			conversationHistory: [], //this.getConversationHistory(interaction),
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
		const maxTurns = options.maxTurns ?? this.fullConfig.api.maxTurns ?? 25; // Maximum number of turns for the run loop

		try {
			logger.info(
				`OrchestratorController: Calling conversation.converse for turn ${this._statementTurnCount} with statement: "${
					statement.substring(0, 50)
				}..."`,
			);

			currentResponse = await interaction.converse(statement, speakOptions);
			logger.info('OrchestratorController: Received response from LLM');
			//logger.debug('OrchestratorController: LLM Response:', currentResponse);

			// Update orchestrator's stats
			this.updateStats(interaction.id, interaction.getConversationStats());
		} catch (error) {
			logger.error(`OrchestratorController: Error in LLM communication:`, error);
			throw error;
		}

		// Save the conversation immediately after the first response
		logger.info(
			`OrchestratorController: Saving conversation at beginning of statement: ${interaction.id}[${this._statementCount}][${this._statementTurnCount}]`,
		);
		await this.saveInitialConversationWithResponse(interaction, currentResponse);

		let loopTurnCount = 0;

		while (loopTurnCount < maxTurns && !this.isCancelled) {
			logger.warn(`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns}`);
			try {
				// Handle tool calls and collect toolResponse
				const toolResponses = [];
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					for (const toolUse of currentResponse.messageResponse.toolsUsed) {
						logger.info('OrchestratorController: Handling tool', toolUse);
						try {
							const { toolResponse, thinkingContent } = await this.handleToolUse(
								interaction,
								toolUse,
								currentResponse.messageResponse,
							);
							//bbResponses.push(bbResponse);
							toolResponses.push(toolResponse);
							logger.debug(
								`OrchestratorController: Thinking content for ${toolUse.toolName}:`,
								thinkingContent,
							);
							// You can use thinkingContent here as needed, e.g., add it to a separate array or log it
						} catch (error) {
							logger.warn(
								`OrchestratorController: Error handling tool ${toolUse.toolName}: ${error.message}`,
							);
							toolResponses.push(`Error with ${toolUse.toolName}: ${error.message}`);
						}
					}
				}
				logger.warn(`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns} - handled all tools`);

				loopTurnCount++;

				// If there's tool toolResponse, send it back to the LLM
				if (toolResponses.length > 0) {
					try {
						await this.projectEditor.updateProjectInfo();

						statement = `Tool results feedback:\n${
							formatToolObjectivesAndStats(interaction, loopTurnCount, maxTurns)
						}\n${toolResponses.join('\n')}`;

						currentResponse = await interaction.speakWithLLM(statement, speakOptions);
						//logger.info('OrchestratorController: tool response', currentResponse);
					} catch (error) {
						logger.error(`OrchestratorController: Error in LLM communication: ${error.message}`);
						throw error; // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool toolResponse, exit the loop
					break;
				}
			} catch (error) {
				logger.error(`OrchestratorController: Error in conversation turn ${loopTurnCount}: ${error.message}`);
				if (loopTurnCount === maxTurns - 1) {
					throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
				}
				// For non-fatal errors, log and continue to the next turn
				currentResponse = {
					messageResponse: {
						answerContent: [{
							type: 'text',
							text: `Error occurred: ${error.message}. Continuing conversation.`,
						}],
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
		this._statementTurnCount = loopTurnCount;
		this._conversationTurnCount += loopTurnCount;

		// Final save of the entire conversation at the end of the loop
		logger.info(
			`OrchestratorController: Saving conversation at end of statement: ${interaction.id}[${this._statementCount}][${this._statementTurnCount}]`,
		);
		await this.saveConversationAfterStatement(interaction, currentResponse);
		logger.info(
			`OrchestratorController: Final save of conversation: ${interaction.id}[${this._statementCount}][${this._statementTurnCount}]`,
		);
		logger.info(
			`OrchestratorController: Final save of conversation: ${interaction.id}[${this._statementCount}][${this._statementTurnCount}]`,
		);

		/*
		const getConversationStats = (interaction: LLMConversationInteraction) => ({
			conversationId: interaction.id || '',
			conversationTitle: interaction.title || '',
			conversationStats: {
				statementCount: this._statementCount,
				statementTurnCount: this._statementTurnCount,
				conversationTurnCount: this._conversationTurnCount,
			},
			tokenUsageConversation : currentResponse.messageResponse.usage || this.tokenUsageTotals,
		});
		 */

		let answer = '';
		let assistantThinking = '';

		// if (
		// 	currentResponse.messageResponse.answerContent &&
		// 	Array.isArray(currentResponse.messageResponse.answerContent)
		// ) {
		for (const part of currentResponse.messageResponse.answerContent) {
			if (typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
				const text = part.text;
				answer += text.trim() + '\n';
				const thinkingMatch = text.match(/<thinking>(.*?)<\/thinking>/s);
				if (thinkingMatch) {
					assistantThinking += thinkingMatch[1].trim() + '\n';
				}
			}
		}
		// }

		answer = answer.trim();
		assistantThinking = assistantThinking.trim();

		//logger.info(`OrchestratorController: Extracted answer: ${answer}`);
		//logger.info(`OrchestratorController: Extracted assistantThinking: ${assistantThinking}`);

		const statementAnswer: ConversationResponse = {
			logEntry: { entryType: 'answer', content: answer, thinking: assistantThinking },
			conversationId: interaction.id,
			conversationTitle: interaction.title,
			timestamp: new Date().toISOString(),
			conversationStats: {
				statementCount: this._statementCount,
				statementTurnCount: this._statementTurnCount,
				conversationTurnCount: this._conversationTurnCount,
			},
			tokenUsageStatement: currentResponse.messageResponse.usage || {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
			tokenUsageConversation: this.tokenUsageTotals,
		};

		interaction.conversationLogger.logAnswerMessage(
			interaction.getLastMessageId(),
			answer,
			statementAnswer.conversationStats,
			statementAnswer.tokenUsageStatement,
			this.tokenUsageTotals,
		);

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
				inputTokensTotal: 0,
				outputTokensTotal: 0,
				totalTokensTotal: 0
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

		if (this.projectEditor.fullConfig.project.type === 'git') {
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
			logger.error(`Error reverting last change: ${error.message}`);
			throw error;
		}
	}
}

export default OrchestratorController;
