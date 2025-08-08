/**
 * Interface definitions for ResourceAccessor.
 * ResourceAccessor provides access to resources within a data source.
 */
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceAccessMethod } from 'shared/types/dataSource.ts';
import type {
	FindResourceParams,
	FindResourceResult,
	ResourceDeleteOptions,
	ResourceDeleteResult,
	ResourceEditOperation,
	ResourceEditResult,
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
import type { DataSourceMetadata } from 'shared/types/dataSource.ts';
import type { PortableTextBlock } from 'api/types/portableText.ts';

/**
 * ResourceAccessor interface
 * Provides access to resources within a data source with operations based on capabilities.
 */
export interface ResourceAccessor {
	/**
	 * The connection this accessor is associated with
	 */
	readonly connection: DataSourceConnection;

	/**
	 * Access method inherited from the connection
	 */
	readonly accessMethod: DataSourceAccessMethod;

	/**
	 * Check if resource exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 * @returns boolean
	 */
	isResourceWithinDataSource(resourceUri: string): Promise<boolean>;
	resourceExists(resourceUri: string, options?: { isFile?: boolean }): Promise<boolean>;

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	ensureResourcePathExists(resourceUri: string): Promise<void>;

	/**
	 * Load a resource from the data source
	 * @param resourceUri URI of the resource to load
	 * @param options Options for loading the resource
	 * @returns The loaded resource with its content and metadata
	 */
	loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<ResourceLoadResult>;

	/**
	 * List available resources in the data source
	 * @param options Options for listing resources
	 * @returns List of available resources with metadata
	 */
	listResources(options?: ResourceListOptions): Promise<ResourceListResult>;

	/**
	 * Find resources using unified operations architecture (primary interface)
	 * @param params Search parameters with content/resource patterns and structured queries
	 * @returns Enhanced search results with polymorphic matches and pagination
	 */
	findResources?(params: FindResourceParams): Promise<FindResourceResult>;

	/**
	 * Search for resources based on a query (legacy interface, delegates to findResources)
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
	 * Write content to a resource (optional capability)
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
	 * Move a resource to a new location (optional capability)
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
	 * Rename a resource - potentially moving to a new location (optional capability)
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
	 * Delete a resource (optional capability)
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
	hasCapability(capability: string): boolean;

	/**
	 * Get metadata about the data source without loading all resources
	 * This provides an efficient way to understand the data source structure
	 * @returns Promise<DataSourceMetadata> Metadata about the data source
	 */
	getMetadata(): Promise<DataSourceMetadata>;

	/**
	 * Format metadata for display to users
	 * Each accessor knows best how to present its own metadata
	 * @param metadata The metadata to format
	 * @returns Formatted string representation
	 */
	formatMetadata(metadata: DataSourceMetadata): string;
}
