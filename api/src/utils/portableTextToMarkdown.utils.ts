/**
 * Portable Text to Markdown converter utility
 *
 * Converts Portable Text blocks to Markdown format for display/formatting purposes.
 * Handles all supported block types and marks according to the Portable Text specification.
 */

export interface PortableTextBlock {
	_type: string;
	_key?: string;
	style?: string;
	listItem?: string;
	level?: number;
	children?: PortableTextSpan[];
	[key: string]: unknown; // Allow additional properties
}

export interface PortableTextSpan {
	_type: 'span';
	_key?: string;
	text: string;
	marks?: string[];
}

/**
 * Type guard to check if content is Portable Text
 */
export function isPortableText(content: unknown): content is PortableTextBlock[] {
	if (!Array.isArray(content)) {
		return false;
	}

	// Check if all items have _type property (Portable Text requirement)
	return content.every((item) =>
		typeof item === 'object' &&
		item !== null &&
		// deno-lint-ignore no-explicit-any
		typeof (item as any)._type === 'string'
	);
}

/**
 * Convert Portable Text blocks to Markdown
 */
export function portableTextToMarkdown(blocks: PortableTextBlock[]): string {
	return blocks.map((block) => convertBlock(block)).join('\n\n');
}

/**
 * Convert a single Portable Text block to Markdown
 */
function convertBlock(block: PortableTextBlock): string {
	const { _type, style, listItem, level = 1, children = [] } = block;

	// Handle different block types
	switch (_type) {
		case 'block':
			return convertTextBlock(block, style, listItem, level, children);

		case 'image':
			return convertImageBlock(block);

		case 'code':
			return convertCodeBlock(block);

		default:
			// Handle custom block types by falling back to text content
			if (children.length > 0) {
				return convertSpans(children);
			}
			return `<!-- Unsupported block type: ${_type} -->`;
	}
}

/**
 * Convert a text block (most common block type)
 */
function convertTextBlock(
	_block: PortableTextBlock,
	style?: string,
	listItem?: string,
	level: number = 1,
	children: PortableTextSpan[] = [],
): string {
	const text = convertSpans(children);

	// Handle list items
	if (listItem) {
		const indent = '  '.repeat(Math.max(0, level - 1));
		switch (listItem) {
			case 'bullet':
				return `${indent}- ${text}`;
			case 'number':
				return `${indent}1. ${text}`;
			default:
				return `${indent}- ${text}`;
		}
	}

	// Handle block styles
	switch (style) {
		case 'h1':
			return `# ${text}`;
		case 'h2':
			return `## ${text}`;
		case 'h3':
			return `### ${text}`;
		case 'h4':
			return `#### ${text}`;
		case 'h5':
			return `##### ${text}`;
		case 'h6':
			return `###### ${text}`;
		case 'blockquote':
			return `> ${text}`;
		case 'normal':
		default:
			return text;
	}
}

/**
 * Convert image block to Markdown
 */
function convertImageBlock(block: PortableTextBlock): string {
	// deno-lint-ignore no-explicit-any
	const asset = block.asset as any;
	const alt = block.alt as string || '';

	if (asset?.url) {
		return `![${alt}](${asset.url})`;
	}

	// Fallback for images without URL
	return `![${alt}](# "Image: ${alt || 'Untitled'}")`;
}

/**
 * Convert code block to Markdown
 */
function convertCodeBlock(block: PortableTextBlock): string {
	const code = block.code as string || '';
	const language = block.language as string || '';

	return `\`\`\`${language}\n${code}\n\`\`\``;
}

/**
 * Convert an array of spans to formatted text
 */
function convertSpans(spans: PortableTextSpan[]): string {
	return spans.map((span) => convertSpan(span)).join('');
}

/**
 * Convert a single span with marks to formatted text
 */
function convertSpan(span: PortableTextSpan): string {
	let text = span.text;
	const marks = span.marks || [];

	// Apply marks in a specific order for proper nesting
	const markOrder = ['code', 'strong', 'em', 'underline', 'strike-through', 'link'];

	// Sort marks by priority
	const sortedMarks = marks.sort((a, b) => {
		const aIndex = markOrder.indexOf(a);
		const bIndex = markOrder.indexOf(b);
		return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
	});

	// Apply marks from outside to inside
	for (const mark of sortedMarks.reverse()) {
		text = applyMark(text, mark, span);
	}

	return text;
}

/**
 * Apply a single mark to text
 */
function applyMark(text: string, mark: string, span: PortableTextSpan): string {
	switch (mark) {
		case 'strong':
			return `**${text}**`;
		case 'em':
			return `*${text}*`;
		case 'code':
			return `\`${text}\``;
		case 'underline':
			return `<u>${text}</u>`;
		case 'strike-through':
			return `~~${text}~~`;
		case 'link': {
			// Look for link information in the span
			// deno-lint-ignore no-explicit-any
			const href = (span as any).href || '#';
			return `[${text}](${href})`;
		}
		default:
			// Unknown mark, just return the text
			return text;
	}
}

/**
 * Convert Portable Text to plain text (strips all formatting)
 */
export function portableTextToPlainText(blocks: PortableTextBlock[]): string {
	return blocks
		.map((block) => {
			if (block._type === 'block' && block.children) {
				return block.children
					.filter((child) => child._type === 'span')
					.map((span) => span.text)
					.join('');
			}
			return '';
		})
		.filter((text) => text.trim().length > 0)
		.join('\n\n');
}

/**
 * Extract a preview/summary from Portable Text
 */
export function portableTextPreview(blocks: PortableTextBlock[], maxLength: number = 200): string {
	const plainText = portableTextToPlainText(blocks);

	if (plainText.length <= maxLength) {
		return plainText;
	}

	// Find a good break point
	const truncated = plainText.substring(0, maxLength);
	const lastSpace = truncated.lastIndexOf(' ');
	const lastSentence = truncated.lastIndexOf('.');

	// Prefer sentence boundary, then word boundary
	const breakPoint = lastSentence > maxLength - 50
		? lastSentence + 1
		: lastSpace > maxLength - 50
		? lastSpace
		: maxLength;

	return plainText.substring(0, breakPoint).trim() + '...';
}
