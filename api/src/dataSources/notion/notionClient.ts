/**
 * NotionClient for interacting with the Notion API.
 */
import { logger } from 'shared/logger.ts';
import type { AuthConfig } from '../interfaces/authentication.ts';

// Common Notion types
export type NotionObjectType =
	| 'page'
	| 'database'
	| 'block'
	| 'list'
	| 'user'
	| 'comment';

export type RichTextItemResponse = {
	type: 'text' | 'mention' | 'equation';
	text?: {
		content: string;
		link?: {
			url: string;
		} | null;
	};
	mention?: {
		type:
			| 'database'
			| 'date'
			| 'link_preview'
			| 'page'
			| 'template_mention'
			| 'user';
		[key: string]: any;
	};
	annotations?: {
		bold: boolean;
		italic: boolean;
		strikethrough: boolean;
		underline: boolean;
		code: boolean;
		color: string;
	};
	plain_text?: string;
	href?: string | null;
	equation?: {
		expression: string;
	};
};

export type BlockType =
	| 'paragraph'
	| 'heading_1'
	| 'heading_2'
	| 'heading_3'
	| 'bulleted_list_item'
	| 'numbered_list_item'
	| 'to_do'
	| 'toggle'
	| 'child_page'
	| 'child_database'
	| 'embed'
	| 'callout'
	| 'quote'
	| 'equation'
	| 'divider'
	| 'table_of_contents'
	| 'column'
	| 'column_list'
	| 'link_preview'
	| 'synced_block'
	| 'template'
	| 'link_to_page'
	| 'audio'
	| 'bookmark'
	| 'breadcrumb'
	| 'code'
	| 'file'
	| 'image'
	| 'pdf'
	| 'video'
	| 'unsupported'
	| string;

// Block response types
export interface NotionBlock {
	object: 'block';
	id: string;
	type: BlockType;
	created_time: string;
	last_edited_time: string;
	has_children?: boolean;
	archived?: boolean;
	[key: string]: any; // For type-specific content
}

// Page response types
export interface NotionPage {
	object: 'page';
	id: string;
	created_time: string;
	last_edited_time: string;
	created_by?: {
		object: 'user';
		id: string;
	};
	last_edited_by?: {
		object: 'user';
		id: string;
	};
	cover?: {
		type: string;
		[key: string]: any;
	} | null;
	icon?: {
		type: string;
		[key: string]: any;
	} | null;
	archived?: boolean;
	in_trash?: boolean;
	url?: string;
	parent: {
		type: 'database_id' | 'page_id' | 'workspace';
		database_id?: string;
		page_id?: string;
	};
	properties: Record<string, PageProperty>;
}

export interface PageProperty {
	id: string;
	type: string;
	[key: string]: any;
}

// Database response types
export interface NotionDatabase {
	object: 'database';
	id: string;
	created_time: string;
	last_edited_time: string;
	title: RichTextItemResponse[];
	description?: RichTextItemResponse[];
	url?: string;
	icon?: {
		type: string;
		emoji?: string;
		[key: string]: any;
	} | null;
	cover?: {
		type: string;
		[key: string]: any;
	} | null;
	properties: Record<string, DatabasePropertyConfig>;
	parent?: {
		type: string;
		page_id?: string;
		workspace?: boolean;
	};
	archived?: boolean;
	is_inline?: boolean;
}

export interface DatabasePropertyConfig {
	id: string;
	name: string;
	type: string;
	[key: string]: any;
}

// User response types
export interface NotionUser {
	object: 'user';
	id: string;
	name?: string;
	avatar_url?: string | null;
	type?: 'person' | 'bot';
	person?: {
		email: string;
	};
	bot?: Record<string, any>;
}

// Comment response types
export interface NotionComment {
	object: 'comment';
	id: string;
	parent: {
		type: 'page_id' | 'block_id';
		page_id?: string;
		block_id?: string;
	};
	discussion_id: string;
	created_time: string;
	last_edited_time: string;
	created_by: {
		object: 'user';
		id: string;
	};
	rich_text: RichTextItemResponse[];
}

