/**
 * Utility for converting Google Docs documents to Markdown.
 */
import { logger } from 'shared/logger.ts';
import type {
	GoogleDocument,
	GoogleParagraph,
	GoogleStructuralElement,
	GoogleTable,
	GoogleTableCell,
	GoogleTableRow,
	//GoogleParagraphElement,
	GoogleTextRun,
} from './googledocs.types.ts';

/**
 * Options for Google Docs to Markdown conversion
 */
export interface GoogleDocsToMarkdownOptions {
	/**
	 * Whether to include the document title as a header
	 */
	includeTitle?: boolean;

	/**
	 * Maximum heading level
	 */
	maxHeadingLevel?: number;

	/**
	 * Whether to include metadata about the document
	 */
	includeMetadata?: boolean;

	/**
	 * Whether to render tables as markdown tables
	 */
	renderTables?: boolean;

	/**
	 * Whether to preserve page breaks as horizontal rules
	 */
	preservePageBreaks?: boolean;

	/**
	 * Whether to preserve section breaks
	 */
	preserveSectionBreaks?: boolean;

	/**
	 * Custom line break character(s)
	 */
	lineBreak?: string;
}

/**
 * Default conversion options
 */
const DEFAULT_OPTIONS: GoogleDocsToMarkdownOptions = {
	includeTitle: true,
	maxHeadingLevel: 6,
	includeMetadata: false,
	renderTables: true,
	preservePageBreaks: true,
	preserveSectionBreaks: true,
	lineBreak: '\n',
};

/**
 * Convert a Google Docs document to Markdown
 * @param document Google Docs document object
 * @param options Conversion options
 * @returns Markdown string
 */
export function googledocsToMarkdown(
	document: GoogleDocument,
	options: GoogleDocsToMarkdownOptions = {},
): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const markdown: string[] = [];

	// Add document title if requested
	if (opts.includeTitle && document.title) {
		const title = document.title.trim();
		if (title) {
			markdown.push(`# ${title}${opts.lineBreak}`);
		}
	}

	// Add document metadata if requested
	if (opts.includeMetadata) {
		markdown.push(`> Document ID: ${document.documentId}  `);
		if (document.revisionId) {
			markdown.push(`> Revision: ${document.revisionId}  `);
		}
		markdown.push(`> Last processed: ${new Date().toLocaleString()}${opts.lineBreak}`);
	}

	// Convert each structural element to markdown
	if (document.body && document.body.content) {
		for (let i = 0; i < document.body.content.length; i++) {
			const element = document.body.content[i];

			try {
				const elementMd = structuralElementToMarkdown(element, document.body.content, i, opts);
				if (elementMd) {
					markdown.push(elementMd);
				}
			} catch (error) {
				logger.warn(`Failed to convert Google Docs structural element at index ${i}:`, error);
				markdown.push(`<!-- Failed to convert structural element of type ${getElementType(element)} -->`);
			}
		}
	}

	return markdown.join(opts.lineBreak);
}

/**
 * Get the type of a structural element for error reporting
 * @param element Structural element
 * @returns Element type as string
 */
function getElementType(element: GoogleStructuralElement): string {
	if (element.paragraph) return 'paragraph';
	if (element.table) return 'table';
	if (element.sectionBreak) return 'sectionBreak';
	if (element.tableOfContents) return 'tableOfContents';
	return 'unknown';
}

/**
 * Convert a Google Docs structural element to Markdown
 * @param element The structural element to convert
 * @param allElements All structural elements (for context)
 * @param index Index of the current element
 * @param options Conversion options
 * @returns Markdown string for the element
 */
function structuralElementToMarkdown(
	element: GoogleStructuralElement,
	_allElements: GoogleStructuralElement[],
	_index: number,
	options: GoogleDocsToMarkdownOptions,
): string {
	if (element.paragraph) {
		return paragraphToMarkdown(element.paragraph, options);
	}

	if (element.table) {
		if (options.renderTables) {
			return tableToMarkdown(element.table, options);
		} else {
			return '*(Table content not rendered)*';
		}
	}

	if (element.sectionBreak) {
		if (options.preserveSectionBreaks) {
			return '---'; // Horizontal rule for section breaks
		}
		return '';
	}

	if (element.tableOfContents) {
		return '*(Table of Contents)*';
	}

	return '';
}

