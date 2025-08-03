/**
 * Mock clients for testing datasource functionality
 * These clients intercept HTTP requests and return native API responses
 * while storing test data in portable text format for easy assertions
 */
import { logger } from 'shared/logger.ts';
import { NotionClient } from 'api/dataSources/notionClient.ts';
import { GoogleDocsClient } from 'api/dataSources/googledocsClient.ts';
import type { NotionBlock, NotionPage } from 'api/dataSources/notionClient.ts';
import type {
	GoogleDocsBatchUpdateRequest,
	GoogleDocsBatchUpdateResponse,
	GoogleDocument,
	GoogleDriveFilesList,
} from 'api/dataSources/googledocs.types.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';
import type { ProjectConfig } from 'shared/config/types.ts';

// Portable text format for test data storage
export interface PortableTextPage {
	id: string;
	title: string;
	blocks: PortableTextBlock[];
	metadata?: {
		created_time?: string;
		last_edited_time?: string;
		url?: string;
		[key: string]: unknown;
	};
}

export interface PortableTextDocument {
	id: string;
	title: string;
	blocks: PortableTextBlock[];
	metadata?: {
		createdTime?: string;
		modifiedTime?: string;
		webViewLink?: string;
		[key: string]: unknown;
	};
}

/**
 * Mock Notion client that intercepts HTTP requests and returns native Notion API responses
 */
export class MockNotionClient extends NotionClient {
	private pages: Map<string, PortableTextPage> = new Map();
	private databases: Map<string, any> = new Map();
	private errors: Map<string, Error> = new Map();

	constructor() {
		super('mock-api-key');
	}

	// ==================== Setup Methods ====================

	/**
	 * Set page data for testing
	 */
	setPageData(pageId: string, data: PortableTextPage): void {
		this.pages.set(pageId, { ...data });
	}

	/**
	 * Set multiple pages at once
	 */
	setPagesData(pages: Map<string, PortableTextPage>): void {
		this.pages.clear();
		for (const [id, page] of pages) {
			this.pages.set(id, { ...page });
		}
	}

	/**
	 * Set database data for testing
	 */
	setDatabaseData(databaseId: string, data: any): void {
		this.databases.set(databaseId, { ...data });
	}

	/**
	 * Configure an error to be thrown for a specific method
	 */
	setMethodError(method: string, error: Error): void {
		this.errors.set(method, error);
	}

	// ==================== Inspection Methods ====================

	/**
	 * Get page data in portable text format
	 */
	getPageData(pageId: string): PortableTextPage | undefined {
		return this.pages.get(pageId);
	}

	/**
	 * Get all pages data
	 */
	getAllPagesData(): Map<string, PortableTextPage> {
		return new Map(this.pages);
	}

	/**
	 * Clear all test data
	 */
	clearData(): void {
		this.pages.clear();
		this.databases.clear();
		this.errors.clear();
	}

	// ==================== Private Helper Methods ====================

	/**
	 * Convert portable text blocks to Notion blocks
	 */
	private convertToNotionBlocks(blocks: PortableTextBlock[]): NotionBlock[] {
		return blocks.map((block, index) => {
			const blockType = this.mapPortableTextStyleToNotionType(block.style || 'normal', block.listItem);
			const notionBlock: NotionBlock = {
				object: 'block',
				id: block._key || `block-${index}`,
				type: blockType,
				created_time: new Date().toISOString(),
				last_edited_time: new Date().toISOString(),
			};

			// Add type-specific content
			const richText = this.convertChildrenToRichText(block.children || []);

			switch (blockType) {
				case 'paragraph':
					(notionBlock as any).paragraph = { rich_text: richText };
					break;
				case 'heading_1':
					(notionBlock as any).heading_1 = { rich_text: richText };
					break;
				case 'heading_2':
					(notionBlock as any).heading_2 = { rich_text: richText };
					break;
				case 'heading_3':
					(notionBlock as any).heading_3 = { rich_text: richText };
					break;
				case 'quote':
					(notionBlock as any).quote = { rich_text: richText };
					break;
				case 'bulleted_list_item':
					(notionBlock as any).bulleted_list_item = { rich_text: richText };
					break;
				case 'numbered_list_item':
					(notionBlock as any).numbered_list_item = { rich_text: richText };
					break;
				case 'to_do':
					(notionBlock as any).to_do = {
						rich_text: richText,
						checked: (block as any).checked || false,
					};
					break;
				default:
					(notionBlock as any).paragraph = { rich_text: richText };
			}

			return notionBlock;
		});
	}

