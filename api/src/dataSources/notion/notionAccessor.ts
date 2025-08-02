/**
 * NotionAccessor implementation for accessing Notion resources.
 */
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import { BBResourceAccessor } from '../base/bbResourceAccessor.ts';
import type {
	NotionBlock,
	NotionClient,
	//NotionComment,
	NotionDatabase,
	NotionPage,
	//NotionUser,
	RichTextItemResponse,
} from 'api/dataSources/notionClient.ts';
import { notionPageToMarkdown } from './notionToMarkdown.ts';
import {
	convertNotionToPortableText,
	convertPortableTextToNotion,
} from 'api/dataSources/notion/portableTextConverter.ts';
import { applyOperationsToPortableText } from 'api/utils/portableTextMutator.ts';
import type {
	PortableTextBlock,
	PortableTextOperation,
	PortableTextOperationResult,
	//PortableTextSpan,
} from 'api/types/portableText.ts';
import { extractResourcePath } from 'shared/dataSource.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type {
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
	ResourceMetadata,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
} from 'shared/types/dataSourceResource.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import type { DataSourceCapability, DataSourceMetadata } from 'shared/types/dataSource.ts';

/**
 * Resource types supported by Notion
 */
enum NotionResourceType {
	Page = 'page',
	Database = 'database',
	Workspace = 'workspace',
	Block = 'block',
	Comment = 'comment',
	User = 'user',
}

/**
 * NotionAccessor for accessing Notion resources
 * Implements resource operations for Notion data sources
 */
export class NotionAccessor extends BBResourceAccessor {
	/**
	 * Notion API client
	 */
	private client: NotionClient;

	/**
	 * Workspace ID from the connection config
	 */
	private workspaceId: string;

	/**
	 * Create a new NotionAccessor
	 * @param connection The data source connection to use
	 * @param client The Notion API client
	 */
	constructor(connection: DataSourceConnection, client: NotionClient) {
		super(connection);

		this.client = client;

		// Extract and validate the workspace ID from the connection config
		const workspaceId = connection.config.workspaceId as string;
		if (!workspaceId || typeof workspaceId !== 'string') {
			throw new Error(`Invalid workspaceId in connection ${connection.id}: ${workspaceId}`);
		}

		this.workspaceId = workspaceId;
		logger.debug(`NotionAccessor: Created for ${connection.id} with workspace ${this.workspaceId}`);
	}

	/**
	 * Parse a Notion resource URI to extract components
	 * @param resourceUri The URI to parse
	 * @returns Parsed components or null if invalid
	 */
	private parseNotionUri(resourceUri: string): { type: NotionResourceType; id: string } | null {
		//logger.info(`NotionAccessor: parseNotionUri - resourceUri ${resourceUri}`);
		const resourcePath = extractResourcePath(resourceUri);
		//logger.info(`NotionAccessor: parseNotionUri - resourcePath ${resourcePath}`);
		if (!resourcePath) {
			return null;
		}

		// Parse the resource path
		// Expected format: "<type>/<id>"
		// Examples: "page/123abc", "database/456def", "workspace/789ghi"
		const parts = resourcePath.split('/');
		//logger.info(`NotionAccessor: parseNotionUri - parts`, {parts});
		if (parts.length !== 2) {
			return null;
		}

		const [type, id] = parts;
		if (!id) {
			return null;
		}
		//logger.info(`NotionAccessor: parseNotionUri - type/id`, {type, id});

		// Validate resource type
		switch (type) {
			case NotionResourceType.Page:
			case NotionResourceType.Database:
			case NotionResourceType.Workspace:
			case NotionResourceType.Block:
			case NotionResourceType.Comment:
			case NotionResourceType.User:
				return { type: type as NotionResourceType, id };
			default:
				return null;
		}
	}

	/**
	 * Check if resource exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 * @returns boolean
	 */
	async isResourceWithinDataSource(_resourceUri: string): Promise<boolean> {
		// [TODO] we need a way to check that non `/workspace` URI's are part of the workspace
		// this isn't an `exists` test; it's a `within` test
		return true;
		//const {type, id} = this.parseNotionUri(resourceUri);
		//return (type === 'workspace' && id === this.workspaceId);
	}

