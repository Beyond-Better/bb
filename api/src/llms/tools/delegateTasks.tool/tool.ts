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
import type { CollaborationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
//import { isError } from 'shared/error.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
//import { createError, ErrorType } from 'api/utils/error.ts';
//import type { InteractionManager } from 'api/llms/interactionManager.ts';
import type OrchestratorController from 'api/controllers/orchestratorController.ts';
//import { ResourceManager } from 'api/resources/resourceManager.ts';
//import { AgentCapabilityManager } from '../../../llms/agentCapabilityManager.ts';
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
 * 	uri: string;
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
	//private agentCapabilityManager: AgentCapabilityManager | undefined;
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
							dataSources: {
								type: 'array',
								items: { type: 'string' },
								description:
									"Array of data source names to operate on. Defaults to the primary data source if omitted. Specify ['all'] to operate on all available data sources. Examples: ['primary'], ['filesystem-1', 'db-staging'], ['all']. Data sources are identified by their name (e.g., 'primary', 'local-2', 'supabase').",
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
										uri: {
											type: 'string',
											description: 'URI of the resource',
										},
									},
									required: ['type', 'uri'],
								},
							},
							capabilities: {
								type: 'array',
								items: { type: 'string' },
								description:
									'Capabilities required by the agent, which may influence provider and model selection',
							},
							requirements: {
								type: ['object', 'string'],
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
		resultContent: CollaborationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): LLMToolLogEntryFormattedResult {
		return format === 'console'
			? formatLogEntryToolResultConsole(resultContent)
			: formatLogEntryToolResultBrowser(resultContent);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		//this.interaction = interaction;
		this.orchestratorController = projectEditor.orchestratorController;
		//this.interactionManager = projectEditor.orchestratorController.interactionManager;
		//this.resourceManager = new ResourceManager();
		//this.agentCapabilityManager = new AgentCapabilityManager();
		//this.errorHandler = new ErrorHandler(this.errorHandlingConfig);
		//this.taskQueue = new TaskQueue(this.errorHandler);

		const { tasks, sync }: { tasks: Task[]; sync: boolean } = toolUse.toolInput as LLMToolDelegateTasksInput;
		logger.info('LLMToolDelegateTasks: Input ', { tasks, sync });

		const parentMessageId = interaction.getLastMessageId();

		try {
			// export interface CompletedTask {
			// 	//type: string;
			// 	title: string;
			// 	status: 'completed' | 'failed';
			// 	result?: string;
			// 	error?: string;
			// }
			const completedTasks: CompletedTask[] = await this.orchestratorController!.handleAgentTasks(
				interaction,
				parentMessageId,
				tasks,
				sync,
				this.errorHandlingConfig,
			);

			const errorMessages: string[] = [];
			logger.info('LLMToolDelegateTasks: Completed ', { completedTasks });

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

	/*
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
