/**
 * Portable Text conversion functions for Notion blocks.
 * Converts between Notion's block format and Portable Text specification.
 */
import { logger } from 'shared/logger.ts';
import type { NotionBlock, RichTextItemResponse } from 'api/dataSources/notionClient.ts';
import type { PortableTextBlock, PortableTextSpan } from 'api/types/portableText.ts';

// Custom block types for Notion-specific content
export interface NotionCustomBlock extends PortableTextBlock {
	_type: string; // 'notion_callout', 'notion_toggle', etc.
	notionType: string; // Original Notion block type
	notionData?: Record<string, unknown>; // Original Notion block data
}

export interface NotionEmbedBlock extends PortableTextBlock {
	_type: 'notion_embed';
	embedType: 'image' | 'bookmark' | 'video' | 'audio' | 'file' | 'pdf';
	url?: string;
	caption?: PortableTextSpan[];
	notionData?: Record<string, unknown>;
}

export interface NotionTableBlock extends PortableTextBlock {
	_type: 'notion_table';
	hasColumnHeader?: boolean;
	hasRowHeader?: boolean;
	rows: PortableTextSpan[][];
	notionData?: Record<string, unknown>;
}

// Supported Notion block types
/*
const SUPPORTED_BLOCK_TYPES = [
	'paragraph',
	'heading_1',
	'heading_2',
	'heading_3',
	'bulleted_list_item',
	'numbered_list_item',
	'to_do',
	'code',
	'quote',
	'divider',
	'callout',
	'toggle',
	'image',
	'bookmark',
	'link_preview',
	'video',
	'audio',
	'file',
	'pdf',
	'equation',
] as const;
 */

/**
 * Convert Notion blocks to Portable Text format
 * @param notionBlocks Array of Notion blocks
 * @returns Array of Portable Text blocks
 */
export function convertNotionToPortableText(notionBlocks: NotionBlock[]): PortableTextBlock[] {
	const portableBlocks: PortableTextBlock[] = [];

	for (const block of notionBlocks) {
		try {
			if (block.archived) {
				logger.debug(`Skipping archived block ${block.id}`);
				continue;
			}

			const portableBlock = convertNotionBlockToPortableText(block);
			if (portableBlock) {
				portableBlocks.push(portableBlock);
			}

			// Handle nested blocks (children) recursively
			if (block.has_children && block.children) {
				const childBlocks = convertNotionToPortableText(block.children);
				portableBlocks.push(...childBlocks);
			}
		} catch (error) {
			logger.warn(`Failed to convert Notion block ${block.id} of type ${block.type}:`, error);
			// Create a custom block to preserve the content
			portableBlocks.push({
				_type: `notion_${block.type}`,
				_key: block.id,
				notionType: block.type,
				notionData: block,
			} as NotionCustomBlock);
		}
	}

	return portableBlocks;
}

/**
 * Convert a single Notion block to Portable Text
 * @param block Notion block
 * @returns Portable Text block or null if unsupported
 */
