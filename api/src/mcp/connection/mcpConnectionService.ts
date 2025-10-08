import { Client } from 'mcp/client/index.js';
import { StdioClientTransport } from 'mcp/client/stdio.js';
import { StreamableHTTPClientTransport } from 'mcp/client/streamableHttp.js';
import type { StreamableHTTPClientTransportOptions } from 'mcp/client/streamableHttp.js';
import type { Transport } from 'mcp/shared/transport.js';
import type { OAuthClientInformationFull, OAuthClientMetadata, OAuthTokens } from 'mcp/shared/auth.js';
import { CreateMessageRequestSchema, ElicitRequestSchema, LoggingMessageNotificationSchema } from 'mcp/types.js';

import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import { getVersionInfo } from 'shared/version.ts';
import { getBuiOAuthCallbackUrls } from 'shared/url.ts';
import { getConfigManager } from 'shared/config/configManager.ts';

import type { GlobalConfig, MCPServerConfig } from 'shared/config/types.ts';
import type { McpServerInfo } from 'api/types/mcp.ts';
import { BBOAuthClientProvider, type MCPOAuthService } from 'api/mcp/auth/mcpOAuthService.ts';
import type { MCPRequestHandlerService } from 'api/mcp/handlers/mcpRequestHandlerService.ts';

/**
 * Service responsible for MCP transport creation and connection management.
 * Handles both STDIO and HTTP transports, connection lifecycle, and reconnection logic.
 */
export class MCPConnectionService {
	// Reconnection configuration
	// STDIO: Short-lived, local processes - fail fast
	private static readonly STDIO_MAX_RECONNECT_ATTEMPTS = 5;
	private static readonly STDIO_RECONNECT_DELAY = 1000; // 1 second
	private static readonly STDIO_MAX_RECONNECT_DELAY = 30000; // 30 seconds

	// HTTP: Remote servers - persist longer, they may restart
	private static readonly HTTP_MAX_RECONNECT_ATTEMPTS = 60; // ~1 hour with max delay
	private static readonly HTTP_RECONNECT_DELAY = 60000; // 60 seconds
	private static readonly HTTP_MAX_RECONNECT_DELAY = 300000; // 300 seconds (5 minutes)

	// Health check configuration
	private static readonly DEFAULT_HEALTH_CHECK_IDLE_MINUTES = 5;
	private static readonly HEALTH_CHECK_TIMEOUT = 10000; // 10 seconds

	// Active reconnection timers
	private reconnectionTimers = new Map<string, number>();

	// Health check timers
	private healthCheckTimers = new Map<string, number>();

	constructor(
		private servers: Map<string, McpServerInfo>,
		private oauthService: MCPOAuthService,
		private globalConfig: GlobalConfig,
		private requestHandlerService: MCPRequestHandlerService,
	) {}

	// ============================================================================
	// TRANSPORT CREATION METHODS
	// ============================================================================

