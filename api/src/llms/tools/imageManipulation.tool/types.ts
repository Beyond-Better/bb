import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

// Main input interface
export interface LLMToolImageProcessingInput {
	// File path or URL for input image
	inputPath: string;
	// Output file path where processed image will be saved
	outputPath: string;
	// Array of operations to perform in sequence
	operations: ImageOperation[];
	// Whether to create output directory if it doesn't exist
	createMissingDirectories?: boolean;
	// Whether to allow overwriting existing output file
	overwrite?: boolean;
	dataSource?: string;
}

// Base operation interface
export interface ImageOperation {
	// Type of operation to perform
	type: ImageOperationType;
	// Parameters specific to each operation type
	params: Record<string, unknown>;
}

// Supported operation types
export type ImageOperationType =
	| 'resize'
	| 'crop'
	| 'rotate'
	| 'flip'
	| 'blur'
	| 'sharpen'
	| 'grayscale'
	| 'format'
	| 'quality'
	| 'brightness'
	| 'contrast'
	| 'removeBackground';

// Result data for the tool
export interface LLMToolImageProcessingResultData {
	inputPath: string;
	outputPath: string;
	operations: ImageOperation[];
	success: boolean;
	thumbnail: {
		mediaType: string;
		data: string;
	};
	meta?: {
		width?: number;
		height?: number;
		format?: string;
		size?: number;
	};
	error?: string;
	dataSourceId: string;
}

export interface LLMToolImageProcessingResponseData {
	data: LLMToolImageProcessingResultData;
}

export interface LLMToolImageProcessingResult {
	toolResult: LLMToolRunResultContent;
	toolResponse: string;
	bbResponse: LLMToolImageProcessingResponseData;
}
