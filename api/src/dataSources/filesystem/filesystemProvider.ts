/**
 * FilesystemProvider class for BB-managed filesystem data sources.
 */
import { logger } from 'shared/logger.ts';
import { BBDataSourceProvider } from '../base/bbDataSourceProvider.ts';
import { FilesystemAccessor } from './filesystemAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';

/**
 * FilesystemProvider for BB-managed filesystem data sources
 * Extends BBDataSourceProvider to provide filesystem-specific functionality
 */
export class FilesystemProvider extends BBDataSourceProvider {
	/**
	 * Create a new FilesystemProvider instance
	 */
	constructor() {
		super(
			'filesystem', // Provider ID
			'Filesystem', // Human-readable name
			'Local filesystem access', // Description
			['read', 'write', 'list', 'search', 'move', 'delete'], // Capabilities
			['dataSourceRoot'], // Required config fields
		);

		logger.debug('FilesystemProvider: Created filesystem provider');
	}

	/**
	 * Create a ResourceAccessor for a filesystem data source
	 * @param connection The connection to create an accessor for
	 * @returns A FilesystemAccessor instance
	 */
	createAccessor(connection: DataSourceConnection): ResourceAccessor {
		// Verify the connection is for this provider
		if (connection.providerType !== this.providerType) {
			throw new Error(
				`Connection provider ID mismatch: expected ${this.providerType}, got ${connection.providerType}`,
			);
		}

		// Create a new FilesystemAccessor
		return new FilesystemAccessor(connection);
	}

	/**
	 * Validate configuration for filesystem data source
	 * @param config The configuration to validate
	 * @returns True if the configuration is valid, false otherwise
	 */
	override validateConfig(config: Record<string, unknown>): boolean {
		// First check using the base validation
		if (!super.validateConfig(config)) {
			return false;
		}

		// Check that dataSourceRoot is a string
		if (typeof config.dataSourceRoot !== 'string') {
			logger.warn(`FilesystemProvider: dataSourceRoot must be a string, got ${typeof config.dataSourceRoot}`);
			return false;
		}

		// Check that dataSourceRoot is not empty
		if (config.dataSourceRoot === '') {
			logger.warn('FilesystemProvider: dataSourceRoot cannot be empty');
			return false;
		}

		// All checks passed
		return true;
	}


	/**
	 * Create a filesystem data source with the specified configuration
	 * @param name Human-readable name for the data source
	 * @param rootPath The filesystem root path
	 * @param options Additional options
	 * @returns A new DataSourceConnection for a filesystem data source
	 */
	static createFileSystemDataSource(
		name: string,
		rootPath: string,
		registry: DataSourceRegistry,
		options: {
			id?: string;
			enabled?: boolean;
			isPrimary?: boolean;
			priority?: number;
		} = {},
	): DataSourceConnection {
		const provider = registry.getProvider('filesystem', 'bb');
		if (!provider) throw new Error('Could not load provider');
		//logger.info('FilesystemProvider: Using provider', { provider });
		return registry.createConnection(
			provider,
			name,
			{ dataSourceRoot: rootPath },
			options,
		);
	}
}
