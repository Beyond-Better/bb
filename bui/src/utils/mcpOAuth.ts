export interface McpOAuthConfig {
	serverId: string;
	authorizationUrl: string;
}

export interface McpOAuthResult {
	success: boolean;
	serverId?: string;
	code?: string;
	state?: string;
	error?: string;
}

/**
 * Base MCP OAuth handler with common functionality
 * Similar to GoogleOAuth but adapted for MCP servers
 */
export class McpOAuth {
	protected serverId: string;
	protected apiClient: any;

	constructor(serverId: string, apiClient: any) {
		this.serverId = serverId;
		this.apiClient = apiClient;
	}

	// Abstract method to be implemented by subclasses
	// deno-lint-ignore require-await
	async authenticate(): Promise<McpOAuthResult> {
		return {
			success: false,
			error: 'Authentication method not implemented',
		};
	}

	/**
	 * Generate state parameter for CSRF protection (same format as Google OAuth)
	 */
	protected generateState(isDui: boolean = false): string {
		const stateData = {
			csrf: crypto.randomUUID(),
			origin: globalThis.location.origin,
			isDui,
		};
		return btoa(JSON.stringify(stateData));
	}

	/**
	 * Get authorization URL from API server
	 */
	protected async getAuthorizationUrl(state: string): Promise<string> {
		try {
			const response = await this.apiClient.mcpServerOAuthAuthorize(this.serverId, state);
			if (!response.authorizationUrl) {
				throw new Error('No authorization URL returned from server');
			}
			return response.authorizationUrl;
		} catch (error) {
			throw new Error(
				`Failed to get authorization URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	}

	/**
	 * Complete OAuth flow by exchanging code for tokens
	 */
	protected async exchangeCodeForTokens(code: string, state: string): Promise<void> {
		try {
			await this.apiClient.mcpServerOAuthCallback(this.serverId, code, state);
			console.log('MCP OAuth: Token exchange completed successfully');
		} catch (error) {
			throw new Error(`Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	}
}
