import type { LLMToolConfig, LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolMultiModelQueryInput {
	query: string;
	models: string[];
}

export interface LLMToolMultiModelQueryResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: {
		data: {
			querySuccess: Array<{ modelIdentifier: string; answer: string }>;
			queryError: Array<{ modelIdentifier: string; error: string }>;
		};
	};
}

export interface ModelProvider {
	query(model: string, prompt: string): Promise<string>;
}

export interface LLMToolMultiModelQueryConfig extends LLMToolConfig {
	openaiApiKey?: string;
	anthropicApiKey?: string;
	geminiApiKey?: string;
	models?: string[];
}