	/**
	 * Map portable text styles to Notion block types, considering list items
	 */
	private mapPortableTextStyleToNotionType(style: string, listItem?: string): string {
		// Handle list items first
		if (listItem) {
			switch (listItem) {
				case 'bullet':
					return 'bulleted_list_item';
				case 'number':
					return 'numbered_list_item';
				case 'checkbox':
					return 'to_do';
			}
		}

		// Handle regular styles
		const mapping: Record<string, string> = {
			'normal': 'paragraph',
			'h1': 'heading_1',
			'h2': 'heading_2',
			'h3': 'heading_3',
			'blockquote': 'quote',
		};
		return mapping[style] || 'paragraph';
	}

	/**
	 * Convert portable text children to Notion rich text
	 */
	private convertChildrenToRichText(children: any[]): any[] {
		return children.map((child) => ({
			type: 'text',
			text: { content: child.text || '' },
			plain_text: child.text || '',
			annotations: {
				bold: child.marks?.includes('strong') || false,
				italic: child.marks?.includes('em') || false,
				strikethrough: child.marks?.includes('strike-through') || child.marks?.includes('strike') || false,
				underline: child.marks?.includes('underline') || false,
				code: child.marks?.includes('code') || false,
				color: 'default',
			},
			href: child.marks?.includes('link') ? child.linkUrl : null,
		}));
	}

	/**
	 * Convert portable text page to Notion page
	 */
	private convertToNotionPage(pageData: PortableTextPage): NotionPage {
		return {
			object: 'page',
			id: pageData.id,
			created_time: pageData.metadata?.created_time || new Date().toISOString(),
			last_edited_time: pageData.metadata?.last_edited_time || new Date().toISOString(),
			properties: {
				title: {
					id: 'title',
					type: 'title',
					title: [{
						type: 'text',
						text: { content: pageData.title },
						plain_text: pageData.title,
						annotations: {
							bold: false,
							italic: false,
							strikethrough: false,
							underline: false,
							code: false,
							color: 'default',
						},
					}],
				},
			},
			parent: { type: 'workspace', workspace: true },
		} as NotionPage;
	}

	/**
	 * Convert Notion blocks to portable text and add to page data
	 */
	private convertNotionBlocksToPortableText(blocks: Partial<NotionBlock>[]): PortableTextBlock[] {
		return blocks.map((block, index) => {
			const getRichText = () => {
				switch (block.type) {
					case 'paragraph':
						return block.paragraph?.rich_text;
					case 'heading_1':
						return block.heading_1?.rich_text;
					case 'heading_2':
						return block.heading_2?.rich_text;
					case 'heading_3':
						return block.heading_3?.rich_text;
					case 'quote':
						return block.quote?.rich_text;
					case 'bulleted_list_item':
						return block.bulleted_list_item?.rich_text;
					case 'numbered_list_item':
						return block.numbered_list_item?.rich_text;
					case 'to_do':
						return block.to_do?.rich_text;
					default:
						return null;
				}
			};

			const getStyle = () => {
				switch (block.type) {
					case 'heading_1':
						return 'h1';
					case 'heading_2':
						return 'h2';
					case 'heading_3':
						return 'h3';
					case 'quote':
						return 'blockquote';
					case 'bulleted_list_item':
					case 'numbered_list_item':
					case 'to_do':
						return 'normal';
					default:
						return 'normal';
				}
			};

			const getListItem = () => {
				switch (block.type) {
					case 'bulleted_list_item':
						return 'bullet';
					case 'numbered_list_item':
						return 'number';
					case 'to_do':
						return 'checkbox';
					default:
						return undefined;
				}
			};

			const richText = getRichText();
			const portableBlock: PortableTextBlock = {
				_type: 'block',
				_key: block.id || `block-${Date.now()}-${index}`,
				style: getStyle(),
				children: richText?.map((rt: { plain_text: string; text: { content: string } }, rtIndex: number) => ({
					_type: 'span',
					_key: `span-${Date.now()}-${index}-${rtIndex}`,
					text: rt.plain_text || rt.text?.content || '',
					marks: this.extractMarksFromRichText(rt),
				})) || [{
					_type: 'span',
					_key: `span-${Date.now()}-${index}`,
					text: 'Block content',
				}],
			};

			// Add list item attribute if applicable
			const listItem = getListItem();
			if (listItem) {
				portableBlock.listItem = listItem;
				portableBlock.level = 1;
			}

			// Add checkbox state for to-do items
			if (block.type === 'to_do' && block.to_do) {
				(portableBlock as any).checked = block.to_do.checked || false;
			}

			return portableBlock;
		});
	}

