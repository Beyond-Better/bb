/**
 * GoogleDocsAccessor implementation for accessing Google Docs and Drive resources.
 */
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import { BBResourceAccessor } from '../base/bbResourceAccessor.ts';
import type {
	GoogleDocsBatchUpdateRequest,
	//GoogleDocument,
	GoogleDriveFile,
	//GoogleDriveFilesList,
	//GoogleParagraph,
	//GoogleStructuralElement,
	//GoogleTextRun,
} from './googledocs.types.ts';
import type {
	GoogleDocsClient,
} from './googledocsClient.ts';
import {
	convertGoogleDocsToPortableText,
	//convertPortableTextToGoogleDocs,
	//validatePortableTextForGoogleDocs,
} from './portableTextConverter.ts';
import {
	googledocsToMarkdown,
	//type GoogleDocsToMarkdownOptions,
} from './googledocsToMarkdown.ts';
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
import type {
	PortableTextBlock,
	PortableTextOperation,
	PortableTextOperationResult,
	//PortableTextSpan,
} from 'api/types/portableText.ts';
import { applyOperationsToPortableText } from 'api/utils/portableTextMutator.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import type { DataSourceCapability, DataSourceMetadata } from 'shared/types/dataSource.ts';

/**
 * Resource types supported by Google Docs
 */
enum GoogleDocsResourceType {
	Document = 'document',
	Folder = 'folder',
	Search = 'search',
	Drive = 'drive',
}

/**
 * GoogleDocsAccessor for accessing Google Docs and Drive resources
 * Implements resource operations for Google Docs data sources
 */
export class GoogleDocsAccessor extends BBResourceAccessor {
	/**
	 * Google Docs API client
	 */
	private client: GoogleDocsClient;

	/**
	 * Optional folder ID restriction from connection config
	 */
	private folderId?: string;

	/**
	 * Optional drive ID restriction from connection config
	 */
	private driveId?: string;

	/**
	 * Create a new GoogleDocsAccessor
	 * @param connection The data source connection to use
	 * @param client The Google Docs API client
	 */
	constructor(connection: DataSourceConnection, client: GoogleDocsClient) {
		super(connection);

		this.client = client;

		// Extract optional folder/drive restrictions from connection config
		this.folderId = connection.config.folderId as string | undefined;
		this.driveId = connection.config.driveId as string | undefined;

		logger.debug(`GoogleDocsAccessor: Created for ${connection.id}`, {
			folderId: this.folderId,
			driveId: this.driveId,
		});
	}

