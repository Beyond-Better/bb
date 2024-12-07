import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRequestFilesInput {
	fileNames: string[];
}

export interface LLMToolRequestFilesResponseData {
	data: {
		filesAdded: string[];
		filesError: string[];
	};
}

export interface LLMToolRequestFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolRequestFilesResponseData;
}
