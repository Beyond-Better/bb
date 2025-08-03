/**
 * Comprehensive tests for Notion Portable Text conversion functions
 */
import { assertEquals, assertExists } from '@std/assert';
import type { NotionBlock } from 'api/dataSources/notionClient.ts';
import {
	convertNotionToPortableText,
	convertPortableTextToNotion,
	generatePortableTextKey,
	type NotionCustomBlock,
	type NotionEmbedBlock,
	validatePortableText,
} from 'api/dataSources/notion/portableTextConverter.ts';
import type {
	PortableTextBlock,
	//PortableTextSpan,
} from 'api/types/portableText.ts';

// Helper function to create a basic Notion block
// deno-lint-ignore no-explicit-any
function createNotionBlock(type: string, id: string, data: any): NotionBlock {
	return {
		object: 'block',
		id,
		// deno-lint-ignore no-explicit-any
		type: type as any,
		created_time: '2025-01-01T00:00:00.000Z',
		last_edited_time: '2025-01-01T00:00:00.000Z',
		[type]: data,
	} as NotionBlock;
}

// Helper function to create rich text
// deno-lint-ignore no-explicit-any
function createRichText(content: string, annotations: any = {}, href?: string): any {
	return {
		type: 'text',
		text: { content, link: href ? { url: href } : null },
		plain_text: content,
		href,
		annotations: {
			bold: false,
			italic: false,
			strikethrough: false,
			underline: false,
			code: false,
			color: 'default',
			...annotations,
		},
	};
}

Deno.test({
	name: 'convertNotionToPortableText - paragraph block with mixed formatting',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('paragraph', 'test-paragraph-id', {
				rich_text: [
					createRichText('This is a test paragraph with '),
					createRichText('bold text', { bold: true }),
					createRichText(' and '),
					createRichText('italic text', { italic: true }, 'https://example.com'),
					createRichText(' and '),
					createRichText('code', { code: true }),
				],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0]._type, 'block');
		assertEquals(result[0].style, 'normal');
		assertEquals(result[0]._key, 'test-paragraph-id');
		assertExists(result[0].children);
		assertEquals(result[0].children!.length, 6);

		// Check spans
		assertEquals(result[0].children![0].text, 'This is a test paragraph with ');
		assertEquals(result[0].children![0].marks, undefined);

		assertEquals(result[0].children![1].text, 'bold text');
		assertEquals(result[0].children![1].marks, ['strong']);

		assertEquals(result[0].children![3].text, 'italic text');
		assertEquals(result[0].children![3].marks, ['em', 'link']);
		// deno-lint-ignore no-explicit-any
		assertEquals((result[0].children![3] as any).linkUrl, 'https://example.com');

		assertEquals(result[0].children![5].text, 'code');
		assertEquals(result[0].children![5].marks, ['code']);
	},
});

