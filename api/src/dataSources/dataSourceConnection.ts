/**
 * Concrete implementation of DataSourceConnection.
 * Represents a specific configured instance of a data source.
 */
import { logger } from 'shared/logger.ts';
import { generateId } from 'shared/projectData.ts';
import { generateDataSourcePrefix, generateDataSourceUri } from 'shared/dataSource.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type {
	DataSourceConnection as IDataSourceConnection,
	DataSourceConnectionSystemPrompt,
	DataSourceConnectionValues,
} from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';
import type { AuthConfig } from 'api/dataSources/interfaces/authentication.ts';
import type { DataSourceAccessMethod, DataSourceCapability, DataSourceProviderType } from 'shared/types/dataSource.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
import { getDataSourceFactory } from 'api/dataSources/dataSourceFactory.ts';
import {
	//type DataSourceRegistry,
	getDataSourceRegistry,
} from 'api/dataSources/dataSourceRegistry.ts';

/**
 * DataSourceConnection class
 * Concrete implementation of the DataSourceConnection interface
 */
export class DataSourceConnection implements IDataSourceConnection {
	/**
	 * Unique identifier for this connection instance
	 */
	public readonly id: string;

	/**
	 * Reference to the provider instance that handles this connection
	 */
	readonly provider: DataSourceProvider;

	/**
	 * Reference to the provider ID that handles this connection
	 */
	public get providerType(): DataSourceProviderType {
		return this.provider.providerType;
	}

	/**
	 * Access method inherited from the provider
	 */
	public get accessMethod(): DataSourceAccessMethod {
		return this.provider.accessMethod;
	}

	/**
	 * Capabilities inherited from the provider
	 */
	public get capabilities(): DataSourceCapability[] {
		return this.provider.capabilities;
	}

	/**
	 * Description inherited from the provider
	 */
	public get description(): string {
		return this.provider.description;
	}

	/**
	 * URI Prefix for this provider type
	 */
	public readonly uriPrefix?: string;
	public readonly uriTemplate?: string;

	public projectConfig?: ProjectConfig;

	/**
	 * Human-readable name for this connection
	 */
	public name: string;

	/**
	 * Provider-specific configuration
	 */
	public config: Record<string, unknown>;

	/**
	 * Authentication details (optional)
	 */
	public auth?: AuthConfig;

	/**
	 * Whether this connection is active
	 */
	public enabled: boolean;

	/**
	 * Whether this is the primary data source
	 */
	public isPrimary: boolean;

	/**
	 * Priority for ordering (higher = more important)
	 */
	public priority: number;

	//private _dataSourceRegistry!: DataSourceRegistry;
	private _resourceAccessor?: ResourceAccessor;

	/**
	 * Create a new DataSourceConnection instance
	 * @param provider The provider for this connection
	 * @param name Human-readable name
	 * @param config Provider-specific configuration
	 * @param options Additional optional properties
	 */
	constructor(
		provider: DataSourceProvider,
		name: string,
		config: Record<string, unknown>,
		options: {
			id?: string;
			auth?: AuthConfig;
			enabled?: boolean;
			isPrimary?: boolean;
			priority?: number;
			projectConfig?: ProjectConfig;
		} = {},
		//dataSourceRegistry?: DataSourceRegistry,
	) {
		this.id = options.id || `ds-${generateId()}`;
		this.provider = provider;
		this.name = name;
		this.config = { ...config }; // Create a copy to prevent modification of original
		this.auth = options.auth; // May be undefined
		this.enabled = options.enabled !== undefined ? options.enabled : true;
		this.isPrimary = options.isPrimary !== undefined ? options.isPrimary : false;
		this.priority = options.priority !== undefined ? options.priority : 0;
		this.projectConfig = options.projectConfig;
		//if (dataSourceRegistry) {
		//	this._dataSourceRegistry = dataSourceRegistry;
		//} else {
		//	getDataSourceRegistry().then((dataSourceRegistry) => {
		//		this._dataSourceRegistry = dataSourceRegistry;
		//	});
		//}
	}

	/**
	 * Get the URI prefix for this data source
	 * @returns The URI prefix to use for resources from this data source
	 */
	getUriPrefix(): string {
		return this.uriPrefix || generateDataSourcePrefix(this.accessMethod, this.providerType, this.name);
	}

	/**
	 * Get the URI prefix for this data source
	 * @returns The URI prefix to use for resources from this data source
	 */
	getUriForResource(resourceUri: string): string {
		//logger.info(`DataSourceConnection: getUriForResource ${resourceUri}`);
		return resourceUri.startsWith(`${this.accessMethod}+`)
			? resourceUri
			: this.uriPrefix || generateDataSourceUri(this.accessMethod, this.providerType, this.name, resourceUri);
	}

	/**
	 * Get a ResourceAccessor for a data source connection
	 * @returns A ResourceAccessor instance
	 */
	async getResourceAccessor(): Promise<ResourceAccessor> {
		// Check if we already have a cached accessor
		if (this._resourceAccessor) return this._resourceAccessor;

		const factory = await getDataSourceFactory();
		const accessor = await factory.getAccessor(this);

		// Cache the accessor
		this._resourceAccessor = accessor;

		return accessor;
	}

