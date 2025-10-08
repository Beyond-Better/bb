/**
 * MCP OAuth Service
 *
 * Handles OAuth flows, token management, and client registration for MCP servers.
 * Extracted from MCPManager to improve modularity and testability.
 */

import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import { saveServerConfig } from 'api/utils/mcp.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type {
	GlobalConfig,
	MCPServerConfig,
	//MCPOAuthConfig
} from 'shared/config/types.ts';
import { generateCodeChallenge, generateCodeVerifier } from 'shared/pkce.ts';
import type { OAuthClientProvider } from 'mcp/client/auth.js';
import type {
	OAuthClientInformation,
	OAuthClientInformationFull,
	OAuthClientMetadata,
	OAuthTokens,
} from 'mcp/shared/auth.js';
import { getBuiOAuthCallbackUrl, getBuiOAuthCallbackUrls } from 'shared/url.ts';

// Import types from the extracted types file
import type {
	ClientRegistrationRequest,
	ClientRegistrationResponse,
	McpServerInfo,
	OAuthServerMetadata,
} from 'api/types/mcp.ts';

/**
 * OAuth Client Provider implementation for MCP SDK integration
 * Handles token storage and authorization flow callbacks
 */
export class BBOAuthClientProvider implements OAuthClientProvider {
	private _clientInformation?: OAuthClientInformationFull;
	private _tokens?: OAuthTokens;
	private _codeVerifier?: string;

	constructor(
		private readonly _redirectUrl: string | URL,
		private readonly _clientMetadata: OAuthClientMetadata,
		private readonly serverId: string,
		private readonly oauthService: MCPOAuthService,
		private readonly onRedirect?: (url: URL) => void,
	) {}

	get redirectUrl(): string | URL {
		return this._redirectUrl;
	}

	get clientMetadata(): OAuthClientMetadata {
		return this._clientMetadata;
	}

	clientInformation(): OAuthClientInformation | undefined {
		return this._clientInformation;
	}

	saveClientInformation(clientInformation: OAuthClientInformationFull): void {
		this._clientInformation = clientInformation;
		// Update server config with client information
		const serverInfo = this.oauthService.getServerInfo(this.serverId);
		if (serverInfo?.config.oauth) {
			serverInfo.config.oauth.clientId = clientInformation.client_id;
			if (clientInformation.client_secret) {
				serverInfo.config.oauth.clientSecret = clientInformation.client_secret;
			}
			// Add Dynamic Registration metadata
			serverInfo.config.oauth.registrationTimestamp = Date.now();
			// Check for Dynamic Registration response fields (may not be in MCP SDK type)
			const extendedClientInfo = clientInformation as OAuthClientInformationFull & {
				registration_access_token: string;
				registration_client_uri: string;
			};
			if (extendedClientInfo.registration_access_token) {
				serverInfo.config.oauth.registrationAccessToken = extendedClientInfo.registration_access_token;
			}
			if (extendedClientInfo.registration_client_uri) {
				serverInfo.config.oauth.registrationClientUri = extendedClientInfo.registration_client_uri;
			}

			logger.info('BBOAuthClientProvider: saveClientInformation - Saving serverInfo', {
				serverId: serverInfo.config.id,
			});
			// **PERSIST TO DISK IMMEDIATELY**
			saveServerConfig(serverInfo.config).catch((error: Error) => {
				logger.error(
					`BBOAuthClientProvider: Failed to persist client information for ${this.serverId}:`,
					error,
				);
			});
		}
	}

	tokens(): OAuthTokens | undefined {
		return this._tokens;
	}

	saveTokens(tokens: OAuthTokens): void {
		this._tokens = tokens;
		// Update server config with tokens
		const serverInfo = this.oauthService.getServerInfo(this.serverId);
		if (serverInfo?.config.oauth) {
			serverInfo.config.oauth.accessToken = tokens.access_token;
			if (tokens.refresh_token) {
				serverInfo.config.oauth.refreshToken = tokens.refresh_token;
			}
			if (tokens.expires_in) {
				serverInfo.config.oauth.expiresAt = Date.now() + (tokens.expires_in * 1000);
			}

			logger.info('BBOAuthClientProvider: saveTokens - Saving serverInfo', {
				serverId: serverInfo.config.id,
			});
			// **PERSIST TO DISK IMMEDIATELY**
			saveServerConfig(serverInfo.config).catch((error: Error) => {
				logger.error(`BBOAuthClientProvider: Failed to persist tokens for ${this.serverId}:`, error);
			});
		}
		// Update tokens in memory
		if (serverInfo?.tokens) {
			serverInfo.tokens.accessToken = tokens.access_token;
			if (tokens.refresh_token) {
				serverInfo.tokens.refreshToken = tokens.refresh_token;
			}
			if (tokens.expires_in) {
				serverInfo.tokens.expiresAt = Date.now() + (tokens.expires_in * 1000);
			}
		}
	}

	redirectToAuthorization(authorizationUrl: URL): void {
		logger.info(`MCPOAuthService: OAuth redirect required for server ${this.serverId}: ${authorizationUrl}`);
		if (this.onRedirect) {
			this.onRedirect(authorizationUrl);
		} else {
			// Store authorization URL for manual handling
			const serverInfo = this.oauthService.getServerInfo(this.serverId);
			if (serverInfo) {
				// Store the URL so it can be retrieved by the API
				serverInfo.pendingAuthUrl = authorizationUrl.toString();
			}
		}
	}

