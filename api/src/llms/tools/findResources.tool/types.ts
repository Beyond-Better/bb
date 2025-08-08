import type { DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ContentMatch, ResourceMatch } from 'shared/types/dataSourceResource.ts';

export interface LLMToolFindResourcesInput {
	dataSourceId?: string;
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
	// New unified operations parameters
	resultLevel?: 'resource' | 'container' | 'fragment' | 'detailed';
	pageSize?: number;
	pageToken?: string;
	regexPattern?: boolean;
	structuredQuery?: any;
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

export interface LLMToolFindResourcesPaginationInfo {
	hasMore: boolean;
	pageSize: number;
	pageToken?: string;
}

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
		pagination?: LLMToolFindResourcesPaginationInfo;
	};
}

export interface LLMToolFindResourcesResult {
	toolResults: string;
	toolResponse: string;
	bbResponse: LLMToolFindResourcesResponseData;
}

// Type guard for response validation
export function isFindResourcesResponse(
	response: unknown,
): response is LLMToolFindResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resources' in data &&
		Array.isArray((data as { resources: unknown }).resources) &&
		'matches' in data &&
		Array.isArray((data as { matches: unknown }).matches) &&
		'searchCriteria' in data &&
		typeof (data as { searchCriteria: unknown }).searchCriteria === 'string' &&
		'dataSources' in data &&
		Array.isArray((data as { dataSources: unknown }).dataSources)
	);
}
