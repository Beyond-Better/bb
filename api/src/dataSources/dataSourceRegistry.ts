/**
 * DataSourceRegistry singleton for managing available data source providers.
 */
import { logger } from 'shared/logger.ts';
import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';
//import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import type {
	DataSourceAccessMethod,
	DataSourceAuth,
	DataSourceCapability,
	DataSourceProviderType,
} from 'shared/types/dataSource.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import { FilesystemProvider } from 'api/dataSources/filesystemProvider.ts';
import { NotionProvider } from 'api/dataSources/notionProvider.ts';
import { GenericMCPProvider } from 'api/dataSources/genericMCPProvider.ts';

/**
 * Registry of available data source providers
 * Singleton class that manages registration and discovery of providers
 */
export class DataSourceRegistry {
	private static instance: DataSourceRegistry;
	private static testInstances = new Map<string, DataSourceRegistry>();
	private static pendingInitOperation: Promise<DataSourceRegistry> | null = null;

	// Separate maps for BB and MCP providers
	private bbProvidersMap: Map<string, DataSourceProvider> = new Map();
	private mcpProvidersMap: Map<string, DataSourceProvider> = new Map();

	private get bbProviders(): DataSourceProvider[] {
		return Array.from(this.bbProvidersMap.values());
	}
	private get mcpProviders(): DataSourceProvider[] {
		return Array.from(this.mcpProvidersMap.values());
	}

	private mcpManager!: MCPManager;
	private initialized = false;

	/**
	 * Private constructor - use getInstance() instead
	 */
	private constructor() {}

	/**
	 * Gets the singleton instance of the DataSourceRegistry
	 */
	public static async getInstance(): Promise<DataSourceRegistry> {
		if (!DataSourceRegistry.instance) {
			logger.warn('DataSourceRegistry: Creating the instance of dataSourceRegistry');

			// If we don't have an instance but initialization is in progress, wait for it
			if (DataSourceRegistry.pendingInitOperation) {
				logger.info('DataSourceRegistry: Waiting for in-progress initialization');
				return await DataSourceRegistry.pendingInitOperation;
			}

			// Create new instance
			const registryInstance = new DataSourceRegistry();

			// Create a promise for the initialization and store it
			DataSourceRegistry.pendingInitOperation = (async () => {
				try {
					await registryInstance.init();
					// Set the singleton instance only after initialization succeeds
					DataSourceRegistry.instance = registryInstance;
					return registryInstance;
				} finally {
					// Clear the pending operation when done (whether successful or not)
					DataSourceRegistry.pendingInitOperation = null;
				}
			})();

			// Wait for the initialization to complete
			return await DataSourceRegistry.pendingInitOperation;
		}
		logger.warn('DataSourceRegistry: Returning the instance of dataSourceRegistry');
		return DataSourceRegistry.instance;
	}

	/**
	 * Get a one-use instance (for testing)
	 */
	public static async getOneUseInstance(): Promise<DataSourceRegistry> {
		logger.warn(
			'DataSourceRegistry: Creating a ONE-TIME instance of dataSourceRegistry - USE ONLY FOR TESTING',
		);
		const registryInstance = new DataSourceRegistry();
		await registryInstance.init();
		return registryInstance;
	}

	/**
	 * Get a test instance with a specific ID (for testing)
	 */
	public static async getTestInstance(testId: string): Promise<DataSourceRegistry> {
		if (!DataSourceRegistry.testInstances.has(testId)) {
			logger.warn(
				`DataSourceRegistry: Creating a TEST instance of dataSourceRegistry with ID: ${testId}`,
			);
			const registryInstance = new DataSourceRegistry();
			await registryInstance.init();
			DataSourceRegistry.testInstances.set(testId, registryInstance);
		}
		return DataSourceRegistry.testInstances.get(testId)!;
	}