	saveCodeVerifier(codeVerifier: string): void {
		this._codeVerifier = codeVerifier;
	}

	codeVerifier(): string {
		if (!this._codeVerifier) {
			throw new Error('No code verifier saved');
		}
		return this._codeVerifier;
	}
}

/**
 * MCP OAuth Service
 * Handles all OAuth-related functionality for MCP servers
 */
export class MCPOAuthService {
	private globalConfig!: GlobalConfig;
	// Storage for OAuth state during authorization flows
	private oauthStates: Map<string, {
		serverId: string;
		codeVerifier?: string;
		createdAt: number;
	}> = new Map();

	constructor(
		private servers: Map<string, McpServerInfo>,
		globalConfig: GlobalConfig,
	) {
		this.globalConfig = globalConfig;
	}

	/**
	 * Get server info by ID (used by BBOAuthClientProvider)
	 */
	getServerInfo(serverId: string): McpServerInfo | undefined {
		return this.servers.get(serverId);
	}

	// ============================================================================
	// OAUTH CONFIGURATION AND SETUP METHODS
	// ============================================================================

	/**
	 * Ensure OAuth configuration is complete for a server
	 * Implements hybrid approach: Dynamic Registration → Manual Configuration
	 * NOTE: This is now called from connection attempts AND OAuth status checks
	 * Handles partial OAuth configurations gracefully
	 */
	async ensureOAuthConfiguration(config: MCPServerConfig): Promise<void> {
		if (!config.url || !config.oauth) {
			return;
		}

		// Allow partial OAuth config - just grantType is enough to start discovery
		if (!config.oauth.grantType) {
			return;
		}

		try {
			logger.info('MCPOAuthService: OAuth Configuration Ensure Start', {
				serverId: config.id,
				serverUrl: config.url,
				grantType: config.oauth?.grantType,
				has_client_id: !!config.oauth?.clientId,
				has_client_secret: !!config.oauth?.clientSecret,
				has_authorization_endpoint: !!config.oauth?.authorizationEndpoint,
				has_token_endpoint: !!config.oauth?.tokenEndpoint,
				step: 'oauth_config_ensure_start',
			});

			// Step 1: Discover OAuth endpoints
			logger.info('MCPOAuthService: OAuth Endpoint Discovery Phase', {
				serverId: config.id,
				step: 'discovery_phase_start',
			});
			const metadata = await this.discoverOAuthEndpoints(config.url);

			// Update config with discovered endpoints
			config.oauth.authorizationEndpoint = metadata.authorization_endpoint;
			config.oauth.tokenEndpoint = metadata.token_endpoint;

			logger.info('MCPOAuthService: OAuth Endpoints Updated in Config', {
				serverId: config.id,
				authorization_endpoint: metadata.authorization_endpoint,
				token_endpoint: metadata.token_endpoint,
				registration_endpoint: metadata.registration_endpoint,
				step: 'endpoints_updated_in_config',
			});

			// Step 2: Try Dynamic Registration if endpoint is available and no client_id exists
			if (metadata.registration_endpoint && !config.oauth.clientId) {
				logger.info('MCPOAuthService: Dynamic Registration Phase Start', {
					serverId: config.id,
					registration_endpoint: metadata.registration_endpoint,
					step: 'dynamic_registration_phase_start',
				});

				try {
					const clientInfo = await this.registerDynamicClient(
						config.url,
						metadata.registration_endpoint,
						config.id,
					);

					// Update config with registered client information
					config.oauth.clientId = clientInfo.client_id;
					if (clientInfo.client_secret) {
						config.oauth.clientSecret = clientInfo.client_secret;
					}

					logger.info('MCPOAuthService: Client Credentials Updated from Dynamic Registration', {
						serverId: config.id,
						client_id: clientInfo.client_id,
						has_client_secret: !!clientInfo.client_secret,
						step: 'dynamic_registration_credentials_updated',
					});

					// Save updated config to persistence
					logger.info('MCPOAuthService: Persisting config after dynamic registration', {
						serverId: config.id,
					});
					await saveServerConfig(config);

					logger.info('MCPOAuthService: Dynamic Registration Complete', {
						serverId: config.id,
						step: 'dynamic_registration_complete',
					});
					return;
				} catch (error) {
					logger.warn('MCPOAuthService: Dynamic Registration Failed - Fallback to Manual', {
						serverId: config.id,
						registration_endpoint: metadata.registration_endpoint,
						error: error instanceof Error
							? {
								name: error.name,
								message: error.message,
							}
							: error,
						step: 'dynamic_registration_failed_fallback',
					});
					// Continue to manual configuration check below
				}
			} else {
				logger.info('MCPOAuthService: Dynamic Registration Skipped', {
					serverId: config.id,
					has_registration_endpoint: !!metadata.registration_endpoint,
					has_existing_client_id: !!config.oauth.clientId,
					reason: !metadata.registration_endpoint ? 'no_registration_endpoint' : 'client_id_already_exists',
					step: 'dynamic_registration_skipped',
				});
			}

			// Step 3: Verify manual configuration is present
			if (!config.oauth.clientId) {
				const errorMessage = `OAuth configuration incomplete: Client ID required. Server ${
					metadata.registration_endpoint ? 'supports' : 'does not support'
				} Dynamic Registration.`;
				throw createError(
					ErrorType.MCPServer,
					errorMessage,
					{
						name: 'oauth-config-incomplete',
						service: 'oauth',
						action: 'ensure-config',
						serverId: config.id,
					},
				);
			}

			logger.info(`MCPOAuthService: OAuth configuration complete for ${config.id}`, {
				has_client_id: !!config.oauth.clientId,
				has_client_secret: !!config.oauth.clientSecret,
				supports_dynamic_registration: !!metadata.registration_endpoint,
				authorization_endpoint: config.oauth.authorizationEndpoint,
				token_endpoint: config.oauth.tokenEndpoint,
			});
		} catch (error) {
			logger.error(`MCPOAuthService: Failed to ensure OAuth configuration for ${config.id}:`, error);
			throw error;
		}
	}