function convertNotionBlockToPortableText(block: NotionBlock): PortableTextBlock | null {
	const baseBlock = {
		_key: block.id,
	};

	switch (block.type) {
		case 'paragraph':
			return {
				...baseBlock,
				_type: 'block',
				style: 'normal',
				children: convertRichTextToSpans(block.paragraph?.rich_text || []),
			};

		case 'heading_1':
			return {
				...baseBlock,
				_type: 'block',
				style: 'h1',
				children: convertRichTextToSpans(block.heading_1?.rich_text || []),
			};

		case 'heading_2':
			return {
				...baseBlock,
				_type: 'block',
				style: 'h2',
				children: convertRichTextToSpans(block.heading_2?.rich_text || []),
			};

		case 'heading_3':
			return {
				...baseBlock,
				_type: 'block',
				style: 'h3',
				children: convertRichTextToSpans(block.heading_3?.rich_text || []),
			};

		case 'bulleted_list_item':
			return {
				...baseBlock,
				_type: 'block',
				style: 'normal',
				listItem: 'bullet',
				level: 1, // Notion doesn't provide explicit nesting levels in individual blocks
				children: convertRichTextToSpans(block.bulleted_list_item?.rich_text || []),
			};

		case 'numbered_list_item':
			return {
				...baseBlock,
				_type: 'block',
				style: 'normal',
				listItem: 'number',
				level: 1,
				children: convertRichTextToSpans(block.numbered_list_item?.rich_text || []),
			};

		case 'to_do':
			return {
				...baseBlock,
				_type: 'block',
				style: 'normal',
				listItem: 'checkbox',
				level: 1,
				checked: block.to_do?.checked || false,
				children: convertRichTextToSpans(block.to_do?.rich_text || []),
			};

		case 'code':
			return {
				...baseBlock,
				_type: 'code',
				language: block.code?.language || 'text',
				code:
					block.code?.rich_text?.map((rt: { plain_text: string; text: { content: string } }) =>
						rt.plain_text || rt.text?.content || ''
					).join('') || '',
			};

		case 'quote':
			return {
				...baseBlock,
				_type: 'block',
				style: 'blockquote',
				children: convertRichTextToSpans(block.quote?.rich_text || []),
			};

		case 'divider':
			return {
				...baseBlock,
				_type: 'divider',
			};

		case 'callout':
			return {
				...baseBlock,
				_type: 'notion_callout',
				icon: block.callout?.icon?.emoji || block.callout?.icon?.file?.url || null,
				children: convertRichTextToSpans(block.callout?.rich_text || []),
				notionType: 'callout',
				notionData: block.callout,
			} as NotionCustomBlock;

		case 'toggle':
			return {
				...baseBlock,
				_type: 'notion_toggle',
				children: convertRichTextToSpans(block.toggle?.rich_text || []),
				notionType: 'toggle',
				notionData: block.toggle,
			} as NotionCustomBlock;

		case 'image':
			return convertNotionEmbedToPortableText(block, 'image');

		case 'bookmark':
		case 'link_preview':
			return convertNotionEmbedToPortableText(block, 'bookmark');

		case 'video':
			return convertNotionEmbedToPortableText(block, 'video');

		case 'audio':
			return convertNotionEmbedToPortableText(block, 'audio');

		case 'file':
			return convertNotionEmbedToPortableText(block, 'file');

		case 'pdf':
			return convertNotionEmbedToPortableText(block, 'pdf');

		case 'equation':
			return {
				...baseBlock,
				_type: 'notion_equation',
				expression: block.equation?.expression || '',
				notionType: 'equation',
				notionData: block.equation,
			} as NotionCustomBlock;

		case 'table':
			// Tables are complex and span multiple blocks in Notion
			// This would need special handling to collect all table rows
			logger.debug(`Table block ${block.id} requires special handling`);
			return {
				...baseBlock,
				_type: 'notion_table',
				notionType: 'table',
				notionData: block,
			} as NotionCustomBlock;

		default:
			logger.debug(`Unsupported Notion block type: ${block.type}`);
			return {
				...baseBlock,
				_type: `notion_${block.type}`,
				notionType: block.type,
				notionData: block,
			} as NotionCustomBlock;
	}
}

/**
 * Convert Notion embed-type blocks to Portable Text
 * @param block Notion block
 * @param embedType Type of embed
 * @returns Portable Text embed block
 */
function convertNotionEmbedToPortableText(
	block: NotionBlock,
	embedType: 'image' | 'bookmark' | 'video' | 'audio' | 'file' | 'pdf',
): NotionEmbedBlock {
	const blockData = block[block.type];
	let url = '';
	let caption: PortableTextSpan[] = [];

	// Extract URL based on block type
	if (blockData?.external?.url) {
		url = blockData.external.url;
	} else if (blockData?.file?.url) {
		url = blockData.file.url;
	} else if (blockData?.url) {
		url = blockData.url;
	}

	// Extract caption if available
	if (blockData?.caption && Array.isArray(blockData.caption)) {
		caption = convertRichTextToSpans(blockData.caption);
	}

	return {
		_type: 'notion_embed',
		_key: block.id,
		embedType,
		url,
		caption,
		notionData: blockData,
	};
}

/**
 * Convert Notion rich text array to Portable Text spans
 * @param richText Array of Notion rich text items
 * @returns Array of Portable Text spans
 */
function convertRichTextToSpans(richText: RichTextItemResponse[]): PortableTextSpan[] {
	if (!richText || !Array.isArray(richText)) {
		return [];
	}

	return richText.map((text, index) => {
		const marks: string[] = [];
		const textContent = text.plain_text || text.text?.content || '';

		// Convert Notion annotations to Portable Text marks
		if (text.annotations) {
			if (text.annotations.bold) marks.push('strong');
			if (text.annotations.italic) marks.push('em');
			if (text.annotations.strikethrough) marks.push('strike-through');
			if (text.annotations.underline) marks.push('underline');
			if (text.annotations.code) marks.push('code');
		}

		// Handle links
		if (text.href || text.text?.link?.url) {
			marks.push('link');
		}

		const span: PortableTextSpan = {
			_type: 'span',
			_key: `span-${index}`,
			text: textContent,
		};

		if (marks.length > 0) {
			span.marks = marks;
		}

		// Store link URL as additional data if present
		if (text.href || text.text?.link?.url) {
			// deno-lint-ignore no-explicit-any
			(span as any).linkUrl = text.href || text.text?.link?.url;
		}

		return span;
	});
}