/**
 * Convert a Google Docs paragraph to Markdown
 * @param paragraph The paragraph to convert
 * @param options Conversion options
 * @returns Markdown representation
 */
function paragraphToMarkdown(paragraph: GoogleParagraph, options: GoogleDocsToMarkdownOptions): string {
	const parts: string[] = [];

	// Process paragraph elements
	for (const element of paragraph.elements) {
		if (element.textRun) {
			const text = textRunToMarkdown(element.textRun);
			if (text) {
				parts.push(text);
			}
		} else if (element.pageBreak) {
			if (options.preservePageBreaks) {
				parts.push(`${options.lineBreak}---${options.lineBreak}`); // Page break as horizontal rule
			}
		} else if (element.columnBreak) {
			parts.push(`${options.lineBreak}<!-- Column Break -->${options.lineBreak}`);
		} else if (element.horizontalRule) {
			parts.push('---');
		} else if (element.footnoteReference) {
			// Simplified footnote handling
			parts.push(`[^${element.footnoteReference.footnoteNumber || 'fn'}]`);
		} else if (element.equation) {
			// Basic equation handling - would need more sophisticated processing
			parts.push('*(Mathematical Equation)*');
		}
	}

	let result = parts.join('');

	// Apply paragraph-level formatting based on style
	const style = paragraph.paragraphStyle;
	if (style?.namedStyleType) {
		const headingLevel = getHeadingLevel(style.namedStyleType, options.maxHeadingLevel || 6);
		if (headingLevel > 0) {
			const prefix = '#'.repeat(headingLevel);
			result = `${prefix} ${result}`;
		}
	}

	// Handle bullet points and numbered lists
	// Note: Google Docs doesn't always provide explicit list information in paragraph style
	// This would require more sophisticated processing of document structure

	return result;
}

/**
 * Get heading level from Google Docs named style type
 * @param namedStyleType The named style type
 * @param maxLevel Maximum allowed heading level
 * @returns Heading level (1-6) or 0 if not a heading
 */
function getHeadingLevel(namedStyleType: string, maxLevel: number): number {
	switch (namedStyleType) {
		case 'HEADING_1':
			return Math.min(1, maxLevel);
		case 'HEADING_2':
			return Math.min(2, maxLevel);
		case 'HEADING_3':
			return Math.min(3, maxLevel);
		case 'HEADING_4':
			return Math.min(4, maxLevel);
		case 'HEADING_5':
			return Math.min(5, maxLevel);
		case 'HEADING_6':
			return Math.min(6, maxLevel);
		default:
			return 0;
	}
}

/**
 * Convert a Google Docs text run to Markdown
 * @param textRun The text run to convert
 * @returns Markdown representation
 */
function textRunToMarkdown(textRun: GoogleTextRun): string {
	let text = textRun.content;

	// Apply text styling
	if (textRun.textStyle) {
		const style = textRun.textStyle;

		// Apply formatting in order (innermost to outermost)
		if (style.bold) {
			text = `**${text}**`;
		}

		if (style.italic) {
			text = `*${text}*`;
		}

		if (style.strikethrough) {
			text = `~~${text}~~`;
		}

		// Handle underline - markdown doesn't have native underline, so we use HTML
		if (style.underline && !style.link) {
			text = `<u>${text}</u>`;
		}

		// Handle small caps - use CSS styling
		if (style.smallCaps) {
			text = `<span style="font-variant: small-caps">${text}</span>`;
		}

		// Handle links (links override other formatting for the display)
		if (style.link?.url) {
			// Extract the original text without markdown formatting for the link text
			const linkText = textRun.content;
			text = `[${linkText}](${style.link.url})`;
		}

		// Handle background color (simplified)
		if (style.backgroundColor?.color?.rgbColor) {
			const rgb = style.backgroundColor.color.rgbColor;
			const bgColor = rgbToHex(rgb.red || 0, rgb.green || 0, rgb.blue || 0);
			text = `<mark style="background-color: ${bgColor}">${text}</mark>`;
		}

		// Handle text color (simplified)
		if (style.foregroundColor?.color?.rgbColor) {
			const rgb = style.foregroundColor.color.rgbColor;
			const textColor = rgbToHex(rgb.red || 0, rgb.green || 0, rgb.blue || 0);
			text = `<span style="color: ${textColor}">${text}</span>`;
		}
	}

	return text;
}

