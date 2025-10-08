/**
 * Tests for MCPOAuthService
 *
 * Tests the OAuth functionality extracted from MCPManager to ensure
 * proper OAuth flows, token management, and client registration.
 */

import { assert, assertEquals, assertRejects } from '@std/assert';
import { BBOAuthClientProvider, MCPOAuthService } from 'api/mcp/auth/mcpOAuthService.ts';
import type { GlobalConfig, MCPServerConfig } from 'shared/config/types.ts';
import { GlobalConfigDefaults } from 'shared/config/types.ts';
import type { McpServerInfo, OAuthServerMetadata } from 'api/types/mcp.ts';

// Mock global config for testing
const mockGlobalConfig: GlobalConfig = {
	...GlobalConfigDefaults,
	bui: {
		...GlobalConfigDefaults.bui,
		hostname: 'localhost',
		port: 3000,
	},
	api: {
		...GlobalConfigDefaults.api,
		mcpServers: [],
	},
};

// Mock server configuration
function createMockServerConfig(serverId: string): MCPServerConfig {
	return {
		id: serverId,
		name: `Test Server ${serverId}`,
		url: 'https://example.com/mcp',
		transport: 'http',
		oauth: {
			grantType: 'authorization_code',
			scopes: ['mcp:tools'],
			clientId: `test-client-${serverId}`,
			clientSecret: `test-secret-${serverId}`,
			authorizationEndpoint: 'https://example.com/authorize',
			tokenEndpoint: 'https://example.com/token',
		},
	};
}

// Mock server info
function createMockServerInfo(serverId: string): McpServerInfo {
	return {
		server: {} as any, // Mock MCP client
		config: createMockServerConfig(serverId),
		capabilities: ['read', 'list'],
		connectionState: 'connected',
		reconnectAttempts: 0,
		maxReconnectAttempts: 5,
		reconnectDelay: 1000,
	} as McpServerInfo;
}

// Mock fetch for testing HTTP requests
let mockFetchResponses: Map<string, { status: number; body: any; headers?: Record<string, string> }> = new Map();

function setMockFetchResponse(url: string, response: { status: number; body: any; headers?: Record<string, string> }) {
	mockFetchResponses.set(url, response);
}

function clearMockFetchResponses() {
	mockFetchResponses.clear();
}

// Override global fetch for testing
const originalFetch = globalThis.fetch;
function mockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
	const url = input instanceof URL ? input.toString() : typeof input === 'string' ? input : input.url;
	const mockResponse = mockFetchResponses.get(url);

	if (mockResponse) {
		return Promise.resolve(
			new Response(
				JSON.stringify(mockResponse.body),
				{
					status: mockResponse.status,
					headers: {
						'Content-Type': 'application/json',
						...mockResponse.headers,
					},
				},
			),
		);
	}

	// Default to not found
	return Promise.resolve(new Response('Not Found', { status: 404 }));
}

Deno.test({
	name: 'MCPOAuthService - OAuth Discovery - Successful discovery',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock successful discovery response
			const discoveryResponse: OAuthServerMetadata = {
				authorization_endpoint: 'https://example.com/oauth/authorize',
				token_endpoint: 'https://example.com/oauth/token',
				registration_endpoint: 'https://example.com/oauth/register',
				grant_types_supported: ['authorization_code', 'refresh_token'],
				response_types_supported: ['code'],
				code_challenge_methods_supported: ['S256'],
			};

			setMockFetchResponse('https://example.com/.well-known/oauth-authorization-server', {
				status: 200,
				body: discoveryResponse,
			});

			// Test discovery
			const metadata = await oauthService.discoverOAuthEndpoints('https://example.com/mcp');

			assertEquals(metadata.authorization_endpoint, 'https://example.com/oauth/authorize');
			assertEquals(metadata.token_endpoint, 'https://example.com/oauth/token');
			assertEquals(metadata.registration_endpoint, 'https://example.com/oauth/register');
			assert(metadata.grant_types_supported?.includes('authorization_code'));
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - OAuth Discovery - Fallback endpoints on failure',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock failed discovery (404)
			setMockFetchResponse('https://example.com/.well-known/oauth-authorization-server', {
				status: 404,
				body: { error: 'Not found' },
			});

			// Test discovery falls back to standard endpoints
			const metadata = await oauthService.discoverOAuthEndpoints('https://example.com/mcp');

			assertEquals(metadata.authorization_endpoint, 'https://example.com/authorize');
			assertEquals(metadata.token_endpoint, 'https://example.com/token');
			assertEquals(metadata.registration_endpoint, 'https://example.com/register');
			assert(metadata.grant_types_supported?.includes('authorization_code'));
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Dynamic Client Registration - Successful registration',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock successful registration response
			const registrationResponse = {
				client_id: 'dynamic-client-123',
				client_secret: 'dynamic-secret-456',
				client_secret_expires_at: Date.now() + 3600000, // 1 hour from now
			};

			setMockFetchResponse('https://example.com/register', {
				status: 201,
				body: registrationResponse,
			});

			// Test registration
			const clientInfo = await oauthService.registerDynamicClient(
				'https://example.com/mcp',
				'https://example.com/register',
				'test-server-1',
			);

			assertEquals(clientInfo.client_id, 'dynamic-client-123');
			assertEquals(clientInfo.client_secret, 'dynamic-secret-456');
			assert(clientInfo.client_secret_expires_at);
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Dynamic Client Registration - Registration failure',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock failed registration response
			setMockFetchResponse('https://example.com/register', {
				status: 400,
				body: { error: 'invalid_request', error_description: 'Invalid client metadata' },
			});

			// Test registration failure
			await assertRejects(
				async () => {
					await oauthService.registerDynamicClient(
						'https://example.com/mcp',
						'https://example.com/register',
						'test-server-1',
					);
				},
				Error,
				'Client registration failed',
			);
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Generate Authorization URL - Success',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		// Generate authorization URL
		const authUrl = await oauthService.generateAuthorizationUrl('test-server-1');

		// Verify URL structure
		const url = new URL(authUrl);
		assertEquals(url.hostname, 'example.com');
		assertEquals(url.pathname, '/authorize');

		// Verify required parameters
		assertEquals(url.searchParams.get('response_type'), 'code');
		assertEquals(url.searchParams.get('client_id'), 'test-client-test-server-1');
		assert(url.searchParams.has('state'));
		assert(url.searchParams.has('code_challenge'));
		assertEquals(url.searchParams.get('code_challenge_method'), 'S256');
		assert(url.searchParams.has('redirect_uri'));
		assertEquals(url.searchParams.get('scope'), 'mcp:tools');
	},
});

