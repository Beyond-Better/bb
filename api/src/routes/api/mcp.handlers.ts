import type { Context, RouterContext } from '@oak/oak';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { logger } from 'shared/logger.ts';
import { errorMessage } from 'shared/error.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { MCPServerConfig } from 'shared/config/types.ts';

/**
 * @openapi
 * /api/v1/mcp/servers:
 *   get:
 *     summary: List MCP servers
 *     description: Returns a list of all configured MCP servers with their status
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of MCP servers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 servers:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       transport:
 *                         type: string
 *                         enum: ['stdio', 'http']
 *                       status:
 *                         type: string
 *                         enum: ['connected', 'disconnected', 'error']
 *                       oauth:
 *                         type: object
 *                         properties:
 *                           grantType:
 *                             type: string
 *                             enum: ['authorization_code', 'client_credentials']
 *                           hasToken:
 *                             type: boolean
 *                           expiresAt:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 */
export async function listMCPServers({ response }: { response: Context['response'] }) {
	try {
		const mcpManager = await getMCPManager();
		const serverIds = await mcpManager.getServers();

		const servers = serverIds.map((serverId) => {
			const config = mcpManager.getMCPServerConfiguration(serverId);
			if (!config) return null;

			return {
				id: config.id,
				name: config.name || config.id,
				description: config.description,
				transport: config.transport,
				status: 'connected', // TODO: Add actual status checking
				oauth: config.oauth
					? {
						grantType: config.oauth.grantType,
						hasToken: !!config.oauth.accessToken,
						expiresAt: config.oauth.expiresAt ? new Date(config.oauth.expiresAt).toISOString() : null,
					}
					: null,
			};
		}).filter(Boolean);

		response.body = { servers };
	} catch (error) {
		logger.error('MCPHandler: Error listing servers:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to list MCP servers: ${errorMessage(error)}`,
			{
				name: 'mcp-list-servers-error',
				service: 'mcp',
				action: 'list-servers',
			},
		);
	}
}

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/authorize:
 *   post:
 *     summary: Generate authorization URL
 *     description: Generates an OAuth authorization URL for authorization code flow
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               state:
 *                 type: string
 *                 description: Client-generated state for CSRF protection (optional)
 *     responses:
 *       200:
 *         description: Authorization URL generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 authorizationUrl:
 *                   type: string
 *                   format: uri
 *                   description: URL to redirect user for OAuth authorization
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the authorization request expires
 *       400:
 *         description: Invalid request or server configuration
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const generateAuthorizationUrl = async (
	{ params, request, response }: RouterContext<
		'/servers/:serverId/authorize',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		// Extract client-provided state (optional)
		let clientState: string | undefined;
		try {
			const body = await request.body.json();
			clientState = body.state;
		} catch {
			// No body or invalid JSON - that's fine, state is optional
		}

		logger.info(
			'MCPHandler: generating authorization URL for server',
			serverId,
			'with client state:',
			!!clientState,
		);
		const mcpManager = await getMCPManager();

		// Check if server is configured for authorization code flow
		const config = mcpManager.getMCPServerConfiguration(serverId);
		logger.info('MCPHandler: Authorize config for OAuth:', config);
		if (!config?.oauth || config.oauth.grantType !== 'authorization_code') {
			response.status = 400;
			response.body = { error: 'Server is not configured for authorization code flow' };
			return;
		}

		// Generate authorization URL directly using MCPManager's method
		try {
			logger.info(`MCPHandler: Generating authorization URL for server ${serverId} with client state`);
			const authorizationUrl = await mcpManager.generateAuthorizationUrl(serverId, clientState);

			// Authorization URLs typically expire in 10 minutes
			const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

			response.body = {
				authorizationUrl,
				expiresAt,
			};
			logger.info(`MCPHandler: Successfully generated authorization URL for server ${serverId}`);
		} catch (error) {
			logger.error(`MCPHandler: Failed to generate authorization URL for server ${serverId}:`, error);
			// Re-throw to be handled by outer catch block
			throw error;
		}
	} catch (error) {
		logger.error('MCPHandler: Error generating authorization URL:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to generate authorization URL: ${errorMessage(error)}`,
			{
				name: 'mcp-auth-url-error',
				service: 'mcp',
				action: 'generate-auth-url',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/callback:
 *   post:
 *     summary: Handle OAuth callback
 *     description: Handles OAuth authorization callback and exchanges code for tokens
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 description: Authorization code from OAuth provider
 *               state:
 *                 type: string
 *                 description: State parameter for CSRF protection
 *             required:
 *               - code
 *               - state
 *     responses:
 *       200:
 *         description: Authorization successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the access token expires
 *       400:
 *         description: Invalid code or state
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const handleOAuthCallback = async (
	{ params, request, response }: RouterContext<
		'/servers/:serverId/callback',
		{ serverId: string }
	>,
) => {
	try {
		logger.info('MCPHandler: Handling OAuth callback:', params);
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const body = await request.body.json();
		const { code, state } = body;
		logger.info('MCPHandler: Handling OAuth callback:', { code, state });

		if (!code || !state) {
			response.status = 400;
			response.body = { error: 'Code and state are required' };
			return;
		}

		const mcpManager = await getMCPManager();
		await mcpManager.handleAuthorizationCallback(code, state);

		// **QUICK FIX**: Connect server after successful OAuth token exchange
		// This ensures the transport connection is established with valid auth
		try {
			logger.info(`MCPHandler: Attempting to connect server ${serverId} after OAuth completion`);
			await mcpManager.connectServerById(serverId);
			logger.info(`MCPHandler: Successfully connected server ${serverId} after OAuth`);
		} catch (connectError) {
			logger.error(`MCPHandler: Failed to connect server ${serverId} after OAuth:`, connectError);
			// Don't fail the OAuth callback - just log the connection error
			// The server will be retried on next use
		}

		// Get updated server config to return token expiration
		const config = mcpManager.getMCPServerConfiguration(serverId);
		const expiresAt = config?.oauth?.expiresAt ? new Date(config.oauth.expiresAt).toISOString() : null;

		response.body = {
			success: true,
			message: 'OAuth authorization successful',
			expiresAt,
		};
	} catch (error) {
		logger.error('MCPHandler: Error handling OAuth callback:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`OAuth callback failed: ${errorMessage(error)}`,
			{
				name: 'mcp-oauth-callback-error',
				service: 'mcp',
				action: 'oauth-callback',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/oauth-config:
 *   get:
 *     summary: Get OAuth configuration status
 *     description: Returns the current OAuth configuration status for a server, including dynamic registration status
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: OAuth configuration status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 serverId:
 *                   type: string
 *                 hasOAuth:
 *                   type: boolean
 *                 grantType:
 *                   type: string
 *                   enum: ['authorization_code', 'client_credentials']
 *                 configurationStatus:
 *                   type: string
 *                   enum: ['complete', 'missing_client_credentials', 'discovery_failed']
 *                 supportsDynamicRegistration:
 *                   type: boolean
 *                 dynamicRegistrationStatus:
 *                   type: string
 *                   enum: ['successful', 'failed', 'not_attempted', 'not_supported']
 *                 discoveredEndpoints:
 *                   type: object
 *                   properties:
 *                     authorization_endpoint:
 *                       type: string
 *                     token_endpoint:
 *                       type: string
 *                     registration_endpoint:
 *                       type: string
 *                 hasClientCredentials:
 *                   type: boolean
 *                 hasAccessToken:
 *                   type: boolean
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const getOAuthConfig = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/oauth-config',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();

		// First try to get config from loaded servers (if already connected)
		let config = mcpManager.getMCPServerConfiguration(serverId);

		// If not loaded, get config directly from disk (for fresh servers)
		if (!config) {
			logger.info(`MCPHandler: Server ${serverId} not loaded in memory, fetching from config file`);
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			config = globalConfig.api?.mcpServers?.find((server) => server.id === serverId) || null;

			if (!config) {
				throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found in configuration`);
			}
		}

		let discoveredEndpoints = null;
		let supportsDynamicRegistration = false;
		let dynamicRegistrationStatus = 'not_attempted';
		let configurationStatus = 'missing_client_credentials';

		// Try OAuth discovery if this is an HTTP server with OAuth enabled
		if (config.transport === 'http' && config.url && config.oauth) {
			try {
				// **KEY CHANGE**: Run OAuth discovery here, separate from connection
				// This allows discovery without requiring a full server connection
				logger.info(`MCPHandler: Running OAuth discovery for server ${serverId}`);
				const metadata = await mcpManager.discoverOAuthEndpoints(config.url);

				discoveredEndpoints = {
					authorization_endpoint: metadata.authorization_endpoint,
					token_endpoint: metadata.token_endpoint,
					registration_endpoint: metadata.registration_endpoint,
				};
				supportsDynamicRegistration = !!metadata.registration_endpoint;

				// Update config with discovered endpoints and scopes
				config.oauth.authorizationEndpoint = metadata.authorization_endpoint;
				config.oauth.tokenEndpoint = metadata.token_endpoint;
				if (metadata.scopes_supported && metadata.scopes_supported.length > 0) {
					config.oauth.scopes = metadata.scopes_supported;
					logger.info(`MCPHandler: Updated scopes for server ${serverId}:`, metadata.scopes_supported);
				}

				// Save the updated config with discovered information
				await mcpManager.saveServerConfig(config);
				logger.info(
					`MCPHandler: Saved updated config with discovered endpoints and scopes for server ${serverId}`,
				);

				// **KEY CHANGE**: Try Dynamic Registration if supported and no client ID
				if (supportsDynamicRegistration && !config.oauth.clientId) {
					try {
						logger.info(`MCPHandler: Attempting Dynamic Registration for server ${serverId}`);
						const clientInfo = await mcpManager.registerDynamicClient(
							config.url,
							metadata.registration_endpoint!,
							serverId,
						);

						// Update the config with registered client info
						config.oauth.clientId = clientInfo.client_id;
						if (clientInfo.client_secret) {
							config.oauth.clientSecret = clientInfo.client_secret;
						}
						config.oauth.registrationTimestamp = Date.now();

						// Save the updated config
						await mcpManager.saveServerConfig(config);

						configurationStatus = 'complete';
						dynamicRegistrationStatus = 'successful';
						logger.info(`MCPHandler: Dynamic Registration successful for server ${serverId}`);
					} catch (regError) {
						logger.warn(
							`MCPHandler: Dynamic Registration failed for server ${serverId}:`,
							errorMessage(regError),
						);
						dynamicRegistrationStatus = 'failed';
						configurationStatus = 'missing_client_credentials';
					}
				} else if (config.oauth.clientId) {
					configurationStatus = 'complete';
					dynamicRegistrationStatus = supportsDynamicRegistration ? 'successful' : 'not_supported';
				} else {
					dynamicRegistrationStatus = supportsDynamicRegistration ? 'not_attempted' : 'not_supported';
					configurationStatus = 'missing_client_credentials';
				}
			} catch (error) {
				logger.warn(`MCPHandler: OAuth discovery failed for server ${serverId}:`, error);
				configurationStatus = 'discovery_failed';
				dynamicRegistrationStatus = 'failed';
			}
		} else if (config.oauth?.clientId) {
			configurationStatus = 'complete';
		}

		const oauthConfig = {
			serverId: config.id,
			hasOAuth: !!config.oauth,
			grantType: config.oauth?.grantType,
			configurationStatus,
			supportsDynamicRegistration,
			dynamicRegistrationStatus,
			discoveredEndpoints,
			hasClientCredentials: !!(config.oauth?.clientId),
			hasAccessToken: !!(config.oauth?.accessToken),
		};

		response.body = oauthConfig;
	} catch (error) {
		logger.error('MCPHandler: Error getting OAuth config:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to get OAuth config: ${errorMessage(error)}`,
			{
				name: 'mcp-oauth-config-error',
				service: 'mcp',
				action: 'get-oauth-config',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Refreshes an expired access token using the refresh token
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the new access token expires
 *       400:
 *         description: No refresh token available
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const refreshAccessToken = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/refresh',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();
		let config = mcpManager.getMCPServerConfiguration(serverId);
		if (!config) {
			response.status = 400;
			response.body = { error: `MCP server ${serverId} not found` };
			return;
		}

		if (!config.oauth?.refreshToken) {
			response.status = 400;
			response.body = { error: 'No refresh token available' };
			return;
		}

		// Call the refresh method
		await mcpManager.refreshAccessToken(serverId);

		// Get updated token expiration
		config = mcpManager.getMCPServerConfiguration(serverId);
		const expiresAt = config?.oauth?.expiresAt ? new Date(config.oauth.expiresAt).toISOString() : null;

		response.body = {
			success: true,
			message: 'Access token refreshed successfully',
			expiresAt,
		};
	} catch (error) {
		logger.error('MCPHandler: Error refreshing access token:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Token refresh failed: ${errorMessage(error)}`,
			{
				name: 'mcp-token-refresh-error',
				service: 'mcp',
				action: 'refresh-token',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/status:
 *   get:
 *     summary: Get server status
 *     description: Returns the connection and authentication status of an MCP server
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Server status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 transport:
 *                   type: string
 *                   enum: ['stdio', 'http']
 *                 status:
 *                   type: string
 *                   enum: ['connected', 'disconnected', 'error']
 *                 oauth:
 *                   type: object
 *                   properties:
 *                     grantType:
 *                       type: string
 *                       enum: ['authorization_code', 'client_credentials']
 *                     hasToken:
 *                       type: boolean
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     needsRefresh:
 *                       type: boolean
 *                 tools:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: number
 *                     available:
 *                       type: boolean
 *                 resources:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: number
 *                     available:
 *                       type: boolean
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const getServerStatus = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/status',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();
		const config = mcpManager.getMCPServerConfiguration(serverId);

		if (!config) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`);
		}

		// Get tools count
		let toolsInfo = { count: 0, available: false };
		try {
			const tools = await mcpManager.listTools(serverId);
			toolsInfo = { count: tools.length, available: true };
		} catch {
			// Tools listing failed, keep defaults
		}

		// Get resources count
		let resourcesInfo = { count: 0, available: false };
		try {
			const resources = await mcpManager.listResources(serverId);
			resourcesInfo = { count: resources.length, available: true };
		} catch {
			// Resources listing failed, keep defaults
		}

		// Check if token needs refresh (within 5 minutes of expiry)
		const needsRefresh = config.oauth?.expiresAt ? Date.now() + (5 * 60 * 1000) >= config.oauth.expiresAt : false;

		const status = {
			id: config.id,
			name: config.name || config.id,
			transport: config.transport,
			status: 'connected', // TODO: Add actual connection status checking
			oauth: config.oauth
				? {
					grantType: config.oauth.grantType,
					hasToken: !!config.oauth.accessToken,
					expiresAt: config.oauth.expiresAt ? new Date(config.oauth.expiresAt).toISOString() : null,
					needsRefresh,
				}
				: null,
			tools: toolsInfo,
			resources: resourcesInfo,
		};

		response.body = status;
	} catch (error) {
		logger.error('MCPHandler: Error getting server status:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to get server status: ${errorMessage(error)}`,
			{
				name: 'mcp-server-status-error',
				service: 'mcp',
				action: 'get-status',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/test:
 *   post:
 *     summary: Test server connection
 *     description: Tests the connection to an MCP server by listing its capabilities
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Connection test successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 capabilities:
 *                   type: object
 *                   properties:
 *                     tools:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                         sample:
 *                           type: array
 *                           items:
 *                             type: string
 *                     resources:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: number
 *                         sample:
 *                           type: array
 *                           items:
 *                             type: string
 *       400:
 *         description: Connection test failed
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const testServerConnection = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/test',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();
		const config = mcpManager.getMCPServerConfiguration(serverId);

		if (!config) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`);
		}

		// Test tools capability
		// deno-lint-ignore no-explicit-any
		const capabilities: any = { tools: { count: 0, sample: [] }, resources: { count: 0, sample: [] } };

		try {
			const tools = await mcpManager.listTools(serverId);
			capabilities.tools.count = tools.length;
			capabilities.tools.sample = tools.slice(0, 3).map((t) => t.name);
		} catch (error) {
			logger.warn(`MCPHandler: Tools test failed for ${serverId}:`, error);
		}

		// Test resources capability
		try {
			const resources = await mcpManager.listResources(serverId);
			capabilities.resources.count = resources.length;
			capabilities.resources.sample = resources.slice(0, 3).map((r) => r.name || r.uri);
		} catch (error) {
			logger.warn(`MCPHandler: Resources test failed for ${serverId}:`, error);
		}

		response.body = {
			success: true,
			message: 'Connection test completed',
			capabilities,
		};
	} catch (error) {
		logger.error('MCPHandler: Error testing server connection:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Connection test failed: ${errorMessage(error)}`,
			{
				name: 'mcp-connection-test-error',
				service: 'mcp',
				action: 'test-connection',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/client-credentials:
 *   post:
 *     summary: Perform client credentials flow
 *     description: Performs OAuth client credentials flow for app-to-app authentication
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Client credentials flow successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the access token expires
 *       400:
 *         description: Invalid server configuration
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const performClientCredentialsFlow = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/client-credentials',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();
		await mcpManager.performClientCredentialsFlow(serverId);

		// Get updated server config to return token expiration
		const config = mcpManager.getMCPServerConfiguration(serverId);
		const expiresAt = config?.oauth?.expiresAt ? new Date(config.oauth.expiresAt).toISOString() : null;

		response.body = {
			success: true,
			message: 'Client credentials flow successful',
			expiresAt,
		};
	} catch (error) {
		logger.error('MCPHandler: Error performing client credentials flow:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Client credentials flow failed: ${errorMessage(error)}`,
			{
				name: 'mcp-client-credentials-error',
				service: 'mcp',
				action: 'client-credentials',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers:
 *   post:
 *     summary: Add MCP server
 *     description: Adds a new MCP server configuration and attempts to connect
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 description: Unique server identifier
 *               name:
 *                 type: string
 *                 description: Display name for the server
 *               description:
 *                 type: string
 *                 description: Server description
 *               transport:
 *                 type: string
 *                 enum: ['stdio', 'http']
 *                 description: Transport type
 *               url:
 *                 type: string
 *                 description: Server URL (required for HTTP transport)
 *               command:
 *                 type: string
 *                 description: Command to run (required for STDIO transport)
 *               args:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Command arguments (STDIO transport)
 *               env:
 *                 type: object
 *                 description: Environment variables
 *               oauth:
 *                 type: object
 *                 properties:
 *                   grantType:
 *                     type: string
 *                     enum: ['authorization_code', 'client_credentials']
 *                   clientId:
 *                     type: string
 *                   clientSecret:
 *                     type: string
 *                   scopes:
 *                     type: array
 *                     items:
 *                       type: string
 *             required:
 *               - id
 *               - name
 *               - transport
 *     responses:
 *       201:
 *         description: Server added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 serverId:
 *                   type: string
 *                 connected:
 *                   type: boolean
 *       400:
 *         description: Invalid server configuration
 *       409:
 *         description: Server ID already exists
 *       401:
 *         description: Unauthorized
 */
/**
 * Update an existing MCP server configuration
 */
export const updateMCPServer = async (
	{ params, request, response }: RouterContext<
		'/servers/:serverId',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const serverUpdates = await request.body.json();

		// Validate required fields
		if (!serverUpdates.name || !serverUpdates.transport) {
			response.status = 400;
			response.body = { error: 'Missing required fields: name, transport' };
			return;
		}

		// Validate transport-specific requirements
		if (serverUpdates.transport === 'http' && !serverUpdates.url) {
			response.status = 400;
			response.body = { error: 'URL is required for HTTP transport' };
			return;
		}

		if (serverUpdates.transport === 'stdio' && !serverUpdates.command) {
			response.status = 400;
			response.body = { error: 'Command is required for STDIO transport' };
			return;
		}

		const mcpManager = await getMCPManager();

		// Check if server exists
		const existingConfig = mcpManager.getMCPServerConfiguration(serverId);
		if (!existingConfig) {
			response.status = 404;
			response.body = { error: `Server with ID '${serverId}' not found` };
			return;
		}

		// Create updated config (preserve ID and merge changes)
		const updatedConfig: MCPServerConfig = {
			...existingConfig,
			...serverUpdates,
			id: serverId, // Ensure ID doesn't change
		};

		try {
			// Save updated configuration
			await mcpManager.saveServerConfig(updatedConfig);

			// Try to reconnect the server if it was connected before
			try {
				await mcpManager.connectServerById(serverId);
				logger.info(`MCPHandler: Server ${serverId} updated and reconnected successfully`);
			} catch (connectError) {
				logger.warn(`MCPHandler: Server ${serverId} updated but reconnection failed:`, connectError);
				// Don't fail the update operation if reconnection fails
			}

			response.body = {
				success: true,
				message: `MCP server '${updatedConfig.name}' updated successfully`,
				serverId: serverId,
			};
		} catch (updateError) {
			logger.error(`MCPHandler: Failed to update server ${serverId}:`, updateError);
			throw updateError;
		}
	} catch (error) {
		logger.error('MCPHandler: Error updating server:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to update MCP server: ${errorMessage(error)}`,
			{
				name: 'mcp-update-server-error',
				service: 'mcp',
				action: 'update-server',
				serverId: params.serverId,
			},
		);
	}
};

export const addMCPServer = async (
	{ request, response }: { request: Context['request']; response: Context['response'] },
) => {
	try {
		const serverConfig = await request.body.json();

		// Validate required fields
		if (!serverConfig.id || !serverConfig.name || !serverConfig.transport) {
			response.status = 400;
			response.body = { error: 'Missing required fields: id, name, transport' };
			return;
		}

		// Validate transport-specific requirements
		if (serverConfig.transport === 'http' && !serverConfig.url) {
			response.status = 400;
			response.body = { error: 'URL is required for HTTP transport' };
			return;
		}

		if (serverConfig.transport === 'stdio' && !serverConfig.command) {
			response.status = 400;
			response.body = { error: 'Command is required for STDIO transport' };
			return;
		}

		const mcpManager = await getMCPManager();

		// Check if server already exists
		const existingConfig = mcpManager.getMCPServerConfiguration(serverConfig.id);
		if (existingConfig) {
			response.status = 409;
			response.body = { error: `Server with ID '${serverConfig.id}' already exists` };
			return;
		}

		try {
			await mcpManager.addServer(serverConfig);

			response.status = 201;
			response.body = {
				success: true,
				message: `MCP server '${serverConfig.name}' added successfully`,
				serverId: serverConfig.id,
				connected: true, // addServer attempts connection
			};
		} catch (addError) {
			// Server was added to config but connection failed
			logger.warn(`MCPHandler: Server ${serverConfig.id} added but connection failed:`, addError);
			response.status = 201;
			response.body = {
				success: true,
				message:
					`MCP server '${serverConfig.name}' added to configuration. Connection will be attempted when authentication is complete.`,
				serverId: serverConfig.id,
				connected: false,
				connectionError: errorMessage(addError),
			};
		}
	} catch (error) {
		logger.error('MCPHandler: Error adding server:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to add MCP server: ${errorMessage(error)}`,
			{
				name: 'mcp-add-server-error',
				service: 'mcp',
				action: 'add-server',
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}:
 *   put:
 *     summary: Update MCP server
 *     description: Updates an existing MCP server configuration
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name for the server
 *               description:
 *                 type: string
 *                 description: Server description
 *               transport:
 *                 type: string
 *                 enum: ['stdio', 'http']
 *                 description: Transport type
 *               url:
 *                 type: string
 *                 description: Server URL (required for HTTP transport)
 *               command:
 *                 type: string
 *                 description: Command to run (required for STDIO transport)
 *               args:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Command arguments (STDIO transport)
 *               env:
 *                 type: object
 *                 description: Environment variables
 *               oauth:
 *                 type: object
 *                 properties:
 *                   grantType:
 *                     type: string
 *                     enum: ['authorization_code', 'client_credentials']
 *                   clientId:
 *                     type: string
 *                   clientSecret:
 *                     type: string
 *                   scopes:
 *                     type: array
 *                     items:
 *                       type: string
 *             required:
 *               - name
 *               - transport
 *     responses:
 *       200:
 *         description: Server updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 serverId:
 *                   type: string
 *       400:
 *         description: Invalid server configuration
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 *   delete:
 *     summary: Remove MCP server
 *     description: Removes an MCP server configuration and closes its connection
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Server removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const removeMCPServer = async (
	{ params, response }: RouterContext<
		'/servers/:serverId',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();

		// Check if server exists
		const config = mcpManager.getMCPServerConfiguration(serverId);
		if (!config) {
			response.status = 404;
			response.body = { error: `Server '${serverId}' not found` };
			return;
		}

		await mcpManager.removeServer(serverId);

		response.body = {
			success: true,
			message: `MCP server '${config.name || serverId}' removed successfully`,
		};
	} catch (error) {
		logger.error('MCPHandler: Error removing server:', error);
		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to remove MCP server: ${errorMessage(error)}`,
			{
				name: 'mcp-remove-server-error',
				service: 'mcp',
				action: 'remove-server',
				serverId: params.serverId,
			},
		);
	}
};

/**
 * @openapi
 * /api/v1/mcp/servers/{serverId}/connect:
 *   post:
 *     summary: Connect to MCP server
 *     description: Manually connect or reconnect to an MCP server
 *     tags: [MCP]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: serverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP server ID
 *     responses:
 *       200:
 *         description: Connection successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Connection failed or authentication required
 *       404:
 *         description: Server not found
 *       401:
 *         description: Unauthorized
 */
export const connectMCPServer = async (
	{ params, response }: RouterContext<
		'/servers/:serverId/connect',
		{ serverId: string }
	>,
) => {
	try {
		const { serverId } = params;
		if (!serverId) {
			response.status = 400;
			response.body = { error: 'Missing serverId parameter' };
			return;
		}

		const mcpManager = await getMCPManager();

		// Check if server exists
		const config = mcpManager.getMCPServerConfiguration(serverId);
		if (!config) {
			response.status = 404;
			response.body = { error: `Server '${serverId}' not found` };
			return;
		}

		await mcpManager.connectServerById(serverId);

		response.body = {
			success: true,
			message: `Successfully connected to MCP server '${config.name || serverId}'`,
		};
	} catch (error) {
		logger.error('MCPHandler: Error connecting to server:', error);

		// Check if it's an OAuth-related error
		if (error && typeof error === 'object' && 'name' in error) {
			if (error.name === 'oauth-config-incomplete' || error.name === 'oauth-invalid-state') {
				response.status = 400;
				response.body = {
					error: 'OAuth authentication required',
					message: errorMessage(error),
					requiresAuth: true,
				};
				return;
			}
		}

		throw createError(
			ErrorType.ExternalServiceError,
			`Failed to connect to MCP server: ${errorMessage(error)}`,
			{
				name: 'mcp-connect-server-error',
				service: 'mcp',
				action: 'connect-server',
				serverId: params.serverId,
			},
		);
	}
};
