/**
 * Portable Text conversion functions for Google Docs.
 * Converts between Google Docs' document format and Portable Text specification.
 */
import { logger } from 'shared/logger.ts';
import type {
	GoogleDocument,
	GoogleStructuralElement,
	GoogleParagraph,
	GoogleParagraphElement,
	GoogleTextRun,
	GoogleTextStyle,
	GoogleDocsBatchUpdateRequest,
} from './googledocsClient.ts';
import type { PortableTextBlock, PortableTextSpan } from 'api/types/portableText.types.ts';

// Custom block types for Google Docs-specific content
export interface GoogleDocsCustomBlock extends PortableTextBlock {
	_type: string; // 'googledocs_table', 'googledocs_pagebreak', etc.
	googledocsType: string; // Original Google Docs element type
	googledocsData?: Record<string, unknown>; // Original Google Docs element data
}

export interface GoogleDocsTableBlock extends PortableTextBlock {
	_type: 'googledocs_table';
	rows: number;
	columns: number;
	cells: PortableTextSpan[][];
	googledocsData?: Record<string, unknown>;
}

export interface GoogleDocsBreakBlock extends PortableTextBlock {
	_type: 'googledocs_break';
	breakType: 'page' | 'section' | 'column';
	googledocsData?: Record<string, unknown>;
}

/**
 * Convert Google Docs document to Portable Text format
 * @param document Google Docs document
 * @returns Array of Portable Text blocks
 */
export function convertGoogleDocsToPortableText(document: GoogleDocument): PortableTextBlock[] {
	const portableBlocks: PortableTextBlock[] = [];

	// Add title as a heading block if present
	if (document.title && document.title.trim()) {
		portableBlocks.push({
			_type: 'block',
			_key: generatePortableTextKey('title'),
			style: 'h1',
			children: [
				{
					_type: 'span',
					_key: generatePortableTextKey('title-span'),
					text: document.title,
					marks: [],
				},
			],
		});
	}

	// Process document body content
	if (document.body && document.body.content) {
		for (const element of document.body.content) {
			try {
				const block = convertStructuralElementToPortableText(element);
				if (block) {
					portableBlocks.push(block);
				}
			} catch (error) {
				logger.warn(`Failed to convert Google Docs structural element:`, error);
				// Create a custom block to preserve the content
				portableBlocks.push({
					_type: 'googledocs_unknown',
					_key: generatePortableTextKey('unknown'),
					googledocsType: 'structural_element',
					googledocsData: element,
				} as GoogleDocsCustomBlock);
			}
		}
	}

	return portableBlocks;
}

/**
 * Convert a single Google Docs structural element to Portable Text
 * @param element Google Docs structural element
 * @returns Portable Text block or null if unsupported
 */
function convertStructuralElementToPortableText(element: GoogleStructuralElement): PortableTextBlock | null {
	if (element.paragraph) {
		return convertParagraphToPortableText(element.paragraph);
	}

	if (element.table) {
		return convertTableToPortableText(element.table, element.startIndex);
	}

	if (element.sectionBreak) {
		return {
			_type: 'googledocs_break',
			_key: generatePortableTextKey('section-break'),
			breakType: 'section',
			googledocsData: element.sectionBreak,
		} as GoogleDocsBreakBlock;
	}

	if (element.tableOfContents) {
		return {
			_type: 'googledocs_toc',
			_key: generatePortableTextKey('toc'),
			googledocsType: 'table_of_contents',
			googledocsData: element.tableOfContents,
		} as GoogleDocsCustomBlock;
	}

	return null;
}

/**
 * Convert a Google Docs paragraph to Portable Text
 * @param paragraph Google Docs paragraph
 * @returns Portable Text block
 */