Deno.test({
	name: 'MCPOAuthService - Generate Authorization URL - Server not found',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		// Test with non-existent server
		await assertRejects(
			async () => {
				await oauthService.generateAuthorizationUrl('non-existent-server');
			},
			Error,
			'MCP server non-existent-server not found',
		);
	},
});

Deno.test({
	name: 'MCPOAuthService - Token Refresh - Success',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const serverInfo = createMockServerInfo('test-server-1');
			// Add refresh token
			serverInfo.config.oauth!.refreshToken = 'test-refresh-token';
			serverInfo.tokens = {
				accessToken: 'old-access-token',
				refreshToken: 'test-refresh-token',
				expiresAt: Date.now() - 1000, // Expired
			};
			servers.set('test-server-1', serverInfo);

			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock successful token refresh response
			const tokenResponse = {
				access_token: 'new-access-token',
				refresh_token: 'new-refresh-token',
				token_type: 'Bearer',
				expires_in: 3600,
			};

			setMockFetchResponse('https://example.com/token', {
				status: 200,
				body: tokenResponse,
			});

			// Test token refresh
			await oauthService.refreshAccessToken('test-server-1');

			// Verify tokens were updated
			const updatedServerInfo = servers.get('test-server-1')!;
			assertEquals(updatedServerInfo.config.oauth?.accessToken, 'new-access-token');
			assertEquals(updatedServerInfo.config.oauth?.refreshToken, 'new-refresh-token');
			assert(updatedServerInfo.config.oauth?.expiresAt);
			assert(updatedServerInfo.config.oauth.expiresAt! > Date.now());
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Client Credentials Flow - Success',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const serverInfo = createMockServerInfo('test-server-1');
			// Set up for client credentials flow
			serverInfo.config.oauth!.grantType = 'client_credentials';
			servers.set('test-server-1', serverInfo);

			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock successful client credentials response
			const tokenResponse = {
				access_token: 'client-credentials-token',
				token_type: 'Bearer',
				expires_in: 3600,
				scope: 'mcp:tools',
			};

			setMockFetchResponse('https://example.com/token', {
				status: 200,
				body: tokenResponse,
			});

			// Test client credentials flow
			await oauthService.performClientCredentialsFlow('test-server-1');

			// Verify token was stored
			const updatedServerInfo = servers.get('test-server-1')!;
			assertEquals(updatedServerInfo.config.oauth?.accessToken, 'client-credentials-token');
			assert(updatedServerInfo.config.oauth?.expiresAt);
			assert(updatedServerInfo.config.oauth.expiresAt! > Date.now());
			// Client credentials typically don't include refresh tokens
			assert(!updatedServerInfo.config.oauth?.refreshToken);
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Ensure Valid Token - Refresh when expiring',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		// Override fetch
		globalThis.fetch = mockFetch;

		try {
			const servers = new Map<string, McpServerInfo>();
			const serverInfo = createMockServerInfo('test-server-1');
			// Set up token expiring soon
			serverInfo.config.oauth!.refreshToken = 'test-refresh-token';
			serverInfo.tokens = {
				accessToken: 'expiring-token',
				refreshToken: 'test-refresh-token',
				expiresAt: Date.now() + (2 * 60 * 1000), // Expires in 2 minutes (< 5 minute threshold)
			};
			servers.set('test-server-1', serverInfo);

			const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

			// Mock successful token refresh response
			const tokenResponse = {
				access_token: 'refreshed-token',
				refresh_token: 'new-refresh-token',
				token_type: 'Bearer',
				expires_in: 3600,
			};

			setMockFetchResponse('https://example.com/token', {
				status: 200,
				body: tokenResponse,
			});

			// Test ensure valid token triggers refresh
			await oauthService.ensureValidToken('test-server-1');

			// Verify token was refreshed
			const updatedServerInfo = servers.get('test-server-1')!;
			assertEquals(updatedServerInfo.tokens?.accessToken, 'refreshed-token');
			assertEquals(updatedServerInfo.tokens?.refreshToken, 'new-refresh-token');
		} finally {
			// Restore fetch
			globalThis.fetch = originalFetch;
			clearMockFetchResponses();
		}
	},
});