	/**
	 * Extract marks from Notion rich text annotations
	 */
	private extractMarksFromRichText(richTextItem: any): string[] {
		const marks: string[] = [];
		if (richTextItem.annotations) {
			if (richTextItem.annotations.bold) marks.push('strong');
			if (richTextItem.annotations.italic) marks.push('em');
			if (richTextItem.annotations.strikethrough) marks.push('strike-through');
			if (richTextItem.annotations.underline) marks.push('underline');
			if (richTextItem.annotations.code) marks.push('code');
		}
		return marks;
	}

	// ==================== Override Request Method ====================

	/**
	 * Override request method to return native Notion API responses
	 */
	override async request<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
		const errorMessage = `🔍 MockNotionClient: ${method} ${endpoint}`;
		logger.info(errorMessage);

		// Parse endpoint to separate path from query parameters
		const [path, queryString] = endpoint.split('?');
		const segments = path.split('/').filter((s) => s.length > 0);

		// Check for configured errors
		const errorKey = `${method.toLowerCase()}_${path}`;
		if (this.errors.has(errorKey)) {
			throw this.errors.get(errorKey)!;
		}

		// Parse endpoint and handle different API calls
		if (segments.length === 2 && segments[0] === 'users' && segments[1] === 'me' && method === 'GET') {
			// GET /users/me - bot user info
			return {
				object: 'user',
				id: 'mock-bot-user-id',
				type: 'bot',
				name: 'Mock Bot User',
				avatar_url: null,
				bot: {
					owner: {
						type: 'workspace',
						workspace: true,
					},
				},
			} as T;
		} else if (segments.length === 2 && segments[0] === 'databases' && method === 'GET') {
			// GET /databases/{databaseId}
			const databaseId = segments[1];

			// Check if this is actually a page ID being queried as database (common pattern)
			if (this.pages.has(databaseId)) {
				throw new Error(`Object is a page, not a database: ${databaseId}`);
			}

			// Mock database response for known test database IDs
			if (databaseId === 'test-database-456') {
				return {
					object: 'database',
					id: databaseId,
					title: [{
						type: 'text',
						text: { content: 'Test Database' },
						plain_text: 'Test Database',
						annotations: {
							bold: false,
							italic: false,
							strikethrough: false,
							underline: false,
							code: false,
							color: 'default',
						},
					}],
					properties: {
						'Name': {
							id: 'title',
							type: 'title',
							title: {},
						},
					},
					created_time: '2024-01-01T00:00:00.000Z',
					last_edited_time: '2024-01-01T00:00:00.000Z',
					url: `https://notion.so/${databaseId}`,
				} as T;
			}

			throw new Error(`Database ${databaseId} not found`);
		} else if (segments.length === 2 && segments[0] === 'pages' && method === 'GET') {
			// GET /pages/{pageId}
			const pageId = segments[1];
			const pageData = this.pages.get(pageId);
			if (!pageData) {
				throw new Error(`Page ${pageId} not found`);
			}
			return this.convertToNotionPage(pageData) as T;
		} else if (
			segments.length === 3 && segments[0] === 'blocks' && segments[2] === 'children' && method === 'GET'
		) {
			// GET /blocks/{pageId}/children
			const pageId = segments[1];
			const pageData = this.pages.get(pageId);
			if (!pageData) {
				throw new Error(`Page ${pageId} not found`);
			}
			return {
				object: 'list',
				results: this.convertToNotionBlocks(pageData.blocks),
				next_cursor: null,
				has_more: false,
			} as T;
		} else if (
			segments.length === 3 && segments[0] === 'blocks' && segments[2] === 'children' && method === 'PATCH'
		) {
			// PATCH /blocks/{pageId}/children - append blocks
			const pageId = segments[1];
			const pageData = this.pages.get(pageId);
			if (!pageData) {
				throw new Error(`Page ${pageId} not found`);
			}

			const requestBody = body as { children: Partial<NotionBlock>[] };
			const newPortableBlocks = this.convertNotionBlocksToPortableText(requestBody.children);
			pageData.blocks.push(...newPortableBlocks);
			this.pages.set(pageId, pageData);

			const newNotionBlocks = this.convertToNotionBlocks(newPortableBlocks);
			return { object: 'list', results: newNotionBlocks } as T;
		} else if (segments.length === 1 && segments[0] === 'pages' && method === 'POST') {
			// POST /pages - create page
			const requestBody = body as {
				parent: { database_id?: string; page_id?: string };
				properties: Record<string, any>;
				children?: Partial<NotionBlock>[];
			};

			const pageId = `page-${Date.now()}`;

			// Extract title from properties
			let title = 'New Page';
			for (const [key, prop] of Object.entries(requestBody.properties)) {
				if (prop.title && Array.isArray(prop.title)) {
					title = prop.title.map((t: any) => t.text?.content || t.plain_text || '').join('');
					break;
				}
			}

			// Convert blocks to portable text
			const portableBlocks = requestBody.children
				? this.convertNotionBlocksToPortableText(requestBody.children)
				: [];

			const pageData: PortableTextPage = {
				id: pageId,
				title,
				blocks: portableBlocks,
				metadata: {
					created_time: new Date().toISOString(),
					last_edited_time: new Date().toISOString(),
				},
			};

			this.pages.set(pageId, pageData);
			return this.convertToNotionPage(pageData) as T;
		} else if (segments.length === 1 && segments[0] === 'search' && method === 'POST') {
			// POST /search
			const results = [];
			const requestBody = body as { query?: string; filter?: any; page_size?: number };

			for (const [id, pageData] of this.pages) {
				if (!requestBody.query || pageData.title.toLowerCase().includes(requestBody.query.toLowerCase())) {
					if (!requestBody.filter || requestBody.filter.value === 'page') {
						results.push(this.convertToNotionPage(pageData));
					}
				}
			}

			return {
				object: 'list',
				results,
				next_cursor: null,
				has_more: false,
			} as T;
		} else if (segments.length === 2 && segments[0] === 'blocks' && method === 'DELETE') {
			// DELETE /blocks/{blockId} - delete block by key
			const blockId = segments[1];

			// Find the page containing this block and remove it
			for (const [pageId, pageData] of this.pages) {
				const blockIndex = pageData.blocks.findIndex((b) => b._key === blockId);
				if (blockIndex !== -1) {
					const deletedBlock = pageData.blocks[blockIndex];
					pageData.blocks.splice(blockIndex, 1);
					this.pages.set(pageId, pageData);
					return this.convertToNotionBlocks([deletedBlock])[0] as T;
				}
			}

			throw new Error(`Block ${blockId} not found`);
		} else if (
			segments.length === 3 && segments[0] === 'databases' && segments[2] === 'query' && method === 'POST'
		) {
			// POST /databases/{databaseId}/query - query database pages
			const databaseId = segments[1];

			if (databaseId === 'test-database-456') {
				// Return mock database pages
				return {
					object: 'list',
					results: [], // Empty for now, could add mock database pages
					next_cursor: null,
					has_more: false,
				} as T;
			}

			throw new Error(`Database ${databaseId} not found`);
		} else {
			// Unhandled endpoint
			const errorMessage = `🚨 MockNotionClient: Unhandled endpoint: ${method} ${path} (segments: [${
				segments.join(', ')
			}])`;
			logger.error(errorMessage);
			throw new Error(errorMessage);
		}
	}
}

