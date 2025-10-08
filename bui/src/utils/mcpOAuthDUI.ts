import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { McpOAuth, type McpOAuthResult } from './mcpOAuth.ts';

// Types matching the Rust OAuth structures
interface OAuthResult {
	success: boolean;
	provider: string;
	serverId: string;
	code: string;
	state: string;
	error?: string;
}

interface OAuthFlowParams {
	provider: string;
	oauth_url: string;
	window_title?: string;
	window_width?: number;
	window_height?: number;
}

/**
 * Tauri-specific MCP OAuth handler for DUI
 * Similar to GoogleOAuthDUI but adapted for MCP servers
 */
export class McpOAuthDUI extends McpOAuth {
	private authPromise: Promise<McpOAuthResult> | null = null;
	private authResolver: ((value: McpOAuthResult) => void) | null = null;
	private authRejecter: ((error: Error) => void) | null = null;
	private eventUnlisten: UnlistenFn | null = null;
	private oauthWindowLabel: string | null = null;

	constructor(serverId: string, apiClient: any) {
		super(serverId, apiClient);
	}

	/**
	 * Start OAuth authentication flow
	 */
	override authenticate(): Promise<McpOAuthResult> {
		// Prevent multiple concurrent auth flows
		if (this.authPromise) {
			return this.authPromise;
		}

		this.authPromise = new Promise((resolve, reject) => {
			this.authResolver = resolve;
			this.authRejecter = reject;
			this.startOAuthFlow();
		});

		return this.authPromise;
	}

	/**
	 * Internal method to start the OAuth flow
	 */
	private async startOAuthFlow(): Promise<void> {
		try {
			console.log('McpOAuthDUI: Starting OAuth flow for server:', this.serverId);

			// Generate state for CSRF protection
			const state = this.generateState(true); // DUI environment

			// Get authorization URL from API server, sending our state
			const authUrl = await this.getAuthorizationUrl(state);
			console.log('McpOAuthDUI: Got authorization URL for server:', this.serverId);

			// Set up event listener for OAuth result
			await this.setupOAuthListener();

			// Create OAuth window via Tauri command
			const windowLabel = await invoke<string>('start_oauth_flow', {
				params: {
					provider: 'mcp',
					oauth_url: authUrl,
					window_title: `Sign in to MCP Server: ${this.serverId}`,
					window_width: 500,
					window_height: 650,
				} as OAuthFlowParams,
			});

			this.oauthWindowLabel = windowLabel;
			console.log('McpOAuthDUI: OAuth window created:', windowLabel);
		} catch (error) {
			console.error('McpOAuthDUI: OAuth flow error:', error);
			this.handleOAuthError(error instanceof Error ? error : new Error(String(error)));
		}
	}

	/**
	 * Set up event listener for OAuth results
	 */
	private async setupOAuthListener(): Promise<void> {
		console.log('McpOAuthDUI: Setting up OAuth event listener');

		this.eventUnlisten = await listen<OAuthResult>('oauth-result', (event) => {
			if (event.payload.success && event.payload.serverId === this.serverId) {
				console.log('McpOAuthDUI: Processing successful OAuth result for server:', this.serverId);
				this.exchangeCodeForTokens(event.payload.code, event.payload.state)
					.then(() => {
						this.handleOAuthSuccess({
							success: true,
							serverId: event.payload.serverId,
							code: event.payload.code,
							state: event.payload.state,
						});
					})
					.catch((error) => {
						console.error('McpOAuthDUI: Error processing OAuth result:', error);
						this.handleOAuthError(error instanceof Error ? error : new Error(String(error)));
					})
					.finally(() => {
						this.cleanup();
					});
			} else if (event.payload.serverId === this.serverId) {
				this.handleOAuthError(new Error(event.payload.error || 'Authentication failed'));
				this.cleanup();
			}
		});
	}

	/**
	 * Handle successful OAuth result
	 */
	private handleOAuthSuccess(result: McpOAuthResult): void {
		console.log('McpOAuthDUI: Handling OAuth success for server:', this.serverId);
		this.authResolver?.(result);
	}

	/**
	 * Handle OAuth error
	 */
	private handleOAuthError(error: Error): void {
		console.error('McpOAuthDUI: OAuth error for server:', this.serverId, error);
		this.authRejecter?.(error);
		this.cleanup();
	}

	/**
	 * Clean up OAuth flow resources
	 */
	private cleanup(): void {
		console.log('McpOAuthDUI: Cleaning up OAuth flow for server:', this.serverId);

		// Clean up event listener
		if (this.eventUnlisten) {
			this.eventUnlisten();
			this.eventUnlisten = null;
		}

		// Clear stored data
		this.authPromise = null;
		this.authResolver = null;
		this.authRejecter = null;

		// Close OAuth window if still open
		if (this.oauthWindowLabel) {
			invoke('close_oauth_window', {
				windowLabel: this.oauthWindowLabel,
			}).catch((err) => {
				console.warn('McpOAuthDUI: Failed to close OAuth window:', err);
			});
			this.oauthWindowLabel = null;
		}
	}
}
