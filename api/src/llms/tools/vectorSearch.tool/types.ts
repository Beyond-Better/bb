export interface LLMToolVectorSearchInput {
	query: string;
}

export interface LLMToolVectorSearchResponseData {
	data: {
		results: string[];
		errorMessage?: string;
	};
}

export interface LLMToolVectorSearchResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	// bbResponse: LLMToolVectorSearchResponseData;
}