/**
 * Mock Google Docs client that intercepts HTTP requests and returns native Google API responses
 */
export class MockGoogleDocsClient extends GoogleDocsClient {
	private documents: Map<string, PortableTextDocument> = new Map();
	private errors: Map<string, Error> = new Map();

	constructor() {
		// Create with minimal required parameters
		super(
			{} as ProjectConfig,
			undefined,
			'mock-access-token',
			undefined,
			undefined,
		);
	}

	// ==================== Setup Methods ====================

	/**
	 * Set document data for testing
	 */
	setDocumentData(documentId: string, data: PortableTextDocument): void {
		this.documents.set(documentId, { ...data });
	}

	/**
	 * Set multiple documents at once
	 */
	setDocumentsData(documents: Map<string, PortableTextDocument>): void {
		this.documents.clear();
		for (const [id, doc] of documents) {
			this.documents.set(id, { ...doc });
		}
	}

	/**
	 * Configure an error to be thrown for a specific method
	 */
	setMethodError(method: string, error: Error): void {
		this.errors.set(method, error);
	}

	// ==================== Inspection Methods ====================

	/**
	 * Get document data in portable text format
	 */
	getDocumentData(documentId: string): PortableTextDocument | undefined {
		return this.documents.get(documentId);
	}

	/**
	 * Get all documents data
	 */
	getAllDocumentsData(): Map<string, PortableTextDocument> {
		return new Map(this.documents);
	}

