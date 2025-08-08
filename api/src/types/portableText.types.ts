/**
 * Portable Text block representation
 * Based on the Portable Text specification for structured content
 */
export interface PortableTextBlock {
	/** Block type identifier */
	_type: string;
	/** Unique identifier for the block */
	_key: string;
	style?: string;
	listItem?: string;
	level?: number;
	/** Array of text spans for block-type elements */
	children?: PortableTextSpan[];
	/** Additional block-specific properties */
	[key: string]: unknown; // Allow additional properties
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

// Enhanced PortableText for rich content (extends existing types)
export interface EnhancedPortableTextBlock extends PortableTextBlock {
	// Additional properties for rich formatting
	paragraphStyle?: {
		alignment?: 'left' | 'center' | 'right' | 'justify';
		backgroundColor?: string;
		spacing?: { above?: number; below?: number };
		indentation?: { first?: number; left?: number; right?: number };
	};

	// Table support
	table?: {
		rows: number;
		columns: number;
		cells: any[][]; //EnhancedTableCell[][];
	};
}

export interface EnhancedPortableTextSpan extends PortableTextSpan {
	// Enhanced text formatting
	textStyle?: {
		color?: string;
		backgroundColor?: string;
		fontSize?: number;
		fontFamily?: string;
	};
}
