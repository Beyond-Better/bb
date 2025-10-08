import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface LLMToolLoadResourcesInput {
	dataSourceId?: string;
	mode: 'template' | 'direct';
	uriTemplate?: string;
	templateResources?: Array<Record<string, string>>;
	directUris?: string[];
	/**
	 * Content representation format for structured data sources.
	 * - plainText: Human-readable format (markdown for structured sources)
	 * - structured: Raw block structure (Portable Text) for editing operations
	 * - both: Both representations for comprehensive access
	 * Parameter ignored for filesystem sources which always return native content.
	 */
	contentFormat?: 'plainText' | 'structured' | 'both';
}

export interface LLMToolLoadResourcesResponseData {
	data: {
		resourcesAdded: string[];
		resourcesError: string[];

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

export interface LLMToolLoadResourcesResult {
	toolResults: LLMToolRunResultContent;
	bbResponse: LLMToolLoadResourcesResponseData;
}