	/**
	 * Clear all test data
	 */
	clearData(): void {
		this.documents.clear();
		this.errors.clear();
	}

	// ==================== Private Helper Methods ====================

	/**
	 * Convert portable text document to Google Document structure
	 */
	private convertToGoogleDocument(docData: PortableTextDocument): GoogleDocument {
		const content = docData.blocks.map((block, index) => {
			const text = block.children?.[0]?.text || '';
			const startIndex = index * 100; // Simplified indexing
			const endIndex = startIndex + text.length + 1; // +1 for paragraph break

			return {
				startIndex,
				endIndex,
				paragraph: {
					elements: [{
						startIndex,
						endIndex: endIndex - 1,
						textRun: {
							content: text,
							textStyle: this.getGoogleDocsTextStyle(block.style || 'normal'),
						},
					}],
					paragraphStyle: this.getGoogleDocsParagraphStyle(block.style || 'normal'),
				},
			};
		});

		// Add final content element for document end
		const lastIndex = content.length > 0 ? content[content.length - 1].endIndex : 1;
		content.push({
			startIndex: lastIndex,
			endIndex: lastIndex + 1,
			paragraph: {
				elements: [{
					startIndex: lastIndex,
					endIndex: lastIndex + 1,
					textRun: {
						content: '\n',
						textStyle: this.getGoogleDocsTextStyle('normal'),
					},
				}],
				paragraphStyle: this.getGoogleDocsParagraphStyle('normal'),
			},
		});

		return {
			documentId: docData.id,
			title: docData.title,
			body: { content },
			revisionId: 'mock-revision',
		} as GoogleDocument;
	}

	/**
	 * Get Google Docs text style for portable text style
	 */
	private getGoogleDocsTextStyle(style: string): any {
		const baseStyle = { fontSize: { magnitude: 11, unit: 'PT' } };

		switch (style) {
			case 'h1':
				return { ...baseStyle, fontSize: { magnitude: 20, unit: 'PT' }, bold: true };
			case 'h2':
				return { ...baseStyle, fontSize: { magnitude: 16, unit: 'PT' }, bold: true };
			case 'h3':
				return { ...baseStyle, fontSize: { magnitude: 14, unit: 'PT' }, bold: true };
			default:
				return baseStyle;
		}
	}

	/**
	 * Get Google Docs paragraph style for portable text style
	 */
	private getGoogleDocsParagraphStyle(style: string): any {
		switch (style) {
			case 'h1':
				return { namedStyleType: 'HEADING_1' };
			case 'h2':
				return { namedStyleType: 'HEADING_2' };
			case 'h3':
				return { namedStyleType: 'HEADING_3' };
			default:
				return { namedStyleType: 'NORMAL_TEXT' };
		}
	}

