import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolSearchProjectInput {
	dataSourceIds?: string[];
	contentPattern?: string;
	caseSensitive?: boolean;
	resourcePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
}

export interface LLMToolSearchProjectResponseData {
	data: {
		resources: string[];
		errorMessage?: string;
		searchCriteria: string;
		dataSources: Array<
			{
				dsConnectionId: string;
				dsConnectionName: string;
				dsProviderType: DataSourceProviderType;
			}
		>;
	};
}

export interface LLMToolSearchProjectResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	// bbResponse: LLMToolSearchProject;
}
