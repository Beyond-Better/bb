/**
 * Interface definitions for DataSourceProvider.
 * DataSourceProvider defines the capabilities and characteristics of a type of data source.
 */
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuth,
	DataSourceAuthMethod,
	DataSourceCapability,
} from 'shared/types/dataSource.ts';

/**
 * DataSourceProvider interface
 * Defines the capabilities and characteristics of a type of data source.
 */
export interface DataSourceProvider {
	/**
	 * Unique identifier for this provider type (e.g., 'filesystem', 'notion', 'supabase-prod')
	 */
	readonly providerType: string;

	/**
	 * Access method - fundamental distinction that affects how operations are performed
	 */
	readonly accessMethod: DataSourceAccessMethod;

	/**
	 * URI Template for this provider type
	 */
	readonly uriTemplate?: string;

	/**
	 * Human-readable name for this provider type
	 */
	readonly name: string;

	/**
	 * Descriptive text about this provider
	 */
	readonly description: string;

	/**
	 * List of supported operations ('read', 'write', 'list', 'search', etc.)
	 */
	readonly capabilities: DataSourceCapability[];

	/**
	 * List of configuration fields required for this provider
	 */
	readonly requiredConfigFields: string[];

	/**
	 * Auth Type and List of auth fields required for this provider
	 * [TODO] Does authType need to be an array, do any providers support multiple auth types
	 */
	readonly authType: DataSourceAuthMethod;
	// required fields are defined by authType
	//readonly requiredAuthFields: string[];

	/**
	 * Factory method to create ResourceAccessor instances for this provider
	 * @param connection The connection configuration to use
	 * @returns A ResourceAccessor instance for accessing resources
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor;

	/**
	 * Validate configuration for this provider
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	validateConfig(config: Record<string, unknown>): boolean;

	/**
	 * Validate auth for this provider
	 * @param auth The auth to validate
	 * @returns True if the auth is valid, false otherwise
	 */
	validateAuth(auth: DataSourceAuth): boolean;

	/**
	 * Check if this provider supports a specific capability
	 * @param capability Capability to check
	 * @returns True if the capability is supported
	 */
	hasCapability(capability: DataSourceCapability): boolean;
}
