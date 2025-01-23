//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type {
	LLMToolConfig,
	LLMToolInputSchema,
	LLMToolLogEntryFormattedResult,
	LLMToolRunResult,
} from 'api/llms/llmTool.ts';
import {
	formatLogEntryToolResult as formatLogEntryToolResultBrowser,
	formatLogEntryToolUse as formatLogEntryToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatLogEntryToolResult as formatLogEntryToolResultConsole,
	formatLogEntryToolUse as formatLogEntryToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
//import { isError } from 'shared/error.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { createError, ErrorType } from 'api/utils/error.ts';
//import type InteractionManager from 'api/llms/interactionManager.ts';
import type OrchestratorController from 'api/controllers/orchestratorController.ts';
//import { ResourceManager } from '../../../llms/resourceManager.ts';
//import { CapabilityManager } from '../../../llms/capabilityManager.ts';
//import { ErrorHandler } from '../../../llms/errorHandler.ts';
//import { TaskQueue } from '../../../llms/taskQueue.ts';
import type { CompletedTask, ErrorHandlingConfig, Task } from 'api/types/llms.ts';
import type { LLMToolDelegateTasksInput, LLMToolDelegateTasksResultData } from './types.ts';

/*
 * interface Task {
 * 	title: string;
 * 	background: string;
 * 	instructions: string;
 * 	resources: Resource[];
 * 	capabilities: string[];
 * 	requirements: string | InputSchema;
 * }
 * interface Resource {
 * 	type: 'url' | 'file' | 'memory' | 'api' | 'database' | 'vector_search';
 * 	location: string;
 * }
 * type InputSchema = Record<string, unknown>;
 */

interface LLMToolDelegateTasksConfig extends LLMToolConfig {
	errorHandlingConfig?: ErrorHandlingConfig;
}

export default class LLMToolDelegateTasks extends LLMTool {
	private errorHandlingConfig: ErrorHandlingConfig;
	//private errorHandler: ErrorHandler | undefined;
	//private interactionManager: InteractionManager | undefined;
	private orchestratorController: OrchestratorController | undefined;
	//private taskQueue: TaskQueue|undefined;
	//private resourceManager: ResourceManager | undefined;
	//private capabilityManager: CapabilityManager | undefined;
	//private interaction: LLMConversationInteraction | undefined;

	constructor(name: string, description: string, toolConfig: LLMToolDelegateTasksConfig) {
		super(name, description, toolConfig);
		this.errorHandlingConfig = toolConfig.errorHandlingConfig ||
			{ strategy: 'retry', maxRetries: 3, continueOnErrorThreshold: 50 };
		//logger.debug(`LLMToolDelegateTasks: domConfig`, this.domConfig);
	}

	// async init() {
	// 	super();
	// 	return this;
	// }

	get inputSchema(): LLMToolInputSchema {
		return {
			type: 'object',
			properties: {
				tasks: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							title: { type: 'string', description: 'The title of the task' },
							background: {
								type: 'string',
								description:
									'Background information needed to complete the task, included in the system prompt for the agent',
							},
							instructions: {
								type: 'string',
								description: 'Detailed instructions for the task, provided by you as the orchestrator',
							},
							resources: {
								type: 'array',
								description: 'Resources to be included by BB for task completion',
								items: {
									type: 'object',
									properties: {
										type: {
											type: 'string',
											enum: ['url', 'file', 'memory', 'api', 'database', 'vector_search'],
											description: 'Type of resource',
										},
										location: {
											type: 'string',
											description: 'Location or identifier of the resource',
										},
									},
									required: ['type', 'location'],
								},
							},
							capabilities: {
								type: 'array',
								items: { type: 'string' },
								description:
									'Capabilities required by the agent, which may influence provider and model selection',
							},
							requirements: {
								type: ['string', 'object'],
								description:
									'Requirements for the task output. If an object, it should be suitable for use as tool input_schema. Used to shape the JSON returned from tool use in the agent. Returned to the Orchestrator.',
							},
						},
						required: ['title', 'background', 'instructions'],
					},
				},
				sync: { type: 'boolean', description: 'Whether to execute tasks synchronously or asynchronously' },
			},
			required: ['tasks', 'sync'],
		};
	}

	formatLogEntryToolUse(
		toolInput: LLMToolInputSchema,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console' ? formatLogEntryToolUseConsole(toolInput) : formatLogEntryToolUseBrowser(toolInput);
	}

	formatLogEntryToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		_interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		//this.interaction = interaction;
		this.orchestratorController = projectEditor.orchestratorController;
		//this.interactionManager = projectEditor.orchestratorController.interactionManager;
		//this.resourceManager = new ResourceManager();
		//this.capabilityManager = new CapabilityManager();
		//this.errorHandler = new ErrorHandler(this.errorHandlingConfig);
		//this.taskQueue = new TaskQueue(this.errorHandler);

		const { tasks, sync }: { tasks: Task[]; sync: boolean } = toolUse.toolInput as LLMToolDelegateTasksInput;
		logger.info('LLMToolDelegateTasks: Input ', { tasks, sync });

		try {
			// export interface CompletedTask {
			// 	//type: string;
			// 	title: string;
			// 	status: 'completed' | 'failed';
			// 	result?: string;
			// 	error?: string;
			// }
			const completedTasks: CompletedTask[] = await this.orchestratorController!.handleAgentTasks(
				tasks,
				sync,
				this.errorHandlingConfig,
			);

			const errorMessages: string[] = [];
			logger.info('LLMToolDelegateTasks: Completed ', { completedTasks });
			/*
			for (const task of tasks) {
				try {

					// // Read target file
					// const fileContent = await projectEditor.readFile(task.target);

					// // Format options
					// const format = task.options?.format || 'medium';
					// const maxTokens = task.options?.maxTokens || 1000;
					// const includeMetadata = task.options?.includeMetadata ?? true;

					// // Generate summary using the log entry formatter
					// const summary = await this.generateLogEntrySummary(
					// 	logEntry,
					// 	format,
					// 	maxTokens,
					// 	includeMetadata,
					// 	interaction,
					// );

					completedTasks.push({
						title: task.title,
						status: 'completed',
						result: summary,
					} );
				} catch (error) {
					logger.error(`Task failed: ${isError(error) ?error.message : 'unknwn error'}`);
					completedTasks.push({
						title: task.title,
						status: 'failed',
						error: (error as Error).message,
					});
					errorMessages.push(`Failed to process ${task.title}: ${(error as Error).message}`);
				}
			}
 */

			const toolResultContentParts: LLMMessageContentParts = completedTasks.map((
				task: CompletedTask,
			) => ({
				type: 'text',
				text: `${task.status === 'completed' ? '✅  ' : '⚠️  '} ${task.title}\n\nResult: ${task.result}${
					task.error ? `\n\nError ${task.error}` : ''
				}`,
			}));

			const resultData: LLMToolDelegateTasksResultData = {
				completedTasks,
				errorMessages,
			};

			return {
				toolResults: toolResultContentParts,
				toolResponse: 'Tasks processed',
				bbResponse: {
					data: resultData,
				},
			};
		} catch (error) {
			logger.error(`LLMToolDelegateTasks: Failed to run delegated tasks: ${(error as Error).message}`);

			const toolResults = `⚠️  ${(error as Error).message}`;
			const bbResponse = `BB failed to run delegated tasks. Error: ${(error as Error).message}`;
			const toolResponse = `Failed to run delegated tasks. Error: ${(error as Error).message}`;
			return { toolResults, toolResponse, bbResponse };
			// throw createError(
			// 	ErrorType.ToolHandling,
			// 	`Error executing delegated tasks: ${(error as Error).message}`,
			// 	{
			// 	    name: 'tool run',
			// 	    toolName: 'delegate-tasks',
			// 	    operation: 'tool-run'
			// 	} as ToolHandlingErrorOptions
			// );
		}
	}

	// 	private async executeTask(task: Task): Promise<CompletedTask> {
	// logger.info('LLMToolDelegateTasks: executeTask ', { task }  );
	// 		//// Check capabilities
	// 		//for (const capability of task.capabilities) {
	// 		//	if (!this.capabilityManager!.hasCapability(capability)) {
	// 		//		throw new Error(`Missing required capability: ${capability}`);
	// 		//	}
	// 		//}
	//
	// 		// // Load resources
	// 		// const loadedResources = await Promise.all(
	// 		// 	task.resources.map((resource) => this.resourceManager!.loadResource(resource)),
	// 		// );
	//
	// 		// Create child interaction
	// 		//const childInteractionId = this.interactionManager!.createInteraction('conversation');
	// 		//const childInteraction = this.interactionManager!.getInteraction(childInteractionId);
	//
	//
	// 		// // Execute task in child interaction
	// 		// const result = await childInteraction.execute({
	// 		// 	background: task.background,
	// 		// 	instruction: task.instructions,
	// 		// 	resources: loadedResources,
	// 		// 	requirements: task.requirements,
	// 		// });
	//
	// 		// export interface ConversationResponse {
	// 		// 	conversationId: ConversationId;
	// 		// 	conversationTitle: string;
	// 		// 	timestamp: string;
	// 		// 	logEntry: ConversationLogEntry;
	// 		// 	tokenUsageTurn: TokenUsage;
	// 		// 	tokenUsageStatement: TokenUsage;
	// 		// 	tokenUsageConversation: TokenUsage;
	// 		// 	conversationStats: ConversationStats;
	// 		// 	formattedContent?: string;
	// 		// }
	// 		// export interface ConversationLogEntry {
	// 		// 	entryType: ConversationLogEntryType;
	// 		// 	content: ConversationLogEntryContent;
	// 		// 	thinking?: string;
	// 		// 	toolName?: string;
	// 		// }
	//
	// 	}

	/*
    private async parseLogEntry(fileContent: string) {
        try {
            return JSON.parse(fileContent);
        } catch (error) {
            logger.error(`Failed to parse log entry: ${(error as Error).message}`);
            return null;
        }
    }

    private async generateLogEntrySummary(
        logEntry: unknown,
        format: 'short' | 'medium' | 'long',
        maxTokens: number,
        includeMetadata: boolean,
        interaction: LLMConversationInteraction
    ): Promise<string> {
        // Create a summary prompt based on the format
        const prompt = this.createSummaryPrompt(format, includeMetadata);

        // Use the interaction to get a response from the LLM
        const response = await interaction.getLLMResponse(prompt, {
            maxTokens,
            temperature: 0.3, // Lower temperature for more focused summaries
            systemPrompt: this.getSummarySystemPrompt(format)
        });

        return response;
    }

    private createSummaryPrompt(format: 'short' | 'medium' | 'long', includeMetadata: boolean): string {
        const basePrompt = 'Please provide a';
        const formatDesc = {
            short: 'concise summary focusing only on key points and decisions',
            medium: 'balanced summary including context and important details',
            long: 'comprehensive summary with full context and relationships'
        }[format];

        const metadataRequest = includeMetadata ?
            ' Include relevant metadata such as timestamps, token usage, and conversation statistics.' :
            '';

        return `${basePrompt} ${formatDesc}.${metadataRequest}`;
    }

    private getSummarySystemPrompt(format: 'short' | 'medium' | 'long'): string {
        const formatInstructions = {
            short: 'Focus on essential information only. Limit to key decisions and outcomes.',
            medium: 'Balance detail and brevity. Include context for important points.',
            long: 'Provide comprehensive coverage while maintaining clarity and structure.'
        }[format];

        return `You are a log entry summarization expert. ${formatInstructions}
        Structure your summaries with clear sections and maintain a professional tone.
        Use bullet points for lists and include specific metrics where relevant.`;
    }
 */
}