/**
 * Convert Portable Text blocks back to Notion block format
 * @param portableBlocks Array of Portable Text blocks
 * @returns Array of Notion blocks
 */
export function convertPortableTextToNotion(portableBlocks: PortableTextBlock[]): Partial<NotionBlock>[] {
	const notionBlocks: Partial<NotionBlock>[] = [];

	for (const block of portableBlocks) {
		try {
			const notionBlock = convertPortableTextBlockToNotion(block);
			if (notionBlock) {
				notionBlocks.push(notionBlock);
			}
		} catch (error) {
			logger.warn(`Failed to convert Portable Text block ${block._key} of type ${block._type}:`, error);
			// Skip blocks that can't be converted
			continue;
		}
	}

	return notionBlocks;
}

/**
 * Convert a single Portable Text block to Notion format
 * @param block Portable Text block
 * @returns Partial Notion block or null if unsupported
 */
function convertPortableTextBlockToNotion(block: PortableTextBlock): Partial<NotionBlock> | null {
	const baseBlock: Partial<NotionBlock> = {
		id: block._key,
	};

	switch (block._type) {
		case 'block':
			return convertPortableTextBlockByStyle(block, baseBlock);

		case 'code':
			return {
				...baseBlock,
				type: 'code',
				code: {
					// deno-lint-ignore no-explicit-any
					language: (block as any).language || 'text',
					rich_text: [{
						type: 'text',
						// deno-lint-ignore no-explicit-any
						text: { content: (block as any).code || '' },
						// deno-lint-ignore no-explicit-any
						plain_text: (block as any).code || '',
					}],
				},
			};

		case 'divider':
			return {
				...baseBlock,
				type: 'divider',
				divider: {},
			};

		case 'notion_callout': {
			const calloutBlock = block as NotionCustomBlock;
			return {
				...baseBlock,
				type: 'callout',
				callout: {
					rich_text: convertSpansToRichText(block.children || []),
					// deno-lint-ignore no-explicit-any
					icon: calloutBlock.notionData?.icon || { emoji: (calloutBlock as any).icon || '💡' },
					color: calloutBlock.notionData?.color || 'default',
				},
			};
		}
		case 'notion_toggle':
			return {
				...baseBlock,
				type: 'toggle',
				toggle: {
					rich_text: convertSpansToRichText(block.children || []),
				},
			};

		case 'notion_embed': {
			const embedBlock = block as NotionEmbedBlock;
			return convertPortableTextEmbedToNotion(embedBlock, baseBlock);
		}
		case 'notion_equation': {
			const equationBlock = block as NotionCustomBlock;
			return {
				...baseBlock,
				type: 'equation',
				equation: {
					// deno-lint-ignore no-explicit-any
					expression: (equationBlock as any).expression || '',
				},
			};
		}
		default:
			// Handle custom Notion block types
			if (block._type.startsWith('notion_')) {
				const customBlock = block as NotionCustomBlock;
				if (customBlock.notionData && customBlock.notionType) {
					return {
						...baseBlock,
						type: customBlock.notionType,
						[customBlock.notionType]: customBlock.notionData,
					};
				}
			}

			logger.debug(`Unsupported Portable Text block type: ${block._type}`);
			return null;
	}
}

/**
 * Convert Portable Text block by style to Notion format
 * @param block Portable Text block
 * @param baseBlock Base Notion block
 * @returns Partial Notion block
 */
