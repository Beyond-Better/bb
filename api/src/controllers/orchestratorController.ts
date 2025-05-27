import { join } from '@std/path';
import { exists } from '@std/fs';
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
//import ConversationPersistence from 'api/storage/conversationPersistence.ts';
//import { LLMProvider as LLMProviderEnum } from 'api/types.ts';
import type { CompletedTask, ErrorHandlingConfig, LLMRequestParams, Task } from 'api/types/llms.ts';
import { extractTextFromContent, extractThinkingFromContent } from 'api/utils/llms.ts';
import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import { ErrorHandler } from '../llms/errorHandler.ts';
import type {
	ConversationId,
	//ConversationContinue,
	ConversationLogDataEntry,
	//ConversationLogEntry,
	//ConversationMetrics,
	ConversationResponse,
	ConversationStart,
	ConversationStatementMetadata,
	ConversationStats,
	ObjectivesData,
	//TokenUsage,
	//TokenUsageStats,
} from 'shared/types.ts';
import { ApiStatus } from 'shared/types.ts';
//import { ErrorType, isLLMError, type LLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { isLLMError } from 'api/errors/error.ts';
//import { createError } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
//import { getConfigManager } from 'shared/config/configManager.ts';
//import type { ProjectConfig } from 'shared/config/types.ts';
//import { LLMModelToProvider } from 'api/types/llms.ts';
import {
	generateConversationObjective,
	//generateConversationTitle,
	generateStatementObjective,
} from '../utils/conversation.utils.ts';
//import { generateConversationId } from 'shared/conversationManagement.ts';
import type {
	//ResourceForConversation,
	//ResourceMetadata,
	ResourcesForConversation,
	//ResourceRevisionMetadata,
} from 'shared/types/dataSourceResource.ts';
import { getVersionInfo } from 'shared/version.ts';
import BaseController from './baseController.ts';

