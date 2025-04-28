/**
 * FilesystemAccessor implementation for accessing filesystem resources.
 */
import { basename, dirname, join, relative } from '@std/path';
import { ensureDir, exists, expandGlob, walk } from '@std/fs';

import { logger } from 'shared/logger.ts';
import { BBResourceAccessor } from '../base/bbResourceAccessor.ts';
import {
	extractResourcePath,
	//parsePreservingRelative
} from 'shared/dataSource.ts';
import {
	//absolutePathToResource,
	createExcludeRegexPatterns,
	ensureParentDirectories,
	getExcludeOptions,
	getFileMetadata,
	isPathWithinDataSource,
	resourcePathToAbsolute,
	safeExists,
} from 'api/utils/fileHandling.ts';
import type { WalkOptions } from '@std/fs';
import { errorMessage } from 'shared/error.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isFileHandlingError } from 'api/errors/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type {
	PaginationInfo,
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
	ResourceMetadata,
	ResourceMoveOptions,
	ResourceMoveResult,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
} from 'shared/types/dataSourceResource.ts';
import type { DataSourceCapability } from 'shared/types/dataSource.ts';

/**
 * FilesystemAccessor for accessing filesystem resources
 * Implements all core resource operations for filesystem data sources
 */
export class FilesystemAccessor extends BBResourceAccessor {
	/**
	 * Root path of the filesystem data source
	 */
	private rootPath: string;

	/**
	 * Create a new FilesystemAccessor
	 * @param connection The data source connection to use
	 */
	constructor(connection: DataSourceConnection) {
		super(connection);

		// Extract and validate the root path from the connection config
		const rootPath = connection.config.dataSourceRoot as string;
		if (!rootPath || typeof rootPath !== 'string') {
			throw new Error(`Invalid dataSourceRoot in connection ${connection.id}: ${rootPath}`);
		}

		this.rootPath = rootPath;
		logger.debug(`FilesystemAccessor: Created for ${connection.id} with root ${this.rootPath}`);
	}

