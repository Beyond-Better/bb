/**
 * Extensions to MCPManager for resource operations.
 * This module adds resource operation methods to MCPManager to support the new data source architecture.
 */
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import type { MCPManager, MCPToolResult } from 'api/mcp/mcpManager.ts';
import type {
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

/**
 * Extend the MCPManager interface with resource operations
 */
export interface MCPManagerResourceOperations {
	/**
	 * Load a resource from an MCP server
	 * @param serverId MCP server ID
	 * @param resourcePath Path to the resource
	 * @param options Loading options
	 * @returns Loaded resource content and metadata
	 */
	loadResource(serverId: string, resourcePath: string, options?: ResourceLoadOptions): Promise<ResourceLoadResult>;

	/**
	 * List resources on an MCP server
	 * @param serverId MCP server ID
	 * @param options Listing options
	 * @returns List of resource metadata
	 */
	listResources(serverId: string, options?: ResourceListOptions): Promise<ResourceListResult>;

	/**
	 * Search for resources on an MCP server
	 * @param serverId MCP server ID
	 * @param query Search query
	 * @param options Search options
	 * @returns Search results
	 */
	searchResources(serverId: string, query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;

	/**
	 * Write content to a resource on an MCP server
	 * @param serverId MCP server ID
	 * @param resourcePath Path to the resource
	 * @param content Content to write
	 * @param options Writing options
	 * @returns Write operation result
	 */
	writeResource(
		serverId: string,
		resourcePath: string,
		content: string | Uint8Array,
		options?: ResourceWriteOptions,
	): Promise<ResourceWriteResult>;

	/**
	 * Move a resource on an MCP server
	 * @param serverId MCP server ID
	 * @param sourcePath Source resource path
	 * @param destPath Destination resource path
	 * @param options Move options
	 * @returns Move operation result
	 */
	moveResource(
		serverId: string,
		sourcePath: string,
		destPath: string,
		options?: ResourceMoveOptions,
	): Promise<ResourceMoveResult>;

	/**
	 * Delete a resource on an MCP server
	 * @param serverId MCP server ID
	 * @param resourcePath Path to the resource
	 * @param options Delete options
	 * @returns Delete operation result
	 */
	deleteResource(
		serverId: string,
		resourcePath: string,
		options?: ResourceDeleteOptions,
	): Promise<ResourceDeleteResult>;

	/**
	 * Get server capabilities
	 * @param serverId MCP server ID
	 * @returns Array of capability strings
	 */
	getServerCapabilities(serverId: string): Promise<string[]>;
}

/**
 * Add resource operations to MCPManager
 * @param mcpManager The MCPManager instance to extend
 */
export function extendMCPManagerWithResourceOperations(mcpManager: MCPManager): void {
	// Add loadResource method
	if (!('loadResource' in mcpManager)) {
		(mcpManager as any).loadResource = async function (
			serverId: string,
			resourcePath: string,
			options: ResourceLoadOptions = {},
		): Promise<ResourceLoadResult> {
			logger.debug(`MCPManager: Loading resource ${resourcePath} from server ${serverId}`);

			try {
				// This assumes that the MCP server has a 'load_resource' tool
				// Adjust as needed based on actual MCP tool implementation
				const result = await mcpManager.callMCPFunction(serverId, 'load_resource', {
					path: resourcePath,
					encoding: options.encoding,
					range: options.range,
				});

				// Process the result
				return processResourceResult(result, resourcePath);
			} catch (error) {
				logger.error(`MCPManager: Error loading resource ${resourcePath} from server ${serverId}:`, error);
				throw new Error(`Failed to load resource: ${errorMessage(error)}`);
			}
		};
	}

	// Add listResources method
	if (!('listResources' in mcpManager)) {
		(mcpManager as any).listResources = async function (
			serverId: string,
			options: ResourceListOptions = {},
		): Promise<ResourceListResult> {
			logger.debug(`MCPManager: Listing resources from server ${serverId}`);

			try {
				// First, check if we already have a different method for this
				if ('listResources' in mcpManager) {
					return (mcpManager as any).listResources(serverId, options);
				}

				// Otherwise, try to use the generic 'list_resources' MCP tool
				const result = await mcpManager.callMCPFunction(serverId, 'list_resources', {
					path: options.path,
					depth: options.depth,
					limit: options.limit,
					pageToken: options.pageToken,
					includeTypes: options.includeTypes,
				});

				// Process the result
				return {
					resources: Array.isArray(result.resources)
						? result.resources.map((r: any) => ({
							uri: r.uri || r.path || '',
							type: r.type || 'unknown',
							contentType: r.contentType || r.mime_type || 'application/octet-stream',
							size: r.size,
							last_modified: r.last_modified || r.lastModified || new Date().toISOString(),
						}))
						: [],
					nextPageToken: result.nextPageToken || result.continuation_token,
					hasMore: result.hasMore || result.has_more || false,
				};
			} catch (error) {
				logger.error(`MCPManager: Error listing resources from server ${serverId}:`, error);
				throw new Error(`Failed to list resources: ${errorMessage(error)}`);
			}
		};
	}

	// Add searchResources method
	if (!('searchResources' in mcpManager)) {
		(mcpManager as any).searchResources = async function (
			serverId: string,
			query: string,
			options: ResourceSearchOptions = {},
		): Promise<ResourceSearchResult> {
			logger.debug(`MCPManager: Searching resources on server ${serverId} with query: ${query}`);

			try {
				// This assumes that the MCP server has a 'search_resources' tool
				const result = await mcpManager.callMCPFunction(serverId, 'search_resources', {
					query,
					path: options.path,
					caseSensitive: options.caseSensitive,
					limit: options.limit,
					includeTypes: options.includeTypes,
					filePattern: options.filePattern,
				});

				// Process the result
				return {
					matches: Array.isArray(result.matches)
						? result.matches.map((m: any) => ({
							resource: {
								uri: m.resource.uri || m.resource.path || '',
								type: m.resource.type || 'unknown',
								contentType: m.resource.contentType || m.resource.mime_type ||
									'application/octet-stream',
								size: m.resource.size,
								last_modified: m.resource.last_modified || m.resource.lastModified ||
									new Date().toISOString(),
							},
							snippets: m.snippets || [],
							score: m.score || 0,
						}))
						: [],
					totalMatches: result.totalMatches || result.total_matches || 0,
				};
			} catch (error) {
				logger.error(`MCPManager: Error searching resources on server ${serverId}:`, error);
				throw new Error(`Failed to search resources: ${errorMessage(error)}`);
			}
		};
	}

	// Add writeResource method
	if (!('writeResource' in mcpManager)) {
		(mcpManager as any).writeResource = async function (
			serverId: string,
			resourcePath: string,
			content: string | Uint8Array,
			options: ResourceWriteOptions = {},
		): Promise<ResourceWriteResult> {
			logger.debug(`MCPManager: Writing to resource ${resourcePath} on server ${serverId}`);

			try {
				// Convert binary content to base64 for transmission
				const contentValue = typeof content === 'string' ? content : btoa(String.fromCharCode(...content));

				// This assumes that the MCP server has a 'write_resource' tool
				const result = await mcpManager.callMCPFunction(serverId, 'write_resource', {
					path: resourcePath,
					content: contentValue,
					contentIsBinary: typeof content !== 'string',
					createMissingDirectories: options.createMissingDirectories,
					overwrite: options.overwrite,
					encoding: options.encoding,
					contentType: options.contentType,
					metadata: options.metadata,
				});

				// Process the result
				return {
					success: result.success === true,
					uri: result.uri || resourcePath,
					metadata: {
						uri: result.uri || resourcePath,
						type: result.metadata?.type || 'file',
						contentType: result.metadata?.contentType || options.contentType || 'application/octet-stream',
						size: result.metadata?.size ||
							(typeof content === 'string' ? new TextEncoder().encode(content).length : content.length),
						last_modified: result.metadata?.last_modified || result.metadata?.lastModified ||
							new Date().toISOString(),
					},
					bytesWritten: result.bytesWritten ||
						(typeof content === 'string' ? new TextEncoder().encode(content).length : content.length),
				};
			} catch (error) {
				logger.error(`MCPManager: Error writing resource ${resourcePath} on server ${serverId}:`, error);
				throw new Error(`Failed to write resource: ${errorMessage(error)}`);
			}
		};
	}

	// Add moveResource method
	if (!('moveResource' in mcpManager)) {
		(mcpManager as any).moveResource = async function (
			serverId: string,
			sourcePath: string,
			destPath: string,
			options: ResourceMoveOptions = {},
		): Promise<ResourceMoveResult> {
			logger.debug(`MCPManager: Moving resource from ${sourcePath} to ${destPath} on server ${serverId}`);

			try {
				// This assumes that the MCP server has a 'move_resource' tool
				const result = await mcpManager.callMCPFunction(serverId, 'move_resource', {
					sourcePath,
					destinationPath: destPath,
					createMissingDirectories: options.createMissingDirectories,
					overwrite: options.overwrite,
				});

				// Process the result
				return {
					success: result.success === true,
					sourceUri: sourcePath,
					destinationUri: destPath,
					metadata: {
						uri: destPath,
						type: result.metadata?.type || 'file',
						contentType: result.metadata?.contentType || result.metadata?.mime_type ||
							'application/octet-stream',
						size: result.metadata?.size || 0,
						last_modified: result.metadata?.last_modified || result.metadata?.lastModified ||
							new Date().toISOString(),
					},
				};
			} catch (error) {
				logger.error(
					`MCPManager: Error moving resource ${sourcePath} to ${destPath} on server ${serverId}:`,
					error,
				);
				throw new Error(`Failed to move resource: ${errorMessage(error)}`);
			}
		};
	}

	// Add deleteResource method
	if (!('deleteResource' in mcpManager)) {
		(mcpManager as any).deleteResource = async function (
			serverId: string,
			resourcePath: string,
			options: ResourceDeleteOptions = {},
		): Promise<ResourceDeleteResult> {
			logger.debug(`MCPManager: Deleting resource ${resourcePath} on server ${serverId}`);

			try {
				// This assumes that the MCP server has a 'delete_resource' tool
				const result = await mcpManager.callMCPFunction(serverId, 'delete_resource', {
					path: resourcePath,
					recursive: options.recursive,
					permanent: options.permanent,
				});

				// Process the result
				return {
					success: result.success === true,
					uri: resourcePath,
					type: result.type || 'unknown',
					trashUri: result.trashUri,
				};
			} catch (error) {
				logger.error(`MCPManager: Error deleting resource ${resourcePath} on server ${serverId}:`, error);
				throw new Error(`Failed to delete resource: ${errorMessage(error)}`);
			}
		};
	}

	// Add getServerCapabilities method
	if (!('getServerCapabilities' in mcpManager)) {
		(mcpManager as any).getServerCapabilities = async function (
			serverId: string,
		): Promise<string[]> {
			logger.debug(`MCPManager: Getting capabilities for server ${serverId}`);

			try {
				// This would ideally call a 'get_capabilities' MCP function
				// For now, default to basic capabilities
				return ['read', 'list'];
			} catch (error) {
				logger.error(`MCPManager: Error getting capabilities for server ${serverId}:`, error);
				// Return basic capabilities on error
				return ['read', 'list'];
			}
		};
	}

	logger.info('MCPManager: Extended with resource operations');
}

/**
 * Helper function to process resource operation results
 */
function processResourceResult(result: MCPToolResult, resourcePath: string): ResourceLoadResult {
	// Convert result to a standard ResourceLoadResult
	// Handle both string and binary content
	const content = typeof result.content === 'string' ? result.content : new Uint8Array(result.content as ArrayBuffer);

	// Create metadata from available fields
	const metadata: ResourceMetadata = {
		uri: result.metadata?.uri || resourcePath,
		type: result.metadata?.type || 'file',
		contentType: result.metadata?.contentType || result.metadata?.mime_type || 'application/octet-stream',
		size: result.metadata?.size ||
			(typeof content === 'string' ? new TextEncoder().encode(content).length : content.length),
		last_modified: result.metadata?.last_modified || result.metadata?.lastModified || new Date().toISOString(),
	};

	return {
		content,
		metadata,
		isPartial: result.isPartial || false,
	};
}
