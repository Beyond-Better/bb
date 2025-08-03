/**
 * Abstract base class for all data source providers.
 * Implements common functionality for both BB-managed and MCP-managed providers.
 */
import { logger } from 'shared/logger.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';
import type {
	AcceptedContentType,
	AcceptedEditType,
	ContentTypeGuidance,
	DataSourceAccessMethod,
	DataSourceAuth,
	DataSourceAuthMethod,
	DataSourceCapability,
	DataSourceEditCapability,
	DataSourceLoadCapability,
	DataSourceProviderStructuredQuerySchema,
	DataSourceProviderType,
	DataSourceSearchCapability,
} from 'shared/types/dataSource.ts';

/**
 * Abstract base class for all data source providers
 */
export abstract class BaseDataSourceProvider implements DataSourceProvider {
	/**
	 * Unique identifier for this provider type
	 */
	//public readonly id: string;
	public readonly providerType: DataSourceProviderType;

	/**
	 * Access method - abstract property that must be defined by subclasses
	 */
	public abstract readonly accessMethod: DataSourceAccessMethod;

	/**
	 * Content types this provider accepts - must be defined by subclasses
	 */
	public abstract readonly acceptedContentTypes: AcceptedContentType[];

	/**
	 * Edit approaches this provider supports - must be defined by subclasses
	 */
	public abstract readonly acceptedEditTypes: AcceptedEditType[];

	/**
	 * Preferred content type for this provider - must be defined by subclasses
	 */
	public abstract readonly preferredContentType: AcceptedContentType;

	/**
	 * Human-readable name for this provider type
	 */
	public readonly name: string;

	/**
	 * URI Template for this provider type
	 */
	readonly uriTemplate?: string;

	/**
	 * Descriptive text about this provider
	 */
	public readonly description: string;

	/**
	 * List of supported operations
	 */
	public abstract capabilities: DataSourceCapability[];
	public abstract editCapabilities: DataSourceEditCapability[];
	public abstract searchCapabilities: DataSourceSearchCapability[];
	public abstract loadCapabilities: DataSourceLoadCapability[];
	public abstract structuredQuerySchema: DataSourceProviderStructuredQuerySchema | undefined;

	/**
	 * List of configuration fields required for this provider
	 */
	public readonly requiredConfigFields: string[];

	/**
	 * Auth Type and List of auth fields required for this provider
	 * [TODO] Does authType need to be an array, do any providers support multiple auth types
	 */
	public readonly authType: DataSourceAuthMethod;
	//public readonly requiredAuthFields: string[];

	/**
	 * Create a new BaseDataSourceProvider instance
	 * @param id Provider ID
	 * @param name Human-readable name
	 * @param description Descriptive text
	 * @param capabilities Supported operations
	 * @param requiredConfigFields Required configuration fields
	 * @param authType Optional auth type
	 */
	constructor(
		//id: string,
		providerType: DataSourceProviderType,
		name: string,
		description: string,
		requiredConfigFields: string[],
		authType: DataSourceAuthMethod = 'none',
		//requiredAuthFields: string[] = [],
	) {
		//this.id = id;
		this.providerType = providerType;
		this.name = name;
		this.description = description;
		this.requiredConfigFields = [...requiredConfigFields]; // Make a copy to prevent modification
		this.authType = authType;
		//this.requiredAuthFields = [...requiredAuthFields]; // Make a copy to prevent modification
	}

	/**
	 * Factory method to create a ResourceAccessor for this provider
	 * Must be implemented by subclasses
	 * @param connection Connection configuration
	 */
	abstract createAccessor(connection: DataSourceConnection): ResourceAccessor;

	/**
	 * Validate configuration for this provider
	 * @param config Configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	validateConfig(config: Record<string, unknown>): boolean {
		// Check that all required fields are present
		for (const field of this.requiredConfigFields) {
			if (!(field in config)) {
				logger.warn(
					`BaseDataSourceProvider: Missing required field ${field} in config for ${this.providerType}`,
				);
				return false;
			}
		}
		return true;
	}

	/**
	 * Validate auth for this provider
	 * @param auth Auth to validate
	 * @returns True if the auth is valid, false otherwise
	 */
	validateAuth(auth: DataSourceAuth): boolean {
		//const authType: DataSourceAuthMethod = this.authType;
		if (!auth || this.authType !== auth.method) return false;
		// // Check that required auth fields are present
		// logger.info(
		// 	`BaseDataSourceProvider: auth for ${this.providerType}`,
		// 	auth,
		// );

		switch (this.authType) {
			case 'none': // No authentication required
				return true;
			case 'apiKey': // Simple API key
				return !!('apiKey' in auth && auth.apiKey);

			case 'basic': // Basic auth (username/password)
				return !!('basic' in auth && auth.basic &&
					'usernameRef' in auth.basic && auth.basic.usernameRef &&
					'passwordRef' in auth.basic && auth.basic.passwordRef);
			case 'bearer': // Bearer token
				return !!('bearer' in auth && auth.bearer &&
					'tokenRef' in auth.bearer && auth.bearer.tokenRef);
			case 'oauth2': // OAuth 2.0
				return !!(
					'oauth2' in auth && auth.oauth2 &&
					//'clientId' in auth.oauth2 && auth.oauth2.clientId &&
					//'clientSecret' in auth.oauth2 && auth.oauth2.clientSecret &&
					'accessToken' in auth.oauth2 && auth.oauth2.accessToken
					//&& (!auth.oauth2.expiresAt || auth.oauth2.expiresAt > Date.now())
				);
			case 'custom': // Custom auth method
				return true;

			default:
				throw new Error(`Unknown auth type: ${this.authType}`);
		}
	}

	/**
	 * Check if this provider supports a specific capability
	 * @param capability Capability to check
	 * @returns True if the capability is supported
	 */
	hasCapability(capability: DataSourceCapability): boolean {
		return this.capabilities.includes(capability);
	}

	/**
	 * Get content type guidance for LLM tool usage
	 * Must be implemented by subclasses to provide provider-specific guidance
	 * @returns ContentTypeGuidance object with usage examples and constraints
	 */
	abstract getContentTypeGuidance(): ContentTypeGuidance;
}
