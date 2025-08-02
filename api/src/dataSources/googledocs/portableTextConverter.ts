/**
 * Portable Text conversion functions for Google Docs.
 * Converts between Google Docs' document format and Portable Text specification.
 */
import { logger } from 'shared/logger.ts';
import type {
	GoogleDocsBatchUpdateRequest,
	GoogleDocument,
	GoogleParagraph,
	GoogleSectionBreak,
	GoogleStructuralElement,
	GoogleTable,
	GoogleTableOfContents,
	GoogleTextRun,
	GoogleTextStyle,
} from './googledocs.types.ts';
import type { PortableTextBlock, PortableTextSpan } from 'api/types/portableText.ts';

// Custom block types for Google Docs-specific content
export interface GoogleDocsCustomBlock extends PortableTextBlock {
	_key: string;
	_type: string; // 'googledocs_table', 'googledocs_pagebreak', etc.
	googledocsType: string; // Original Google Docs element type
	googledocsData?: GoogleStructuralElement | GoogleTableOfContents;
}

export interface GoogleDocsTableBlock extends PortableTextBlock {
	_key: string;
	_type: 'googledocs_table';
	rows: number;
	columns: number;
	cells: PortableTextSpan[][];
	googledocsData?: GoogleTable;
}

export interface GoogleDocsBreakBlock extends PortableTextBlock {
	_type: 'googledocs_break';
	breakType: 'page' | 'section' | 'column';
	googledocsData?: GoogleSectionBreak;
}

/**
 * Convert Google Docs document to Portable Text format
 * @param document Google Docs document
 * @returns Array of Portable Text blocks
 */
