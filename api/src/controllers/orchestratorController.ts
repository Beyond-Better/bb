import { join } from '@std/path';
import { exists } from '@std/fs';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
//import type InteractionManager from 'api/llms/interactionManager.ts';
//import { interactionManager } from 'api/llms/interactionManager.ts';
//import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
//import type LLMTool from 'api/llms/llmTool.ts';
//import type { LLMToolRunToolResponse } from 'api/llms/llmTool.ts';
//import LLMToolManager from '../llms/llmToolManager.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
//import type LLMChatInteraction from 'api/llms/chatInteraction.ts';
import AgentController from 'api/controllers/agentController.ts';
//import PromptManager from '../prompts/promptManager.ts';
//import EventManager from 'shared/eventManager.ts';
import type { EventPayloadMap } from 'shared/eventManager.ts';
//import InteractionPersistence from 'api/storage/interactionPersistence.ts';
//import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { CompletedTask, ErrorHandlingConfig, Task } from 'api/types/llms.ts';
import { extractTextFromContent, extractThinkingFromContent } from 'api/utils/llms.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import { ErrorHandler } from '../llms/errorHandler.ts';
import type {
	CollaborationId,
	//CollaborationContinue,
	CollaborationLogDataEntry,
	//CollaborationLogEntry,
	//InteractionMetrics,
	CollaborationResponse,
	CollaborationStart,
	InteractionId,
	InteractionStatementMetadata,
	InteractionStats,
	ObjectivesData,
	//TokenUsage,
	//TokenUsageStats,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
//import { ErrorType, isLLMError, type LLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { isLLMError } from 'api/errors/error.ts';
//import { createError } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
//import { getConfigManager } from 'shared/config/configManager.ts';
//import type { ProjectConfig } from 'shared/config/types.ts';
//import { LLMModelToProvider } from 'api/types/llms.ts';
import {
	generateCollaborationObjective,
	//generateCollaborationTitle,
	generateStatementObjective,
} from '../utils/collaboration.utils.ts';
//import { generateInteractionId } from 'shared/interactionManagement.ts';
import type {
	//ResourceForInteraction,
	//ResourceMetadata,
	ResourcesForInteraction,
	//ResourceRevisionMetadata,
} from 'shared/types/dataSourceResource.ts';
import { getVersionInfo } from 'shared/version.ts';
import BaseController from './baseController.ts';
import type Collaboration from 'api/collaborations/collaboration.ts';

function getCollaborationObjective(objectives?: ObjectivesData): string | undefined {
	if (!objectives) return undefined;
	return objectives.collaboration;
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
	const metrics = interaction.interactionMetrics;
	const parts = [`Turn ${turnCount}/${maxTurns}`];

	// Add objectives if set
	logger.debug('Raw objectives:', metrics.objectives);
	const collaborationObjective = getCollaborationObjective(metrics.objectives);
	const currentObjective = getCurrentObjective(metrics.objectives);
	logger.debug('Extracted objectives:', { collaborationObjective, currentObjective });

	// Add collaboration objective if set
	if (collaborationObjective) {
		parts.push(`Collaboration Goal: ${collaborationObjective}`);
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

class OrchestratorController extends BaseController {
	//private agentControllers: Map<string, AgentController> = new Map();
	// Exposed for instance inspection
	agentController?: AgentController;

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
	// private _interactionTurnCount: number = 0;
	// // count of statements across all interactions
	// private _statementCount: number = 0;
	// // usage across all interactions
	// protected _tokenUsageInteraction: TokenUsage = {
	// 	totalTokens: 0,
	// 	inputTokens: 0,
	// 	outputTokens: 0,
	// };

	constructor(
		projectEditor: ProjectEditor & { projectInfo: ProjectInfo },
	) {
		super(projectEditor);
		this._controllerType = 'orchestrator';
	}

	override async init(): Promise<OrchestratorController> {
		await super.init();
		return this;
	}

	async initializeInteraction(interactionId: InteractionId): Promise<LLMConversationInteraction> {
		let interaction;
		try {
			//logger.info('OrchestratorController: initializeInteraction:', { interactionId });
			interaction = await this.loadInteraction(interactionId);
		} catch (error) {
			// loadInteraction throws an error when interaction doesn't exist
			logger.error(
				`OrchestratorController: Interaction ${interactionId} not found: ${errorMessage(error)}`,
			);
			interaction = null;
		}

		if (!interaction) {
			logger.info('OrchestratorController: initializeInteraction: creating interaction', { interactionId });
			interaction = await this.createInteraction(interactionId);
		}
		// [TODO] `createInteraction` calls interactionManager.createInteraction which adds it to manager
		// so let `loadInteraction` handle interactionManager.addInteraction
		//this.interactionManager.addInteraction(interaction);
		await this.addToolsToInteraction(interaction);
		return interaction;
	}

	async handleStatement(
		statement: string,
		collaborationId: CollaborationId,
		interactionId: InteractionId,
		options: { maxTurns?: number } = {},
		statementParams?: StatementParams,
		resourcesToAttach?: string[], // Array of resource IDs
		_dataSourceIdForAttach?: string, // Data source to load attached resources from
	): Promise<CollaborationResponse> {
		this.isCancelled = false;
		const collaboration = this.collaborationManager.getCollaboration(collaborationId) as Collaboration;
		const interaction = this.interactionManager.getInteraction(interactionId) as LLMConversationInteraction;
		try {
			if (!interaction) {
				throw new Error(`No interaction found for ID: ${interactionId}`);
			}
			this.resetStatus(collaboration.id);
			this.emitStatus(collaboration.id, ApiStatus.API_BUSY);
			if (!statement) {
				this.eventManager.emit(
					'projectEditor:collaborationError',
					{
						collaborationId: collaborationId,
						interactionId: interaction.id,
						collaborationTitle: collaboration.title || '',
						agentInteractionId: null,
						timestamp: new Date().toISOString(),
						interactionStats: {
							statementCount: interaction.statementCount,
							statementTurnCount: interaction.statementTurnCount,
							interactionTurnCount: interaction.interactionTurnCount,
						},
						error: 'Missing statement',
						code: 'EMPTY_PROMPT' as const,
					} as EventPayloadMap['projectEditor']['projectEditor:collaborationError'],
				);
				throw new Error('Missing statement');
			}
			/*
			logger.info(
				`OrchestratorController: Starting handleStatement. Prompt: "${
					statement.substring(0, 50)
				}...", InteractionId: ${interaction.id}`,
			);
			 */

			try {
				if (!collaboration.title) {
					collaboration.title = await this.generateCollaborationTitle(statement, interaction.id);
					// Emit new collaboration event after title is generated
					this.eventManager.emit(
						'projectEditor:collaborationNew',
						{
							collaborationId: collaborationId,
							interactionId: interaction.id,
							collaborationTitle: collaboration.title,
							timestamp: new Date().toISOString(),
							tokenUsageStats: {
								//tokenUsageInteraction: this.tokenUsageInteraction,
								tokenUsageInteraction: interaction.tokenUsageInteraction,
								tokenUsageStatement: interaction.tokenUsageStatement,
								tokenUsageTurn: interaction.tokenUsageTurn,
							},
							interactionStats: interaction.interactionStats,
						} as EventPayloadMap['projectEditor']['projectEditor:collaborationNew'],
					);
				}

				// Get current interaction metrics to check objectives
				const currentMetrics = interaction.interactionMetrics;

				// Generate interaction objective if not set
				if (!currentMetrics.objectives?.collaboration) {
					const collaborationObjective = await generateCollaborationObjective(
						await this.createChatInteraction(interaction.id, 'Generate collaboration objective'),
						statement,
					);
					interaction.setObjectives(collaborationObjective);
					logger.debug('Set collaboration objective:', collaborationObjective);
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
						currentMetrics.objectives?.collaboration,
						previousResponse,
						previousObjective,
					);
					interaction.setObjectives(undefined, statementObjective);
					logger.debug('Set statement objective:', statementObjective);
				}
			} catch (error) {
				logger.info('OrchestratorController: Received error from LLM chat: ', error);
				throw this.handleLLMError(error as Error, collaboration, interaction);
			}

			const attachedResources: ResourcesForInteraction = [];

			logger.info(`OrchestratorController: resourcesToAttach`, { resourcesToAttach });
			// Process any attached resources
			if (resourcesToAttach && resourcesToAttach.length > 0) {
				//const projectId = this.projectEditor.projectId;
				const projectAdminDir = await this.projectEditor.getProjectAdminDir();
				const uploadMetadataPath = join(projectAdminDir, '.uploads', '.metadata');
				logger.info(`OrchestratorController: Attaching resources using ${projectAdminDir}`);

				// Get resource metadata and add to interaction
				for (const resourceId of resourcesToAttach) {
					try {
						// Find resource in project uploads
						const uploadMetadataResource = join(uploadMetadataPath, `${resourceId}.json`);
						if (await exists(uploadMetadataResource)) {
							const metadataContent = await Deno.readTextFile(uploadMetadataResource);
							const resourceMetadata = JSON.parse(metadataContent);

							// Get the full resource path
							//const resourcePath = join(projectAdminDir, resourceMetadata.relativePath);

							// Prepare resource for interaction
							logger.info(
								`OrchestratorController: Adding to attachedResources: ${resourceMetadata.relativePath}`,
							);
							const uploadsDataSource = this.projectEditor.projectData.getUploadsDsConnection();
							const uploadUri = uploadsDataSource.getUriForResource(
								`file:./${resourceMetadata.relativePath}`,
							);
							attachedResources.push(
								...await this.projectEditor.prepareResourcesForInteraction(
									[uploadUri],
								),
							);
						}
					} catch (error) {
						logger.error(
							`OrchestratorController: Failed to add resource ${resourceId} to interaction: ${
								(error as Error).message
							}`,
						);
						// Continue with other resources
					}
				}
			}
			//logger.info(`OrchestratorController: attachedResources`, { attachedResources });

			await this.projectEditor.updateProjectInfo();

			// // handled by `converse` in interaction
			// this.statementTurnCount = 0;
			// this.interactionTurnCount++;
			// this.statementCount++;

			const versionInfo = await getVersionInfo();
			const collaborationReady: CollaborationStart & {
				interactionStats: InteractionStats;
				collaborationHistory: CollaborationLogDataEntry[];
			} = {
				collaborationId: collaborationId,
				interactionId: interaction.id,
				collaborationTitle: collaboration.title,
				timestamp: new Date().toISOString(),
				interactionStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					interactionTurnCount: interaction.interactionTurnCount,
				},
				tokenUsageStats: {
					//tokenUsageInteraction: this.tokenUsageInteraction,
					tokenUsageInteraction: interaction.tokenUsageInteraction,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageTurn: interaction.tokenUsageTurn,
				},
				collaborationHistory: [], //this.getCollaborationHistory(interaction),
				versionInfo,
			};
			this.eventManager.emit(
				'projectEditor:collaborationReady',
				collaborationReady as EventPayloadMap['projectEditor']['projectEditor:collaborationReady'],
			);

			const speakOptions: LLMSpeakWithOptions = {
				...statementParams?.rolesModelConfig.orchestrator,
				//model: this.projectConfig?.defaultModels?.orchestrator
				// //temperature: 0.7,
				// //maxTokens: 1000,
				// extendedThinking: this.projectConfig.api?.extendedThinking ?? {
				// 	enabled: true,
				// 	budgetTokens: 4000,
				// },
			};
			//logger.info(`OrchestratorController: Calling interaction.converse with speakOptions: `, speakOptions);
			logger.info(
				`OrchestratorController: Calling interaction.converse using model ${speakOptions.model} - MaxTokens: ${speakOptions.maxTokens} - ExtendedThinking: ${speakOptions.extendedThinking?.enabled} [${speakOptions.extendedThinking?.budgetTokens}]`,
			);

			let currentResponse: LLMSpeakWithResponse | null = null;
			const maxTurns = options.maxTurns ?? this.projectConfig.api?.maxTurns ?? 25; // Maximum number of turns for the run loop

			try {
				logger.info(
					`OrchestratorController: Calling interaction.converse for turn ${interaction.statementTurnCount} with statement: "${
						statement.substring(0, 50)
					}..."`,
				);

				// START OF STATEMENT - REQUEST TO LLM
				this.emitStatus(collaboration.id, ApiStatus.LLM_PROCESSING);
				this.emitPromptCacheTimer(collaboration.id);

				// Create metadata object with useful context
				const metadata: InteractionStatementMetadata = {
					system: {
						timestamp: new Date().toISOString(),
						os: Deno.build.os,
						//bb_version: (await getVersionInfo()).version,
						// Add: git_branch, git_commit
					},
					interaction: {
						//goal: 'Determine the optimal approach...', // Add this
						//current_objective: 'Implement the metadata...', // Add this
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
					//tools: { // see formatToolObjectivesAndStats for example of toolStats
					//	recent: [
					//		{ name: 'find_resources', success: true, count: 2 },
					//		{ name: 'request_files', success: true, count: 1 },
					//	],
					//},
				};

				currentResponse = await interaction.converse(
					statement,
					null,
					metadata,
					speakOptions,
					attachedResources,
				);

				this.emitStatus(collaboration.id, ApiStatus.API_BUSY);
				logger.info('OrchestratorController: Received response from LLM');
				//logger.debug('OrchestratorController: LLM Response:', currentResponse);

				// Update orchestrator's stats
				this.updateStats(interaction.id, interaction.interactionStats);
			} catch (error) {
				logger.info('OrchestratorController: Received error from LLM converse: ', error);
				throw this.handleLLMError(error as Error, collaboration, interaction);
			}

			// Save the interaction immediately after the first response
			logger.info(
				`OrchestratorController: Saving interaction at beginning of statement: ${collaboration.id}[${interaction.id}][${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);
			await this.saveInitialInteractionWithResponse(interaction, currentResponse);

			const modelCapabilities = await interaction.getModelCapabilities();
			const contextWindowTokens = modelCapabilities.contextWindow;
			const contextWindowTokensCutoff = contextWindowTokens * 0.95;
			let loopTurnCount = 0;

			while (loopTurnCount < maxTurns && !this.isCancelled) {
				logger.warn(`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns}`);
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
							`OrchestratorController: Text and Thinking content for tool use for turn ${interaction.statementTurnCount}:`,
							{ textContent, thinkingContent },
						);

						// Only log assistant message if tools are being used
						if (textContent) {
							const interactionStats: InteractionStats = interaction.interactionStats;

							interaction.collaborationLogger.logAssistantMessage(
								interaction.getLastMessageId(),
								null,
								null,
								textContent,
								thinkingContent,
								interactionStats,
								{
									tokenUsageTurn: interaction.tokenUsageTurn,
									tokenUsageStatement: interaction.tokenUsageStatement,
									tokenUsageInteraction: interaction.tokenUsageInteraction,
								},
								currentResponse.messageMeta.llmRequestParams.modelConfig,
							);
						}

						for (const toolUse of currentResponse.messageResponse.toolsUsed) {
							//logger.info('OrchestratorController: Handling tool', toolUse);
							try {
								this.emitStatus(collaboration.id, ApiStatus.TOOL_HANDLING, {
									toolName: toolUse.toolName,
								});

								// logToolUse is called in handleToolUse
								// logToolResult is called in handleToolUse
								const { toolResponse } = await this.handleToolUse(
									null,
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
					logger.warn(
						`OrchestratorController: LOOP: turns ${loopTurnCount}/${maxTurns} - handled all tools in response`,
					);

					loopTurnCount++;

					// Check total token usage including cache operations
					const totalTurnTokens = interaction.tokenUsageTurn.totalTokens +
						(interaction.tokenUsageTurn.cacheCreationInputTokens ?? 0) +
						(interaction.tokenUsageTurn.cacheReadInputTokens ?? 0);
					if (totalTurnTokens > contextWindowTokensCutoff) {
						logger.warn(
							`OrchestratorController: Turn token limit (${contextWindowTokensCutoff}) exceeded. ` +
								`Current usage: ${totalTurnTokens} (direct: ${interaction.tokenUsageTurn.totalTokens}, ` +
								`cache creation: ${interaction.tokenUsageTurn.cacheCreationInputTokens}, ` +
								`cache read: ${interaction.tokenUsageTurn.cacheReadInputTokens}). Forcing conversation summary.`,
						);

						// Log auxiliary message about forced summary
						const timestamp = new Date().toISOString();
						await interaction.collaborationLogger.logAuxiliaryMessage(
							`force-summary-${timestamp}`,
							null,
							null,
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
								// - Target keeping 75% of limit for collaboration
								// - Ensure minimum of 1000 tokens (tool requirement)
								// - If limit is very low, warn but maintain minimum
								maxTokensToKeep: (() => {
									const targetTokens = Math.floor(contextWindowTokens * 0.75);
									if (targetTokens < 1000) {
										logger.warn(
											`OrchestratorController: Interaction token limit (${contextWindowTokens}) is very low. ` +
												`Using minimum of 1000 tokens for interaction summary.`,
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
						await this.handleToolUse(null, interaction, toolUse, currentResponse.messageResponse);

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

							this.emitStatus(collaboration.id, ApiStatus.LLM_PROCESSING);
							this.emitPromptCacheTimer(collaboration.id);

							// Update metadata with current information
							const toolMetadata: InteractionStatementMetadata = {
								system: {
									timestamp: new Date().toISOString(),
									os: Deno.build.os,
									//bb_version: (await getVersionInfo()).version,
									// Add: git_branch, git_commit
								},
								interaction: {
									//goal: 'Determine the optimal approach...', // Add this
									//current_objective: 'Implement the metadata...', // Add this
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

							this.emitStatus(collaboration.id, ApiStatus.API_BUSY);
							//logger.info('OrchestratorController: tool response', currentResponse);
						} catch (error) {
							throw this.handleLLMError(error as Error, collaboration, interaction); // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
						}
					} else {
						// No more tool toolResponse, exit the loop
						break;
					}
				} catch (error) {
					logger.error(
						`OrchestratorController: Error in interaction turn ${loopTurnCount}: ${
							(error as Error).message
						}`,
					);
					if (loopTurnCount === maxTurns - 1) {
						throw error; // If it's the last turn, throw the error to be caught by the outer try-catch
					}

					const args = isLLMError(error) ? error.options?.args : null;
					const errorMessage = args
						? `${args.reason} - ${(error as Error).message}`
						: (error as Error).message;

					// args: { reason: failReason, retries: { max: maxRetries, current: retries } },
					this.eventManager.emit(
						'projectEditor:collaborationError',
						{
							collaborationId: collaborationId,
							interactionId: interaction.id,
							collaborationTitle: collaboration.title || '',
							agentInteractionId: null,
							timestamp: new Date().toISOString(),
							interactionStats: {
								statementCount: interaction.statementCount,
								statementTurnCount: interaction.statementTurnCount,
								interactionTurnCount: interaction.interactionTurnCount,
							},
							error: errorMessage,
							code: 'RESPONSE_HANDLING' as const,
						} as EventPayloadMap['projectEditor']['projectEditor:collaborationError'],
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
			logger.warn(`OrchestratorController: LOOP: DONE turns ${loopTurnCount}`);

			// this.eventManager.emit(
			// 	'projectEditor:collaborationError',
			// 	{
			// 		interactionId: interaction.id,
			// 		collaborationTitle: collaboration.title || '',
			// 		timestamp: new Date().toISOString(),
			// 		interactionStats: {
			// 			statementCount: this.statementCount,
			// 			statementTurnCount: this.statementTurnCount,
			// 			interactionTurnCount: this.interactionTurnCount,
			// 		},
			// 		error: 'Testing Error Display in BUI',
			// 		code: 'EMPTY_PROMPT' as const,
			// 	} as EventPayloadMap['projectEditor']['projectEditor:collaborationError'],
			// );

			if (this.isCancelled) {
				logger.warn('OrchestratorController: Operation was cancelled.');
			} else if (loopTurnCount >= maxTurns) {
				logger.warn(`OrchestratorController: Reached maximum number of turns (${maxTurns}) in interaction.`);
			}
			// handled by `relayToolResult` in interaction
			// this.statementTurnCount = loopTurnCount;
			// this.interactionTurnCount += loopTurnCount;

			// Final save of the entire interaction at the end of the loop
			logger.debug(
				`OrchestratorController: Saving interaction at end of statement: ${collaboration.id}[{interaction.id}][${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);

			await this.saveInteractionAfterStatement(interaction, currentResponse);

			logger.info(
				`OrchestratorController: Final save of interaction: ${collaboration.id}[${interaction.id}][${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);

			// Extract full answer text
			const answer = currentResponse.messageResponse.answer; // this is the canonical answer
			//const answer = extractTextFromContent(currentResponse.messageResponse.answerContent);

			// Extract thinking content using our standardized extractor
			const assistantThinking = currentResponse.messageResponse.answerContent
				? extractThinkingFromContent(currentResponse.messageResponse.answerContent)
				: '';

			//logger.info(`OrchestratorController: Extracted answer: ${answer}`);
			//logger.info(`OrchestratorController: Extracted assistantThinking: ${assistantThinking}`);

			const statementAnswer: CollaborationResponse = {
				logEntry: { entryType: 'answer', content: answer, thinking: assistantThinking },
							collaborationId: collaborationId,
							interactionId: interaction.id,
				collaborationTitle: collaboration.title,
				parentMessageId: null,
				agentInteractionId: null,
				timestamp: new Date().toISOString(),
				interactionStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					interactionTurnCount: interaction.interactionTurnCount,
				},
				tokenUsageStats: {
					tokenUsageTurn: interaction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageInteraction: interaction.tokenUsageInteraction,
				},
			};
			//logger.info(`OrchestratorController: statementAnswer-tokenUsageStats:`, statementAnswer.tokenUsageStats);

			interaction.collaborationLogger.logAnswerMessage(
				interaction.getLastMessageId(),
				null,
				null,
				answer,
				assistantThinking,
				statementAnswer.interactionStats,
				statementAnswer.tokenUsageStats,
				currentResponse.messageMeta.llmRequestParams.modelConfig,
			);

			this.resetStatus(collaboration.id);
			return statementAnswer;
		} catch (error) {
			logger.error(
				`OrchestratorController: Error in handle statement: ${(error as Error).message}`,
			);
			const statementAnswer: CollaborationResponse = {
				logEntry: { entryType: 'answer', content: 'Error handling statement', thinking: '' },
							collaborationId: collaborationId,
							interactionId: interaction.id,
				collaborationTitle: collaboration.title,
				parentMessageId: null,
				agentInteractionId: null,
				timestamp: new Date().toISOString(),
				interactionStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					interactionTurnCount: interaction.interactionTurnCount,
				},
				tokenUsageStats: {
					tokenUsageTurn: interaction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageInteraction: interaction.tokenUsageInteraction,
				},
			};
			this.resetStatus(collaboration.id);
			return statementAnswer;
		}
	}

	async createAgentController(interaction: LLMConversationInteraction): Promise<AgentController> {
		const agentController = await new AgentController(
			this.projectEditor,
			interaction.id,
		).init();
		logger.info(
			'OrchestratorController: createAgentController - controller created for interaction: ',
			interaction.id,
		);
		//this.agentControllers.set(agentInteractionId, agentController);
		this.agentController = agentController;
		return agentController;
	}

	cleanupAgentInteractions(parentInteractionId: InteractionId): void {
		const descendants = this.interactionManager.getAllDescendantInteractions(parentInteractionId);
		for (const descendant of descendants) {
			this.interactionManager.removeInteraction(descendant.id);
		}
	}

	async handleAgentTasks(
		interaction: LLMConversationInteraction,
		parentMessageId: string,
		tasks: Task[],
		sync: boolean = false,
		errorHandlingConfig: ErrorHandlingConfig = { strategy: 'fail_fast' },
	): Promise<Array<CompletedTask>> {
		// [TODO] this should be part of the tool validation, but somehow it's getting through to here
		// Find how tool validation is being bypassed.
		if (!Array.isArray(tasks)) {
			throw new TypeError('tasks must be an array');
		}

		const agentController = this.agentController ?? await this.createAgentController(interaction);
		const errorHandler = new ErrorHandler(errorHandlingConfig);

		if (sync) {
			return await agentController.executeSyncTasks(this, parentMessageId, tasks, errorHandler);
		} else {
			return await agentController.executeAsyncTasks(this, parentMessageId, tasks, errorHandler);
		}

		// 		const errors = results.filter((r) => r.error);
		// 		if (errors.length > 0) {
		// 			if (errorConfig.strategy === 'fail_fast') {
		// 				throw new Error(`Failed to execute tasks: ${errors.map((e) => e.taskTitle).join(', ')}`);
		// 			} else if (
		// 				errorConfig.strategy === 'continue_on_error' &&
		// 				errors.length > (errorConfig.continueOnErrorThreshold || 0)
		// 			) {
		// 				throw new Error(`Too many tasks failed: ${errors.length} out of ${tasks.length}`);
		// 			}
		// 		}
		//
		// 		logger.info('OrchestratorController: Delegated tasks completed', { results });
	}
}

export default OrchestratorController;