/**
 * Convert RGB values to hex color string
 * @param r Red component (0-1)
 * @param g Green component (0-1)
 * @param b Blue component (0-1)
 * @returns Hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
	const toHex = (n: number) => {
		const hex = Math.round(n * 255).toString(16);
		return hex.length === 1 ? '0' + hex : hex;
	};
	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert a Google Docs table to Markdown
 * @param table The table to convert
 * @param options Conversion options
 * @returns Markdown table representation
 */
function tableToMarkdown(table: GoogleTable, options: GoogleDocsToMarkdownOptions): string {
	if (!table.tableRows || table.tableRows.length === 0) {
		return '*(Empty Table)*';
	}

	const rows: string[] = [];
	const tableRows = table.tableRows;

	// Process each table row
	for (let rowIndex = 0; rowIndex < tableRows.length; rowIndex++) {
		const tableRow = tableRows[rowIndex];
		const row = tableRowToMarkdown(tableRow, options);
		if (row) {
			rows.push(row);
		}

		// Add header separator after first row (assuming first row is header)
		if (rowIndex === 0 && tableRows.length > 1) {
			const columnCount = tableRow.tableCells?.length || 0;
			const separator = '|' + ' --- |'.repeat(columnCount);
			rows.push(separator);
		}
	}

	return rows.join(options.lineBreak || '\n');
}

/**
 * Convert a Google Docs table row to Markdown
 * @param tableRow The table row to convert
 * @param options Conversion options
 * @returns Markdown table row representation
 */
function tableRowToMarkdown(tableRow: GoogleTableRow, options: GoogleDocsToMarkdownOptions): string {
	if (!tableRow.tableCells || tableRow.tableCells.length === 0) {
		return '';
	}

	const cells: string[] = [];

	for (const tableCell of tableRow.tableCells) {
		const cellContent = tableCellToMarkdown(tableCell, options);
		cells.push(cellContent);
	}

	return `| ${cells.join(' | ')} |`;
}

/**
 * Convert a Google Docs table cell to Markdown
 * @param tableCell The table cell to convert
 * @param options Conversion options
 * @returns Markdown cell content
 */
function tableCellToMarkdown(tableCell: GoogleTableCell, _options: GoogleDocsToMarkdownOptions): string {
	if (!tableCell.content || tableCell.content.length === 0) {
		return '';
	}

	const cellParts: string[] = [];

	// Process cell content (which are structural elements)
	for (const element of tableCell.content) {
		if (element.paragraph) {
			// For table cells, we want inline content without paragraph breaks
			const cellText = paragraphToInlineMarkdown(element.paragraph);
			if (cellText) {
				cellParts.push(cellText);
			}
		}
	}

	// Join cell content and escape pipe characters
	return cellParts.join(' ').replace(/\|/g, '\\|');
}

/**
 * Convert a paragraph to inline Markdown (no block-level formatting)
 * @param paragraph The paragraph to convert
 * @returns Inline Markdown representation
 */
function paragraphToInlineMarkdown(paragraph: GoogleParagraph): string {
	const parts: string[] = [];

	// Process paragraph elements
	for (const element of paragraph.elements) {
		if (element.textRun) {
			const text = textRunToMarkdown(element.textRun);
			if (text) {
				parts.push(text);
			}
		}
		// Skip other element types in inline context
	}

	return parts.join('');
}

