import type { ReadResourceResult } from 'mcp/types.js';

import { logger } from 'shared/logger.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

//import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type {
	GlobalConfig,
	MCPServerConfig,
	//MCPOAuthConfig
} from 'shared/config/types.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { DataSourceCapability } from 'shared/types/dataSource.ts';
import type { ModelCapabilities, ModelInfo } from 'api/types/modelCapabilities.ts';

// Import extracted types and services
import type {
	ClientRegistrationRequest,
	ClientRegistrationResponse,
	McpServerInfo,
	OAuthServerMetadata,
	SamplingCreateMessageParams,
	SamplingCreateMessageResult,
	SamplingMessage,
	SamplingModelPreferences,
} from 'api/types/mcp.ts';
import { MCPOAuthService } from 'api/mcp/auth/mcpOAuthService.ts';
import { MCPConnectionService } from 'api/mcp/connection/mcpConnectionService.ts';
import { MCPRequestHandlerService } from 'api/mcp/handlers/mcpRequestHandlerService.ts';
import { MCPToolService } from 'api/mcp/services/mcpToolService.ts';
import { MCPResourceService } from 'api/mcp/services/mcpResourceService.ts';
import { MCPServerRegistry } from 'api/mcp/registry/mcpServerRegistry.ts';
import { saveServerConfig } from 'api/utils/mcp.ts';

// Types now imported from api/src/types/mcp.ts

// BBOAuthClientProvider now extracted to api/src/mcp/auth/mcpOAuthService.ts

export class MCPManager {
	private static instance: MCPManager;
	private static testInstances = new Map<string, MCPManager>();

	// Service dependencies
	private oauthService!: MCPOAuthService;
	private connectionService!: MCPConnectionService;
	private requestHandlerService!: MCPRequestHandlerService;
	private toolService!: MCPToolService;
	private resourceService!: MCPResourceService;
	private serverRegistry!: MCPServerRegistry;
	private globalConfig!: GlobalConfig;

	/**
	 * Get the servers map from the registry
	 * Exposed for instance inspection but registry is the source of truth
	 */
	get servers(): Map<string, McpServerInfo> {
		return this.serverRegistry.serversMap;
	}

	private constructor() {}

	/**
	 * Gets the singleton instance of the MCPManager
	 */
	public static async getInstance(): Promise<MCPManager> {
		if (!MCPManager.instance) {
			MCPManager.instance = new MCPManager();
			await MCPManager.instance.init();
		}
		return MCPManager.instance;
	}

	// used for testing - constructor is private so create instance here
	public static async getOneUseInstance(): Promise<MCPManager> {
		logger.warn(
			`MCPManager: Creating a ONE-TIME instance of mcpManager - USE ONLY FOR TESTING`,
		);
		const instance = new MCPManager();
		await instance.init();
		return instance;
	}
	public static async getTestInstance(testId: string): Promise<MCPManager> {
		if (!MCPManager.testInstances.has(testId)) {
			logger.warn(
				`MCPManager: Creating a TEST instance of mcpManager with ID: ${testId}`,
			);
			const instance = new MCPManager();
			await instance.init();
			MCPManager.testInstances.set(testId, instance);
		}
		return MCPManager.testInstances.get(testId)!;
	}

	async init(): Promise<MCPManager> {
		const configManager = await getConfigManager();
		this.globalConfig = await configManager.getGlobalConfig();

		// Initialize server registry first (it owns the servers map)
		this.serverRegistry = new MCPServerRegistry(this.globalConfig);

		// Initialize ModelRegistryService first (required by request handler)
		const modelRegistryService = await ModelRegistryService.getInstance();
		logger.debug('MCPManager: ModelRegistryService initialized successfully');

		// Initialize services with registry's servers map
		this.oauthService = new MCPOAuthService(this.servers, this.globalConfig);
		this.requestHandlerService = new MCPRequestHandlerService(
			this.servers,
			//this.globalConfig,
			modelRegistryService,
		);

		// Initialize connection service with request handler service
		this.connectionService = new MCPConnectionService(
			this.servers,
			this.oauthService,
			this.globalConfig,
			this.requestHandlerService,
		);

		// Initialize tool and resource services with OAuth service for token refresh
		this.toolService = new MCPToolService(this.servers, this.connectionService, this.oauthService);
		this.resourceService = new MCPResourceService(this.servers, this.connectionService, this.oauthService);

		// Get MCP configurations
		const mcpServerConfigs = await this.getMCPServerConfigurations();
		//logger.info(`MCPManager: Loading tools from ${mcpServerConfigs.length} MCP servers`);

		for (const config of mcpServerConfigs) {
			//logger.info(`MCPManager: Loading tools for ${config.id}`, { config });
			try {
				await this.connectionService.connectServer(config);
			} catch (error) {
				logger.error(`MCPManager: Failed to connect to MCP server ${config.name}:`, error);
			}
		}
		return this;
	}

