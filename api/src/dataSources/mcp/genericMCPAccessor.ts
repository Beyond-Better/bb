/**
 * GenericMCPAccessor implementation for accessing MCP-managed resources.
 */
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import { MCPResourceAccessor } from '../base/mcpResourceAccessor.ts';
import { extractResourcePath } from 'shared/dataSource.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type {
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
	// ResourceMetadata,
	// ResourceSearchOptions,
	// ResourceSearchResult,
	// ResourceWriteOptions,
	// ResourceWriteResult,
	// ResourceMoveOptions,
	// ResourceMoveResult,
	// ResourceDeleteOptions,
	// ResourceDeleteResult,
} from 'shared/types/dataSourceResource.ts';
import type { DataSourceCapability, DataSourceMetadata } from 'shared/types/dataSource.ts';

/**
 * GenericMCPAccessor for accessing MCP-managed resources
 * Delegates operations to the MCPManager for communication with MCP servers
 */
export class GenericMCPAccessor extends MCPResourceAccessor {
	/**
	 * Create a new GenericMCPAccessor
	 * @param connection The data source connection to use
	 * @param mcpManager The MCPManager instance for MCP server communication
	 * @param serverId The MCP server ID (defaults to connection.providerType)
	 */
	constructor(connection: DataSourceConnection, mcpManager: MCPManager, serverId?: string) {
		super(connection, mcpManager, serverId);
		logger.debug(`GenericMCPAccessor: Created for ${connection.id} with server ${this.serverId}`);
	}

	/**
	 * Check if resource exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 * @returns boolean
	 */
	async isResourceWithinDataSource(_resourceUri: string): Promise<boolean> {
		// [TODO] we need a way to check that URI's are part of the MCP server
		// this isn't an `exists` test; it's a `within` test
		return true;
	}

	/**
	 * Check if resource exists in this data source
	 * @param resourceUri The resource URI to check
	 * @param options Optional object with additional checks
	 * @returns boolean
	 */
	async resourceExists(_resourceUri: string, _options?: { isFile?: boolean }): Promise<boolean> {
		//const resourcePath = extractResourcePath(resourceUri);
		//if (!resourcePath) return false;
		return true;
	}

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	async ensureResourcePathExists(_resourceUri: string): Promise<void> {
		//const resourcePath = extractResourcePath(resourceUri);
		//if (!resourcePath) return false;
		//const absolutePath = resourcePathToAbsolute(this.rootPath, resourcePath);
	}

	async getMetadata(): Promise<DataSourceMetadata> {
		logger.debug('GenericMCPAccessor: Getting metadata for MCP Server (not implemented)');

		const metadata: DataSourceMetadata = {
			totalResources: 0,
			resourceTypes: {},
			lastScanned: new Date().toISOString(),
		};
		return metadata;
	}

