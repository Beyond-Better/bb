import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { PaginationInfo, ResourceListItem } from 'api/resources/resourceManager.ts';

export interface LLMToolLoadDatasourceInput {
	dataSourceId?: string;
	dataSourceName: string;
	path?: string;
	depth?: number;
	pageSize?: number;
	pageToken?: string;
}

export interface LLMToolLoadDatasourceResponseData {
	data: {
		resources: ResourceListItem[];
		uriTemplate: string;
		pagination?: PaginationInfo;
		dataSourceId: string;
		dataSourceName: string;
		dataSourceType: string;
	};
}

export interface LLMToolLoadDatasourceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolLoadDatasourceResponseData;
}
