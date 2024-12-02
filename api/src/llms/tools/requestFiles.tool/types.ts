import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRequestFilesInput {
	fileNames: string[];
}

export interface LLMToolRequestFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: {
		data: {
			filesAdded: string[];
			filesError: string[];
		};
	};
}
