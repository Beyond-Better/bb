import { Client } from 'mcp/client/index.js';
import { StdioClientTransport } from 'mcp/client/stdio.js';
import type { ReadResourceResult } from 'mcp/types.js';

import { logger } from 'shared/logger.ts';
// No need to import DataSourceForSystemPrompt as we're using a generic format
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import { getVersionInfo } from 'shared/version.ts';
//import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { GlobalConfig, MCPServerConfig } from 'shared/config/types.ts';
import type { ResourceMetadata } from 'api/resources/resourceManager.ts';

export class MCPManager {
	private static instance: MCPManager;
	private static testInstances = new Map<string, MCPManager>();
	// Exposed for instance inspection but treated as private
	servers: Map<string, {
		server: Client;
		config: MCPServerConfig;
		tools?: Array<{ name: string; description?: string; inputSchema: unknown }>;
		resources?: Array<ResourceMetadata>;
	}> = new Map();
	private globalConfig!: GlobalConfig;

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

		// Get MCP configurations
		const mcpServerConfigs = await this.getMCPServerConfigurations();
		//logger.info(`MCPManager: Loading tools from ${mcpServerConfigs.length} MCP servers`);

		for (const config of mcpServerConfigs) {
			//logger.info(`MCPManager: Loading tools for ${config.id}`, { config });
			try {
				await this.connectServer(config);
			} catch (error) {
				logger.error(`MCPManager: Failed to connect to MCP server ${config.name}:`, error);
			}
		}
		return this;
	}

	private async connectServer(config: MCPServerConfig): Promise<void> {
		logger.info(`MCPManager: Connecting to MCP server: ${config.id}`);

		try {
			// Always include the system PATH in the environment
			const env = { ...config.env };
			const currentPath = Deno.env.get('PATH') || '';
			const pathSeparator = Deno.build.os === 'windows' ? ';' : ':';

			// Process PATH_ADD if present in the environment config
			if (env && 'PATH_ADD' in env) {
				const pathAdd = env.PATH_ADD;
				delete env.PATH_ADD; // Remove PATH_ADD so it doesn't get passed directly

				// Create the new PATH by combining PATH_ADD with the current PATH
				env.PATH = pathAdd + pathSeparator + currentPath;
				logger.debug(`MCPManager: Extended PATH for ${config.id}: ${env.PATH}`);
			} else {
				// Just use the current PATH if PATH_ADD is not specified
				env.PATH = currentPath;
				logger.debug(`MCPManager: Using system PATH for ${config.id}: ${env.PATH}`);
			}

			const transport = new StdioClientTransport({
				command: config.command,
				args: config.args,
				env: env,
			});
			const client = new Client(
				{
					name: 'beyond-better',
					version: (await getVersionInfo()).version,
				},
				{
					capabilities: {
						prompts: {},
						resources: {},
						tools: {},
					},
				},
			);

			await client.connect(transport);

			// Store server info
			this.servers.set(config.id, { server: client, config });

			//return config.id;
		} catch (error) {
			logger.error(`MCPManager: Error connecting to server ${config.id}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to connect to MCP server: ${errorMessage(error)}`,
				{
					name: 'mcp-connection-error',
					service: 'mcp',
					action: 'connect',
					server: config.name,
				},
			);
		}
	}

	async listTools(
		serverId: string,
	): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'list-tools',
				serverId,
			});
		}

		// If tools are already cached, return them
		if (serverInfo.tools) {
			logger.debug(`MCPManager: Using cached tools for server ${serverId}`);
			return serverInfo.tools;
		}

		// Otherwise, fetch tools from the server and cache them
		try {
			const response = await serverInfo.server.listTools();
			// Cache the tools
			serverInfo.tools = response.tools;
			return response.tools;
		} catch (error) {
			logger.error(`MCPManager: Error listing tools for server ${serverId}:`, error);
			throw createError(ErrorType.ExternalServiceError, `Failed to list MCP tools: ${errorMessage(error)}`, {
				name: 'mcp-tool-listing-error',
				service: 'mcp',
				action: 'list-tools',
				serverId,
			});
		}
	}

	async listResources(
		serverId: string,
	): Promise<Array<ResourceMetadata>> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'list-resources',
				serverId,
			});
		}

		// If tools are already cached, return them
		if (serverInfo.resources) {
			logger.debug(`MCPManager: Using cached resources for server ${serverId}`);
			return serverInfo.resources;
		}

		// Otherwise, fetch resources from the server and cache them
		try {
			const response = await serverInfo.server.listResources();
			//logger.info(`MCPManager: Resources for server ${serverId}:`, response);
			// Cache the resources
			serverInfo.resources = response.resources.map((resource) => ({
				...resource,
				type: 'mcp',
				contentType: resource.mimeType?.startsWith('image/') ? 'image' : 'text',
				mimeType: resource.mimeType || 'text/plain',
			}));
			return serverInfo.resources;
		} catch (error) {
			// MCPManager: Error listing resources for server slack: McpError: MCP error -32601: Method not found
			if (error && typeof error === 'object' && 'code' in error && error.code === -32601) {
				logger.warn(`MCPManager: Listing resources for server ${serverId} is not supported`);
				return [];
			} else {
				logger.error(`MCPManager: Error listing resources for server ${serverId}:`, error);
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to list MCP resources: ${errorMessage(error)}`,
					{
						name: 'mcp-resource-listing-error',
						service: 'mcp',
						action: 'list-resources',
						serverId,
					},
				);
			}
		}
	}

	async executeMCPTool(
		serverId: string,
		toolName: string,
		toolUse: LLMAnswerToolUse,
	): Promise<LLMMessageContentParts> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'execute-tool',
				serverId,
			});
		}
		const { toolInput } = toolUse;

		try {
			logger.info(`MCPManager: Executing MCP tool ${toolName} with args:`, toolInput);
			const result = await serverInfo.server.callTool({
				name: toolName,
				arguments: toolInput as unknown as { [x: string]: unknown },
			});
			return result.content as LLMMessageContentParts;
		} catch (error) {
			logger.error(`MCPManager: Error executing tool ${toolName}:`, error);
			throw createError(ErrorType.ExternalServiceError, `Failed to execute MCP tool: ${errorMessage(error)}`, {
				name: 'mcp-tool-execution-error',
				service: 'mcp',
				action: 'execute-tool',
				toolName,
				serverId,
			});
		}
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
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'load-resource',
				serverId,
			});
		}

		try {
			logger.info(`MCPManager: Loading resource ${resourceUri}`);
			const result = await serverInfo.server.readResource({
				uri: resourceUri,
			});
			return result;
		} catch (error) {
			logger.error(`MCPManager: Error executing tool ${resourceUri}:`, error);
			throw createError(ErrorType.ExternalServiceError, `Failed to load MCP resource: ${errorMessage(error)}`, {
				name: 'mcp-load-resource-error',
				service: 'mcp',
				action: 'load-resource',
				resourceUri,
				serverId,
			});
		}
	}

	async cleanup(): Promise<void> {
		for (const [serverId, serverInfo] of this.servers.entries()) {
			try {
				// Close the transport which is managed by the server
				await serverInfo.server.close();
				this.servers.delete(serverId);
			} catch (error) {
				logger.error(`MCPManager: Error cleaning up server ${serverId}:`, error);
			}
		}
	}

	public getMCPServerConfiguration(serverId: string): MCPServerConfig | null {
		return this.servers.get(serverId)?.config || null;
	}

	// deno-lint-ignore require-await
	private async getMCPServerConfigurations(): Promise<MCPServerConfig[]> {
		return this.globalConfig.api?.mcpServers || [];
	}

	/**
	 * Get list of available MCP server IDs
	 * @returns Array of server IDs
	 */
	// deno-lint-ignore require-await
	async getServers(): Promise<string[]> {
		return Array.from(this.servers.keys());
	}

	/**
	 * Refresh the tools cache for a specific server
	 * @param serverId ID of the server to refresh tools for
	 */
	async refreshToolsCache(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'refresh-tools-cache',
				serverId,
			});
		}

		try {
			const response = await serverInfo.server.listTools();
			serverInfo.tools = response.tools;
			logger.debug(`MCPManager: Refreshed tools cache for server ${serverId}`);
		} catch (error) {
			logger.error(`MCPManager: Error refreshing tools cache for server ${serverId}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to refresh MCP tools cache: ${errorMessage(error)}`,
				{
					name: 'mcp-tools-cache-refresh-error',
					service: 'mcp',
					action: 'refresh-tools-cache',
					serverId,
				},
			);
		}
	}

	/**
	 * Refresh the tools cache for all servers
	 */
	async refreshAllToolsCaches(): Promise<void> {
		const serverIds = Array.from(this.servers.keys());
		for (const serverId of serverIds) {
			await this.refreshToolsCache(serverId);
		}
	}

	/**
	 * Get all tools from all MCP servers
	 * @returns Array of all MCP tools with their metadata
	 */
	async getAllTools(): Promise<Array<{ name: string; description: string; server: string }>> {
		const allTools: Array<{ name: string; description: string; server: string }> = [];
		const serverIds = await this.getServers();

		for (const serverId of serverIds) {
			const serverInfo = this.servers.get(serverId);
			if (!serverInfo) continue;

			const serverName = serverInfo.config.name || serverInfo.config.id;

			// Use cached tools if available, otherwise fetch them
			let tools;
			try {
				tools = serverInfo.tools || await this.listTools(serverId);
			} catch (error) {
				logger.warn(`MCPManager: Error getting tools for server ${serverId}:`, error);
				continue;
			}

			// Format each tool with simple name, description, and server information
			for (const tool of tools) {
				allTools.push({
					name: `${tool.name}_${serverId}`,
					description: tool.description || `MCP Tool ${tool.name}`,
					server: serverName,
				});
			}
		}

		return allTools;
	}
}

export default MCPManager;

/**
 * Gets the global mcpManager instance
 */
export async function getMCPManager(): Promise<MCPManager> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_MCP_MANAGER'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return MCPManager.getOneUseInstance();
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return MCPManager.getTestInstance(testId);
	return MCPManager.getInstance();
}
