export interface LLMToolSearchProjectInput {
	contentPattern?: string;
	caseSensitive?: boolean;
	filePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
	dataSources?: string[];
}

export interface LLMToolSearchProjectResponseData {
	data: {
		files: string[];
		errorMessage?: string;
		searchCriteria: string;
		dataSourceIds: string[];
	};
}

export interface LLMToolSearchProjectResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	// bbResponse: LLMToolSearchProject;
}
