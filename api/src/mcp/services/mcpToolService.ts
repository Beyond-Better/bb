import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { LLMAnswerToolUse, LLMMessageContentParts } from 'api/llms/llmMessage.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';
import type { MCPConnectionService } from 'api/mcp/connection/mcpConnectionService.ts';
import type { MCPOAuthService } from 'api/mcp/auth/mcpOAuthService.ts';

/**
 * MCPToolService handles all tool-related operations for MCP servers
 * Extracted from MCPManager Phase 4 refactoring
 */
export class MCPToolService {
	constructor(
		private servers: Map<string, McpServerInfo>,
		private connectionService: MCPConnectionService,
		private oauthService?: MCPOAuthService,
	) {}

	/**
	 * Handle operation-level errors with automatic retry
	 * Handles 401 (token refresh) and 400 session errors (reconnect)
	 */
	private async handleOperationError<T>(
		serverId: string,
		error: Error,
		operation: () => Promise<T>,
	): Promise<T> {
		const errorMsg = error.message;

		// Check for auth errors (401) - refresh token and retry
		if (this.connectionService.isAuthError(error)) {
			logger.info(`MCPToolService: [${serverId}] Auth error - attempting token refresh`);
			try {
				if (this.oauthService) {
					await this.oauthService.refreshAccessToken(serverId);
					logger.info(`MCPToolService: [${serverId}] Token refreshed - retrying operation`);
					return await operation();
				} else {
					logger.error(`MCPToolService: [${serverId}] Auth error but no OAuth service available`);
					throw error;
				}
			} catch (refreshError) {
				logger.error(`MCPToolService: [${serverId}] Token refresh failed:`, refreshError);
				// TODO: Emit error to user for re-authentication
				throw createError(
					ErrorType.ExternalServiceError,
					`Authentication failed for MCP server ${serverId}. Please re-authenticate.`,
					{
						name: 'mcp-auth-failed',
						service: 'mcp',
						action: 'refresh-token',
						serverId,
					},
				);
			}
		}

		// Check for session errors (400) - reconnect and retry
		if (this.connectionService.isSessionError(error)) {
			logger.info(`MCPToolService: [${serverId}] Session error - forcing reconnection`);
			try {
				await this.connectionService.forceReconnect(serverId);
				logger.info(`MCPToolService: [${serverId}] Reconnected - retrying operation`);
				return await operation();
			} catch (reconnectError) {
				logger.error(`MCPToolService: [${serverId}] Reconnection failed:`, reconnectError);
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to reconnect to MCP server ${serverId}: ${errorMessage(reconnectError)}`,
					{
						name: 'mcp-reconnect-failed',
						service: 'mcp',
						action: 'reconnect',
						serverId,
					},
				);
			}
		}

		// Other errors - just throw
		throw error;
	}

	/**
	 * List available tools for a specific MCP server
	 * @param serverId ID of the server to list tools for
	 * @returns Array of tool metadata
	 */
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

		// Ensure server is available (will attempt reconnection if needed)
		if (!(await this.connectionService.isServerAvailable(serverId))) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} is not available`, {
				name: 'mcp-server-unavailable',
				service: 'mcp',
				action: 'list-tools',
				serverId,
			});
		}

		// If tools are already cached, return them
		if (serverInfo.tools) {
			logger.debug(`MCPToolService: Using cached tools for server ${serverId}`);
			return serverInfo.tools;
		}

		// Otherwise, fetch tools from the server and cache them
		try {
			const response = await this.handleOperationError(serverId, new Error('dummy'), async () => {
				return await serverInfo.server.listTools();
			}).catch(async (dummyError) => {
				// First attempt without error handling
				return await serverInfo.server.listTools();
			});

			// Cache the tools
			serverInfo.tools = response.tools;

			// Record activity for health check
			this.connectionService.recordActivity(serverId);

			return response.tools;
		} catch (error) {
			logger.error(`MCPToolService: Error listing tools for server ${serverId}:`, error);

			// Try error handling and retry
			try {
				const response = await this.handleOperationError(serverId, error as Error, async () => {
					return await serverInfo.server.listTools();
				});
				serverInfo.tools = response.tools;
				this.connectionService.recordActivity(serverId);
				return response.tools;
			} catch (retryError) {
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to list MCP tools: ${errorMessage(retryError)}`,
					{
						name: 'mcp-tool-listing-error',
						service: 'mcp',
						action: 'list-tools',
						serverId,
					},
				);
			}
		}
	}

	/**
	 * Execute a tool on a specific MCP server
	 * @param serverId ID of the server to execute tool on
	 * @param toolName Name of the tool to execute
	 * @param toolUse Tool use parameters from LLM
	 * @param projectEditor Project editor instance for session access
	 * @returns Tool execution result with content and optional tool response
	 */
	async executeMCPTool(
		serverId: string,
		toolName: string,
		toolUse: LLMAnswerToolUse,
		projectEditor: ProjectEditor,
		collaborationId: string,
	): Promise<{ content: LLMMessageContentParts; toolResponse: string | null }> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'execute-tool',
				serverId,
			});
		}

		// Ensure server is available (will attempt reconnection if needed)
		if (!(await this.connectionService.isServerAvailable(serverId))) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} is not available`, {
				name: 'mcp-server-unavailable',
				service: 'mcp',
				action: 'execute-tool',
				serverId,
			});
		}

		const { toolInput } = toolUse;

		try {
			logger.info(`MCPToolService: Executing MCP tool ${toolName} with args:`, toolInput);

			const callToolMeta = {
				projectId: projectEditor.projectId,
				collaborationId,
				userId: projectEditor.userContext.userId || 'unknown',
				serverId,
			};

			const result = await serverInfo.server.callTool({
				name: toolName,
				arguments: toolInput as unknown as { [x: string]: unknown },
				_meta: callToolMeta,
			});

			logger.info(`MCPToolService: Result from MCP tool ${toolName}:`, result);

			// Record activity for health check
			this.connectionService.recordActivity(serverId);

			// Extract toolResponse from _meta if available
			const toolResponse = result._meta?.toolResponse as string || null;

			return {
				content: result.content as LLMMessageContentParts,
				toolResponse: toolResponse,
			};
		} catch (error) {
			logger.error(`MCPToolService: Error executing tool ${toolName}:`, error);

			// Try error handling and retry
			try {
				const callToolMeta = {
					projectId: projectEditor.projectId,
					collaborationId,
					userId: projectEditor.userContext.userId || 'unknown',
					serverId,
				};

				const result = await this.handleOperationError(serverId, error as Error, async () => {
					return await serverInfo.server.callTool({
						name: toolName,
						arguments: toolInput as unknown as { [x: string]: unknown },
						_meta: callToolMeta,
					});
				});

				this.connectionService.recordActivity(serverId);
				const toolResponse = result._meta?.toolResponse as string || null;

				return {
					content: result.content as LLMMessageContentParts,
					toolResponse: toolResponse,
				};
			} catch (retryError) {
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to execute MCP tool: ${errorMessage(retryError)}`,
					{
						name: 'mcp-tool-execution-error',
						service: 'mcp',
						action: 'execute-tool',
						toolName,
						serverId,
					},
				);
			}
		}
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
			logger.debug(`MCPToolService: Refreshed tools cache for server ${serverId}`);
		} catch (error) {
			logger.error(`MCPToolService: Error refreshing tools cache for server ${serverId}:`, error);
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
		const serverIds = Array.from(this.servers.keys());

		for (const serverId of serverIds) {
			const serverInfo = this.servers.get(serverId);
			if (!serverInfo) continue;

			const serverName = serverInfo.config.name || serverInfo.config.id;

			// Use cached tools if available, otherwise fetch them
			let tools;
			try {
				tools = serverInfo.tools || await this.listTools(serverId);
			} catch (error) {
				logger.warn(`MCPToolService: Error getting tools for server ${serverId}:`, error);
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
