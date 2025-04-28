import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolForgetResourcesInput {
	dataSourceId?: string;
	resources: Array<{
		resourcePath: string;
		revision: string;
	}>;
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

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolForgetResourcesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolForgetResourcesResponseData;
}
