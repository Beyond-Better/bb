export interface LLMToolSearchProjectInput {
	contentPattern?: string;
	caseSensitive?: boolean;
	filePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
}

export interface LLMToolSearchProjectResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	files: string[];
	errorMessage?: string;
	searchCriteria: string;
}
