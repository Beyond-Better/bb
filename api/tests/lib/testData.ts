/**
 * Comprehensive test data for mock clients
 * Provides extensive predefined datasets covering common and edge cases
 */
import type { PortableTextDocument, PortableTextPage } from './mockClients.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';

// ==================== Helper Functions ====================

/**
 * Generate a unique key for portable text elements
 * In test mode, generates predictable keys for consistent testing
 */
function generateKey(prefix = 'test'): string {
	// Use unpredictable keys for runtime (preserve original behavior)
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate predictable keys for test data
 * Format: {prefix}-{counter} (e.g., "block-0", "block-1", "span-0")
 */
let testKeyCounter = 0;
function generateTestKey(prefix = 'block'): string {
	return `${prefix}-${testKeyCounter++}`;
}

/**
 * Reset test key counter for deterministic test data generation
 */
function resetTestKeyCounter(): void {
	testKeyCounter = 0;
}

/**
 * Create a simple text span with predictable test key
 */
function createTextSpan(text: string, marks: string[] = []): any {
	return {
		_type: 'span',
		_key: generateTestKey('span'),
		text,
		marks,
	};
}

/**
 * Create a simple block with predictable test key
 */
function createBlock(style: string, text: string, marks: string[] = []): PortableTextBlock {
	return {
		_type: 'block',
		_key: generateTestKey('block'),
		style,
		children: [createTextSpan(text, marks)],
	};
}

// ==================== Notion Test Data ====================

/**
 * Simple page for basic testing
 */
resetTestKeyCounter();
export const SIMPLE_NOTION_PAGE: PortableTextPage = {
	id: 'simple-page-123',
	title: 'Simple Test Page',
	blocks: [
		createBlock('normal', 'This is a simple paragraph.'),
		createBlock('h1', 'Main Heading'),
		createBlock('normal', 'Another paragraph with some content.'),
	],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-02T00:00:00.000Z',
		url: 'https://notion.so/simple-page-123',
	},
};

/**
 * Complex page with various formatting and edge cases
 */
resetTestKeyCounter();
export const COMPLEX_NOTION_PAGE: PortableTextPage = {
	id: 'complex-page-456',
	title: 'Complex Test Page with Various Elements',
	blocks: [
		createBlock('h1', 'Document Title'),
		createBlock('normal', 'This paragraph has ', ['strong']),
		createBlock('normal', 'This text is emphasized', ['em']),
		createBlock('normal', 'This has both bold and italic', ['strong', 'em']),
		createBlock('normal', 'Code snippet: console.log("hello")', ['code']),
		createBlock('h2', 'Secondary Heading'),
		createBlock('blockquote', 'This is a quoted section with important information.'),
		createBlock('normal', 'Final paragraph with a link to somewhere.'),
		// Empty block edge case
		{
			_type: 'block',
			_key: generateTestKey('block'),
			style: 'normal',
			children: [createTextSpan('')],
		},
	],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-03T00:00:00.000Z',
		url: 'https://notion.so/complex-page-456',
	},
};

/**
 * Empty page for edge case testing
 */
resetTestKeyCounter();
export const EMPTY_NOTION_PAGE: PortableTextPage = {
	id: 'empty-page-789',
	title: 'Empty Test Page',
	blocks: [],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-01T00:00:00.000Z',
		url: 'https://notion.so/empty-page-789',
	},
};

/**
 * Page with only a title (minimal content)
 */
resetTestKeyCounter();
export const MINIMAL_NOTION_PAGE: PortableTextPage = {
	id: 'minimal-page-101',
	title: 'Minimal Test Page',
	blocks: [
		createBlock('normal', 'Just one line of content.'),
	],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-01T00:00:00.000Z',
		url: 'https://notion.so/minimal-page-101',
	},
};

/**
 * Page with structured content (lists, headings hierarchy)
 */
resetTestKeyCounter();
export const STRUCTURED_NOTION_PAGE: PortableTextPage = {
	id: 'structured-page-202',
	title: 'Structured Content Page',
	blocks: [
		createBlock('h1', 'Main Topic'),
		createBlock('normal', 'Introduction paragraph explaining the topic.'),
		createBlock('h2', 'Subtopic A'),
		createBlock('normal', 'Details about subtopic A.'),
		createBlock('h3', 'Sub-subtopic A.1'),
		createBlock('normal', 'More specific details here.'),
		createBlock('h2', 'Subtopic B'),
		createBlock('normal', 'Details about subtopic B.'),
		createBlock('normal', 'Conclusion paragraph wrapping up the content.'),
	],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-04T00:00:00.000Z',
		url: 'https://notion.so/structured-page-202',
	},
};