export function convertGoogleDocsToPortableText(document: GoogleDocument): PortableTextBlock[] {
	const portableBlocks: PortableTextBlock[] = [];

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

	if (document.body && document.body.content) {
		for (const element of document.body.content) {
			try {
				const block = convertStructuralElementToPortableText(element);
				if (block) {
					portableBlocks.push(block);
				}
			} catch (error) {
				logger.warn(`Failed to convert Google Docs structural element:`, error);
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

function convertParagraphToPortableText(paragraph: GoogleParagraph): PortableTextBlock {
	const children: PortableTextSpan[] = [];

	for (const element of paragraph.elements) {
		if (element.textRun) {
			const span = convertTextRunToPortableTextSpan(element.textRun);
			if (span) {
				children.push(span);
			}
		} else if (element.pageBreak) {
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

	let style = 'normal';
	if (paragraph.paragraphStyle?.namedStyleType) {
		switch (paragraph.paragraphStyle.namedStyleType) {
			case 'HEADING_1': style = 'h1'; break;
			case 'HEADING_2': style = 'h2'; break;
			case 'HEADING_3': style = 'h3'; break;
			case 'HEADING_4': style = 'h4'; break;
			case 'HEADING_5': style = 'h5'; break;
			case 'HEADING_6': style = 'h6'; break;
			case 'NORMAL_TEXT':
			default: style = 'normal'; break;
		}
	}

	return {
		_type: 'block',
		_key: generatePortableTextKey('paragraph'),
		style,
		children,
	};
}

function convertTextRunToPortableTextSpan(textRun: GoogleTextRun): PortableTextSpan | null {
	if (!textRun.content) {
		return null;
	}

	const marks: string[] = [];
	if (textRun.textStyle) {
		const { bold, italic, strikethrough, underline, link } = textRun.textStyle;
		if (bold) marks.push('strong');
		if (italic) marks.push('em');
		if (strikethrough) marks.push('strike-through');
		if (underline) marks.push('underline');
		if (link?.url) marks.push('link');
	}

	const span: PortableTextSpan = {
		_type: 'span',
		_key: generatePortableTextKey('span'),
		text: textRun.content,
		marks,
	};

	if (textRun.textStyle?.link?.url) {
		(span as any).linkUrl = textRun.textStyle.link.url;
	}

	return span;
}

function convertTableToPortableText(table: any, startIndex: number): GoogleDocsTableBlock {
	const cells: PortableTextSpan[][] = [];
	const rows = table.rows || 0;
	const columns = table.columns || 0;

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
 * Convert Portable Text blocks back to Google Docs batch update requests.
 * This function creates requests to first clear the document and then rebuild it
 * from the provided blocks, preserving structure and formatting.
 * @param blocks Array of Portable Text blocks
 * @param existingDocument The current state of the Google Document
 * @returns Array of Google Docs batch update requests
 */
export function convertPortableTextToGoogleDocs(
	blocks: PortableTextBlock[],
	existingDocument: GoogleDocument,
): GoogleDocsBatchUpdateRequest[] {
	const requests: GoogleDocsBatchUpdateRequest[] = [];
	const bodyContent = existingDocument.body?.content;

	if (bodyContent && bodyContent.length > 0) {
		const lastElement = bodyContent[bodyContent.length - 1];
		const endIndex = lastElement.endIndex;
		if (endIndex && endIndex > 1) {
			requests.push({
				deleteContentRange: {
					range: {
						startIndex: 1,
						endIndex: endIndex - 1,
					},
				},
			});
		}
	}

	let fullText = '';
	const paragraphStyleRequests: GoogleDocsBatchUpdateRequest[] = [];
	const textStyleRequests: GoogleDocsBatchUpdateRequest[] = [];
	const insertIndex = 1;

	for (const block of blocks) {
		if (block._type !== 'block' || !block.children) {
			if (block._type === 'googledocs_break' && (block as GoogleDocsBreakBlock).breakType === 'page') {
				fullText += '\f'; // Form feed for page break
			}
			continue;
		}

		const blockText = block.children.map((child) => (child._type === 'span' ? child.text : '')).join('');
		const blockStartIndex = fullText.length;
		
		if (!blockText.trim() && block.style === 'normal') {
			fullText += '\n';
			continue;
		}

		fullText += blockText + '\n';
		const blockEndIndex = fullText.length - 1;

		if (block.style && block.style.startsWith('h')) {
			let namedStyleType = 'NORMAL_TEXT';
			switch (block.style) {
				case 'h1': namedStyleType = 'HEADING_1'; break;
				case 'h2': namedStyleType = 'HEADING_2'; break;
				case 'h3': namedStyleType = 'HEADING_3'; break;
				case 'h4': namedStyleType = 'HEADING_4'; break;
				case 'h5': namedStyleType = 'HEADING_5'; break;
				case 'h6': namedStyleType = 'HEADING_6'; break;
			}
			if (namedStyleType !== 'NORMAL_TEXT') {
				paragraphStyleRequests.push({
					updateParagraphStyle: {
						range: {
							startIndex: insertIndex + blockStartIndex,
							endIndex: insertIndex + blockEndIndex,
						},
						paragraphStyle: { namedStyleType },
						fields: 'namedStyleType',
					},
				});
			}
		}

		let spanStartIndexInBlock = 0;
		for (const span of block.children) {
			if (span._type === 'span' && span.marks && span.marks.length > 0) {
				const spanStartIndex = blockStartIndex + spanStartIndexInBlock;
				const spanEndIndex = spanStartIndex + span.text.length;
				const textStyle: GoogleTextStyle = {};
				const fields: string[] = [];

				if (span.marks.includes('strong')) {
					textStyle.bold = true;
					fields.push('bold');
				}
				if (span.marks.includes('em')) {
					textStyle.italic = true;
					fields.push('italic');
				}
				if (span.marks.includes('strike-through')) {
					textStyle.strikethrough = true;
					fields.push('strikethrough');
				}
				if (span.marks.includes('underline')) {
					textStyle.underline = true;
					fields.push('underline');
				}

				if (fields.length > 0) {
					textStyleRequests.push({
						updateTextStyle: {
							range: {
								startIndex: insertIndex + spanStartIndex,
								endIndex: insertIndex + spanEndIndex,
							},
							textStyle,
							fields: fields.join(','),
						},
					});
				}
			}
			spanStartIndexInBlock += span.text.length;
		}
	}

	if (fullText) {
		requests.push({
			insertText: {
				location: { index: insertIndex },
				text: fullText,
			},
		});
	}

	return [...requests, ...paragraphStyleRequests, ...textStyleRequests];
}

export function generatePortableTextKey(prefix: string = 'block'): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

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

export function extractTextFromPortableText(blocks: PortableTextBlock[]): string {
	const textParts: string[] = [];
	for (const block of blocks) {
		if (block.children) {
			const blockText = block.children
				.map((child) => (child._type === 'span' ? child.text : ''))
				.join('');
			if (blockText.trim()) {
				textParts.push(blockText);
			}
		}
	}
	return textParts.join('\n\n');
}