// Hard-coded conversation token limit (192k to leave room for 8k response)
const CONVERSATION_TOKEN_LIMIT = 192000;
//const CONVERSATION_TOKEN_LIMIT = 64000;

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
	// private _conversationTurnCount: number = 0;
	// // count of statements across all interactions
	// private _statementCount: number = 0;
	// // usage across all interactions
	// protected _tokenUsageConversation: TokenUsage = {
	// 	totalTokens: 0,
	// 	inputTokens: 0,
	// 	outputTokens: 0,
	// };

	override async init(): Promise<OrchestratorController> {
		await super.init();
		return this;
	}

	async initializeInteraction(conversationId: ConversationId): Promise<LLMConversationInteraction> {
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

	async handleStatement(
		statement: string,
		conversationId: ConversationId,
		options: { maxTurns?: number } = {},
		requestParams?: LLMRequestParams,
		resourcesToAttach?: string[], // Array of resource IDs
		_dataSourceIdForAttach?: string, // Data source to load attached resources from
	): Promise<ConversationResponse> {
		this.isCancelled = false;
		const interaction = this.interactionManager.getInteraction(conversationId) as LLMConversationInteraction;
		try {
			if (!interaction) {
				throw new Error(`No interaction found for ID: ${conversationId}`);
			}
			this.resetStatus(interaction.id);
			this.emitStatus(interaction.id, ApiStatus.API_BUSY);
			if (!statement) {
				this.eventManager.emit(
					'projectEditor:conversationError',
					{
						conversationId: interaction.id,
						conversationTitle: interaction.title || '',
						agentInteractionId: null,
						timestamp: new Date().toISOString(),
						conversationStats: {
							statementCount: interaction.statementCount,
							statementTurnCount: interaction.statementTurnCount,
							conversationTurnCount: interaction.conversationTurnCount,
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

			try {
				if (!interaction.title) {
					interaction.title = await this.generateConversationTitle(statement, interaction.id);
					// Emit new conversation event after title is generated
					this.eventManager.emit(
						'projectEditor:conversationNew',
						{
							conversationId: interaction.id,
							conversationTitle: interaction.title,
							timestamp: new Date().toISOString(),
							tokenUsageStats: {
								//tokenUsageConversation: this.tokenUsageInteraction,
								tokenUsageConversation: interaction.tokenUsageInteraction,
								tokenUsageStatement: interaction.tokenUsageStatement,
								tokenUsageTurn: interaction.tokenUsageTurn,
							},
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
						currentMetrics.objectives?.conversation,
						previousResponse,
						previousObjective,
					);
					interaction.setObjectives(undefined, statementObjective);
					logger.debug('Set statement objective:', statementObjective);
				}
			} catch (error) {
				logger.info('OrchestratorController: Received error from LLM chat: ', error);
				throw this.handleLLMError(error as Error, interaction);
			}

			const attachedResources: ResourcesForConversation = [];

			logger.info(`OrchestratorController: resourcesToAttach`, { resourcesToAttach });
			// Process any attached resources
			if (resourcesToAttach && resourcesToAttach.length > 0) {
				//const projectId = this.projectEditor.projectId;
				const projectAdminDir = await this.projectEditor.getProjectAdminDir();
				const uploadMetadataPath = join(projectAdminDir, '.uploads', '.metadata');
				logger.info(`OrchestratorController: Attaching resources using ${projectAdminDir}`);

				// Get resource metadata and add to conversation
				for (const resourceId of resourcesToAttach) {
					try {
						// Find resource in project uploads
						const uploadMetadataResource = join(uploadMetadataPath, `${resourceId}.json`);
						if (await exists(uploadMetadataResource)) {
							const metadataContent = await Deno.readTextFile(uploadMetadataResource);
							const resourceMetadata = JSON.parse(metadataContent);

							// Get the full resource path
							//const resourcePath = join(projectAdminDir, resourceMetadata.relativePath);

							// Prepare resource for conversation
							logger.info(
								`OrchestratorController: Adding to attachedResources: ${resourceMetadata.relativePath}`,
							);
							const uploadsDataSource = this.projectEditor.projectData.getUploadsDsConnection();
							const uploadUri = uploadsDataSource.getUriForResource(
								`file:./${resourceMetadata.relativePath}`,
							);
							attachedResources.push(
								...await this.projectEditor.prepareResourcesForConversation(
									[uploadUri],
								),
							);
						}
					} catch (error) {
						logger.error(
							`OrchestratorController: Failed to add resource ${resourceId} to conversation: ${
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
			// this.conversationTurnCount++;
			// this.statementCount++;

			const versionInfo = await getVersionInfo();
			const conversationReady: ConversationStart & {
				conversationStats: ConversationStats;
				conversationHistory: ConversationLogDataEntry[];
			} = {
				conversationId: interaction.id,
				conversationTitle: interaction.title,
				timestamp: new Date().toISOString(),
				conversationStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					conversationTurnCount: interaction.conversationTurnCount,
				},
				tokenUsageStats: {
					//tokenUsageConversation: this.tokenUsageInteraction,
					tokenUsageConversation: interaction.tokenUsageInteraction,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageTurn: interaction.tokenUsageTurn,
				},
				conversationHistory: [], //this.getConversationHistory(interaction),
				versionInfo,
			};
			this.eventManager.emit(
				'projectEditor:conversationReady',
				conversationReady as EventPayloadMap['projectEditor']['projectEditor:conversationReady'],
			);

			const speakOptions: LLMSpeakWithOptions = {
				...requestParams,
				//model: this.projectConfig?.defaultModels?.orchestrator
				// //temperature: 0.7,
				// //maxTokens: 1000,
				// extendedThinking: this.projectConfig.api?.extendedThinking ?? {
				// 	enabled: true,
				// 	budgetTokens: 4000,
				// },
			};
			//logger.info(`OrchestratorController: Calling conversation.converse with speakOptions: `, speakOptions);
			logger.info(
				`OrchestratorController: Calling conversation.converse using model ${speakOptions.model} - MaxTokens: ${speakOptions.maxTokens} - ExtendedThinking: ${speakOptions.extendedThinking?.enabled} [${speakOptions.extendedThinking?.budgetTokens}]`,
			);

			let currentResponse: LLMSpeakWithResponse | null = null;
			const maxTurns = options.maxTurns ?? this.projectConfig.api?.maxTurns ?? 25; // Maximum number of turns for the run loop

			try {
				logger.info(
					`OrchestratorController: Calling conversation.converse for turn ${interaction.statementTurnCount} with statement: "${
						statement.substring(0, 50)
					}..."`,
				);

				// START OF STATEMENT - REQUEST TO LLM
				this.emitStatus(interaction.id, ApiStatus.LLM_PROCESSING);
				this.emitPromptCacheTimer(interaction.id);

				// Create metadata object with useful context
				const metadata: ConversationStatementMetadata = {
					system: {
						timestamp: new Date().toISOString(),
						os: Deno.build.os,
						//bb_version: (await getVersionInfo()).version,
						// Add: git_branch, git_commit
					},
					conversation: {
						//goal: 'Determine the optimal approach...', // Add this
						//current_objective: 'Implement the metadata...', // Add this
						counts: {
							statements: interaction.statementCount,
							statement_turns: interaction.statementTurnCount,
							conversation_turns: interaction.conversationTurnCount,
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

				this.emitStatus(interaction.id, ApiStatus.API_BUSY);
				logger.info('OrchestratorController: Received response from LLM');
				//logger.debug('OrchestratorController: LLM Response:', currentResponse);

				// Update orchestrator's stats
				this.updateStats(interaction.id, interaction.conversationStats);
			} catch (error) {
				logger.info('OrchestratorController: Received error from LLM converse: ', error);
				throw this.handleLLMError(error as Error, interaction);
			}

			// Save the conversation immediately after the first response
			logger.info(
				`OrchestratorController: Saving conversation at beginning of statement: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);
			await this.saveInitialConversationWithResponse(interaction, currentResponse);

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
							const conversationStats: ConversationStats = interaction.conversationStats;

							interaction.conversationLogger.logAssistantMessage(
								interaction.getLastMessageId(),
								null,
								null,
								textContent,
								thinkingContent,
								conversationStats,
								{
									tokenUsageTurn: interaction.tokenUsageTurn,
									tokenUsageStatement: interaction.tokenUsageStatement,
									tokenUsageConversation: interaction.tokenUsageInteraction,
								},
								currentResponse.messageMeta.requestParams,
							);
						}

						for (const toolUse of currentResponse.messageResponse.toolsUsed) {
							//logger.info('OrchestratorController: Handling tool', toolUse);
							try {
								this.emitStatus(interaction.id, ApiStatus.TOOL_HANDLING, {
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
							null,
							null,
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

							this.emitStatus(interaction.id, ApiStatus.LLM_PROCESSING);
							this.emitPromptCacheTimer(interaction.id);

							// Update metadata with current information
							const toolMetadata: ConversationStatementMetadata = {
								system: {
									timestamp: new Date().toISOString(),
									os: Deno.build.os,
									//bb_version: (await getVersionInfo()).version,
									// Add: git_branch, git_commit
								},
								conversation: {
									//goal: 'Determine the optimal approach...', // Add this
									//current_objective: 'Implement the metadata...', // Add this
									counts: {
										statements: interaction.statementCount,
										statement_turns: interaction.statementTurnCount,
										conversation_turns: interaction.conversationTurnCount,
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

							this.emitStatus(interaction.id, ApiStatus.API_BUSY);
							//logger.info('OrchestratorController: tool response', currentResponse);
						} catch (error) {
							throw this.handleLLMError(error as Error, interaction); // This error is likely fatal, so we'll throw it to be caught by the outer try-catch
						}
					} else {
						// No more tool toolResponse, exit the loop
						break;
					}
				} catch (error) {
					logger.error(
						`OrchestratorController: Error in conversation turn ${loopTurnCount}: ${
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
						'projectEditor:conversationError',
						{
							conversationId: interaction.id,
							conversationTitle: interaction.title || '',
							agentInteractionId: null,
							timestamp: new Date().toISOString(),
							conversationStats: {
								statementCount: interaction.statementCount,
								statementTurnCount: interaction.statementTurnCount,
								conversationTurnCount: interaction.conversationTurnCount,
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
			logger.warn(`OrchestratorController: LOOP: DONE turns ${loopTurnCount}`);

			// this.eventManager.emit(
			// 	'projectEditor:conversationError',
			// 	{
			// 		conversationId: interaction.id,
			// 		conversationTitle: interaction.title || '',
			// 		timestamp: new Date().toISOString(),
			// 		conversationStats: {
			// 			statementCount: this.statementCount,
			// 			statementTurnCount: this.statementTurnCount,
			// 			conversationTurnCount: this.conversationTurnCount,
			// 		},
			// 		error: 'Testing Error Display in BUI',
			// 		code: 'EMPTY_PROMPT' as const,
			// 	} as EventPayloadMap['projectEditor']['projectEditor:conversationError'],
			// );

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
				`OrchestratorController: Saving conversation at end of statement: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
			);

			await this.saveConversationAfterStatement(interaction, currentResponse);

			logger.info(
				`OrchestratorController: Final save of conversation: ${interaction.id}[${interaction.statementCount}][${interaction.statementTurnCount}]`,
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

			const statementAnswer: ConversationResponse = {
				logEntry: { entryType: 'answer', content: answer, thinking: assistantThinking },
				conversationId: interaction.id,
				conversationTitle: interaction.title,
				parentMessageId: null,
				agentInteractionId: null,
				timestamp: new Date().toISOString(),
				conversationStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					conversationTurnCount: interaction.conversationTurnCount,
				},
				tokenUsageStats: {
					tokenUsageTurn: interaction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageConversation: interaction.tokenUsageInteraction,
				},
			};
			//logger.info(`OrchestratorController: statementAnswer-tokenUsageStats:`, statementAnswer.tokenUsageStats);

			interaction.conversationLogger.logAnswerMessage(
				interaction.getLastMessageId(),
				null,
				null,
				answer,
				assistantThinking,
				statementAnswer.conversationStats,
				statementAnswer.tokenUsageStats,
				currentResponse.messageMeta.requestParams,
			);

			this.resetStatus(interaction.id);
			return statementAnswer;
		} catch (error) {
			logger.error(
				`OrchestratorController: Error in handle statement: ${(error as Error).message}`,
			);
			const statementAnswer: ConversationResponse = {
				logEntry: { entryType: 'answer', content: 'Error handling statement', thinking: '' },
				conversationId: interaction.id,
				conversationTitle: interaction.title,
				parentMessageId: null,
				agentInteractionId: null,
				timestamp: new Date().toISOString(),
				conversationStats: {
					statementCount: interaction.statementCount,
					statementTurnCount: interaction.statementTurnCount,
					conversationTurnCount: interaction.conversationTurnCount,
				},
				tokenUsageStats: {
					tokenUsageTurn: interaction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatement,
					tokenUsageConversation: interaction.tokenUsageInteraction,
				},
			};
			this.resetStatus(interaction.id);
			return statementAnswer;
		}
	}

	async createAgentController(interaction: LLMConversationInteraction): Promise<AgentController> {
		const agentController = await new AgentController(
			this.projectEditor,
			interaction.id,
		).init();
		logger.info(
			'OrchestratorController: createAgentController - controller has llm for: ',
			agentController.llmProvider.llmProviderName,
		);
		//this.agentControllers.set(agentInteractionId, agentController);
		this.agentController = agentController;
		return agentController;
	}

	cleanupAgentInteractions(parentInteractionId: ConversationId): void {
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
