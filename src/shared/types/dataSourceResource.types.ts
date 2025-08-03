/**
 * Type definitions for resource operations in the data source system.
 * These types define the parameters and results for all resource operations.
 */

import { ResourceType } from 'api/types/llms.ts';
import { DataSourceAccessMethod, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { PortableTextBlock, PortableTextOperation } from 'api/types/portableText.ts';

/**
 * Configurations for an MCP resource
 */
export interface ResourceMCPConfig {
	serverId: string; // set in config as mcpServer[x].id
	resourceId: string; // `mcp:${serverId}:${mcpResource.name}` - mcpResource.name is server's internal resource name
	resourceName: string; // set in config as mcpServer[x].name (use id if name not set) - this is name the LLM sees
	description: string;
}

/**
 * Resource metadata common to all resources
 */
export interface ResourceMetadata {
	accessMethod?: DataSourceAccessMethod;
	name?: string;

	/**
	 * Type of the resource (file, directory, database, etc.)
	 */
	type: ResourceType;

	/**
	 * URI of the resource
	 */
	uri: string;
	uriTemplate?: string;

	/**
	 * MIME type of the resource
	 */
	mimeType: string;

	contentType: 'text' | 'image';
	extraType?: 'directory' | 'file' | 'page' | 'row' | 'block'; //string;

	description?: string;

	/**
	 * Size of the resource in bytes (if applicable)
	 */
	size?: number;

	/**
	 * Last modified timestamp
	 */
	lastModified: Date; //string;

	error?: string | null;
	mcpData?: ResourceMCPConfig;

	/**
	 * Additional metadata specific to the resource type
	 */
	[key: string]: unknown;
}

/**
 * Represents metadata about a specific revision of a resource
 */
export interface ResourceRevisionMetadata extends ResourceMetadata {
	/**
	 * Message / Revision identifier (for change tracking)
	 */
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
}

/**
 * Represents a resource for conversation context
 */
export interface ResourceForInteraction {
	resourceName: string;
	resourceUri: string;
	metadata: ResourceRevisionMetadata;
}

export type ResourcesForInteraction = Array<ResourceForInteraction>;

export type InteractionResourcesMetadata = Record<string, ResourceRevisionMetadata>;

// ========================================================================
// Resource Load Operation
// ========================================================================

/**
 * Pagination information for resource listings
 */
export interface PaginationInfo {
	nextPageToken?: string;
	totalCount?: number;
	pageSize?: number;
	currentPage?: number;
}
/**
 * Result of loading a data source
 */
export interface DatasourceLoadResult {
	//resources: ResourceLoadResult[];
	resources: ResourceMetadata[];
	uriTemplate?: string;
	pagination?: PaginationInfo;
}

/**
 * Options for loading a resource
 */
export interface ResourceLoadOptions {
	/**
	 * Content representation format for structured data sources.
	 * - plainText: Human-readable format (markdown for structured sources)
	 * - structured: Raw block structure (Portable Text) for editing operations
	 * - both: Both representations for comprehensive access
	 * Parameter ignored for filesystem sources which always return native content.
	 */
	contentFormat?: 'plainText' | 'structured' | 'both';

	/**
	 * Encoding to use when loading text content
	 */
	encoding?: string;

	/**
	 * Range of bytes to load (for large resources)
	 */
	range?: { start: number; end?: number };

	/**
	 * Whether to include metadata in the result
	 */
	includeMetadata?: boolean;

	/**
	 * Request raw content without formatting (Google Docs: plain text without markdown)
	 * Used for precise range operation validation
	 */
	raw?: boolean;
}

/**
 * Result of loading a resource
 */
export interface ResourceLoadResult {
	/**
	 * Resource content (text or binary)
	 */
	content: string | Uint8Array;

	/**
	 * Resource metadata
	 */
	metadata: ResourceMetadata;

	/**
	 * Whether the content is complete or partial
	 */
	isPartial?: boolean;

	/**
	 * Content formats for 'both' format requests (future enhancement)
	 */
	formats?: {
		plainText: string;
		structured: any[];
	};

	/**
	 * Content format information (future enhancement)
	 */
	contentFormat?: 'plainText' | 'structured' | 'both' | 'native';

	/**
	 * Representation type(s) for the content (future enhancement)
	 */
	representationType?: string | { plainText?: string; structured?: string };
}
/**
 * Represents an item in a resource listing
 */
//export interface ResourceListItem {
//  name: string;
//  uri: string;
//  uriTerm?: string; // term value used for expression in URI template
//  uriTemplate?: string;
//  type: ResourceType;
//  accessMethod: DataSourceAccessMethod;
//  extraType?: string;
//  mimeType: string;
//  size?: number;
//  lastModified?: Date | string;
//  description?: string;
//}

// ========================================================================
// Resource List Operation
// ========================================================================

/**
 * Options for listing resources
 */
export interface ResourceListOptions {
	/**
	 * Path or pattern to filter resources
	 */
	path?: string;

	/**
	 * Maximum depth to traverse (for hierarchical sources)
	 */
	depth?: number;

	/**
	 * Maximum number of resources to return per page
	 */
	//limit?: number;
	pageSize?: number;

	/**
	 * Pagination token for continuing a previous listing
	 */
	pageToken?: string;

	/**
	 * Resource types to include (e.g., files, directories)
	 */
	includeTypes?: string[];
}

/**
 * Result of listing resources
 */
export interface ResourceListResult {
	/**
	 * Array of resource metadata
	 */
	resources: ResourceMetadata[];

	uriTemplate?: string;

	/**
	 * Pagination token for retrieving next page (if available)
	 */
	nextPageToken?: string;

	/**
	 * Whether there are more resources available
	 */
	hasMore?: boolean;

	pagination?: PaginationInfo;
}

// ========================================================================
// Resource Search Operation
// ========================================================================

/**
 * Content match information for enhanced search results
 */
export interface ContentMatch {
	/**
	 * Line number where the match was found (1-based)
	 */
	lineNumber: number;

	/**
	 * The actual content of the matching line
	 */
	content: string;

	/**
	 * Lines of context before the match
	 */
	contextBefore: string[];

	/**
	 * Lines of context after the match
	 */
	contextAfter: string[];

	/**
	 * Character position where match starts in the line
	 */
	matchStart: number;

	/**
	 * Character position where match ends in the line
	 */
	matchEnd: number;
}

/**
 * Search criteria for find operations
 */
export interface SearchCriteria {
	pattern?: string;
	contentPattern?: string;
	resourcePattern?: string;
	structuredQuery?: any;
	caseSensitive?: boolean;
	regexPattern?: boolean;
	filters?: {
		dateAfter?: string;
		dateBefore?: string;
		sizeMin?: number;
		sizeMax?: number;
	};
}

/**
 * Options for searching resources (updated interface)
 */
export interface ResourceSearchOptions {
	/**
	 * Path or pattern to restrict search scope
	 */
	path?: string;

	/**
	 * Whether to perform a case-sensitive search
	 */
	caseSensitive?: boolean;

	/**
	 * Maximum number of results to return
	 */
	pageSize?: number;

	/**
	 * Resource types to include in search
	 */
	includeTypes?: string[];

	/**
	 * File pattern to filter by name (glob syntax)
	 */
	filePattern?: string;

	/**
	 * Content pattern (regex) to search within resources
	 */
	contentPattern?: string;

	/**
	 * Resource name pattern (glob) to filter resources
	 */
	resourcePattern?: string;

	/**
	 * Include only resources modified after this date (YYYY-MM-DD)
	 */
	dateAfter?: string;

	/**
	 * Include only resources modified before this date (YYYY-MM-DD)
	 */
	dateBefore?: string;

	/**
	 * Minimum resource size in bytes
	 */
	sizeMin?: number;

	/**
	 * Maximum resource size in bytes
	 */
	sizeMax?: number;

	/**
	 * Number of context lines to include around matches (0-25)
	 */
	contextLines?: number;

	/**
	 * Maximum number of matches per resource (1-20)
	 */
	maxMatchesPerFile?: number;

	/**
	 * Whether to include content extraction for matches
	 */
	includeContent?: boolean;

	/**
	 * Result level for search results
	 */
	resultLevel?: ResultLevel;

	/**
	 * Pagination token for continuing search
	 */
	pageToken?: string;

	/**
	 * Regex pattern mode
	 */
	regexPattern?: boolean;
}

/**
 * Result level for search operations
 */
export type ResultLevel = 'resource' | 'container' | 'fragment' | 'detailed';

/**
 * Base interface for all match types
 */
export interface BaseMatch {
	type: string;
	resourceUri: string;
}

/**
 * Text match with line-based context
 */
export interface TextMatch extends BaseMatch {
	type: 'text';
	lineNumber?: number;
	characterRange: { start: number; end: number };
	text: string;
	context?: {
		before: string;
		after: string;
	};
}

/**
 * Block match for structured content
 */
export interface BlockMatch extends BaseMatch {
	type: 'block';
	blockId: string;
	blockType: string;
	content: any; // Full block content
	textMatches?: Array<{
		path: string[];
		range: { start: number; end: number };
		text: string;
	}>;
}

/**
 * Record match for database content
 */
export interface RecordMatch extends BaseMatch {
	type: 'record';
	recordId: string;
	tableName?: string;
	fields: Record<string, any>;
	matchedFields: string[];
}

/**
 * Task match for project management content
 */
export interface TaskMatch extends BaseMatch {
	type: 'task';
	taskId: string;
	projectId?: string;
	status: string;
	title: string;
	matchedIn: 'title' | 'description' | 'comments';
	textMatch?: {
		text: string;
		context?: { before: string; after: string };
	};
}

/**
 * Union type for all possible match types
 */
export type Match = TextMatch | BlockMatch | RecordMatch | TaskMatch;

/**
 * Enhanced resource match information
 */
export interface ResourceMatch {
	/**
	 * Resource URI for operations
	 */
	resourceUri: string;

	/**
	 * Resource path for edit operations
	 */
	resourcePath: string;

	/**
	 * Resource type (file, page, issue, task, row)
	 */
	resourceType: string;

	/**
	 * Resource metadata
	 */
	resourceMetadata: {
		title?: string;
		lastModified?: string;
		author?: string;
		size?: number;
		[key: string]: any;
	};

	/**
	 * Polymorphic matches (empty for resource-level results)
	 */
	matches: Match[];

	/**
	 * Legacy content matches for backward compatibility
	 */
	contentMatches?: ContentMatch[];

	/**
	 * Match score/relevance (0-1)
	 */
	score?: number;
}

/**
 * Data source information
 */
export interface DataSourceInfo {
	dsConnectionId: string;
	dsConnectionName: string;
	dsProviderType: string;
}

/**
 * Enhanced pagination information
 */
export interface PaginationResult {
	pageSize: number;
	pageToken?: string;
	hasMore: boolean;
	totalEstimate?: number;
}

/**
 * Parameters for findResources method
 */
export interface FindResourceParams {
	/**
	 * Content pattern to search for
	 */
	contentPattern?: string;

	/**
	 * Resource pattern (glob) to filter resources
	 */
	resourcePattern?: string;

	/**
	 * Provider-specific structured query
	 */
	structuredQuery?: any;

	/**
	 * Whether content pattern is a regex
	 */
	regexPattern?: boolean;

	/**
	 * Search options
	 */
	options: {
		caseSensitive?: boolean;
		resultLevel?: ResultLevel;
		maxMatchesPerResource?: number;
		contextLines?: number;
		pageSize?: number;
		pageToken?: string;
		filters?: {
			dateAfter?: string;
			dateBefore?: string;
			sizeMin?: number;
			sizeMax?: number;
		};
	};
}

/**
 * Result of findResources method (unified operations)
 */
export interface FindResourceResult {
	dataSource: DataSourceInfo;
	searchCriteria: SearchCriteria;
	totalMatches: number;
	resources: ResourceMatch[];
	pagination: PaginationResult;
	errorMessage?: string | null;
}

/**
 * Result of searching resources (legacy interface)
 */
export interface ResourceSearchResult {
	/**
	 * Array of matching resources with metadata
	 */
	matches: ResourceMatch[];

	/**
	 * Total number of matches found (may be more than returned)
	 */
	totalMatches?: number;

	/**
	 * Error message if search encountered issues
	 */
	errorMessage?: string | null;
}

// ========================================================================
// Resource Edit Operation
// ========================================================================

export type EditType = 'searchReplace' | 'range' | 'blocks' | 'structuredData';

export interface ResourceEditOperation {
	// Required field indicating the type of operation
	editType: EditType;

	// Search and replace properties (when editType === 'searchReplace')
	searchReplace_search?: string;
	searchReplace_replace?: string;
	searchReplace_regexPattern?: boolean;
	searchReplace_replaceAll?: boolean;
	searchReplace_caseSensitive?: boolean;

	// Range edit properties (when editType === 'range')
	range_rangeType?: RangeOperationType;
	range_location?: RangeLocation;
	range_range?: RangeCharacters;
	range_text?: string;
	range_textStyle?: RangeTextStyle;
	range_paragraphStyle?: RangeParagraphStyle;
	range_fields?: string;

	// Block edit properties (when editType === 'blocks')
	blocks_operationType?: BlockOperationType;
	blocks_index?: number;
	blocks_key?: string;
	blocks_content?: any;
	blocks_position?: number;
	blocks_block?: any;
	blocks_from?: number;
	blocks_to?: number;
	blocks_fromKey?: string;
	blocks_toPosition?: number;

	// Structured data properties (when editType === 'structuredData')
	structuredData_operation?: any;
}

/**
 * Result from applying unified edit operations
 */
export interface ResourceEditResult {
	operationResults: OperationResult[];
	successfulOperations: OperationResult[];
	skippedOperations: OperationResult[];
	failedOperations: OperationResult[];
	allOperationsSucceeded: boolean;
	allOperationsFailed: boolean;
	revision?: string;
	bytesWritten?: number;
	isNewResource?: boolean;
	lastModified?: string; // this should probably be part of resourceMetadata
	size?: number; // this should probably be part of resourceMetadata
	//resourceMetadata?: Record<string, any>;
	metadata: ResourceMetadata;
}

// ========================================================================
// Resource Write Operation
// ========================================================================

/**
 * Options for writing a resource
 */
export interface ResourceWriteOptions {
	/**
	 * Whether to create parent directories if they don't exist
	 */
	createMissingDirectories?: boolean;

	/**
	 * Whether to overwrite existing resource
	 */
	overwrite?: boolean;

	/**
	 * Optional name/title for the resource when creating new documents
	 * Used for Notion pages and Google Docs documents
	 */
	resourceName?: string;

	/**
	 * Encoding to use when writing text content
	 */
	encoding?: string;

	/**
	 * Content type (MIME type) to set on the resource
	 */
	contentType?: string;

	/**
	 * Additional metadata to set on the resource
	 */
	metadata?: Record<string, unknown>;
}

/**
 * Result of writing a resource
 */
export interface ResourceWriteResult {
	/**
	 * Whether the write operation was successful
	 */
	success: boolean;

	/**
	 * URI of the written resource
	 */
	uri: string;

	/**
	 * Updated metadata for the resource
	 */
	metadata: ResourceMetadata;

	/**
	 * Size of the written content in bytes
	 */
	bytesWritten?: number;
}

// ========================================================================
// Resource Move Operation
// ========================================================================

/**
 * Options for moving a resource
 */
export interface ResourceMoveOptions {
	/**
	 * Whether to create parent directories if they don't exist
	 */
	createMissingDirectories?: boolean;

	/**
	 * Whether to overwrite existing resource at destination
	 */
	overwrite?: boolean;
}

/**
 * Result of moving a resource
 */
export interface ResourceMoveResult {
	/**
	 * Whether the move operation was successful
	 */
	success: boolean;

	/**
	 * Original URI of the resource
	 */
	sourceUri: string;

	/**
	 * New URI of the resource
	 */
	destinationUri: string;

	/**
	 * Updated metadata for the resource
	 */
	metadata: ResourceMetadata;
}

// ========================================================================
// Resource Delete Operation
// ========================================================================

/**
 * Options for deleting a resource
 */
export interface ResourceDeleteOptions {
	/**
	 * Whether to recursively delete directories
	 */
	recursive?: boolean;

	/**
	 * Whether to permanently delete or move to trash
	 */
	permanent?: boolean;
}

/**
 * Result of deleting a resource
 */
export interface ResourceDeleteResult {
	/**
	 * Whether the delete operation was successful
	 */
	success: boolean;

	/**
	 * URI of the deleted resource
	 */
	uri: string;

	/**
	 * Type of resource that was deleted
	 */
	type: string;

	/**
	 * URI of trash location (if not permanently deleted)
	 */
	trashUri?: string;
}

// =============================================================================
// SHARED CONTENT TYPES FOR LLM TOOLS
// =============================================================================

/**
 * Plain text content for filesystem and text-based data sources
 */
export interface PlainTextContent {
	/** The text content to write to the resource */
	content: string;
	/** Expected number of lines in the content (used for validation) */
	expectedLineCount: number;
	/** Whether to allow empty content (default: false) */
	allowEmptyContent?: boolean;
	/** Required confirmation string acknowledging plain text content creation/modification */
	acknowledgement: string;
}

/**
 * Structured content for block-based data sources like Notion and Google Docs
 * Uses existing Portable Text format from portableText.types.ts
 */
export interface StructuredContent {
	/** Array of Portable Text blocks representing the structured content */
	blocks: PortableTextBlock[];
	/** Whether to allow empty content (default: false) */
	allowEmptyContent?: boolean;
	/** Required confirmation string acknowledging structured content creation/modification */
	acknowledgement: string;
}

/**
 * Binary content for images, documents, and other non-text resources
 */
export interface BinaryContent {
	/** Binary data as Uint8Array or base64 string */
	data: Uint8Array | string;
	/** MIME type of the binary content (e.g., "image/png", "application/pdf") */
	mimeType: string;
}

export interface RangeTextSpan {
	_type: 'span';
	_key: string;
	text: string;
	marks: string[];
	apiRange: {
		startIndex: number;
		endIndex: number;
	};
}

export interface RangeParagraphBlock {
	_type: 'block';
	_key: string;
	style: string;
	markDefs: any[];
	children: RangeTextSpan[];
	apiRange: {
		startIndex: number;
		endIndex: number;
	};
}

// =============================================================================
// EDITING OPERATION TYPES
// =============================================================================

/**
 * Edit operation for unified operations array approach
 */

/**
 * Search and replace operation for plain text content
 */
export interface SearchReplaceOperation {
	editType: 'searchReplace';
	/** Text to search for */
	search: string;
	/** Text to replace matches with */
	replace: string;
	/** Whether search is case sensitive (default: true) */
	caseSensitive?: boolean;
	/** Whether to treat search as regex pattern (default: false) */
	regexPattern?: boolean;
	/** Whether to replace all occurrences (default: false) */
	replaceAll?: boolean;
}

/**
 * Search and replace edit collection
 */
export interface SearchReplaceEdits {
	/** Array of search and replace operations to apply */
	operations: SearchReplaceOperation[];
	/** Default case sensitivity for all operations */
	caseSensitive?: boolean;
	/** Default regex pattern mode for all operations */
	regexPattern?: boolean;
	/** Default replace all mode for all operations */
	replaceAll?: boolean;
}

export type BlockOperationType = 'update' | 'insert' | 'delete' | 'move';
export interface BlocksOperation {
	editType: 'blocks';
	operationType?: BlockOperationType;
	index?: number;
	key?: string;
	content?: any;
	position?: number;
	block?: any;
	from?: number;
	to?: number;
	fromKey?: string;
	toPosition?: number;
}

export interface RangeOperation {
	editType: 'range';
	rangeType?: RangeOperationType;
	location?: RangeLocation;
	range?: RangeCharacters;
	text?: string;
	textStyle?: RangeTextStyle;
	paragraphStyle?: RangeParagraphStyle;
	fields?: string;
}

/**
 * Block editing operations using existing Portable Text operations
 */
export interface BlockEdits {
	/** Array of Portable Text operations to apply */
	operations: PortableTextOperation[];
}

// Range operation supporting types
export interface RangeLocation {
	index: number;
	tabId?: string;
}

export interface RangeCharacters {
	startIndex: number;
	endIndex: number;
	tabId?: string;
}

export interface RangeTextStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	fontSize?: number;
	fontFamily?: string;
	color?: string;
	backgroundColor?: string;
	link?: {
		url: string;
		title?: string;
	};
}

