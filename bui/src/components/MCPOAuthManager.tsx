import type { MCPServerConfig } from 'shared/config/types.ts';
import { useState } from 'preact/hooks';
import { useAppState } from '../hooks/useAppState.ts';
import { McpOAuthBUI } from '../utils/mcpOAuthBUI.ts';
import { McpOAuthDUI } from '../utils/mcpOAuthDUI.ts';
import { isDuiEnvironment } from 'shared/environmentHelper.ts';

interface MCPOAuthManagerProps {
	server: MCPServerConfig;
	onSuccess: (updatedServer: MCPServerConfig) => void;
	onError: (error: string) => void;
}

export default function MCPOAuthManager({ server, onSuccess, onError }: MCPOAuthManagerProps) {
	const appState = useAppState();
	const [isAuthorizing, setIsAuthorizing] = useState(false);
	const isDui = isDuiEnvironment();

	/**
	 * Initiate OAuth authorization flow
	 * Always saves server config first to ensure OAuth has access to current settings
	 */
	const handleAuthorize = async () => {
		if (!appState.value.apiClient) {
			onError('API client not available');
			return;
		}

		// Validation: Only allow OAuth for HTTP transport with OAuth config
		if (server.transport !== 'http' || !server.oauth) {
			onError('OAuth is only available for HTTP transport servers with OAuth configuration');
			return;
		}

		setIsAuthorizing(true);

		try {
			// CRITICAL: Save server configuration first
			// This ensures the OAuth flow has access to the latest server config
			console.log('MCPOAuthManager: Saving server config before OAuth flow:', server.id);

			// Extract id from server config since updateMCPServer expects Omit<MCPServerConfig, 'id'>
			const { id, ...serverConfigWithoutId } = server;
			const saveResult = await appState.value.apiClient.updateMCPServer(server.id, serverConfigWithoutId);
			if (!saveResult?.success) {
				throw new Error(saveResult?.message || 'Failed to save server configuration');
			}

			console.log('MCPOAuthManager: Server config saved successfully, starting OAuth flow');

			// Start OAuth flow based on grant type
			if (server.oauth.grantType === 'authorization_code') {
				// Use appropriate OAuth handler based on environment
				let result;
				if (isDui) {
					const mcpOAuth = new McpOAuthDUI(server.id, appState.value.apiClient);
					result = await mcpOAuth.authenticate();
				} else {
					const mcpOAuth = new McpOAuthBUI(server.id, appState.value.apiClient);
					result = await mcpOAuth.authenticate();
				}

				if (result.success) {
					// Get updated server config with tokens
					const updatedServer = await fetchUpdatedServerConfig();
					if (updatedServer) {
						onSuccess(updatedServer);
					} else {
						onError('OAuth succeeded but failed to retrieve updated server configuration');
					}
				} else {
					onError(result.error || 'Authorization code flow failed');
				}
			} else if (server.oauth.grantType === 'client_credentials') {
				// Client credentials flow
				const response = await appState.value.apiClient.mcpServerOAuthClientCredentials(server.id);
				if (response?.accessToken) {
					// Create updated server config with new tokens
					const updatedServer = {
						...server,
						oauth: {
							...server.oauth,
							accessToken: response.accessToken,
							refreshToken: response.refreshToken,
							expiresAt: response.expiresAt,
						},
					};
					onSuccess(updatedServer);
				} else {
					onError('Client credentials flow failed - no access token received');
				}
			}
		} catch (error) {
			console.error('MCPOAuthManager: OAuth flow failed:', error);
			onError(error instanceof Error ? error.message : 'OAuth authorization failed');
		} finally {
			setIsAuthorizing(false);
		}
	};

	/**
	 * Fetch updated server configuration after OAuth completion
	 */
	const fetchUpdatedServerConfig = async (): Promise<MCPServerConfig | null> => {
		try {
			if (!appState.value.apiClient) return null;

			// Get updated global config which contains the server with new OAuth tokens
			const globalConfig = await appState.value.apiClient.getGlobalConfig();
			const updatedServer = globalConfig?.api?.mcpServers?.find((s) => s.id === server.id);

			if (updatedServer) {
				console.log('MCPOAuthManager: Found updated server config with tokens:', {
					serverId: updatedServer.id,
					hasAccessToken: !!updatedServer.oauth?.accessToken,
					hasRefreshToken: !!updatedServer.oauth?.refreshToken,
				});
				return updatedServer;
			}

			console.warn('MCPOAuthManager: Updated server config not found in global config');
			return null;
		} catch (error) {
			console.error('MCPOAuthManager: Failed to fetch updated server config:', error);
			return null;
		}
	};

	// This component doesn't render anything - it's a pure logic component
	// The actual authorize button is rendered in MCPServerListItem
	return null;
}

