import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolFetchWebPageInput {
	url: string;
}

export interface LLMToolFetchWebPageResultData {
	url: string;
	html: string;
	title: string | undefined;
	length: number;
}

export interface LLMToolFetchWebPageResponseData {
	data: LLMToolFetchWebPageResultData;
}

export interface LLMToolFetchWebPageResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolFetchWebPageResponseData;
}
