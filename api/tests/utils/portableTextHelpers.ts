/**
 * Portable Text test utilities
 * 
 * Helper functions for creating and validating Portable Text blocks in tests.
 * These utilities provide a consistent way to generate test data for block editing operations.
 */

import type { PortableTextBlock, PortableTextSpan } from 'api/dataSources/interfaces/blockResourceAccessor.ts';

/**
 * Generate a unique key for Portable Text elements
 * @param prefix - Optional prefix for the key
 * @returns A unique key string
 */
export function generateTestKey(prefix: string = 'test'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a Portable Text block with the specified content
 * 
 * @param text - The text content for the block
 * @param style - Block style (default: 'normal')
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A complete PortableTextBlock
 * 
 * @example
 * ```typescript
 * const block = createPortableTextBlock('Hello world', 'normal');
 * ```
 */
export function createPortableTextBlock(
	text: string,
	style: string = 'normal',
	_key?: string
): PortableTextBlock {
	const blockKey = _key || generateTestKey('block');
	const spanKey = generateTestKey('span');

	return {
		_type: 'block',
		_key: blockKey,
		style,
		children: [
			{
				_type: 'span',
				_key: spanKey,
				text,
			},
		],
	};
}

/**
 * Create a Portable Text span with the specified content and formatting
 * 
 * @param text - The text content for the span
 * @param marks - Optional formatting marks (e.g., ['strong', 'em'])
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A complete PortableTextSpan
 * 
 * @example
 * ```typescript
 * const span = createPortableTextSpan('Bold text', ['strong']);
 * ```
 */
export function createPortableTextSpan(
	text: string,
	marks?: string[],
	_key?: string
): PortableTextSpan {
	return {
		_type: 'span',
		_key: _key || generateTestKey('span'),
		text,
		marks,
	};
}

/**
 * Create a heading block of the specified level
 * 
 * @param level - Heading level (1-6)
 * @param text - The heading text
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock configured as a heading
 * 
 * @example
 * ```typescript
 * const heading = createHeading(1, 'Main Title');
 * const subheading = createHeading(2, 'Subtitle');
 * ```
 */
export function createHeading(level: number, text: string, _key?: string): PortableTextBlock {
	if (level < 1 || level > 6) {
		throw new Error(`Invalid heading level: ${level}. Must be between 1 and 6.`);
	}

	return createPortableTextBlock(text, `h${level}`, _key);
}

/**
 * Create a normal paragraph block
 * 
 * @param text - The paragraph text
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock configured as a normal paragraph
 * 
 * @example
 * ```typescript
 * const paragraph = createParagraph('This is a paragraph of text.');
 * ```
 */
export function createParagraph(text: string, _key?: string): PortableTextBlock {
	return createPortableTextBlock(text, 'normal', _key);
}

/**
 * Create a code block with optional language specification
 * 
 * @param code - The code content
 * @param language - Optional programming language identifier
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock configured as a code block
 * 
 * @example
 * ```typescript
 * const codeBlock = createCodeBlock('console.log("Hello");', 'javascript');
 * const genericCode = createCodeBlock('some code');
 * ```
 */
export function createCodeBlock(code: string, language?: string, _key?: string): PortableTextBlock {
	const block: PortableTextBlock = {
		_type: 'code',
		_key: _key || generateTestKey('code'),
		children: [
			{
				_type: 'span',
				_key: generateTestKey('span'),
				text: code,
			},
		],
	};

	if (language) {
		block.language = language;
	}

	return block;
}

/**
 * Create a blockquote block
 * 
 * @param text - The quoted text
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock configured as a blockquote
 * 
 * @example
 * ```typescript
 * const quote = createBlockquote('This is a quote from someone.');
 * ```
 */
export function createBlockquote(text: string, _key?: string): PortableTextBlock {
	return createPortableTextBlock(text, 'blockquote', _key);
}

/**
 * Create a list item block
 * 
 * @param text - The list item text
 * @param listType - Type of list ('bullet' or 'number')
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock configured as a list item
 * 
 * @example
 * ```typescript
 * const bulletItem = createListItem('First item', 'bullet');
 * const numberItem = createListItem('First item', 'number');
 * ```
 */
export function createListItem(text: string, listType: 'bullet' | 'number' = 'bullet', _key?: string): PortableTextBlock {
	const style = listType === 'bullet' ? 'bulletList' : 'numberList';
	return createPortableTextBlock(text, style, _key);
}

/**
 * Create a complex block with multiple spans and formatting
 * 
 * @param spans - Array of span configurations
 * @param style - Block style (default: 'normal')
 * @param _key - Unique key (auto-generated if not provided)
 * @returns A PortableTextBlock with multiple spans
 * 
 * @example
 * ```typescript
 * const complexBlock = createComplexBlock([
 *   { text: 'This is ', marks: [] },
 *   { text: 'bold', marks: ['strong'] },
 *   { text: ' and ', marks: [] },
 *   { text: 'italic', marks: ['em'] },
 *   { text: ' text.', marks: [] }
 * ]);
 * ```
 */
export function createComplexBlock(
	spans: Array<{ text: string; marks?: string[] }>,
	style: string = 'normal',
	_key?: string
): PortableTextBlock {
	return {
		_type: 'block',
		_key: _key || generateTestKey('block'),
		style,
		children: spans.map(span => createPortableTextSpan(span.text, span.marks)),
	};
}

/**
 * Basic validation for a Portable Text block
 * 
 * Checks that the block has the required properties and structure.
 * This is a basic validation - more comprehensive validation would
 * check the entire Portable Text specification.
 * 
 * @param block - The object to validate
 * @returns True if the block appears to be valid, false otherwise
 * 
 * @example
 * ```typescript
 * const block = createParagraph('Test');
 * const isValid = validatePortableTextBlock(block); // true
 * 
 * const invalid = { _type: 'block' }; // missing _key
 * const isInvalid = validatePortableTextBlock(invalid); // false
 * ```
 */
export function validatePortableTextBlock(block: any): boolean {
	// Check basic structure
	if (!block || typeof block !== 'object') {
		return false;
	}

	// Check required properties
	if (!block._type || typeof block._type !== 'string') {
		return false;
	}

	if (!block._key || typeof block._key !== 'string') {
		return false;
	}

	// Check children if present
	if (block.children) {
		if (!Array.isArray(block.children)) {
			return false;
		}

		for (const child of block.children) {
			if (!validatePortableTextSpan(child)) {
				return false;
			}
		}
	}

	return true;
}

/**
 * Basic validation for a Portable Text span
 * 
 * @param span - The object to validate
 * @returns True if the span appears to be valid, false otherwise
 */
export function validatePortableTextSpan(span: any): boolean {
	if (!span || typeof span !== 'object') {
		return false;
	}

	// Check required properties
	if (span._type !== 'span') {
		return false;
	}

	if (!span._key || typeof span._key !== 'string') {
		return false;
	}

	if (typeof span.text !== 'string') {
		return false;
	}

	// Check marks if present
	if (span.marks && !Array.isArray(span.marks)) {
		return false;
	}

	return true;
}

/**
 * Create a document with multiple blocks for testing
 * 
 * @param blockCount - Number of blocks to create (default: 3)
 * @returns Array of PortableTextBlocks representing a test document
 * 
 * @example
 * ```typescript
 * const document = createTestDocument(5);
 * console.log(`Created document with ${document.length} blocks`);
 * ```
 */
export function createTestDocument(blockCount: number = 3): PortableTextBlock[] {
	const blocks: PortableTextBlock[] = [];

	for (let i = 0; i < blockCount; i++) {
		switch (i % 4) {
			case 0:
				blocks.push(createHeading(1, `Heading ${i + 1}`));
				break;
			case 1:
				blocks.push(createParagraph(`This is paragraph ${i + 1} with some test content.`));
				break;
			case 2:
				blocks.push(createCodeBlock(`console.log("Block ${i + 1}");`, 'javascript'));
				break;
			case 3:
				blocks.push(createBlockquote(`Quote from block ${i + 1}`));
				break;
		}
	}

	return blocks;
}