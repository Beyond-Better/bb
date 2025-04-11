import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolForgetResourcesInput {
	resources: Array<{
		resourcePath: string;
		revision: string;
	}>;
	dataSource?: string;
}
export interface LLMToolForgetResourcesResponseData {
	data: {
		resourcesSuccess: Array<{
			resourceUri: string;
			resourcePath: string;
			revision: string;
		}>;
		resourcesError: Array<{
			resourceUri: string;
			resourcePath: string;
			revision: string;
			error: string;
		}>;
		dataSourceId?: string;
	};
}

export interface LLMToolForgetResourcesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolForgetResourcesResponseData;
}
