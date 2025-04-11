/**
 * DataSourceRegistry class for managing available data source types
 */
import type { DataSourceType } from 'api/resources/dataSource.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import { logger } from 'shared/logger.ts';

/**
 * Information about a data source type
 */
export interface DataSourceTypeInfo {
	id: string;
	name: string;
	type: DataSourceType;
	accessMethod: 'bb' | 'mcp';
	capabilities: string[];
	description?: string;
	configFields?: string[]; // For future use
}

/**
 * Registry of available data source types
 */
export class DataSourceRegistry {
	private static instance: DataSourceRegistry;
	private static testInstances = new Map<string, DataSourceRegistry>();
	private bbTypes: DataSourceTypeInfo[] = [];
	private mcpTypesMap: Map<string, DataSourceTypeInfo> = new Map();
	private get mcpTypes(): DataSourceTypeInfo[] {
		return Array.from(this.mcpTypesMap.values());
	}

	private mcpManager!: MCPManager;
	//private initialized = false;

	/**
	 * Craete DataSourceRegistry using the MCP Manager for dynamic discovery of MCP data sources
	 * @param mcpManager The MCP Manager instance
	 */
	private constructor() {}

	/**
	 * Gets the singleton instance of the DataSourceRegistry
	 */
	public static async getInstance(): Promise<DataSourceRegistry> {
		if (!DataSourceRegistry.instance) {
			DataSourceRegistry.instance = new DataSourceRegistry();
			await DataSourceRegistry.instance.init();
		}
		return DataSourceRegistry.instance;
	}

	// used for testing - constructor is private so create instance here
	public static async getOneUseInstance(): Promise<DataSourceRegistry> {
		logger.warn(
			`DataSourceRegistry: Creating a ONE-TIME instance of dataSourceRegistry - USE ONLY FOR TESTING`,
		);
		const instance = new DataSourceRegistry();
		await instance.init();
		return instance;
	}
	public static async getTestInstance(testId: string): Promise<DataSourceRegistry> {
		if (!DataSourceRegistry.testInstances.has(testId)) {
			logger.warn(
				`DataSourceRegistry: Creating a TEST instance of dataSourceRegistry with ID: ${testId}`,
			);
			const instance = new DataSourceRegistry();
			await instance.init();
			DataSourceRegistry.testInstances.set(testId, instance);
		}
		return DataSourceRegistry.testInstances.get(testId)!;
	}

	/**
	 * Initialize the DataSourceRegistry instance
	 */
	async init(): Promise<DataSourceRegistry> {
		logger.info(`DataSourceRegistry: Initializing`);
		this.mcpManager = await getMCPManager();
		//this.initialized = true;
		// Register  data source types
		this.registerBBTypes();
		this.registerMCPTypes();
		return this;
	}

	/**
	 * Ensure the instance is initialized
	 */
	//private async ensureInitialized(): Promise<void> {
	//	if (!this.initialized) {
	//		await this.init();
	//	}
	//}

	/**
	 * Register built-in BB data source types
	 */
	private registerBBTypes(): void {
		this.bbTypes = [
			{
				id: 'filesystem',
				name: 'Filesystem',
				type: 'filesystem',
				accessMethod: 'bb',
				capabilities: ['read', 'write', 'list', 'search'],
				description: 'Local filesystem access',
			},
			{
				id: 'notion',
				name: 'Notion',
				type: 'notion',
				accessMethod: 'bb',
				capabilities: ['read', 'list'],
				description: 'Notion workspace integration',
			},
			// Additional BB types can be added here
		];
	}

	/**
	 * Refresh the list of available MCP data source types
	 */
	async registerMCPTypes(): Promise<void> {
		this.mcpTypesMap.clear();
		const serverIds = await this.mcpManager.getServers();

		for (const serverId of serverIds) {
			try {
				const serverConfig: MCPServerConfig | null = this.mcpManager.getMCPServerConfiguration(serverId);
				if (!serverConfig) continue;

				// Get resources for this server
				const resources = await this.mcpManager.listResources(serverId);
				if (resources.length === 0) continue;

				// Create type info
				const typeInfo: DataSourceTypeInfo = {
					id: serverId,
					name: serverConfig.name || `MCP: ${serverId}`,
					type: serverId,
					accessMethod: 'mcp',
					capabilities: ['read', 'list'],
					description: serverConfig.description || `MCP Server: ${serverId}`,
				};

				this.mcpTypesMap.set(serverId, typeInfo);
			} catch (error) {
				logger.error(`DataSourceRegistry: Error registering MCP server ${serverId}:`, error);
			}
		}
	}

	/**
	 * Get all available data source types
	 * @returns Array of data source type information
	 */
	getAllTypes(): DataSourceTypeInfo[] {
		return [
			...this.bbTypes,
			...this.mcpTypes,
		];
	}

	getBBTypes(): DataSourceTypeInfo[] {
		return this.bbTypes;
	}
	getMCPTypes(): DataSourceTypeInfo[] {
		return this.mcpTypes;
	}

	/**
	 * Get data source types by access method
	 * @param accessMethod The access method to filter by ('bb' or 'mcp')
	 * @returns Array of data source type information
	 */
	getTypesByAccessMethod(accessMethod: 'bb' | 'mcp'): DataSourceTypeInfo[] {
		if (accessMethod === 'bb') {
			return this.bbTypes;
		} else {
			return this.mcpTypes;
		}
	}

	/**
	 * Get data source types filtered by optional MCP server IDs
	 * @param mcpServers Optional array of MCP server IDs to filter MCP data sources
	 * @returns Array of data source type information (all BB types and matching MCP types)
	 */
	getFilteredTypes(mcpServers?: string[]): DataSourceTypeInfo[] {
		// Always include all BB types
		const bbTypes = this.bbTypes;

		if (!mcpServers || mcpServers.length === 0) {
			// If no MCP servers specified, return only bb types
			return bbTypes;
			// // If no MCP servers specified, return all types
			// return this.getAllTypes();
		}

		// Get MCP types filtered by the server IDs
		const mcpTypes = this.mcpTypes
			.filter((type) => mcpServers.includes(type.id));

		// Combine and return
		return [...bbTypes, ...mcpTypes];
	}

	/**
	 * Get information about a specific data source type
	 * @param typeId The ID of the data source type
	 * @returns Data source type information or undefined if not found
	 */
	getTypeInfo(typeId: string): DataSourceTypeInfo | undefined {
		return this.bbTypes.find((t) => t.id === typeId) ||
			this.mcpTypesMap.get(typeId);
	}
}

/**
 * Gets the global dataSourceRegistry instance
 */
export async function getDataSourceRegistry(): Promise<DataSourceRegistry> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_DATASOURCE_REGISTRY'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return DataSourceRegistry.getOneUseInstance();
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return DataSourceRegistry.getTestInstance(testId);
	return DataSourceRegistry.getInstance();
}