// Common list response types
export interface NotionListResponse<T> {
	object: 'list';
	results: T[];
	next_cursor: string | null;
	has_more: boolean;
	type?: string;
}

export type NotionSearchResult = NotionListResponse<NotionPage | NotionDatabase>;
export type NotionListBlocksResult = NotionListResponse<NotionBlock>;
export type NotionListUsersResult = NotionListResponse<NotionUser>;
export type NotionListCommentsResult = NotionListResponse<NotionComment>;

/**
 * Client for interacting with the Notion API
 */
export class NotionClient {
	private apiKey: string;
	private apiBaseUrl = 'https://api.notion.com/v1';
	private notionVersion = '2022-06-28';

	/**
	 * Create a new NotionClient
	 * @param apiKey The Notion API key
	 */
	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	/**
	 * Create a NotionClient from an AuthConfig
	 * @param auth Authentication configuration
	 * @returns A new NotionClient instance or null if auth is invalid
	 */
	static fromAuthConfig(auth?: AuthConfig): NotionClient | null {
		if (!auth || auth.method !== 'apiKey' || !auth.apiKey) {
			logger.warn('NotionClient: Invalid auth config, must have apiKey');
			return null;
		}
		//logger.info('NotionClient: fromAuthConfig: Using apiKey', {apiKey: auth.apiKey});

		return new NotionClient(auth.apiKey);
	}

