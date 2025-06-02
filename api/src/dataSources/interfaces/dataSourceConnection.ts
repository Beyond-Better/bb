/**
 * Interface definitions for DataSourceConnection.
 * DataSourceConnection represents a specific configured instance of a data source.
 */
import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';
import type { DataSourceAccessMethod, DataSourceCapability, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';

/**
 * DataSourceConnection interface
 * Represents a specific configured instance of a data source with connection details.
 */
export interface DataSourceConnection {
	/**
	 * Unique identifier for this connection instance
	 */
	readonly id: string;

	/**
	 * Reference to the provider instance that handles this connection
	 */
	readonly provider: DataSourceProvider;

	/**
	 * Reference to the provider ID that handles this connection
	 */
	get providerType(): DataSourceProviderType;

	/**
	 * Access method inherited from the provider
	 */
	get accessMethod(): DataSourceAccessMethod;

	/**
	 * Capabilities inherited from the provider
	 */
	get capabilities(): DataSourceCapability[];

	/**
	 * Description inherited from the provider
	 */
	get description(): string;

	/**
	 * Human-readable name for this connection
	 */
	name: string;

	uriPrefix?: string;
	uriTemplate?: string;

	/**
	 * Provider-specific configuration
	 */
	config: Record<string, unknown>;

	/**
	 * Authentication details (optional)
	 */
	auth?: AuthConfig;

	/**
	 * Whether this connection is active
	 */
	enabled: boolean;

	/**
	 * Whether this is the primary data source
	 */
	isPrimary: boolean;

	/**
	 * Priority for ordering (higher = more important)
	 */
	priority: number;

	/**
	 * Get a ResourceAccessor for a data source connection
	 * @returns A ResourceAccessor instance
	 */
	getResourceAccessor(): Promise<ResourceAccessor>;

	/**
	 * Is resource path within the data source - not an exists test, just valid path within data source
	 */
	isResourceWithinDataSource(resourceUri: string): Promise<boolean>;

	/**
	 * Does resource exist in the data source
	 */
	resourceExists(resourceUri: string, options?: { isFile?: boolean }): Promise<boolean>;

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	ensureResourcePathExists(resourceUri: string): Promise<void>;

	/**
	 * Get/Set dataSourceRoot - for filesystem type only
	 */
	get dataSourceRoot(): string;
	getDataSourceRoot(): string;
	setDataSourceRoot(root: string): void;

	/**
	 * Serialize to/from JSON for storage
	 */
	toJSON(): DataSourceConnectionValues;
	//fromJSON(values: DataSourceConnectionValues): Promise<DataSourceConnection>; //

	/**
	 * Get formatted information for system prompt
	 */
	getForSystemPrompt(): DataSourceConnectionSystemPrompt;
}

/**
 * Serialization format for DataSourceConnection
 */
export interface DataSourceConnectionValues {
	id: string;
	providerType: DataSourceProviderType;
	accessMethod: DataSourceAccessMethod;
	name: string;
	config: Record<string, unknown>;
	auth?: AuthConfig;
	enabled: boolean;
	isPrimary: boolean;
	priority: number;
}

/**
 * System prompt format for DataSourceConnection
 * Only includes non-sensitive information needed for LLM context
 */
//export interface DataSourceConnectionSystemPrompt extends Omit<DataSourceConnectionValues, 'enabled' | 'auth' | 'accessMethod'> {
//	// This interface explicitly omits fields that shouldn't be in the system prompt
//}
export interface DataSourceConnectionSystemPrompt {
	id: string;
	providerType: DataSourceProviderType;
	accessMethod: DataSourceAccessMethod;
	name: string;
	config: Record<string, unknown>;
	capabilities: DataSourceCapability[];
	description?: string;
	isPrimary: boolean;
	uriPrefix?: string;
	uriTemplate?: string;
	// No auth, config, or other sensitive/unnecessary information
}