function convertParagraphToPortableText(paragraph: GoogleParagraph): PortableTextBlock {
	const children: PortableTextSpan[] = [];

	// Process paragraph elements
	for (const element of paragraph.elements) {
		if (element.textRun) {
			const span = convertTextRunToPortableTextSpan(element.textRun);
			if (span) {
				children.push(span);
			}
		} else if (element.pageBreak) {
			// Handle page breaks as separate blocks by returning early
			// This is a simplification - in a full implementation you might want to handle this differently
			children.push({
				_type: 'span',
				_key: generatePortableTextKey('pagebreak-span'),
				text: '\n---\n',
				marks: [],
			});
		} else if (element.horizontalRule) {
			children.push({
				_type: 'span',
				_key: generatePortableTextKey('hr-span'),
				text: '---',
				marks: [],
			});
		}
	}

	// Determine block style from paragraph style
	let style = 'normal';
	let listItem: string | undefined;

	if (paragraph.paragraphStyle?.namedStyleType) {
		switch (paragraph.paragraphStyle.namedStyleType) {
			case 'HEADING_1':
				style = 'h1';
				break;
			case 'HEADING_2':
				style = 'h2';
				break;
			case 'HEADING_3':
				style = 'h3';
				break;
			case 'HEADING_4':
				style = 'h4';
				break;
			case 'HEADING_5':
				style = 'h5';
				break;
			case 'HEADING_6':
				style = 'h6';
				break;
			case 'NORMAL_TEXT':
			default:
				style = 'normal';
				break;
		}
	}

	const block: PortableTextBlock = {
		_type: 'block',
		_key: generatePortableTextKey('paragraph'),
		style,
		children,
	};

	if (listItem) {
		block.listItem = listItem;
		block.level = 1; // Google Docs doesn't provide explicit nesting levels in individual elements
	}

	return block;
}

/**
 * Convert a Google Docs text run to Portable Text span
 * @param textRun Google Docs text run
 * @returns Portable Text span or null
 */
function convertTextRunToPortableTextSpan(textRun: GoogleTextRun): PortableTextSpan | null {
	if (!textRun.content) {
		return null;
	}

	const marks: string[] = [];

	// Apply text styling
	if (textRun.textStyle) {
		const style = textRun.textStyle;

		if (style.bold) {
			marks.push('strong');
		}

		if (style.italic) {
			marks.push('em');
		}

		if (style.strikethrough) {
			marks.push('strike-through');
		}

		if (style.underline) {
			marks.push('underline');
		}

		if (style.link?.url) {
			marks.push('link');
		}
	}

	const span: PortableTextSpan = {
		_type: 'span',
		_key: generatePortableTextKey('span'),
		text: textRun.content,
		marks,
	};

	// Store link URL as additional data if present
	if (textRun.textStyle?.link?.url) {
		// deno-lint-ignore no-explicit-any
		(span as any).linkUrl = textRun.textStyle.link.url;
	}

	return span;
}

/**
 * Convert a Google Docs table to Portable Text (simplified representation)
 * @param table Google Docs table
 * @param startIndex Start index for key generation
 * @returns Portable Text table block
 */
function convertTableToPortableText(table: any, startIndex: number): GoogleDocsTableBlock {
	const cells: PortableTextSpan[][] = [];
	const rows = table.rows || 0;
	const columns = table.columns || 0;

	// Simplified table processing - in a full implementation, you'd process table.tableRows
	// For now, create empty cells structure
	for (let r = 0; r < rows; r++) {
		const row: PortableTextSpan[] = [];
		for (let c = 0; c < columns; c++) {
			row.push({
				_type: 'span',
				_key: generatePortableTextKey(`table-cell-${r}-${c}`),
				text: '',
				marks: [],
			});
		}
		cells.push(row);
	}

	return {
		_type: 'googledocs_table',
		_key: generatePortableTextKey(`table-${startIndex}`),
		rows,
		columns,
		cells,
		googledocsData: table,
	};
}

/**
 * Convert Portable Text blocks back to Google Docs batch update requests
 * @param blocks Array of Portable Text blocks
 * @param documentId Google Docs document ID
 * @returns Array of Google Docs batch update requests
 */
