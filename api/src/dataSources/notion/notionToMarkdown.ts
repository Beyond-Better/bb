/**
 * Utility for converting Notion blocks to Markdown.
 */
import { logger } from 'shared/logger.ts';
import type { NotionBlock, NotionPage } from 'api/dataSources/notionClient.ts';

/**
 * Options for Notion to Markdown conversion
 */
export interface NotionToMarkdownOptions {
	/**
	 * Whether to include the page title as a header
	 */
	includeTitle?: boolean;

	/**
	 * Maximum heading level
	 */
	maxHeadingLevel?: number;

	/**
	 * Whether to render math blocks
	 */
	renderMath?: boolean;

	/**
	 * Whether to render equations
	 */
	renderEquations?: boolean;

	/**
	 * Whether to include metadata about the page
	 */
	includeMetadata?: boolean;
}

/**
 * Default conversion options
 */
const DEFAULT_OPTIONS: NotionToMarkdownOptions = {
	includeTitle: true,
	maxHeadingLevel: 6,
	renderMath: true,
	renderEquations: true,
	includeMetadata: false,
};

/**
 * Convert a Notion page to Markdown
 * @param page Notion page object
 * @param blocks Notion blocks from the page
 * @param options Conversion options
 * @returns Markdown string
 */
export function notionPageToMarkdown(
	page: NotionPage,
	blocks: NotionBlock[],
	options: NotionToMarkdownOptions = {},
): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const markdown: string[] = [];

	// Add page title if requested
	if (opts.includeTitle && page.properties?.title) {
		const title = getPageTitle(page);
		if (title) {
			markdown.push(`# ${title}\n`);
		}
	}

	// Add page metadata if requested
	if (opts.includeMetadata) {
		markdown.push(`> Page ID: ${page.id}  `);
		markdown.push(`> Last edited: ${new Date(page.last_edited_time).toLocaleString()}  `);
		markdown.push(`> URL: ${page.url}\n`);
	}

	// Convert each block to markdown
	for (let i = 0; i < blocks.length; i++) {
		const block = blocks[i];
		if (block.archived) continue;

		try {
			const blockMd = blockToMarkdown(block, blocks, i, opts);
			if (blockMd) {
				markdown.push(blockMd);
			}
		} catch (error) {
			logger.warn(`Failed to convert block ${block.id} of type ${block.type}:`, error);
			markdown.push(`<!-- Failed to convert block of type ${block.type} -->`);
		}
	}

	return markdown.join('\n');
}

/**
 * Get a page title from its properties
 * @param page Notion page object
 * @returns Page title or null if not available
 */
function getPageTitle(page: NotionPage): string | null {
	// Extract title from properties
	if (page.properties?.title) {
		const title = page.properties.title;

		// Handle different title property formats
		if (title.title && Array.isArray(title.title)) {
			return title.title.map((t: { plain_text: string }) => t.plain_text).join('');
		} else if (title.rich_text && Array.isArray(title.rich_text)) {
			return title.rich_text.map((t: { plain_text: string }) => t.plain_text).join('');
		}
	}

	return null;
}

/**
 * Convert a Notion block to Markdown
 * @param block The block to convert
 * @param allBlocks All blocks (for context)
 * @param index Index of the current block
 * @param options Conversion options
 * @returns Markdown string for the block
 */
function blockToMarkdown(
	block: NotionBlock,
	allBlocks: NotionBlock[],
	index: number,
	options: NotionToMarkdownOptions,
): string {
	switch (block.type) {
		case 'paragraph':
			return renderParagraph(block);

		case 'heading_1':
		case 'heading_2':
		case 'heading_3':
			return renderHeading(block, options.maxHeadingLevel || 6);

		case 'bulleted_list_item':
			return renderBulletListItem(block, allBlocks, index);

		case 'numbered_list_item':
			return renderNumberedListItem(block, allBlocks, index);

		case 'to_do':
			return renderTodo(block);

		case 'toggle':
			return renderToggle(block);

		case 'code':
			return renderCode(block);

		case 'quote':
			return renderQuote(block);

		case 'callout':
			return renderCallout(block);

		case 'divider':
			return '---';

		case 'image':
			return renderImage(block);

		case 'bookmark':
		case 'link_preview':
			return renderBookmark(block);

		case 'table':
			// Tables need special handling since they span multiple blocks
			// This would require additional logic to find and process all table blocks
			return '<!-- Table content not supported yet -->';

		case 'equation':
			if (options.renderEquations) {
				return renderEquation(block);
			}
			return '';

		default:
			logger.debug(`Unhandled block type: ${block.type}`);
			return `<!-- Unsupported block type: ${block.type} -->`;
	}
}

/**
 * Render rich text content
 * @param richText Array of rich text objects
 * @returns Markdown formatted text
 */