	/**
	 * Check if resource exists in this data source
	 * @param resourceUri The resource URI to check
	 * @param options Optional object with additional checks
	 * @returns boolean
	 */
	async resourceExists(resourceUri: string, _options?: { isFile?: boolean }): Promise<boolean> {
		const parsed = this.parseNotionUri(resourceUri);
		if (!parsed) return false;

		try {
			switch (parsed.type) {
				case NotionResourceType.Page:
					await this.client.getPage(parsed.id);
					return true;
				case NotionResourceType.Database:
					await this.client.getDatabase(parsed.id);
					return true;
				case NotionResourceType.Block:
					await this.client.getBlock(parsed.id);
					return true;
				case NotionResourceType.User:
					await this.client.getUser(parsed.id);
					return true;
				case NotionResourceType.Workspace:
					return parsed.id === this.workspaceId;
				// Comments can't be checked directly by ID
				default:
					return false;
			}
		} catch (_error) {
			// Resource doesn't exist or another error occurred
			return false;
		}
	}

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	async ensureResourcePathExists(_resourceUri: string): Promise<void> {
		// Not applicable for Notion resources
		return;
	}

	/**
	 * Load a resource from Notion
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	async loadResource(resourceUri: string, options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		try {
			// Parse the resource URI
			const parsed = this.parseNotionUri(resourceUri);
			//logger.info(`NotionAccessor: Parsing resource ${resourceUri}`, {parsed});
			if (!parsed) {
				throw new Error(`Invalid Notion resource URI: ${resourceUri}`);
			}

			// Handle different resource types
			switch (parsed.type) {
				case NotionResourceType.Page:
					return await this.loadPageResource(parsed.id, options);

				case NotionResourceType.Database:
					return await this.loadDatabaseResource(parsed.id, options);

				case NotionResourceType.Workspace:
					return await this.loadWorkspaceResource(parsed.id, options);

				case NotionResourceType.Block:
					return await this.loadBlockResource(parsed.id, options);

				case NotionResourceType.User:
					return await this.loadUserResource(parsed.id, options);

				case NotionResourceType.Comment:
					// Not yet implemented
					throw new Error(`Loading comment resources is not yet supported`);

				default:
					throw new Error(`Unsupported Notion resource type: ${parsed.type}`);
			}
		} catch (error) {
			logger.error(`NotionAccessor: Error loading resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to load Notion resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Load a Notion page resource
	 * @param pageId Notion page ID
	 * @param options Loading options
	 * @returns The loaded page with its content and metadata
	 */
	private async loadPageResource(pageId: string, _options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		// Get the page and its blocks
		const page = await this.client.getPage(pageId);
		const blocks = await this.client.getAllPageBlocks(pageId);
		//logger.error(`NotionAccessor: loadPageResource ${pageId}:`, {page, blocks});

		// Convert to markdown
		const content = notionPageToMarkdown(page, blocks, {
			includeTitle: true,
			includeMetadata: true,
		});
		//logger.error(`NotionAccessor: loadPageResource ${pageId}:`, {content});

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `notion://page/${pageId}`,
			type: 'page',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: (page.last_edited_time && typeof page.last_edited_time === 'object')
				? page.last_edited_time as Date
				: new Date(page.last_edited_time),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a Notion database resource
	 * @param databaseId Notion database ID
	 * @param options Loading options
	 * @returns The loaded database with its content and metadata
	 */
	private async loadDatabaseResource(
		databaseId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Get the database and its pages
		const database = await this.client.getDatabase(databaseId);
		const pages = await this.client.getAllDatabasePages(databaseId);

		// Build a markdown representation of the database
		const parts: string[] = [];

		// Add title and metadata
		const title = this.getDatabaseTitle(database);
		if (title) {
			parts.push(`# ${title}\n`);
		}

		parts.push(`> Database ID: ${database.id}  `);
		parts.push(`> Last edited: ${new Date(database.last_edited_time).toLocaleString()}  `);
		if (database.url) {
			parts.push(`> URL: ${database.url}\n`);
		}

		// Add database properties
		parts.push(`## Database Properties\n`);
		if (database.properties) {
			const propEntries = Object.entries(database.properties);
			for (const [name, prop] of propEntries) {
				parts.push(`- **${name}** (${prop.type})`);
			}
			parts.push('');
		}

		// Add table of contents for pages
		parts.push(`## Pages (${pages.length})\n`);
		for (const page of pages) {
			const pageTitle = this.getPageTitle(page) || 'Untitled';
			parts.push(`- [${pageTitle}](notion://page/${page.id})`);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `notion://database/${databaseId}`,
			type: 'database',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: (database.last_edited_time && typeof database.last_edited_time === 'object')
				? database.last_edited_time as Date
				: new Date(database.last_edited_time),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a Notion workspace resource
	 * @param workspaceId Notion workspace ID
	 * @param options Loading options
	 * @returns The loaded workspace with its content and metadata
	 */
	private async loadWorkspaceResource(
		workspaceId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Search for all pages and databases in the workspace
		const searchResults = await this.client.search('', undefined, {
			direction: 'descending',
			timestamp: 'last_edited_time',
		});

		// Get current user information
		let userInfo = 'Unknown User';
		try {
			const botUser = await this.client.getBotUser();
			userInfo = botUser.name || botUser.id;
		} catch (error) {
			logger.warn(`Could not retrieve bot user information: ${errorMessage(error)}`);
		}

		// Build a markdown representation of the workspace
		const parts: string[] = [];

		// Add title and metadata
		parts.push(`# Notion Workspace: ${this.connection.name}\n`);
		parts.push(`> Workspace ID: ${workspaceId}  `);
		parts.push(`> Last updated: ${new Date().toLocaleString()}  `);
		parts.push(`> Connected as: ${userInfo}\n`);

		// Group results by type
		const pages: NotionPage[] = [];
		const databases: NotionDatabase[] = [];

		for (const result of searchResults.results) {
			if ('properties' in result) {
				pages.push(result as NotionPage);
			} else if ('title' in result) {
				databases.push(result as NotionDatabase);
			}
		}

		// Add databases section
		parts.push(`## Databases (${databases.length})\n`);
		for (const db of databases) {
			const title = this.getDatabaseTitle(db) || 'Untitled';
			parts.push(`- [${title}](notion://database/${db.id})`);
		}

		// Add pages section
		parts.push(`\n## Pages (${pages.length})\n`);
		for (const page of pages) {
			const title = this.getPageTitle(page) || 'Untitled';
			parts.push(`- [${title}](notion://page/${page.id})`);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `notion://workspace/${workspaceId}`,
			type: 'workspace',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: new Date(),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a Notion block resource
	 * @param blockId Notion block ID
	 * @param options Loading options
	 * @returns The loaded block with its content and metadata
	 */
	private async loadBlockResource(
		blockId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Get the block and its children
		const block = await this.client.getBlock(blockId);
		const children = block.has_children ? await this.client.getAllPageBlocks(blockId) : [];

		// Build a markdown representation of the block
		const parts: string[] = [];

		// Add metadata
		parts.push(`> Block ID: ${block.id}  `);
		parts.push(`> Type: ${block.type}  `);
		parts.push(`> Last edited: ${new Date(block.last_edited_time).toLocaleString()}\n`);

		// Add block content based on type
		switch (block.type) {
			case 'paragraph':
				if (block.paragraph?.rich_text) {
					const text = block.paragraph.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(text);
				}
				break;
			case 'heading_1':
				if (block.heading_1?.rich_text) {
					const text = block.heading_1.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(`# ${text}`);
				}
				break;
			case 'heading_2':
				if (block.heading_2?.rich_text) {
					const text = block.heading_2.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(`## ${text}`);
				}
				break;
			case 'heading_3':
				if (block.heading_3?.rich_text) {
					const text = block.heading_3.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(`### ${text}`);
				}
				break;
			case 'bulleted_list_item':
				if (block.bulleted_list_item?.rich_text) {
					const text = block.bulleted_list_item.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(`- ${text}`);
				}
				break;
			case 'numbered_list_item':
				if (block.numbered_list_item?.rich_text) {
					const text = block.numbered_list_item.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					parts.push(`1. ${text}`);
				}
				break;
			case 'to_do':
				if (block.to_do?.rich_text) {
					const text = block.to_do.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					const checked = block.to_do.checked ? '[x]' : '[ ]';
					parts.push(`- ${checked} ${text}`);
				}
				break;
			case 'code':
				if (block.code?.rich_text) {
					const text = block.code.rich_text
						.map((rt: { plain_text: string }) => rt.plain_text || '').join('');
					const language = block.code.language || '';
					parts.push(`\`\`\`${language}\n${text}\n\`\`\``);
				}
				break;
			default:
				parts.push(`Block type '${block.type}' content not rendered`);
		}

		// Add children section if there are children
		if (children.length > 0) {
			parts.push(`\n### Children (${children.length})\n`);
			for (const child of children) {
				parts.push(`- [Block ${child.id}](notion://block/${child.id}) (${child.type})`);
			}
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `notion://block/${blockId}`,
			// Map to 'file' since blocks are content elements
			type: 'file',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: (block.last_edited_time && typeof block.last_edited_time === 'object')
				? block.last_edited_time as Date
				: new Date(block.last_edited_time),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a Notion user resource
	 * @param userId Notion user ID
	 * @param options Loading options
	 * @returns The loaded user with its content and metadata
	 */
	private async loadUserResource(
		userId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Get the user
		const user = await this.client.getUser(userId);

		// Build a markdown representation of the user
		const parts: string[] = [];

		// Add title and metadata
		parts.push(`# Notion User: ${user.name || user.id}\n`);
		parts.push(`> User ID: ${user.id}  `);
		if (user.avatar_url) {
			parts.push(`> Avatar: ![User Avatar](${user.avatar_url})\n`);
		}
		parts.push(`> User Type: ${user.type || 'Unknown'}\n`);

		// Add user details based on type
		if (user.type === 'person' && user.person) {
			parts.push(`## Person Details\n`);
			parts.push(`Email: ${user.person.email}`);
		} else if (user.type === 'bot' && user.bot) {
			parts.push(`## Bot Details\n`);
			parts.push(`This is a bot user.`);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `notion://user/${userId}`,
			// Map to 'api' since users are more like API resources
			type: 'api',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: new Date(),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Write a resource to Notion (create or update)
	 * @param resourceUri URI of the resource to write
	 * @param content Content to write
	 * @param options Options for writing the resource
	 * @returns Result of the write operation
	 */
	override async writeResource(
		resourceUri: string,
		content: string,
		options: ResourceWriteOptions = {},
	): Promise<ResourceWriteResult> {
		try {
			// Parse the resource URI
			const parsed = this.parseNotionUri(resourceUri);
			if (!parsed) {
				throw new Error(`Invalid Notion resource URI: ${resourceUri}`);
			}

			// Currently only support updating page content
			switch (parsed.type) {
				case NotionResourceType.Page:
					return await this.writePageResource(parsed.id, content, options);
				default:
					throw new Error(`Writing to ${parsed.type} resources is not supported`);
			}
		} catch (error) {
			logger.error(`NotionAccessor: Error writing resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to write Notion resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Write content to a Notion page
	 * @param pageId Notion page ID
	 * @param content Content to write
	 * @param options Options for writing the resource
	 * @returns Result of the write operation
	 */
	private async writePageResource(
		pageId: string,
		content: string,
		_options: ResourceWriteOptions = {},
	): Promise<ResourceWriteResult> {
		// Get the current page
		const _page = await this.client.getPage(pageId);

		// Clear existing blocks
		const existingBlocks = await this.client.getAllPageBlocks(pageId);
		for (const block of existingBlocks) {
			await this.client.deleteBlock(block.id);
		}

		// Parse markdown content and create new blocks
		// This is a simplified example - in a real implementation, you would parse markdown to Notion blocks
		const paragraphs = content.split('\n\n');
		const blocks: Partial<NotionBlock>[] = paragraphs.map((text) => ({
			type: 'paragraph',
			paragraph: {
				rich_text: [
					{
						type: 'text',
						text: {
							content: text,
						},
					},
				],
			},
		}));

		// Add blocks to the page
		await this.client.appendBlockChildren(pageId, blocks);

		// Create metadata for the result
		const metadata: ResourceMetadata = {
			uri: `notion://page/${pageId}`,
			type: 'page',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: new Date(),
		};

		return {
			metadata,
			success: true,
			uri: `notion://page/${pageId}`,
		};
	}

	/**
	 * Create a new page in a database or as a child of another page
	 * @param parentUri URI of the parent (database or page)
	 * @param title Title of the new page
	 * @param content Content for the page
	 * @returns URI of the created page
	 */
	async createPage(parentUri: string, title: string, content?: string): Promise<string> {
		try {
			// Parse the parent URI
			const parsed = this.parseNotionUri(parentUri);
			if (!parsed) {
				throw new Error(`Invalid Notion parent URI: ${parentUri}`);
			}

			// Create the page properties
			// deno-lint-ignore no-explicit-any
			const properties: Record<string, any> = {};

			// Set up parent reference
			let parent: { database_id: string } | { page_id: string };

			if (parsed.type === NotionResourceType.Database) {
				// For database parent, set the title in properties
				parent = { database_id: parsed.id };

				// Get database schema to find the title field
				const database = await this.client.getDatabase(parsed.id);
				const titleProperty = Object.entries(database.properties)
					.find(([_, prop]) => prop.type === 'title')?.[0];

				if (!titleProperty) {
					throw new Error(`Database ${parsed.id} has no title property`);
				}

				// Set the title in the right property
				properties[titleProperty] = {
					title: [this.createRichText(title)],
				};
			} else if (parsed.type === NotionResourceType.Page) {
				// For page parent, we don't need title in properties
				parent = { page_id: parsed.id };
			} else {
				throw new Error(`Cannot create a page with parent type: ${parsed.type}`);
			}

			// Prepare blocks for the content
			const blocks: Partial<NotionBlock>[] = [];

			// Add title block for page parent
			if (parsed.type === NotionResourceType.Page) {
				blocks.push({
					type: 'heading_1',
					heading_1: {
						rich_text: [this.createRichText(title)],
					},
				});
			}

			// Add content blocks if provided
			if (content) {
				// Simple content parsing - in a real implementation, you would parse markdown properly
				const paragraphs = content.split('\n\n').filter((p) => p.trim() !== '');
				for (const paragraph of paragraphs) {
					blocks.push({
						type: 'paragraph',
						paragraph: {
							rich_text: [this.createRichText(paragraph)],
						},
					});
				}
			}

			// Create the page
			const newPage = await this.client.createPage(parent, properties, blocks);

			// Return the URI of the new page
			return `notion://page/${newPage.id}`;
		} catch (error) {
			logger.error(`NotionAccessor: Error creating page: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to create Notion page: ${errorMessage(error)}`,
				{
					filePath: parentUri,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Helper method to create a rich text object
	 */
	private createRichText(content: string): RichTextItemResponse {
		return {
			type: 'text',
			text: {
				content,
			},
			plain_text: content,
		};
	}

	/**
	 * List resources in the Notion workspace
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	async listResources(options: ResourceListOptions = {}): Promise<ResourceListResult> {
		try {
			// Search for all pages and databases in the workspace
			const searchResults = await this.client.search('', undefined, {
				direction: 'descending',
				timestamp: 'last_edited_time',
			});

			// Track if we need to return a subset due to pagination
			const startIndex = options.pageToken ? parseInt(options.pageToken) : 0;
			const pageSize = options.pageSize || 100;
			const resources: ResourceMetadata[] = [];

			// Extract resources
			let index = 0;

			// Add the workspace itself as the first resource
			if (startIndex === 0) {
				resources.push({
					uri: `notion://workspace/${this.workspaceId}`,
					type: 'workspace',
					mimeType: 'text/markdown',
					contentType: 'text',
					size: 0,
					lastModified: new Date(),
				});
				index++;
			}

			// Add pages and databases
			for (const result of searchResults.results) {
				if (index < startIndex) {
					index++;
					continue;
				}

				if (resources.length >= pageSize) {
					break;
				}

				if ('properties' in result) {
					// This is a page
					const page = result as NotionPage;
					const pageTitle = page.properties?.Title?.title?.[0]?.plain_text || 'Untitled';
					resources.push({
						uri: `notion://page/${page.id}`,
						type: 'page',
						name: pageTitle,
						mimeType: 'text/markdown',
						contentType: 'text',
						size: 0, // We don't know the size until we load the page
						lastModified: (page.last_edited_time && typeof page.last_edited_time === 'object')
							? page.last_edited_time as Date
							: new Date(page.last_edited_time),
					});
				} else if ('title' in result) {
					// This is a database
					const db = result as NotionDatabase;
					resources.push({
						uri: `notion://database/${db.id}`,
						type: 'database',
						mimeType: 'text/markdown',
						contentType: 'text',
						size: 0, // We don't know the size until we load the database
						lastModified: (db.last_edited_time && typeof db.last_edited_time === 'object')
							? db.last_edited_time as Date
							: new Date(db.last_edited_time),
					});
				}

				index++;
			}

			// Determine if there are more resources to list
			const hasMore = index < searchResults.results.length + 1; // +1 for the workspace itself

			return {
				resources,
				nextPageToken: hasMore ? index.toString() : undefined,
				hasMore,
			};
		} catch (error) {
			logger.error(`NotionAccessor: Error listing resources: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to list Notion resources: ${errorMessage(error)}`,
				{
					name: 'list-resources',
					filePath: 'notion://',
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Search for resources in the Notion workspace
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	override async searchResources(query: string, options: ResourceSearchOptions = {}): Promise<ResourceSearchResult> {
		try {
			// Determine search mode
			const isContentSearch = !!options.contentPattern;
			const searchQuery = options.contentPattern || query;
			const caseSensitive = options.caseSensitive ?? false;

			// Search Notion for the query
			const searchResults = await this.client.search(searchQuery, undefined, {
				direction: 'descending',
				timestamp: 'last_edited_time',
			});

			// Filter results based on date constraints if provided
			let filteredResults = searchResults.results;
			if (options.dateAfter || options.dateBefore) {
				filteredResults = filteredResults.filter((result) => {
					const lastEditedTime = 'last_edited_time' in result ? result.last_edited_time : null;
					if (!lastEditedTime) return false;

					const editDate = typeof lastEditedTime === 'object'
						? lastEditedTime as Date
						: new Date(lastEditedTime);

					if (options.dateAfter && editDate < new Date(options.dateAfter)) return false;
					if (options.dateBefore && editDate >= new Date(options.dateBefore)) return false;

					return true;
				});
			}

			// Extract matches
			const matches: ResourceSearchResult['matches'] = [];
			for (const result of filteredResults) {
				if (matches.length >= (options.pageSize || 100)) {
					break;
				}

				let resource: ResourceMetadata;
				let contentMatches = undefined;

				if ('properties' in result) {
					// This is a page
					const page = result as NotionPage;
					resource = {
						uri: `notion://page/${page.id}`,
						type: 'page',
						mimeType: 'text/markdown',
						contentType: 'text',
						size: 0,
						lastModified: (page.last_edited_time && typeof page.last_edited_time === 'object')
							? page.last_edited_time as Date
							: new Date(page.last_edited_time),
					};

					// For content search, attempt to search within page content
					if (isContentSearch) {
						try {
							// Load page content for content search
							const pageContent = await this.loadPageResource(page.id);
							const content = pageContent.content as string;

							// Simple content matching (Note: Context extraction not implemented for Notion)
							const regex = new RegExp(searchQuery, caseSensitive ? 'g' : 'ig');
							const hasMatch = regex.test(content);

							if (hasMatch) {
								// For Notion, we indicate that context extraction is not supported
								contentMatches = [{
									lineNumber: 1,
									content: 'Content match found (context extraction not supported for Notion)',
									contextBefore: [],
									contextAfter: [],
									matchStart: 0,
									matchEnd: 0,
								}];
							} else {
								// Content doesn't match, skip this page
								continue;
							}
						} catch (error) {
							logger.warn(
								`NotionAccessor: Error loading page content for search: ${errorMessage(error)}`,
							);
							// Continue with basic match if content can't be loaded
						}
					}
				} else if ('title' in result) {
					// This is a database
					const db = result as NotionDatabase;
					resource = {
						uri: `notion://database/${db.id}`,
						type: 'database',
						mimeType: 'text/markdown',
						contentType: 'text',
						size: 0,
						lastModified: (db.last_edited_time && typeof db.last_edited_time === 'object')
							? db.last_edited_time as Date
							: new Date(db.last_edited_time),
					};

					// For databases in content search, check database title/description
					if (isContentSearch) {
						const dbTitle = this.getDatabaseTitle(db) || '';
						const regex = new RegExp(searchQuery, caseSensitive ? 'g' : 'ig');
						const hasMatch = regex.test(dbTitle);

						if (hasMatch) {
							contentMatches = [{
								lineNumber: 1,
								content: `Database title match: ${dbTitle}`,
								contextBefore: [],
								contextAfter: [],
								matchStart: 0,
								matchEnd: dbTitle.length,
							}];
						} else {
							// Title doesn't match, skip this database
							continue;
						}
					}
				} else {
					// Unknown type, skip
					continue;
				}

				// Create match object
				const match: ResourceSearchResult['matches'][0] = {
					resource,
					score: 1.0, // Notion doesn't provide scores
				};

				// Add content matches if this was a content search
				if (contentMatches) {
					match.contentMatches = contentMatches;
				}

				matches.push(match);
			}

			return {
				matches,
				totalMatches: matches.length,
				errorMessage: null,
			};
		} catch (error) {
			logger.error(`NotionAccessor: Error searching resources: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to search Notion resources: ${errorMessage(error)}`,
				{
					filePath: 'notion://',
					operation: 'search-resources',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Get metadata about the Notion workspace
	 * @returns Promise<DataSourceMetadata> Metadata about the Notion workspace
	 */
	async getMetadata(): Promise<DataSourceMetadata> {
		logger.debug('NotionAccessor: Getting metadata for Notion workspace');

		const metadata: DataSourceMetadata = {
			totalResources: 0,
			resourceTypes: {},
			lastScanned: new Date().toISOString(),
			notion: {
				totalPages: 0,
				totalDatabases: 0,
				pageTypes: {},
			},
		};

		try {
			// Get workspace information
			try {
				const botUser = await this.client.getBotUser();
				if (metadata.notion) {
					metadata.notion.workspaceInfo = {
						name: botUser.name || 'Unknown',
						id: this.workspaceId,
					};
				}
			} catch (error) {
				logger.warn(`NotionAccessor: Could not get bot user info: ${errorMessage(error)}`);
			}

			// Search for all resources to count them
			const searchResults = await this.client.search('', undefined, {
				direction: 'descending',
				timestamp: 'last_edited_time',
			});

			// Count pages and databases
			for (const result of searchResults.results) {
				if ('properties' in result) {
					// This is a page
					if (metadata.notion) {
						metadata.notion.totalPages = (metadata.notion.totalPages || 0) + 1;

						// Try to determine page type from parent
						const page = result as NotionPage;
						let pageType = 'page';
						if (page.parent?.type === 'database_id') {
							pageType = 'database-page';
						} else if (page.parent?.type === 'page_id') {
							pageType = 'child-page';
						}

						if (!metadata.notion.pageTypes) {
							metadata.notion.pageTypes = {};
						}
						metadata.notion.pageTypes[pageType] = (metadata.notion.pageTypes[pageType] || 0) + 1;
					}
				} else if ('title' in result) {
					// This is a database
					if (metadata.notion) {
						metadata.notion.totalDatabases = (metadata.notion.totalDatabases || 0) + 1;
					}
				}
			}

			// Set total resources and resource types
			metadata.totalResources = (metadata.notion?.totalPages || 0) +
				(metadata.notion?.totalDatabases || 0) + 1; // +1 for workspace

			metadata.resourceTypes = {
				workspace: 1,
				page: metadata.notion?.totalPages || 0,
				database: metadata.notion?.totalDatabases || 0,
			};

			logger.debug('NotionAccessor: Metadata collection complete', {
				totalResources: metadata.totalResources,
				resourceTypes: metadata.resourceTypes,
				totalPages: metadata.notion?.totalPages,
				totalDatabases: metadata.notion?.totalDatabases,
			});
		} catch (error) {
			logger.error(
				`NotionAccessor: Error collecting metadata: ${errorMessage(error)}`,
			);
			// Return basic metadata even if collection failed
			metadata.totalResources = 0;
			metadata.resourceTypes = { workspace: 1, page: 0, database: 0 };
		}

		return metadata;
	}

	/**
	 * Format Notion metadata for display
	 * @param metadata DataSourceMetadata to format
	 * @returns Formatted string representation
	 */
	override formatMetadata(metadata: DataSourceMetadata): string {
		const lines: string[] = [];

		if (metadata.totalResources !== undefined) {
			lines.push(`Total Resources: ${metadata.totalResources}`);
		}

		if (metadata.resourceTypes && Object.keys(metadata.resourceTypes).length > 0) {
			lines.push(`Resource Types:`);
			for (const [type, count] of Object.entries(metadata.resourceTypes)) {
				lines.push(`  ${type}: ${count}`);
			}
		}

		if (metadata.notion) {
			lines.push(`Notion Details:`);
			const notion = metadata.notion;

			if (notion.workspaceInfo) {
				lines.push(`  Workspace: ${notion.workspaceInfo.name || notion.workspaceInfo.id || 'Unknown'}`);
				lines.push(`  Workspace ID: ${notion.workspaceInfo.id || 'Unknown'}`);
			}

			if (notion.totalPages !== undefined) {
				lines.push(`  Total Pages: ${notion.totalPages}`);
			}

			if (notion.totalDatabases !== undefined) {
				lines.push(`  Total Databases: ${notion.totalDatabases}`);
			}

			if (notion.pageTypes && Object.keys(notion.pageTypes).length > 0) {
				lines.push(`  Page Types:`);
				for (const [type, count] of Object.entries(notion.pageTypes)) {
					lines.push(`    ${type}: ${count}`);
				}
			}
		}

		if (metadata.lastScanned) {
			lines.push(`Last Scanned: ${new Date(metadata.lastScanned).toLocaleString()}`);
		}

		return lines.join('\n');
	}

	/**
	 * Get a Notion page as Portable Text blocks
	 * @param resourceUri URI of the page resource
	 * @returns Array of Portable Text blocks
	 */
	async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
		try {
			// Parse the resource URI to get the page ID
			const parsed = this.parseNotionUri(resourceUri);
			if (!parsed || parsed.type !== NotionResourceType.Page) {
				throw new Error(`Invalid or unsupported resource URI for Portable Text: ${resourceUri}`);
			}

			// Get the page and its blocks using existing methods
			const _page = await this.client.getPage(parsed.id);
			const blocks = await this.client.getAllPageBlocks(parsed.id);

			logger.debug(`NotionAccessor: Retrieved ${blocks.length} blocks for page ${parsed.id}`);

			// Convert blocks to Portable Text
			const portableTextBlocks = convertNotionToPortableText(blocks);

			logger.info(
				`NotionAccessor: Converted ${blocks.length} Notion blocks to ${portableTextBlocks.length} Portable Text blocks for page ${parsed.id}`,
			);

			return portableTextBlocks;
		} catch (error) {
			logger.error(`NotionAccessor: Error getting document as Portable Text: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to get Notion page as Portable Text: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Apply Portable Text operations to a Notion page
	 * @param resourceUri URI of the page resource
	 * @param operations Array of operations to apply
	 * @returns Array of operation results
	 */
	async applyPortableTextOperations(
		resourceUri: string,
		operations: PortableTextOperation[],
	): Promise<PortableTextOperationResult[]> {
		try {
			// Parse the resource URI to get the page ID
			const parsed = this.parseNotionUri(resourceUri);
			if (!parsed || parsed.type !== NotionResourceType.Page) {
				throw new Error(`Invalid or unsupported resource URI for Portable Text operations: ${resourceUri}`);
			}

			logger.info(`NotionAccessor: Applying ${operations.length} Portable Text operations to page ${parsed.id}`);

			// Get current Portable Text representation
			const currentBlocks = await this.getDocumentAsPortableText(resourceUri);
			logger.debug(`NotionAccessor: Current document has ${currentBlocks.length} blocks`);

			// Apply operations to the Portable Text using the utility
			const { modifiedBlocks, operationResults } = applyOperationsToPortableText(
				currentBlocks,
				operations,
			);

			// Check if any operations succeeded
			const successfulOperations = operationResults.filter((result) => result.success);
			if (successfulOperations.length === 0) {
				logger.warn(`NotionAccessor: No operations succeeded for page ${parsed.id}`);
				return operationResults;
			}

			logger.info(
				`NotionAccessor: ${successfulOperations.length} operations succeeded, updating page ${parsed.id}`,
			);

			// Convert back to Notion format
			const notionBlocks = convertPortableTextToNotion(modifiedBlocks);
			logger.debug(`NotionAccessor: Converted to ${notionBlocks.length} Notion blocks`);

			// Update the page with new blocks
			await this.updatePageBlocks(parsed.id, notionBlocks);

			logger.info(`NotionAccessor: Successfully updated page ${parsed.id} with new blocks`);

			return operationResults;
		} catch (error) {
			logger.error(`NotionAccessor: Error applying Portable Text operations: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to apply Portable Text operations: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Update page blocks by replacing all content
	 * @param pageId Notion page ID
	 * @param newBlocks New blocks to set
	 */
	private async updatePageBlocks(pageId: string, newBlocks: Partial<NotionBlock>[]): Promise<void> {
		try {
			// Clear existing blocks
			const existingBlocks = await this.client.getAllPageBlocks(pageId);
			for (const block of existingBlocks) {
				try {
					await this.client.deleteBlock(block.id);
				} catch (error) {
					logger.warn(`NotionAccessor: Failed to delete block ${block.id}: ${errorMessage(error)}`);
					// Continue with other blocks even if one fails
				}
			}

			// Add new blocks
			if (newBlocks.length > 0) {
				await this.client.appendBlockChildren(pageId, newBlocks);
			}

			logger.info(`NotionAccessor: Updated page ${pageId} with ${newBlocks.length} new blocks`);
		} catch (error) {
			logger.error(`NotionAccessor: Error updating page blocks: ${errorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Check if this accessor has a specific capability
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// Notion currently supports read, list, search, write, and blockEdit (for Portable Text operations)
		return ['blockRead', 'blockEdit', 'list', 'search', 'delete'].includes(capability);
	}

	/**
	 * Helper method to get a page title
	 * @param page Notion page
	 * @returns Page title or null if not available
	 */
	private getPageTitle(page: NotionPage): string | null {
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
	 * Helper method to get a database title
	 * @param database Notion database
	 * @returns Database title or null if not available
	 */
	private getDatabaseTitle(database: NotionDatabase): string | null {
		if (database.title && Array.isArray(database.title)) {
			return database.title.map((t) => t.plain_text).join('');
		}

		return null;
	}
}
