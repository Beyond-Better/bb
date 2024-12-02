import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolApplyPatchInput {
	filePath?: string;
	patch: string;
}

export interface LLMToolApplyPatchResultData {
	modifiedFiles: string[];
	newFiles: string[];
}

export interface LLMToolApplyPatchResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: {
		data: LLMToolApplyPatchResultData;
	};
}
