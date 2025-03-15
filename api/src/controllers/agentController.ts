//import type InteractionManager from 'api/llms/interactionManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
//import type LLM from '../llms/providers/baseLLM.ts';
import type { ConversationId } from 'shared/types.ts';
import type { CompletedTask, Task } from 'api/types/llms.ts';
import type { ErrorHandler } from '../llms/errorHandler.ts';
import { isLLMError } from 'api/errors/error.ts';
import { ApiStatus } from 'shared/types.ts';
import type {
	ConversationStats,
	//ObjectivesData,
} from 'shared/types.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { extractTextFromContent, extractThinkingFromContent } from 'api/utils/llms.ts';

import BaseController from './baseController.ts';
import type OrchestratorController from 'api/controllers/orchestratorController.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import { logger } from 'shared/logger.ts';

// Hard-coded conversation token limit (192k to leave room for 8k response)
const CONVERSATION_TOKEN_LIMIT = 192000;
//const CONVERSATION_TOKEN_LIMIT = 64000;

function formatToolObjectivesAndStats(
	interaction: LLMConversationInteraction,
	turnCount: number,
	maxTurns: number,
): string {
	const metrics = interaction.conversationMetrics;
	const parts = [`Turn ${turnCount}/${maxTurns}`];

	/*
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
 */

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

class AgentController extends BaseController {
	//private agentInteractionId: ConversationId;
	private orchestratorInteractionId: ConversationId;
	//private assignedTasks: any[] = []; // Replace 'any' with appropriate task type

	constructor(
		projectEditor: ProjectEditor & { projectInfo: ProjectInfo },
		orchestratorInteractionId: ConversationId,
	) {
		super(projectEditor);
		this.primaryInteractionId = generateConversationId();
		this.orchestratorInteractionId = orchestratorInteractionId;
	}

	override async init(): Promise<AgentController> {
		await super.init();
		return this;
	}

	//getId(): string {
	//	return this.agentInteractionId;
	//}

	//async initializeInteraction(): Promise<LLMConversationInteraction> {
	//	const interactionId = generateConversationId();
	//	const interaction = await this.interactionManager.createInteraction(
	//		'conversation',
	//		interactionId,
	//		this.llmProvider,
	//		this.orchestratorInteractionId,
	//	) as LLMConversationInteraction;
	//	return interaction;
	//}

	async createAgentInteraction(title: string): Promise<LLMConversationInteraction> {
		logger.info('AgentController: createAgentInteraction - creating interaction for: ', this.primaryInteractionId);
		const agentInteraction = await this.interactionManager.createInteraction(
			'conversation',
			this.primaryInteractionId!,
			this.llmProvider,
			this.orchestratorInteractionId,
		) as LLMConversationInteraction;
		agentInteraction.title = title;
		//this.primaryInteractionId = this.orchestratorInteractionId;
		logger.info('AgentController: createAgentInteraction - created interaction for: ', agentInteraction.id);
		logger.info(
			'AgentController: createAgentInteraction - interaction has llm for: ',
			agentInteraction.llm.llmProviderName,
		);

		const systemPrompt = await this.promptManager.getPrompt('system_task', {
			userDefinedContent: 'You are a sub-agent for an AI assistant helping with code and project management.',
			projectConfig: this.projectEditor.projectConfig,
			interaction: agentInteraction,
		});
		agentInteraction.baseSystem = systemPrompt;
		//logger.info(`BaseController: set system prompt for: ${typeof interaction}`, interaction.baseSystem);

		await this.addToolsToInteraction(agentInteraction);

		return agentInteraction;
	}

	protected override async addToolsToInteraction(interaction: LLMConversationInteraction): Promise<void> {
		const tools = await this.toolManager.getAllTools();
		//logger.debug(`AgentController: Adding tools to interaction`, tools);
		logger.debug(`AgentController: Removing delegate_tasks tool`);
		interaction.addTools(tools.filter((tool) => tool.name !== 'delegate_tasks'));
	}

	// deno-lint-ignore require-await
	async reportToOrchestrator(): Promise<unknown> { // Replace 'any' with appropriate return type
		// Implement reporting logic here
		return null;
	}

	public async executeSyncTasks(
		orchestratorController: OrchestratorController,
		tasks: Task[],
		errorHandler: ErrorHandler,
	): Promise<Array<CompletedTask>> {
		const completedTasks: CompletedTask[] = [];
		//logger.info('AgentController: executeSyncTasks ', { tasks });

		for (const task of tasks) {
			try {
				completedTasks.push(await this.executeTask(orchestratorController, task, errorHandler));
			} catch (error) {
				throw error;
			}
		}

		return completedTasks;
	}

	public async executeAsyncTasks(
		orchestratorController: OrchestratorController,
		tasks: Task[],
		errorHandler: ErrorHandler,
	): Promise<Array<CompletedTask>> {
		let completedTasks: CompletedTask[] = [];
		logger.info('AgentController: executeSyncTasks ', { tasks });
		//tasks.forEach((task) => this.taskQueue.addTask(task));
		try {
			completedTasks = await Promise.all(
				tasks.map((task) => this.executeTask(orchestratorController, task, errorHandler)),
			);
		} catch (error) {
			throw error;
		}
		return completedTasks;
	}

	private async executeTask(
		orchestratorController: OrchestratorController,
		task: Task,
		errorHandler: ErrorHandler,
	): Promise<CompletedTask> {
		logger.info('AgentController: executeTask ', { task });

		const interaction = await this.createAgentInteraction(task.title);
		if (!interaction) {
			throw new Error(`No agent interaction created for parent ID: ${this.orchestratorInteractionId}`);
		}
		logger.info('AgentController: executeTask - created interaction', interaction.id);

		let completedTask: CompletedTask;
		try {
			completedTask = await this.handleTask(orchestratorController, task, {
				maxTurns: 10,
				model: orchestratorController!.projectConfig?.defaultModels?.agent,
			});
		} catch (error) {
			const completedError = await errorHandler!.handleError(error as Error, task, 0);
			completedTask = { title: task.title, status: 'failed', error: completedError.message };
		}
		logger.info('AgentController: completedTask ', { completedTask });
		return completedTask;
	}

	async handleTask(
		_orchestratorController: OrchestratorController,
		task: Task,
		options: { maxTurns?: number; model?: string } = {},
	): Promise<CompletedTask> {
		this.isCancelled = false;
		this.resetStatus();

		if (!this.primaryInteractionId) {
			throw new Error(`Primary Interaction Id is not set`);
		}

		this.emitStatus(ApiStatus.API_BUSY);

		const interaction = this.interactionManager.getInteraction(
			this.primaryInteractionId,
		) as LLMConversationInteraction;
		if (!interaction) {
			throw new Error(`No interaction found for ID: ${this.primaryInteractionId}`);
		}

		logger.info('AgentController: handleTask ', task.title);

		if (!task.instructions) {
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
					error: 'Missing instructions',
					code: 'EMPTY_PROMPT' as const,
				} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
			);
			throw new Error('Missing instructions');
		}

		const statement = `Instructions:\n${task.instructions}\n\nResponse format:\n${task.requirements}`;

		/*
		try {
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
		} catch (error) {
			logger.info('AgentController: Received error from LLM chat: ', error);
			throw this.handleLLMError(error as Error, interaction);
		}
		 */

		const speakOptions: LLMSpeakWithOptions = {
			//temperature: 0.7,
			//maxTokens: 1000,
		};

		let currentResponse: LLMSpeakWithResponse | null = null;
		const maxTurns = options.maxTurns ?? this.projectConfig.settings.api?.maxTurns ?? 25; // Maximum number of turns for the run loop

		try {
			logger.info(
				`AgentController: Calling conversation.converse for turn ${this.statementTurnCount} with statement: "${
					statement.substring(0, 50)
				}..."`,
			);

			// START OF STATEMENT - REQUEST TO LLM
			this.emitStatus(ApiStatus.LLM_PROCESSING);
			this.emitPromptCacheTimer();

			currentResponse = await interaction.converse(statement, speakOptions);

			this.emitStatus(ApiStatus.API_BUSY);
			logger.info('AgentController: Received response from LLM');
			//logger.debug('AgentController: LLM Response:', currentResponse);

			// Update orchestrator's stats
			this.updateStats(interaction.id, interaction.conversationStats);
		} catch (error) {
			logger.info('AgentController: Received error from LLM converse: ', error);
			throw this.handleLLMError(error as Error, interaction);
		}

		// Save the conversation immediately after the first response
		logger.info(
			`AgentController: Saving conversation at beginning of statement: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);
		await this.saveInitialConversationWithResponse(interaction, currentResponse);

		let loopTurnCount = 0;

		//while (loopTurnCount < maxTurns && !this.isCancelled) {
		while (loopTurnCount < 1 && !this.isCancelled) {
			logger.warn(`AgentController: LOOP: turns ${loopTurnCount}/${maxTurns}`);
			try {
				// Handle tool calls and collect toolResponse
				const toolResponses = [];
				if (currentResponse.messageResponse.toolsUsed && currentResponse.messageResponse.toolsUsed.length > 0) {
					// Extract text and thinking content from the response
					const textContent = extractTextFromContent(currentResponse.messageResponse.answerContent);
					const thinkingContent = this.extractThinkingContent(currentResponse.messageResponse);
					logger.debug(
						`AgentController: Text and Thinking content for tool use for turn ${this.statementTurnCount}:`,
						{ textContent, thinkingContent },
					);

					// Only log assistant message if tools are being used
					if (textContent) {
						const conversationStats: ConversationStats = interaction.conversationStats;

						interaction.conversationLogger.logAssistantMessage(
							interaction.getLastMessageId(),
							textContent,
							thinkingContent,
							conversationStats,
							{
								tokenUsageTurn: interaction.tokenUsageTurn,
								tokenUsageStatement: interaction.tokenUsageStatement,
								tokenUsageConversation: interaction.tokenUsageInteraction,
							},
						);
					}

					for (const toolUse of currentResponse.messageResponse.toolsUsed) {
						logger.info('AgentController: Handling tool', toolUse);
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
								`AgentController: Error handling tool ${toolUse.toolName}: ${(error as Error).message}`,
							);
							toolResponses.push(`Error with ${toolUse.toolName}: ${(error as Error).message}`);
						}
					}
				}
				logger.warn(`AgentController: LOOP: turns ${loopTurnCount}/${maxTurns} - handled all tools`);

				loopTurnCount++;

				// Check total token usage including cache operations
				const totalTurnTokens = interaction.tokenUsageTurn.totalTokens +
					(interaction.tokenUsageTurn.cacheCreationInputTokens ?? 0) +
					(interaction.tokenUsageTurn.cacheReadInputTokens ?? 0);
				if (totalTurnTokens > CONVERSATION_TOKEN_LIMIT) {
					logger.warn(
						`AgentController: Turn token limit (${CONVERSATION_TOKEN_LIMIT}) exceeded. ` +
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
										`AgentController: Conversation token limit (${CONVERSATION_TOKEN_LIMIT}) is very low. ` +
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

						const statement = `Tool results feedback:\n${
							formatToolObjectivesAndStats(interaction, loopTurnCount, maxTurns)
						}\n${toolResponses.join('\n')}`;

						this.emitStatus(ApiStatus.LLM_PROCESSING);
						this.emitPromptCacheTimer();

						currentResponse = await interaction.relayToolResult(statement, speakOptions);

						this.emitStatus(ApiStatus.API_BUSY);
						//logger.info('AgentController: tool response', currentResponse);
					} catch (error) {
						throw this.handleLLMError(error as Error, interaction); // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
					}
				} else {
					// No more tool toolResponse, exit the loop
					break;
				}
			} catch (error) {
				logger.error(
					`AgentController: Error in conversation turn ${loopTurnCount}: ${(error as Error).message}`,
				);
				if (loopTurnCount === maxTurns - 1) {
					throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
				}

				const args = isLLMError(error) ? error.options?.args : null;
				const errorMessage = args ? `${args.reason} - ${(error as Error).message}` : (error as Error).message;

				// args: { reason: failReason, retries: { max: maxRetries, current: retries } },
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
						error: errorMessage,
						code: 'RESPONSE_HANDLING' as const,
					} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
				);

				// For non-fatal errors, log and continue to the next turn
				currentResponse = {
					messageResponse: {
						answerContent: [{
							type: 'text',
							text: `Error occurred: ${errorMessage}. Continuing conversation.`,
						}],
						answer: `Error occurred: ${errorMessage}. Continuing conversation.`,
					},
					messageMeta: {},
				} as LLMSpeakWithResponse;
			}
		}
		logger.warn(`AgentController: LOOP: DONE turns ${loopTurnCount}`);

		if (this.isCancelled) {
			logger.warn('AgentController: Operation was cancelled.');
		} else if (loopTurnCount >= maxTurns) {
			logger.warn(`AgentController: Reached maximum number of turns (${maxTurns}) in conversation.`);
		}

		// Final save of the entire conversation at the end of the loop
		logger.debug(
			`AgentController: Saving conversation at end of statement: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);

		await this.saveConversationAfterStatement(interaction, currentResponse);

		logger.info(
			`AgentController: Final save of conversation: ${interaction.id}[${this.statementCount}][${this.statementTurnCount}]`,
		);

		// Extract full answer text
		const answer = currentResponse.messageResponse.answer; // this is the canonical answer
		//const answer = extractTextFromContent(currentResponse.messageResponse.answerContent);

		// Extract thinking content using our standardized extractor
		const assistantThinking = currentResponse.messageResponse.answerContent
			? extractThinkingFromContent(currentResponse.messageResponse.answerContent)
			: '';

		interaction.conversationLogger.logAnswerMessage(
			interaction.getLastMessageId(),
			answer,
			assistantThinking,
			{
				statementCount: this.statementCount,
				statementTurnCount: this.statementTurnCount,
				conversationTurnCount: this.conversationTurnCount,
			},
			{
				tokenUsageTurn: this.primaryInteraction.tokenUsageTurn,
				tokenUsageStatement: this.primaryInteraction.tokenUsageStatement,
				tokenUsageConversation: this.primaryInteraction.tokenUsageInteraction,
			},
			currentResponse.messageMeta.requestParams,
		);

		const completedTask: CompletedTask = {
			title: task.title,
			status: 'completed',
			result: `Task '${task.title}' completed successfully:\n${answer}`,
		};

		this.resetStatus();
		return completedTask;
	}
}

export default AgentController;
