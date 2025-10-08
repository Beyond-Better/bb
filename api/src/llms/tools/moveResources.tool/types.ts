import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolMoveResourcesInput {
	dataSourceId?: string;
	sources: string[];
	destination: string;
	overwrite?: boolean;
	createMissingDirectories?: boolean;
}

export interface LLMToolMoveResourcesResponseData {
	data: {
		resourcesMoved: string[];
		resourcesError: string[];
		destination: string;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolMoveResourcesResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolMoveResourcesResponseData;
}