export interface RangeParagraphStyle {
	namedStyleType?:
		| 'NORMAL_TEXT'
		| 'HEADING_1'
		| 'HEADING_2'
		| 'HEADING_3'
		| 'HEADING_4'
		| 'HEADING_5'
		| 'HEADING_6'
		| 'BLOCKQUOTE';
	alignment?: 'START' | 'CENTER' | 'END' | 'JUSTIFIED';
	lineSpacing?: number;
	spaceAbove?: number;
	spaceBelow?: number;
	indentation?: {
		firstLine?: number;
		left?: number;
		right?: number;
	};
}

export type RangeOperationType =
	| 'insertText'
	| 'deleteRange'
	| 'replaceRange'
	| 'updateTextStyle'
	| 'updateParagraphStyle';

/**
 * Row operation for structured data editing (tables, CSV, databases)
 */
export interface RowOperation {
	type: 'insert' | 'update' | 'delete';
	rowIndex?: number;
	rowId?: string;
	data?: Record<string, any>;
}

/**
 * Column operation for structured data editing (tables, CSV, databases)
 */
export interface ColumnOperation {
	type: 'insert' | 'update' | 'delete' | 'rename';
	columnIndex?: number;
	columnName?: string;
	newColumnName?: string;
	dataType?: string;
	defaultValue?: any;
}

