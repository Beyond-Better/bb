import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolRewriteFileInput {
	filePath: string;
	content: string;
	createIfMissing?: boolean;
	allowEmptyContent?: boolean;
	acknowledgement: string;
	expectedLineCount: number;
	dataSource?: string;
}

export interface LLMToolRewriteFileResponseData {
	data: {
		filePath: string;
		lineCount: number;
		isNewFile: boolean;
		lineCountError?: string;
		dataSourceId: string;
	};
}

export interface LLMToolRewriteFileResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolRewriteFileResponseData;
}
