import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

export interface ResourceMetadata {
	name: string;
	size: number;
	mimeType: string;
	lastModified: Date;
}

export interface DisplayResult {
	contentType: 'text' | 'image' | 'unsupported';
	content: string; // Base64 for images, text content for text resources
	metadata: ResourceMetadata;
	truncated?: boolean;
	error?: string;
}

//export interface ResourceDisplayHandler {
//	canHandle(mimeType: string): boolean;
//	formatContent(content: Uint8Array, metadata: ResourceMetadata): DisplayResult;
//}

export interface LLMToolDisplayResourceInput {
	dataSourceId?: string;
	resourcePath: string;
}

//export type LLMToolDisplayResourceResultData = DisplayResult;
export interface LLMToolDisplayResourceResultData extends DisplayResult {
	dataSource: {
		dsConnectionId: string;
		dsConnectionName: string;
		dsProviderType: DataSourceProviderType;
	};
}

export interface LLMToolDisplayResourceResponseData {
	data: LLMToolDisplayResourceResultData;
}

export interface LLMToolDisplayResourceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolDisplayResourceResponseData;
}

// // Size limits in bytes
// export const TEXT_DISPLAY_LIMIT = 1024 * 1024; // 1MB
// export const TEXT_HARD_LIMIT = 10 * 1024 * 1024; // 10MB
// export const IMAGE_DISPLAY_LIMIT = 5 * 1024 * 1024; // 5MB
// export const IMAGE_HARD_LIMIT = 20 * 1024 * 1024; // 20MB