Deno.test({
	name: 'convertNotionToPortableText - all heading levels',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('heading_1', 'h1-id', {
				rich_text: [createRichText('Main Title')],
			}),
			createNotionBlock('heading_2', 'h2-id', {
				rich_text: [createRichText('Subtitle')],
			}),
			createNotionBlock('heading_3', 'h3-id', {
				rich_text: [createRichText('Sub-subtitle')],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 3);
		assertEquals(result[0].style, 'h1');
		assertEquals(result[0].children![0].text, 'Main Title');
		assertEquals(result[1].style, 'h2');
		assertEquals(result[1].children![0].text, 'Subtitle');
		assertEquals(result[2].style, 'h3');
		assertEquals(result[2].children![0].text, 'Sub-subtitle');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - list items with all types',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('bulleted_list_item', 'bullet-id', {
				rich_text: [createRichText('Bullet point')],
			}),
			createNotionBlock('numbered_list_item', 'number-id', {
				rich_text: [createRichText('Numbered item')],
			}),
			createNotionBlock('to_do', 'todo-checked-id', {
				checked: true,
				rich_text: [createRichText('Completed todo')],
			}),
			createNotionBlock('to_do', 'todo-unchecked-id', {
				checked: false,
				rich_text: [createRichText('Uncompleted todo')],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 4);

		// Bullet item
		assertEquals(result[0].listItem, 'bullet');
		assertEquals(result[0].level, 1);
		assertEquals(result[0].children![0].text, 'Bullet point');

		// Numbered item
		assertEquals(result[1].listItem, 'number');
		assertEquals(result[1].level, 1);
		assertEquals(result[1].children![0].text, 'Numbered item');

		// Checked todo
		assertEquals(result[2].listItem, 'checkbox');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[2] as any).checked, true);
		assertEquals(result[2].children![0].text, 'Completed todo');

		// Unchecked todo
		assertEquals(result[3].listItem, 'checkbox');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[3] as any).checked, false);
		assertEquals(result[3].children![0].text, 'Uncompleted todo');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - code block with language',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('code', 'code-id', {
				language: 'typescript',
				rich_text: [createRichText('const x: number = 42;')],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0]._type, 'code');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[0] as any).language, 'typescript');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[0] as any).code, 'const x: number = 42;');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - special blocks',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('quote', 'quote-id', {
				rich_text: [createRichText('This is a quote')],
			}),
			createNotionBlock('divider', 'divider-id', {}),
			createNotionBlock('callout', 'callout-id', {
				icon: { emoji: '💡' },
				rich_text: [createRichText('This is a callout')],
			}),
			createNotionBlock('toggle', 'toggle-id', {
				rich_text: [createRichText('This is a toggle')],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 4);

		// Quote
		assertEquals(result[0]._type, 'block');
		assertEquals(result[0].style, 'blockquote');
		assertEquals(result[0].children![0].text, 'This is a quote');

		// Divider
		assertEquals(result[1]._type, 'divider');

		// Callout
		assertEquals(result[2]._type, 'notion_callout');
		assertEquals((result[2] as NotionCustomBlock).notionType, 'callout');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[2] as any).icon, '💡');

		// Toggle
		assertEquals(result[3]._type, 'notion_toggle');
		assertEquals((result[3] as NotionCustomBlock).notionType, 'toggle');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - embed blocks',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('image', 'image-id', {
				external: { url: 'https://example.com/image.jpg' },
				caption: [createRichText('Image caption')],
			}),
			createNotionBlock('bookmark', 'bookmark-id', {
				url: 'https://example.com',
				caption: [createRichText('Bookmark caption')],
			}),
			createNotionBlock('video', 'video-id', {
				file: { url: 'local-video.mp4' },
				caption: [],
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 3);

		// Image
		assertEquals(result[0]._type, 'notion_embed');
		assertEquals((result[0] as NotionEmbedBlock).embedType, 'image');
		assertEquals((result[0] as NotionEmbedBlock).url, 'https://example.com/image.jpg');
		assertEquals((result[0] as NotionEmbedBlock).caption!.length, 1);

		// Bookmark
		assertEquals(result[1]._type, 'notion_embed');
		assertEquals((result[1] as NotionEmbedBlock).embedType, 'bookmark');
		assertEquals((result[1] as NotionEmbedBlock).url, 'https://example.com');

		// Video
		assertEquals(result[2]._type, 'notion_embed');
		assertEquals((result[2] as NotionEmbedBlock).embedType, 'video');
		assertEquals((result[2] as NotionEmbedBlock).url, 'local-video.mp4');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - nested blocks',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const childBlock = createNotionBlock('paragraph', 'child-id', {
			rich_text: [createRichText('Child paragraph')],
		});

		const parentBlock = createNotionBlock('paragraph', 'parent-id', {
			rich_text: [createRichText('Parent paragraph')],
		});
		parentBlock.has_children = true;
		parentBlock.children = [childBlock];

		const result = convertNotionToPortableText([parentBlock]);

		assertEquals(result.length, 2);
		assertEquals(result[0].children![0].text, 'Parent paragraph');
		assertEquals(result[1].children![0].text, 'Child paragraph');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - archived blocks are skipped',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('paragraph', 'normal-id', {
				rich_text: [createRichText('Normal paragraph')],
			}),
		];

		// Add archived block
		const archivedBlock = createNotionBlock('paragraph', 'archived-id', {
			rich_text: [createRichText('Archived paragraph')],
		});
		archivedBlock.archived = true;
		notionBlocks.push(archivedBlock);

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0]._key, 'normal-id');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - unsupported block types create custom blocks',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const unsupportedBlock = {
			object: 'block',
			id: 'unsupported-id',
			type: 'unsupported_type',
			created_time: '2025-01-01T00:00:00.000Z',
			last_edited_time: '2025-01-01T00:00:00.000Z',
			unsupported_type: { some_data: 'value' },
			// deno-lint-ignore no-explicit-any
		} as any;

		const result = convertNotionToPortableText([unsupportedBlock]);

		assertEquals(result.length, 1);
		assertEquals(result[0]._type, 'notion_unsupported_type');
		assertEquals((result[0] as NotionCustomBlock).notionType, 'unsupported_type');
		assertExists((result[0] as NotionCustomBlock).notionData);
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - basic block conversion',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Use a valid UUID for testing valid ID preservation
	const validUuid = '12345678-1234-1234-1234-123456789abc';
	const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: validUuid,
				style: 'normal',
				children: [
					{
						_key: 'test-id-child-1',
						_type: 'span',
						text: 'Hello ',
						marks: [],
					},
					{
						_key: 'test-id-child-2',
						_type: 'span',
						text: 'world',
						marks: ['strong'],
					},
				],
			},
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0].type, 'paragraph');
		// Valid UUID should be preserved as the id
		assertEquals(result[0].id, validUuid);
		assertExists(result[0].paragraph);
		assertEquals(result[0].paragraph!.rich_text.length, 2);
		assertEquals(result[0].paragraph!.rich_text[0].text!.content, 'Hello ');
		assertEquals(result[0].paragraph!.rich_text[1].text!.content, 'world');
		assertEquals(result[0].paragraph!.rich_text[1].annotations!.bold, true);
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - heading conversions',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'h1-id',
				style: 'h1',
				children: [{ _key: 'h1-id-child-1', _type: 'span', text: 'Title' }],
			},
			{
				_type: 'block',
				_key: 'h2-id',
				style: 'h2',
				children: [{ _key: 'h1-id-child-2', _type: 'span', text: 'Subtitle' }],
			},
			{
				_type: 'block',
				_key: 'h3-id',
				style: 'h3',
				children: [{ _key: 'h1-id-child-3', _type: 'span', text: 'Sub-subtitle' }],
			},
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 3);
		assertEquals(result[0].type, 'heading_1');
		assertEquals(result[1].type, 'heading_2');
		assertEquals(result[2].type, 'heading_3');
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - list item conversions',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'bullet-id',
				style: 'normal',
				listItem: 'bullet',
				children: [{ _type: 'span', text: 'Bullet item' }],
			},
			{
				_type: 'block',
				_key: 'number-id',
				style: 'normal',
				listItem: 'number',
				children: [{ _type: 'span', text: 'Number item' }],
			},
			{
				_type: 'block',
				_key: 'checkbox-id',
				style: 'normal',
				listItem: 'checkbox',
				checked: true,
				children: [{ _type: 'span', text: 'Checked item' }],
				// deno-lint-ignore no-explicit-any
			} as any,
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 3);
		assertEquals(result[0].type, 'bulleted_list_item');
		assertEquals(result[1].type, 'numbered_list_item');
		assertEquals(result[2].type, 'to_do');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[2] as any).to_do.checked, true);
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - code block conversion',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'code',
				_key: 'code-id',
				language: 'javascript',
				code: 'console.log("Hello");',
				// deno-lint-ignore no-explicit-any
			} as any,
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0].type, 'code');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[0] as any).code.language, 'javascript');
		// deno-lint-ignore no-explicit-any
		assertEquals((result[0] as any).code.rich_text[0].text.content, 'console.log("Hello");');
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - special block conversions',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'quote-id',
				style: 'blockquote',
				children: [{ _type: 'span', text: 'Quote text' }],
			},
			{
				_type: 'divider',
				_key: 'divider-id',
			},
			{
				_type: 'notion_callout',
				_key: 'callout-id',
				icon: '💡',
				children: [{ _type: 'span', text: 'Callout text' }],
				notionType: 'callout',
				// deno-lint-ignore no-explicit-any
			} as any,
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 3);
		assertEquals(result[0].type, 'quote');
		assertEquals(result[1].type, 'divider');
		assertEquals(result[2].type, 'callout');
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - text formatting marks',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'format-id',
				style: 'normal',
				children: [
					{ _type: 'span', text: 'bold', marks: ['strong'] },
					{ _type: 'span', text: 'italic', marks: ['em'] },
					{ _type: 'span', text: 'code', marks: ['code'] },
					{ _type: 'span', text: 'strikethrough', marks: ['strike-through'] },
					{ _type: 'span', text: 'underline', marks: ['underline'] },
					// deno-lint-ignore no-explicit-any
					{ _type: 'span', text: 'link', marks: ['link'], linkUrl: 'https://example.com' } as any,
				],
			},
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 1);
		const richText = result[0].paragraph!.rich_text;
		assertEquals(richText[0].annotations!.bold, true);
		assertEquals(richText[1].annotations!.italic, true);
		assertEquals(richText[2].annotations!.code, true);
		assertEquals(richText[3].annotations!.strikethrough, true);
		assertEquals(richText[4].annotations!.underline, true);
		assertEquals(richText[5].text!.link!.url, 'https://example.com');
	},
});

