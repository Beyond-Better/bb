import type {
	PlainTextContent,
	StructuredContent,
	BinaryContent,
	DataSourceInfo,
} from 'shared/types/dataSourceResource.ts';
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';

// Re-export shared types for backward compatibility and tool-specific usage
export type {
	PlainTextContent,
	StructuredContent,
	BinaryContent,
	DataSourceInfo,
	ResourceUpdateInfo,
	isPlainTextContent,
	isBinaryContent,
	isStructuredContent,
} from 'shared/types/dataSourceResource.ts';

// =============================================================================
// CREATE RESOURCE TYPES
// =============================================================================

/**
 * Input for write_resource tool
 */
export interface LLMToolWriteResourceInput {
	dataSourceId?: string;
	resourcePath: string;
	resourceName?: string; // Optional name/title for new documents
	overwriteExisting?: boolean; // Default: false
	createMissingDirectories?: boolean; // Default: true
	
	// Content type options (exactly one required)
	plainTextContent?: PlainTextContent;
	structuredContent?: StructuredContent;
	binaryContent?: BinaryContent;
}

/**
 * Response data for write_resource tool
 */
export interface LLMToolWriteResourceResponseData {
	data: {
		resourcePath: string;
		resourceId: string; // The actual ID of the created resource (page ID, document ID, etc.)
		contentType: 'plain-text' | 'structured' | 'binary';
		size: number;
		lastModified: string;
		revision: string;
		isNewResource: boolean;
		lineCount?: number; // Only for plain text content
		lineCountError?: string; // Only for plain text content
		dataSource: DataSourceInfo;
	};
}

/**
 * Complete result for write_resource tool
 */
export interface LLMToolWriteResourceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolWriteResourceResponseData;
}
