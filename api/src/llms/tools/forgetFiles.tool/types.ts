import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolForgetFilesInput {
	files: Array<{
		filePath: string;
		revision: string;
	}>;
}
export interface LLMToolForgetFilesResponseData {
	data: {
		filesSuccess: Array<{
			filePath: string;
			revision: string;
		}>;
		filesError: Array<{
			filePath: string;
			revision: string;
			error: string;
		}>;
	};
}

export interface LLMToolForgetFilesResult {
	toolResult: LLMToolRunResultContent;
	//bbResponse: string;
	bbResponse: LLMToolForgetFilesResponseData;
}
