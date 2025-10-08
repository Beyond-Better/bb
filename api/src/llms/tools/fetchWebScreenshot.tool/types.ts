import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
//import type { LLMMessageContentParts } from 'api/llms/llmMessage.ts';

export interface LLMToolFetchWebScreenshotInput {
	url: string;
}

export interface LLMToolFetchWebScreenshotResultData {
	url: string;
	mediaType?: string;
	source?: string;
}
export interface LLMToolFetchWebScreenshotResponseData {
	data: LLMToolFetchWebScreenshotResultData;
}

export interface LLMToolFetchWebScreenshotResult {
	toolResults: LLMToolRunResultContent;
	toolResponse: string;
	bbResponse: LLMToolFetchWebScreenshotResponseData;
}