/**
 * Cell operation for structured data editing (tables, CSV, databases)
 */
export interface CellOperation {
	type: 'update';
	rowIndex?: number;
	rowId?: string;
	columnIndex?: number;
	columnName?: string;
	value: any;
}

/**
 * Structured data editing operations for databases, CSV files, etc.
 */
export interface StructuredDataEdits {
	/** Array of operations to apply to structured data */
	operations: (RowOperation | ColumnOperation | CellOperation)[];
}

// =============================================================================
// OPERATION RESULT TYPES
// =============================================================================

/**
 * Result of a single operation within a tool execution
 */
export interface OperationResult {
	editType: EditType;
	/** Index of the operation in the original operations array */
	operationIndex: number;
	/** Status of the operation */
	status: 'success' | 'failed' | 'skipped';

	message?: string;

	/** Additional details about the operation result */
	details?: {
		matchCount?: number;
		/** Search string for the operation (if applicable) */
		searchText?: any;
		/** Replace value for the operation (if applicable) */
		replaceText?: any;
		/** Previous value before the operation (if applicable) */
		previousValue?: any;
		/** New value after the operation (if applicable) */
		newValue?: any;
		/** Error message if the operation failed */
		errorMessage?: string;
		/** Number of items affected by the operation */
		affectedCount?: number;

		rangeType?: RangeOperationType;
		textLength?: number;
		originalRange?: { startIndex: number; endIndex: number };
		startIndex?: number;
		endIndex?: number;

		charactersDeleted?: number;
		styleFields?: string;
	};
}