	// ============================================================================
	// OAUTH DISCOVERY AND FLOW METHODS
	// ============================================================================

	/**
	 * Discover OAuth server endpoints for a given server URL
	 */
	async discoverOAuthEndpoints(serverUrl: string): Promise<OAuthServerMetadata> {
		try {
			// Get authorization base URL according to MCP spec
			const baseUrl = this.getAuthorizationBaseUrl(serverUrl);
			const discoveryUrl = new URL('/.well-known/oauth-authorization-server', baseUrl);

			logger.info('MCPOAuthService: OAuth Discovery Start', {
				serverUrl,
				baseUrl,
				discoveryUrl: discoveryUrl.toString(),
				step: 'oauth_server_discovery',
			});

			const response = await fetch(discoveryUrl.toString(), {
				headers: {
					'Accept': 'application/json',
					'User-Agent': 'bb-mcp-client/1.0',
					'MCP-Protocol-Version': '2024-11-05',
				},
			});

			if (!response.ok) {
				logger.warn('MCPOAuthService: OAuth Discovery Failed - Using Fallback Endpoints', {
					serverUrl,
					baseUrl,
					status: response.status,
					statusText: response.statusText,
					step: 'discovery_failed_fallback',
					fallbackEndpoints: {
						authorization_endpoint: `${baseUrl}/authorize`,
						token_endpoint: `${baseUrl}/token`,
						registration_endpoint: `${baseUrl}/register`,
					},
				});
				// Return fallback endpoints as per MCP spec
				return {
					authorization_endpoint: `${baseUrl}/authorize`,
					token_endpoint: `${baseUrl}/token`,
					registration_endpoint: `${baseUrl}/register`,
					grant_types_supported: ['authorization_code', 'refresh_token'],
					response_types_supported: ['code'],
					code_challenge_methods_supported: ['S256'],
				};
			}

			const metadata = await response.json() as OAuthServerMetadata;

			// Validate required fields
			if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
				logger.error('MCPOAuthService: Invalid OAuth Server Metadata', {
					serverUrl,
					metadata,
					has_authorization_endpoint: !!metadata.authorization_endpoint,
					has_token_endpoint: !!metadata.token_endpoint,
					step: 'discovery_validation_failed',
				});
				throw new Error('Invalid OAuth server metadata: missing required endpoints');
			}

			logger.info('MCPOAuthService: OAuth Discovery Successful', {
				serverUrl,
				baseUrl,
				authorization_endpoint: metadata.authorization_endpoint,
				token_endpoint: metadata.token_endpoint,
				registration_endpoint: metadata.registration_endpoint,
				scopes_supported: metadata.scopes_supported,
				grant_types_supported: metadata.grant_types_supported,
				code_challenge_methods_supported: metadata.code_challenge_methods_supported,
				step: 'discovery_success',
				supports_dynamic_registration: !!metadata.registration_endpoint,
			});

			return metadata;
		} catch (error) {
			// If discovery completely fails, return fallback endpoints
			logger.warn(`MCPOAuthService: OAuth discovery failed for ${serverUrl}, using fallback endpoints:`, error);
			const baseUrl = this.getAuthorizationBaseUrl(serverUrl);
			return {
				authorization_endpoint: `${baseUrl}/authorize`,
				token_endpoint: `${baseUrl}/token`,
				registration_endpoint: `${baseUrl}/register`,
				grant_types_supported: ['authorization_code', 'refresh_token'],
				response_types_supported: ['code'],
				code_challenge_methods_supported: ['S256'],
			};
		}
	}

	/**
	 * Get authorization base URL from MCP server URL
	 * According to MCP spec: discard path component from server URL
	 */
	private getAuthorizationBaseUrl(serverUrl: string): string {
		try {
			const url = new URL(serverUrl);
			// Return base URL without path
			return `${url.protocol}//${url.host}`;
		} catch (_error) {
			throw new Error(`Invalid server URL: ${serverUrl}`);
		}
	}

	/**
	 * Attempt Dynamic Client Registration (RFC7591)
	 */
	async registerDynamicClient(
		serverUrl: string,
		registrationEndpoint: string,
		serverId: string,
	): Promise<ClientRegistrationResponse> {
		try {
			logger.info('MCPOAuthService: Dynamic Client Registration Start', {
				serverUrl,
				registrationEndpoint,
				step: 'dynamic_registration_start',
			});

			// Prepare registration request according to RFC7591
			const registrationRequest: ClientRegistrationRequest = {
				client_name: 'BB MCP Client',
				redirect_uris: getBuiOAuthCallbackUrls(this.globalConfig, serverId),
				grant_types: ['authorization_code', 'refresh_token'],
				response_types: ['code'],
				token_endpoint_auth_method: 'client_secret_post',
				scope: 'mcp:tools read write',
			};

			logger.debug('MCPOAuthService: Dynamic Registration Request', {
				serverUrl,
				registrationEndpoint,
				request: {
					client_name: registrationRequest.client_name,
					redirect_uris: registrationRequest.redirect_uris,
					grant_types: registrationRequest.grant_types,
					response_types: registrationRequest.response_types,
					token_endpoint_auth_method: registrationRequest.token_endpoint_auth_method,
					scope: registrationRequest.scope,
				},
				step: 'registration_request_prepared',
			});

			const response = await fetch(registrationEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
					'User-Agent': 'bb-mcp-client/1.0',
					'MCP-Protocol-Version': '2024-11-05',
				},
				body: JSON.stringify(registrationRequest),
			});

			if (!response.ok) {
				const errorText = await response.text();
				logger.error('MCPOAuthService: Dynamic Registration Failed', {
					serverUrl,
					registrationEndpoint,
					status: response.status,
					statusText: response.statusText,
					errorText,
					step: 'registration_request_failed',
				});
				throw new Error(`Client registration failed: ${response.status} ${errorText}`);
			}

			const registrationResponse = await response.json() as ClientRegistrationResponse;

			logger.debug('MCPOAuthService: Registration Response Received', {
				serverUrl,
				response: {
					client_id: registrationResponse.client_id,
					has_client_secret: !!registrationResponse.client_secret,
					client_secret_expires_at: registrationResponse.client_secret_expires_at,
					has_registration_access_token: !!registrationResponse.registration_access_token,
					registration_client_uri: registrationResponse.registration_client_uri,
				},
				// DEBUG: Show what redirect URIs were registered
				debug_registered_redirect_uris: registrationRequest.redirect_uris,
				debug_server_id: serverId,
				step: 'registration_response_received',
			});

			// Validate required fields
			if (!registrationResponse.client_id) {
				logger.error('MCPOAuthService: Invalid Registration Response', {
					serverUrl,
					registrationResponse,
					step: 'registration_response_invalid',
				});
				throw new Error('Invalid registration response: missing client_id');
			}

			logger.info('MCPOAuthService: Dynamic Registration Success', {
				serverUrl,
				client_id: registrationResponse.client_id,
				has_client_secret: !!registrationResponse.client_secret,
				expires_at: registrationResponse.client_secret_expires_at,
				has_registration_access_token: !!registrationResponse.registration_access_token,
				step: 'dynamic_registration_success',
			});

			return registrationResponse;
		} catch (error) {
			logger.warn(`MCPOAuthService: Dynamic client registration failed for ${serverUrl}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Dynamic client registration failed: ${errorMessage(error)}`,
				{
					name: 'dynamic-client-registration-error',
					service: 'oauth',
					action: 'register-client',
					server: serverUrl,
				},
			);
		}
	}

	/**
	 * Generate authorization URL for OAuth Authorization Code flow
	 */
	async generateAuthorizationUrl(serverId: string, clientState?: string): Promise<string> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'generate-auth-url',
				serverId,
			});
		}

		const { config } = serverInfo;
		if (!config.oauth || !config.url) {
			throw new Error('OAuth configuration missing');
		}

		if (config.oauth.grantType !== 'authorization_code') {
			throw new Error('Authorization URL generation only supports authorization_code flow');
		}

		try {
			logger.info('MCPOAuthService: Authorization URL Generation Start', {
				serverId,
				grantType: config.oauth.grantType,
				has_authorization_endpoint: !!config.oauth.authorizationEndpoint,
				step: 'authorization_url_generation_start',
			});

			// Discover OAuth endpoints if not configured
			let authEndpoint = config.oauth.authorizationEndpoint;
			if (!authEndpoint) {
				logger.debug('MCPOAuthService: Authorization endpoint not configured, running discovery', {
					serverId,
					serverUrl: config.url,
				});
				const metadata = await this.discoverOAuthEndpoints(config.url);
				authEndpoint = metadata.authorization_endpoint;
				logger.debug('MCPOAuthService: Authorization endpoint discovered', {
					serverId,
					authEndpoint,
				});
			}

			// Generate PKCE parameters
			logger.debug('MCPOAuthService: Generating PKCE parameters', {
				serverId,
				step: 'pkce_generation',
			});
			const codeVerifier = generateCodeVerifier();
			const codeChallenge = await generateCodeChallenge(codeVerifier);

			// Use client-provided state or generate our own
			let state: string;
			let stateData: { csrf: string; origin?: string; isDui?: boolean };

			if (clientState) {
				// Use client-provided state (already base64 JSON encoded)
				state = clientState;
				try {
					stateData = JSON.parse(atob(clientState));
					logger.debug('MCPOAuthService: Using client-provided state', {
						serverId,
						hasOrigin: !!stateData.origin,
						isDui: stateData.isDui,
						step: 'client_state_parsed',
					});
				} catch (_e) {
					// If client state is invalid, treat as plain CSRF token
					stateData = { csrf: clientState };
					logger.warn('MCPOAuthService: Client state not base64 JSON, treating as plain token', {
						serverId,
						step: 'client_state_fallback',
					});
				}
			} else {
				// Generate our own state (fallback for backward compatibility)
				stateData = {
					csrf: crypto.randomUUID(),
					origin: getBuiOAuthCallbackUrl(this.globalConfig, serverId).split('/oauth')[0],
					isDui: false,
				};
				state = btoa(JSON.stringify(stateData));
				logger.debug('MCPOAuthService: Generated server state', {
					serverId,
					step: 'server_state_generated',
				});
			}

			logger.info('MCPOAuthService: PKCE Parameters Generated', {
				serverId,
				codeVerifier: 'HIDDEN_FOR_SECURITY',
				codeChallenge,
				state: 'HIDDEN_FOR_SECURITY',
				step: 'pkce_generated',
			});

			// Store OAuth state for callback validation using CSRF token
			this.oauthStates.set(stateData.csrf, {
				serverId,
				codeVerifier,
				createdAt: Date.now(),
			});

			logger.debug('MCPOAuthService: OAuth state stored for callback validation', {
				serverId,
				stateCount: this.oauthStates.size,
				step: 'oauth_state_stored',
			});

			// Build authorization URL
			const authUrl = new URL(authEndpoint);
			authUrl.searchParams.set('response_type', 'code');
			if (config.oauth.clientId) {
				authUrl.searchParams.set('client_id', config.oauth.clientId);
			} else {
				logger.error('MCPOAuthService: Authorization URL generation failed - no client ID', {
					serverId,
					has_oauth_config: !!config.oauth,
					step: 'auth_url_missing_client_id',
				});
				throw new Error('Client ID is required for authorization URL generation');
			}
			authUrl.searchParams.set('state', state);
			authUrl.searchParams.set('code_challenge', codeChallenge);
			authUrl.searchParams.set('code_challenge_method', 'S256');

			// Set redirect URI - always use fresh BUI config to avoid cached URLs
			// ALWAYS ensure redirectUri is set and saved to config for token exchange
			const freshRedirectUri = getBuiOAuthCallbackUrl(this.globalConfig, serverId);
			if (!config.oauth.redirectUri || config.oauth.redirectUri !== freshRedirectUri) {
				logger.info(
					`MCPOAuthService: Setting redirect URI for ${serverId}: ${
						config.oauth.redirectUri || 'undefined'
					} -> ${freshRedirectUri}`,
				);
				config.oauth.redirectUri = freshRedirectUri;
				await saveServerConfig(config);
			}
			// Use the saved config value (guaranteed to be set now)
			authUrl.searchParams.set('redirect_uri', config.oauth.redirectUri);

			if (config.oauth.scopes?.length) {
				authUrl.searchParams.set('scope', config.oauth.scopes.join(' '));
			}

			// Add additional parameters
			for (const [key, value] of Object.entries(config.oauth.additionalParams || {})) {
				authUrl.searchParams.set(key, String(value));
			}

			logger.info('MCPOAuthService: Authorization URL Generated Successfully', {
				serverId,
				authEndpoint,
				parameters: {
					response_type: 'code',
					client_id: config.oauth.clientId,
					state: 'HIDDEN_FOR_SECURITY',
					code_challenge: codeChallenge,
					code_challenge_method: 'S256',
					redirect_uri: config.oauth.redirectUri,
					scope: config.oauth.scopes?.join(' '),
					additionalParams: Object.keys(config.oauth.additionalParams || {}),
				},
				urlDomain: new URL(authUrl).hostname,
				step: 'authorization_url_generated',
				// DEBUG: Show exact values being sent
				debug_redirect_uri: config.oauth.redirectUri,
				debug_client_id: config.oauth.clientId,
				debug_final_url: authUrl.toString(),
			});
			return authUrl.toString();
		} catch (error) {
			logger.error(`MCPOAuthService: Failed to generate authorization URL for ${serverId}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Failed to generate authorization URL: ${errorMessage(error)}`,
				{
					name: 'oauth-auth-url-error',
					service: 'oauth',
					action: 'generate-auth-url',
					serverId,
				},
			);
		}
	}

	/**
	 * Handle OAuth authorization callback and exchange code for tokens
	 */
	async handleAuthorizationCallback(code: string, state: string): Promise<void> {
		// Parse state parameter to extract CSRF token
		let stateData: { csrf?: string; origin?: string; isDui?: boolean } = {};
		let csrfToken: string;

		try {
			stateData = JSON.parse(atob(state));
			csrfToken = stateData.csrf || state; // Fallback to plain state if no CSRF
		} catch (_e) {
			// If parsing fails, treat as plain token (backward compatibility)
			csrfToken = state;
		}

		// Validate and retrieve stored OAuth state using CSRF token
		const oauthState = this.oauthStates.get(csrfToken);
		if (!oauthState) {
			throw createError(
				ErrorType.MCPServer,
				'Invalid or expired OAuth state',
				{
					name: 'oauth-invalid-state',
					service: 'oauth',
					action: 'callback',
					params: { state, csrfToken },
				},
			);
		}

		// Clean up state (one-time use)
		this.oauthStates.delete(csrfToken);

		// Check state expiration (10 minutes)
		const stateAge = Date.now() - oauthState.createdAt;
		if (stateAge > 10 * 60 * 1000) {
			throw createError(
				ErrorType.MCPServer,
				'OAuth state expired',
				{
					name: 'oauth-expired-state',
					service: 'oauth',
					action: 'callback',
					params: { state },
				},
			);
		}

		const serverInfo = this.servers.get(oauthState.serverId);
		if (!serverInfo) {
			throw createError(
				ErrorType.ExternalServiceError,
				`MCP server ${oauthState.serverId} not found`,
				{
					name: 'mcp-server-error',
					service: 'mcp',
					action: 'callback',
					serverId: oauthState.serverId,
				},
			);
		}

		const { config } = serverInfo;
		if (!config.oauth || !config.url) {
			throw new Error('OAuth configuration missing');
		}

		try {
			logger.info('MCPOAuthService: Token Exchange Start', {
				serverId: oauthState.serverId,
				has_code: !!code,
				has_state: !!state,
				state_age_ms: Date.now() - oauthState.createdAt,
				step: 'token_exchange_start',
			});

			// Get token endpoint
			let tokenEndpoint = config.oauth.tokenEndpoint;
			if (!tokenEndpoint) {
				logger.debug('MCPOAuthService: Token endpoint not configured, running discovery', {
					serverId: oauthState.serverId,
					serverUrl: config.url,
				});
				const metadata = await this.discoverOAuthEndpoints(config.url);
				tokenEndpoint = metadata.token_endpoint;
				logger.debug('MCPOAuthService: Token endpoint discovered', {
					serverId: oauthState.serverId,
					tokenEndpoint,
				});
			}

			// Exchange authorization code for tokens
			logger.info('MCPOAuthService: Preparing Token Exchange Request', {
				serverId: oauthState.serverId,
				tokenEndpoint,
				grant_type: 'authorization_code',
				has_client_id: !!config.oauth.clientId,
				has_client_secret: !!config.oauth.clientSecret,
				has_code_verifier: !!oauthState.codeVerifier,
				has_redirect_uri: !!config.oauth.redirectUri,
				auth_method: config.oauth.clientSecret ? 'client_credentials' : 'pkce',
				step: 'token_exchange_request_prepared',
			});

			const tokenRequest = new FormData();
			tokenRequest.append('grant_type', 'authorization_code');
			tokenRequest.append('code', code);

			// Client ID is always required
			if (!config.oauth.clientId) {
				logger.error('MCPOAuthService: Token exchange failed - missing client ID', {
					serverId: oauthState.serverId,
					has_client_id: !!config.oauth.clientId,
					step: 'token_exchange_missing_client_id',
				});
				throw new Error('Client ID is required for token exchange');
			}
			tokenRequest.append('client_id', config.oauth.clientId);

			// Determine authentication method based on configuration
			if (config.oauth.clientSecret) {
				// Traditional OAuth with client credentials
				logger.debug('MCPOAuthService: Using client credentials authentication', {
					serverId: oauthState.serverId,
					method: 'client_secret',
					has_pkce: !!oauthState.codeVerifier,
					step: 'auth_method_client_credentials',
				});
				tokenRequest.append('client_secret', config.oauth.clientSecret);

				// PKCE can be used alongside client credentials for enhanced security
				if (oauthState.codeVerifier) {
					tokenRequest.append('code_verifier', oauthState.codeVerifier);
					logger.debug('MCPOAuthService: Using hybrid client credentials + PKCE', {
						serverId: oauthState.serverId,
						step: 'auth_method_hybrid',
					});
				}
			} else if (oauthState.codeVerifier) {
				// PKCE-only authentication (no client secret required)
				logger.debug('MCPOAuthService: Using PKCE authentication (no client secret)', {
					serverId: oauthState.serverId,
					method: 'pkce',
					step: 'auth_method_pkce',
				});
				tokenRequest.append('code_verifier', oauthState.codeVerifier);
			} else {
				// Neither client secret nor PKCE - this is invalid
				logger.error('MCPOAuthService: Token exchange failed - no authentication method', {
					serverId: oauthState.serverId,
					has_client_secret: !!config.oauth.clientSecret,
					has_code_verifier: !!oauthState.codeVerifier,
					step: 'token_exchange_no_auth_method',
				});
				throw new Error('Either client secret or PKCE code verifier is required for token exchange');
			}

			if (config.oauth.redirectUri) {
				tokenRequest.append('redirect_uri', config.oauth.redirectUri);
			}

			logger.debug('MCPOAuthService: PKCE Verification Details', {
				serverId: oauthState.serverId,
				code_verifier: 'HIDDEN_FOR_SECURITY',
				code_verifier_length: oauthState.codeVerifier?.length || 0,
				step: 'pkce_verification_prepared',
			});

			const tokenResponse = await fetch(tokenEndpoint, {
				method: 'POST',
				body: tokenRequest,
				headers: {
					'Accept': 'application/json',
					'User-Agent': 'bb-mcp-client/1.0',
				},
			});

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				logger.error('MCPOAuthService: Token Exchange Failed', {
					serverId: oauthState.serverId,
					tokenEndpoint,
					status: tokenResponse.status,
					statusText: tokenResponse.statusText,
					errorText,
					step: 'token_exchange_failed',
				});
				throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
			}

			const tokens = await tokenResponse.json();

			// Validate token response
			if (!tokens.access_token) {
				logger.error('MCPOAuthService: Invalid Token Response', {
					serverId: oauthState.serverId,
					tokens: {
						has_access_token: !!tokens.access_token,
						has_refresh_token: !!tokens.refresh_token,
						token_type: tokens.token_type,
					},
					step: 'token_response_validation_failed',
				});
				throw new Error('Invalid token response: missing access_token');
			}

			// Calculate expiration time
			const expiresAt = tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined;

			logger.info('MCPOAuthService: Token Exchange Successful', {
				serverId: oauthState.serverId,
				has_access_token: !!tokens.access_token,
				has_refresh_token: !!tokens.refresh_token,
				token_type: tokens.token_type,
				expires_in_seconds: tokens.expires_in,
				expires_at: expiresAt ? new Date(expiresAt).toISOString() : 'never',
				scope: tokens.scope,
				step: 'token_exchange_success',
			});

			// Store tokens in server configuration and memory
			config.oauth.accessToken = tokens.access_token;
			config.oauth.refreshToken = tokens.refresh_token;
			config.oauth.expiresAt = expiresAt;

			// Update tokens in memory
			serverInfo.tokens = {
				accessToken: tokens.access_token,
				refreshToken: tokens.refresh_token,
				expiresAt,
			};

			// Update configuration in persistent storage
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			if (globalConfig.api.mcpServers) {
				const serverIndex = globalConfig.api.mcpServers.findIndex((s) => s.id === oauthState.serverId);
				if (serverIndex >= 0) {
					globalConfig.api.mcpServers[serverIndex] = config;
					await configManager.updateGlobalConfig(globalConfig);
				}
			}

			logger.info(
				`MCPOAuthService: Successfully exchanged OAuth code for tokens (server: ${oauthState.serverId})`,
				{
					expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'no expiration',
					hasRefreshToken: !!tokens.refresh_token,
				},
			);
		} catch (error) {
			logger.error(`MCPOAuthService: OAuth callback failed for server ${oauthState.serverId}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`OAuth callback failed: ${errorMessage(error)}`,
				{
					name: 'oauth-callback-error',
					service: 'oauth',
					action: 'callback',
					serverId: oauthState.serverId,
				},
			);
		}
	}

	/**
	 * Refresh expired access token using refresh token
	 */
	async refreshAccessToken(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'refresh-token',
				serverId,
			});
		}

		const { config } = serverInfo;
		if (!config.oauth?.refreshToken || !config.url) {
			throw new Error('Refresh token not available');
		}

		try {
			// Get token endpoint
			let tokenEndpoint = config.oauth.tokenEndpoint;
			if (!tokenEndpoint) {
				const metadata = await this.discoverOAuthEndpoints(config.url);
				tokenEndpoint = metadata.token_endpoint;
			}

			// Request new tokens using refresh token
			const refreshRequest = new FormData();
			refreshRequest.append('grant_type', 'refresh_token');
			refreshRequest.append('refresh_token', config.oauth.refreshToken);

			// Client ID is always required
			if (!config.oauth.clientId) {
				throw new Error('Client ID is required for token refresh');
			}
			refreshRequest.append('client_id', config.oauth.clientId);

			// Client secret is only required for confidential clients (not PKCE)
			if (config.oauth.clientSecret) {
				refreshRequest.append('client_secret', config.oauth.clientSecret);
				logger.debug(`MCPOAuthService: Using client secret for token refresh (server: ${serverId})`);
			} else {
				logger.debug(`MCPOAuthService: Using public client token refresh (server: ${serverId})`);
			}

			const refreshResponse = await fetch(tokenEndpoint, {
				method: 'POST',
				body: refreshRequest,
				headers: {
					'Accept': 'application/json',
					'User-Agent': 'bb-mcp-client/1.0',
				},
			});

			if (!refreshResponse.ok) {
				const errorText = await refreshResponse.text();
				throw new Error(`Token refresh failed: ${refreshResponse.status} ${errorText}`);
			}

			const tokens = await refreshResponse.json();

			if (!tokens.access_token) {
				throw new Error('Invalid refresh response: missing access_token');
			}

			// Calculate expiration time
			const expiresAt = tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined;

			// Update tokens
			config.oauth.accessToken = tokens.access_token;
			if (tokens.refresh_token) {
				config.oauth.refreshToken = tokens.refresh_token;
			}
			config.oauth.expiresAt = expiresAt;

			// Update tokens in memory
			if (serverInfo.tokens) {
				serverInfo.tokens.accessToken = tokens.access_token;
				if (tokens.refresh_token) {
					serverInfo.tokens.refreshToken = tokens.refresh_token;
				}
				serverInfo.tokens.expiresAt = expiresAt;
			}

			// Update configuration in persistent storage
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			if (globalConfig.api.mcpServers) {
				const serverIndex = globalConfig.api.mcpServers.findIndex((s) => s.id === serverId);
				if (serverIndex >= 0) {
					globalConfig.api.mcpServers[serverIndex] = config;
					await configManager.updateGlobalConfig(globalConfig);
				}
			}

			logger.info(`MCPOAuthService: Successfully refreshed access token for server ${serverId}`, {
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'no expiration',
			});
		} catch (error) {
			logger.error(`MCPOAuthService: Token refresh failed for server ${serverId}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Token refresh failed: ${errorMessage(error)}`,
				{
					name: 'oauth-refresh-error',
					service: 'oauth',
					action: 'refresh-token',
					serverId,
				},
			);
		}
	}

	/**
	 * Check if access token needs refreshing and refresh if necessary
	 */
	async ensureValidToken(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo?.tokens?.expiresAt) {
			return; // No expiration time set, assume token is valid
		}

		// Check if token expires within the next 5 minutes
		const fiveMinutes = 5 * 60 * 1000;
		if (Date.now() + fiveMinutes >= serverInfo.tokens.expiresAt) {
			logger.debug(`MCPOAuthService: Access token expiring soon for server ${serverId}, refreshing...`);
			await this.refreshAccessToken(serverId);
		}
	}

	/**
	 * Perform Client Credentials OAuth flow for app-to-app authentication
	 */
	async performClientCredentialsFlow(serverId: string): Promise<void> {
		const serverInfo = this.servers.get(serverId);
		if (!serverInfo) {
			throw createError(ErrorType.ExternalServiceError, `MCP server ${serverId} not found`, {
				name: 'mcp-server-error',
				service: 'mcp',
				action: 'client-credentials',
				serverId,
			});
		}

		const { config } = serverInfo;
		if (!config.oauth || !config.url) {
			throw new Error('OAuth configuration missing');
		}

		if (config.oauth.grantType !== 'client_credentials') {
			throw new Error('Client credentials flow only supports client_credentials grant type');
		}

		try {
			logger.info('MCPOAuthService: Client Credentials Flow Start', {
				serverId,
				grant_type: 'client_credentials',
				has_client_id: !!config.oauth.clientId,
				has_client_secret: !!config.oauth.clientSecret,
				scopes: config.oauth.scopes,
				step: 'client_credentials_start',
			});

			// Get token endpoint
			let tokenEndpoint = config.oauth.tokenEndpoint;
			if (!tokenEndpoint) {
				logger.debug('MCPOAuthService: Token endpoint not configured, running discovery', {
					serverId,
					serverUrl: config.url,
				});
				const metadata = await this.discoverOAuthEndpoints(config.url);
				tokenEndpoint = metadata.token_endpoint;
				logger.debug('MCPOAuthService: Token endpoint discovered for client credentials', {
					serverId,
					tokenEndpoint,
				});
			}

			// Request tokens using client credentials
			logger.info('MCPOAuthService: Preparing Client Credentials Request', {
				serverId,
				tokenEndpoint,
				grant_type: 'client_credentials',
				has_client_id: !!config.oauth.clientId,
				has_client_secret: !!config.oauth.clientSecret,
				scopes: config.oauth.scopes,
				step: 'client_credentials_request_prepared',
			});

			const tokenRequest = new FormData();
			tokenRequest.append('grant_type', 'client_credentials');

			// Client credentials flow ALWAYS requires both client ID and secret
			if (!config.oauth.clientId || !config.oauth.clientSecret) {
				logger.error('MCPOAuthService: Client credentials flow failed - missing credentials', {
					serverId,
					has_client_id: !!config.oauth.clientId,
					has_client_secret: !!config.oauth.clientSecret,
					step: 'client_credentials_missing_credentials',
				});
				throw new Error('Client ID and secret are required for client credentials flow');
			}
			tokenRequest.append('client_id', config.oauth.clientId);
			tokenRequest.append('client_secret', config.oauth.clientSecret);

			if (config.oauth.scopes?.length) {
				tokenRequest.append('scope', config.oauth.scopes.join(' '));
			}

			const tokenResponse = await fetch(tokenEndpoint, {
				method: 'POST',
				body: tokenRequest,
				headers: {
					'Accept': 'application/json',
					'User-Agent': 'bb-mcp-client/1.0',
				},
			});

			if (!tokenResponse.ok) {
				const errorText = await tokenResponse.text();
				throw new Error(`Client credentials flow failed: ${tokenResponse.status} ${errorText}`);
			}

			const tokens = await tokenResponse.json();

			if (!tokens.access_token) {
				throw new Error('Invalid token response: missing access_token');
			}

			// Calculate expiration time
			const expiresAt = tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined;

			// Store tokens
			config.oauth.accessToken = tokens.access_token;
			config.oauth.expiresAt = expiresAt;
			// Note: Client credentials flow typically doesn't provide refresh tokens

			// Update tokens in memory
			serverInfo.tokens = {
				accessToken: tokens.access_token,
				expiresAt,
			};

			// Update configuration in persistent storage
			const configManager = await getConfigManager();
			const globalConfig = await configManager.getGlobalConfig();
			if (globalConfig.api.mcpServers) {
				const serverIndex = globalConfig.api.mcpServers.findIndex((s) => s.id === serverId);
				if (serverIndex >= 0) {
					globalConfig.api.mcpServers[serverIndex] = config;
					await configManager.updateGlobalConfig(globalConfig);
				}
			}

			logger.info(`MCPOAuthService: Successfully completed client credentials flow (server: ${serverId})`, {
				expiresAt: expiresAt ? new Date(expiresAt).toISOString() : 'no expiration',
			});
		} catch (error) {
			logger.error(`MCPOAuthService: Client credentials flow failed for server ${serverId}:`, error);
			throw createError(
				ErrorType.ExternalServiceError,
				`Client credentials flow failed: ${errorMessage(error)}`,
				{
					name: 'oauth-client-credentials-error',
					service: 'oauth',
					action: 'client-credentials',
					serverId,
				},
			);
		}
	}
}