// deno-lint-ignore no-explicit-any
function renderRichText(richText: any[] = []): string {
	if (!richText || !Array.isArray(richText)) return '';

	return richText.map((text) => {
		let content = text.plain_text || '';

		// Apply formatting
		if (text.annotations) {
			if (text.annotations.bold) content = `**${content}**`;
			if (text.annotations.italic) content = `*${content}*`;
			if (text.annotations.strikethrough) content = `~~${content}~~`;
			if (text.annotations.code) content = `\`${content}\``;
		}

		// Handle links
		if (text.href) {
			content = `[${content}](${text.href})`;
		}

		return content;
	}).join('');
}

/**
 * Render a paragraph block
 * @param block Paragraph block
 * @returns Markdown string
 */
function renderParagraph(block: NotionBlock): string {
	const text = renderRichText(block.paragraph?.rich_text);
	return text ? `${text}\n` : '';
}

/**
 * Render a heading block
 * @param block Heading block
 * @param maxLevel Maximum heading level
 * @returns Markdown string
 */
function renderHeading(block: NotionBlock, maxLevel: number): string {
	const level = parseInt(block.type.split('_')[1]);
	const actualLevel = Math.min(level, maxLevel);
	const prefix = '#'.repeat(actualLevel);

	let content: string;
	switch (block.type) {
		case 'heading_1':
			content = renderRichText(block.heading_1?.rich_text);
			break;
		case 'heading_2':
			content = renderRichText(block.heading_2?.rich_text);
			break;
		case 'heading_3':
			content = renderRichText(block.heading_3?.rich_text);
			break;
		default:
			content = '';
	}

	return content ? `${prefix} ${content}\n` : '';
}

/**
 * Render a bulleted list item
 * @param block List item block
 * @param allBlocks All blocks
 * @param index Current block index
 * @returns Markdown string
 */
function renderBulletListItem(block: NotionBlock, _allBlocks: NotionBlock[], _index: number): string {
	const text = renderRichText(block.bulleted_list_item?.rich_text);
	return text ? `- ${text}\n` : '';
}

/**
 * Render a numbered list item
 * @param block List item block
 * @param allBlocks All blocks
 * @param index Current block index
 * @returns Markdown string
 */
function renderNumberedListItem(block: NotionBlock, allBlocks: NotionBlock[], index: number): string {
	const text = renderRichText(block.numbered_list_item?.rich_text);

	// Calculate the item number by counting previous numbered list items
	let itemNumber = 1;
	for (let i = index - 1; i >= 0; i--) {
		const prevBlock = allBlocks[i];
		if (prevBlock.type !== 'numbered_list_item') break;
		itemNumber++;
	}

	return text ? `${itemNumber}. ${text}\n` : '';
}

/**
 * Render a to-do item
 * @param block To-do block
 * @returns Markdown string
 */
function renderTodo(block: NotionBlock): string {
	const text = renderRichText(block.to_do?.rich_text);
	const checked = block.to_do?.checked;
	return text ? `- [${checked ? 'x' : ' '}] ${text}\n` : '';
}

/**
 * Render a toggle block
 * @param block Toggle block
 * @returns Markdown string
 */
function renderToggle(block: NotionBlock): string {
	const text = renderRichText(block.toggle?.rich_text);
	return text ? `<details><summary>${text}</summary>\n\n</details>\n` : '';
}

/**
 * Render a code block
 * @param block Code block
 * @returns Markdown string
 */
function renderCode(block: NotionBlock): string {
	const text = renderRichText(block.code?.rich_text);
	const language = block.code?.language || '';
	return `\`\`\`${language}\n${text}\n\`\`\`\n`;
}

/**
 * Render a quote block
 * @param block Quote block
 * @returns Markdown string
 */
function renderQuote(block: NotionBlock): string {
	const text = renderRichText(block.quote?.rich_text);
	return text ? `> ${text.replace(/\n/g, '\n> ')}\n` : '';
}

/**
 * Render a callout block
 * @param block Callout block
 * @returns Markdown string
 */
function renderCallout(block: NotionBlock): string {
	const text = renderRichText(block.callout?.rich_text);
	const icon = block.callout?.icon?.emoji || '💡';
	return text ? `> ${icon} **Note:** ${text.replace(/\n/g, '\n> ')}\n` : '';
}

/**
 * Render an image block
 * @param block Image block
 * @returns Markdown string
 */
function renderImage(block: NotionBlock): string {
	const caption = renderRichText(block.image?.caption) || 'Image';
	let url = '';

	if (block.image?.type === 'external') {
		url = block.image.external?.url || '';
	} else if (block.image?.type === 'file') {
		url = block.image.file?.url || '';
	}

	return url ? `![${caption}](${url})\n` : '';
}

/**
 * Render a bookmark or link preview
 * @param block Bookmark or link preview block
 * @returns Markdown string
 */
function renderBookmark(block: NotionBlock): string {
	const type = block.type;
	const content = block[type];
	const url = content?.url || '';
	const caption = renderRichText(content?.caption) || url;

	return url ? `[${caption}](${url})\n` : '';
}

/**
 * Render an equation block
 * @param block Equation block
 * @returns Markdown string
 */
function renderEquation(block: NotionBlock): string {
	const expression = block.equation?.expression || '';
	return expression ? `$$\n${expression}\n$$\n` : '';
}
