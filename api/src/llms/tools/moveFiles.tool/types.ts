import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolMoveFilesInput {
	sources: string[];
	destination: string;
	overwrite?: boolean;
	createMissingDirectories?: boolean;
}

export interface LLMToolMoveFilesResponseData {
	data: {
		filesMoved: string[];
		filesError: string[];
		destination: string;
	};
}

export interface LLMToolMoveFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolMoveFilesResponseData;
}
