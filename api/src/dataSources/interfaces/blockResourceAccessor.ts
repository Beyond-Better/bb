/**
 * Interface definitions for Block Resource Accessor and Portable Text operations.
 * 
 * The BlockResourceAccessor interface provides access to structured document content
 * using the Portable Text format, enabling block-level editing operations across
 * different data sources that support structured content.
 */

/**
 * Portable Text block representation
 * Based on the Portable Text specification for structured content
 */
export interface PortableTextBlock {
	/** Block type identifier */
	_type: string;
	/** Unique identifier for the block */
	_key: string;
	/** Block style (e.g., 'normal', 'h1', 'h2', 'h3', 'blockquote') */
	style?: string;
	/** Array of text spans for block-type elements */
	children?: PortableTextSpan[];
	/** Additional block-specific properties */
	[key: string]: any;
}

/**
 * Portable Text span representation
 * Represents a segment of text with optional formatting
 */
export interface PortableTextSpan {
	/** Span type (always 'span') */
	_type: 'span';
	/** Unique identifier for the span */
	_key: string;
	/** Text content of the span */
	text: string;
	/** Text formatting marks (e.g., 'strong', 'em', 'code') */
	marks?: string[];
}

/**
 * Portable Text operation types for block editing
 */
export interface PortableTextOperation {
	/** Type of operation to perform */
	type: 'update' | 'insert' | 'delete' | 'move';
	
	// For update operations
	/** Block index for update operations (0-based) */
	index?: number;
	/** Block key for targeting specific blocks (alternative to index) */
	_key?: string;
	/** New block content for update operations */
	content?: PortableTextBlock;
	
	// For insert operations
	/** Position for insert operations (0-based index) */
	position?: number;
	/** Block to insert for insert operations */
	block?: PortableTextBlock;
	
	// For delete operations - use index or _key
	
	// For move operations
	/** Source index for move operations */
	from?: number;
	/** Target index for move operations */
	to?: number;
	/** Source block key for move operations (alternative to from) */
	fromKey?: string;
	/** Target position for move operations (alternative to to) */
	toPosition?: number;
}

/**
 * Result of a Portable Text operation
 */
export interface PortableTextOperationResult {
	/** Index of the operation in the original operations array */
	operationIndex: number;
	/** Type of operation that was performed */
	type: PortableTextOperation['type'];
	/** Whether the operation succeeded */
	success: boolean;
	/** Human-readable message describing the result */
	message: string;
	/** Error message if the operation failed */
	error?: string;
	/** Original index of the affected block (for update, delete, move operations) */
	originalIndex?: number;
	/** New index of the affected block (for insert, move operations) */
	newIndex?: number;
	/** Key of the affected block */
	affectedKey?: string;
}

/**
 * Interface for data source accessors that support block-level editing operations.
 * 
 * This interface enables structured document editing using the Portable Text format,
 * providing a consistent API for block operations across different data sources
 * such as Notion, Contentful, or other structured content platforms.
 * 
 * ## Purpose
 * - Abstracts block editing operations from specific data source implementations
 * - Provides a standardized way to work with structured content
 * - Enables consistent block operations across different platforms
 * 
 * ## Portable Text Format
 * Uses the Portable Text specification which represents structured content as an
 * array of blocks, where each block can contain styled text spans and metadata.
 * This format is platform-agnostic and can be converted to/from various formats.
 * 
 * ## Error Handling
 * Implementations should:
 * - Return operation results with success/failure status rather than throwing
 * - Provide meaningful error messages for failed operations
 * - Handle partial failures gracefully (some operations succeed, others fail)
 * - Validate operations before applying them
 * 
 * ## Thread Safety
 * Implementations should handle concurrent access appropriately for their
 * underlying data source, potentially using optimistic locking or other
 * conflict resolution strategies.
 */
export interface BlockResourceAccessor {
	/**
	 * Retrieve a document's content as Portable Text blocks.
	 * 
	 * This method fetches the structured content of a document and converts it
	 * to the Portable Text format for consistent processing across data sources.
	 * 
	 * @param resourceUri - URI of the document resource to retrieve
	 * @returns Promise resolving to an array of Portable Text blocks
	 * @throws Error if the resource cannot be accessed or converted
	 * 
	 * @example
	 * ```typescript
	 * const blocks = await accessor.getDocumentAsPortableText('notion://page/123abc');
	 * console.log(`Document has ${blocks.length} blocks`);
	 * ```
	 */
	getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]>;

	/**
	 * Apply a sequence of operations to modify document blocks.
	 * 
	 * Operations are applied in the order provided. If any operation fails,
	 * the method continues with remaining operations and returns results for all.
	 * This allows for partial success scenarios and detailed error reporting.
	 * 
	 * @param resourceUri - URI of the document resource to modify
	 * @param operations - Array of operations to apply in sequence
	 * @returns Promise resolving to an array of operation results
	 * @throws Error only for system-level failures (network, auth, etc.)
	 * 
	 * @example
	 * ```typescript
	 * const operations = [
	 *   {
	 *     type: 'update',
	 *     index: 0,
	 *     content: {
	 *       _type: 'block',
	 *       _key: 'block-1',
	 *       style: 'h1',
	 *       children: [{ _type: 'span', _key: 'span-1', text: 'New Title' }]
	 *     }
	 *   }
	 * ];
	 * 
	 * const results = await accessor.applyPortableTextOperations(
	 *   'notion://page/123abc',
	 *   operations
	 * );
	 * 
	 * results.forEach(result => {
	 *   console.log(`Operation ${result.operationIndex}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
	 *   console.log(`  ${result.message}`);
	 * });
	 * ```
	 */
	applyPortableTextOperations(
		resourceUri: string,
		operations: PortableTextOperation[]
	): Promise<PortableTextOperationResult[]>;
}