export function convertPortableTextToGoogleDocs(
	blocks: PortableTextBlock[],
	documentId: string,
): GoogleDocsBatchUpdateRequest[] {
	const requests: GoogleDocsBatchUpdateRequest[] = [];

	// First, clear existing content (except the first character which is required)
	requests.push({
		deleteContentRange: {
			range: {
				startIndex: 1,
				endIndex: -1, // This would need to be determined from the current document
			},
		},
	});

	let currentIndex = 1; // Start after the required first character

	for (const block of blocks) {
		try {
			const blockRequests = convertPortableTextBlockToGoogleDocsRequests(block, currentIndex);
			requests.push(...blockRequests.requests);
			currentIndex = blockRequests.nextIndex;
		} catch (error) {
			logger.warn(`Failed to convert Portable Text block ${block._key} to Google Docs:`, error);
			// Skip blocks that can't be converted
			continue;
		}
	}

	return requests;
}

/**
 * Convert a single Portable Text block to Google Docs batch update requests
 * @param block Portable Text block
 * @param startIndex Starting index for insertions
 * @returns Object with requests array and next index
 */
function convertPortableTextBlockToGoogleDocsRequests(
	block: PortableTextBlock,
	startIndex: number,
): { requests: GoogleDocsBatchUpdateRequest[]; nextIndex: number } {
	const requests: GoogleDocsBatchUpdateRequest[] = [];
	let currentIndex = startIndex;

	switch (block._type) {
		case 'block':
			return convertPortableTextBlockByStyle(block, currentIndex);

		case 'googledocs_break': {
			const breakBlock = block as GoogleDocsBreakBlock;
			if (breakBlock.breakType === 'page') {
				requests.push({
					insertPageBreak: {
						location: { index: currentIndex },
					},
				});
				currentIndex += 1; // Page break takes 1 character
			}
			break;
		}

		case 'googledocs_table': {
			const tableBlock = block as GoogleDocsTableBlock;
			requests.push({
				insertTable: {
					location: { index: currentIndex },
					rows: tableBlock.rows,
					columns: tableBlock.columns,
				},
			});
			currentIndex += 2; // Table insertion typically adds 2 characters
			break;
		}

		default:
			// Handle unknown block types by converting to plain text
			if (block.children) {
				const text = block.children
					.map((child) => child._type === 'span' ? child.text : '')
					.join('');
				
				if (text) {
					requests.push({
						insertText: {
							location: { index: currentIndex },
							text: text + '\n',
						},
					});
					currentIndex += text.length + 1;
				}
			}
			break;
	}

	return { requests, nextIndex: currentIndex };
}

/**
 * Convert Portable Text block by style to Google Docs requests
 * @param block Portable Text block
 * @param startIndex Starting index
 * @returns Object with requests array and next index
 */