	/**
	 * Initialize the DataSourceRegistry
	 */
	async init(): Promise<DataSourceRegistry> {
		if (this.initialized) {
			return this;
		}

		logger.info('DataSourceRegistry: Initializing');
		this.mcpManager = await getMCPManager();
		this.initialized = true;

		this.registerBBProviders();
		logger.info('DataSourceRegistry: Registered BB providers');

		// Discover and register MCP servers
		await this.registerMCPServers();
		logger.info('DataSourceRegistry: Registered MCP providers');

		return this;
	}

	/**
	 * Register a data source provider
	 * @param provider The provider to register
	 */
	registerProvider(provider: DataSourceProvider): void {
		// Use different maps based on access method
		logger.info('DataSourceRegistry: Registering provider', {
			accessMethod: provider.accessMethod,
			providerType: provider.providerType,
		});
		if (provider.accessMethod === 'bb') {
			if (this.bbProvidersMap.has(provider.providerType)) {
				logger.warn(`DataSourceRegistry: BB provider ${provider.providerType} already registered, replacing`);
			}
			this.bbProvidersMap.set(provider.providerType, provider);
			logger.info(`DataSourceRegistry: Registered BB provider ${provider.providerType}`);
		} else if (provider.accessMethod === 'mcp') {
			if (this.mcpProvidersMap.has(provider.providerType)) {
				logger.warn(`DataSourceRegistry: MCP provider ${provider.providerType} already registered, replacing`);
			}
			this.mcpProvidersMap.set(provider.providerType, provider);
			logger.info(`DataSourceRegistry: Registered MCP provider ${provider.providerType}`);
		} else {
			// Should never happen due to type system, but let's be safe
			logger.error(
				`DataSourceRegistry: Invalid access method ${provider.accessMethod} for provider ${provider.providerType}`,
			);
			throw new Error(`Invalid access method ${provider.accessMethod} for provider ${provider.providerType}`);
		}
	}

	/**
	 * Get a provider by providerType
	 * @param providerType The providerType of the provider to get
	 * @param accessMethod optional The accessMethod of the provider to get
	 * @returns The provider or undefined if not found
	 */
	getProvider(
		providerType: DataSourceProviderType,
		accessMethod?: DataSourceAccessMethod,
	): DataSourceProvider | undefined {
		// Check BB providers first, then MCP providers
		logger.info('DataSourceRegistry: Getting provider', {
			accessMethod,
			providerType,
		});
		return accessMethod && accessMethod === 'bb'
			? this.bbProvidersMap.get(providerType)
			: accessMethod && accessMethod === 'mcp'
			? this.mcpProvidersMap.get(providerType)
			: (this.bbProvidersMap.get(providerType) || this.mcpProvidersMap.get(providerType));
	}

	/**
	 * Get all registered providers
	 * @returns Array of all providers
	 */
	getAllProviders(): DataSourceProvider[] {
		return [
			...this.bbProviders,
			...this.mcpProviders,
		];
	}

	/**
	 * Get providers by access method
	 * @param accessMethod The access method to filter by
	 * @returns Array of providers with the specified access method
	 */
	getProvidersByAccessMethod(accessMethod: 'bb' | 'mcp'): DataSourceProvider[] {
		if (accessMethod === 'bb') {
			return this.bbProviders;
		} else {
			return this.mcpProviders;
		}
	}

	/**
	 * Get providers by capability
	 * @param capability The capability to filter by
	 * @returns Array of providers that support the capability
	 */
	getProvidersByCapability(capability: DataSourceCapability): DataSourceProvider[] {
		return this.getAllProviders().filter(
			(provider) => provider.capabilities.includes(capability),
		);
	}

	/**
	 * Get data source types filtered by optional MCP server IDs
	 * @param mcpServers Optional array of MCP server IDs to filter MCP data sources
	 * @returns Array of data source type information (all BB types and matching MCP types)
	 */
	getFilteredProviders(mcpServers?: string[]): DataSourceProvider[] {
		// Always include all BB types
		const bbProviders = this.bbProviders;

		if (!mcpServers || mcpServers.length === 0) {
			// If no MCP servers specified, return only bb types
			return bbProviders;
			// // If no MCP servers specified, return all types
			// return this.getAllTypes();
		}

		// Get MCP types filtered by the server IDs
		const mcpProviders = this.mcpProviders
			.filter((provider) => mcpServers.includes(provider.providerType));

		// Combine and return
		return [...bbProviders, ...mcpProviders];
	}