	/**
	 * Make a request to the Notion API
	 * @param endpoint API endpoint path
	 * @param method HTTP method
	 * @param body Request body
	 * @returns Response data
	 */
	private async request<T>(endpoint: string, method: string = 'GET', body?: unknown): Promise<T> {
		const url = `${this.apiBaseUrl}/${endpoint}`;
		//logger.info('NotionClient: request: Using url', {method, url});

		const headers = {
			'Authorization': `Bearer ${this.apiKey}`,
			'Notion-Version': this.notionVersion,
			'Content-Type': 'application/json',
		};
		//logger.info('NotionClient: request: Using headers', {headers});

		try {
			const response = await fetch(url, {
				method,
				headers,
				body: body ? JSON.stringify(body) : undefined,
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Notion API error (${response.status}): ${errorText}`);
			}

			return await response.json() as T;
		} catch (error) {
			logger.error(`NotionClient: Error in ${method} ${endpoint}:`, error);
			throw error;
		}
	}

	/**
	 * Search for Notion pages and databases
	 * @param query Search query
	 * @param filter Filter by object type
	 * @param sort Sort order
	 * @param startCursor Pagination cursor
	 * @param pageSize Number of results per page
	 * @returns Search results
	 */
	async search(
		query: string = '',
		filter?: { property: 'object'; value: 'page' | 'database' },
		sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' },
		startCursor?: string,
		pageSize: number = 100,
	): Promise<NotionSearchResult> {
		const body: Record<string, unknown> = { page_size: pageSize };

		if (query) body.query = query;
		if (filter) body.filter = filter;
		if (sort) body.sort = sort;
		if (startCursor) body.start_cursor = startCursor;

		return await this.request<NotionSearchResult>('search', 'POST', body);
	}

	/**
	 * Get a page by ID
	 * @param pageId Notion page ID
	 * @returns Page details
	 */
	async getPage(pageId: string): Promise<NotionPage> {
		return await this.request<NotionPage>(`pages/${pageId}`);
	}

	/**
	 * Update a page's properties
	 * @param pageId Notion page ID
	 * @param properties Properties to update
	 * @returns Updated page
	 */
	async updatePage(pageId: string, properties: Record<string, any>): Promise<NotionPage> {
		const body = { properties };
		return await this.request<NotionPage>(`pages/${pageId}`, 'PATCH', body);
	}

	/**
	 * Create a page in a database or as a child of another page
	 * @param parent Parent database ID or page ID
	 * @param properties Page properties (required for database parent)
	 * @param children Block children to create with the page (optional)
	 * @returns Created page
	 */
	async createPage(
		parent: { database_id: string } | { page_id: string },
		properties: Record<string, any> = {},
		children?: Partial<NotionBlock>[],
	): Promise<NotionPage> {
		const body: Record<string, any> = { parent, properties };

		if (children && children.length > 0) {
			body.children = children;
		}

		return await this.request<NotionPage>('pages', 'POST', body);
	}

	/**
	 * Get page content as blocks
	 * @param pageId Notion page ID
	 * @param startCursor Pagination cursor
	 * @param pageSize Number of blocks per page
	 * @returns Page blocks
	 */
	async getPageBlocks(
		pageId: string,
		startCursor?: string,
		pageSize: number = 100,
	): Promise<NotionListBlocksResult> {
		let endpoint = `blocks/${pageId}/children?page_size=${pageSize}`;
		if (startCursor) {
			endpoint += `&start_cursor=${startCursor}`;
		}

		return await this.request<NotionListBlocksResult>(endpoint);
	}

	/**
	 * Get all blocks for a page, handling pagination
	 * @param pageId Notion page ID
	 * @returns All page blocks
	 */
	async getAllPageBlocks(pageId: string): Promise<NotionBlock[]> {
		const blocks: NotionBlock[] = [];
		let hasMore = true;
		let cursor: string | null = null;

		while (hasMore) {
			const response = await this.getPageBlocks(pageId, cursor || undefined);
			blocks.push(...response.results);
			hasMore = response.has_more;
			cursor = response.next_cursor;

			// Break if no more pages
			if (!hasMore || !cursor) break;
		}

		return blocks;
	}

	/**
	 * Get a database by ID
	 * @param databaseId Notion database ID
	 * @returns Database details
	 */
	async getDatabase(databaseId: string): Promise<NotionDatabase> {
		return await this.request<NotionDatabase>(`databases/${databaseId}`);
	}

	/**
	 * Create a database as a child of a page
	 * @param parent Parent page ID
	 * @param title Database title
	 * @param properties Database properties schema
	 * @returns Created database
	 */
	async createDatabase(
		parent: { page_id: string },
		title: RichTextItemResponse[],
		properties: Record<string, any>,
	): Promise<NotionDatabase> {
		const body = { parent, title, properties };
		return await this.request<NotionDatabase>('databases', 'POST', body);
	}

	/**
	 * Update a database
	 * @param databaseId Database ID
	 * @param title New title (optional)
	 * @param description New description (optional)
	 * @param properties Updated properties schema (optional)
	 * @returns Updated database
	 */
	async updateDatabase(
		databaseId: string,
		title?: RichTextItemResponse[],
		description?: RichTextItemResponse[],
		properties?: Record<string, any>,
	): Promise<NotionDatabase> {
		const body: Record<string, any> = {};
		if (title) body.title = title;
		if (description) body.description = description;
		if (properties) body.properties = properties;

		return await this.request<NotionDatabase>(`databases/${databaseId}`, 'PATCH', body);
	}

	/**
	 * Query a database
	 * @param databaseId Notion database ID
	 * @param filter Filter criteria
	 * @param sorts Sort order
	 * @param startCursor Pagination cursor
	 * @param pageSize Number of results per page
	 * @returns Query results
	 */
	async queryDatabase(
		databaseId: string,
		filter?: any,
		sorts?: Array<{
			property?: string;
			timestamp?: string;
			direction: 'ascending' | 'descending';
		}>,
		startCursor?: string,
		pageSize: number = 100,
	): Promise<NotionListResponse<NotionPage>> {
		const body: Record<string, unknown> = { page_size: pageSize };

		if (filter) body.filter = filter;
		if (sorts) body.sorts = sorts;
		if (startCursor) body.start_cursor = startCursor;

		return await this.request<NotionListResponse<NotionPage>>(
			`databases/${databaseId}/query`,
			'POST',
			body,
		);
	}

	/**
	 * Get all pages from a database, handling pagination
	 * @param databaseId Notion database ID
	 * @param filter Filter criteria
	 * @param sorts Sort order
	 * @returns All matching database pages
	 */
	async getAllDatabasePages(
		databaseId: string,
		filter?: any,
		sorts?: Array<{
			property?: string;
			timestamp?: string;
			direction: 'ascending' | 'descending';
		}>,
	): Promise<NotionPage[]> {
		const pages: NotionPage[] = [];
		let hasMore = true;
		let cursor: string | null = null;

		while (hasMore) {
			const response = await this.queryDatabase(databaseId, filter, sorts, cursor || undefined);
			pages.push(...response.results);
			hasMore = response.has_more;
			cursor = response.next_cursor;

			// Break if no more pages
			if (!hasMore || !cursor) break;
		}

		return pages;
	}

	/**
	 * Retrieve a block by ID
	 * @param blockId Block ID
	 * @returns Block details
	 */
	async getBlock(blockId: string): Promise<NotionBlock> {
		return await this.request<NotionBlock>(`blocks/${blockId}`);
	}

	/**
	 * Update a block
	 * @param blockId Block ID
	 * @param block Block properties to update
	 * @returns Updated block
	 */
	async updateBlock(blockId: string, block: Partial<NotionBlock>): Promise<NotionBlock> {
		return await this.request<NotionBlock>(`blocks/${blockId}`, 'PATCH', block);
	}

	/**
	 * Delete (archive) a block
	 * @param blockId Block ID
	 * @returns Deleted block
	 */
	async deleteBlock(blockId: string): Promise<NotionBlock> {
		return await this.request<NotionBlock>(`blocks/${blockId}`, 'DELETE');
	}

	/**
	 * Add block children to a page or block
	 * @param blockId Block ID or page ID
	 * @param children Children to append
	 * @returns Response with the new children
	 */
	async appendBlockChildren(
		blockId: string,
		children: Partial<NotionBlock>[],
	): Promise<{ object: string; results: NotionBlock[] }> {
		const body = { children };
		return await this.request<{ object: string; results: NotionBlock[] }>(
			`blocks/${blockId}/children`,
			'PATCH',
			body,
		);
	}

	/**
	 * Retrieve users from the workspace
	 * @param startCursor Pagination cursor
	 * @param pageSize Number of users per page
	 * @returns List of users
	 */
	async getUsers(
		startCursor?: string,
		pageSize: number = 100,
	): Promise<NotionListUsersResult> {
		let endpoint = `users?page_size=${pageSize}`;
		if (startCursor) {
			endpoint += `&start_cursor=${startCursor}`;
		}

		return await this.request<NotionListUsersResult>(endpoint);
	}

	/**
	 * Get a specific user by ID
	 * @param userId User ID
	 * @returns User details
	 */
	async getUser(userId: string): Promise<NotionUser> {
		return await this.request<NotionUser>(`users/${userId}`);
	}

	/**
	 * Get the current bot user
	 * @returns Current bot user details
	 */
	async getBotUser(): Promise<NotionUser> {
		return await this.request<NotionUser>('users/me');
	}

	/**
	 * Create a comment on a page or block
	 * @param parent Parent page or block
	 * @param richText Comment text content
	 * @param discussionId For adding to an existing discussion
	 * @returns Created comment
	 */
	async createComment(
		parent: { page_id: string } | { block_id: string },
		richText: RichTextItemResponse[],
		discussionId?: string,
	): Promise<NotionComment> {
		const body: Record<string, any> = { parent, rich_text: richText };
		if (discussionId) {
			body.discussion_id = discussionId;
		}

		return await this.request<NotionComment>('comments', 'POST', body);
	}

	/**
	 * Retrieve comments for a block or page
	 * @param blockId Block ID
	 * @param startCursor Pagination cursor
	 * @param pageSize Number of comments per page
	 * @returns List of comments
	 */
	async getComments(
		blockId: string,
		startCursor?: string,
		pageSize: number = 100,
	): Promise<NotionListCommentsResult> {
		let endpoint = `comments?block_id=${blockId}&page_size=${pageSize}`;
		if (startCursor) {
			endpoint += `&start_cursor=${startCursor}`;
		}

		return await this.request<NotionListCommentsResult>(endpoint);
	}
}
