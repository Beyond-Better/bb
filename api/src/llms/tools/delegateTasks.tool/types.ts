import type { LLMToolRunBbResponse, LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { CompletedTask, ErrorHandlingConfig, Task } from 'api/types/llms.ts';

/*
 * export interface Task {
 * 	title: string;
 * 	instructions: string;
 * 	resources: Resource[];
 * 	capabilities: string[];
 * 	requirements: string | InputSchema;
 * }
 * export interface Resource {
 * 	type: 'url' | 'file' | 'memory' | 'api' | 'database' | 'vector_search';
 * 	location: string;
 * }
 * export type ErrorStrategy = 'fail_fast' | 'continue_on_error' | 'retry';
 * export interface ErrorHandlingConfig {
 * 	strategy: ErrorStrategy;
 * 	maxRetries?: number;
 * 	continueOnErrorThreshold?: number;
 * }
 */

export interface LLMToolDelegateTasksInput {
	tasks: Task[];
	sync: boolean;
	errorConfig: ErrorHandlingConfig;
	parentInteractionId: string;
}

export interface LLMToolDelegateTasksResultData {
	completedTasks: CompletedTask[];
	errorMessages?: string[];
}

export interface LLMToolDelegateTasksResponseData {
	data: LLMToolDelegateTasksResultData;
}

export interface LLMToolDelegateTasksResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolDelegateTasksResponseData & LLMToolRunBbResponse;
}