/**
 * Test parent page for hierarchical page creation
 */
resetTestKeyCounter();
export const TEST_PARENT_PAGE: PortableTextPage = {
	id: 'test-page-123',
	title: 'Test Parent Page',
	blocks: [
		createBlock('h1', 'Parent Page for Testing'),
		createBlock('normal', 'This page serves as a parent for creating child pages in tests.'),
	],
	metadata: {
		created_time: '2024-01-01T00:00:00.000Z',
		last_edited_time: '2024-01-01T00:00:00.000Z',
		url: 'https://notion.so/test-page-123',
	},
};

/**
 * Default Notion test data collection
 */
export const DEFAULT_NOTION_TEST_DATA = new Map<string, PortableTextPage>([
	[SIMPLE_NOTION_PAGE.id, SIMPLE_NOTION_PAGE],
	[COMPLEX_NOTION_PAGE.id, COMPLEX_NOTION_PAGE],
	[EMPTY_NOTION_PAGE.id, EMPTY_NOTION_PAGE],
	[MINIMAL_NOTION_PAGE.id, MINIMAL_NOTION_PAGE],
	[STRUCTURED_NOTION_PAGE.id, STRUCTURED_NOTION_PAGE],
	[TEST_PARENT_PAGE.id, TEST_PARENT_PAGE],
]);

// ==================== Google Docs Test Data ====================

/**
 * Google Docs API structure helpers for range operation testing
 */
export interface GoogleDocsApiStructure {
	body: {
		content: Array<{
			startIndex: number;
			endIndex: number;
			paragraph?: {
				elements: Array<{
					startIndex: number;
					endIndex: number;
					textRun: {
						content: string;
					};
				}>;
			};
		}>;
	};
}

/**
 * Extended PortableText document with Google Docs API structure
 */
export interface PortableTextDocumentWithGoogleDocs extends PortableTextDocument {
	googleDocsStructure?: GoogleDocsApiStructure;
}

/**
 * Simple document for basic testing
 */
resetTestKeyCounter();
export const SIMPLE_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'simple-doc-123',
	title: 'Simple Test Document',
	blocks: [
		createBlock('normal', 'This is a simple paragraph in Google Docs.'),
		createBlock('h1', 'Document Heading'),
		createBlock('normal', 'Another paragraph with content.'),
	],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-02T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/simple-doc-123/edit',
	},
};

/**
 * Complex document with various formatting
 */
resetTestKeyCounter();
export const COMPLEX_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'complex-doc-456',
	title: 'Complex Test Document with Formatting',
	blocks: [
		createBlock('h1', 'Document Title'),
		createBlock('normal', 'This paragraph has bold text', ['strong']),
		createBlock('normal', 'This text is italicized', ['em']),
		createBlock('normal', 'This combines bold and italic formatting', ['strong', 'em']),
		createBlock('normal', 'Inline code: document.getElementById("test")', ['code']),
		createBlock('h2', 'Section Header'),
		createBlock('blockquote', 'This is a quoted block with important information.'),
		createBlock('normal', 'Regular paragraph with normal formatting.'),
		// Edge case: empty block
		{
			_type: 'block',
			_key: generateTestKey('block'),
			style: 'normal',
			children: [createTextSpan('')],
		},
	],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-03T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/complex-doc-456/edit',
	},
};

/**
 * Empty document for edge case testing
 */
resetTestKeyCounter();
export const EMPTY_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'empty-doc-789',
	title: 'Empty Test Document',
	blocks: [],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-01T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/empty-doc-789/edit',
	},
};

/**
 * Document with minimal content
 */
resetTestKeyCounter();
export const MINIMAL_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'minimal-doc-101',
	title: 'Minimal Test Document',
	blocks: [
		createBlock('normal', 'Single paragraph document.'),
	],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-01T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/minimal-doc-101/edit',
	},
};

/**
 * Document with structured content hierarchy
 */
resetTestKeyCounter();
/**
 * Range operations test document with Google Docs API structure
 */
