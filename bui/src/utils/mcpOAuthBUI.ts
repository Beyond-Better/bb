import { getOAuthWindowDimensions } from 'shared/environmentHelper.ts';
import { McpOAuth, type McpOAuthResult } from './mcpOAuth.ts';

/**
 * BUI MCP OAuth handler using popup windows
 * Similar to GoogleOAuthBUI but adapted for MCP servers
 */
export class McpOAuthBUI extends McpOAuth {
	constructor(serverId: string, apiClient: any) {
		super(serverId, apiClient);
	}

	override async authenticate(): Promise<McpOAuthResult> {
		try {
			// Generate state for CSRF protection
			const state = this.generateState(false); // BUI environment

			// Get authorization URL from API server, sending our state
			const authUrl = await this.getAuthorizationUrl(state);
			console.log('McpOAuthBUI: Got authorization URL for server:', this.serverId);

			// Open popup window
			const dimensions = getOAuthWindowDimensions();
			const popup = globalThis.open(
				authUrl,
				`mcp-oauth-${this.serverId}`,
				`width=${dimensions.width},height=${dimensions.height},scrollbars=yes,resizable=yes`,
			);

			if (!popup) {
				throw new Error('Popup blocked. Please allow popups for this site and try again.');
			}

			// Listen for the OAuth callback
			const authResult = await this.waitForOAuthCallback(popup, state);

			// Exchange authorization code for tokens
			await this.exchangeCodeForTokens(authResult.code, authResult.state);

			// Return success result
			return {
				success: true,
				serverId: this.serverId,
				code: authResult.code,
				state: authResult.state,
			};
		} catch (error) {
			console.error('McpOAuthBUI: Authentication failed:', error);
			return {
				success: false,
				serverId: this.serverId,
				error: error instanceof Error ? error.message : 'Authentication failed',
			};
		}
	}

	private waitForOAuthCallback(popup: Window, expectedState: string): Promise<{ code: string; state: string }> {
		return new Promise((resolve, reject) => {
			const checkClosed = setInterval(() => {
				if (popup.closed) {
					clearInterval(checkClosed);
					reject(new Error('Authentication cancelled by user'));
				}
			}, 1000);

			// Listen for message from popup
			const messageHandler = (event: MessageEvent) => {
				if (event.origin !== globalThis.location.origin) {
					return;
				}

				if (event.data.type === 'MCP_OAUTH_SUCCESS' && event.data.serverId === this.serverId) {
					clearInterval(checkClosed);
					globalThis.removeEventListener('message', messageHandler);
					popup.close();

					if (event.data.state !== expectedState) {
						reject(new Error('Invalid state parameter. Possible CSRF attack.'));
						return;
					}

					resolve({ code: event.data.code, state: event.data.state });
				} else if (event.data.type === 'MCP_OAUTH_ERROR' && event.data.serverId === this.serverId) {
					clearInterval(checkClosed);
					globalThis.removeEventListener('message', messageHandler);
					popup.close();
					reject(new Error(event.data.error || 'Authentication failed'));
				}
			};

			globalThis.addEventListener('message', messageHandler);
		});
	}
}
