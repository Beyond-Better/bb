import type { ReadResourceResult } from 'mcp/types.js';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';
import type { MCPConnectionService } from 'api/mcp/connection/mcpConnectionService.ts';
import type { MCPOAuthService } from 'api/mcp/auth/mcpOAuthService.ts';

/**
 * MCPResourceService handles all resource-related operations for MCP servers
 * Extracted from MCPManager Phase 4 refactoring
 */
export class MCPResourceService {
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
		// Check for auth errors (401) - refresh token and retry
		if (this.connectionService.isAuthError(error)) {
			logger.info(`MCPResourceService: [${serverId}] Auth error - attempting token refresh`);
			try {
				if (this.oauthService) {
					await this.oauthService.refreshAccessToken(serverId);
					logger.info(`MCPResourceService: [${serverId}] Token refreshed - retrying operation`);
					return await operation();
				} else {
					logger.error(`MCPResourceService: [${serverId}] Auth error but no OAuth service available`);
					throw error;
				}
			} catch (refreshError) {
				logger.error(`MCPResourceService: [${serverId}] Token refresh failed:`, refreshError);
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
			logger.info(`MCPResourceService: [${serverId}] Session error - forcing reconnection`);
			try {
				await this.connectionService.forceReconnect(serverId);
				logger.info(`MCPResourceService: [${serverId}] Reconnected - retrying operation`);
				return await operation();
			} catch (reconnectError) {
				logger.error(`MCPResourceService: [${serverId}] Reconnection failed:`, reconnectError);
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
	 * List available resources for a specific MCP server
	 * @param serverId ID of the server to list resources for
	 * @returns Array of resource metadata
	 */
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

		// Ensure server is available (will attempt reconnection if needed)
		if (!(await this.connectionService.isServerAvailable(serverId))) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} is not available`, {
				name: 'mcp-server-unavailable',
				service: 'mcp',
				action: 'list-resources',
				serverId,
			});
		}

		// If resources are already cached, return them
		if (serverInfo.resources) {
			logger.debug(`MCPResourceService: Using cached resources for server ${serverId}`);
			return serverInfo.resources;
		}

		// Otherwise, fetch resources from the server and cache them
		try {
			const response = await serverInfo.server.listResources();

			// Cache the resources
			serverInfo.resources = response.resources.map((resource: any) => ({
				...resource,
				type: 'mcp',
				contentType: resource.mimeType?.startsWith('image/') ? 'image' : 'text',
				mimeType: resource.mimeType || 'text/plain',
				lastModified: new Date(),
			}));

			// Record activity for health check
			this.connectionService.recordActivity(serverId);

			return serverInfo.resources;
		} catch (error) {
			// MCPResourceService: Error listing resources for server slack: McpError: MCP error -32601: Method not found
			if (error && typeof error === 'object' && 'code' in error && error.code === -32601) {
				logger.warn(`MCPResourceService: Listing resources for server ${serverId} is not supported`);
				return [];
			}

			logger.error(`MCPResourceService: Error listing resources for server ${serverId}:`, error);

			// Try error handling and retry
			try {
				const response = await this.handleOperationError(serverId, error as Error, async () => {
					return await serverInfo.server.listResources();
				});

				serverInfo.resources = response.resources.map((resource: any) => ({
					...resource,
					type: 'mcp',
					contentType: resource.mimeType?.startsWith('image/') ? 'image' : 'text',
					mimeType: resource.mimeType || 'text/plain',
					lastModified: new Date(),
				}));

				this.connectionService.recordActivity(serverId);
				return serverInfo.resources;
			} catch (retryError) {
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to list MCP resources: ${errorMessage(retryError)}`,
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

	/**
	 * Load a specific resource from an MCP server
	 * @param serverId ID of the server to load resource from
	 * @param resourceUri URI of the resource to load
	 * @returns Resource content with metadata
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

		// Ensure server is available (will attempt reconnection if needed)
		if (!(await this.connectionService.isServerAvailable(serverId))) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} is not available`, {
				name: 'mcp-server-unavailable',
				service: 'mcp',
				action: 'load-resource',
				serverId,
			});
		}

		try {
			logger.info(`MCPResourceService: Loading resource ${resourceUri}`);
			const result = await serverInfo.server.readResource({
				uri: resourceUri,
			});

			// Record activity for health check
			this.connectionService.recordActivity(serverId);

			return result;
		} catch (error) {
			logger.error(`MCPResourceService: Error loading resource ${resourceUri}:`, error);

			// Try error handling and retry
			try {
				const result = await this.handleOperationError(serverId, error as Error, async () => {
					return await serverInfo.server.readResource({
						uri: resourceUri,
					});
				});

				this.connectionService.recordActivity(serverId);
				return result;
			} catch (retryError) {
				throw createError(
					ErrorType.ExternalServiceError,
					`Failed to load MCP resource: ${errorMessage(retryError)}`,
					{
						name: 'mcp-load-resource-error',
						service: 'mcp',
						action: 'load-resource',
						resourceUri,
						serverId,
					},
				);
			}
		}
	}
}