Deno.test({
	name: 'generatePortableTextKey - generates unique keys',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const key1 = generatePortableTextKey();
		const key2 = generatePortableTextKey();
		const key3 = generatePortableTextKey('span');

		// Keys should be different
		assertEquals(key1 === key2, false);
		assertEquals(key1 === key3, false);
		assertEquals(key2 === key3, false);

		// Check prefixes
		assertEquals(key1.startsWith('block-'), true);
		assertEquals(key3.startsWith('span-'), true);

		// Check format
		const keyPattern = /^[a-z]+-\d+-[a-z0-9]{9}$/;
		assertEquals(keyPattern.test(key1), true);
		assertEquals(keyPattern.test(key2), true);
		assertEquals(keyPattern.test(key3), true);
	},
});

Deno.test({
	name: 'validatePortableText - validates correct structure',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const validBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'test-id',
				style: 'normal',
				children: [
					{
						_type: 'span',
						text: 'Valid text',
					},
				],
			},
			{
				_type: 'code',
				_key: 'code-id',
				language: 'typescript',
				code: 'const x = 1;',
				// deno-lint-ignore no-explicit-any
			} as any,
			{
				_type: 'divider',
				_key: 'divider-id',
			},
		];

		assertEquals(validatePortableText(validBlocks), true);
	},
});