	/**
	 * Create STDIO transport for local MCP servers
	 */
	private createStdioTransport(config: MCPServerConfig): Transport {
		if (!config.command) {
			throw createError(ErrorType.ExternalServiceError, 'STDIO transport requires command', {
				name: 'mcp-transport-configuration-error',
				service: 'mcp',
				action: 'create-stdio-transport',
				serverId: config.id,
			});
		}

		logger.debug(`MCPConnectionService: Creating STDIO transport for ${config.id}`, {
			command: config.command,
			args: config.args,
		});

		try {
			return new StdioClientTransport({
				command: config.command,
				args: config.args || [],
				env: this.buildEnvironment(config),
			});
		} catch (error) {
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to create STDIO transport: ${errorMessage(error)}`,
				{
					name: 'mcp-transport-creation-error',
					service: 'mcp',
					action: 'create-stdio-transport',
					serverId: config.id,
				},
			);
		}
	}

	/**
	 * Create HTTP transport for remote MCP servers with OAuth support
	 */
	private createHttpTransport(config: MCPServerConfig): Transport {
		if (!config.url) {
			throw createError(ErrorType.ExternalServiceError, 'HTTP transport requires URL', {
				name: 'mcp-transport-configuration-error',
				service: 'mcp',
				action: 'create-http-transport',
				serverId: config.id,
			});
		}

		// Validate HTTPS requirement for security
		try {
			const url = new URL(config.url);
			if (url.protocol !== 'https:' && url.hostname !== 'localhost' && !url.hostname.startsWith('127.')) {
				throw createError(
					ErrorType.ExternalServiceError,
					'HTTP transport requires HTTPS for remote servers (localhost allowed)',
					{
						name: 'mcp-transport-security-error',
						service: 'mcp',
						action: 'create-http-transport',
						serverId: config.id,
					},
				);
			}
		} catch (error) {
			if (
				error && typeof error === 'object' && 'name' in error && error.name === 'mcp-transport-security-error'
			) {
				throw error; // Re-throw our own error
			}
			throw createError(
				ErrorType.ExternalServiceError,
				`Invalid URL for HTTP transport: ${errorMessage(error)}`,
				{
					name: 'mcp-transport-configuration-error',
					service: 'mcp',
					action: 'create-http-transport',
					serverId: config.id,
				},
			);
		}

		logger.info(`MCPConnectionService: Creating HTTP transport for ${config.id}`, {
			url: config.url,
			oauth: !!config.oauth,
			grant_type: config.oauth?.grantType,
		});

		const transportOptions: StreamableHTTPClientTransportOptions = {
			reconnectionOptions: {
				initialReconnectionDelay: 1000, // 1 second
				maxReconnectionDelay: 30000, // 30 seconds
				reconnectionDelayGrowFactor: 2.0, // Double each time
				maxRetries: 10, // Much higher for server restarts
			},
		};

		// If OAuth is configured, create OAuth provider for MCP SDK
		if (config.oauth && config.oauth.grantType === 'authorization_code') {
			logger.info(`MCPConnectionService: Setting up OAuth provider for authorization code flow`);

			// Create OAuth client metadata for MCP SDK
			const clientMetadata: OAuthClientMetadata = {
				client_name: 'BB MCP Client',
				redirect_uris: getBuiOAuthCallbackUrls(this.globalConfig, config.id),
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
				token_endpoint_auth_method: 'client_secret_post',
				scope: config.oauth.scopes?.join(' ') || 'mcp:tools',
			};

			// Create OAuth provider
			const oauthProvider = new BBOAuthClientProvider(
				clientMetadata.redirect_uris[0], // Use first redirect URI
				clientMetadata,
				config.id,
				this.oauthService,
				(authUrl: URL) => {
					// Store authorization URL for API to retrieve
					logger.info(`MCPConnectionService: Authorization URL generated for ${config.id}: ${authUrl}`);
					const serverInfo = this.servers.get(config.id);
					if (serverInfo) {
						serverInfo.pendingAuthUrl = authUrl.toString();
					}
				},
			);

			// If we have client information from dynamic registration or manual config, set it
			if (config.oauth.clientId) {
				const clientInfo: OAuthClientInformationFull = {
					client_id: config.oauth.clientId,
					client_secret: config.oauth.clientSecret,
					...clientMetadata,
				};
				oauthProvider.saveClientInformation(clientInfo);
			}

			// If we have existing tokens, set them
			if (config.oauth.accessToken) {
				const tokens: OAuthTokens = {
					access_token: config.oauth.accessToken,
					refresh_token: config.oauth.refreshToken,
					token_type: 'Bearer',
					expires_in: config.oauth.expiresAt
						? Math.floor((config.oauth.expiresAt - Date.now()) / 1000)
						: undefined,
				};
				oauthProvider.saveTokens(tokens);
			}

			transportOptions.authProvider = oauthProvider;
		}

		try {
			const url = new URL(config.url);
			return new StreamableHTTPClientTransport(url, transportOptions);
		} catch (error) {
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to create HTTP transport: ${errorMessage(error)}`,
				{
					name: 'mcp-transport-creation-error',
					service: 'mcp',
					action: 'create-http-transport',
					serverId: config.id,
				},
			);
		}
	}

	/**
	 * Build environment variables for STDIO transport
	 */
	private buildEnvironment(config: MCPServerConfig): Record<string, string> {
		try {
			return {
				...Deno.env.toObject(),
				...config.env,
			};
		} catch (error) {
			logger.warn(`MCPConnectionService: Error building environment for ${config.id}:`, error);
			// Return config env only if system env fails
			return config.env || {};
		}
	}

	// ============================================================================
	// CONNECTION METHODS
	// ============================================================================

	/**
	 * Connect to an MCP server using the provided configuration
	 */
	async connectServer(config: MCPServerConfig): Promise<void> {
		const transportType = config.transport || 'stdio';
		logger.info(`MCPConnectionService: Connecting to MCP server: ${config.id} using ${transportType} transport`);

		try {
			// For HTTP transport with OAuth, handle authentication flows
			if (transportType === 'http' && config.oauth) {
				// Step 1: Ensure OAuth configuration is complete
				await this.oauthService.ensureOAuthConfiguration(config);

				// Step 2: Handle different grant types
				if (config.oauth.grantType === 'client_credentials' && !config.oauth.accessToken) {
					// Perform client credentials flow if no token exists
					logger.info(`MCPConnectionService: Performing client credentials flow for server ${config.id}`);
					// Store server info temporarily for OAuth flow
					this.initializeServerInfo(config, 'disconnected');
					await this.oauthService.performClientCredentialsFlow(config.id);
					// Update config after OAuth flow completes
					config = this.servers.get(config.id)!.config;
				} else if (config.oauth.grantType === 'authorization_code' && !config.oauth.accessToken) {
					// For authorization code flow, we cannot connect without an access token
					// Store server config but don't attempt transport connection
					logger.info(
						`MCPConnectionService: Authorization code flow - storing server config ${config.id} but skipping connection (no access token)`,
					);
					this.initializeServerInfo(config, 'disconnected');
					// Exit early - OAuth callback will call connectServer again with tokens
					return;
				}
			}

			const client = new Client(
				{
					name: 'beyond-better',
					version: (await getVersionInfo()).version,
				},
				{
					capabilities: {
						roots: {},
						sampling: {},
						elicitation: {},
					},
				},
			);

			// Set up client-specific error handler with reconnection logic
			client.onerror = (error) => {
				logger.warn(`MCPConnectionService: [${config.id}] Client error:`, error);
				this.handleConnectionError(config.id, error);
			};
			client.onclose = () => {
				logger.info(`MCPConnectionService: [${config.id}] Client close`);
				this.handleConnectionClose(config.id);
			};

			// Set up client-specific notification handler using request handler service
			/*
			  if (onNotification) {
				[
				  CancelledNotificationSchema,
				  LoggingMessageNotificationSchema,
				  ResourceUpdatedNotificationSchema,
				  ResourceListChangedNotificationSchema,
				  ToolListChangedNotificationSchema,
				  PromptListChangedNotificationSchema,
				].forEach((notificationSchema) => {
				  client.setNotificationHandler(notificationSchema, onNotification);
				});

				client.fallbackNotificationHandler = (
				  notification: Notification,
				): Promise<void> => {
				  onNotification(notification);
				  return Promise.resolve();
				};
			  }
			 */
			client.setNotificationHandler(
				LoggingMessageNotificationSchema, // deno-lint-ignore no-explicit-any
				async (notification: any) => {
					logger.info(`MCPConnectionService: [${config.id}] Notification: ${notification.params.data}`);
					// Delegate to request handler service for proper notification handling
					await this.requestHandlerService.handleNotificationRequest(
						config.id,
						notification.params,
						notification._meta as Record<string, unknown>,
					);
				},
			);

			// Set up sampling request handler using request handler service
			client.setRequestHandler(
				CreateMessageRequestSchema,
				// deno-lint-ignore no-explicit-any
				async (request: any, extra: Record<string, unknown>) => {
					logger.info(`MCPConnectionService: [${config.id}] Sampling: `, { request, extra });
					return await this.requestHandlerService.handleSamplingRequest(
						config.id,
						request.params,
						extra._meta as Record<string, unknown>,
					);
				},
			);

			// Set up elicitation request handler using request handler service
			client.setRequestHandler(
				ElicitRequestSchema,
				// deno-lint-ignore no-explicit-any
				async (request: any, extra: Record<string, unknown>) => {
					logger.info(`MCPConnectionService: [${config.id}] Elicitation: `, { request, extra });
					return await this.requestHandlerService.handleElicitationRequest(
						config.id,
						request.params,
						extra._meta as Record<string, unknown>,
					);
				},
			);

			let transport;
			if (transportType === 'stdio') {
				transport = this.createStdioTransport(config);
			} else if (transportType === 'http') {
				// Ensure token is valid before creating transport
				if (config.oauth?.accessToken) {
					// Store server info temporarily for token validation
					this.initializeServerInfo(config, 'connected', client, {
						accessToken: config.oauth.accessToken,
						refreshToken: config.oauth.refreshToken,
						expiresAt: config.oauth.expiresAt,
					});
					await this.oauthService.ensureValidToken(config.id);
					// Update config after potential token refresh
					config = this.servers.get(config.id)!.config;
				}
				logger.info(`MCPConnectionService: createHttpTransport with config`, config);
				transport = this.createHttpTransport(config);
			} else {
				throw createError(ErrorType.ExternalServiceError, `Unsupported transport type: ${transportType}`, {
					name: 'mcp-transport-configuration-error',
					service: 'mcp',
					action: 'connect-server',
					serverId: config.id,
				});
			}

			//logger.info(`MCPConnectionService: connecting transport: `, transport);
			await client.connect(transport);

			logger.info(`MCPConnectionService: adding to servers: `, config.id);
			// Store server info with transport-specific reconnection settings
			const maxAttempts = transportType === 'http'
				? MCPConnectionService.HTTP_MAX_RECONNECT_ATTEMPTS
				: MCPConnectionService.STDIO_MAX_RECONNECT_ATTEMPTS;
			const reconnectDelay = transportType === 'http'
				? MCPConnectionService.HTTP_RECONNECT_DELAY
				: MCPConnectionService.STDIO_RECONNECT_DELAY;

			this.servers.set(config.id, {
				server: client,
				sessionId: transport.sessionId,
				config,
				capabilities: ['read', 'list'],
				tokens: config.oauth
					? {
						accessToken: config.oauth.accessToken || '',
						refreshToken: config.oauth.refreshToken,
						expiresAt: config.oauth.expiresAt,
					}
					: undefined,
				// Connection state managed by this service
				connectionState: 'connected',
				reconnectAttempts: 0,
				maxReconnectAttempts: maxAttempts,
				reconnectDelay: reconnectDelay,
				// Health check tracking
				lastActivityTime: Date.now(),
			});

			// Start health check for HTTP transport if enabled
			if (transportType === 'http') {
				this.scheduleHealthCheck(config.id);
			}

			logger.info(`MCPConnectionService: Successfully connected to ${transportType} server: ${config.id}`);
		} catch (error) {
			logger.error(`MCPConnectionService: Error connecting to server ${config.id}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to connect to MCP server: ${errorMessage(error)}`,
				{
					name: 'mcp-connection-error',
					service: 'mcp',
					action: 'connect-server',
					serverId: config.id,
				},
			);
		}
	}

	/**
	 * Force a full reconnection for a server (close and recreate)
	 * Used by operation-level retry logic when session errors are detected
	 */
	async forceReconnect(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(
				ErrorType.ExternalServiceError,
				`MCP server ${serverId} not found`,
				{
					name: 'mcp-server-not-found',
					service: 'mcp',
					action: 'force-reconnect',
					serverId,
				},
			);
		}

		logger.info(`MCPConnectionService: Forcing reconnection for ${serverId}`);

		// Clear health check timer
		this.clearHealthCheckTimer(serverId);

		// Close existing connection
		try {
			await serverInfo.server.close();
		} catch (error) {
			logger.debug(`MCPConnectionService: Error closing connection during force reconnect:`, error);
		}

		// Mark as disconnected and clear cache
		serverInfo.connectionState = 'disconnected';
		serverInfo.tools = undefined;
		serverInfo.resources = undefined;

		// Perform immediate reconnection (not scheduled)
		await this.attemptReconnection(serverId);
	}

	/**
	 * Check if an error is a session error (public for use by service layers)
	 */
	isSessionError(error: Error): boolean {
		const message = error.message.toLowerCase();
		return (
			message.includes('no valid session') ||
			message.includes('session expired') ||
			message.includes('session id') ||
			(message.includes('http 400') && message.includes('session'))
		);
	}

	/**
	 * Check if an error is an auth error (public for use by service layers)
	 */
	isAuthError(error: Error): boolean {
		const message = error.message.toLowerCase();
		return (
			message.includes('http 401') ||
			message.includes('unauthorized') ||
			message.includes('authentication') ||
			message.includes('token')
		);
	}

	/**
	 * Public method to connect or reconnect a server by ID
	 * Used for dynamic server connections after OAuth completion or manual reconnection
	 */
	async connectServerById(serverId: string): Promise<void> {
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const config = globalConfig.api?.mcpServers?.find((s) => s.id === serverId);

		if (!config) {
			throw createError(
				ErrorType.ExternalServiceError,
				`MCP server ${serverId} not found in configuration`,
				{
					name: 'mcp-server-not-found',
					service: 'mcp',
					action: 'connect-server-by-id',
					serverId,
				},
			);
		}

		// Close existing connection if it exists
		const existingServerInfo = this.servers.get(serverId);
		if (existingServerInfo) {
			try {
				logger.info(`MCPConnectionService: Closing existing connection for server ${serverId}`);
				await existingServerInfo.server.close();
			} catch (error) {
				logger.debug(`MCPConnectionService: Error closing existing connection for ${serverId}:`, error);
			}
		}

		// Connect to the server
		await this.connectServer(config);
		logger.info(`MCPConnectionService: Successfully connected server ${serverId}`);
	}

	/**
	 * Initialize server info structure for OAuth flows
	 */
	private initializeServerInfo(
		config: MCPServerConfig,
		connectionState: 'connected' | 'disconnected' | 'reconnecting',
		client?: Client,
		tokens?: { accessToken: string; refreshToken?: string; expiresAt?: number },
	): void {
		const transportType = config.transport || 'stdio';
		const maxAttempts = transportType === 'http'
			? MCPConnectionService.HTTP_MAX_RECONNECT_ATTEMPTS
			: MCPConnectionService.STDIO_MAX_RECONNECT_ATTEMPTS;
		const reconnectDelay = transportType === 'http'
			? MCPConnectionService.HTTP_RECONNECT_DELAY
			: MCPConnectionService.STDIO_RECONNECT_DELAY;

		this.servers.set(config.id, {
			// deno-lint-ignore no-explicit-any
			server: client || (null as any), // Will be set after OAuth completes
			config,
			capabilities: ['read', 'list'],
			tokens: tokens
				? {
					accessToken: tokens.accessToken,
					refreshToken: tokens.refreshToken,
					expiresAt: tokens.expiresAt,
				}
				: undefined,
			// Initialize connection state
			connectionState,
			reconnectAttempts: 0,
			maxReconnectAttempts: maxAttempts,
			reconnectDelay: reconnectDelay,
			lastActivityTime: Date.now(),
		});
	}

	// ============================================================================
	// RECONNECTION METHODS
	// ============================================================================

	/**
	 * Handle connection errors and attempt reconnection
	 * Now handles both STDIO and HTTP transports with session error detection
	 */
	private handleConnectionError(serverId: string, error: Error): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot handle connection error for unknown server ${serverId}`);
			return;
		}

		const transportType = serverInfo.config.transport || 'stdio';
		logger.warn(`MCPConnectionService: [${serverId}] Connection error on ${transportType} transport:`, error);
		serverInfo.connectionState = 'disconnected';
		serverInfo.lastError = error;

		// Clear any existing tools/resources cache as they may be stale
		serverInfo.tools = undefined;
		serverInfo.resources = undefined;

		// Clear health check timer if active
		this.clearHealthCheckTimer(serverId);

		// Handle reconnection based on transport type and error type
		if (transportType === 'stdio') {
			// STDIO: Always use custom reconnection
			logger.info(`MCPConnectionService: [${serverId}] Scheduling STDIO reconnection`);
			this.scheduleReconnection(serverId);
		} else if (transportType === 'http') {
			// HTTP: Check for session errors that require full re-initialization
			if (this.isSessionError(error)) {
				logger.info(`MCPConnectionService: [${serverId}] Session error detected - forcing full reconnection`);
				this.scheduleReconnection(serverId);
			} else if (this.isAuthError(error)) {
				logger.info(`MCPConnectionService: [${serverId}] Auth error detected - will handle at operation level`);
				// Auth errors will be handled by operation-level retry with token refresh
			} else {
				logger.info(`MCPConnectionService: [${serverId}] HTTP transport error - relying on SDK reconnection`);
				// For other HTTP errors, rely on SDK reconnection
			}
		}
	}

	/**
	 * Handle connection close
	 * Now handles both STDIO and HTTP transports with full reconnection
	 */
	private handleConnectionClose(serverId: string): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot handle connection close for unknown server ${serverId}`);
			return;
		}

		const transportType = serverInfo.config.transport || 'stdio';

		if (serverInfo.connectionState === 'connected') {
			logger.warn(`MCPConnectionService: [${serverId}] ${transportType} connection closed unexpectedly`);
			serverInfo.connectionState = 'disconnected';
			// Clear cache as session is lost
			serverInfo.tools = undefined;
			serverInfo.resources = undefined;

			// Clear health check timer if active
			this.clearHealthCheckTimer(serverId);

			// Schedule reconnection for both STDIO and HTTP
			// HTTP connections that close unexpectedly likely need full re-initialization
			logger.info(`MCPConnectionService: [${serverId}] Scheduling reconnection after unexpected close`);
			this.scheduleReconnection(serverId);
		}
	}

	/**
	 * Schedule reconnection attempt with exponential backoff
	 * Uses transport-specific delay configuration
	 */
	private scheduleReconnection(serverId: string): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot schedule reconnection for unknown server ${serverId}`);
			return;
		}

		// Clear any existing reconnection timer
		const existingTimer = this.reconnectionTimers.get(serverId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Check if we've exceeded max attempts
		if (serverInfo.reconnectAttempts >= serverInfo.maxReconnectAttempts) {
			logger.error(
				`MCPConnectionService: [${serverId}] Max reconnection attempts (${serverInfo.maxReconnectAttempts}) exceeded`,
			);
			return;
		}

		serverInfo.reconnectAttempts++;

		// Calculate delay with exponential backoff using transport-specific max
		const transportType = serverInfo.config.transport || 'stdio';
		const maxDelay = transportType === 'http'
			? MCPConnectionService.HTTP_MAX_RECONNECT_DELAY
			: MCPConnectionService.STDIO_MAX_RECONNECT_DELAY;

		const delay = Math.min(
			serverInfo.reconnectDelay * Math.pow(2, serverInfo.reconnectAttempts - 1),
			maxDelay,
		);

		logger.info(
			`MCPConnectionService: [${serverId}] Scheduling ${transportType} reconnection attempt ${serverInfo.reconnectAttempts}/${serverInfo.maxReconnectAttempts} in ${delay}ms`,
		);

		const timerId = setTimeout(async () => {
			this.reconnectionTimers.delete(serverId);
			await this.attemptReconnection(serverId);
		}, delay);

		this.reconnectionTimers.set(serverId, timerId);
	}

	/**
	 * Attempt to reconnect to a server
	 */
	private async attemptReconnection(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo || serverInfo.connectionState === 'reconnecting') {
			return;
		}

		serverInfo.connectionState = 'reconnecting';
		logger.info(
			`MCPConnectionService: [${serverId}] Attempting reconnection (attempt ${serverInfo.reconnectAttempts})`,
		);

		try {
			// Close existing connection if still open
			try {
				await serverInfo.server.close();
			} catch (error) {
				logger.debug(`MCPConnectionService: [${serverId}] Error closing existing connection:`, error);
			}

			// Ensure OAuth token is valid if using OAuth
			if (serverInfo.config.oauth?.accessToken) {
				await this.oauthService.ensureValidToken(serverId);
			}

			// Recreate the connection
			await this.connectServer(serverInfo.config);

			// Reset reconnection state on successful connection
			const updatedServerInfo = this.servers.get(serverId);
			if (updatedServerInfo) {
				updatedServerInfo.reconnectAttempts = 0;
				const transportType = updatedServerInfo.config.transport || 'stdio';
				updatedServerInfo.reconnectDelay = transportType === 'http'
					? MCPConnectionService.HTTP_RECONNECT_DELAY
					: MCPConnectionService.STDIO_RECONNECT_DELAY;
				updatedServerInfo.lastError = undefined;
				updatedServerInfo.lastActivityTime = Date.now();

				// Restart health check for HTTP transport
				if (transportType === 'http') {
					this.scheduleHealthCheck(serverId);
				}
			}

			logger.info(`MCPConnectionService: [${serverId}] Successfully reconnected`);
		} catch (error) {
			logger.error(`MCPConnectionService: [${serverId}] Reconnection attempt failed:`, error);
			serverInfo.connectionState = 'disconnected';
			serverInfo.lastError = error as Error;

			// Schedule next attempt if we haven't exceeded max attempts
			if (serverInfo.reconnectAttempts < serverInfo.maxReconnectAttempts) {
				this.scheduleReconnection(serverId);
			}
		}
	}

	/**
	 * Check if a server is available (hybrid approach for STDIO vs HTTP)
	 */
	async isServerAvailable(serverId: string): Promise<boolean> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot check availability for unknown server ${serverId}`);
			return false;
		}

		if (serverInfo.connectionState === 'connected') {
			return true;
		}

		const transportType = serverInfo.config.transport || 'stdio';

		if (transportType === 'stdio') {
			// For STDIO, use our custom reconnection logic
			if (
				serverInfo.connectionState === 'disconnected' &&
				serverInfo.reconnectAttempts < serverInfo.maxReconnectAttempts
			) {
				logger.debug(`MCPConnectionService: [${serverId}] Attempting STDIO reconnection`);
				await this.attemptReconnection(serverId);
				// Check the updated connection state after reconnection attempt
				const updatedServerInfo = this.servers.get(serverId);
				return updatedServerInfo?.connectionState === 'connected' || false;
			}
		} else {
			// For HTTP, trust the SDK's reconnection and reset our state if needed
			// The SDK handles reconnection transparently, so we just validate the connection
			logger.debug(`MCPConnectionService: [${serverId}] HTTP transport - trusting SDK reconnection`);
			if (serverInfo.connectionState === 'disconnected') {
				// Reset our tracking since SDK handles HTTP reconnection
				serverInfo.connectionState = 'connected';
				serverInfo.reconnectAttempts = 0;
				serverInfo.lastError = undefined;
			}
			return true; // Trust that SDK will handle HTTP reconnection
		}

		return false;
	}

	/**
	 * Reset reconnection state for a server (useful for manual retries)
	 */
	resetReconnectionState(serverId: string): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot reset reconnection state for unknown server ${serverId}`);
			return;
		}

		const transportType = serverInfo.config.transport || 'stdio';
		serverInfo.reconnectAttempts = 0;
		serverInfo.reconnectDelay = transportType === 'http'
			? MCPConnectionService.HTTP_RECONNECT_DELAY
			: MCPConnectionService.STDIO_RECONNECT_DELAY;
		serverInfo.lastError = undefined;
		serverInfo.connectionState = 'connected'; // Reset to connected state
		serverInfo.lastActivityTime = Date.now();

		// Clear any pending reconnection timer
		const existingTimer = this.reconnectionTimers.get(serverId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.reconnectionTimers.delete(serverId);
		}

		logger.info(`MCPConnectionService: [${serverId}] Reconnection state reset`);
	}

	/**
	 * Validate session ID for HTTP transport after potential reconnection
	 */
	async validateHttpSession(serverId: string): Promise<boolean> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			logger.warn(`MCPConnectionService: Cannot validate session for unknown server ${serverId}`);
			return false;
		}

		const transportType = serverInfo.config.transport || 'stdio';
		if (transportType !== 'http') return true; // Only validate HTTP sessions

		try {
			// Try a simple operation to validate session
			await serverInfo.server.listTools();
			logger.debug(`MCPConnectionService: [${serverId}] HTTP session validation successful`);
			return true;
		} catch (error) {
			logger.warn(`MCPConnectionService: [${serverId}] HTTP session validation failed:`, error);
			// Mark as disconnected and clear cache
			serverInfo.connectionState = 'disconnected';
			serverInfo.tools = undefined;
			serverInfo.resources = undefined;
			return false;
		}
	}

	// ============================================================================
	// HEALTH CHECK METHODS (for HTTP transport)
	// ============================================================================

	/**
	 * Record activity for a server (resets idle timer)
	 */
	recordActivity(serverId: string): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) return;

		serverInfo.lastActivityTime = Date.now();

		// Reschedule health check after activity
		const transportType = serverInfo.config.transport || 'stdio';
		if (transportType === 'http') {
			this.scheduleHealthCheck(serverId);
		}
	}

	/**
	 * Schedule health check after idle period
	 */
	private scheduleHealthCheck(serverId: string): void {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) return;

		// Check if health checks are enabled (default true for HTTP)
		const healthCheckEnabled = serverInfo.config.healthCheckEnabled ?? true;
		if (!healthCheckEnabled) return;

		// Clear existing timer
		this.clearHealthCheckTimer(serverId);

		// Get configured idle time (default 5 minutes)
		const idleMinutes = serverInfo.config.healthCheckIdleMinutes ??
			MCPConnectionService.DEFAULT_HEALTH_CHECK_IDLE_MINUTES;
		const idleMs = idleMinutes * 60 * 1000;

		logger.debug(`MCPConnectionService: [${serverId}] Scheduling health check in ${idleMinutes} minutes`);

		const timerId = setTimeout(async () => {
			this.healthCheckTimers.delete(serverId);
			await this.performHealthCheck(serverId);
		}, idleMs);

		this.healthCheckTimers.set(serverId, timerId);
	}

	/**
	 * Perform health check using MCP ping
	 */
	private async performHealthCheck(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) return;

		// Only perform health check if connected and idle
		if (serverInfo.connectionState !== 'connected') {
			logger.debug(`MCPConnectionService: [${serverId}] Skipping health check - not connected`);
			return;
		}

		// Check if enough time has passed since last activity
		const idleMinutes = serverInfo.config.healthCheckIdleMinutes ??
			MCPConnectionService.DEFAULT_HEALTH_CHECK_IDLE_MINUTES;
		const idleMs = idleMinutes * 60 * 1000;
		const timeSinceActivity = Date.now() - (serverInfo.lastActivityTime || 0);

		if (timeSinceActivity < idleMs) {
			// Activity happened recently, reschedule
			logger.debug(`MCPConnectionService: [${serverId}] Rescheduling health check - recent activity`);
			this.scheduleHealthCheck(serverId);
			return;
		}

		logger.debug(`MCPConnectionService: [${serverId}] Performing health check via ping`);

		try {
			// Use MCP ping method with timeout
			const pingPromise = serverInfo.server.ping();
			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Health check timeout')), MCPConnectionService.HEALTH_CHECK_TIMEOUT)
			);

			await Promise.race([pingPromise, timeoutPromise]);
			logger.debug(`MCPConnectionService: [${serverId}] Health check passed`);

			// Schedule next health check
			this.scheduleHealthCheck(serverId);
		} catch (error) {
			logger.warn(`MCPConnectionService: [${serverId}] Health check failed:`, error);
			// Trigger reconnection on health check failure
			this.handleConnectionError(serverId, error as Error);
		}
	}

	/**
	 * Clear health check timer for a server
	 */
	private clearHealthCheckTimer(serverId: string): void {
		const existingTimer = this.healthCheckTimers.get(serverId);
		if (existingTimer) {
			clearTimeout(existingTimer);
			this.healthCheckTimers.delete(serverId);
		}
	}

	// ============================================================================
	// CLEANUP METHODS
	// ============================================================================

	/**
	 * Clean up all connections and timers
	 */
	async cleanup(): Promise<void> {
		logger.info('MCPConnectionService: Starting cleanup');

		// Clear all reconnection timers
		for (const [serverId, timerId] of this.reconnectionTimers.entries()) {
			clearTimeout(timerId);
			this.reconnectionTimers.delete(serverId);
			logger.debug(`MCPConnectionService: Cleared reconnection timer for ${serverId}`);
		}

		// Clear all health check timers
		for (const [serverId, timerId] of this.healthCheckTimers.entries()) {
			clearTimeout(timerId);
			this.healthCheckTimers.delete(serverId);
			logger.debug(`MCPConnectionService: Cleared health check timer for ${serverId}`);
		}

		// Close all server connections
		const cleanupPromises = Array.from(this.servers.entries()).map(async ([serverId, serverInfo]) => {
			try {
				logger.debug(`MCPConnectionService: Closing connection for ${serverId}`);
				await serverInfo.server.close();
				logger.debug(`MCPConnectionService: Closed connection for ${serverId}`);
			} catch (error) {
				logger.error(`MCPConnectionService: Error cleaning up server ${serverId}:`, error);
			}
		});

		await Promise.allSettled(cleanupPromises);
		logger.info('MCPConnectionService: Cleanup completed');
	}
}