/**
 * Extract plain text from a Google Docs document
 * @param document Google Docs document
 * @returns Plain text representation
 */
export function extractPlainTextFromGoogleDocs(document: GoogleDocument): string {
	const textParts: string[] = [];

	// Add title
	if (document.title) {
		textParts.push(document.title);
		textParts.push(''); // Empty line after title
	}

	// Process document body
	if (document.body && document.body.content) {
		for (const element of document.body.content) {
			const text = extractTextFromStructuralElement(element);
			if (text.trim()) {
				textParts.push(text);
			}
		}
	}

	return textParts.join('\n');
}

/**
 * Extract plain text from a structural element
 * @param element Structural element
 * @returns Plain text
 */
function extractTextFromStructuralElement(element: GoogleStructuralElement): string {
	if (element.paragraph) {
		return extractTextFromParagraph(element.paragraph);
	}

	if (element.table) {
		return extractTextFromTable(element.table);
	}

	return '';
}

/**
 * Extract plain text from a paragraph
 * @param paragraph Paragraph element
 * @returns Plain text
 */
function extractTextFromParagraph(paragraph: GoogleParagraph): string {
	const textParts: string[] = [];

	for (const element of paragraph.elements) {
		if (element.textRun) {
			textParts.push(element.textRun.content);
		}
	}

	return textParts.join('');
}

/**
 * Extract plain text from a table
 * @param table Table element
 * @returns Plain text representation of table
 */
function extractTextFromTable(table: GoogleTable): string {
	if (!table.tableRows) {
		return '';
	}

	const textParts: string[] = [];

	for (const tableRow of table.tableRows) {
		if (tableRow.tableCells) {
			const rowText = tableRow.tableCells
				.map((cell) => {
					if (cell.content) {
						return cell.content
							.map((element) => extractTextFromStructuralElement(element))
							.join(' ')
							.trim();
					}
					return '';
				})
				.filter((text) => text.length > 0)
				.join('\t'); // Tab-separated values

			if (rowText) {
				textParts.push(rowText);
			}
		}
	}

	return textParts.join('\n');
}

/**
 * Get document statistics
 * @param document Google Docs document
 * @returns Document statistics object
 */
export function getDocumentStatistics(document: GoogleDocument): {
	characterCount: number;
	wordCount: number;
	paragraphCount: number;
	headingCount: number;
	tableCount: number;
} {
	const stats = {
		characterCount: 0,
		wordCount: 0,
		paragraphCount: 0,
		headingCount: 0,
		tableCount: 0,
	};

	if (document.title) {
		stats.characterCount += document.title.length;
		stats.wordCount += document.title.split(/\s+/).filter((word) => word.length > 0).length;
	}

	if (document.body && document.body.content) {
		for (const element of document.body.content) {
			if (element.paragraph) {
				stats.paragraphCount++;

				// Check if it's a heading
				if (element.paragraph.paragraphStyle?.namedStyleType?.startsWith('HEADING_')) {
					stats.headingCount++;
				}

				// Count text
				for (const paragraphElement of element.paragraph.elements) {
					if (paragraphElement.textRun) {
						const text = paragraphElement.textRun.content;
						stats.characterCount += text.length;
						stats.wordCount += text.split(/\s+/).filter((word) => word.length > 0).length;
					}
				}
			} else if (element.table) {
				stats.tableCount++;

				// Count table text
				if (element.table.tableRows) {
					for (const tableRow of element.table.tableRows) {
						if (tableRow.tableCells) {
							for (const tableCell of tableRow.tableCells) {
								if (tableCell.content) {
									for (const cellElement of tableCell.content) {
										const cellText = extractTextFromStructuralElement(cellElement);
										stats.characterCount += cellText.length;
										stats.wordCount += cellText.split(/\s+/).filter((word) =>
											word.length > 0
										).length;
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return stats;
}