// Export the hook-style function for easier use
export function useMCPOAuthManager() {
	return {
		authorizeServer: async (
			server: MCPServerConfig,
			onSuccess: (updatedServer: MCPServerConfig) => void,
			onError: (error: string) => void,
		) => {
			const manager = { handleAuthorize: () => {} };
			// Create a temporary manager instance
			const tempManager = new (class {
				private appState = useAppState();
				private isDui = isDuiEnvironment();

				async authorize() {
					if (!this.appState.value.apiClient) {
						onError('API client not available');
						return;
					}

					if (server.transport !== 'http' || !server.oauth) {
						onError('OAuth is only available for HTTP transport servers with OAuth configuration');
						return;
					}

					try {
						// Save server configuration first
						const { id, ...serverConfigWithoutId } = server;
						const saveResult = await this.appState.value.apiClient.updateMCPServer(
							server.id,
							serverConfigWithoutId,
						);
						if (!saveResult?.success) {
							throw new Error(saveResult?.message || 'Failed to save server configuration');
						}

						// Start OAuth flow
						if (server.oauth.grantType === 'authorization_code') {
							let result;
							if (this.isDui) {
								const mcpOAuth = new McpOAuthDUI(server.id, this.appState.value.apiClient);
								result = await mcpOAuth.authenticate();
							} else {
								const mcpOAuth = new McpOAuthBUI(server.id, this.appState.value.apiClient);
								result = await mcpOAuth.authenticate();
							}

							if (result.success) {
								// Fetch updated server config with new OAuth tokens
								try {
									const globalConfig = await this.appState.value.apiClient.getGlobalConfig();
									const updatedServer = globalConfig?.api?.mcpServers?.find((s) =>
										s.id === server.id
									);

									if (updatedServer) {
										console.log('MCPOAuthManager: Found updated server config with tokens:', {
											serverId: updatedServer.id,
											hasAccessToken: !!updatedServer.oauth?.accessToken,
											hasRefreshToken: !!updatedServer.oauth?.refreshToken,
										});
										onSuccess(updatedServer);
									} else {
										console.warn(
											'MCPOAuthManager: Updated server config not found in global config',
										);
										onError('OAuth succeeded but failed to retrieve updated server configuration');
									}
								} catch (fetchError) {
									console.error(
										'MCPOAuthManager: Failed to fetch updated server config:',
										fetchError,
									);
									onError('OAuth succeeded but failed to retrieve updated server configuration');
								}
							} else {
								onError(result.error || 'Authorization failed');
							}
						} else if (server.oauth.grantType === 'client_credentials') {
							const response = await this.appState.value.apiClient.mcpServerOAuthClientCredentials(
								server.id,
							);
							if (response?.accessToken) {
								const updatedServer = {
									...server,
									oauth: {
										...server.oauth,
										accessToken: response.accessToken,
										refreshToken: response.refreshToken,
										expiresAt: response.expiresAt,
									},
								};
								onSuccess(updatedServer);
							} else {
								onError('Client credentials flow failed');
							}
						}
					} catch (error) {
						onError(error instanceof Error ? error.message : 'OAuth authorization failed');
					}
				}
			})();

			await tempManager.authorize();
		},
	};
}
