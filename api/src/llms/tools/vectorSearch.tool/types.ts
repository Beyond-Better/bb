export interface LLMToolVectorSearchInput {
	query: string;
}

export interface LLMToolVectorSearchResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	results: string[];
	errorMessage?: string;
}