	/**
	 * Process Google Docs batch update requests and update portable text data
	 */
	private processBatchUpdateRequests(
		docData: PortableTextDocument,
		requests: GoogleDocsBatchUpdateRequest[],
	): void {
		let insertedContent: string | PortableTextBlock[] | null = null;
		const styleUpdates: Array<{ startIndex: number; endIndex: number; style: string }> = [];

		for (const request of requests) {
			if (request.insertText) {
				insertedContent = request.insertText.text;
			} else if (request.updateParagraphStyle) {
				// Collect style updates to apply later
				const { startIndex, endIndex } = request.updateParagraphStyle.range;
				const namedStyleType = request.updateParagraphStyle.paragraphStyle.namedStyleType;
				let style = 'normal';

				switch (namedStyleType) {
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
					default:
						style = 'normal';
				}

				styleUpdates.push({ startIndex: startIndex - 1, endIndex: endIndex - 1, style });
			} else if (request.replaceAllText) {
				// Replace text in all blocks
				const searchText = request.replaceAllText.containsText.text;
				const replaceText = request.replaceAllText.replaceText;

				docData.blocks.forEach((block) => {
					block.children?.forEach((child) => {
						if (child.text && child.text.includes(searchText)) {
							child.text = child.text.replace(new RegExp(searchText, 'g'), replaceText);
						}
					});
				});
			}
		}

		// If we have inserted content, handle both string and structured block formats
		if (insertedContent !== null) {
			// Clear existing blocks first (since this is a complete rewrite)
			docData.blocks = [];

			//logger.info('MockGoogleDocsClient - insertedContent', insertedContent);

			// Check if insertedContent is an array of structured blocks
			if (Array.isArray(insertedContent)) {
				// Handle structured blocks format (new range format)
				for (const block of insertedContent) {
					// Ensure each block has required properties
					const portableBlock: PortableTextBlock = {
						_type: block._type || 'block',
						_key: block._key || `block-${Date.now()}-${Math.random()}`,
						style: block.style || 'normal',
						children: block.children || [{
							_type: 'span',
							_key: `span-${Date.now()}-${Math.random()}`,
							text: '',
							marks: [],
						}],
					};

					// Apply any additional properties from the block
					if (block.markDefs) portableBlock.markDefs = block.markDefs;
					if (block.listItem) portableBlock.listItem = block.listItem;
					if (block.level) portableBlock.level = block.level;

					docData.blocks.push(portableBlock);
				}
			} else if (typeof insertedContent === 'string') {
				// Handle legacy string format
				const paragraphs = insertedContent.split('\n').filter((p) => p.trim() !== '');
				let currentIndex = 0;

				for (const paragraph of paragraphs) {
					const paragraphEndIndex = currentIndex + paragraph.length;

					// Find the style for this paragraph based on its position
					let style = 'normal';
					for (const styleUpdate of styleUpdates) {
						if (currentIndex >= styleUpdate.startIndex && paragraphEndIndex <= styleUpdate.endIndex) {
							style = styleUpdate.style;
							break;
						}
					}

					docData.blocks.push({
						_type: 'block',
						_key: `block-${Date.now()}-${currentIndex}`,
						style,
						children: [{
							_type: 'span',
							_key: `span-${Date.now()}-${currentIndex}`,
							text: paragraph,
							marks: [],
						}],
					});

					currentIndex += paragraph.length + 1; // +1 for the newline
				}
			}
		}
	}

	// ==================== Override Request Method ====================

