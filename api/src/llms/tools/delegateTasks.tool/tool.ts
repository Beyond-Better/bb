//import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolLogEntryFormattedResult, LLMToolRunResult } from 'api/llms/llmTool.ts';
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
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { LLMToolDelegateTasksInput } from './types.ts';
//import type InteractionManager from '../../../llms/interactions/interactionManager.ts';
//import type { ResourceManager } from '../../../llms/resourceManager.ts';
//import type { CapabilityManager } from '../../../llms/capabilityManager.ts';
//import type { ErrorHandler } from '../../../llms/errorHandler.ts';
//import type { TaskQueue } from '../../../llms/taskQueue.ts';

/*
interface Task {
	title: string;
	background: string;
	instructions: string;
	resources: Resource[];
	capabilities: string[];
	requirements: string | InputSchema;
}

interface Resource {
	type: 'url' | 'file' | 'memory' | 'api' | 'database' | 'vector_search';
	location: string;
}

type InputSchema = Record<string, unknown>;
 */

export default class LLMToolDelegateTasks extends LLMTool {
	/*
	private interactionManager: InteractionManager;
	private resourceManager: ResourceManager;
	private capabilityManager: CapabilityManager;
	private errorHandler: ErrorHandler;
	private taskQueue: TaskQueue;

	async init(
		interactionManager: InteractionManager,
		resourceManager: ResourceManager,
		capabilityManager: CapabilityManager,
		errorHandler: ErrorHandler,
		taskQueue: TaskQueue,
	) {
		super();

		this.interactionManager = interactionManager;
		this.resourceManager = resourceManager;
		this.capabilityManager = capabilityManager;
		this.errorHandler = errorHandler;
		this.taskQueue = taskQueue;
		return this;
	}
	 */
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
								description: 'Detailed instructions for the task, provided by the orchestrator',
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
		_projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolInput } = toolUse;
		const { tasks: _tasks } = toolInput as LLMToolDelegateTasksInput;

		try {
			return { toolResults: [], toolResponse: '', bbResponse: '' };

			/*
            const completedTasks = [];
            const errorMessages = [];
            for (const task of tasks) {
                try {
                    if (task.type !== 'log_entry_summary') {
                        throw new Error(`Unsupported task type: ${task.type}`);
                    }

                    // Validate target exists
                    const targetExists = await projectEditor.fileExists(task.target);
                    if (!targetExists) {
                        throw new Error(`Target file not found: ${task.target}`);
                    }

                    // Read target file
                    const fileContent = await projectEditor.readFile(task.target);

                    // Get log entry from file content
                    const logEntry = await this.parseLogEntry(fileContent);
                    if (!logEntry) {
                        throw new Error(`Invalid log entry format in ${task.target}`);
                    }

                    // Format options
                    const format = task.options?.format || 'medium';
                    const maxTokens = task.options?.maxTokens || 1000;
                    const includeMetadata = task.options?.includeMetadata ?? true;

                    // Generate summary using the log entry formatter
                    const summary = await this.generateLogEntrySummary(
                        logEntry,
                        format,
                        maxTokens,
                        includeMetadata,
                        interaction
                    );

                    completedTasks.push({
                        type: task.type,
                        target: task.target,
                        status: 'completed',
                        result: summary
                    });

                } catch (error) {
                    logger.error(`Task failed: ${(error as Error).message}`);
                    completedTasks.push({
                        type: task.type,
                        target: task.target,
                        status: 'failed',
                        error: (error as Error).message
                    });
                    errorMessages.push(`Failed to process ${task.target}: ${(error as Error).message}`);
                }
            }

            const result: LLMToolDelegateTasksResult = {
                toolResult: completedTasks,
                bbResponse: {
                    data: {
                        completedTasks,
                        errorMessages
                    }
                }
            };

            return {
                toolResults: result.toolResult,
                toolResponse: 'Tasks processed',
                bbResponse: result.bbResponse
            };
 */
		} catch (error) {
			logger.error(`LLMToolDelegateTasks error: ${(error as Error).message}`);
			throw createError(
				ErrorType.ToolHandling,
				`Error executing delegated tasks: ${(error as Error).message}`,
				// {
				//     name: 'delegate-tasks',
				//     operation: 'run-tool'
				// }
			);
		}
	}

	/*
	async execute(params: { tasks: Task[]; sync: boolean }): Promise<string> {
		const { tasks, sync } = params;

		if (sync) {
			return this.executeSyncTasks(tasks);
		} else {
			return this.executeAsyncTasks(tasks);
		}
	}

	private async executeSyncTasks(tasks: Task[]): Promise<string> {
		const results: string[] = [];

		for (const task of tasks) {
			try {
				const result = await this.executeTask(task);
				results.push(`Task '${task.title}' completed successfully: ${result}`);
			} catch (error) {
				await this.errorHandler.handleError((error as Error), task, 0);
			}
		}

		return results.join('\n');
	}

	private async executeAsyncTasks(tasks: Task[]): Promise<string> {
		tasks.forEach((task) => this.taskQueue.addTask(task));
		return 'Tasks added to the queue for asynchronous processing.';
	}

	private async executeTask(task: Task): Promise<string> {
		// Check capabilities
		for (const capability of task.capabilities) {
			if (!this.capabilityManager.hasCapability(capability)) {
				throw new Error(`Missing required capability: ${capability}`);
			}
		}

		// Load resources
		const loadedResources = await Promise.all(
			task.resources.map((resource) => this.resourceManager.loadResource(resource)),
		);

		// Create child interaction
		const childInteractionId = this.interactionManager.createInteraction('conversation');
		const childInteraction = this.interactionManager.getInteraction(childInteractionId);

		if (!childInteraction) {
			throw new Error('Failed to create child interaction');
		}

		// Execute task in child interaction
		const result = await childInteraction.execute({
			background: task.background,
			instruction: task.instructions,
			resources: loadedResources,
			requirements: task.requirements,
		});

		// Clean up
		this.interactionManager.removeInteraction(childInteractionId);

		return result;
	}
 */

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
