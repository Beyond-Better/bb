/**
 * Interface definitions for ResourceAccessor.
 * ResourceAccessor provides access to resources within a data source.
 */
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceAccessMethod } from 'shared/types/dataSource.ts';
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
	 * Search for resources based on a query (optional capability)
	 * @param query Search query
	 * @param options Options for searching
	 * @returns Search results
	 */
	searchResources?(query: string, options?: ResourceSearchOptions): Promise<ResourceSearchResult>;

	/**
	 * Write content to a resource (optional capability)
	 * @param resourceUri URI of the resource to write
	 * @param content Content to write
	 * @param options Options for writing
	 * @returns Result of the write operation
	 */
	writeResource?(
		resourceUri: string,
		content: string | Uint8Array,
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
}
