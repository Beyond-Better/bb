import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolLoadResourcesInput {
	dataSourceId?: string;
	mode: 'template' | 'direct';
	uriTemplate?: string;
	templateResources?: Array<Record<string, string>>;
	directUris?: string[];
}

export interface LLMToolLoadResourcesResponseData {
	data: {
		resourcesAdded: string[];
		resourcesError: string[];

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolLoadResourcesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolLoadResourcesResponseData;
}