function convertPortableTextBlockByStyle(
	block: PortableTextBlock,
	startIndex: number,
): { requests: GoogleDocsBatchUpdateRequest[]; nextIndex: number } {
	const requests: GoogleDocsBatchUpdateRequest[] = [];
	let currentIndex = startIndex;

	// Extract text content from children
	const textContent = block.children
		?.map((child) => child._type === 'span' ? child.text : '')
		.join('') || '';

	if (!textContent.trim()) {
		return { requests, nextIndex: currentIndex };
	}

	// Insert the text
	const textWithNewline = textContent + '\n';
	requests.push({
		insertText: {
			location: { index: currentIndex },
			text: textWithNewline,
		},
	});

	const textStartIndex = currentIndex;
	const textEndIndex = currentIndex + textContent.length;
	currentIndex += textWithNewline.length;

	// Apply paragraph style for headings
	if (block.style && block.style !== 'normal') {
		let namedStyleType = 'NORMAL_TEXT';
		
		switch (block.style) {
			case 'h1':
				namedStyleType = 'HEADING_1';
				break;
			case 'h2':
				namedStyleType = 'HEADING_2';
				break;
			case 'h3':
				namedStyleType = 'HEADING_3';
				break;
			case 'h4':
				namedStyleType = 'HEADING_4';
				break;
			case 'h5':
				namedStyleType = 'HEADING_5';
				break;
			case 'h6':
				namedStyleType = 'HEADING_6';
				break;
		}

		if (namedStyleType !== 'NORMAL_TEXT') {
			requests.push({
				updateParagraphStyle: {
					range: {
						startIndex: textStartIndex,
						endIndex: textEndIndex,
					},
					paragraphStyle: {
						namedStyleType,
					},
					fields: 'namedStyleType',
				},
			});
		}
	}

	// Apply text formatting from spans
	if (block.children) {
		let spanStartIndex = textStartIndex;
		
		for (const child of block.children) {
			if (child._type === 'span' && child.marks && child.marks.length > 0) {
				const spanEndIndex = spanStartIndex + child.text.length;
				const textStyle: GoogleTextStyle = {};
				
				// Apply marks
				if (child.marks.includes('strong')) {
					textStyle.bold = true;
				}
				if (child.marks.includes('em')) {
					textStyle.italic = true;
				}
				if (child.marks.includes('strike-through')) {
					textStyle.strikethrough = true;
				}
				if (child.marks.includes('underline')) {
					textStyle.underline = true;
				}
				if (child.marks.includes('link')) {
					// deno-lint-ignore no-explicit-any
					const linkUrl = (child as any).linkUrl;
					if (linkUrl) {
						textStyle.link = { url: linkUrl };
					}
				}

				// Build fields string
				const fields: string[] = [];
				if (textStyle.bold) fields.push('bold');
				if (textStyle.italic) fields.push('italic');
				if (textStyle.strikethrough) fields.push('strikethrough');
				if (textStyle.underline) fields.push('underline');
				if (textStyle.link) fields.push('link');

				if (fields.length > 0) {
					requests.push({
						updateTextStyle: {
							range: {
								startIndex: spanStartIndex,
								endIndex: spanEndIndex,
							},
							textStyle,
							fields: fields.join(','),
						},
					});
				}
			}
			
			spanStartIndex += child.text.length;
		}
	}

	return { requests, nextIndex: currentIndex };
}

/**
 * Helper function to generate a unique key for blocks/spans
 * @param prefix Prefix for the key
 * @returns Unique key string
 */
export function generatePortableTextKey(prefix: string = 'block'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate that a Portable Text structure is well-formed for Google Docs
 * @param blocks Array of Portable Text blocks
 * @returns True if valid, false otherwise
 */
export function validatePortableTextForGoogleDocs(blocks: PortableTextBlock[]): boolean {
	if (!Array.isArray(blocks)) {
		logger.warn('Portable Text structure must be an array');
		return false;
	}

	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];

		if (!block._type) {
			logger.warn(`Block at index ${i} is missing _type`);
			return false;
		}

		if (block._type === 'block' && !Array.isArray(block.children)) {
			logger.warn(`Block at index ${i} with _type 'block' must have children array`);
			return false;
		}

		if (block.children) {
			for (let j = 0; j < block.children.length; j++) {
				const span = block.children[j];
				if (span._type !== 'span') {
					logger.warn(`Child at index ${j} in block ${i} must have _type 'span'`);
					return false;
				}
				if (typeof span.text !== 'string') {
					logger.warn(`Span at index ${j} in block ${i} must have a text property`);
					return false;
				}
			}
		}
	}

	return true;
}

/**
 * Extract plain text from Portable Text blocks
 * @param blocks Array of Portable Text blocks
 * @returns Plain text representation
 */
export function extractTextFromPortableText(blocks: PortableTextBlock[]): string {
	const textParts: string[] = [];

	for (const block of blocks) {
		if (block.children) {
			const blockText = block.children
				.map((child) => child._type === 'span' ? child.text : '')
				.join('');

			if (blockText.trim()) {
				textParts.push(blockText);
			}
		}
	}

	return textParts.join('\n\n');
}