resetTestKeyCounter();
export const RANGE_OPERATIONS_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'range-ops-doc-303',
	title: 'Range Operations Test Document',
	blocks: [
		createBlock('normal', 'This is test content for range operations.'),
		createBlock('normal', 'Second paragraph with more text content.'),
		createBlock('normal', 'Final paragraph for testing deletions and replacements.'),
	],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-05T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/range-ops-doc-303/edit',
	},
};

export const STRUCTURED_GOOGLEDOCS_DOCUMENT: PortableTextDocument = {
	id: 'structured-doc-202',
	title: 'Structured Google Document',
	blocks: [
		createBlock('h1', 'Main Topic'),
		createBlock('normal', 'Introduction explaining the document structure.'),
		createBlock('h2', 'First Section'),
		createBlock('normal', 'Content for the first section.'),
		createBlock('h3', 'Subsection 1.1'),
		createBlock('normal', 'Detailed content for subsection.'),
		createBlock('h2', 'Second Section'),
		createBlock('normal', 'Content for the second section.'),
		createBlock('normal', 'Final paragraph concluding the document.'),
	],
	metadata: {
		createdTime: '2024-01-01T00:00:00.000Z',
		modifiedTime: '2024-01-04T00:00:00.000Z',
		webViewLink: 'https://docs.google.com/document/d/structured-doc-202/edit',
	},
};

/**
 * Default Google Docs test data collection
 */
export const DEFAULT_GOOGLEDOCS_TEST_DATA = new Map<string, PortableTextDocument>([
	[SIMPLE_GOOGLEDOCS_DOCUMENT.id, SIMPLE_GOOGLEDOCS_DOCUMENT],
	[COMPLEX_GOOGLEDOCS_DOCUMENT.id, COMPLEX_GOOGLEDOCS_DOCUMENT],
	[EMPTY_GOOGLEDOCS_DOCUMENT.id, EMPTY_GOOGLEDOCS_DOCUMENT],
	[MINIMAL_GOOGLEDOCS_DOCUMENT.id, MINIMAL_GOOGLEDOCS_DOCUMENT],
	[STRUCTURED_GOOGLEDOCS_DOCUMENT.id, STRUCTURED_GOOGLEDOCS_DOCUMENT],
	[RANGE_OPERATIONS_GOOGLEDOCS_DOCUMENT.id, RANGE_OPERATIONS_GOOGLEDOCS_DOCUMENT],
]);

// ==================== Test Data Access Functions ====================

/**
 * Get a copy of the default Notion test data
 */
export function getDefaultNotionTestData(): Map<string, PortableTextPage> {
	const data = new Map<string, PortableTextPage>();
	for (const [id, page] of DEFAULT_NOTION_TEST_DATA) {
		// Deep copy to prevent test interference
		data.set(id, JSON.parse(JSON.stringify(page)));
	}
	return data;
}

/**
 * Get a copy of the default Google Docs test data
 */
export function getDefaultGoogleDocsTestData(): Map<string, PortableTextDocument> {
	const data = new Map<string, PortableTextDocument>();
	for (const [id, doc] of DEFAULT_GOOGLEDOCS_TEST_DATA) {
		// Deep copy to prevent test interference
		data.set(id, JSON.parse(JSON.stringify(doc)));
	}
	return data;
}

/**
 * Create a test page with custom content
 */
export function createTestPage(
	id: string,
	title: string,
	content: string[],
	styles: string[] = [],
): PortableTextPage {
	const blocks: PortableTextBlock[] = content.map((text, index) => createBlock(styles[index] || 'normal', text));

	return {
		id,
		title,
		blocks,
		metadata: {
			created_time: new Date().toISOString(),
			last_edited_time: new Date().toISOString(),
			url: `https://notion.so/${id}`,
		},
	};
}

/**
 * Create a test document with custom content
 */
export function createTestDocument(
	id: string,
	title: string,
	content: string[],
	styles: string[] = [],
): PortableTextDocument {
	const blocks: PortableTextBlock[] = content.map((text, index) => createBlock(styles[index] || 'normal', text));

	return {
		id,
		title,
		blocks,
		metadata: {
			createdTime: new Date().toISOString(),
			modifiedTime: new Date().toISOString(),
			webViewLink: `https://docs.google.com/document/d/${id}/edit`,
		},
	};
}