export interface SearchReplaceOperationResult {
	operationIndex: number;
	status: 'success' | 'warning';
	message: string;
	success: boolean;
	warnings: string[];
}

export interface SearchReplaceContentResult {
	processedContent: string;
	operationResults: SearchReplaceOperationResult[];
	successfulOperations: SearchReplaceOperation[];
	allOperationsSucceeded: boolean;
	allOperationsFailed: boolean;
}

// =============================================================================
// SHARED RESPONSE DATA TYPES
// =============================================================================

/**
 * Data source information included in tool responses
 */
export interface DataSourceInfo {
	/** Data source connection ID */
	dsConnectionId: string;
	/** Human-readable data source name */
	dsConnectionName: string;
	/** Type of data source provider */
	dsProviderType: DataSourceProviderType;
}

/**
 * Resource update information included in tool responses
 */
export interface ResourceUpdateInfo {
	/** ISO timestamp of last modification */
	lastModified: string;
	/** Resource revision identifier */
	revision: string;
	/** Size of the resource in bytes */
	size: number;
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

export function isSearchReplaceOperation(op: ResourceEditOperation): op is SearchReplaceOperation {
	return op.editType === 'searchReplace';
}

export function isRangeOperation(op: ResourceEditOperation): op is RangeOperation {
	return op.editType === 'range';
}

export function isBlockOperation(op: ResourceEditOperation): op is BlocksOperation {
	return op.editType === 'blocks';
}

/**
 * Type guard to check if content is PlainTextContent
 */
export function isPlainTextContent(content: any): content is PlainTextContent {
	return content &&
		typeof content.content === 'string' &&
		typeof content.expectedLineCount === 'number';
}

/**
 * Type guard to check if content is StructuredContent
 */
export function isStructuredContent(content: any): content is StructuredContent {
	return content &&
		Array.isArray(content.blocks) &&
		typeof content.acknowledgement === 'string';
}

/**
 * Type guard to check if content is BinaryContent
 */
export function isBinaryContent(content: any): content is BinaryContent {
	return content &&
		(content.data instanceof Uint8Array || typeof content.data === 'string') &&
		typeof content.mimeType === 'string';
}
