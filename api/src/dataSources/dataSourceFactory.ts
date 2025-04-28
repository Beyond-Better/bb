/**
 * DataSourceFactory singleton for creating ResourceAccessor instances.
 */
import { logger } from 'shared/logger.ts';
import type { DataSourceConnection } from 'api/dataSources/interfaces/dataSourceConnection.ts';
import type { ResourceAccessor } from 'api/dataSources/interfaces/resourceAccessor.ts';
//import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
//import { getMCPManager } from 'api/mcp/mcpManager.ts';

/**
 * Factory for creating ResourceAccessor instances
 * Singleton class that manages creation and caching of accessors
 */
export class DataSourceFactory {
  private static instance: DataSourceFactory;
  private static testInstances = new Map<string, DataSourceFactory>();
  
  // Separate caches for BB and MCP accessors
  private bbAccessorCache: Map<string, ResourceAccessor> = new Map();
  private mcpAccessorCache: Map<string, ResourceAccessor> = new Map();
  
  private initialized = false;

  /**
   * Private constructor - use getInstance() instead
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the DataSourceFactory
   */
  public static async getInstance(): Promise<DataSourceFactory> {
    if (!DataSourceFactory.instance) {
      DataSourceFactory.instance = new DataSourceFactory();
      await DataSourceFactory.instance.init();
    }
    return DataSourceFactory.instance;
  }

  /**
   * Get a one-use instance (for testing)
   */
  public static async getOneUseInstance(): Promise<DataSourceFactory> {
    logger.warn(
      'DataSourceFactory: Creating a ONE-TIME instance of dataSourceFactory - USE ONLY FOR TESTING',
    );
    const instance = new DataSourceFactory();
    await instance.init();
    return instance;
  }

  /**
   * Get a test instance with a specific ID (for testing)
   */
  public static async getTestInstance(testId: string): Promise<DataSourceFactory> {
    if (!DataSourceFactory.testInstances.has(testId)) {
      logger.warn(
        `DataSourceFactory: Creating a TEST instance of dataSourceFactory with ID: ${testId}`,
      );
      const instance = new DataSourceFactory();
      await instance.init();
      DataSourceFactory.testInstances.set(testId, instance);
    }
    return DataSourceFactory.testInstances.get(testId)!;
  }

  /**
   * Initialize the DataSourceFactory
   */
  async init(): Promise<DataSourceFactory> {
    if (this.initialized) {
      return this;
    }
    
    logger.info('DataSourceFactory: Initializing');
    this.initialized = true;
    
    return this;
  }

  /**
   * Get a ResourceAccessor for a DataSourceConnection
   * Creates a new accessor or returns a cached one
   * @param connection The connection to get an accessor for
   * @returns A ResourceAccessor instance
   */
  async getAccessor(connection: DataSourceConnection): Promise<ResourceAccessor> {
    // Route based on access method
    if (connection.accessMethod === 'bb') {
      return this.getBBAccessor(connection);
    } else if (connection.accessMethod === 'mcp') {
      return this.getMCPAccessor(connection);
    } else {
      // Should never happen due to type system, but let's be safe
      throw new Error(`Unknown access method: ${connection.accessMethod}`);
    }
  }

  /**
   * Get a ResourceAccessor for a BB-managed DataSourceConnection
   * @param connection The connection to get an accessor for
   * @returns A ResourceAccessor instance
   */
  private async getBBAccessor(connection: DataSourceConnection): Promise<ResourceAccessor> {
    // Check cache first
    if (this.bbAccessorCache.has(connection.id)) {
      return this.bbAccessorCache.get(connection.id)!;
    }

    // Look up the provider for this connection
    const registry = await getDataSourceRegistry();
    const provider = registry.getProvider(connection.providerType, connection.accessMethod);
    
    if (!provider) {
      throw new Error(`Provider not found for connection: ${connection.id} (${connection.providerType})`);
    }
    
    if (provider.accessMethod !== 'bb') {
      throw new Error(
        `Access method mismatch: Expected 'bb' but got '${provider.accessMethod}' for provider ${provider.providerType}`,
      );
    }

    // Create a new accessor using the provider's factory method
    const accessor = provider.createAccessor(connection);
    
    // Cache the accessor for future use
    this.bbAccessorCache.set(connection.id, accessor);
    
    logger.debug(`DataSourceFactory: Created BB accessor for ${connection.id} (${connection.name})`);
    return accessor;
  }

  /**
   * Get a ResourceAccessor for an MCP-managed DataSourceConnection
   * @param connection The connection to get an accessor for
   * @returns A ResourceAccessor instance
   */
  private async getMCPAccessor(connection: DataSourceConnection): Promise<ResourceAccessor> {
    // Check cache first
    if (this.mcpAccessorCache.has(connection.id)) {
      return this.mcpAccessorCache.get(connection.id)!;
    }

    // Look up the provider for this connection
    const registry = await getDataSourceRegistry();
    const provider = registry.getProvider(connection.providerType, connection.accessMethod);
    
    if (!provider) {
      throw new Error(`Provider not found for connection: ${connection.id} (${connection.providerType})`);
    }
    
    if (provider.accessMethod !== 'mcp') {
      throw new Error(
        `Access method mismatch: Expected 'mcp' but got '${provider.accessMethod}' for provider ${provider.providerType}`,
      );
    }

    // Get the MCPManager instance
    //const mcpManager = await getMCPManager();

    // Create a new accessor using the provider's factory method
    const accessor = provider.createAccessor(connection);
    
    // Cache the accessor for future use
    this.mcpAccessorCache.set(connection.id, accessor);
    
    logger.debug(`DataSourceFactory: Created MCP accessor for ${connection.id} (${connection.name})`);
    return accessor;
  }

  /**
   * Clear all accessor caches
   * Useful for testing and memory management
   */
  clearCache(): void {
    this.bbAccessorCache.clear();
    this.mcpAccessorCache.clear();
    logger.debug('DataSourceFactory: Cleared accessor caches');
  }

  /**
   * Clear the accessor cache for a specific connection
   * @param connectionId The ID of the connection to clear
   */
  clearConnectionCache(connectionId: string): void {
    const bbRemoved = this.bbAccessorCache.delete(connectionId);
    const mcpRemoved = this.mcpAccessorCache.delete(connectionId);
    
    if (bbRemoved || mcpRemoved) {
      logger.debug(`DataSourceFactory: Cleared accessor cache for connection ${connectionId}`);
    }
  }
}

/**
 * Gets the global DataSourceFactory instance
 */
export async function getDataSourceFactory(): Promise<DataSourceFactory> {
  const noSingleton = Deno.env.get('BB_NO_SINGLETON_DATASOURCE_FACTORY'); // Used for testing
  if (noSingleton) return DataSourceFactory.getOneUseInstance();
  
  const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // Used for testing
  if (testId) return DataSourceFactory.getTestInstance(testId);
  
  return DataSourceFactory.getInstance();
}