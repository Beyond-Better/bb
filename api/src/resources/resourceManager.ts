/**
 * ResourceManager using the new data source architecture.
 * Direct replacement for the existing ResourceManager.
 */
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/editor/projectEditor.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import { getDataSourceFactory } from 'api/dataSources/dataSourceFactory.ts';
import { parseDataSourceUri } from 'shared/dataSource.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { DataSourceHandlingErrorOptions, ResourceHandlingErrorOptions } from 'api/errors/error.ts';
import type { ResourceType } from 'api/types.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';
import type { TabularSheet } from 'api/types/tabular.ts';
//import type { DataSourceAccessMethod } from 'shared/types/dataSource.ts';
import type {
	DatasourceLoadResult,
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceListOptions,
	ResourceLoadOptions,
	ResourceMetadata,
	ResourceMoveOptions,
	ResourceMoveResult,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
} from 'shared/types/dataSourceResource.ts';

/**
 * ResourceManager class for managing resources from various data sources
 */
export class ResourceManager {
	private projectEditorRef!: WeakRef<ProjectEditor>;
	private mcpManager!: MCPManager;
	private resourceMetadata: Map<string, ResourceMetadata> = new Map();
	private resourceNameToIdMap: Map<string, string> = new Map();
	private accessorCache: Map<string, ResourceAccessor> = new Map();

	/**
	 * Create a new ResourceManager
	 * @param projectEditor The ProjectEditor instance
	 */
	constructor(projectEditor: ProjectEditor & { projectInfo: ProjectInfo }) {
		this.projectEditorRef = new WeakRef(projectEditor);
	}

	/**
	 * Initialize the ResourceManager
	 */
	async init(): Promise<ResourceManager> {
		this.mcpManager = await getMCPManager();
		await this.loadMCPResourcesMetadata(await this.mcpManager.getServers());
		return this;
	}

	/**
	 * Get the ProjectEditor instance
	 */
	private get projectEditor(): ProjectEditor {
		const projectEditor = this.projectEditorRef.deref();
		if (!projectEditor) throw new Error('No projectEditor to deref from projectEditorRef');
		return projectEditor;
	}

	/**
	 * Load metadata about MCP resources
	 * @param serverIds Array of MCP server IDs
	 */
	private async loadMCPResourcesMetadata(serverIds: string[]): Promise<void> {
		try {
			logger.debug(`ResourceManager: Loading resources from ${serverIds.length} MCP servers`);

			// For each MCP server (keyed by mcpServerConfig.id), load its resources
			for (const serverId of serverIds) {
				const mcpResources = await this.mcpManager!.listResources(serverId);
				const mcpServerConfig = this.mcpManager!.getMCPServerConfiguration(serverId);
				if (!mcpServerConfig) {
					logger.error(`ResourceManager: Error loading MCP config for: ${serverId}`);
					continue;
				}

				// Register each resource with a unique ID
				for (const mcpResource of mcpResources) {
					const resourceId = `mcp+${serverId}+${mcpResource.name}`;
					const displayName = `${mcpResource.name}_${mcpServerConfig.name || mcpServerConfig.id}`;
					const llmResourceName = `${mcpResource.name}_${mcpServerConfig.id}`;

					// Add the MCP resource metadata
					this.resourceMetadata.set(resourceId, {
						name: llmResourceName, // LLM will see and use this name
						description: `${mcpResource.description || `MCP Resource ${displayName}`} (${
							mcpServerConfig.name || mcpServerConfig.id
						})`,
						uri: mcpResource.uri,
						uriTemplate: mcpResource.uriTemplate,
						mimeType: mcpResource.mimeType,
						accessMethod: 'mcp',
						type: 'mcp',
						contentType: mcpResource.mimeType.startsWith('image/') ? 'image' : 'text',
						lastModified: new Date(),
						mcpData: {
							serverId,
							resourceId,
							resourceName: mcpResource.name || displayName, // server's internal resource name (same across server instances)
							description: mcpResource.description || 'MCP Resource',
						},
					});

					// Create reverse mapping from display name to internal ID
					this.resourceNameToIdMap.set(llmResourceName, resourceId);
				}
			}
		} catch (error) {
			logger.error(`ResourceManager: Error loading MCP resources: ${errorMessage(error)}`);
		}
	}