Deno.test({
	name: 'MCPOAuthService - Ensure Valid Token - No refresh when token valid',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		// Set up valid token (expires in 1 hour)
		serverInfo.tokens = {
			accessToken: 'valid-token',
			refreshToken: 'test-refresh-token',
			expiresAt: Date.now() + (60 * 60 * 1000), // Expires in 1 hour
		};
		servers.set('test-server-1', serverInfo);

		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		// Test ensure valid token does NOT trigger refresh
		await oauthService.ensureValidToken('test-server-1');

		// Verify token was NOT changed
		const updatedServerInfo = servers.get('test-server-1')!;
		assertEquals(updatedServerInfo.tokens?.accessToken, 'valid-token');
	},
});

Deno.test({
	name: 'BBOAuthClientProvider - Token and client info management',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		// Create OAuth client provider
		const clientProvider = new BBOAuthClientProvider(
			'http://localhost:3000/oauth/callback',
			{
				client_name: 'Test Client',
				redirect_uris: ['http://localhost:3000/oauth/callback'],
				grant_types: ['authorization_code'],
				response_types: ['code'],
				token_endpoint_auth_method: 'client_secret_post',
			},
			'test-server-1',
			oauthService,
		);

		// Test client information handling
		const clientInfo = {
			client_id: 'test-client-id',
			client_secret: 'test-client-secret',
			client_name: 'Test Client',
			redirect_uris: ['http://localhost:3000/oauth/callback'],
			grant_types: ['authorization_code'],
			response_types: ['code'],
			token_endpoint_auth_method: 'client_secret_post',
		};

		clientProvider.saveClientInformation(clientInfo);
		assertEquals(clientProvider.clientInformation()?.client_id, 'test-client-id');

		// Test token handling
		const tokens = {
			access_token: 'test-access-token',
			refresh_token: 'test-refresh-token',
			token_type: 'Bearer',
			expires_in: 3600,
		};

		clientProvider.saveTokens(tokens);
		assertEquals(clientProvider.tokens()?.access_token, 'test-access-token');

		// Test code verifier handling
		const codeVerifier = 'test-code-verifier-123';
		clientProvider.saveCodeVerifier(codeVerifier);
		assertEquals(clientProvider.codeVerifier(), codeVerifier);
	},
});

Deno.test({
	name: 'BBOAuthClientProvider - Authorization redirect handling',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		let redirectedUrl: URL | null = null;

		// Create OAuth client provider with redirect handler
		const clientProvider = new BBOAuthClientProvider(
			'http://localhost:3000/oauth/callback',
			{
				client_name: 'Test Client',
				redirect_uris: ['http://localhost:3000/oauth/callback'],
				grant_types: ['authorization_code'],
				response_types: ['code'],
				token_endpoint_auth_method: 'client_secret_post',
			},
			'test-server-1',
			oauthService,
			(url: URL) => {
				redirectedUrl = url;
			},
		);

		// Test redirect handling
		const authUrl = new URL('https://example.com/authorize?client_id=test&state=abc123');
		clientProvider.redirectToAuthorization(authUrl);

		// Verify redirect was called
		assert(redirectedUrl);
		assertEquals((redirectedUrl as URL).toString(), authUrl.toString());
	},
});

Deno.test({
	name: 'BBOAuthClientProvider - Pending auth URL storage when no redirect handler',
	sanitizeResources: false,
	sanitizeOps: false,
	async fn() {
		const servers = new Map<string, McpServerInfo>();
		const serverInfo = createMockServerInfo('test-server-1');
		servers.set('test-server-1', serverInfo);

		const oauthService = new MCPOAuthService(servers, mockGlobalConfig);

		// Create OAuth client provider without redirect handler
		const clientProvider = new BBOAuthClientProvider(
			'http://localhost:3000/oauth/callback',
			{
				client_name: 'Test Client',
				redirect_uris: ['http://localhost:3000/oauth/callback'],
				grant_types: ['authorization_code'],
				response_types: ['code'],
				token_endpoint_auth_method: 'client_secret_post',
			},
			'test-server-1',
			oauthService,
			// No redirect handler
		);

		// Test pending auth URL storage
		const authUrl = new URL('https://example.com/authorize?client_id=test&state=abc123');
		clientProvider.redirectToAuthorization(authUrl);

		// Verify pending auth URL was stored in server info
		const updatedServerInfo = servers.get('test-server-1')!;
		assertEquals(updatedServerInfo.pendingAuthUrl, authUrl.toString());
	},
});
