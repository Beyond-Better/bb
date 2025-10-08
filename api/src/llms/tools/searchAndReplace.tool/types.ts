import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Represents a single search and replace operation to be performed on a resource.
 */
export interface LLMToolSearchAndReplaceOperation {
	search: string;
	replace: string;
	caseSensitive?: boolean;
	replaceAll?: boolean;
	regexPattern?: boolean;
}

/**
 * Input parameters for the search_and_replace tool.
 */
export interface LLMToolSearchAndReplaceInput {
	dataSourceId?: string;
	resourcePath: string;
	operations: Array<LLMToolSearchAndReplaceOperation>;
	createIfMissing?: boolean;
}

export interface LLMToolSearchAndReplaceResponseData {
	data: {
		operationResults: Array<string>;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

/**
 * Result of a search_and_replace tool operation.
 */
export interface LLMToolSearchAndReplaceResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: string;
	//bbResponse: LLMToolSearchAndReplaceResponseData;
}