	/**
	 * Override request method to return native Google API responses
	 */
	override async request<T>(
		endpoint: string,
		method: string = 'GET',
		body?: unknown,
		apiType: 'docs' | 'drive' = 'docs',
	): Promise<T> {
		const errorMessage = `🔍 MockGoogleDocsClient: ${method} ${endpoint} (${apiType})`;
		logger.info(errorMessage);

		// Parse endpoint to separate path from query parameters
		const [path, queryString] = endpoint.split('?');
		const segments = path.split('/').filter((s) => s.length > 0);

		// Check for configured errors
		const errorKey = `${method.toLowerCase()}_${path}_${apiType}`;
		if (this.errors.has(errorKey)) {
			throw this.errors.get(errorKey)!;
		}

		if (apiType === 'docs') {
			// Google Docs API endpoints
			if (segments.length === 2 && segments[0] === 'documents' && method === 'GET') {
				// GET /documents/{documentId}
				const documentId = segments[1];
				const docData = this.documents.get(documentId);
				if (!docData) {
					throw new Error(`Document ${documentId} not found`);
				}
				return this.convertToGoogleDocument(docData) as T;
			} else if (
				segments.length === 2 && segments[0] === 'documents' && segments[1].includes(':batchUpdate') &&
				method === 'POST'
			) {
				// POST /documents/{documentId}:batchUpdate
				const documentId = segments[1].split(':')[0];
				const docData = this.documents.get(documentId);
				if (!docData) {
					throw new Error(`Document ${documentId} not found`);
				}

				const requestBody = body as { requests: GoogleDocsBatchUpdateRequest[] };
				this.processBatchUpdateRequests(docData, requestBody.requests);
				this.documents.set(documentId, docData);

				return {
					documentId,
					replies: requestBody.requests.map(() => ({})),
				} as T;
			} else if (segments.length === 1 && segments[0] === 'documents' && method === 'POST') {
				// POST /documents - create document
				const requestBody = body as { title: string };
				const documentId = `doc-${Date.now()}`;

				const docData: PortableTextDocument = {
					id: documentId,
					title: requestBody.title,
					blocks: [],
					metadata: {
						createdTime: new Date().toISOString(),
						modifiedTime: new Date().toISOString(),
						webViewLink: `https://docs.google.com/document/d/${documentId}/edit`,
					},
				};

				this.documents.set(documentId, docData);
				return this.convertToGoogleDocument(docData) as T;
			}
		} else if (apiType === 'drive') {
			// Google Drive API endpoints
			if (segments.length === 1 && segments[0] === 'files' && method === 'GET') {
				// GET /files?q=... - list documents
				// Parse query parameters
				const queryParams = new URLSearchParams(queryString || '');
				const q = queryParams.get('q');

				// Filter documents based on query
				let documentsToInclude = this.documents;

				if (q && q.includes('and name contains')) {
					// Extract search term from pattern like "... and name contains 'simple'"
					const nameContainsMatch = q.match(/and name contains '([^']+)'/);
					if (nameContainsMatch) {
						const searchTerm = nameContainsMatch[1];
						documentsToInclude = new Map();
						for (const [id, docData] of this.documents) {
							if (docData.title.toLowerCase().includes(searchTerm.toLowerCase())) {
								documentsToInclude.set(id, docData);
							}
						}
					}
				}

				const files = [];
				for (const [id, docData] of documentsToInclude) {
					files.push({
						id,
						name: docData.title,
						mimeType: 'application/vnd.google-apps.document',
						webViewLink: docData.metadata?.webViewLink || `https://docs.google.com/document/d/${id}/edit`,
						createdTime: docData.metadata?.createdTime || new Date().toISOString(),
						modifiedTime: docData.metadata?.modifiedTime || new Date().toISOString(),
						kind: 'drive#file',
					});
				}

				return {
					kind: 'document',
					files,
					nextPageToken: undefined,
				} as T;
			} else if (segments.length === 2 && segments[0] === 'files' && method === 'GET') {
				// GET /files/{fileId} - get file metadata
				const fileId = segments[1];
				const docData = this.documents.get(fileId);
				if (!docData) {
					throw new Error(`File ${fileId} not found`);
				}

				return {
					id: fileId,
					name: docData.title,
					mimeType: 'application/vnd.google-apps.document',
					webViewLink: docData.metadata?.webViewLink || `https://docs.google.com/document/d/${fileId}/edit`,
					createdTime: docData.metadata?.createdTime || new Date().toISOString(),
					modifiedTime: docData.metadata?.modifiedTime || new Date().toISOString(),
				} as T;
			} else if (segments.length === 1 && segments[0] === 'about' && method === 'GET') {
				// GET /about?fields=user - test connection
				return {
					user: {
						emailAddress: 'test@example.com',
						displayName: 'Test User',
					},
				} as T;
			}
		}

		// Unhandled endpoint
		const unhandledError =
			`🚨 MockGoogleDocsClient: Unhandled endpoint: ${method} ${path} (${apiType}) (segments: [${
				segments.join(', ')
			}])`;
		logger.error(unhandledError);
		throw new Error(unhandledError);
	}
}
