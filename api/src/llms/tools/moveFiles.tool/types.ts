import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolMoveFilesInput {
	sources: string[];
	destination: string;
	overwrite?: boolean;
	createMissingDirectories?: boolean;
	dataSource?: string;
}

export interface LLMToolMoveFilesResponseData {
	data: {
		filesMoved: string[];
		filesError: string[];
		destination: string;
		dataSourceId: string;
	};
}

export interface LLMToolMoveFilesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolMoveFilesResponseData;
}
