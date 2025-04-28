import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolApplyPatchInput {
	dataSourceId?: string;
	filePath?: string;
	patch: string;
}

export interface LLMToolApplyPatchResponseData {
	data: {
		modifiedFiles: string[];
		newFiles: string[];

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolApplyPatchResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolApplyPatchResponseData;
}