	/**
	 * Check if resource exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 * @returns boolean
	 */
	async isResourceWithinDataSource(resourceUri: string): Promise<boolean> {
		const resourcePath = extractResourcePath(resourceUri) || '.';
		//logger.info(`FilesystemAccessor: isResourceWithinDataSource - checking root ${this.rootPath} contains ${resourcePath}`);
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
					ErrorType.FileNotFound,
					`File not found: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'read',
					} as FileHandlingErrorOptions,
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
			logger.error(`FilesystemAccessor: Error loading resource ${resourceUri}`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to load resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'read',
				} as FileHandlingErrorOptions,
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
					ErrorType.FileHandling,
					`Directory not found: ${path}`,
					{
						name: 'list-resources',
						filePath: path,
						operation: 'read',
					} as FileHandlingErrorOptions,
				);
			}

			// Get file info to confirm it's a directory
			const baseDirInfo = await Deno.stat(baseDir);
			if (!baseDirInfo.isDirectory) {
				throw createError(
					ErrorType.FileHandling,
					`Path is not a directory: ${path}`,
					{
						name: 'list-resources',
						filePath: path,
						operation: 'read',
					} as FileHandlingErrorOptions,
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
			logger.error(`FilesystemAccessor: Error listing resources at ${this.rootPath}/${path}`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to list resources: ${errorMessage(error)}`,
				{
					filePath: options.path || '.',
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Search for resources based on a query
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	override async searchResources(query: string, options: ResourceSearchOptions = {}): Promise<ResourceSearchResult> {
		try {
			const path = options.path || '.';

			// Convert to absolute path
			const absolutePath = resourcePathToAbsolute(this.rootPath, path);

			// Set up the pattern for file matching
			const filePattern = options.filePattern || '*';

			// Use expandGlob to get matching entries
			const globPattern = join(absolutePath, filePattern);
			const entries = expandGlob(globPattern);

			// Process entries
			const matches: ResourceSearchResult['matches'] = [];
			let count = 0;
			const pageSize = options.pageSize || 100; // Default pageSize

			// Whether to use case-sensitive search
			const caseSensitive = options.caseSensitive || false;

			// Create RegExp for content search
			let regex: RegExp;
			try {
				regex = new RegExp(query, caseSensitive ? 'g' : 'ig');
			} catch (error) {
				throw new Error(`Invalid search query regex: ${errorMessage(error)}`);
			}

			for await (const entry of entries) {
				if (count >= pageSize) break;

				// Skip directories for content search
				if (!entry.isFile) continue;

				// Create resource metadata
				//const relativePath = await absolutePathToResource(this.rootPath, entry.path);

				const resourceMetadata = await getFileMetadata(
					this.rootPath,
					entry.path,
				);

				// Create URI for this resource
				//const uri =
				//	`${this.connection.accessMethod}+${this.connection.providerType}+${this.connection.name}://${relativePath}`;

				// Perform content search
				try {
					// Skip binary files
					if (
						resourceMetadata.mimeType?.startsWith('image/') ||
						resourceMetadata.mimeType?.startsWith('audio/') ||
						resourceMetadata.mimeType?.startsWith('video/')
					) {
						continue;
					}

					// Read file content
					const content = await Deno.readTextFile(entry.path);

					// Check for matches
					const contentMatches = content.match(regex);
					if (contentMatches) {
						// Extract snippets around matches
						const snippets: string[] = [];
						let match;
						regex.lastIndex = 0; // Reset regex index

						while ((match = regex.exec(content)) !== null && snippets.length < 5) {
							const matchIndex = match.index;
							const snippetStart = Math.max(0, matchIndex - 40);
							const snippetEnd = Math.min(content.length, matchIndex + match[0].length + 40);

							let snippet = content.substring(snippetStart, snippetEnd);
							// Add ellipsis if truncated
							if (snippetStart > 0) snippet = '...' + snippet;
							if (snippetEnd < content.length) snippet = snippet + '...';

							snippets.push(snippet);
						}

						matches.push({
							resource: resourceMetadata,
							snippets,
							score: 1.0, // Simple scoring for now
						});

						count++;
					}
				} catch (error) {
					logger.warn(`FilesystemAccessor: Error searching file ${entry.path}: ${errorMessage(error)}`);
					// Continue with next file
				}
			}

			return {
				matches,
				totalMatches: matches.length,
			};
		} catch (error) {
			logger.error(`FilesystemAccessor: Error searching resources`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to search resources: ${errorMessage(error)}`,
				{
					name: 'search-resources',
					filePath: options.path || '.',
					operation: 'search-project',
				} as FileHandlingErrorOptions,
			);
		}
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
		content: string | Uint8Array,
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
					ErrorType.FileHandling,
					`File already exists and overwrite is false: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'write',
					} as FileHandlingErrorOptions,
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
			logger.error(`FilesystemAccessor: Error writing resource ${resourceUri}`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to write resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'write',
				} as FileHandlingErrorOptions,
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
					ErrorType.FileHandling,
					`Source file not found: ${sourcePath}`,
					{
						filePath: sourcePath,
						operation: 'move',
					} as FileHandlingErrorOptions,
				);
			}

			// Check if destination file exists
			const destExists = await safeExists(destAbsFile);

			// Check overwrite option
			if (destExists && options.overwrite === false) {
				throw createError(
					ErrorType.FileHandling,
					`Destination file already exists and overwrite is false: ${destFile}`,
					{
						filePath: destPath,
						operation: 'move',
					} as FileHandlingErrorOptions,
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
			logger.error(`FilesystemAccessor: Error moving resource ${sourceUri} to ${destinationUri}`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to move resource: ${errorMessage(error)}`,
				{
					filePath: sourceUri,
					operation: 'move',
				} as FileHandlingErrorOptions,
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
					ErrorType.FileHandling,
					`Resource not found: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'delete',
					} as FileHandlingErrorOptions,
				);
			}

			const { isDirectory } = await getFileMetadata(
				this.rootPath,
				resourcePath,
			);

			// Handle based on resource type
			if (isDirectory && options.recursive !== true) {
				throw createError(
					ErrorType.FileHandling,
					`Cannot delete directory without recursive option: ${resourcePath}`,
					{
						filePath: resourcePath,
						operation: 'delete',
					} as FileHandlingErrorOptions,
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
			logger.error(`FilesystemAccessor: Error deleting resource ${resourceUri}`, error);
			if (isFileHandlingError(error)) {
				throw error; // Re-throw our custom errors
			}
			throw createError(
				ErrorType.FileHandling,
				`Failed to delete resource: ${errorMessage(error)}`,
				{
					filePath: resourceUri,
					operation: 'delete',
				} as FileHandlingErrorOptions,
			);
		}
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
}