Deno.test({
	name: 'validatePortableText - detects invalid structures',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		// Not an array
		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableText('not an array' as any), false);

		// Missing _type
		const missingType = [
			{
				_key: 'test-id',
				style: 'normal',
				children: [{ _type: 'span', text: 'Text' }],
			},
		];
		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableText(missingType as any), false);

		// Block without children
		const blockWithoutChildren = [
			{
				_type: 'block',
				_key: 'test-id',
				style: 'normal',
			},
		];
		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableText(blockWithoutChildren as any), false);

		// Invalid span type
		const invalidSpanType = [
			{
				_type: 'block',
				_key: 'test-id',
				style: 'normal',
				children: [
					{
						_type: 'invalid',
						text: 'Text',
					},
				],
			},
		];
		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableText(invalidSpanType as any), false);

		// Span without text
		const spanWithoutText = [
			{
				_type: 'block',
				_key: 'test-id',
				style: 'normal',
				children: [
					{
						_type: 'span',
					},
				],
			},
		];
		// deno-lint-ignore no-explicit-any
		assertEquals(validatePortableText(spanWithoutText as any), false);
	},
});

Deno.test({
	name: 'convertNotionToPortableText - empty and null rich text handling',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const notionBlocks: NotionBlock[] = [
			createNotionBlock('paragraph', 'empty-id', {
				rich_text: [],
			}),
			createNotionBlock('paragraph', 'null-id', {
				rich_text: null,
			}),
		];

		const result = convertNotionToPortableText(notionBlocks);

		assertEquals(result.length, 2);
		assertEquals(result[0].children!.length, 0);
		assertEquals(result[1].children!.length, 0);
	},
});

Deno.test({
	name: 'convertPortableTextToNotion - invalid UUID key rejection',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const portableBlocks: PortableTextBlock[] = [
			{
				_type: 'block',
				_key: 'invalid-key', // Not a valid UUID
				style: 'normal',
				children: [
					{
						_key: 'span-key',
						_type: 'span',
						text: 'Test content',
						marks: [],
					},
				],
			},
		];

		const result = convertPortableTextToNotion(portableBlocks);

		assertEquals(result.length, 1);
		assertEquals(result[0].type, 'paragraph');
		// Invalid UUID should not be set as id, letting Notion assign its own
		assertEquals(result[0].id, undefined);
		assertExists(result[0].paragraph);
		assertEquals(result[0].paragraph!.rich_text[0].text!.content, 'Test content');
	},
});

Deno.test({
	name: 'convertNotionToPortableText - round trip conversion',
	sanitizeResources: false,
	sanitizeOps: false,
	fn: () => {
		const originalNotionBlocks: NotionBlock[] = [
			createNotionBlock('paragraph', 'para-id', {
				rich_text: [
					createRichText('Hello '),
					createRichText('world', { bold: true }),
				],
			}),
			createNotionBlock('heading_1', 'h1-id', {
				rich_text: [createRichText('Title')],
			}),
		];

		// Notion -> Portable Text -> Notion
		const portableText = convertNotionToPortableText(originalNotionBlocks);
		const backToNotion = convertPortableTextToNotion(portableText);

		assertEquals(backToNotion.length, 2);
		assertEquals(backToNotion[0].type, 'paragraph');
		assertEquals(backToNotion[0].paragraph!.rich_text[0].text!.content, 'Hello ');
		assertEquals(backToNotion[0].paragraph!.rich_text[1].text!.content, 'world');
		assertEquals(backToNotion[0].paragraph!.rich_text[1].annotations!.bold, true);
		assertEquals(backToNotion[1].type, 'heading_1');
	},
});
