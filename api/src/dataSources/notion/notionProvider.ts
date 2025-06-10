/**
 * NotionProvider class for BB-managed Notion data sources.
 */
import { logger } from 'shared/logger.ts';
import { BBDataSourceProvider } from '../base/bbDataSourceProvider.ts';
import { NotionAccessor } from './notionAccessor.ts';
import { NotionClient } from './notionClient.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';
//import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

/**
 * NotionProvider for BB-managed Notion data sources
 * Extends BBDataSourceProvider to provide Notion-specific functionality
 */
export class NotionProvider extends BBDataSourceProvider {
	/**
	 * Create a new NotionProvider instance
	 */
	constructor() {
		super(
			'notion', // Provider ID
			'Notion', // Human-readable name
			'Notion workspace integration', // Description
			//['read', 'list', 'search'], // Capabilities
			['read', 'write', 'list', 'search', 'delete'], // Capabilities
			[], // Required config fields
			'apiKey', // auth type
		);

		logger.debug('NotionProvider: Created Notion provider');
	}

	/**
	 * Create a ResourceAccessor for a Notion data source
	 * @param connection The connection to create an accessor for
	 * @returns A NotionAccessor instance
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}

		// Auth is validated when creating the dsConnection
		// Validate authentication
		//if (!this.validateAuth(connection.auth)) {
		//	throw new Error(`Invalid authentication config for Notion connection ${connection.id}`);
		//}

		// Create a NotionClient from the auth config
		const client = NotionClient.fromAuthConfig(connection.auth);
		if (!client) {
			throw new Error(`Failed to create Notion client for connection ${connection.id}`);
		}

		// Create a new NotionAccessor
		return new NotionAccessor(connection, client);
	}

	/**
	 * Validate configuration for Notion data source
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	override validateConfig(config: Record<string, unknown>): boolean {
		// First check using the base validation
		if (!super.validateConfig(config)) {
			return false;
		}

		// Check that workspaceId is a string
		if (typeof config.workspaceId !== 'string') {
			logger.warn(`NotionProvider: workspaceId must be a string, got ${typeof config.workspaceId}`);
			return false;
		}

		// Check that workspaceId is not empty
		if (config.workspaceId === '') {
			logger.warn('NotionProvider: workspaceId cannot be empty');
			return false;
		}

		// All checks passed
		return true;
	}

	/**
	 * Validate authentication configuration
	 * @param auth Authentication configuration
	 * @returns True if the authentication is valid, false otherwise
	 */
	//validateAuth(auth?: AuthConfig): boolean {
	//	if (!auth) {
	//		logger.warn('NotionProvider: Missing authentication configuration');
	//		return false;
	//	}
	//
	//	if (auth.method !== 'apiKey') {
	//		logger.warn(`NotionProvider: Unsupported authentication method: ${auth.method}`);
	//		return false;
	//	}
	//
	//	if (!auth.apiKey) {
	//		logger.warn('NotionProvider: Missing API key in authentication configuration');
	//		return false;
	//	}
	//
	//	return true;
	//}

	/**
	 * Create a Notion data source with the specified configuration
	 * @param name Human-readable name for the data source
	 * @param workspaceId Notion workspace ID
	 * @param apiKey Notion API key
	 * @param registry Object that can create connections
	 * @param options Additional options
	 * @returns A new DataSourceConnection for a Notion data source
	 */
	static createNotionDataSource(
		name: string,
		workspaceId: string,
		apiKey: string,
		registry: DataSourceRegistry,
		options: {
			id?: string;
			enabled?: boolean;
			isPrimary?: boolean;
			priority?: number;
		} = {},
	): DataSourceConnection {
		const provider = registry.getProvider('notion', 'mcp');
		if (!provider) throw new Error('Could not load provider');
		// Create the connection with Notion-specific config
		const connection = registry.createConnection(
			provider,
			name,
			{ workspaceId },
			{
				...options,
				auth: {
					method: 'apiKey' as const,
					apiKey,
				},
			},
		);

		return connection;
	}
}
