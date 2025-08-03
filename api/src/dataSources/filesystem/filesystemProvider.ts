/**
 * FilesystemProvider class for BB-managed filesystem data sources.
 */
import { logger } from 'shared/logger.ts';
import { BBDataSourceProvider } from '../base/bbDataSourceProvider.ts';
import { FilesystemAccessor } from './filesystemAccessor.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type {
	DataSourceCapability,
	DataSourceEditCapability,
	DataSourceLoadCapability,
	DataSourceProviderStructuredQuerySchema,
	DataSourceSearchCapability,
} from 'shared/types/dataSource.ts';
import type { AcceptedContentType, AcceptedEditType, ContentTypeGuidance } from 'shared/types/dataSource.ts';

/**
 * FilesystemProvider for BB-managed filesystem data sources
 * Extends BBDataSourceProvider to provide filesystem-specific functionality
 */
export class FilesystemProvider extends BBDataSourceProvider {
	/**
	 * Content types this provider accepts
	 */
	public readonly acceptedContentTypes: AcceptedContentType[] = ['plainTextContent', 'binaryContent'];

	/**
	 * Edit approaches this provider supports
	 */
	public readonly acceptedEditTypes: AcceptedEditType[] = ['searchReplace'];

	/**
	 * Preferred content type for filesystem operations
	 */
	public readonly preferredContentType: AcceptedContentType = 'plainTextContent';

	public capabilities: DataSourceCapability[] = [
		'read',
		'write',
		'list',
		'search',
		'move',
		'delete',
	];
	public loadCapabilities: DataSourceLoadCapability[] = [
		'plainText',
		//'structured',
		//'both',
	];
	public editCapabilities: DataSourceEditCapability[] = [
		'searchReplaceOperations',
		//'rangeOperations',
		//'blockOperations',
		//'textFormatting', // Plain text only
		//'paragraphFormatting',
		//'tables',
		//'colors',
		//'fonts',
	];
	public searchCapabilities: DataSourceSearchCapability[] = [
		'textSearch',
		'regexSearch',
		'structuredQuerySearch',
	];

	public structuredQuerySchema: DataSourceProviderStructuredQuerySchema | undefined = {
		description: 'File search with filters',
		examples: [{
			description: 'Find TypeScript files modified this week containing TODO',
			query: {
				text: 'TODO',
				filters: {
					extension: '.ts',
					modifiedAfter: '2024-08-01',
					path: 'src/',
				},
			},
		}],
		schema: {
			type: 'object',
			properties: {
				text: { type: 'string' },
				filters: {
					type: 'object',
					properties: {
						extension: { type: 'string' },
						path: { type: 'string' },
						modifiedAfter: { type: 'string', format: 'date' },
						modifiedBefore: { type: 'string', format: 'date' },
						sizeMin: { type: 'number' },
						sizeMax: { type: 'number' },
					},
				},
			},
		},
	};

	/**
	 * Create a new FilesystemProvider instance
	 */
	constructor() {
		super(
			'filesystem', // Provider ID
			'Filesystem', // Human-readable name
			'Local filesystem access', // Description
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

		// Check that strictRoot is a boolean if present
		if (config.strictRoot !== undefined && typeof config.strictRoot !== 'boolean') {
			logger.warn(`FilesystemProvider: strictRoot must be a boolean, got ${typeof config.strictRoot}`);
			return false;
		}
		// Check that followSymlinks is a boolean if present
		if (config.followSymlinks !== undefined && typeof config.followSymlinks !== 'boolean') {
			logger.warn(`FilesystemProvider: followSymlinks must be a boolean, got ${typeof config.followSymlinks}`);
			return false;
		}

		// All checks passed
		return true;
	}

	/**
	 * Get content type guidance for filesystem data source
	 * @returns ContentTypeGuidance with filesystem-specific examples and constraints
	 */
	getContentTypeGuidance(): ContentTypeGuidance {
		return {
			primaryContentType: 'plain-text',
			acceptedContentTypes: this.acceptedContentTypes,
			acceptedEditTypes: this.acceptedEditTypes,
			preferredContentType: this.preferredContentType,
			capabilities: this.capabilities,
			loadCapabilities: this.loadCapabilities,
			editCapabilities: this.editCapabilities,
			searchCapabilities: this.searchCapabilities,
			structuredQuerySchema: this.structuredQuerySchema,
			examples: [
				{
					description: 'Create a new TypeScript file with plain text content',
					toolCall: {
						tool: 'write_resource',
						input: {
							resourcePath: 'src/newFile.ts',
							plainTextContent: {
								content: 'export const config = {\n  apiUrl: "https://api.example.com"\n};',
								expectedLineCount: 3,
								acknowledgement:
									'See write_resource input schema for exact acknowledgement requirements',
							},
						},
					},
				},
				{
					description: 'Edit existing file using search and replace',
					toolCall: {
						tool: 'edit_resource',
						input: {
							resourcePath: 'src/config.ts',
							operations: [
								{
									editType: 'searchReplace',
									searchReplace_search: 'localhost',
									searchReplace_replace: 'production.example.com',
									searchReplace_replaceAll: true,
								},
							],
						},
					},
				},
				{
					description: 'Create binary file (image, document, etc.)',
					toolCall: {
						tool: 'write_resource',
						input: {
							resourcePath: 'assets/icon.png',
							binaryContent: {
								data:
									'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
								mimeType: 'image/png',
							},
						},
					},
				},
			],
			notes: [
				'Filesystem data sources work with individual files and directories',
				'Plain text content is preferred for code, configuration, and documentation files',
				'Binary content is supported for images, PDFs, and other non-text files',
				'Search and replace operations work on multi-line string content with optional regex support',
				'All file operations are constrained to the configured data source root directory',
			],
		};
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
			strictRoot?: number;
			followSymlinks?: number;
			projectConfig?: ProjectConfig;
		} = {},
	): DataSourceConnection {
		const provider = registry.getProvider('filesystem', 'bb');
		if (!provider) throw new Error('Could not load provider');
		//logger.info('FilesystemProvider: Using provider', { provider });
		return registry.createConnection(
			provider,
			name,
			{
				dataSourceRoot: rootPath,
				strictRoot: options.strictRoot ?? true,
				followSymlinks: options.followSymlinks ?? true,
			},
			options,
		);
	}
}