function convertPortableTextBlockByStyle(
	block: PortableTextBlock,
	baseBlock: Partial<NotionBlock>,
): Partial<NotionBlock> {
	const richText = convertSpansToRichText(block.children || []);

	switch (block.style) {
		case 'normal':
			if (block.listItem === 'bullet') {
				return {
					...baseBlock,
					type: 'bulleted_list_item',
					bulleted_list_item: { rich_text: richText },
				};
			} else if (block.listItem === 'number') {
				return {
					...baseBlock,
					type: 'numbered_list_item',
					numbered_list_item: { rich_text: richText },
				};
			} else if (block.listItem === 'checkbox') {
				return {
					...baseBlock,
					type: 'to_do',
					to_do: {
						rich_text: richText,
						// deno-lint-ignore no-explicit-any
						checked: (block as any).checked || false,
					},
				};
			} else {
				return {
					...baseBlock,
					type: 'paragraph',
					paragraph: { rich_text: richText },
				};
			}

		case 'h1':
			return {
				...baseBlock,
				type: 'heading_1',
				heading_1: { rich_text: richText },
			};

		case 'h2':
			return {
				...baseBlock,
				type: 'heading_2',
				heading_2: { rich_text: richText },
			};

		case 'h3':
			return {
				...baseBlock,
				type: 'heading_3',
				heading_3: { rich_text: richText },
			};

		case 'blockquote':
			return {
				...baseBlock,
				type: 'quote',
				quote: { rich_text: richText },
			};

		default:
			logger.debug(`Unsupported Portable Text style: ${block.style}`);
			return {
				...baseBlock,
				type: 'paragraph',
				paragraph: { rich_text: richText },
			};
	}
}

/**
 * Convert Portable Text embed back to Notion format
 * @param embedBlock Portable Text embed block
 * @param baseBlock Base Notion block
 * @returns Partial Notion block
 */
function convertPortableTextEmbedToNotion(
	embedBlock: NotionEmbedBlock,
	baseBlock: Partial<NotionBlock>,
): Partial<NotionBlock | null> {
	const caption = convertSpansToRichText(embedBlock.caption || []);

	switch (embedBlock.embedType) {
		case 'image':
			return {
				...baseBlock,
				type: 'image',
				image: {
					type: embedBlock.url?.startsWith('http') ? 'external' : 'file',
					external: embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					file: !embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					caption,
				},
			};

		case 'bookmark':
			return {
				...baseBlock,
				type: 'bookmark',
				bookmark: {
					url: embedBlock.url || '',
					caption,
				},
			};

		case 'video':
			return {
				...baseBlock,
				type: 'video',
				video: {
					type: embedBlock.url?.startsWith('http') ? 'external' : 'file',
					external: embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					file: !embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					caption,
				},
			};

		case 'audio':
			return {
				...baseBlock,
				type: 'audio',
				audio: {
					type: embedBlock.url?.startsWith('http') ? 'external' : 'file',
					external: embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					file: !embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					caption,
				},
			};

		case 'file':
			return {
				...baseBlock,
				type: 'file',
				file: {
					type: embedBlock.url?.startsWith('http') ? 'external' : 'file',
					external: embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					file: !embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					caption,
				},
			};

		case 'pdf':
			return {
				...baseBlock,
				type: 'pdf',
				pdf: {
					type: embedBlock.url?.startsWith('http') ? 'external' : 'file',
					external: embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					file: !embedBlock.url?.startsWith('http') ? { url: embedBlock.url } : undefined,
					caption,
				},
			};

		default:
			logger.debug(`Unsupported embed type: ${embedBlock.embedType}`);
			return null;
	}
}

/**
 * Convert Portable Text spans back to Notion rich text format
 * @param spans Array of Portable Text spans
 * @returns Array of Notion rich text items
 */
function convertSpansToRichText(spans: PortableTextSpan[]): RichTextItemResponse[] {
	if (!spans || !Array.isArray(spans)) {
		return [];
	}

	return spans.map((span) => {
		const annotations = {
			bold: span.marks?.includes('strong') || false,
			italic: span.marks?.includes('em') || false,
			strikethrough: span.marks?.includes('strike-through') || false,
			underline: span.marks?.includes('underline') || false,
			code: span.marks?.includes('code') || false,
			color: 'default',
		};

		const richTextItem: RichTextItemResponse = {
			type: 'text',
			text: {
				content: span.text,
				// deno-lint-ignore no-explicit-any
				link: span.marks?.includes('link') && (span as any).linkUrl ? { url: (span as any).linkUrl } : null,
			},
			annotations,
			plain_text: span.text,
			// deno-lint-ignore no-explicit-any
			href: span.marks?.includes('link') && (span as any).linkUrl ? (span as any).linkUrl : null,
		};

		return richTextItem;
	});
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
 * Validate that a Portable Text structure is well-formed
 * @param blocks Array of Portable Text blocks
 * @returns True if valid, false otherwise
 */
export function validatePortableText(blocks: PortableTextBlock[]): boolean {
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
