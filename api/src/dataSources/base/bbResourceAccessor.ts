/**
 * Abstract base class for BB-managed resource accessors.
 * Extends BaseResourceAccessor and provides BB-specific functionality.
 */
//import { logger } from 'shared/logger.ts';
import { BaseResourceAccessor } from './baseResourceAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type {
	FindResourceParams,
	FindResourceResult,
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceEditOperation,
	ResourceEditResult,
	// ResourceListOptions,
	// ResourceListResult,
	// ResourceLoadOptions,
	// ResourceLoadResult,
	ResourceMoveOptions,
	ResourceMoveResult,
	ResourceSearchOptions,
	ResourceSearchResult,
	ResourceWriteOptions,
	ResourceWriteResult,
} from 'shared/types/dataSourceResource.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';

/**
 * Abstract base class for BB-managed resource accessors
 * These accessors directly implement operations for BB-controlled data sources
 */
export abstract class BBResourceAccessor extends BaseResourceAccessor {
	/**
	 * Create a new BBResourceAccessor instance
	 * @param connection The data source connection to use
	 */
	constructor(connection: DataSourceConnection) {
		super(connection);
		// Verify this is a BB-managed connection
		if (connection.accessMethod !== 'bb') {
			throw new Error(
				`BBResourceAccessor can only be used with BB-managed data sources, got: ${connection.accessMethod}`,
			);
		}
	}

	/**
	 * Load a resource from the data source
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	//abstract loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<ResourceLoadResult>;

	/**
	 * List available resources in the data source
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	//abstract listResources(options?: ResourceListOptions): Promise<ResourceListResult>;

	/**
	 * Find resources using unified operations architecture (primary interface)
	 * Subclasses should implement this method for enhanced search capabilities
	 * @param params Search parameters with content/resource patterns and structured queries
	 * @returns Enhanced search results with polymorphic matches and pagination
	 */
	findResources?(params: FindResourceParams): Promise<FindResourceResult>;

	/**
	 * Search for resources based on a query (legacy interface)
	 * Default implementation delegates to findResources if available, otherwise optional
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	searchResources?(query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;

	/**
	 * Edit a resource using the unified operations interface
	 * Delegates to appropriate operation handlers based on operation type
	 * @param resourcePath Path of the resource to edit relative to data source root
	 * @param operations Array of edit operations to apply
	 * @returns Result containing operation outcomes and resource metadata
	 */
	editResource?(
		resourcePath: string,
		operations: ResourceEditOperation[],
		options: { createIfMissing: boolean },
	): Promise<ResourceEditResult>;

	/**
	 * Write content to a resource
	 * Optional capability - implement in subclasses if supported
	 * @param resourceUri URI of the resource to write
	 * @param content Content to write
	 * @param options Options for writing
	 * @returns Result of the write operation
	 */
	writeResource?(
		resourceUri: string,
		content: string | Uint8Array | PortableTextBlock[],
		options?: ResourceWriteOptions,
	): Promise<ResourceWriteResult>;

	/**
	 * Move a resource to a new location
	 * Optional capability - implement in subclasses if supported
	 * @param sourceUri Source resource URI
	 * @param destinationUri Destination resource URI
	 * @param options Options for moving
	 * @returns Result of the move operation
	 */
	moveResource?(
		sourceUri: string,
		destinationUri: string,
		options?: ResourceMoveOptions,
	): Promise<ResourceMoveResult>;

	/**
	 * Rename a resource - potentially to a new location
	 * Optional capability - implement in subclasses if supported
	 * @param sourceUri Source resource URI
	 * @param destinationUri Destination resource URI
	 * @param options Options for moving
	 * @returns Result of the move operation
	 */
	renameResource?(
		sourceUri: string,
		destinationUri: string,
		options?: ResourceMoveOptions,
	): Promise<ResourceMoveResult>;

	/**
	 * Delete a resource
	 * Optional capability - implement in subclasses if supported
	 * @param resourceUri URI of the resource to delete
	 * @param options Options for deletion
	 * @returns Result of the delete operation
	 */
	deleteResource?(resourceUri: string, options?: ResourceDeleteOptions): Promise<ResourceDeleteResult>;

	/**
	 * Check if this accessor has a specific capability
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	override hasCapability(capability: DataSourceCapability): boolean {
		// In a real implementation, we'd check with the provider
		// For now, just return true for the core capabilities
		return ['read', 'list'].includes(capability);
	}
}
