import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface LLMToolLoadResourcesInput {
	dataSource?: string;
	mode: 'template' | 'direct';
	uriTemplate?: string;
	templateResources?: Array<Record<string, string>>;
	directUris?: string[];
}

export interface LLMToolLoadResourcesResponseData {
	data: {
		resourcesAdded: string[];
		resourcesError: string[];
		dataSourceId: string;
	};
}

export interface LLMToolLoadResourcesResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolLoadResourcesResponseData;
}
