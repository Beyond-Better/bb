import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Input parameters for the search_and_replace_multiline_code tool.
 */
export interface LLMToolSearchAndReplaceMultilineCodeInput {
	dataSourceId?: string;
	filePath: string;
	operations: Array<LLMToolSearchAndReplaceMultilineCodeOperation>;
	createIfMissing?: boolean;
}

/**
 * Represents a single search and replace operation for multiline code.
 */
export interface LLMToolSearchAndReplaceMultilineCodeOperation {
	search: string;
	replace: string;
	replaceAll?: boolean;
	language?: string;
}

/**
 * Result of a search_and_replace_multiline_code tool operation.
 */
export interface LLMToolSearchAndReplaceMultilineCodeResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: string;
	//bbResponse: {
	//	data: {
	//		dataSource: {
	//			dsConnectionId: string;
	//			dsConnectionName: string;
	//			dsProviderType: DataSourceProviderType;
	//		};
	//	};
	//};
}