	/**
	 * Update global configuration across all services
	 * Called when configuration changes need to be propagated
	 */
	private updateGlobalConfigReferences(globalConfig: GlobalConfig): void {
		this.globalConfig = globalConfig;
		this.serverRegistry.updateGlobalConfig(globalConfig);
	}

	/**
	 * Public method to connect or reconnect a server by ID
	 * Used for dynamic server connections after OAuth completion or manual reconnection
	 */
	public async connectServerById(serverId: string): Promise<void> {
		return await this.connectionService.connectServerById(serverId);
	}

	/**
	 * Add a new MCP server configuration dynamically without restarting the API
	 * This supports both STDIO and HTTP transports, with proper OAuth handling
	 */
	public async addServer(config: MCPServerConfig): Promise<void> {
		logger.info(`MCPManager: Adding new server configuration: ${config.id}`);

		// Check if server already exists and close existing connection
		if (this.serverRegistry.has(config.id)) {
			logger.warn(`MCPManager: Server ${config.id} already exists, updating configuration`);
			// Close existing connection
			const existingServerInfo = this.serverRegistry.get(config.id);
			if (existingServerInfo) {
				try {
					await existingServerInfo.server.close();
				} catch (error) {
					logger.debug(`MCPManager: Error closing existing server ${config.id}:`, error);
				}
			}
		}

		// Delegate configuration management to server registry
		await this.serverRegistry.addServer(config);

		// Connect to the server
		try {
			await this.connectionService.connectServer(config);
			logger.info(`MCPManager: Successfully added and connected server ${config.id}`);
		} catch (error) {
			// Log connection error but don't fail the add operation
			// Server will be available for connection later (e.g., after OAuth)
			logger.warn(`MCPManager: Server ${config.id} added to config but connection failed:`, error);
			logger.info(
				`MCPManager: Server ${config.id} will be available for connection after authentication if required`,
			);
		}
	}

	/**
	 * Remove an MCP server configuration and close its connection
	 */
	public async removeServer(serverId: string): Promise<void> {
		logger.info(`MCPManager: Removing server: ${serverId}`);

		// Close connection if it exists
		const serverInfo = this.serverRegistry.get(serverId);
		if (serverInfo) {
			try {
				await serverInfo.server.close();
				logger.info(`MCPManager: Closed connection for server ${serverId}`);
			} catch (error) {
				logger.debug(`MCPManager: Error closing connection for ${serverId}:`, error);
			}
		}

		// Delegate configuration removal to server registry
		await this.serverRegistry.removeServer(serverId);
	}

	/**
	 * Validate session ID for HTTP transport after potential reconnection
	 */
	public async validateHttpSession(serverId: string): Promise<boolean> {
		return await this.connectionService.validateHttpSession(serverId);
	}

	/**
	 * Check if a server is available (hybrid approach for STDIO vs HTTP)
	 */
	public async isServerAvailable(serverId: string): Promise<boolean> {
		return await this.connectionService.isServerAvailable(serverId);
	}

	/**
	 * Reset reconnection state for a server (useful for manual retries)
	 */
	public resetReconnectionState(serverId: string): void {
		return this.connectionService.resetReconnectionState(serverId);
	}

