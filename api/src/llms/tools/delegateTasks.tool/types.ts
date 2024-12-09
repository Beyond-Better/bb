import type { LLMToolRunBbResponse, LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolDelegateTasksInput {
	tasks: {
		type: 'log_entry_summary';
		target: string;
		options?: {
			format?: 'short' | 'medium' | 'long';
			maxTokens?: number;
			includeMetadata?: boolean;
		};
	}[];
}

export interface LLMToolDelegateTasksResponseData {
	data: {
		completedTasks: {
			type: string;
			target: string;
			status: 'completed' | 'failed';
			result?: string;
			error?: string;
		}[];
		errorMessages?: string[];
	};
}

export interface LLMToolDelegateTasksResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolDelegateTasksResponseData & LLMToolRunBbResponse;
}
