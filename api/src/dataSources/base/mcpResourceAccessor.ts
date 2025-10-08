/**
 * Abstract base class for MCP-managed resource accessors.
 * Extends BaseResourceAccessor and provides MCP-specific functionality.
 */
import { logger } from 'shared/logger.ts';
import { BaseResourceAccessor } from './baseResourceAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type {
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
	ResourceMoveOptions,
	ResourceMoveResult,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
} from 'shared/types/dataSourceResource.ts';
import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';
import type { TabularSheet } from 'api/types/tabular.ts';

/**
 * Abstract base class for MCP-managed resource accessors
 * These accessors delegate operations to the MCPManager for external MCP servers
 */
export abstract class MCPResourceAccessor extends BaseResourceAccessor {
	/**
	 * Reference to the MCPManager that handles communication with MCP servers
	 */
	protected mcpManager: MCPManager;

	/**
	 * The server ID of the MCP server that handles this data source
	 */
	protected serverId: string;

	/**
	 * Create a new MCPResourceAccessor instance
	 * @param connection The data source connection to use
	 * @param mcpManager The MCPManager instance to use for communications
	 * @param serverId The ID of the MCP server (defaults to connection.providerType)
	 */
	constructor(connection: DataSourceConnection, mcpManager: MCPManager, serverId?: string) {
		super(connection);
		// Verify this is an MCP-managed connection
		if (connection.accessMethod !== 'mcp') {
			throw new Error(
				`MCPResourceAccessor can only be used with MCP-managed data sources, got: ${connection.accessMethod}`,
			);
		}

		this.mcpManager = mcpManager;
		this.serverId = serverId || connection.providerType;
		logger.debug(`MCPResourceAccessor: Created accessor for ${connection.id} with server ${this.serverId}`);
	}

	/**
	 * Load a resource from the MCP server
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	async loadResource(resourceUri: string, _options?: ResourceLoadOptions): Promise<ResourceLoadResult> {
		logger.debug(`MCPResourceAccessor: Loading resource ${resourceUri} from server ${this.serverId}`);

		// This would be implemented in concrete subclasses or in a generic MCP accessor
		// by delegating to the MCPManager
		throw new Error('Method not implemented yet');
	}

	/**
	 * List available resources from the MCP server
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	async listResources(_options?: ResourceListOptions): Promise<ResourceListResult> {
		logger.debug(`MCPResourceAccessor: Listing resources from server ${this.serverId}`);

		// This would be implemented in concrete subclasses or in a generic MCP accessor
		// by delegating to the MCPManager
		throw new Error('Method not implemented yet');
	}

	/**
	 * Search for resources on the MCP server
	 * Optional capability - depends on MCP server support
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	async searchResources?(query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult> {
		logger.debug(`MCPResourceAccessor: Searching resources on server ${this.serverId} with query: ${query}`);

		// Check if the MCP server supports search
		if (!this.hasCapability('search')) {
			return {
				matches: [],
				totalMatches: 0,
				errorMessage: `MCP server ${this.serverId} does not support resource searching`,
			};
		}

		// For enhanced search options, most MCP servers won't support advanced features
		if (options?.contentPattern || options?.contextLines || options?.maxMatchesPerFile) {
			logger.warn(`MCPResourceAccessor: Advanced search features not supported by MCP server ${this.serverId}`);
			return {
				matches: [],
				totalMatches: 0,
				errorMessage:
					`Advanced search features (content patterns, context extraction) not supported by MCP server ${this.serverId}`,
			};
		}

		// This would be implemented by delegating to the MCPManager for basic search
		// For now, return empty results to avoid breaking the tool
		logger.warn(`MCPResourceAccessor: Search not yet implemented for server ${this.serverId}`);
		return {
			matches: [],
			totalMatches: 0,
			errorMessage: `Search not yet implemented for MCP server ${this.serverId}`,
		};
	}

	/**
	 * Write content to a resource on the MCP server
	 * Optional capability - depends on MCP server support
	 * @param resourceUri URI of the resource to write
	 * @param content Content to write
	 * @param options Options for writing
	 * @returns Result of the write operation
	 */
	async writeResource?(
		resourceUri: string,
		_content: string | Uint8Array | Array<PortableTextBlock> | Array<TabularSheet>,
		_options?: ResourceWriteOptions,
	): Promise<ResourceWriteResult> {
		logger.debug(`MCPResourceAccessor: Writing to resource ${resourceUri} on server ${this.serverId}`);

		// Check if the MCP server supports write
		if (!this.hasCapability('write')) {
			throw new Error(`MCP server ${this.serverId} does not support resource writing`);
		}

		// This would be implemented by delegating to the MCPManager
		throw new Error('Method not implemented yet');
	}

	/**
	 * Move a resource on the MCP server
	 * Optional capability - depends on MCP server support
	 * @param sourceUri Source resource URI
	 * @param destinationUri Destination resource URI
	 * @param options Options for moving
	 * @returns Result of the move operation
	 */
	async moveResource?(
		sourceUri: string,
		destinationUri: string,
		_options?: ResourceMoveOptions,
	): Promise<ResourceMoveResult> {
		logger.debug(
			`MCPResourceAccessor: Moving resource from ${sourceUri} to ${destinationUri} on server ${this.serverId}`,
		);

		// Check if the MCP server supports move
		if (!this.hasCapability('move')) {
			throw new Error(`MCP server ${this.serverId} does not support resource moving`);
		}

		// This would be implemented by delegating to the MCPManager
		throw new Error('Method not implemented yet');
	}

	/**
	 * Delete a resource on the MCP server
	 * Optional capability - depends on MCP server support
	 * @param resourceUri URI of the resource to delete
	 * @param options Options for deletion
	 * @returns Result of the delete operation
	 */
	async deleteResource?(resourceUri: string, _options?: ResourceDeleteOptions): Promise<ResourceDeleteResult> {
		logger.debug(`MCPResourceAccessor: Deleting resource ${resourceUri} on server ${this.serverId}`);

		// Check if the MCP server supports delete
		if (!this.hasCapability('delete')) {
			throw new Error(`MCP server ${this.serverId} does not support resource deletion`);
		}

		// This would be implemented by delegating to the MCPManager
		throw new Error('Method not implemented yet');
	}

	/**
	 * Check if this accessor has a specific capability
	 * For MCP data sources, capabilities are determined by the MCP server
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// In a real implementation, we'd query the MCP server's capabilities
		// For now, we'll only guarantee read and list operations for MCP sources
		return ['read', 'list'].includes(capability);
	}
}
