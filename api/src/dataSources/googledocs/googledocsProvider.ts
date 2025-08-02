/**
 * GoogleDocsProvider class for BB-managed Google Docs data sources.
 */
import { logger } from 'shared/logger.ts';
import { BBDataSourceProvider } from '../base/bbDataSourceProvider.ts';
import { GoogleDocsAccessor } from './googledocsAccessor.ts';
import { GoogleDocsClient } from './googledocsClient.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
//import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';

/**
 * GoogleDocsProvider for BB-managed Google Docs data sources
 * Extends BBDataSourceProvider to provide Google Docs-specific functionality
 */
export class GoogleDocsProvider extends BBDataSourceProvider {
	/**
	 * Create a new GoogleDocsProvider instance
	 */
	constructor() {
		super(
			'googledocs', // Provider ID
			'Google Docs', // Human-readable name
			'Google Docs workspace integration', // Description
			['blockRead', 'blockEdit', 'list', 'search', 'delete'], // Capabilities
			[], // Required config fields (all are optional)
			'oauth2', // auth type
		);

		logger.info('GoogleDocsProvider: Created Google Docs provider');
	}

	/**
	 * Create a ResourceAccessor for a Google Docs data source
	 * @param connection The connection to create an accessor for
	 * @returns A GoogleDocsAccessor instance
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}
		//logger.info('GoogleDocsProvider: Creating accessor', { connection });

		const tokenUpdateCallback = async (newTokens: {
			accessToken: string;
			refreshToken?: string;
			expiresAt?: number;
		}) => {
			// Update the data source connection
			logger.info(
				`GoogleDocsProvider: updating oauth tokens via callback for project ${connection.projectConfig?.projectId}`,
			);
			if (connection.projectConfig?.projectId) {
				const projectPersistenceManager = await getProjectPersistenceManager();
				const project = await projectPersistenceManager.getProject(connection.projectConfig.projectId);

				if (project) {
					logger.info(
						`GoogleDocsProvider: loaded project for updating oauth tokens via callback for project ${connection.projectConfig.projectId}`,
					);
					const updatedAuth = {
						...connection.auth,
						method: connection.auth?.method || 'none',
						oauth2: {
							...connection.auth?.oauth2,
							accessToken: newTokens.accessToken,
							refreshToken: newTokens.refreshToken || connection.auth?.oauth2?.refreshToken,
							expiresAt: newTokens.expiresAt,
						},
					};
					connection.update({ auth: updatedAuth });
					await project.updateDsConnection(connection.id, { auth: updatedAuth });
				}
			}
		};

		logger.info('GoogleDocsProvider: Creating client with auth', { auth: connection.auth });
		// Create a GoogleDocsClient from the auth config
		const client = GoogleDocsClient.fromAuthConfig(connection.auth, connection.projectConfig, tokenUpdateCallback);
		if (!client) {
			throw new Error(`Failed to create Google Docs client for connection ${connection.id}`);
		}

		// Create a new GoogleDocsAccessor
		return new GoogleDocsAccessor(connection, client);
	}

	/**
	 * Validate configuration for Google Docs data source
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	override validateConfig(config: Record<string, unknown>): boolean {
		// First check using the base validation
		if (!super.validateConfig(config)) {
			return false;
		}

		// Check optional folderId if provided
		if (config.folderId !== undefined) {
			if (typeof config.folderId !== 'string') {
				logger.warn(`GoogleDocsProvider: folderId must be a string, got ${typeof config.folderId}`);
				return false;
			}

			if (config.folderId === '') {
				logger.warn('GoogleDocsProvider: folderId cannot be empty');
				return false;
			}
		}

		// Check optional driveId if provided
		if (config.driveId !== undefined) {
			if (typeof config.driveId !== 'string') {
				logger.warn(`GoogleDocsProvider: driveId must be a string, got ${typeof config.driveId}`);
				return false;
			}

			if (config.driveId === '') {
				logger.warn('GoogleDocsProvider: driveId cannot be empty');
				return false;
			}
		}

		// All checks passed
		return true;
	}

	/**
	 * Create a Google Docs data source with the specified configuration
	 * @param name Human-readable name for the data source
	 * @param accessToken OAuth2 access token
	 * @param clientId OAuth2 client ID
	 * @param clientSecret OAuth2 client secret
	 * @param registry Object that can create connections
	 * @param options Additional options
	 * @returns A new DataSourceConnection for a Google Docs data source
	 */
	// // Doesn't have access to projectConfig
	// static createGoogleDocsDataSource(
	// 	name: string,
	// 	registry: DataSourceRegistry,
	// 	options: {
	// 		id?: string;
	// 		enabled?: boolean;
	// 		isPrimary?: boolean;
	// 		priority?: number;
	// 		accessToken?: string;
	// 		refreshToken?: string;
	// 		expiresAt?: number;
	// 		scopes?: string;
	// 		folderId?: string;
	// 		driveId?: string;
	// 	} = {},
	// ): DataSourceConnection {
	// 	const provider = registry.getProvider('googledocs', 'bb');
	// 	if (!provider) throw new Error('Could not load Google Docs provider');
	//
	// 	// Create configuration object with optional folder/drive restrictions
	// 	const config: Record<string, unknown> = {};
	// 	if (options.folderId) {
	// 		config.folderId = options.folderId;
	// 	}
	// 	if (options.driveId) {
	// 		config.driveId = options.driveId;
	// 	}
	//
	// 	// Create the connection with Google Docs-specific config
	// 	const connection = registry.createConnection(
	// 		provider,
	// 		name,
	// 		config,
	// 		{
	// 			id: options.id,
	// 			enabled: options.enabled,
	// 			isPrimary: options.isPrimary,
	// 			priority: options.priority,
	// 			auth: {
	// 				method: 'oauth2' as const,
	// 				oauth2: {
	// 					accessToken: options.accessToken,
	// 					refreshToken: options.refreshToken,
	// 					expiresAt: options.expiresAt,
	// 					scopes: options.scopes,
	// 				},
	// 			},
	// 		},
	// 	);
	//
	// 	return connection;
	// }
}
