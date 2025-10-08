import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { GlobalConfig, MCPServerConfig } from 'shared/config/types.ts';
import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';

/**
 * MCPServerRegistry - Manages MCP server configurations and registry operations
 *
 * Responsibilities:
 * - Server configuration management (add, remove, get)
 * - Server capabilities tracking
 * - Configuration persistence
 * - Server map coordination and ownership
 */
export class MCPServerRegistry {
	private servers: Map<string, McpServerInfo> = new Map();
	private globalConfig: GlobalConfig;

	constructor(globalConfig: GlobalConfig) {
		this.globalConfig = globalConfig;
	}

	/**
	 * Get the servers map (read-only access for other services)
	 * @returns The servers map
	 */
	get serversMap(): Map<string, McpServerInfo> {
		return this.servers;
	}

	/**
	 * Check if a server exists by ID
	 * @param serverId Server ID to check
	 * @returns True if server exists
	 */
	has(serverId: string): boolean {
		return this.servers.has(serverId);
	}

	/**
	 * Get server info by ID
	 * @param serverId Server ID to get
	 * @returns Server info or undefined
	 */
	get(serverId: string): McpServerInfo | undefined {
		return this.servers.get(serverId);
	}

	/**
	 * Set server info by ID
	 * @param serverId Server ID
	 * @param serverInfo Server info to set
	 */
	set(serverId: string, serverInfo: McpServerInfo): void {
		this.servers.set(serverId, serverInfo);
	}

	/**
	 * Delete server by ID
	 * @param serverId Server ID to delete
	 * @returns True if server existed and was deleted
	 */
	delete(serverId: string): boolean {
		return this.servers.delete(serverId);
	}

	/**
	 * Clear all servers
	 */
	clear(): void {
		this.servers.clear();
	}

	/**
	 * Add a new MCP server configuration dynamically without restarting the API
	 * This supports both STDIO and HTTP transports, with proper OAuth handling
	 */
	public async addServer(config: MCPServerConfig): Promise<void> {
		logger.info(`MCPServerRegistry: Adding new server configuration: ${config.id}`);

		// Validate configuration
		if (!config.id || !config.name) {
			throw createError(
				ErrorType.ExternalServiceError,
				'Server configuration must have id and name',
				{
					name: 'mcp-invalid-config',
					service: 'mcp',
					action: 'add-server',
				},
			);
		}

		// Check if server already exists
		if (this.servers.has(config.id)) {
			logger.warn(`MCPServerRegistry: Server ${config.id} already exists, updating configuration`);
			// Close existing connection (handled by caller - MCPManager)
			// We just log this for awareness but don't handle connection management here
		}

		// Save configuration to persistent storage
		try {
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();

			// Initialize mcpServers array if it doesn't exist
			if (!globalConfig.api) {
				globalConfig.api = {} as GlobalConfig['api'];
			}
			if (!globalConfig.api.mcpServers) {
				globalConfig.api.mcpServers = [];
			}

			// Add or update server configuration
			const mcpServers = globalConfig.api.mcpServers!; // Safe after initialization above
			const existingIndex = mcpServers.findIndex((s) => s.id === config.id);
			if (existingIndex >= 0) {
				mcpServers[existingIndex] = config;
			} else {
				mcpServers.push(config);
			}

			await configManager.updateGlobalConfig(globalConfig);

			// Update our local globalConfig reference
			this.globalConfig = globalConfig;

			logger.info(`MCPServerRegistry: Saved server configuration ${config.id} to persistent storage`);
		} catch (error) {
			logger.error(`MCPServerRegistry: Failed to save server configuration ${config.id}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to save server configuration: ${errorMessage(error)}`,
				{
					name: 'mcp-config-save-error',
					service: 'mcp',
					action: 'add-server',
					serverId: config.id,
				},
			);
		}
	}

	/**
	 * Remove an MCP server configuration from persistent storage
	 * Note: Connection cleanup is handled by the caller (MCPManager)
	 */
	public async removeServer(serverId: string): Promise<void> {
		logger.info(`MCPServerRegistry: Removing server configuration: ${serverId}`);

		// Remove server from local map (connection cleanup handled by caller)
		this.delete(serverId);

		// Remove from persistent configuration
		try {
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();

			if (globalConfig.api?.mcpServers) {
				const serverIndex = globalConfig.api.mcpServers.findIndex((s) => s.id === serverId);
				if (serverIndex >= 0) {
					globalConfig.api.mcpServers.splice(serverIndex, 1);
					await configManager.updateGlobalConfig(globalConfig);

					// Update our local globalConfig reference
					this.globalConfig = globalConfig;

					logger.info(`MCPServerRegistry: Removed server ${serverId} from persistent configuration`);
				} else {
					logger.warn(`MCPServerRegistry: Server ${serverId} not found in persistent configuration`);
				}
			}
		} catch (error) {
			logger.error(`MCPServerRegistry: Failed to remove server ${serverId} from configuration:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to remove server configuration: ${errorMessage(error)}`,
				{
					name: 'mcp-config-remove-error',
					service: 'mcp',
					action: 'remove-server',
					serverId,
				},
			);
		}
	}

	/**
	 * Get list of available MCP server IDs
	 * @returns Array of server IDs
	 */
	public getServers(): string[] {
		return Array.from(this.servers.keys());
	}

	/**
	 * Get MCP server configuration by ID
	 * @param serverId Server ID to get configuration for
	 * @returns Server configuration or null if not found
	 */
	public getMCPServerConfiguration(serverId: string): MCPServerConfig | null {
		return this.servers.get(serverId)?.config || null;
	}

	/**
	 * Get server capabilities by ID
	 * @param serverId Server ID to get capabilities for
	 * @returns Server capabilities or null if not found
	 */
	public getServerCapabilities(serverId: string): DataSourceCapability[] | null {
		return this.servers.get(serverId)?.capabilities || null;
	}

	/**
	 * Get all MCP server configurations from global config
	 * @returns Array of MCP server configurations
	 */
	public getMCPServerConfigurations(): MCPServerConfig[] {
		return this.globalConfig.api?.mcpServers || [];
	}

	/**
	 * Check if a server exists in the registry
	 * @param serverId Server ID to check
	 * @returns True if server exists, false otherwise
	 * @deprecated Use has(serverId) instead
	 */
	public hasServer(serverId: string): boolean {
		return this.has(serverId);
	}

	/**
	 * Get server info by ID
	 * @param serverId Server ID to get info for
	 * @returns Server info or undefined if not found
	 * @deprecated Use get(serverId) instead
	 */
	public getServerInfo(serverId: string): McpServerInfo | undefined {
		return this.get(serverId);
	}

	/**
	 * Update global config reference (called by MCPManager when config changes)
	 * @param globalConfig Updated global configuration
	 */
	public updateGlobalConfig(globalConfig: GlobalConfig): void {
		this.globalConfig = globalConfig;
	}
}
