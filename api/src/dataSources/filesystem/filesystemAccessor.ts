/**
 * FilesystemAccessor implementation for accessing filesystem resources.
 */
import { basename, dirname, join, relative } from '@std/path';
import { globToRegExp } from '@std/path';
import {
	ensureDir,
	exists,
	//expandGlob,
	walk,
} from '@std/fs';
import type { WalkOptions } from '@std/fs';
import type {
	ResourceSuggestion,
	ResourceSuggestionsOptions,
	ResourceSuggestionsResponse,
} from '../../utils/resourceSuggestions.utils.ts';

import { logger } from 'shared/logger.ts';
import { BBResourceAccessor } from '../base/bbResourceAccessor.ts';
import {
	extractResourcePath,
	//parsePreservingRelative
} from 'shared/dataSource.ts';
import {
	//absolutePathToResource,
	applySearchAndReplaceToContent,
	createExcludeRegexPatterns,
	ensureParentDirectories,
	getExcludeOptions,
	getFileMetadata,
	isPathWithinDataSource,
	resourcePathToAbsolute,
	safeExists,
	searchFilesContent,
	searchFilesMetadata,
} from 'api/utils/fileHandling.ts';
import { errorMessage } from 'shared/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isResourceHandlingError } from 'api/errors/error.ts';
import type { ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type {
	DataSourceInfo,
	EditType,
	FindResourceParams,
	FindResourceResult,
	Match,
	OperationResult,
	PaginationInfo,
	PaginationResult,
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceEditOperation,
	ResourceEditResult,
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
	ResourceMatch,
	ResourceMetadata,
	ResourceMoveOptions,
	ResourceMoveResult,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
	ResultLevel,
	SearchCriteria,
	SearchReplaceContentResult,
	SearchReplaceOperation,
	TextMatch,
} from 'shared/types/dataSourceResource.ts';
import type { DataSourceCapability, DataSourceMetadata } from 'shared/types/dataSource.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';
import type { TabularSheet } from 'api/types/tabular.ts';

/**
 * FilesystemAccessor for accessing filesystem resources
 * Implements all core resource operations for filesystem data sources
 */
export class FilesystemAccessor extends BBResourceAccessor {
	/**
	 * Root path of the filesystem data source
	 */
	private rootPath: string;

	public followSymlinks: boolean;
	public strictRoot: boolean;

	/**
	 * Create a new FilesystemAccessor
	 * @param connection The data source connection to use
	 */
	constructor(connection: DataSourceConnection) {
		super(connection);

		//logger.info(`FilesystemAccessor: constructor `, { config: connection.config });
		// Extract and validate the root path from the connection config
		const rootPath = connection.config.dataSourceRoot as string;
		if (!rootPath || typeof rootPath !== 'string') {
			throw new Error(`Invalid dataSourceRoot in connection ${connection.id}: ${rootPath}`);
		}
		this.rootPath = rootPath;

		const followSymlinks = (connection.config.followSymlinks ?? true) as boolean;
		this.followSymlinks = followSymlinks;

		const strictRoot = (connection.config.strictRoot ?? true) as boolean;
		this.strictRoot = strictRoot;

		logger.debug(`FilesystemAccessor: Created for ${connection.id} with root ${this.rootPath}`);
	}

	/**
	 * Check if resource exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 * @returns boolean
	 */
	async isResourceWithinDataSource(resourceUri: string): Promise<boolean> {
		const resourcePath = extractResourcePath(resourceUri) || '.';
		logger.info(
			`FilesystemAccessor: isResourceWithinDataSource - checking root ${this.rootPath} contains ${resourcePath}`,
		);
		if (!resourcePath) return false;
		return await isPathWithinDataSource(this.rootPath, resourcePath);
	}

	/**
	 * Check if resource exists in this data source
	 * @param resourceUri The resource URI to check
	 * @param options Optional object with additional checks
	 * @returns boolean
	 */
	async resourceExists(resourceUri: string, options?: { isFile?: boolean }): Promise<boolean> {
		const resourcePath = extractResourcePath(resourceUri);
		if (!resourcePath) return false;
		const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);

		const resourceExists = await exists(absolutePath);
		if (!resourceExists) return false;

		if (options?.isFile) {
			try {
				const stat = await Deno.stat(absolutePath);
				return !!stat.isFile;
			} catch (error) {
				if (!(error instanceof Deno.errors.NotFound)) {
					throw error;
				}
				return false;
			}
		}

		return true;
	}

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	async ensureResourcePathExists(resourceUri: string): Promise<void> {
		const resourcePath = extractResourcePath(resourceUri);
		if (!resourcePath) throw new Error('Could not extract path from Resource URI');
		const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);
		await ensureDir(dirname(absolutePath));
	}

	/**
	 * Load a resource from the filesystem
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	async loadResource(resourceUri: string, options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			//const resourcePath = parsePreservingRelative(resourceUri).pathname;
			//logger.info(`FilesystemAccessor: Load resource for path: ${resourcePath} from URI: ${resourceUri}`);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Convert to absolute path
			const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);
			//logger.info(`FilesystemAccessor: Load resource for absolute path: ${absolutePath}`);

			// Check if the file exists
			if (!await safeExists(absolutePath)) {
				throw createError(
					ErrorType.ResourceNotFound,
					`File not found: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'read',
					} as ResourceHandlingErrorOptions,
				);
			}

			const resourceMetadata = await getFileMetadata(
				this.rootPath,
				resourcePath,
			);
			//logger.info(`FilesystemAccessor: Load resource metadata: ${resourceUri}`, {resourceMetadata});

			// Read content based on file type and options
			let content: string | Uint8Array;
			let isPartial = false;

			if (resourceMetadata.isDirectory) {
				// For directories, return empty content or list of files
				content = '';
			} else {
				// For files, determine if we should read as text or binary
				const isBinaryMime = resourceMetadata.mimeType.startsWith('image/') ||
					resourceMetadata.mimeType.startsWith('audio/') ||
					resourceMetadata.mimeType.startsWith('video/') ||
					resourceMetadata.mimeType.startsWith('application/pdf') ||
					resourceMetadata.mimeType.startsWith('application/octet-stream');

				// Handle range request if specified
				if (options.range) {
					const { start, end } = options.range;
					const size = resourceMetadata.size || 0;
					const file = await Deno.open(absolutePath, { read: true });
					try {
						// Set position to start
						await file.seek(start, Deno.SeekMode.Start);

						// Determine how many bytes to read
						const bytesToRead = end !== undefined ? end - start : size - start;

						// Read the range
						const buffer = new Uint8Array(bytesToRead);
						const bytesRead = await file.read(buffer);

						if (bytesRead === null || bytesRead < bytesToRead) {
							// We got less data than expected, trim the buffer
							content = buffer.subarray(0, bytesRead || 0);
						} else {
							content = buffer;
						}

						isPartial = true;
					} finally {
						file.close();
					}
				} else {
					// Read the entire file
					if (isBinaryMime) {
						content = await Deno.readFile(absolutePath);
					} else {
						// For text files, honor encoding option if specified
						//const encoding = options.encoding || 'utf-8';
						content = await Deno.readTextFile(absolutePath);
					}
				}
			}
			//logger.info(`FilesystemAccessor: Loaded resource for path: ${resourcePath} from URI: ${resourceUri}`, {content});

			return {
				content,
				metadata: resourceMetadata,
				isPartial,
			};
		} catch (error) {
			logger.error(`FilesystemAccessor: Error loading resource ${resourceUri}`, errorMessage(error));
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to load resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * List available resources in the filesystem
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	async listResources(options: ResourceListOptions = {}): Promise<ResourceListResult> {
		const {
			path = '',
			depth = 1,
			pageSize = Number.POSITIVE_INFINITY,
			pageToken,
		} = options || {};

		try {
			// Get exclude patterns similar to how generateFileListingTier does it
			const excludeOptions = await getExcludeOptions(this.rootPath);
			const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, this.rootPath);
			//logger.warn(`FilesystemAccessor: Exclude Regex:`, { excludeOptionsRegex });

			// Determine the base directory to search in
			const baseDir = path ? resourcePathToAbsolute(this.rootPath, path) : this.rootPath;

			// Check if the path exists
			if (!await safeExists(baseDir)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Directory not found: ${path}`,
					{
						name: 'list-resources',
						filePath: path,
						operation: 'read',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Get file info to confirm it's a directory
			const baseDirInfo = await Deno.stat(baseDir);
			if (!baseDirInfo.isDirectory) {
				throw createError(
					ErrorType.ResourceHandling,
					`Path is not a directory: ${path}`,
					{
						name: 'list-resources',
						filePath: path,
						operation: 'read',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Configure walk options
			const walkOptions: WalkOptions = {
				maxDepth: depth,
				includeDirs: true, // Include directories as well as files
				includeSymlinks: false,
				skip: excludeOptionsRegex,
			};

			const resources: ResourceMetadata[] = [];
			let currentIndex = 0;
			const startIndex = pageToken ? parseInt(pageToken, 10) : 0;

			// Walk the file system
			for await (const entry of walk(baseDir, walkOptions)) {
				// Skip entries until we reach our pagination starting point
				if (currentIndex < startIndex) {
					currentIndex++;
					continue;
				}

				// Stop if we've reached the page size pageSize
				if (resources.length >= pageSize) {
					break;
				}

				// Get relative path from the data source root
				const relativePath = relative(this.rootPath, entry.path);
				//logger.warn(`FilesystemAccessor: relativePath:`, { relativePath });

				// Don't list the root path
				//if (relativePath === '') {
				//	continue;
				//}

				// Gather metadata for the resource
				try {
					const resourceMetadata = await getFileMetadata(
						this.rootPath,
						relativePath,
					);

					// Build the resource item
					const resource: ResourceMetadata = {
						...resourceMetadata,
						name: resourceMetadata.name || entry.name,
						//uriTerm: relativePath, set in getFileMetadata
						extraType: resourceMetadata.isDirectory ? 'directory' : 'file',
						description: resourceMetadata.isDirectory ? 'Directory' : 'File',
					};

					resources.push(resource);
				} catch (error) {
					logger.warn(
						`FilesystemAccessor: Error getting metadata for ${entry.path}: ${(error as Error).message}`,
					);
					// Still include the file even if we can't get all metadata
					resources.push({
						name: entry.name,
						uri: `file:./${relativePath}`,
						accessMethod: 'bb',
						type: 'file',
						extraType: 'file',
						mimeType: 'application/octet-stream',
						contentType: 'text',
						description: '(metadata unavailable)',
						lastModified: new Date(),
					} as ResourceMetadata);
				}

				currentIndex++;
			}

			// Prepare pagination info
			let pagination: PaginationInfo | undefined;
			if (resources.length === pageSize) {
				pagination = {
					nextPageToken: (startIndex + pageSize).toString(),
				};
			}

			return {
				resources,
				uriTemplate: 'file:./{path}',
				pagination,
			};
		} catch (error) {
			logger.error(
				`FilesystemAccessor: Error listing resources at ${this.rootPath}/${path}`,
				errorMessage(error),
			);
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to list resources: ${errorMessage(error)}`,
				{
					filePath: options.path || '.',
					operation: 'read',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Find resources using unified operations architecture (primary interface)
	 * Supports all result levels with polymorphic matches and pagination
	 * @param params Search parameters with content/resource patterns and structured queries
	 * @returns Enhanced search results with polymorphic matches and pagination
	 */
	override async findResources(params: FindResourceParams): Promise<FindResourceResult> {
		try {
			const { contentPattern, resourcePattern, structuredQuery, regexPattern = false, options } = params;
			const {
				caseSensitive = false,
				resultLevel = 'fragment',
				maxMatchesPerResource = 5,
				pageSize = 20,
				pageToken,
				filters = {},
			} = options;

			// Determine search mode
			const isContentSearch = !!contentPattern;
			const searchPattern = contentPattern || '';

			// Convert to legacy search options for now (will refactor searchFiles* utilities later)
			const searchFileOptions = {
				resourcePattern,
				dateAfter: filters.dateAfter,
				dateBefore: filters.dateBefore,
				sizeMin: filters.sizeMin,
				sizeMax: filters.sizeMax,
				contextLines: options.contextLines ??
					(resultLevel === 'detailed' ? 5 : (resultLevel === 'fragment' ? 2 : 0)),
				maxMatchesPerFile: maxMatchesPerResource,
				includeContent: isContentSearch,
			};

			let matches: ResourceMatch[] = [];
			let totalMatches = 0;
			let findErrorMessage: string | null = null;

			if (isContentSearch) {
				// Use enhanced content search
				const result = await searchFilesContent(
					this.rootPath,
					searchPattern,
					caseSensitive,
					searchFileOptions,
				);

				// Convert to new ResourceMatch format
				for (const match of result.matches) {
					try {
						// Get resource metadata
						const resourceMetadata = await getFileMetadata(
							this.rootPath,
							match.resourcePath,
						);

						// Process matches based on result level
						const processedMatches = this.processMatchesByLevel(
							match.contentMatches || [],
							resultLevel,
							resourceMetadata.uri,
						);

						matches.push({
							resourceUri: resourceMetadata.uri,
							resourcePath: match.resourcePath,
							resourceType: 'file',
							resourceMetadata: {
								title: resourceMetadata.name,
								lastModified: resourceMetadata.lastModified.toISOString(),
								size: resourceMetadata.size,
								mimeType: resourceMetadata.mimeType,
							},
							matches: processedMatches,
							contentMatches: match.contentMatches, // Legacy compatibility
							score: 1.0,
						});
					} catch (error) {
						logger.warn(
							`FilesystemAccessor: Error getting metadata for ${match.resourcePath}: ${
								errorMessage(error)
							}`,
						);
					}
				}

				totalMatches = matches.length;
				findErrorMessage = result.errorMessage;

				// If there's an error message, we should include it in the result even if no matches
				if (result.errorMessage && matches.length === 0) {
					// Return the error immediately for invalid patterns
					return {
						dataSource: {
							dsConnectionId: this.connection.id,
							dsConnectionName: this.connection.name,
							dsProviderType: this.connection.providerType,
						},
						searchCriteria: {
							pattern: contentPattern || resourcePattern,
							contentPattern,
							resourcePattern,
							structuredQuery,
							caseSensitive,
							regexPattern,
							filters,
						},
						totalMatches: 0,
						resources: [],
						pagination: {
							pageSize,
							pageToken: undefined,
							hasMore: false,
							totalEstimate: 0,
						},
						errorMessage: result.errorMessage,
					};
				}
			} else {
				// Use metadata-only search
				const result = await searchFilesMetadata(
					this.rootPath,
					searchFileOptions,
				);

				// Convert to new ResourceMatch format
				for (const filePath of result.files) {
					try {
						// Get resource metadata
						const resourceMetadata = await getFileMetadata(
							this.rootPath,
							filePath,
						);

						matches.push({
							resourceUri: resourceMetadata.uri,
							resourcePath: filePath,
							resourceType: resourceMetadata.isDirectory ? 'directory' : 'file',
							resourceMetadata: {
								title: resourceMetadata.name,
								lastModified: resourceMetadata.lastModified.toISOString(),
								size: resourceMetadata.size,
								mimeType: resourceMetadata.mimeType,
							},
							matches: [], // No content matches for resource-only results
							score: 1.0,
						});
					} catch (error) {
						logger.warn(
							`FilesystemAccessor: Error getting metadata for ${filePath}: ${errorMessage(error)}`,
						);
					}
				}

				totalMatches = matches.length;
				findErrorMessage = result.errorMessage;
			}

			// Apply pagination
			const { paginatedMatches, pagination } = this.paginateResults(matches, pageSize, pageToken);

			// Build search criteria
			const searchCriteria: SearchCriteria = {
				pattern: contentPattern || resourcePattern,
				contentPattern,
				resourcePattern,
				structuredQuery,
				caseSensitive,
				regexPattern,
				filters,
			};

			// Build data source info
			const dataSource: DataSourceInfo = {
				dsConnectionId: this.connection.id,
				dsConnectionName: this.connection.name,
				dsProviderType: this.connection.providerType,
			};

			return {
				dataSource,
				searchCriteria,
				totalMatches,
				resources: paginatedMatches,
				pagination,
			};
		} catch (error) {
			logger.error(`FilesystemAccessor: Error in findResources`, errorMessage(error));
			if (isResourceHandlingError(error)) {
				throw error;
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to find resources: ${errorMessage(error) || 'Unknown error'}`,
				{
					name: 'find-resources',
					filePath: '.',
					operation: 'search-resources',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Search for resources based on a query (legacy interface)
	 * Delegates to findResources for consistency
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	override async searchResources(query: string, options: ResourceSearchOptions = {}): Promise<ResourceSearchResult> {
		// Delegate to findResources for consistency
		const findParams: FindResourceParams = {
			contentPattern: options.contentPattern || query,
			resourcePattern: options.resourcePattern,
			regexPattern: options.regexPattern,
			options: {
				caseSensitive: options.caseSensitive,
				resultLevel: options.resultLevel || 'fragment',
				maxMatchesPerResource: options.maxMatchesPerFile,
				pageSize: options.pageSize,
				pageToken: options.pageToken,
				filters: {
					dateAfter: options.dateAfter,
					dateBefore: options.dateBefore,
					sizeMin: options.sizeMin,
					sizeMax: options.sizeMax,
				},
			},
		};

		const findResult = await this.findResources(findParams);

		// Convert findResources result to legacy searchResources format
		return {
			matches: findResult.resources.map((resource) => {
				// Create a legacy ResourceMatch format with 'resource' property
				const legacyMatch: any = {
					resource: {
						uri: resource.resourceUri,
						name: resource.resourceMetadata.title,
						type: resource.resourceType as any,
						mimeType: resource.resourceMetadata.mimeType || 'application/octet-stream',
						contentType: 'text' as const,
						lastModified: new Date(resource.resourceMetadata.lastModified || Date.now()),
						size: resource.resourceMetadata.size,
						extraType: resource.resourceType === 'directory' ? 'directory' : 'file',
						accessMethod: 'bb' as const,
					},
					contentMatches: resource.contentMatches,
					score: resource.score,
				};
				return legacyMatch;
			}),
			totalMatches: findResult.totalMatches,
		};
	}

	/**
	 * Write content to a filesystem resource
	 * @param resourceUri URI of the resource to write
	 * @param content Content to write
	 * @param options Options for writing
	 * @returns Result of the write operation
	 */
	override async writeResource(
		resourceUri: string,
		content: string | Uint8Array, // | Array<PortableTextBlock> | Array<TabularSheet>,
		options: ResourceWriteOptions = {},
	): Promise<ResourceWriteResult> {
		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Convert to absolute path
			const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);
			logger.info(`FilesystemAccessor: Write resource for path: ${resourcePath} from URI: ${resourceUri}`, {
				absolutePath,
			});

			// Check if the file exists
			const exists = await safeExists(absolutePath);

			// Check overwrite option
			if (exists && options.overwrite === false) {
				throw createError(
					ErrorType.ResourceHandling,
					`File already exists and overwrite is false: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'write',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Create parent directories if needed
			if (options.createMissingDirectories) {
				await ensureParentDirectories(absolutePath);
			}

			logger.info(
				`FilesystemAccessor: Checks passed - writing resource for path: ${resourcePath} from URI: ${resourceUri}`,
				{ absolutePath },
			);

			// Write the content
			if (typeof content === 'string') {
				await Deno.writeTextFile(absolutePath, content);
			} else {
				await Deno.writeFile(absolutePath, content);
			}

			const resourceMetadata = await getFileMetadata(
				this.rootPath,
				resourcePath,
			);

			return {
				success: true,
				uri: resourceUri,
				metadata: resourceMetadata,
				bytesWritten: typeof content === 'string' ? new TextEncoder().encode(content).length : content.length,
			};
		} catch (error) {
			logger.error(`FilesystemAccessor: Error writing resource ${resourceUri}`, errorMessage(error));
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to write resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'write',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Edit a resource using the unified operations interface
	 * Delegates to appropriate operation handlers based on operation type
	 * @param resourcePath Path of the resource to edit relative to data source root
	 * @param operations Array of edit operations to apply
	 * @returns Result containing operation outcomes and resource metadata
	 */
	override async editResource(
		resourceUri: string,
		operations: ResourceEditOperation[],
		options: { createIfMissing: boolean },
	): Promise<ResourceEditResult> {
		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Group operations by editType for efficient processing
			const operationsByType = new Map<string, ResourceEditOperation[]>();
			for (const operation of operations) {
				const editType = operation.editType;
				if (!operationsByType.has(editType)) {
					operationsByType.set(editType, []);
				}
				operationsByType.get(editType)!.push(operation);
			}

			const allOperationResults: OperationResult[] = [];
			let resourceMetadata: ResourceMetadata;
			let totalBytesWritten = 0;
			let isNewResource = false;

			let i = 0;
			while (i < operations.length) {
				const currentType = operations[i].editType;
				const batch: ResourceEditOperation[] = [];
				const batchStartIndex = i;

				// Collect consecutive operations of same type
				while (i < operations.length && operations[i].editType === currentType) {
					batch.push(operations[i]);
					i++;
				}

				// Process batch
				const batchResults = await this.processBatch(resourceUri, currentType, options, batch, batchStartIndex);

				allOperationResults.push(...batchResults.operationResults);
				if (batchResults.metadata) resourceMetadata = batchResults.metadata;
				totalBytesWritten += batchResults.bytesWritten;
				if (batchResults.isNewResource) isNewResource = true;
			}

			// If no resource metadata was set (e.g., only unsupported operations), get it
			if (!resourceMetadata!) {
				try {
					const resourceResult = await this.loadResource(resourceUri);
					resourceMetadata = resourceResult.metadata;
				} catch (error) {
					// Resource might not exist, create basic metadata
					resourceMetadata = {
						name: basename(resourcePath),
						uri: resourceUri,
						accessMethod: 'bb',
						type: 'file',
						extraType: 'file',
						mimeType: 'text/plain',
						contentType: 'text',
						lastModified: new Date(),
						size: 0,
					};
				}
			}

			// Calculate success metrics
			const successfulOperations = allOperationResults.filter((r) => r.status === 'success');
			const skippedOperations = allOperationResults.filter((r) => r.status === 'skipped');
			const failedOperations = allOperationResults.filter((r) => r.status === 'failed');
			const allOperationsSucceeded = failedOperations.length === 0 && skippedOperations.length === 0;
			const allOperationsFailed = successfulOperations.length === 0 && skippedOperations.length === 0;

			return {
				//success: successfulOperations.length > 0,
				operationResults: allOperationResults,
				successfulOperations,
				skippedOperations,
				failedOperations,
				allOperationsSucceeded,
				allOperationsFailed,
				metadata: resourceMetadata,
				// metadata: {
				// 	...resourceMetadata,
				// 	//revision: resourceMetadata.lastModified?.toISOString() || new Date().toISOString(),
				// 	//bytesWritten: totalBytesWritten || 0,
				// },
				isNewResource,
				bytesWritten: totalBytesWritten,
			};
		} catch (error) {
			logger.error(
				`FilesystemAccessor: Error in editResource for ${resourceUri}`,
				errorMessage(error),
			);
			if (isResourceHandlingError(error)) {
				throw error;
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to edit resource: ${errorMessage(error)}`,
				{
					name: 'edit-resource',
					filePath: resourceUri,
					operation: 'edit',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	private async processBatch(
		resourceUri: string,
		editType: EditType,
		options: { createIfMissing: boolean },
		batch: ResourceEditOperation[],
		startIndex: number,
	) {
		const operationResults: OperationResult[] = [];
		let metadata: ResourceMetadata | undefined;
		let bytesWritten = 0;
		let isNewResource = false;

		switch (editType) {
			case 'searchReplace':
				const searchReplaceOps: SearchReplaceOperation[] = batch.map((op) => ({
					editType: 'searchReplace',
					search: op.searchReplace_search!,
					replace: op.searchReplace_replace!,
					caseSensitive: op.searchReplace_caseSensitive ?? true,
					regexPattern: op.searchReplace_regexPattern ?? false,
					replaceAll: op.searchReplace_replaceAll ?? false,
				}));

				const searchReplaceResult = await this.applySearchReplaceOperations(
					resourceUri,
					searchReplaceOps,
					{}, // defaults
					options.createIfMissing,
				);

				for (let i = 0; i < batch.length; i++) {
					operationResults.push({
						operationIndex: startIndex + i,
						editType: 'searchReplace',
						status: searchReplaceResult.contentResult.operationResults[i]?.status as
							| 'success'
							| 'failed'
							| 'skipped' || 'failed',
						message: searchReplaceResult.contentResult.operationResults[i]?.message || 'No result',
						details: {
							matchCount: 1,
						},
					});

					// const legacyResult = searchReplaceResult.contentResult.operationResults[i];
					// if (legacyResult) {
					// 	allOperationResults[originalIndex] = {
					// 		operationIndex: originalIndex,
					// 		editType: 'searchReplace',
					// 		status: legacyResult.status as 'success' | 'failed' | 'skipped',
					// 		message: legacyResult.message,
					// 		details: {
					// 			matchCount: 1 // Legacy format doesn't track match count per operation
					// 		}
					// 	};
					// }
				}

				metadata = searchReplaceResult.metadata;
				bytesWritten = searchReplaceResult.bytesWritten;
				isNewResource = searchReplaceResult.isNewResource;
				break;

			case 'range':
				for (let i = 0; i < batch.length; i++) {
					operationResults.push({
						operationIndex: startIndex + i,
						editType: 'range',
						status: 'skipped',
						message: 'Filesystem does not support range operations',
					});
				}
				break;

			case 'blocks':
				for (let i = 0; i < batch.length; i++) {
					operationResults.push({
						operationIndex: startIndex + i,
						editType: 'blocks',
						status: 'skipped',
						message: 'Filesystem does not support block operations',
					});
				}
				break;

			case 'structuredData':
				for (let i = 0; i < batch.length; i++) {
					operationResults.push({
						operationIndex: startIndex + i,
						editType: 'structuredData',
						status: 'skipped',
						message: 'Filesystem does not support structured data operations',
					});
				}
				break;

			default:
				for (let i = 0; i < batch.length; i++) {
					operationResults.push({
						operationIndex: startIndex + i,
						editType: editType,
						status: 'failed',
						message: `Unknown operation type: ${editType}`,
					});
				}
				break;
		}

		return { operationResults, metadata, bytesWritten, isNewResource };
	}

	/**
	 * Apply search and replace operations to a filesystem resource
	 * @param resourceUri URI of the resource to modify
	 * @param operations Array of search and replace operations
	 * @param defaults Default values for operation properties
	 * @param createIfMissing Whether to create the resource if it doesn't exist
	 * @returns Result of the search and replace operations with content and metadata
	 */
	async applySearchReplaceOperations(
		resourceUri: string,
		operations: SearchReplaceOperation[],
		defaults: {
			caseSensitive?: boolean;
			regexPattern?: boolean;
			replaceAll?: boolean;
		} = {},
		createIfMissing: boolean = false,
	): Promise<{
		contentResult: SearchReplaceContentResult;
		metadata: ResourceMetadata;
		bytesWritten: number;
		isNewResource: boolean;
	}> {
		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Convert to absolute path
			const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);

			let content: string | Uint8Array;
			let isNewResource = false;

			try {
				const resource = await this.loadResource(resourceUri);
				content = resource.content;
				// Validate that content is actually text
				if (typeof content !== 'string') {
					if (content instanceof Uint8Array) {
						const byteLength = content.byteLength;
						throw createError(
							ErrorType.ResourceHandling,
							`Cannot perform search and replace on binary content: ${resourcePath}. The resource appears to be binary data (${byteLength} bytes).`,
							{
								filePath: resourcePath,
								operation: 'search-replace',
							} as ResourceHandlingErrorOptions,
						);
					} else {
						throw createError(
							ErrorType.ResourceHandling,
							`Cannot perform search and replace on non-string content: ${resourcePath}. Content type: ${typeof content}`,
							{
								filePath: resourcePath,
								operation: 'search-replace',
							} as ResourceHandlingErrorOptions,
						);
					}
				}
			} catch (error) {
				if (isResourceHandlingError(error) && createIfMissing) {
					content = '';
					isNewResource = true;
					logger.info(`FilesystemAccessor: Resource ${resourceUri} not found. Creating new resource.`);
					// Create missing directories
					await this.ensureResourcePathExists(resourceUri);
					logger.info(`FilesystemAccessor: Created directory structure for ${resourceUri}`);
				} else {
					throw error;
				}
			}

			// Apply search and replace operations to content
			const contentResult = applySearchAndReplaceToContent(
				content as string,
				operations,
				defaults,
				isNewResource,
			);

			// Check if any operations were successful or if it's a new resource
			if (contentResult.successfulOperations.length === 0 && !isNewResource) {
				const noChangesMessage = `No changes were made to the resource: ${resourcePath}. Results: ${
					JSON.stringify(contentResult.operationResults)
				}`;
				logger.info(`FilesystemAccessor: ${noChangesMessage}`);
				throw createError(
					ErrorType.ResourceHandling,
					noChangesMessage,
					{
						filePath: resourcePath,
						operation: 'search-replace',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Write the modified content back to the file
			const writeResult = await this.writeResource(resourceUri, contentResult.processedContent, {
				overwrite: true,
				createMissingDirectories: true,
			});

			if (!writeResult.success) {
				throw createError(
					ErrorType.ResourceHandling,
					`Writing resource failed for ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'search-replace',
					} as ResourceHandlingErrorOptions,
				);
			}

			logger.info(
				`FilesystemAccessor: Applied ${contentResult.successfulOperations.length} search and replace operations. Wrote ${writeResult.bytesWritten} bytes for: ${writeResult.uri}`,
			);

			return {
				contentResult,
				metadata: writeResult.metadata!,
				bytesWritten: writeResult.bytesWritten || 0,
				isNewResource,
			};
		} catch (error) {
			logger.error(
				`FilesystemAccessor: Error applying search and replace operations to ${resourceUri}`,
				errorMessage(error),
			);
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to apply search and replace operations: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'search-replace',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Move a resource to a new location
	 * @param sourceUri Source resource URI
	 * @param destinationUri Destination resource URI
	 * @param options Options for moving
	 * @returns Result of the move operation
	 */
	override async moveResource(
		sourceUri: string,
		destinationUri: string,
		options: ResourceMoveOptions = {},
	): Promise<ResourceMoveResult> {
		try {
			// Extract resource paths from URIs
			const sourcePath = extractResourcePath(sourceUri);
			const destPath = extractResourcePath(destinationUri);

			if (!sourcePath || !destPath) {
				throw new Error(`Invalid resource URI: ${!sourcePath ? sourceUri : destinationUri}`);
			}

			// Convert to absolute paths
			const sourceAbsPath = resourcePathToAbsolute(this.rootPath, sourcePath);
			//const destAbsPath = resourcePathToAbsolute(this.rootPath, destPath);
			const sourceBase = basename(sourcePath);
			const destFile = join(destPath, sourceBase);
			const destAbsFile = resourcePathToAbsolute(this.rootPath, destFile);

			// Check if source exists
			if (!await safeExists(sourceAbsPath)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Source file not found: ${sourcePath}`,
					{
						filePath: sourcePath,
						operation: 'move',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Check if destination file exists
			const destExists = await safeExists(destAbsFile);

			// Check overwrite option
			if (destExists && options.overwrite === false) {
				throw createError(
					ErrorType.ResourceHandling,
					`Destination file already exists and overwrite is false: ${destFile}`,
					{
						filePath: destPath,
						operation: 'move',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Create parent directories if needed
			if (options.createMissingDirectories) {
				await ensureParentDirectories(destAbsFile);
			}

			// Move the file
			await Deno.rename(sourceAbsPath, destAbsFile);

			const resourceMetadata = await getFileMetadata(
				this.rootPath,
				destPath,
			);

			return {
				success: true,
				sourceUri,
				destinationUri,
				metadata: resourceMetadata,
			};
		} catch (error) {
			logger.error(
				`FilesystemAccessor: Error moving resource ${sourceUri} to ${destinationUri}`,
				errorMessage(error),
			);
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to move resource: ${errorMessage(error)}`,
				{
					filePath: sourceUri,
					operation: 'move',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Rename a resource - potentially moving to a new location
	 * @param sourceUri Source resource URI
	 * @param destinationUri Destination resource URI
	 * @param options Options for moving
	 * @returns Result of the move operation
	 */
	override async renameResource(
		sourceUri: string,
		destinationUri: string,
		options: ResourceMoveOptions = {},
	): Promise<ResourceMoveResult> {
		try {
			// Extract resource paths from URIs
			const sourcePath = extractResourcePath(sourceUri);
			const destPath = extractResourcePath(destinationUri);

			if (!sourcePath || !destPath) {
				throw new Error(`Invalid resource URI: ${!sourcePath ? sourceUri : destinationUri}`);
			}

			// Convert to absolute paths
			const sourceAbsPath = resourcePathToAbsolute(this.rootPath, sourcePath);
			const destAbsPath = resourcePathToAbsolute(this.rootPath, destPath);

			// Check if source exists
			if (!await safeExists(sourceAbsPath)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Source file not found: ${sourcePath}`,
					{
						filePath: sourcePath,
						operation: 'rename',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Check if destination file exists
			const destExists = await safeExists(destAbsPath);

			// Check overwrite option
			if (destExists && options.overwrite === false) {
				throw createError(
					ErrorType.ResourceHandling,
					`Destination file already exists and overwrite is false: ${destPath}`,
					{
						filePath: destPath,
						operation: 'rename',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Create parent directories if needed
			if (options.createMissingDirectories) {
				await ensureParentDirectories(destAbsPath);
			}

			// Move the file
			await Deno.rename(sourceAbsPath, destAbsPath);

			const resourceMetadata = await getFileMetadata(
				this.rootPath,
				destPath,
			);

			return {
				success: true,
				sourceUri,
				destinationUri,
				metadata: resourceMetadata,
			};
		} catch (error) {
			logger.error(
				`FilesystemAccessor: Error renaming resource ${sourceUri} to ${destinationUri}`,
				errorMessage(error),
			);
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to rename resource: ${errorMessage(error)}`,
				{
					filePath: sourceUri,
					operation: 'rename',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Delete a resource
	 * @param resourceUri URI of the resource to delete
	 * @param options Options for deletion
	 * @returns Result of the delete operation
	 */
	override async deleteResource(
		resourceUri: string,
		options: ResourceDeleteOptions = {},
	): Promise<ResourceDeleteResult> {
		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Convert to absolute path
			const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);

			// Check if the resource exists
			if (!await safeExists(absolutePath)) {
				throw createError(
					ErrorType.ResourceHandling,
					`Resource not found: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'delete',
					} as ResourceHandlingErrorOptions,
				);
			}

			const { isDirectory } = await getFileMetadata(
				this.rootPath,
				resourcePath,
			);

			// Handle based on resource type
			if (isDirectory && options.recursive !== true) {
				throw createError(
					ErrorType.ResourceHandling,
					`Cannot delete directory without recursive option: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'delete',
					} as ResourceHandlingErrorOptions,
				);
			}

			// Delete the resource
			await Deno.remove(absolutePath, { recursive: options.recursive });

			return {
				success: true,
				uri: resourceUri,
				type: isDirectory ? 'directory' : 'file',
			};
		} catch (error) {
			logger.error(`FilesystemAccessor: Error deleting resource ${resourceUri}`, errorMessage(error));
			if (isResourceHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.ResourceHandling,
				`Failed to delete resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'delete',
				} as ResourceHandlingErrorOptions,
			);
		}
	}

	/**
	 * Get metadata about the filesystem data source
	 * Reuses the same exclude patterns and filtering logic as listResources
	 * @returns Promise<DataSourceMetadata> Metadata about the filesystem
	 */
	async getMetadata(): Promise<DataSourceMetadata> {
		logger.debug('FilesystemAccessor: Getting metadata for filesystem');

		const metadata: DataSourceMetadata = {
			totalResources: 0,
			resourceTypes: {},
			lastScanned: new Date().toISOString(),
			filesystem: {
				totalDirectories: 0,
				totalFiles: 0,
				deepestPathDepth: 0,
				fileExtensions: {},
			},
		};

		try {
			// Get exclude patterns (reuse the same logic as listResources)
			const excludeOptions = await getExcludeOptions(this.rootPath);
			const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, this.rootPath);

			// Configure walk options (same as listResources but unlimited depth)
			const walkOptions: WalkOptions = {
				maxDepth: Number.POSITIVE_INFINITY, // Scan everything for metadata
				includeDirs: true,
				includeSymlinks: false,
				skip: excludeOptionsRegex, // Use the same exclude patterns
			};

			// Initialize LLM-critical metadata
			if (metadata.filesystem) {
				metadata.filesystem.capabilities = {
					canRead: true, // We can scan, so we can read
					canWrite: false, // Will test below
					canDelete: false, // Will test below
					canMove: false, // Will test below
					hasRestrictedAreas: false, // Will detect below
				};

				metadata.filesystem.contentVisibility = {
					includesHiddenFiles: true, // Based on our exclude patterns
					includesDotDirectories: false, // We skip .git, .bb, etc.
					followsSymlinks: false, // walk options set includeSymlinks: false
					brokenSymlinkCount: 0,
					filteredByGitignore: true, // We use getExcludeOptions
					filteredByBBIgnore: true,
				};

				metadata.filesystem.practicalLimits = {
					maxFileSize: 10 * 1024 * 1024, // 10MB reasonable limit for text processing
					recommendedPageSize: 50, // Good balance for filesystem
					hasVeryLargeFiles: false, // Will detect below
				};

				metadata.filesystem.contentAnalysis = {
					textFileCount: 0,
					binaryFileCount: 0,
					likelyEncodingIssues: 0,
					emptyFileCount: 0,
				};
			}

			// Test write capabilities once
			try {
				const testPath = join(this.rootPath, '.bb-write-test');
				await Deno.writeTextFile(testPath, 'test');
				await Deno.remove(testPath);
				if (metadata.filesystem?.capabilities) {
					metadata.filesystem.capabilities.canWrite = true;
					metadata.filesystem.capabilities.canDelete = true;
					metadata.filesystem.capabilities.canMove = true;
				}
			} catch (error) {
				// Can't write to root, that's important info for LLM
				logger.debug(`FilesystemAccessor: Cannot write to root: ${error}`);
			}

			// Walk the file system and collect metadata
			for await (const entry of walk(this.rootPath, walkOptions)) {
				// Get relative path and depth
				const relativePath = relative(this.rootPath, entry.path);
				const depth = relativePath === '' ? 0 : relativePath.split('/').length;

				// Update deepest path depth
				if (depth > (metadata.filesystem?.deepestPathDepth || 0)) {
					if (metadata.filesystem) {
						metadata.filesystem.deepestPathDepth = depth;
					}
				}

				if (entry.isDirectory) {
					// Count directories
					if (metadata.filesystem) {
						metadata.filesystem.totalDirectories = (metadata.filesystem.totalDirectories || 0) + 1;
					}
				} else if (entry.isFile) {
					// Count files
					if (metadata.filesystem) {
						metadata.filesystem.totalFiles = (metadata.filesystem.totalFiles || 0) + 1;

						// Track file extensions
						const ext = entry.name.includes('.') ? '.' + entry.name.split('.').pop()! : '(no extension)';

						if (!metadata.filesystem.fileExtensions) {
							metadata.filesystem.fileExtensions = {};
						}
						metadata.filesystem.fileExtensions[ext] = (metadata.filesystem.fileExtensions[ext] || 0) + 1;

						// Track file dates and sizes + LLM-critical analysis
						try {
							const stat = await Deno.stat(entry.path);

							// Size tracking
							if (stat.size && stat.size > (metadata.filesystem.largestFileSize || 0)) {
								metadata.filesystem.largestFileSize = stat.size;
							}

							// LLM-critical: Detect problematic files
							if (stat.size === 0 && metadata.filesystem.contentAnalysis) {
								metadata.filesystem.contentAnalysis.emptyFileCount++;
							}

							if (stat.size && stat.size > 10 * 1024 * 1024 && metadata.filesystem.practicalLimits) {
								metadata.filesystem.practicalLimits.hasVeryLargeFiles = true;
							}

							// Content type analysis (for LLM decision making)
							const isBinary = this.isBinaryFile(entry.name, ext);
							if (metadata.filesystem.contentAnalysis) {
								if (isBinary) {
									metadata.filesystem.contentAnalysis.binaryFileCount++;
								} else {
									metadata.filesystem.contentAnalysis.textFileCount++;
								}
							}

							// Date tracking
							if (stat.mtime) {
								const fileDate = stat.mtime.toISOString();

								if (
									!metadata.filesystem.oldestFileDate ||
									fileDate < metadata.filesystem.oldestFileDate
								) {
									metadata.filesystem.oldestFileDate = fileDate;
								}

								if (
									!metadata.filesystem.newestFileDate ||
									fileDate > metadata.filesystem.newestFileDate
								) {
									metadata.filesystem.newestFileDate = fileDate;
								}
							}
						} catch (statError) {
							// Permission denied or other access issue - important for LLM
							if (metadata.filesystem?.capabilities) {
								metadata.filesystem.capabilities.hasRestrictedAreas = true;
							}
							logger.debug(`FilesystemAccessor: Could not stat file ${entry.path}: ${statError}`);
						}
					}
				}
			}

			// Set total resources and resource types
			metadata.totalResources = (metadata.filesystem?.totalFiles || 0) +
				(metadata.filesystem?.totalDirectories || 0);

			metadata.resourceTypes = {
				file: metadata.filesystem?.totalFiles || 0,
				directory: metadata.filesystem?.totalDirectories || 0,
			};

			logger.debug('FilesystemAccessor: Metadata collection complete', {
				totalResources: metadata.totalResources,
				resourceTypes: metadata.resourceTypes,
				deepestPathDepth: metadata.filesystem?.deepestPathDepth,
				fileExtensionCount: Object.keys(metadata.filesystem?.fileExtensions || {}).length,
			});
		} catch (error) {
			logger.error(`FilesystemAccessor: Error collecting metadata:`, errorMessage(error));
			// Return basic metadata even if scan failed
			metadata.totalResources = 0;
			metadata.resourceTypes = { file: 0, directory: 0 };
		}

		return metadata;
	}

	/**
	 * Format filesystem metadata for display
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

		if (metadata.filesystem) {
			lines.push(`Filesystem Details:`);
			const fs = metadata.filesystem;

			// LLM-critical capabilities
			if (fs.capabilities) {
				lines.push(
					`  Capabilities: Read=${fs.capabilities.canRead}, Write=${fs.capabilities.canWrite}, Delete=${fs.capabilities.canDelete}`,
				);
				if (fs.capabilities.hasRestrictedAreas) {
					lines.push(`  ⚠️  Has restricted areas (permission denied on some files)`);
				}
			}

			// Content visibility (what LLM can/cannot see)
			if (fs.contentVisibility) {
				lines.push(
					`  Visibility: Hidden files=${fs.contentVisibility.includesHiddenFiles}, Follows symlinks=${fs.contentVisibility.followsSymlinks}`,
				);
				lines.push(
					`  Filtering: gitignore=${fs.contentVisibility.filteredByGitignore}, BB ignore=${fs.contentVisibility.filteredByBBIgnore}`,
				);
			}

			// Content analysis (critical for LLM processing decisions)
			if (fs.contentAnalysis) {
				lines.push(
					`  Content: ${fs.contentAnalysis.textFileCount} text files, ${fs.contentAnalysis.binaryFileCount} binary files`,
				);
				if (fs.contentAnalysis.emptyFileCount > 0) {
					lines.push(`  Empty files: ${fs.contentAnalysis.emptyFileCount}`);
				}
			}

			// Practical limits (helps LLM make informed requests)
			if (fs.practicalLimits) {
				lines.push(`  Recommended page size: ${fs.practicalLimits.recommendedPageSize}`);
				if (fs.practicalLimits.hasVeryLargeFiles) {
					lines.push(`  ⚠️  Contains very large files (>10MB) - may timeout`);
				}
			}

			if (fs.deepestPathDepth !== undefined) {
				lines.push(`  Directory depth: ${fs.deepestPathDepth}`);
			}

			if (fs.largestFileSize !== undefined) {
				lines.push(`  Largest file: ${this.formatFileSize(fs.largestFileSize)}`);
			}

			if (fs.oldestFileDate && fs.newestFileDate) {
				lines.push(
					`  Date range: ${new Date(fs.oldestFileDate).toLocaleDateString()} - ${
						new Date(fs.newestFileDate).toLocaleDateString()
					}`,
				);
			}

			if (fs.fileExtensions && Object.keys(fs.fileExtensions).length > 0) {
				lines.push(`  File Extensions:`);
				// Sort by count (descending) and show top 10
				const sortedExts = Object.entries(fs.fileExtensions)
					.sort(([, a]: [string, number], [, b]: [string, number]): number => b - a)
					.slice(0, 10);
				for (const [ext, count] of sortedExts) {
					lines.push(`    ${ext}: ${count}`);
				}
				if (Object.keys(fs.fileExtensions).length > 10) {
					lines.push(`    ... and ${Object.keys(fs.fileExtensions).length - 10} more`);
				}
			}
		}

		if (metadata.lastScanned) {
			lines.push(`Last Scanned: ${new Date(metadata.lastScanned).toLocaleString()}`);
		}

		return lines.join('\n');
	}

	/**
	 * Format file size in human-readable format
	 * @param bytes File size in bytes
	 * @returns Formatted string (e.g., "1.5 MB")
	 */
	private formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';

		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	/**
	 * Determine if a file is likely binary based on extension and name
	 * Critical for LLM to know what files it can meaningfully process
	 * @param filename The name of the file
	 * @param extension The file extension
	 * @returns True if likely binary, false if likely text
	 */
	private isBinaryFile(filename: string, extension: string): boolean {
		// Common binary extensions
		const binaryExtensions = new Set([
			'.png',
			'.jpg',
			'.jpeg',
			'.gif',
			'.bmp',
			'.svg',
			'.webp',
			'.ico',
			'.mp3',
			'.mp4',
			'.wav',
			'.avi',
			'.mov',
			'.mkv',
			'.webm',
			'.pdf',
			'.doc',
			'.docx',
			'.xls',
			'.xlsx',
			'.ppt',
			'.pptx',
			'.zip',
			'.tar',
			'.gz',
			'.7z',
			'.rar',
			'.exe',
			'.dll',
			'.so',
			'.dylib',
			'.app',
			'.wasm',
			'.bin',
			'.dat',
			'.ttf',
			'.otf',
			'.woff',
			'.woff2',
			'.sqlite',
			'.db',
		]);

		// Check extension
		if (binaryExtensions.has(extension.toLowerCase())) {
			return true;
		}

		// Check filename patterns
		const lowerName = filename.toLowerCase();
		if (lowerName.includes('binary') || lowerName.includes('.min.') || lowerName.endsWith('.min')) {
			return true;
		}

		// Default to text if unknown
		return false;
	}

	/**
	 * Suggest resources for autocomplete based on partial path
	 * @param partialPath Partial path input from user
	 * @param options Suggestion options (limit, filters, etc.)
	 * @returns Resource suggestions for autocomplete
	 */
	override async suggestResourcesForPath(
		partialPath: string,
		options: ResourceSuggestionsOptions,
	): Promise<ResourceSuggestionsResponse> {
		const { limit = 50, caseSensitive = false, type = 'all', followSymlinks: optionsFollowSymlinks } = options;
		logger.warn('FilesystemAccessor: Suggesting resources for', {
			partialPath,
			followSymlinks: optionsFollowSymlinks,
		});

		// Remove leading slash as it's just a trigger, not part of the pattern
		const searchPath = partialPath.replace(/^\//, '');

		// Get exclude patterns
		const excludeOptions = await getExcludeOptions(this.rootPath);
		const excludePatterns = createExcludeRegexPatterns(excludeOptions, this.rootPath);

		// Generate patterns for matching
		const patterns = this.createSuggestionPatterns(searchPath, { caseSensitive, type });
		if (patterns.length === 0) {
			logger.info('FilesystemAccessor: No valid patterns generated');
			return { suggestions: [], hasMore: false };
		}

		// Collect matching files
		const results: Array<ResourceSuggestion> = [];
		let reachedLimit = false;

		try {
			for await (
				const entry of walk(this.rootPath, {
					includeDirs: true,
					followSymlinks: this.followSymlinks,
					match: patterns,
					skip: excludePatterns,
				})
			) {
				// Check limit before adding
				if (results.length >= limit) {
					reachedLimit = true;
					break;
				}

				const stat = await Deno.stat(entry.path);
				const relativePath = relative(this.rootPath, entry.path);

				results.push({
					dataSourceRoot: this.rootPath,
					path: relativePath,
					isDirectory: stat.isDirectory,
					size: stat.size,
					modified: stat.mtime?.toISOString(),
					dataSourceName: this.connection.name,
				});
			}
		} catch (error) {
			logger.error('FilesystemAccessor: Error walking directory', error);
			throw createError(
				ErrorType.FileHandling,
				`Error walking directory: ${(error as Error).message}`,
			);
		}

		// Apply type filtering if specified
		const filteredResults = results.filter((entry) => {
			if (type === 'directory') return entry.isDirectory;
			if (type === 'file') return !entry.isDirectory;
			return true;
		});

		return {
			suggestions: filteredResults,
			hasMore: reachedLimit,
		};
	}

	/**
	 * Creates an array of RegExp patterns for matching file suggestions based on partial path input
	 */
	private createSuggestionPatterns(
		partialPath: string,
		options: { caseSensitive?: boolean; type?: 'all' | 'file' | 'directory' } = {},
	): RegExp[] {
		// Normalize path separators to forward slashes
		partialPath = partialPath.replace(/\\/g, '/');

		// Reject paths trying to escape root
		if (partialPath.includes('../') || partialPath.includes('..\\')) {
			logger.warn('FilesystemAccessor: Rejecting path that tries to escape root', { partialPath });
			return [];
		}

		const patterns: RegExp[] = [];
		const globOptions = {
			flags: options.caseSensitive ? '' : 'i',
			extended: true,
			globstar: true,
		};

		// Helper to create regex with proper case sensitivity
		const createRegex = (pattern: string) => {
			const flags = options.caseSensitive ? '' : 'i';
			return new RegExp(pattern, flags);
		};

		// Handle empty input
		if (!partialPath) {
			const rootPattern = '**/*';
			patterns.push(globToRegExp(rootPattern, globOptions));

			if (options.type !== 'file') {
				const rootDirPattern = '*/';
				patterns.push(globToRegExp(rootDirPattern, globOptions));
			}
			return patterns;
		}

		// Handle brace expansion and multiple patterns
		const expandBraces = (pattern: string): string[] => {
			const match = pattern.match(/{([^}]+)}/);
			if (!match) return [pattern];

			const [fullMatch, alternatives] = match;
			const parts = alternatives.split(',').map((p) => p.trim());

			// Create a regex-compatible OR group
			const orGroup = `(${parts.join('|')})`;
			return [pattern.replace(fullMatch, orGroup)];
		};

		// Split by | and handle brace expansion
		const subPatterns = partialPath
			.split('|')
			.flatMap((pattern) => expandBraces(pattern));

		for (const pattern of subPatterns) {
			let singlePattern = pattern;

			// Handle directory patterns
			if (
				singlePattern.endsWith('/') ||
				(!singlePattern.includes('*') && !singlePattern.includes('.') && !singlePattern.includes('{') &&
					!singlePattern.includes('('))
			) {
				singlePattern = singlePattern.slice(0, -1);
				const dirPattern = singlePattern.includes('**') ? `${singlePattern}/**/*` : `**/${singlePattern}*/**/*`;
				patterns.push(createRegex(globToRegExp(dirPattern, globOptions).source));
			}

			// Handle bare filename (no path, no wildcards)
			if (!singlePattern.includes('/') && !singlePattern.includes('*')) {
				const dirPattern = `**/${singlePattern}*/`;
				patterns.push(globToRegExp(dirPattern, globOptions));

				const filesPattern = `**/${singlePattern}*/**/*`;
				patterns.push(globToRegExp(filesPattern, globOptions));
			}

			// Handle wildcard patterns
			if (singlePattern.includes('*')) {
				if (singlePattern.includes('**')) {
					const prefixedPattern = singlePattern.startsWith('**/') ? singlePattern : `**/${singlePattern}`;
					const pattern = globToRegExp(prefixedPattern, { ...globOptions, globstar: true });
					patterns.push(pattern);
				} else {
					if (singlePattern.includes('.')) {
						const prefixedPattern = `**/${singlePattern}`;
						patterns.push(createRegex(globToRegExp(prefixedPattern, globOptions).source));
					} else {
						const dirPattern = `**/${singlePattern}`;
						const contentsPattern = `**/${singlePattern}/**/*`;
						patterns.push(globToRegExp(dirPattern, globOptions));
						patterns.push(globToRegExp(contentsPattern, globOptions));
					}
				}
			}
		}

		return patterns;
	}

	/**
	 * Check if this accessor has a specific capability
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// Filesystem supports all standard operations
		return ['read', 'write', 'list', 'search', 'move', 'delete'].includes(capability);
	}

	/**
	 * Process content matches based on result level
	 * @param contentMatches Original content matches
	 * @param resultLevel Desired result level
	 * @param resourceUri URI of the resource
	 * @returns Processed matches array
	 */
	private processMatchesByLevel(
		contentMatches: any[],
		resultLevel: ResultLevel,
		resourceUri: string,
	): Match[] {
		if (resultLevel === 'resource') {
			return []; // No matches for resource-only results
		}

		// Convert ContentMatch objects to TextMatch format
		return contentMatches.map((contentMatch, index) => {
			const textMatch: TextMatch = {
				type: 'text',
				resourceUri,
				lineNumber: contentMatch.lineNumber,
				characterRange: {
					start: contentMatch.matchStart || 0,
					end: contentMatch.matchEnd || contentMatch.content?.length || 0,
				},
				text: contentMatch.content || '',
			};

			// Add context based on result level
			if (resultLevel === 'fragment' || resultLevel === 'detailed') {
				const contextBefore = contentMatch.contextBefore || [];
				const contextAfter = contentMatch.contextAfter || [];

				textMatch.context = {
					before: contextBefore.join('\n'),
					after: contextAfter.join('\n'),
				};
			}

			return textMatch;
		});
	}

	/**
	 * Apply pagination to search results
	 * @param matches All matches
	 * @param pageSize Maximum number of results per page
	 * @param pageToken Optional page token for continuation
	 * @returns Paginated results and pagination info
	 */
	private paginateResults(
		matches: ResourceMatch[],
		pageSize: number,
		pageToken?: string,
	): { paginatedMatches: ResourceMatch[]; pagination: PaginationResult } {
		const startIndex = pageToken ? parseInt(pageToken, 10) || 0 : 0;
		const endIndex = Math.min(startIndex + pageSize, matches.length);
		const paginatedMatches = matches.slice(startIndex, endIndex);
		const hasMore = endIndex < matches.length;
		const nextPageToken = hasMore ? endIndex.toString() : undefined;

		const pagination: PaginationResult = {
			pageSize,
			pageToken: nextPageToken,
			hasMore,
			totalEstimate: matches.length,
		};

		return { paginatedMatches, pagination };
	}
}
