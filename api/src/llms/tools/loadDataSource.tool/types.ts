import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { PaginationInfo, ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { DataSourceMetadata, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ContentTypeGuidance } from 'shared/types/dataSource.ts';
import type { FilteredInstructionContent, InstructionFilters } from 'api/types/instructionFilters.ts';

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
	returnType?: 'metadata' | 'resources' | 'both' | 'instructions' | 'combined';
	/**
	 * Optional filters to customize instruction content when returnType includes 'instructions'
	 * If not provided, returns comprehensive instructions
	 */
	instructionFilters?: InstructionFilters;
}

export interface LLMToolLoadDatasourceResponseData {
	data: {
		resources?: ResourceMetadata[]; // Only present when returnType='resources', 'both', or 'combined'
		metadata?: DataSourceMetadata; // Only present when returnType='metadata', 'both', or 'combined'
		uriTemplate?: string;
		pagination?: PaginationInfo;
		contentTypeGuidance?: ContentTypeGuidance; // Only present when returnType='metadata', 'both', or 'combined'
		instructions?: string; // Only present when returnType='instructions' or 'combined'
		filteredInstructionContent?: FilteredInstructionContent; // Only present when returnType='instructions' or 'combined' with filters

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolLoadDatasourceResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolLoadDatasourceResponseData;
}