	/**
	 * Parse a Google Docs resource URI to extract components
	 * @param resourceUri The URI to parse
	 * @returns Parsed components or null if invalid
	 */
	private parseGoogleDocsUri(resourceUri: string): { type: GoogleDocsResourceType; id: string } | null {
		const resourcePath = extractResourcePath(resourceUri);
		if (!resourcePath) {
			return null;
		}

		// Parse the resource path
		// Expected format: "<type>/<id>"
		// Examples: "document/123abc", "folder/456def", "search/my%20query"
		const parts = resourcePath.split('/');
		if (parts.length !== 2) {
			return null;
		}

		const [type, id] = parts;
		if (!id) {
			return null;
		}

		// Validate resource type
		switch (type) {
			case GoogleDocsResourceType.Document:
			case GoogleDocsResourceType.Folder:
			case GoogleDocsResourceType.Search:
			case GoogleDocsResourceType.Drive:
				return { type: type as GoogleDocsResourceType, id };
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
		// For Google Docs, we consider all resources within the data source
		// if they pass basic URI validation and access controls
		const parsed = this.parseGoogleDocsUri(_resourceUri);
		return parsed !== null;
	}

	/**
	 * Check if resource exists in this data source
	 * @param resourceUri The resource URI to check
	 * @param options Optional object with additional checks
	 * @returns boolean
	 */
	async resourceExists(resourceUri: string, _options?: { isFile?: boolean }): Promise<boolean> {
		const parsed = this.parseGoogleDocsUri(resourceUri);
		if (!parsed) return false;

		try {
			switch (parsed.type) {
				case GoogleDocsResourceType.Document: {
					// Try to get document metadata
					await this.client.getDriveFileMetadata(parsed.id);
					return true;
				}
				case GoogleDocsResourceType.Folder: {
					// Try to get folder metadata
					const file = await this.client.getDriveFileMetadata(parsed.id);
					return file.mimeType === 'application/vnd.google-apps.folder';
				}
				case GoogleDocsResourceType.Search: {
					// Search resources always "exist" if they're valid queries
					return decodeURIComponent(parsed.id).trim().length > 0;
				}
				case GoogleDocsResourceType.Drive: {
					// Drive resource exists if we can list files
					await this.client.listDocuments('', this.folderId, 1);
					return true;
				}
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
		// Not applicable for Google Docs resources
		return;
	}

	/**
	 * Load a resource from Google Docs
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	async loadResource(resourceUri: string, options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		try {
			// Parse the resource URI
			const parsed = this.parseGoogleDocsUri(resourceUri);
			logger.error(`GoogleDocsAccessor: loading resource ${resourceUri}: ${parsed}`);
			if (!parsed) {
				throw new Error(`Invalid Google Docs resource URI: ${resourceUri}`);
			}

			// Handle different resource types
			switch (parsed.type) {
				case GoogleDocsResourceType.Document:
					return await this.loadDocumentResource(parsed.id, options);

				case GoogleDocsResourceType.Folder:
					return await this.loadFolderResource(parsed.id, options);

				case GoogleDocsResourceType.Search:
					return await this.loadSearchResource(decodeURIComponent(parsed.id), options);

				case GoogleDocsResourceType.Drive:
					return await this.loadDriveResource(options);

				default:
					throw new Error(`Unsupported Google Docs resource type: ${parsed.type}`);
			}
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error loading resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to load Google Docs resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Load a Google Docs document resource
	 * @param documentId Google Docs document ID
	 * @param options Loading options
	 * @returns The loaded document with its content and metadata
	 */
	private async loadDocumentResource(
		documentId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Get the document
		const document = await this.client.getDocument(documentId);

		// Convert to markdown using the new utility
		const content = googledocsToMarkdown(document, {
			includeTitle: true,
			includeMetadata: true,
			renderTables: true,
			preservePageBreaks: true,
		});

		// Get additional metadata from Drive API
		let driveMetadata: GoogleDriveFile | undefined;
		try {
			driveMetadata = await this.client.getDriveFileMetadata(documentId);
		} catch (error) {
			logger.warn(
				`GoogleDocsAccessor: Could not get Drive metadata for document ${documentId}: ${errorMessage(error)}`,
			);
		}

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `googledocs://document/${documentId}`,
			type: 'file',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: driveMetadata?.modifiedTime ? new Date(driveMetadata.modifiedTime) : new Date(),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a Google Drive folder resource
	 * @param folderId Google Drive folder ID
	 * @param options Loading options
	 * @returns The loaded folder with its content and metadata
	 */
	private async loadFolderResource(
		folderId: string,
		_options: ResourceLoadOptions = {},
	): Promise<ResourceLoadResult> {
		// Get folder metadata
		const folder = await this.client.getDriveFileMetadata(folderId);

		// List documents in the folder
		const documents = await this.client.listDocuments('', folderId);

		// Build a markdown representation of the folder
		const parts: string[] = [];

		// Add title and metadata
		parts.push(`# ${folder.name || 'Untitled Folder'}\n`);
		parts.push(`> Folder ID: ${folder.id}  `);
		parts.push(
			`> Last modified: ${folder.modifiedTime ? new Date(folder.modifiedTime).toLocaleString() : 'Unknown'}  `,
		);
		if (folder.webViewLink) {
			parts.push(`> URL: ${folder.webViewLink}\n`);
		}

		// Add documents list
		parts.push(`## Documents (${documents.files.length})\n`);
		for (const doc of documents.files) {
			parts.push(
				`- [${doc.name}](googledocs://document/${doc.id}) - Modified: ${
					doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleDateString() : 'Unknown'
				}`,
			);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `googledocs://folder/${folderId}`,
			type: 'directory',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: folder.modifiedTime ? new Date(folder.modifiedTime) : new Date(),
		};

		return {
			content,
			metadata,
		};
	}

	/**
	 * Load a search query resource
	 * @param query Search query
	 * @param options Loading options
	 * @returns The search results with metadata
	 */
	private async loadSearchResource(query: string, _options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		// Perform the search
		const results = await this.client.listDocuments(query, this.folderId);

		// Build a markdown representation of the search results
		const parts: string[] = [];

		// Add title and metadata
		parts.push(`# Search Results: "${query}"\n`);
		parts.push(`> Query: ${query}  `);
		parts.push(`> Results found: ${results.files.length}  `);
		parts.push(`> Search date: ${new Date().toLocaleString()}\n`);

		// Add results list
		if (results.files.length > 0) {
			parts.push(`## Documents\n`);
			for (const doc of results.files) {
				parts.push(
					`- [${doc.name}](googledocs://document/${doc.id}) - Modified: ${
						doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleDateString() : 'Unknown'
					}`,
				);
			}
		} else {
			parts.push(`No documents found matching "${query}".`);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `googledocs://search/${encodeURIComponent(query)}`,
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
	 * Load the drive resource (list all accessible documents)
	 * @param options Loading options
	 * @returns The drive overview with metadata
	 */
	private async loadDriveResource(_options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		// List all documents
		const results = await this.client.listDocuments('', this.folderId);

		// Build a markdown representation of the drive
		const parts: string[] = [];

		// Add title and metadata
		parts.push(`# Google Drive: ${this.connection.name}\n`);
		if (this.folderId) {
			parts.push(`> Restricted to folder: ${this.folderId}  `);
		}
		if (this.driveId) {
			parts.push(`> Restricted to drive: ${this.driveId}  `);
		}
		parts.push(`> Last updated: ${new Date().toLocaleString()}  `);
		parts.push(`> Total documents: ${results.files.length}\n`);

		// Add documents list
		parts.push(`## Documents\n`);
		for (const doc of results.files) {
			parts.push(
				`- [${doc.name}](googledocs://document/${doc.id}) - Modified: ${
					doc.modifiedTime ? new Date(doc.modifiedTime).toLocaleDateString() : 'Unknown'
				}`,
			);
		}

		const content = parts.join('\n');

		// Create metadata
		const metadata: ResourceMetadata = {
			uri: `googledocs://drive/overview`,
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
	 * Write a resource to Google Docs (create or update)
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
			const parsed = this.parseGoogleDocsUri(resourceUri);
			if (!parsed) {
				throw new Error(`Invalid Google Docs resource URI: ${resourceUri}`);
			}

			// Currently only support updating document content
			switch (parsed.type) {
				case GoogleDocsResourceType.Document:
					return await this.writeDocumentResource(parsed.id, content, options);
				default:
					throw new Error(`Writing to ${parsed.type} resources is not supported`);
			}
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error writing resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to write Google Docs resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Write content to a Google Docs document
	 * @param documentId Google Docs document ID
	 * @param content Content to write (simplified - replace all content)
	 * @param options Options for writing the resource
	 * @returns Result of the write operation
	 */
	private async writeDocumentResource(
		documentId: string,
		content: string,
		_options: ResourceWriteOptions = {},
	): Promise<ResourceWriteResult> {
		// Get current document to find content range
		const document = await this.client.getDocument(documentId);

		// Simple approach: replace all text content
		const requests: GoogleDocsBatchUpdateRequest[] = [];

		// Find the range of all text content (excluding the final newline)
		if (document.body.content && document.body.content.length > 1) {
			const endIndex = document.body.content[document.body.content.length - 1].endIndex - 1;
			if (endIndex > 1) {
				requests.push({
					deleteContentRange: {
						range: {
							startIndex: 1,
							endIndex: endIndex,
						},
					},
				});
			}
		}

		// Insert new content
		requests.push({
			insertText: {
				location: { index: 1 },
				text: content,
			},
		});

		// Apply the changes
		await this.client.updateDocument(documentId, requests);

		// Create metadata for the result
		const metadata: ResourceMetadata = {
			uri: `googledocs://document/${documentId}`,
			type: 'file',
			mimeType: 'text/markdown',
			contentType: 'text',
			size: content.length,
			lastModified: new Date(),
		};

		return {
			metadata,
			success: true,
			uri: `googledocs://document/${documentId}`,
		};
	}

	/**
	 * List resources in the Google Drive/Docs
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	async listResources(options: ResourceListOptions = {}): Promise<ResourceListResult> {
		try {
			// Get list of documents from Google Drive
			const pageSize = Math.min(options.pageSize || 50, 100);
			const documents = await this.client.listDocuments('', this.folderId, pageSize, options.pageToken);

			const resources: ResourceMetadata[] = [];

			// Add drive overview as first resource if this is the first page
			if (!options.pageToken) {
				resources.push({
					uri: `googledocs://drive/overview`,
					type: 'api',
					name: 'Drive Overview',
					mimeType: 'text/markdown',
					contentType: 'text',
					size: 0,
					lastModified: new Date(),
				});
			}

			// Add documents
			for (const doc of documents.files) {
				resources.push({
					uri: `googledocs://document/${doc.id}`,
					type: 'file',
					name: doc.name,
					mimeType: 'text/markdown',
					contentType: 'text',
					size: 0, // We don't know the size until we load the document
					lastModified: doc.modifiedTime ? new Date(doc.modifiedTime) : new Date(),
				});
			}

			return {
				resources,
				nextPageToken: documents.nextPageToken,
				hasMore: !!documents.nextPageToken,
			};
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error listing resources: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to list Google Docs resources: ${errorMessage(error)}`,
				{
					name: 'list-resources',
					filePath: 'googledocs://',
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Search for resources in Google Drive/Docs
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	override async searchResources(query: string, options: ResourceSearchOptions = {}): Promise<ResourceSearchResult> {
		try {
			// Use the content pattern or the query for searching
			const searchQuery = options.contentPattern || query;

			// Search Google Drive for documents
			const results = await this.client.listDocuments(searchQuery, this.folderId, options.pageSize || 50);

			// Filter results based on date constraints if provided
			let filteredFiles: GoogleDriveFile[] = results.files;
			if (options.dateAfter || options.dateBefore) {
				filteredFiles = filteredFiles.filter((file: GoogleDriveFile) => {
					if (!file.modifiedTime) return false;

					const modifiedDate = new Date(file.modifiedTime);

					if (options.dateAfter && modifiedDate < new Date(options.dateAfter)) return false;
					if (options.dateBefore && modifiedDate >= new Date(options.dateBefore)) return false;

					return true;
				});
			}

			// Convert to search matches
			const matches: ResourceSearchResult['matches'] = [];
			for (const file of filteredFiles) {
				const resource: ResourceMetadata = {
					uri: `googledocs://document/${file.id}`,
					type: 'file',
					name: file.name,
					mimeType: 'text/markdown',
					contentType: 'text',
					size: 0,
					lastModified: file.modifiedTime ? new Date(file.modifiedTime) : new Date(),
				};

				// Create match object
				const match: ResourceSearchResult['matches'][0] = {
					resource,
					score: 1.0, // Google Drive doesn't provide relevance scores
				};

				// For content search, we indicate that detailed context extraction
				// is not supported for Google Docs API (would require loading each document)
				if (options.contentPattern) {
					match.contentMatches = [{
						lineNumber: 1,
						content: 'Content match found (detailed context extraction not supported for Google Docs)',
						contextBefore: [],
						contextAfter: [],
						matchStart: 0,
						matchEnd: 0,
					}];
				}

				matches.push(match);
			}

			return {
				matches,
				totalMatches: matches.length,
				errorMessage: null,
			};
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error searching resources: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to search Google Docs resources: ${errorMessage(error)}`,
				{
					filePath: 'googledocs://',
					operation: 'search-resources',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Get metadata about the Google Drive/Docs workspace
	 * @returns Promise<DataSourceMetadata> Metadata about the workspace
	 */
	async getMetadata(): Promise<DataSourceMetadata> {
		logger.debug('GoogleDocsAccessor: Getting metadata for Google Drive/Docs');

		const metadata: DataSourceMetadata = {
			totalResources: 0,
			resourceTypes: {},
			lastScanned: new Date().toISOString(),
			googledocs: {
				totalDocuments: 0,
				folderId: this.folderId,
				driveId: this.driveId,
			},
		};

		try {
			// Get list of all documents to count them
			const results = await this.client.listDocuments('', this.folderId, 1000); // Get up to 1000 docs for counting

			metadata.googledocs!.totalDocuments = results.files.length;
			metadata.totalResources = results.files.length + 1; // +1 for drive overview

			metadata.resourceTypes = {
				api: 1, // Drive overview
				file: results.files.length,
			};

			logger.debug('GoogleDocsAccessor: Metadata collection complete', {
				totalResources: metadata.totalResources,
				resourceTypes: metadata.resourceTypes,
				totalDocuments: metadata.googledocs?.totalDocuments,
			});
		} catch (error) {
			logger.error(
				`GoogleDocsAccessor: Error collecting metadata: ${errorMessage(error)}`,
			);
			// Return basic metadata even if collection failed
			metadata.totalResources = 1; // Just the drive overview
			metadata.resourceTypes = { api: 1, file: 0 };
		}

		return metadata;
	}

	/**
	 * Format Google Docs metadata for display
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

		if (metadata.googledocs) {
			lines.push(`Google Docs Details:`);
			const googledocs = metadata.googledocs;

			if (googledocs.totalDocuments !== undefined) {
				lines.push(`  Total Documents: ${googledocs.totalDocuments}`);
			}

			if (googledocs.folderId) {
				lines.push(`  Restricted to Folder: ${googledocs.folderId}`);
			}

			if (googledocs.driveId) {
				lines.push(`  Restricted to Drive: ${googledocs.driveId}`);
			}
		}

		if (metadata.lastScanned) {
			lines.push(`Last Scanned: ${new Date(metadata.lastScanned).toLocaleString()}`);
		}

		return lines.join('\n');
	}

	/**
	 * Get a Google Docs document as Portable Text blocks
	 * @param resourceUri URI of the document resource
	 * @returns Array of Portable Text blocks
	 */
	async getDocumentAsPortableText(resourceUri: string): Promise<PortableTextBlock[]> {
		try {
			// Parse the resource URI to get the document ID
			const parsed = this.parseGoogleDocsUri(resourceUri);
			if (!parsed || parsed.type !== GoogleDocsResourceType.Document) {
				throw new Error(`Invalid or unsupported resource URI for Portable Text: ${resourceUri}`);
			}

			// Get the document
			const document = await this.client.getDocument(parsed.id);

			logger.debug(`GoogleDocsAccessor: Retrieved document ${parsed.id} for Portable Text conversion`);

			// Convert Google Docs structure to Portable Text
			const portableTextBlocks = convertGoogleDocsToPortableText(document);

			logger.info(
				`GoogleDocsAccessor: Converted Google Docs document to ${portableTextBlocks.length} Portable Text blocks for document ${parsed.id}`,
			);

			return portableTextBlocks;
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error getting document as Portable Text: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to get Google Docs document as Portable Text: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Apply Portable Text operations to a Google Docs document
	 * @param resourceUri URI of the document resource
	 * @param operations Array of operations to apply
	 * @returns Array of operation results
	 */
	async applyPortableTextOperations(
		resourceUri: string,
		operations: PortableTextOperation[],
	): Promise<PortableTextOperationResult[]> {
		try {
			// Parse the resource URI to get the document ID
			const parsed = this.parseGoogleDocsUri(resourceUri);
			if (!parsed || parsed.type !== GoogleDocsResourceType.Document) {
				throw new Error(`Invalid or unsupported resource URI for Portable Text operations: ${resourceUri}`);
			}

			logger.info(
				`GoogleDocsAccessor: Applying ${operations.length} Portable Text operations to document ${parsed.id}`,
			);

			// Get current Portable Text representation
			const currentBlocks = await this.getDocumentAsPortableText(resourceUri);
			logger.debug(`GoogleDocsAccessor: Current document has ${currentBlocks.length} blocks`);

			// Apply operations to the Portable Text using the utility
			const { modifiedBlocks, operationResults } = applyOperationsToPortableText(
				currentBlocks,
				operations,
			);

			// Check if any operations succeeded
			const successfulOperations = operationResults.filter((result) => result.success);
			if (successfulOperations.length === 0) {
				logger.warn(`GoogleDocsAccessor: No operations succeeded for document ${parsed.id}`);
				return operationResults;
			}

			logger.info(
				`GoogleDocsAccessor: ${successfulOperations.length} operations succeeded, updating document ${parsed.id}`,
			);

			// Convert back to Google Docs format and update the document
			await this.updateDocumentFromPortableText(parsed.id, modifiedBlocks);

			logger.info(`GoogleDocsAccessor: Successfully updated document ${parsed.id} with new content`);

			return operationResults;
		} catch (error) {
			logger.error(`GoogleDocsAccessor: Error applying Portable Text operations: ${errorMessage(error)}`);
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
	 * Update a Google Docs document from Portable Text blocks
	 * @param documentId Document ID
	 * @param blocks Portable Text blocks
	 */
	private async updateDocumentFromPortableText(documentId: string, blocks: PortableTextBlock[]): Promise<void> {
		// Simple implementation: convert blocks to plain text and replace document content
		const textParts: string[] = [];

		for (const block of blocks) {
			if (block._type === 'block' && block.children) {
				const blockText = block.children
					.map((child) => child._type === 'span' ? child.text : '')
					.join('');

				// Add appropriate prefixes for headings
				switch (block.style) {
					case 'h1':
						textParts.push(`# ${blockText}`);
						break;
					case 'h2':
						textParts.push(`## ${blockText}`);
						break;
					case 'h3':
						textParts.push(`### ${blockText}`);
						break;
					default:
						textParts.push(blockText.trim());
				}
			}
		}

		const content = textParts.join('\n\n');

		// Use the existing writeDocumentResource method
		await this.writeDocumentResource(documentId, content);
	}

	/**
	 * Check if this accessor has a specific capability
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// Google Docs supports read, write, list, search, delete, and blockEdit (for Portable Text operations)
		return ['blockRead', 'blockEdit', 'list', 'search', 'delete'].includes(capability);
	}
}
