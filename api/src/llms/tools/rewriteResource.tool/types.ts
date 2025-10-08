import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolRewriteResourceInput {
	dataSourceId?: string;
	resourcePath: string;
	content: string;
	createIfMissing?: boolean;
	allowEmptyContent?: boolean;
	acknowledgement: string;
	expectedLineCount: number;
}

export interface LLMToolRewriteResourceResponseData {
	data: {
		resourcePath: string;
		lineCount: number;
		isNewResource: boolean;
		lineCountError?: string;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolRewriteResourceResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolRewriteResourceResponseData;
}