	async listTools(
		serverId: string,
	): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
		return await this.toolService.listTools(serverId);
	}

	async listResources(
		serverId: string,
	): Promise<Array<ResourceMetadata>> {
		return await this.resourceService.listResources(serverId);
	}

	async executeMCPTool(
		serverId: string,
		toolName: string,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
		collaborationId: string,
	): Promise<{ content: LLMMessageContentParts; toolResponse: string | null }> {
		return await this.toolService.executeMCPTool(serverId, toolName, toolUse, projectEditor, collaborationId);
	}

	/*
	 * Returns:
	 * uri: string
	 * mimeType: string
	 * text?: string
	 * blob?: string (base64)
	 */
	async loadResource(
		serverId: string,
		resourceUri: string,
	): Promise<ReadResourceResult> {
		return await this.resourceService.loadResource(serverId, resourceUri);
	}

	async cleanup(): Promise<void> {
		// Delegate cleanup to connection service
		await this.connectionService.cleanup();

		// Clear servers map after connections are closed
		this.serverRegistry.clear();
	}

	public getMCPServerConfiguration(serverId: string): MCPServerConfig | null {
		return this.serverRegistry.getMCPServerConfiguration(serverId);
	}

	// deno-lint-ignore require-await
	private async getMCPServerConfigurations(): Promise<MCPServerConfig[]> {
		return this.serverRegistry.getMCPServerConfigurations();
	}

	public getServerCapabilities(serverId: string): DataSourceCapability[] | null {
		return this.serverRegistry.getServerCapabilities(serverId);
	}

	/**
	 * Get list of available MCP server IDs
	 * @returns Array of server IDs
	 */
	// deno-lint-ignore require-await
	async getServers(): Promise<string[]> {
		return this.serverRegistry.getServers();
	}

	/**
	 * Public method to handle sampling requests
	 * Can be used when SDK supports sampling or for manual processing
	 * Delegates to request handler service
	 */
	public async processSamplingRequest(
		serverId: string,
		params: SamplingCreateMessageParams,
		meta: Record<string, unknown>,
	): Promise<SamplingCreateMessageResult> {
		return await this.requestHandlerService.processSamplingRequest(serverId, params, meta);
	}

	/**
	 * Refresh the tools cache for a specific server
	 * @param serverId ID of the server to refresh tools for
	 */
	async refreshToolsCache(serverId: string): Promise<void> {
		return await this.toolService.refreshToolsCache(serverId);
	}

	/**
	 * Refresh the tools cache for all servers
	 */
	async refreshAllToolsCaches(): Promise<void> {
		return await this.toolService.refreshAllToolsCaches();
	}

	/**
	 * Get all tools from all MCP servers
	 * @returns Array of all MCP tools with their metadata
	 */
	async getAllTools(): Promise<Array<{ name: string; description: string; server: string }>> {
		return await this.toolService.getAllTools();
	}
	// ============================================================================
	// OAUTH METHODS (now delegated to OAuth service)
	// ============================================================================

	/**
	 * Save server configuration to persistent storage
	 * Uses shared utility for consistency across all MCP services
	 */
	public async saveServerConfig(config: MCPServerConfig): Promise<void> {
		return await saveServerConfig(config);
	}

	// ============================================================================
	// OAUTH DISCOVERY AND FLOW METHODS
	// ============================================================================

	/**
	 * Attempt Dynamic Client Registration (RFC7591)
	 * Delegates to OAuth service
	 */
	public async registerDynamicClient(
		serverUrl: string,
		registrationEndpoint: string,
		serverId: string,
	): Promise<ClientRegistrationResponse> {
		return await this.oauthService.registerDynamicClient(serverUrl, registrationEndpoint, serverId);
	}

	/**
	 * Discover OAuth server endpoints for a given server URL
	 * Delegates to OAuth service
	 */
	public async discoverOAuthEndpoints(serverUrl: string): Promise<OAuthServerMetadata> {
		return await this.oauthService.discoverOAuthEndpoints(serverUrl);
	}

	/**
	 * Generate authorization URL for OAuth Authorization Code flow
	 * Delegates to OAuth service
	 */
	async generateAuthorizationUrl(serverId: string, clientState?: string): Promise<string> {
		return await this.oauthService.generateAuthorizationUrl(serverId, clientState);
	}

	/**
	 * Handle OAuth authorization callback and exchange code for tokens
	 * Delegates to OAuth service
	 */
	async handleAuthorizationCallback(code: string, state: string): Promise<void> {
		return await this.oauthService.handleAuthorizationCallback(code, state);
	}

	/**
	 * Refresh expired access token using refresh token
	 * Delegates to OAuth service
	 */
	async refreshAccessToken(serverId: string): Promise<void> {
		return await this.oauthService.refreshAccessToken(serverId);
	}

	/**
	 * Perform Client Credentials OAuth flow for app-to-app authentication
	 * Delegates to OAuth service
	 */
	async performClientCredentialsFlow(serverId: string): Promise<void> {
		return await this.oauthService.performClientCredentialsFlow(serverId);
	}
}

export default MCPManager;

/**
 * Gets the global mcpManager instance
 */
// deno-lint-ignore require-await
export async function getMCPManager(): Promise<MCPManager> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_MCP_MANAGER'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return MCPManager.getOneUseInstance();
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return MCPManager.getTestInstance(testId);
	return MCPManager.getInstance();
}