	/**
	 * Create a new connection for a provider
	 * @param providerType The providerType of the provider
	 * @param name Human-readable name for the connection
	 * @param config Provider-specific configuration
	 * @param options Additional options
	 * @returns A new DataSourceConnection
	 */
	createConnection(
		provider: DataSourceProvider,
		name: string,
		config: Record<string, unknown>,
		options: {
			id?: string;
			auth?: DataSourceAuth;
			enabled?: boolean;
			isPrimary?: boolean;
			priority?: number;
		} = {},
	): DataSourceConnection {
		// Validate the configuration and auth
		if (
			!provider.validateConfig(config) ||
			(options.auth && !provider.validateAuth(options.auth))
		) {
			throw new Error(`Invalid configuration or auth for provider ${provider.providerType}`);
		}

		// Create the connection
		return new DataSourceConnection(
			provider,
			name,
			config,
			options,
		);
	}

	/**
	 * register BB providers
	 */
	registerBBProviders(): void {
		try {
			// Clear existing BB providers
			this.bbProvidersMap.clear();

			this.registerProvider(new FilesystemProvider());
			this.registerProvider(new NotionProvider());
		} catch (error) {
			logger.error('DataSourceRegistry: Error registering MCP servers:', error);
		}
	}

	/**
	 * Discover and register MCP servers as providers
	 */
	async registerMCPServers(): Promise<void> {
		try {
			// Clear existing MCP providers
			this.mcpProvidersMap.clear();

			// Get all available MCP servers
			const serverIds = await this.mcpManager.getServers();
			logger.info(`DataSourceRegistry: Discovered ${serverIds.length} MCP servers`);

			// Register each server as a provider
			for (const serverId of serverIds) {
				try {
					// Get server configuration
					const serverConfig = this.mcpManager.getMCPServerConfiguration(serverId);
					if (!serverConfig) {
						logger.warn(`DataSourceRegistry: No configuration found for MCP server ${serverId}, skipping`);
						continue;
					}

					// Check if this server provides any resource types
					const resources = await this.mcpManager.listResources(serverId);
					if (resources.length === 0) {
						logger.debug(`DataSourceRegistry: MCP server ${serverId} has no resources, skipping`);
						continue;
					}
					logger.info(
						`DataSourceRegistry: Discovered MCP server ${serverId} with ${resources.length} resources`,
					);

					const capabilities = this.mcpManager.getServerCapabilities(serverId) || [];
					// [TODO] We're creating the provider, but we need an existing provider to get the requiredConfigFields so we can create the provider
					// Where does requiredConfigFields need to come from??
					// const provider = this.getProvider(serverId, 'mcp');
					// const requiredConfigFields = provider?.requiredConfigFields || [];
					const requiredConfigFields = [] as string[];
					this.registerProvider(
						new GenericMCPProvider(
							serverId,
							serverConfig.name || serverId,
							serverConfig.description || `Provider for ${serverConfig.name || serverId}`,
							capabilities,
							requiredConfigFields,
							this.mcpManager,
						),
					);
				} catch (error) {
					logger.error(`DataSourceRegistry: Error registering MCP server ${serverId}:`, error);
				}
			}
		} catch (error) {
			logger.error('DataSourceRegistry: Error registering MCP servers:', error);
		}
	}
}

/**
 * Gets the global DataSourceRegistry instance
 */
export async function getDataSourceRegistry(): Promise<DataSourceRegistry> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_DATASOURCE_REGISTRY'); // Used for testing
	if (noSingleton) return await DataSourceRegistry.getOneUseInstance();

	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // Used for testing
	if (testId) return await DataSourceRegistry.getTestInstance(testId);

	return await DataSourceRegistry.getInstance();
}