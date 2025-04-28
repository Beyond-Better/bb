import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { PaginationInfo, ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolLoadDatasourceInput {
	dataSourceId: string;
	//dataSourceName?: string;
	path?: string;
	depth?: number;
	pageSize?: number;
	pageToken?: string;
}

export interface LLMToolLoadDatasourceResponseData {
	data: {
		resources: ResourceMetadata[];
		uriTemplate: string;
		pagination?: PaginationInfo;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolLoadDatasourceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolLoadDatasourceResponseData;
}
