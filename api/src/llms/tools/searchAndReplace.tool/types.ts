import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

/**
 * Represents a single search and replace operation to be performed on a file.
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
	filePath: string;
	operations: Array<LLMToolSearchAndReplaceOperation>;
	createIfMissing?: boolean;
	dataSource?: string;
}

/**
 * Result of a search_and_replace tool operation.
 */
export interface LLMToolSearchAndReplaceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: string;
}
