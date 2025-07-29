import type { LLMToolRunResultContent } from 'api/llms/llmTool.ts';
import type { DataSourceProviderType } from 'shared/types/dataSource.ts';

/**
 * Represents a Portable Text block structure.
 */
export interface PortableTextBlock {
	_type: string;
	_key: string;
	style?: string;
	children?: Array<{
		_type: 'span';
		_key: string;
		text: string;
		marks?: string[];
	}>;
	[key: string]: any; // Additional properties for different block types
}

/**
 * Represents a single block edit operation to be performed on a document.
 */
export interface LLMToolBlockEditOperation {
	type: 'update' | 'insert' | 'delete' | 'move';
	index?: number;
	_key?: string;
	content?: PortableTextBlock;
	position?: number;
	block?: PortableTextBlock;
	from?: number;
	to?: number;
	fromKey?: string;
	toPosition?: number;
}

/**
 * Input parameters for the block_edit tool.
 */
export interface LLMToolBlockEditInput {
	dataSourceId?: string;
	resourcePath: string;
	operations: Array<LLMToolBlockEditOperation>;
}

export interface LLMToolBlockEditResponseData {
	data: {
		operationResults: Array<{
			operationIndex: number;
			type: string;
			success: boolean;
			message: string;
			originalIndex?: number;
			newIndex?: number;
			affectedKey?: string;
		}>;

		dataSource: {
			dsConnectionId: string;
			dsConnectionName: string;
			dsProviderType: DataSourceProviderType;
		};
	};
}

/**
 * Result of a block_edit tool operation.
 */
export interface LLMToolBlockEditResult {
	toolResult: LLMToolRunResultContent;
	bbResponse: string;
	//bbResponse: LLMToolBlockEditResponseData;
}