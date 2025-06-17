//import type InteractionManager from 'api/llms/interactionManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
//import type LLM from '../llms/providers/baseLLM.ts';
import type { InteractionId } from 'shared/types.ts';
import type { CompletedTask, Task } from 'api/types/llms.ts';
import type { ErrorHandler } from '../llms/errorHandler.ts';
import { isLLMError } from 'api/errors/error.ts';
//import { ApiStatus } from 'shared/types.ts';
import type {
	//ObjectivesData,
	InteractionStatementMetadata,
	InteractionStats,
} from 'shared/types.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/interactionManagement.ts';
import { extractTextFromContent, extractThinkingFromContent } from 'api/utils/llms.ts';

import BaseController from './baseController.ts';
import type OrchestratorController from 'api/controllers/orchestratorController.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';

function formatToolObjectivesAndStats(
	interaction: LLMConversationInteraction,
	turnCount: number,
	maxTurns: number,
): string {
	const metrics = interaction.interactionMetrics;
	const parts = [`Turn ${turnCount}/${maxTurns}`];

	/*
	// Add objectives if set
	logger.debug('Raw objectives:', metrics.objectives);
	const conversationObjective = getCollaborationObjective(metrics.objectives);
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
	//private agentInteractionId: InteractionId;
	private orchestratorInteractionId: InteractionId;
	//private assignedTasks: any[] = []; // Replace 'any' with appropriate task type

	constructor(
		projectEditor: ProjectEditor & { projectInfo: ProjectInfo },
		orchestratorInteractionId: InteractionId,
	) {
		super(projectEditor);
		this._controllerType = 'agent';
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
	//	const interactionId = generateInteractionId();
	//	const interaction = await this.interactionManager.createInteraction(
	//		'conversation',
	//		interactionId,
	//		this.llmProvider,
	//		this.orchestratorInteractionId,
	//	) as LLMConversationInteraction;
	//	return interaction;
	//}

	async createAgentInteraction(title: string): Promise<LLMConversationInteraction> {
		const agentInteractionId = shortenInteractionId(generateInteractionId());
		logger.info(
			`AgentController: createAgentInteraction - creating interaction for: ${agentInteractionId} with parent ${this.orchestratorInteractionId}`,
		);
		const interactionModel = this.projectConfig.defaultModels?.agent ?? 'claude-sonnet-4-20250514';
		const agentInteraction = await this.interactionManager.createInteraction(
			'conversation',
			agentInteractionId,
			//this.llmProvider,
			interactionModel,
			this.getInteractionCallbacks(),
			this.orchestratorInteractionId,
		) as LLMConversationInteraction;
		agentInteraction.title = title;
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
		parentMessageId: string,
		tasks: Task[],
		errorHandler: ErrorHandler,
	): Promise<Array<CompletedTask>> {
		const completedTasks: CompletedTask[] = [];
		//logger.info('AgentController: executeSyncTasks ', { tasks });

		for (const task of tasks) {
			try {
				completedTasks.push(
					await this.executeTask(orchestratorController, parentMessageId, task, errorHandler),
				);
			} catch (error) {
				throw error;
			}
		}

		return completedTasks;
	}

	public async executeAsyncTasks(
		orchestratorController: OrchestratorController,
		parentMessageId: string,
		tasks: Task[],
		errorHandler: ErrorHandler,
	): Promise<Array<CompletedTask>> {
		let completedTasks: CompletedTask[] = [];
		logger.info('AgentController: executeSyncTasks ', { tasks });
		//tasks.forEach((task) => this.taskQueue.addTask(task));
		try {
			completedTasks = await Promise.all(
				tasks.map((task) => this.executeTask(orchestratorController, parentMessageId, task, errorHandler)),
			);
		} catch (error) {
			throw error;
		}
		return completedTasks;
	}

	private async executeTask(
		orchestratorController: OrchestratorController,
		parentMessageId: string,
		task: Task,
		errorHandler: ErrorHandler,
	): Promise<CompletedTask> {
		logger.info('AgentController: executeTask ', { parentMessageId, task });

		const interaction = await this.createAgentInteraction(task.title);
		if (!interaction) {
			throw new Error(`No agent interaction created for parent ID: ${this.orchestratorInteractionId}`);
		}
		logger.info('AgentController: executeTask - created interaction', interaction.id);

		let completedTask: CompletedTask;
		try {
			completedTask = await this.handleTask(orchestratorController, interaction, parentMessageId, task, {
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
		interaction: LLMConversationInteraction,
		parentMessageId: string,
		task: Task,
		options: { maxTurns?: number; model?: string } = {},
	): Promise<CompletedTask> {
		this.isCancelled = false;
		//this.resetStatus();

		//this.emitStatus(ApiStatus.API_BUSY);
		try {
			if (!interaction) {
				throw new Error(`No agent interaction provided for handle task`);
			}

			logger.info('AgentController: handleTask ', task.title);

			if (!task.instructions) {
				//const logEntryInteraction = this.logEntryInteraction;
				const logEntryInteraction = this.interactionManager.getParentInteraction(interaction.id) ??
					interaction;
				const agentInteractionId = interaction.id !== logEntryInteraction.id ? interaction.id : null;
				this.eventManager.emit(
					'projectEditor:collaborationError',
					{
						conversationId: logEntryInteraction.id,
						collaborationTitle: interaction.title || '',
						agentInteractionId: agentInteractionId,
						timestamp: new Date().toISOString(),
						interactionStats: {
							statementCount: interaction.statementCount,
							statementTurnCount: interaction.statementTurnCount,
							interactionTurnCount: interaction.interactionTurnCount,
						},
						error: 'Missing instructions',
						code: 'EMPTY_PROMPT' as const,
					} as EventPayloadMap['projectEditor']['projectEditor:collaborationError'],
				);
				throw new Error('Missing instructions');
			}

			const statement = `Instructions:\n${task.instructions}\n\nResponse format:\n${task.requirements}`;

			/*
		try {
			// Get current conversation metrics to check objectives
			const currentMetrics = interaction.interactionMetrics;

			// Generate conversation objective if not set
			if (!currentMetrics.objectives?.conversation) {
				const conversationObjective = await generateCollaborationObjective(
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
			const maxTurns = options.maxTurns ?? this.projectConfig.api?.maxTurns ?? 25; // Maximum number of turns for the run loop

			try {
				logger.info(
					`AgentController: Calling interaction.converse for turn ${interaction.statementTurnCount} with statement: "${
						statement.substring(0, 50)
					}..."`,
				);

				// START OF STATEMENT - REQUEST TO LLM
				//this.emitStatus(ApiStatus.LLM_PROCESSING);
				//this.emitPromptCacheTimer();

				// Create metadata object with task information
				const metadata: InteractionStatementMetadata = {
					system: {
						timestamp: new Date().toISOString(),
						os: Deno.build.os,
						//bb_version: (await getVersionInfo()).version,
						// Add: git_branch, git_commit
					},
					task: {
						title: task.title,
						type: 'agent_task',
					},
					interaction: {
						counts: {
							statements: interaction.statementCount,
							statement_turns: interaction.statementTurnCount,
							interaction_turns: interaction.interactionTurnCount,
							//max_turns_per_statement: 15,
						},
					},
					resources: { // Add this section
						resources_active: interaction.getResources().size,
					},
				};

				currentResponse = await interaction.converse(statement, parentMessageId, metadata, speakOptions);

				//this.emitStatus(ApiStatus.API_BUSY);
				logger.info('AgentController: Received response from LLM');
				//logger.debug('AgentController: LLM Response:', currentResponse);

				// Update orchestrator's stats
				this.updateStats(interaction.id, interaction.interactionStats);
			} catch (error) {
				logger.info('AgentController: Received error from LLM converse: ', error);
				throw this.handleLLMError(error as Error, interaction);
			}

			// Save the interaction immediately after the first response
			logger.info(
				`AgentController: Saving interaction at beginning of statement: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);
			await this.saveInitialInteractionWithResponse(interaction, currentResponse);

			const modelCapabilities = await interaction.getModelCapabilities();
			const contextWindowTokens = modelCapabilities.contextWindow;
			const contextWindowTokensCutoff = contextWindowTokens * 0.95;
			let loopTurnCount = 0;

			//while (loopTurnCount < 1 && !this.isCancelled) {
			while (loopTurnCount < maxTurns && !this.isCancelled) {
				logger.warn(`AgentController: LOOP: turns ${loopTurnCount}/${maxTurns}`);
				try {
					// Handle tool calls and collect toolResponse
					const toolResponses = [];
					if (
						currentResponse.messageResponse.toolsUsed &&
						currentResponse.messageResponse.toolsUsed.length > 0
					) {
						// Extract text and thinking content from the response
						const textContent = extractTextFromContent(currentResponse.messageResponse.answerContent);
						const thinkingContent = this.extractThinkingContent(currentResponse.messageResponse);
						logger.debug(
							`AgentController: Text and Thinking content for tool use for turn ${interaction.statementTurnCount}:`,
							{ textContent, thinkingContent },
						);

						// Only log assistant message if tools are being used
						if (textContent) {
							const interactionStats: InteractionStats = interaction.interactionStats;

							interaction.collaborationLogger.logAssistantMessage(
								interaction.getLastMessageId(),
								parentMessageId,
								interaction.id,
								textContent,
								thinkingContent,
								interactionStats,
								{
									tokenUsageTurn: interaction.tokenUsageTurn,
									tokenUsageStatement: interaction.tokenUsageStatement,
									tokenUsageInteraction: interaction.tokenUsageInteraction,
								},
							);
						}

						for (const toolUse of currentResponse.messageResponse.toolsUsed) {
							//logger.info('AgentController: Handling tool', toolUse);
							try {
								//this.emitStatus(ApiStatus.TOOL_HANDLING, { toolName: toolUse.toolName });

								// logToolUse is called in handleToolUse
								// logToolResult is called in handleToolUse
								const { toolResponse } = await this.handleToolUse(
									parentMessageId,
									interaction,
									toolUse,
									currentResponse.messageResponse,
								);
								//bbResponses.push(bbResponse);
								toolResponses.push(toolResponse);
								// You can use textContent & thinkingContent here as needed, e.g., add it to a separate array or log it
							} catch (error) {
								logger.warn(
									`AgentController: Error handling tool ${toolUse.toolName}: ${errorMessage(error)}`,
								);
								toolResponses.push(`Error with ${toolUse.toolName}: ${errorMessage(error)}`);
							}
						}
					}
					logger.warn(
						`AgentController: LOOP: turns ${loopTurnCount}/${maxTurns} - handled all tools in response`,
					);

					loopTurnCount++;

					// Check total token usage including cache operations
					const totalTurnTokens = interaction.tokenUsageTurn.totalTokens +
						(interaction.tokenUsageTurn.cacheCreationInputTokens ?? 0) +
						(interaction.tokenUsageTurn.cacheReadInputTokens ?? 0);
					if (totalTurnTokens > contextWindowTokensCutoff) {
						logger.warn(
							`AgentController: Turn token limit (${contextWindowTokensCutoff}) exceeded. ` +
								`Current usage: ${totalTurnTokens} (direct: ${interaction.tokenUsageTurn.totalTokens}, ` +
								`cache creation: ${interaction.tokenUsageTurn.cacheCreationInputTokens}, ` +
								`cache read: ${interaction.tokenUsageTurn.cacheReadInputTokens}). Forcing collaboration summary.`,
						);

						// Log auxiliary message about forced summary
						const timestamp = new Date().toISOString();
						await interaction.collaborationLogger.logAuxiliaryMessage(
							`force-summary-${timestamp}`,
							parentMessageId,
							interaction.id,
							{
								message:
									`BB automatically summarized the conversation due to turn token limit (${totalTurnTokens} tokens including cache operations > ${contextWindowTokensCutoff})`,
								purpose: 'Token Limit Enforcement',
							},
						);

						// Manually construct tool use for collaboration summary
						const toolUse: LLMAnswerToolUse = {
							toolName: 'collaboration_summary',
							toolInput: {
								requestSource: 'tool',
								// Calculate maxTokensToKeep:
								// - Target keeping 75% of limit for conversation
								// - Ensure minimum of 1000 tokens (tool requirement)
								// - If limit is very low, warn but maintain minimum
								maxTokensToKeep: (() => {
									const targetTokens = Math.floor(contextWindowTokens * 0.75);
									if (targetTokens < 1000) {
										logger.warn(
											`AgentController: Conversation token limit (${contextWindowTokens}) is very low. ` +
												`Using minimum of 1000 tokens for collaboration summary.`,
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
						await this.handleToolUse(
							parentMessageId,
							interaction,
							toolUse,
							currentResponse.messageResponse,
						);

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

							//this.emitStatus(ApiStatus.LLM_PROCESSING);
							//this.emitPromptCacheTimer();

							// Update metadata with current information
							const toolMetadata: InteractionStatementMetadata = {
								system: {
									timestamp: new Date().toISOString(),
									os: Deno.build.os,
									//bb_version: (await getVersionInfo()).version,
									// Add: git_branch, git_commit
								},
								task: {
									title: task.title,
									type: 'agent_task',
								},
								interaction: {
									counts: {
										statements: interaction.statementCount,
										statement_turns: interaction.statementTurnCount,
										interaction_turns: interaction.interactionTurnCount,
										//max_turns_per_statement: 15,
									},
									turn: {
										number: loopTurnCount,
										max: maxTurns,
									},
								},
								resources: { // Add this section
									resources_active: interaction.getResources().size,
								},
							};

							currentResponse = await interaction.relayToolResult(statement, toolMetadata, speakOptions);

							//this.emitStatus(ApiStatus.API_BUSY);
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
						`AgentController: Error in interaction turn ${loopTurnCount}: ${errorMessage(error)}`,
					);
					if (loopTurnCount === maxTurns - 1) {
						throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
					}

					const args = isLLMError(error) ? error.options?.args : null;
					const llmErrorMessage = args ? `${args.reason} - ${errorMessage(error)}` : errorMessage(error);

					//const logEntryInteraction = this.logEntryInteraction;
					const logEntryInteraction = this.interactionManager.getParentInteraction(interaction.id) ??
						interaction;
					const agentInteractionId = interaction.id !== logEntryInteraction.id ? interaction.id : null;
					// args: { reason: failReason, retries: { max: maxRetries, current: retries } },
					this.eventManager.emit(
						'projectEditor:collaborationError',
						{
							conversationId: interaction.id,
							collaborationTitle: interaction.title || '',
							agentInteractionId: agentInteractionId,
							timestamp: new Date().toISOString(),
							interactionStats: {
								statementCount: interaction.statementCount,
								statementTurnCount: interaction.statementTurnCount,
								interactionTurnCount: interaction.interactionTurnCount,
							},
							error: llmErrorMessage,
							code: 'RESPONSE_HANDLING' as const,
						} as EventPayloadMap['projectEditor']['projectEditor:collaborationError'],
					);

					// For non-fatal errors, log and continue to the next turn
					currentResponse = {
						messageResponse: {
							answerContent: [{
								type: 'text',
								text: `Error occurred: ${llmErrorMessage}. Continuing conversation.`,
							}],
							answer: `Error occurred: ${llmErrorMessage}. Continuing conversation.`,
						},
						messageMeta: {},
					} as LLMSpeakWithResponse;
				}
			}
			logger.warn(`AgentController: LOOP: DONE turns ${loopTurnCount}`);

			if (this.isCancelled) {
				logger.warn('AgentController: Operation was cancelled.');
			} else if (loopTurnCount >= maxTurns) {
				logger.warn(`AgentController: Reached maximum number of turns (${maxTurns}) in interaction.`);
			}

			// Final save of the entire interaction at the end of the loop
			logger.debug(
				`AgentController: Saving interaction at end of statement: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);

			await this.saveInteractionAfterStatement(interaction, currentResponse);

			logger.info(
				`AgentController: Final save of interaction: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);

			// Extract full answer text
			const answer = currentResponse.messageResponse.answer; // this is the canonical answer
			//const answer = extractTextFromContent(currentResponse.messageResponse.answerContent);

			// Extract thinking content using our standardized extractor
			const assistantThinking = currentResponse.messageResponse.answerContent
				? extractThinkingFromContent(currentResponse.messageResponse.answerContent)
				: '';

			interaction.collaborationLogger.logAnswerMessage(
				interaction.getLastMessageId(),
				parentMessageId,
				interaction.id,
				answer,
				assistantThinking,
				{
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					interactionTurnCount: interaction.interactionTurnCount,
				},
				{
					tokenUsageTurn: interaction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageInteraction: interaction.tokenUsageInteraction,
				},
				currentResponse.messageMeta.llmRequestParams.modelConfig,
			);

			const completedTask: CompletedTask = {
				title: task.title,
				status: 'completed',
				result: `Task '${task.title}' completed successfully:\n${answer}`,
			};

			//this.resetStatus();
			return completedTask;
		} catch (error) {
			logger.error(
				`AgentController: Error in handle task: ${errorMessage(error)}`,
			);
			const completedTask: CompletedTask = {
				title: task.title,
				status: 'failed',
				result: `Task '${task.title}' encountered an error:\n${errorMessage(error)}`,
			};
			//this.resetStatus(interaction.id);
			return completedTask;
		}
	}
}

export default AgentController;
