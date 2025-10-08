import type { GlobalConfig, ProjectConfig } from 'shared/config/types.ts';

/**
 * Get the base URL for the BUI server
 * @param config Global or Project configuration
 * @returns Base URL for BUI server (e.g., "https://127.0.0.1:8080")
 */
export function getBuiBaseUrl(config: GlobalConfig | ProjectConfig): string {
	const buiConfig = config.bui || {};
	const hostname = buiConfig.hostname || 'localhost';
	const port = buiConfig.port || 8080;
	const useTls = buiConfig.tls?.useTls || false;

	const protocol = useTls ? 'https' : 'http';
	return `${protocol}://${hostname}:${port}`;
}

/**
 * Generate OAuth callback URL for MCP server authentication
 * @param config Global or Project configuration
 * @param serverId MCP server identifier
 * @returns Complete OAuth callback URL
 */
export function getBuiOAuthCallbackUrl(config: GlobalConfig | ProjectConfig, serverId: string): string {
	const baseUrl = getBuiBaseUrl(config);
	return `${baseUrl}/oauth/mcp/${serverId}/callback`;
}

/**
 * Generate multiple OAuth callback URLs for different environments
 * Useful for OAuth client registration that supports multiple redirect URIs
 * @param config Global or Project configuration
 * @param serverId MCP server identifier
 * @returns Array of callback URLs for different environments
 */
export function getBuiOAuthCallbackUrls(config: GlobalConfig | ProjectConfig, serverId: string): string[] {
	const primaryUrl = getBuiOAuthCallbackUrl(config, serverId);

	// Generate variants for common deployment scenarios
	const urls = [primaryUrl];

	// Add production URL if different from primary
	const productionUrl = `https://chat.beyondbetter.app/oauth/mcp/${serverId}/callback`;
	if (primaryUrl !== productionUrl) {
		urls.push(productionUrl);
	}

	// Add localhost variants if primary is 127.0.0.1 or vice versa
	const buiConfig = config.bui || {};
	const hostname = buiConfig.hostname || 'localhost';
	const port = buiConfig.port || 8080;
	const useTls = buiConfig.tls?.useTls || false;
	const protocol = useTls ? 'https' : 'http';

	if (hostname === '127.0.0.1') {
		urls.push(`${protocol}://localhost:${port}/oauth/mcp/${serverId}/callback`);
	} else if (hostname === 'localhost') {
		urls.push(`${protocol}://127.0.0.1:${port}/oauth/mcp/${serverId}/callback`);
	}

	// Remove duplicates and return
	return [...new Set(urls)];
}
