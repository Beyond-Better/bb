/**
 * Abstract base class for all resource accessors.
 * Implements common functionality for both BB-managed and MCP-managed resources.
 */
import { logger } from 'shared/logger.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceAccessMethod, DataSourceMetadata } from 'shared/types/dataSource.ts';
import type {
	ResourceListOptions,
	ResourceListResult,
	ResourceLoadOptions,
	ResourceLoadResult,
} from 'shared/types/dataSourceResource.ts';

/**
 * Abstract base class for all resource accessors
 */
export abstract class BaseResourceAccessor implements ResourceAccessor {
	/**
	 * The connection this accessor is associated with
	 */
	public readonly connection: DataSourceConnection;

	/**
	 * Access method inherited from the connection
	 */
	public readonly accessMethod: DataSourceAccessMethod;

	/**
	 * Create a new BaseResourceAccessor instance
	 * @param connection The data source connection to use
	 */
	constructor(connection: DataSourceConnection) {
		this.connection = connection;
		this.accessMethod = connection.accessMethod;
		logger.debug(`BaseResourceAccessor: Created accessor for ${connection.id} (${connection.name})`);
	}

	/**
	 * Check if this accessor has a specific capability
	 * The actual capabilities are determined by the provider, not the accessor
	 * @param capability The capability to check for
	 * @returns True if the capability is supported, false otherwise
	 */
	hasCapability(capability: string): boolean {
		// In a real implementation, this would check the provider's capabilities
		// For now, we'll just return true for core capabilities and let subclasses override
		return ['read', 'list'].includes(capability);
	}

	/**
	 * Abstract methods that must be implemented by subclasses
	 */
	abstract isResourceWithinDataSource(resourceUri: string): Promise<boolean>;
	abstract resourceExists(resourceUri: string, options?: { isFile?: boolean }): Promise<boolean>;
	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	abstract ensureResourcePathExists(resourceUri: string): Promise<void>;

	abstract loadResource(resourceUri: string, options?: ResourceLoadOptions): Promise<ResourceLoadResult>;
	abstract listResources(options?: ResourceListOptions): Promise<ResourceListResult>;
	abstract getMetadata(): Promise<DataSourceMetadata>;

	/**
	 * Format metadata for display - provides a basic implementation
	 * Subclasses can override for provider-specific formatting
	 * @param metadata The metadata to format
	 * @returns Formatted string representation
	 */
	formatMetadata(metadata: DataSourceMetadata): string {
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

		if (metadata.lastScanned) {
			lines.push(`Last Scanned: ${new Date(metadata.lastScanned).toLocaleString()}`);
		}

		return lines.join('\n');
	}
}
