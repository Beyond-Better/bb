import { walk } from '@std/fs';
import type { WalkOptions } from '@std/fs';
import { contentType } from '@std/media-types';
import { join, relative } from '@std/path';
//import type { Resource } from 'api/types.ts';
import {
	type FileLoadOptions,
	getFileMetadata,
	IMAGE_DISPLAY_LIMIT,
	readFileWithOptions,
	TEXT_DISPLAY_LIMIT,
} from 'api/utils/fileHandling.ts';
import { logger } from 'shared/logger.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
//import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
//import type { ReadResourceResultSchema } from 'mcp/types.js';
import {
	createExcludeRegexPatterns,
	existsWithinDataSource,
	getExcludeOptions,
	isPathWithinDataSource,
} from 'api/utils/fileHandling.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions } from 'api/errors/error.ts';
import type { ResourceType } from 'api/types.ts';
import type { DataSource, DataSourceAccessMethod } from 'api/resources/dataSource.ts';
import { generateDataSourcePrefix, parseDataSourceUri, parsePreservingRelative } from 'shared/dataSource.ts';

export interface ResourceMCPConfig {
	serverId: string; // set in config as mcpServer[x].id
	resourceId: string; // `mcp:${serverId}:${mcpResource.name}` - mcpResource.name is server's internal resource name
	resourceName: string; // set in config as mcpServer[x].name (use id if name not set) - this is name the LLM sees
	description: string;
}

export interface ResourceForConversation {
	resourceName: string;
	resourceUri: string;
	//metadata: Omit<ResourceMetadata, 'uri'>;
	metadata: ResourceRevisionMetadata;
}

export type ResourcesForConversation = Array<ResourceForConversation>;

export interface ResourceMetadata {
	accessMethod?: DataSourceAccessMethod;
	type: ResourceType;
	contentType: 'text' | 'image';
	name: string;
	description?: string;
	messageId?: string;
	uri: string;
	uriTemplate?: string;
	mimeType: string;
	size?: number;
	lastModified?: Date;
	error?: string | null;
	mcpData?: ResourceMCPConfig;
}

export interface ResourceRevisionMetadata {
	accessMethod?: DataSourceAccessMethod;
	type: ResourceType;
	contentType: 'text' | 'image';
	mimeType?: string; //LLMMessageContentPartImageBlockSourceMediaType;
	name?: string;
	uri?: string;
	size: number;
	lastModified: Date;
	messageId?: string; // also used as revisionId
	toolUseId?: string;
	lastCommit?: string;
	error?: string | null;
}

export type ConversationResourcesMetadata = Record<string, ResourceRevisionMetadata>;

/*
export interface MCPResourceMetadata extends ResourceMetadata {
	type: 'mcp';
	version: string;
	author: string;
	//license: string;
	category?: string | string[];
	config?: unknown;
	//mcpData?: ResourceMCPConfig;
	//examples?: Array<{ description: string; input: unknown }>;
}
 */

export interface ResourceListItem {
	name: string;
	uri: string;
	uriTerm?: string; // term value used for expression in URI template
	uriTemplate?: string;
	type: ResourceType;
	accessMethod: DataSourceAccessMethod;
	extraType?: string;
	mimeType: string;
	//path?: string; // use uriTerm instead
	size?: number;
	lastModified?: Date | string;
	description?: string;
}

export interface PaginationInfo {
	nextPageToken?: string;
	totalCount?: number;
	pageSize?: number;
	currentPage?: number;
}

export interface LoadDatasourceResult {
	resources: ResourceListItem[];
	uriTemplate?: string;
	pagination?: PaginationInfo;
}

