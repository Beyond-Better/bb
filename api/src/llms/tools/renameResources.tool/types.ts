// Tool-specific type definitions for the renameResources tool
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolRenameResourcesInput {
	dataSourceId?: string;
	operations: Array<{
		source: string;
		destination: string;
	}>;
	createMissingDirectories?: boolean;
	overwrite?: boolean;
}

export interface LLMToolRenameResourcesResponseData {
	data: {
		resourcesRenamed: Array<{
			source: string;
			destination: string;
		}>;
		resourcesError: Array<{
			source: string;
			destination: string;
			error: string;
		}>;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolRenameResourcesResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolRenameResourcesResponseData;
}
