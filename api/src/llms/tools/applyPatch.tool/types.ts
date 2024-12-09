import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolApplyPatchInput {
	filePath?: string;
	patch: string;
}

export interface LLMToolApplyPatchResponseData {
	data: {
		modifiedFiles: string[];
		newFiles: string[];
	};
}

export interface LLMToolApplyPatchResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolApplyPatchResponseData;
}