	/**
	 * Get a ResourceAccessor for a data source connection
	 * @param dsConnectionId The ID of the data source
	 * @returns A ResourceAccessor instance
	 */
	private async getResourceAccessor(dsConnectionId: string): Promise<ResourceAccessor> {
		// Check if we already have a cached accessor
		if (this.accessorCache.has(dsConnectionId)) {
			return this.accessorCache.get(dsConnectionId)!;
		}

		// Get the data source connection
		const dsConnection = this.projectEditor.projectData.getDsConnection(dsConnectionId);
		if (!dsConnection) {
			throw createError(ErrorType.DataSourceHandling, `Data source not found: ${dsConnectionId}`, {
				name: 'get-accessor',
				dsConnectionIds: [dsConnectionId],
			} as DataSourceHandlingErrorOptions);
		}

		// Create a DataSourceConnection from the legacy DataSource
		const factory = await getDataSourceFactory();
		const registry = await getDataSourceRegistry();

		// Find the appropriate provider
		const provider = registry.getProvider(dsConnection.providerType, dsConnection.accessMethod);
		if (!provider) {
			throw createError(ErrorType.DataSourceHandling, `Provider not found for data source: ${dsConnectionId}`, {
				name: 'get-accessor',
				dsConnectionIds: [dsConnectionId],
			} as DataSourceHandlingErrorOptions);
		}

		// Create a connection from the legacy DataSource
		const connection: DataSourceConnection = registry.createConnection(
			provider,
			dsConnection.name,
			dsConnection.config,
			{
				id: dsConnection.id,
				enabled: dsConnection.enabled,
				isPrimary: dsConnection.isPrimary,
				priority: dsConnection.priority,
				auth: dsConnection.auth,
				projectConfig: this.projectEditor.projectConfig,
			},
		);

		// Get an accessor for the connection
		const accessor = await factory.getAccessor(connection);

		// Cache the accessor
		this.accessorCache.set(dsConnectionId, accessor);

		return accessor;
	}

	/**
	 * Get a ResourceAccessor for a URI
	 * @param uri The URI to get an accessor for
	 * @returns A ResourceAccessor instance
	 */
	private async getAccessorForUri(uri: string): Promise<ResourceAccessor> {
		const parsedUri = parseDataSourceUri(uri);
		if (!parsedUri) {
			throw new Error(`Invalid resource URI: ${uri}`);
		}

		const dsConnection = this.projectEditor.getDsConnectionForPrefix(parsedUri.uriPrefix);
		if (!dsConnection) {
			throw new Error(`No data source found for: ${parsedUri.uriPrefix}`);
		}

		return this.getResourceAccessor(dsConnection.id);
	}