	/**
	 * Load a resource from the MCP server
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	override async loadResource(resourceUri: string, _options: ResourceLoadOptions = {}): Promise<ResourceLoadResult> {
		logger.debug(`GenericMCPAccessor: Loading resource ${resourceUri} from server ${this.serverId}`);

		try {
			// Extract the resource path from the URI
			const resourcePath = extractResourcePath(resourceUri);
			if (!resourcePath) {
				throw new Error(`Invalid resource URI: ${resourceUri}`);
			}

			// Delegate to MCPManager
			const mcpResources = await this.mcpManager.loadResource(
				this.serverId,
				resourcePath,
				//options,
			);
			const mcpResource = mcpResources.contents[0];
			const contentType = mcpResource.mimeType?.startsWith('image/') ? 'image' : 'text';
			const content = contentType === 'image' ? mcpResource.blob as Uint8Array : mcpResource.text as string;
			const contentLength = contentType === 'image' ? content.length : content.length;

			// Construct and return the result
			return {
				content,
				metadata: {
					uri: resourceUri,
					type: 'mcp',
					contentType,
					mimeType: mcpResource.mimeType || 'text/plain',
					size: contentLength,
					lastModified: new Date(),
					//lastModified: ( mcpResource.lastModified ? new Date(mcpResource.lastModified) : null ) || new Date(),
					//...result.metadata, // Include any additional metadata from the MCP server
				},
				//isPartial: result.isPartial || false,
			};
		} catch (error) {
			logger.error(
				`GenericMCPAccessor: Error loading resource ${resourceUri} from server ${this.serverId}:`,
				error,
			);
			throw new Error(`Failed to load resource: ${errorMessage(error)}`);
		}
	}

	/**
	 * List available resources from the MCP server
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	override async listResources(_options: ResourceListOptions = {}): Promise<ResourceListResult> {
		logger.debug(`GenericMCPAccessor: Listing resources from server ${this.serverId}`);

		try {
			// Delegate to MCPManager
			const mcpResources = await this.mcpManager.listResources(
				this.serverId,
				//options,
			);

			// Format resource URIs and metadata
			const resources = mcpResources.map((resource) => {
				// Ensure the URI includes the connection prefix
				const uri = resource.uri.includes('://')
					? resource.uri
					: `${this.connection.accessMethod}+${this.serverId}+${this.connection.name}://${resource.uri}`;

				return {
					...resource,
					uri,
				};
			});

			return {
				resources,
				//nextPageToken: result.nextPageToken,
				//hasMore: result.hasMore,
			};
		} catch (error) {
			logger.error(`GenericMCPAccessor: Error listing resources from server ${this.serverId}:`, error);
			throw new Error(`Failed to list resources: ${errorMessage(error)}`);
		}
	}

	//   /**",
	//    * Search for resources on the MCP server",
	//    * @param query Search query",
	//    * @param options Options for searching",
	//    * @returns Search results",
	//    */",
	//   async searchResources(query: string, options: ResourceSearchOptions = {}): Promise<ResourceSearchResult> {",
	//     logger.debug(`GenericMCPAccessor: Searching resources on server ${this.serverId} with query: ${query}`);",
	//     ",
	//     // Check if the MCP server supports search",
	//     if (!this.hasCapability('search')) {",
	//       throw new Error(`MCP server ${this.serverId} does not support resource searching`);",
	//     }",
	//     ",
	//     try {",
	//       // Delegate to MCPManager",
	//       const result = await this.mcpManager.searchResources(this.serverId, query, options);",
	//       ",
	//       // Format match URIs and metadata",
	//       const matches = result.matches.map(match => {",
	//         // Ensure the URI includes the connection prefix",
	//         const uri = match.resource.uri.includes('://') ",
	//           ? match.resource.uri ",
	//           : `${this.connection.accessMethod}+${this.serverId}+${this.connection.name}://${match.resource.uri}`;",
	//         ",
	//         return {",
	//           resource: {",
	//             ...match.resource,",
	//             uri,",
	//           },",
	//           snippets: match.snippets,",
	//           score: match.score,",
	//         };",
	//       });",
	//       ",
	//       return {",
	//         matches,",
	//         totalMatches: result.totalMatches,",
	//       };",
	//     } catch (error) {",
	//       logger.error(`GenericMCPAccessor: Error searching resources on server ${this.serverId}:`, error);",
	//       throw new Error(`Failed to search resources: ${errorMessage(error)}`);",
	//     }",
	//   }",
	// ",
	//   /**",
	//    * Write content to a resource on the MCP server",
	//    * @param resourceUri URI of the resource to write",
	//    * @param content Content to write",
	//    * @param options Options for writing",
	//    * @returns Result of the write operation",
	//    */",
	//   async writeResource(",
	//     resourceUri: string,",
	//     content: string | Uint8Array,",
	//     options: ResourceWriteOptions = {},",
	//   ): Promise<ResourceWriteResult> {",
	//     logger.debug(`GenericMCPAccessor: Writing to resource ${resourceUri} on server ${this.serverId}`);",
	//     ",
	//     // Check if the MCP server supports write",
	//     if (!this.hasCapability('write')) {",
	//       throw new Error(`MCP server ${this.serverId} does not support resource writing`);",
	//     }",
	//     ",
	//     try {",
	//       // Extract the resource path from the URI",
	//       const resourcePath = extractResourcePath(resourceUri);",
	//       if (!resourcePath) {",
	//         throw new Error(`Invalid resource URI: ${resourceUri}`);",
	//       }",
	//       ",
	//       // Delegate to MCPManager",
	//       const result = await this.mcpManager.writeResource(this.serverId, resourcePath, content, options);",
	//       ",
	//       // Construct and return the result",
	//       return {",
	//         success: result.success,",
	//         uri: resourceUri,",
	//         metadata: {",
	//           uri: resourceUri,",
	//           type: result.metadata.type || 'file',",
	//           contentType: result.metadata.contentType || 'application/octet-stream',",
	//           size: result.metadata.size,",
	//           last_modified: result.metadata.last_modified || new Date().toISOString(),",
	//           ...result.metadata, // Include any additional metadata from the MCP server",
	//         },",
	//         bytesWritten: result.bytesWritten || (typeof content === 'string' ? new TextEncoder().encode(content).length : content.length),",
	//       };",
	//     } catch (error) {",
	//       logger.error(`GenericMCPAccessor: Error writing resource ${resourceUri} on server ${this.serverId}:`, error);",
	//       throw new Error(`Failed to write resource: ${errorMessage(error)}`);",
	//     }",
	//   }",
	// ",
	//   /**",
	//    * Move a resource on the MCP server",
	//    * @param sourceUri Source resource URI",
	//    * @param destinationUri Destination resource URI",
	//    * @param options Options for moving",
	//    * @returns Result of the move operation",
	//    */",
	//   async moveResource(",
	//     sourceUri: string,",
	//     destinationUri: string,",
	//     options: ResourceMoveOptions = {},",
	//   ): Promise<ResourceMoveResult> {",
	//     logger.debug(`GenericMCPAccessor: Moving resource from ${sourceUri} to ${destinationUri} on server ${this.serverId}`);",
	//     ",
	//     // Check if the MCP server supports move",
	//     if (!this.hasCapability('move')) {",
	//       throw new Error(`MCP server ${this.serverId} does not support resource moving`);",
	//     }",
	//     ",
	//     try {",
	//       // Extract resource paths from URIs",
	//       const sourcePath = extractResourcePath(sourceUri);",
	//       const destPath = extractResourcePath(destinationUri);",
	//       ",
	//       if (!sourcePath || !destPath) {",
	//         throw new Error(`Invalid resource URI: ${!sourcePath ? sourceUri : destinationUri}`);",
	//       }",
	//       ",
	//       // Delegate to MCPManager",
	//       const result = await this.mcpManager.moveResource(this.serverId, sourcePath, destPath, options);",
	//       ",
	//       // Construct and return the result",
	//       return {",
	//         success: result.success,",
	//         sourceUri,",
	//         destinationUri,",
	//         metadata: {",
	//           uri: destinationUri,",
	//           type: result.metadata.type || 'file',",
	//           contentType: result.metadata.contentType || 'application/octet-stream',",
	//           size: result.metadata.size,",
	//           last_modified: result.metadata.last_modified || new Date().toISOString(),",
	//           ...result.metadata, // Include any additional metadata from the MCP server",
	//         },",
	//       };",
	//     } catch (error) {",
	//       logger.error(`GenericMCPAccessor: Error moving resource ${sourceUri} to ${destinationUri} on server ${this.serverId}:`, error);",
	//       throw new Error(`Failed to move resource: ${errorMessage(error)}`);",
	//     }",
	//   }",
	// ",
	//   /**",
	//    * Delete a resource on the MCP server",
	//    * @param resourceUri URI of the resource to delete",
	//    * @param options Options for deletion",
	//    * @returns Result of the delete operation",
	//    */",
	//   async deleteResource(",
	//     resourceUri: string,",
	//     options: ResourceDeleteOptions = {},",
	//   ): Promise<ResourceDeleteResult> {",
	//     logger.debug(`GenericMCPAccessor: Deleting resource ${resourceUri} on server ${this.serverId}`);",
	//     ",
	//     // Check if the MCP server supports delete",
	//     if (!this.hasCapability('delete')) {",
	//       throw new Error(`MCP server ${this.serverId} does not support resource deletion`);",
	//     }",
	//     ",
	//     try {",
	//       // Extract the resource path from the URI",
	//       const resourcePath = extractResourcePath(resourceUri);",
	//       if (!resourcePath) {",
	//         throw new Error(`Invalid resource URI: ${resourceUri}`);",
	//       }",
	//       ",
	//       // Delegate to MCPManager",
	//       const result = await this.mcpManager.deleteResource(this.serverId, resourcePath, options);",
	//       ",
	//       // Construct and return the result",
	//       return {",
	//         success: result.success,",
	//         uri: resourceUri,",
	//         type: result.type || 'unknown',",
	//         trashUri: result.trashUri,",
	//       };",
	//     } catch (error) {",
	//       logger.error(`GenericMCPAccessor: Error deleting resource ${resourceUri} on server ${this.serverId}:`, error);",
	//       throw new Error(`Failed to delete resource: ${errorMessage(error)}`);",
	//     }",
	//   }",

	/**
	 * Check if this accessor has a specific capability
	 * For MCP data sources, capabilities are determined by the MCP server
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// This would ideally check with MCPManager for server capabilities
		// For now, we'll conservatively only guarantee read and list
		return ['read', 'list'].includes(capability);
	}
}
