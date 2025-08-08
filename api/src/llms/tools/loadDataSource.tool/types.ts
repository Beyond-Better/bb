import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { PaginationInfo, ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { DataSourceMetadata, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ContentTypeGuidance } from 'shared/types/dataSource.ts';

export interface LLMToolLoadDatasourceInput {
	dataSourceId: string;
	//dataSourceName?: string;
	path?: string;
	depth?: number;
	pageSize?: number;
	pageToken?: string;
	/**
	 * What to return: 'metadata' (default) returns data source summary,
	 * 'resources' returns the actual resource list,
	 * 'both' returns metadata plus a sample of resources
	 */
	returnType?: 'metadata' | 'resources' | 'both';
}

export interface LLMToolLoadDatasourceResponseData {
	data: {
		resources?: ResourceMetadata[]; // Only present when returnType='resources'
		metadata?: DataSourceMetadata; // Only present when returnType='metadata'
		uriTemplate?: string;
		pagination?: PaginationInfo;
		contentTypeGuidance?: ContentTypeGuidance; // Only present when returnType='metadata' or 'both'

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
