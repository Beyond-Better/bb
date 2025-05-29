import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ContentMatch, ResourceMatch } from 'api/utils/fileHandling.ts';

export interface LLMToolFindResourcesInput {
	dataSourceIds?: string[];
	contentPattern?: string;
	caseSensitive?: boolean;
	resourcePattern?: string;
	dateAfter?: string;
	dateBefore?: string;
	sizeMin?: number;
	sizeMax?: number;
	contextLines?: number;
	maxMatchesPerFile?: number;
}

export type LLMToolFindResourcesContentMatch = ContentMatch;
//export interface LLMToolFindResourcesContentMatch {
//	lineNumber: number;
//	content: string;
//	contextBefore: string[];
//	contextAfter: string[];
//	matchStart: number;
//	matchEnd: number;
//}
export type LLMToolFindResourcesContentMatches = Array<LLMToolFindResourcesContentMatch>;

export type LLMToolFindResourcesResourceMatch = ResourceMatch;
//export interface LLMToolFindResourcesResourceMatch {
//	resourcePath: string;
//	contentMatches?: ContentMatch[];
//}
export type LLMToolFindResourcesResourceMatches = Array<LLMToolFindResourcesResourceMatch>;

export interface LLMToolFindResourcesResponseData {
	data: {
		resources: string[];
		matches: LLMToolFindResourcesResourceMatch[];
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

export interface LLMToolFindResourcesResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: string;
	// bbResponse: LLMToolFindResources;
}
