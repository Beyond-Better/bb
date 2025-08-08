/**
 * Re-export types for edit_resource tool from shared type system
 * This follows BB's pattern of maintaining tool-specific type files while using shared definitions
 */

// Editing operation types
import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type {
	BlockEdits,
	DataSourceInfo,
	OperationResult,
	SearchReplaceEdits,
	SearchReplaceOperation,
	StructuredDataEdits,
	RangeLocation,
	RangeCharacters,
	RangeTextStyle,
	RangeParagraphStyle,
	RangeOperationType,
	ResourceEditResult,
	ResourceEditOperation,
	
} from 'shared/types/dataSourceResource.ts';

export type {
	BlockEdits,
	OperationResult,
	SearchReplaceEdits,
	SearchReplaceOperation,
	StructuredDataEdits,
	RangeLocation,
	RangeCharacters,
	RangeTextStyle,
	RangeParagraphStyle,
	RangeOperationType,
	ResourceEditOperation,
	ResourceEditResult,
} from 'shared/types/dataSourceResource.ts';

// Shared content types (for validation and type guards)
export type { BinaryContent, PlainTextContent, StructuredContent } from 'shared/types/dataSourceResource.ts';

// Type guards
export { isBinaryContent, isPlainTextContent, isStructuredContent } from 'shared/types/dataSourceResource.ts';

// Response data types
export type { DataSourceInfo, ResourceUpdateInfo } from 'shared/types/dataSourceResource.ts';


/**
 * Input for edit_resource tool (updated for operations array approach)
 */
export interface LLMToolEditResourceInput {
	dataSourceId?: string;
	resourcePath: string;
	createIfMissing?: boolean; // Default: false

	// New unified operations approach
	operations: ResourceEditOperation[];

	// Legacy editing approach options (for backward compatibility)
	searchAndReplaceEdits?: SearchReplaceEdits;
	blockEdits?: BlockEdits;
	structuredDataEdits?: StructuredDataEdits;
}

/**
 * Response data for edit_resource tool
 */
// export interface LLMToolEditResourceResponseData {
// 	data: {
// 		resourcePath: string;
// 		editType: 'search-replace' | 'block-edit' | 'structured-data';
// 		operationsApplied: number;
// 		operationResults: OperationResult[];
// 		resourceUpdated: ResourceUpdateInfo;
// 		dataSource: DataSourceInfo;
// 	};
// }

/**
 * Response data for edit_resource tool
 */
export interface LLMToolEditResourceResponseData {
	data: {
		resourcePath: string;
		resourceId: string; // The actual ID of the edited resource
		//editType: 'search-replace' | 'block-edit' | 'structured-data' | 'unified';
		operationResults: OperationResult[];
		operationsApplied: number;
		operationsSuccessful: number;
		operationsFailed: number;
		operationsWithWarnings: number;
		lastModified: string;
		revision: string;
		size: number;
		isNewResource?: boolean; // Only for search-replace with createIfMissing
		dataSource: DataSourceInfo;
	};
}

/**
 * Complete result for edit_resource tool (updated to match writeResource pattern)
 */
export interface LLMToolEditResourceResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: LLMToolEditResourceResponseData;
}

/**
 * Type guard to check if bbResponse is EditResourceResponseData
 */
export function isEditResourceResponse(response: any): response is LLMToolEditResourceResponseData {
	return response &&
		typeof response === 'object' &&
		response.data &&
		typeof response.data === 'object' &&
		typeof response.data.resourcePath === 'string' &&
		//typeof response.data.editType === 'string' &&
		typeof response.data.operationsApplied === 'number' &&
		typeof response.data.dataSource === 'object';
}

// Legacy compatibility types (for reference during migration)
export type { LLMToolSearchAndReplaceOperation } from '../searchAndReplace.tool/types.ts';
export type { LLMToolBlockEditOperation } from '../blockEdit.tool/types.ts';

// Re-export for convenience
export type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