	/**
	 * Get the data source root path (for filesystem sources)
	 * [TODO] This should be delegated to provider to know which fields
	 * in dsConnection have the dsRoot - eg for Notion it should be the workspace, or schema for database provider
	 * @returns The root path or empty string if not defined
	 */
	get dataSourceRoot(): string {
		return (this.config.dataSourceRoot as string) || '';
	}
	set dataSourceRoot(root: string) {
		this.config.dataSourceRoot = root;
	}
	getDataSourceRoot(): string {
		return (this.config.dataSourceRoot as string) || '';
	}
	setDataSourceRoot(root: string): void {
		this.config.dataSourceRoot = root;
	}

	/**
	 * Check if resource path is within this data source
	 * @returns boolean
	 */
	async isResourceWithinDataSource(resourceUri: string): Promise<boolean> {
		const accessor = await this.getResourceAccessor();
		return await accessor.isResourceWithinDataSource(resourceUri);
	}

	/**
	 * Check if resource exists in this data source
	 * @returns boolean
	 */
	async resourceExists(resourceUri: string, options?: { isFile?: boolean }): Promise<boolean> {
		const accessor = await this.getResourceAccessor();
		return await accessor.resourceExists(resourceUri, options);
	}

	/**
	 * Ensure resource path exists in the data source for this accessor
	 * @param resourceUri The resource URI to check
	 */
	async ensureResourcePathExists(resourceUri: string): Promise<void> {
		const accessor = await this.getResourceAccessor();
		await accessor.ensureResourcePathExists(resourceUri);
	}

	/**
	 * Create a formatted object for system prompt
	 * @returns Connection info for system prompt
	 */
	getForSystemPrompt(): DataSourceConnectionSystemPrompt {
		return {
			id: this.id,
			providerType: this.providerType,
			accessMethod: this.accessMethod,
			name: this.name,
			config: this.config,
			isPrimary: this.isPrimary,
			uriPrefix: this.getUriPrefix(),
			uriTemplate: this.provider.uriTemplate,
			capabilities: this.provider.capabilities || [],
		};
	}

	/**
	 * Update this connection with values from another connection
	 * @param updates Properties to update
	 */
	update(updates: Partial<DataSourceConnectionValues>): void {
		// Don't allow changing id, providerType, or accessMethod
		if (updates.name !== undefined) this.name = updates.name;
		if (updates.config !== undefined) this.config = { ...updates.config };
		if (updates.auth !== undefined) this.auth = { ...updates.auth };
		if (updates.enabled !== undefined) this.enabled = updates.enabled;
		if (updates.isPrimary !== undefined) this.isPrimary = updates.isPrimary;
		if (updates.priority !== undefined) this.priority = updates.priority;
	}

	/**
	 * Create a DataSourceConnection from serialized values
	 * @param values Serialized connection values
	 * @returns New DataSourceConnection instance
	 */
	static async fromJSON(values: DataSourceConnectionValues): Promise<DataSourceConnection> {
		const registry = await getDataSourceRegistry();
		const provider = registry.getProvider(values.providerType, values.accessMethod);
		if (!provider) throw new Error('Could not load provider');
		return new DataSourceConnection(
			provider,
			values.name,
			values.config,
			{
				id: values.id,
				auth: values.auth,
				enabled: values.enabled,
				isPrimary: values.isPrimary,
				priority: values.priority,
			},
		);
	}

	/**
	 * Serialize this connection to a plain object for storage
	 * @returns Serialized connection values
	 */
	toJSON(): DataSourceConnectionValues {
		return {
			id: this.id,
			providerType: this.providerType,
			accessMethod: this.accessMethod,
			name: this.name,
			config: { ...this.config },
			auth: this.auth ? { ...this.auth } : undefined,
			enabled: this.enabled,
			isPrimary: this.isPrimary,
			priority: this.priority,
		};
	}

	/**
	 * Convert DataSource objects to filesystem paths
	 */
	static getDataSourcePathsFromDsConnections(dsConnections: DataSourceConnectionValues[]): string[] {
		const paths: string[] = [];

		for (const dsConnection of dsConnections) {
			if (dsConnection.providerType === 'filesystem' && dsConnection.config.dataSourceRoot) {
				paths.push(dsConnection.config.dataSourceRoot as string);
			}
		}

		return paths;
	}

	/**
	 * Convert filesystem paths to DataSource objects
	 */
	static async getDsConnectionsFromPaths(dataSourcePaths: string[]): Promise<DataSourceConnection[]> {
		const dsConnections: DataSourceConnection[] = [];

		const registry = await getDataSourceRegistry();
		const provider = registry.getProvider('filesystem', 'bb');
		if (!provider) throw new Error('Could not load provider');

		for (let i = 0; i < dataSourcePaths.length; i++) {
			const path = dataSourcePaths[i];
			dsConnections.push(
				new DataSourceConnection(
					provider,
					i === 0 ? 'local' : `local-${i}`, //name
					{ dataSourceRoot: path },
					{
						//id: i === 0 ? 'ds-local' : `ds-local-${i}`,
						isPrimary: i === 0,
						//capabilities: ['read', 'write', 'list', 'search'],
					},
				),
			);
		}

		return dsConnections;
	}
}