	/**
	 * Load a resource using the new data source architecture
	 * @param resourceUri The URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource content and metadata
	 */
	async loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<{
		content: string | Uint8Array;
		metadata: ResourceMetadata;
		truncated?: boolean;
	}> {
		try {
			//logger.info(`ResourceManager: Getting accessor for: ${resourceUri}`);
			const accessor = await this.getAccessorForUri(resourceUri);
			const result = await accessor.loadResource(resourceUri, options);

			// Convert the data source architecture metadata to ResourceManager metadata
			const metadata: ResourceMetadata = {
				accessMethod: accessor.accessMethod,
				type: result.metadata.type as ResourceType,
				contentType: result.metadata.mimeType?.startsWith('image/') ? 'image' : 'text',
				name: `URI: ${resourceUri}`,
				uri: resourceUri,
				mimeType: result.metadata.mimeType || 'application/octet-stream',
				size: result.metadata.size,
				lastModified: result.metadata.lastModified instanceof Date
					? result.metadata.lastModified
					: new Date(result.metadata.lastModified),
			};

			return {
				content: result.content,
				metadata,
				truncated: result.isPartial,
			};
		} catch (error) {
			logger.error(`ResourceManager: Error loading resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(ErrorType.ResourceHandling, `Failed to load resource: ${errorMessage(error)}`, {
				filePath: resourceUri,
				operation: 'read',
			} as ResourceHandlingErrorOptions);
		}
	}

	/**
	 * List resources from a data source
	 * @param dsConnectionId The ID of the data source
	 * @param options Options for listing resources
	 * @returns A list of resources
	 */
	async listResources(dsConnectionId: string, options?: ResourceListOptions): Promise<DatasourceLoadResult> {
		try {
			// Get the appropriate accessor for this data source
			const accessor = await this.getResourceAccessor(dsConnectionId);

			// Check if the accessor supports listing
			if (!accessor.hasCapability('list')) {
				throw createError(
					ErrorType.DataSourceHandling,
					`Data source does not support listing: ${dsConnectionId}`,
					{
						name: 'list-resources',
						dsConnectionIds: [dsConnectionId],
					} as DataSourceHandlingErrorOptions,
				);
			}

			// Use the accessor to list resources
			const result = await accessor.listResources(options);

			// Convert the data source architecture resources to ResourceManager resources
			const resources: ResourceMetadata[] = result.resources.map((resource) => ({
				name: resource.name || resource.uri.split('/').pop() || resource.uri,
				uri: resource.uri,
				accessMethod: accessor.accessMethod,
				type: resource.type as ResourceType,
				extraType: resource.extraType || 'file',
				mimeType: resource.mimeType || 'application/octet-stream',
				contentType: resource.mimeType?.startsWith('image/') ? 'image' : 'text',
				size: resource.size,
				lastModified: resource.lastModified,
				description: `${resource.extraType === 'directory' ? 'Directory' : 'File'}`,
			}));

			return {
				resources,
				pagination: result.nextPageToken ? { nextPageToken: result.nextPageToken } : undefined,
			};
		} catch (error) {
			logger.error(`ResourceManager: Error listing resources for ${dsConnectionId}: ${errorMessage(error)}`);
			throw createError(ErrorType.DataSourceHandling, `Failed to list resources: ${errorMessage(error)}`, {
				name: 'list-resources',
				dsConnectionIds: [dsConnectionId],
			} as DataSourceHandlingErrorOptions);
		}
	}

	/**
	 * Search resources
	 * @param dsConnectionId The ID of the data source
	 * @param query The search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	async searchResources(
		dsConnectionId: string,
		query: string,
		options?: ResourceSearchOptions,
	): Promise<ResourceSearchResult> {
		try {
			// Get the appropriate accessor for this data source
			const accessor = await this.getResourceAccessor(dsConnectionId);

			// Check if the accessor supports searching
			if (!accessor.hasCapability('search')) {
				throw createError(
					ErrorType.DataSourceHandling,
					`Data source does not support searching: ${dsConnectionId}`,
					{
						name: 'search-resources',
						dsConnectionIds: [dsConnectionId],
					} as DataSourceHandlingErrorOptions,
				);
			}

			// Use the accessor to search resources
			return await accessor.searchResources!(query, options);
		} catch (error) {
			logger.error(
				`ResourceManager: Error searching resources for ${dsConnectionId}: ${errorMessage(error)}`,
			);
			throw createError(ErrorType.DataSourceHandling, `Failed to search resources: ${errorMessage(error)}`, {
				name: 'search-resources',
				dsConnectionIds: [dsConnectionId],
			} as DataSourceHandlingErrorOptions);
		}
	}

	/**
	 * Write a resource
	 * @param resourceUri The URI of the resource to write
	 * @param content The content to write
	 * @param options Options for writing
	 * @returns The result of the write operation
	 */
	async writeResource(
		resourceUri: string,
		content: string | Uint8Array | Array<PortableTextBlock> | Array<TabularSheet>,
		options?: ResourceWriteOptions,
	): Promise<ResourceWriteResult> {
		try {
			// Get the appropriate accessor for this URI
			const accessor = await this.getAccessorForUri(resourceUri);

			// Check if the accessor supports writing
			if (!accessor.hasCapability('write')) {
				throw createError(ErrorType.DataSourceHandling, `Data source does not support writing`, {
					name: 'write-resource',
					filePath: resourceUri,
				} as ResourceHandlingErrorOptions);
			}

			// Use the accessor to write the resource
			return await accessor.writeResource!(resourceUri, content, options);
		} catch (error) {
			logger.error(`ResourceManager: Error writing resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(ErrorType.ResourceHandling, `Failed to write resource: ${errorMessage(error)}`, {
				filePath: resourceUri,
				operation: 'write',
			} as ResourceHandlingErrorOptions);
		}
	}

	/**
	 * Move a resource
	 * @param sourceUri The source URI
	 * @param destinationUri The destination URI
	 * @param options Options for moving
	 * @returns The result of the move operation
	 */
	async moveResource(
		sourceUri: string,
		destinationUri: string,
		options?: ResourceMoveOptions,
	): Promise<ResourceMoveResult> {
		try {
			// Get the appropriate accessor for the source URI
			const accessor = await this.getAccessorForUri(sourceUri);

			// Check if the accessor supports moving
			if (!accessor.hasCapability('move')) {
				throw createError(ErrorType.DataSourceHandling, `Data source does not support moving`, {
					name: 'move-resource',
					filePath: sourceUri,
				} as ResourceHandlingErrorOptions);
			}

			// Use the accessor to move the resource
			return await accessor.moveResource!(sourceUri, destinationUri, options);
		} catch (error) {
			logger.error(`ResourceManager: Error moving resource ${sourceUri}: ${errorMessage(error)}`);
			throw createError(ErrorType.ResourceHandling, `Failed to move resource: ${errorMessage(error)}`, {
				filePath: sourceUri,
				operation: 'move',
			} as ResourceHandlingErrorOptions);
		}
	}

	/**
	 * Delete a resource
	 * @param resourceUri The URI of the resource to delete
	 * @param options Options for deletion
	 * @returns The result of the delete operation
	 */
	async deleteResource(resourceUri: string, options?: ResourceDeleteOptions): Promise<ResourceDeleteResult> {
		try {
			// Get the appropriate accessor for this URI
			const accessor = await this.getAccessorForUri(resourceUri);

			// Check if the accessor supports deletion
			if (!accessor.hasCapability('delete')) {
				throw createError(ErrorType.DataSourceHandling, `Data source does not support deletion`, {
					name: 'delete-resource',
					filePath: resourceUri,
				} as ResourceHandlingErrorOptions);
			}

			// Use the accessor to delete the resource
			return await accessor.deleteResource!(resourceUri, options);
		} catch (error) {
			logger.error(`ResourceManager: Error deleting resource ${resourceUri}: ${errorMessage(error)}`);
			throw createError(ErrorType.ResourceHandling, `Failed to delete resource: ${errorMessage(error)}`, {
				filePath: resourceUri,
				operation: 'delete',
			} as ResourceHandlingErrorOptions);
		}
	}
}