export class ResourceManager {
	private projectEditorRef!: WeakRef<ProjectEditor>;
	private mcpManager!: MCPManager;
	private resourceMetadata: Map<string, ResourceMetadata> = new Map();
	private resourceNameToIdMap: Map<string, string> = new Map();

	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
	}
	async init(): Promise<ResourceManager> {
		this.mcpManager = await getMCPManager();
		await this.loadMCPResourcesMetadata(await this.mcpManager.getServers());
		return this;
	}

	private get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	private async loadMCPResourcesMetadata(serverIds: string[]): Promise<void> {
		try {
			logger.debug(`ResourceManager: Loading resources from ${serverIds.length} MCP servers`);

			// For each MCP server (keyed by mcpServerConfig.id), load its resources
			for (const serverId of serverIds) {
				const mcpResources = await this.mcpManager!.listResources(serverId);
				const mcpServerConfig = this.mcpManager!.getMCPServerConfiguration(serverId);
				//logger.info(`ResourceManager: Found ${mcpResources.length} resources in MCP server ${serverId}`);
				if (!mcpServerConfig) {
					logger.error(`ResourceManager: Error loading MCP config for: ${serverId}`);
					continue;
				}

				// Register each resource with a unique ID
				for (const mcpResource of mcpResources) {
					const resourceId = generateDataSourcePrefix('mcp', serverId, mcpResource.name); //`mcp:${serverId}+${mcpResource.name}`;
					const displayName = `${mcpResource.name}_${mcpServerConfig.name || mcpServerConfig.id}`;
					const llmResourceName = `${mcpResource.name}_${mcpServerConfig.id}`;

					// Add the MCP resource metadata
					this.resourceMetadata.set(resourceId, {
						name: llmResourceName, // LLM will see and use this name
						description: `${mcpResource.description || `MCP Resource ${displayName}`} (${
							mcpServerConfig.name || mcpServerConfig.id
						})`,
						//version: '1.0.0',
						//author: 'MCP Server',
						uri: mcpResource.uri,
						uriTemplate: mcpResource.uriTemplate,
						mimeType: mcpResource.mimeType,
						accessMethod: 'mcp',
						type: 'mcp',
						contentType: mcpResource.mimeType.startsWith('image/') ? 'image' : 'text',
						mcpData: {
							serverId,
							resourceId,
							resourceName: mcpResource.name, // server's internal resource name (same across server instances)
							description: mcpResource.description || 'MCP Resource',
						},
					});
					// logger.info(
					// 	`ResourceManager: Registered MCP resource ${mcpResource.name} from server ${serverId}`,
					// 	this.resourceMetadata.get(resourceId),
					// );

					// Create reverse mapping from display name to internal ID
					this.resourceNameToIdMap.set(llmResourceName, resourceId);

					//logger.debug(`ResourceManager: Registered MCP resource ${mcpResource.name} from server ${serverId}`);
				}
			}
		} catch (error) {
			logger.error(`ResourceManager: Error loading MCP resources: ${(error as Error).message}`);
		}
	}

	async loadResource(
		resourceUri: string,
		options?: FileLoadOptions,
	): Promise<{ content: string | Uint8Array; metadata: ResourceMetadata; truncated?: boolean }> {
		const {
			uriPrefix,
			accessMethod,
			//dataSourceType,
			//dataSourceName,
			originalUri,
			resourceType,
		} = parseDataSourceUri(resourceUri);

		const dataSource = this.projectEditor.getDataSourceForPrefix(uriPrefix);
		if (!dataSource) throw new Error(`No data source found for: ${uriPrefix}`);

		if (accessMethod === 'mcp') return this.loadMcpResource(dataSource, originalUri, options);
		switch (resourceType) {
			case 'file':
				return this.loadFileResource(dataSource, originalUri, options);
			case 'url':
				return this.loadUrlResource(dataSource, originalUri, options);
			case 'memory':
				return this.loadMemoryResource(dataSource, originalUri, options);
			case 'api':
				return this.loadApiResource(dataSource, originalUri, options);
			case 'database':
				return this.loadDatabaseResource(dataSource, originalUri, options);
			case 'vector_search':
				return this.loadVectorSearchResource(dataSource, originalUri, options);
			default:
				throw new Error(`Unsupported resource type: ${resourceType}`);
		}
	}

	// [TODO] refactor to get mcp server details via datasource
	private async loadMcpResource(
		_dataSource: DataSource,
		uri: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		// Check if this is an aliased name that maps to an internal ID
		const resourceId = this.resourceNameToIdMap.get(uri);
		const emptyContent = {
			content: '',
			metadata: {
				type: 'mcp',
				contentType: 'text',
				name: `MCP: ${uri}`,
				uri: uri,
				mimeType: 'text/plain',
				size: 0,
			} as ResourceMetadata,
		};
		if (!resourceId) {
			logger.warn(`ResourceManager: Resource ID for URI ${uri} not found`);
			return emptyContent;
		}

		const metadata = this.resourceMetadata.get(resourceId);
		if (!metadata) {
			logger.warn(`ResourceManager: Resource for ${uri} not found`);
			return emptyContent;
		}
		if (!metadata.mcpData?.serverId) {
			logger.warn(`ResourceManager: Resource for ${uri} has no serverId`);
			return emptyContent;
		}

		const mcpResources = await this.mcpManager!.loadResource(metadata.mcpData.serverId, metadata.uri);
		const mcpResource = mcpResources.contents[0];

		return {
			content: mcpResource.text as string,
			metadata: {
				type: 'mcp',
				contentType: mcpResource.mimeType?.startsWith('image/') ? 'image' : 'text',
				name: `MCP: ${uri}`,
				uri: uri,
				mimeType: mcpResource.mimeType || 'text/plain',
				//size: mcpResource.size ? parseInt(mcpResource.size) : (mcpResource.text?.length || 0),
				//size: mcpResource.text?.length || 0,
			},
		};
	}

	private async loadUrlResource(
		_dataSource: DataSource,
		url: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Failed to fetch URL: ${url}`);
		}
		const content = await response.text();
		const contentType = response.headers.get('content-type');
		const contentLength = response.headers.get('content-length');

		return {
			content,
			metadata: {
				accessMethod: 'bb',
				type: 'url',
				contentType: contentType?.startsWith('image/') ? 'image' : 'text',
				name: `URL: ${url}`,
				uri: url,
				mimeType: contentType || 'text/plain',
				size: contentLength ? parseInt(contentLength) : content.length,
			},
		};
	}

	private async loadFileResource(
		dataSource: DataSource,
		uri: string,
		options?: FileLoadOptions,
	): Promise<{ content: string | Uint8Array; metadata: ResourceMetadata; truncated?: boolean }> {
		logger.info(`ResourceManager: Getting path from ${uri}`);
		// // We are assuming uri is always a relative path; we shouldn't!!
		// const path = fromFileUrl(uri).replace(/^\//, ''); // path returned from fromFileUrl starts with slash, so remove it
		// // or if windows path with Drive letters
		// //const path = fromFileUrl(uri).replace(/^\/([A-Z]:)/, '$1');
		const { pathname: path } = parsePreservingRelative(uri);
		logger.info(`ResourceManager: Got path ${path}`);
		try {
			if (!dataSource.dataSourceRoot) {
				throw new Error(`Loading File Resource Failed: data source root found`);
			}
			const fileRoot = dataSource.dataSourceRoot;
			if (!await isPathWithinDataSource(fileRoot, path)) {
				throw new Error(`Access denied: ${path} is outside the data source directory`);
			}
			if (!await existsWithinDataSource(fileRoot, path)) {
				throw new Error(`Access denied: ${path} does not exist in the project directory`);
			}

			// Get file metadata first
			const metadata = await getFileMetadata(fileRoot, path);
			const isImage = metadata.mimeType.startsWith('image/');

			// Set default size limits if not provided
			const loadOptions: FileLoadOptions = {
				maxSize: isImage ? IMAGE_DISPLAY_LIMIT : TEXT_DISPLAY_LIMIT,
				...options,
			};

			// Read file with options
			const { content, truncated } = await readFileWithOptions(
				fileRoot,
				path,
				loadOptions,
			);

			return {
				content,
				metadata: {
					accessMethod: 'bb',
					type: 'file',
					contentType: metadata.mimeType?.startsWith('image/') ? 'image' : 'text',
					name: `File: ${path}`,
					uri: `file:./${path}`,
					//path,
					mimeType: metadata.mimeType || 'application/octet-stream',
					size: metadata.size,
					lastModified: metadata.lastModified,
				},
				truncated,
			};
		} catch (error) {
			logger.error(`ResourceManager: Failed to read file: ${path}. ${(error as Error).message}`);
			throw new Error(`Failed to read file: ${path}. ${(error as Error).message}`);
		}
	}

	private async loadMemoryResource(
		_dataSource: DataSource,
		key: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		// Implement memory resource loading logic
		return {
			content: 'Memory resource loading not implemented yet',
			metadata: {
				accessMethod: 'bb',
				type: 'memory',
				contentType: 'text',
				name: `Memory: ${key}`,
				uri: `memory://${key}`,
				//path: key,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadApiResource(
		_dataSource: DataSource,
		endpoint: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		// Implement API resource loading logic
		return {
			content: 'API resource loading not implemented yet',
			metadata: {
				accessMethod: 'bb',
				type: 'api',
				contentType: 'text',
				name: `API: ${endpoint}`,
				uri: `api://${endpoint}`,
				//path: endpoint,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadDatabaseResource(
		_dataSource: DataSource,
		query: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		// Implement database resource loading logic
		return {
			content: 'Database resource loading not implemented yet',
			metadata: {
				accessMethod: 'bb',
				type: 'database',
				contentType: 'text',
				name: `Database Query: ${query}`,
				uri: `db-query://${query}`,
				//path: query,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	private async loadVectorSearchResource(
		_dataSource: DataSource,
		query: string,
		_options?: FileLoadOptions,
	): Promise<{ content: string; metadata: ResourceMetadata; truncated?: boolean }> {
		// Implement vector search resource loading logic
		return {
			content: 'Vector search resource loading not implemented yet',
			metadata: {
				accessMethod: 'bb',
				type: 'vector_search',
				contentType: 'text',
				name: `Vector Query: ${query}`,
				uri: `vector://${query}`,
				//path: query,
				mimeType: 'text/plain',
				size: 0,
			},
		};
	}

	/**
	 * List resources from a filesystem data source
	 */
	async listFilesystem(
		dataSourceRoot: string,
		options?: {
			path?: string;
			depth?: number;
			pageSize?: number;
			pageToken?: string;
		},
	): Promise<LoadDatasourceResult> {
		const {
			path = '',
			depth = 1,
			pageSize = 100,
			pageToken,
		} = options || {};

		try {
			// Get exclude patterns similar to how generateFileListingTier does it
			const excludeOptions = await getExcludeOptions(dataSourceRoot);
			const excludeOptionsRegex = createExcludeRegexPatterns(excludeOptions, dataSourceRoot);

			// Determine the base directory to search in
			const baseDir = path ? join(dataSourceRoot, path) : dataSourceRoot;

			// Configure walk options
			const walkOptions: WalkOptions = {
				maxDepth: depth,
				includeDirs: true, // Include directories as well as files
				includeSymlinks: false,
				skip: excludeOptionsRegex,
			};

			const resources: ResourceListItem[] = [];
			let currentIndex = 0;
			const startIndex = pageToken ? parseInt(pageToken, 10) : 0;

			// Walk the file system
			for await (const entry of walk(baseDir, walkOptions)) {
				// Skip entries until we reach our pagination starting point
				if (currentIndex < startIndex) {
					currentIndex++;
					continue;
				}

				// Stop if we've reached the page size limit
				if (resources.length >= pageSize) {
					break;
				}

				// Get relative path from the data source root
				const relativePath = relative(dataSourceRoot, entry.path);

				// Gather metadata for the resource
				try {
					const stat = await Deno.stat(entry.path);
					const isDirectory = stat.isDirectory;
					const mimeType = isDirectory
						? 'application/directory'
						: (contentType(entry.name) || 'application/octet-stream');

					// Build the resource item
					const resource: ResourceListItem = {
						name: entry.name,
						uri: `file:./${relativePath}`,
						accessMethod: 'bb',
						type: 'file',
						extraType: isDirectory ? 'directory' : 'file',
						mimeType,
						description: isDirectory ? 'Directory' : 'File',
					};

					// Add additional metadata if available
					if (!isDirectory) {
						resource.size = stat.size;
					}
					if (stat.mtime) {
						resource.lastModified = stat.mtime.toISOString();
					}

					resources.push(resource);
				} catch (error) {
					logger.warn(
						`ResourceManager: Error getting metadata for ${entry.path}: ${(error as Error).message}`,
					);
					// Still include the file even if we can't get all metadata
					resources.push({
						name: entry.name,
						uri: `file:./${relativePath}`,
						accessMethod: 'bb',
						type: 'file',
						extraType: 'file',
						mimeType: 'application/octet-stream',
						description: 'File (metadata unavailable)',
					});
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
				`ResourceManager: Error listing filesystem at ${dataSourceRoot}/${path}: ${(error as Error).message}`,
			);
			throw createError(ErrorType.FileHandling, `Failed to list files: ${(error as Error).message}`, {
				name: 'list-filesystem',
				path,
			});
		}
	}

	/**
	 * Generic method to list resources from any data source
	 */
	async listResources(
		dataSourceId: string,
		options?: {
			path?: string;
			depth?: number;
			pageSize?: number;
			pageToken?: string;
		},
	): Promise<LoadDatasourceResult> {
		// Find the data source
		const dataSource = this.projectEditor.projectData.getDataSource(dataSourceId);
		if (!dataSource) {
			throw createError(ErrorType.DataSourceHandling, `Data source not found: ${dataSourceId}`, {
				name: 'list-resources',
				dataSourceIds: [dataSourceId],
			} as DataSourceHandlingErrorOptions);
		}

		// Check if data source supports listing
		if (!dataSource.canList()) {
			throw createError(ErrorType.DataSourceHandling, `Data source does not support listing: ${dataSourceId}`, {
				name: 'list-resources',
				dataSourceIds: [dataSourceId],
			} as DataSourceHandlingErrorOptions);
		}

		// Delegate to appropriate handler based on data source type
		if (dataSource.type === 'filesystem') {
			const dataSourceRoot = dataSource.getDataSourceRoot();
			if (!dataSourceRoot) {
				throw createError(ErrorType.DataSourceHandling, `Data source has no root path: ${dataSourceId}`, {
					name: 'list-resources',
					dataSourceIds: [dataSourceId],
				} as DataSourceHandlingErrorOptions);
			}
			return this.listFilesystem(dataSourceRoot, options);
		} else if (dataSource.accessMethod === 'mcp') {
			// For MCP data sources, we already have all resources loaded in memory
			// from loadMCPResourcesMetadata, so we can just filter and paginate them
			const resources = this.getMCPResources(dataSource.type, options?.path);

			const pageSize = options?.pageSize || 100;
			const startIndex = options?.pageToken ? parseInt(options.pageToken, 10) : 0;
			const paginatedResources = resources.slice(startIndex, startIndex + pageSize);

			let pagination: PaginationInfo | undefined;
			if (paginatedResources.length === pageSize && startIndex + pageSize < resources.length) {
				pagination = {
					nextPageToken: (startIndex + pageSize).toString(),
				};
			}

			return {
				resources: paginatedResources,
				pagination,
			};
		}
		logger.info(`ResourceManager: Unable to list resources for datasource: ${dataSource.id}`, { dataSource });

		throw createError(ErrorType.DataSourceHandling, `Unsupported data source type: ${dataSource.type}`, {
			name: 'list-resources',
			dataSourceIds: [dataSourceId],
		} as DataSourceHandlingErrorOptions);
	}

	// Helper method to get MCP resources for a specific server with optional path filtering
	private getMCPResources(mcpServerId: string, path?: string): ResourceListItem[] {
		const resources: ResourceListItem[] = [];

		for (const [_id, metadata] of this.resourceMetadata.entries()) {
			if (metadata.accessMethod === 'mcp' && metadata.mcpData?.serverId === mcpServerId) {
				// Apply path filtering if specified
				if (path && !metadata.mcpData.resourceName.startsWith(path)) {
					continue;
				}

				resources.push({
					name: metadata.name,
					uri: metadata.uri,
					accessMethod: 'mcp',
					type: 'mcp',
					mimeType: metadata.mimeType || 'text/plain',
					description: metadata.description,
				});
			}
		}

		return resources;
	}
}
