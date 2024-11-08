import type { JSX } from 'preact';
import LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema, LLMToolRunResult } from 'api/llms/llmTool.ts';
import {
	formatToolResult as formatToolResultBrowser,
	formatToolUse as formatToolUseBrowser,
} from './formatter.browser.tsx';
import {
	formatToolResult as formatToolResultConsole,
	formatToolUse as formatToolUseConsole,
} from './formatter.console.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ConversationLogEntryContentToolResult } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type InteractionManager from '../../../llms/interactions/interactionManager.ts';
import type { ResourceManager } from '../../../llms/resourceManager.ts';
import type { CapabilityManager } from '../../../llms/capabilityManager.ts';
import type { ErrorHandler } from '../../../llms/errorHandler.ts';
import type { TaskQueue } from '../../../llms/taskQueue.ts';

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

	formatToolUse(toolInput: LLMToolInputSchema, format: 'console' | 'browser'): string | JSX.Element {
		return format === 'console' ? formatToolUseConsole(toolInput) : formatToolUseBrowser(toolInput);
	}

	formatToolResult(
		resultContent: ConversationLogEntryContentToolResult,
		format: 'console' | 'browser',
	): string | JSX.Element {
		return format === 'console' ? formatToolResultConsole(resultContent) : formatToolResultBrowser(resultContent);
	}

	async runTool(
		interaction: LLMConversationInteraction,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
	): Promise<LLMToolRunResult> {
		const { toolUseId: _toolUseId, toolInput } = toolUse;
		const { fileNames } = toolInput as { fileNames: string[] };

		try {
			return { toolResults: [], toolResponse: '', bbResponse: '' };
		} catch (error) {
			logger.error(`LLMToolDelegateTasks: Error adding files to conversation: ${error.message}`);

			throw createError(ErrorType.FileHandling, `Error adding files to conversation: ${error.message}`, {
				name: 'request-files',
				filePath: projectEditor.projectRoot,
				operation: 'request-files',
			});
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
				await this.errorHandler.handleError(error, task, 0);
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
}
