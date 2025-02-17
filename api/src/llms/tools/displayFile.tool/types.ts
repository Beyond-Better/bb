import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

export interface FileMetadata {
	name: string;
	size: number;
	mimeType: string;
	lastModified: Date;
}

export interface DisplayResult {
	type: 'text' | 'image' | 'unsupported';
	content: string; // Base64 for images, text content for text files
	metadata: FileMetadata;
	truncated?: boolean;
	error?: string;
}

//export interface FileDisplayHandler {
//	canHandle(mimeType: string): boolean;
//	formatContent(content: Uint8Array, metadata: FileMetadata): DisplayResult;
//}

export interface LLMToolDisplayFileInput {
	filePath: string;
}

export type LLMToolDisplayFileResultData = DisplayResult;

export interface LLMToolDisplayFileResponseData {
	data: LLMToolDisplayFileResultData;
}

export interface LLMToolDisplayFileResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolDisplayFileResponseData;
}

// // Size limits in bytes
// export const TEXT_DISPLAY_LIMIT = 1024 * 1024; // 1MB
// export const TEXT_HARD_LIMIT = 10 * 1024 * 1024; // 10MB
// export const IMAGE_DISPLAY_LIMIT = 5 * 1024 * 1024; // 5MB
// export const IMAGE_HARD_LIMIT = 20 * 1024 * 1024; // 20MB
