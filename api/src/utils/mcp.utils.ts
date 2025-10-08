/**
 * MCP Utilities
 *
 * Shared utilities for MCP server configuration management.
 * These utilities are provider-agnostic and can be used across different MCP services.
 */

import { logger } from 'shared/logger.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import type { GlobalConfig, MCPServerConfig } from 'shared/config/types.ts';
import { //isError,
	errorMessage,
} from 'shared/error.ts';

/**
 * Save server configuration to persistent storage
 * Uses efficient partial update to avoid reloading entire global config
 *
 * This is a shared utility that can be used by any MCP service that needs
 * to persist server configuration changes.
 */
export async function saveServerConfig(config: MCPServerConfig): Promise<void> {
	try {
		const configManager = await getConfigManager();

		// Find the server index in the current global config
		const globalConfig = await configManager.getGlobalConfig();

		// Ensure api and mcpServers exist
		if (!globalConfig.api) {
			globalConfig.api = {} as GlobalConfig['api'];
		}
		if (!globalConfig.api.mcpServers) {
			globalConfig.api.mcpServers = [];
		}

		const mcpServers = globalConfig.api.mcpServers!; // Safe after initialization above
		const serverIndex = mcpServers.findIndex((s) => s.id === config.id);

		if (serverIndex >= 0) {
			// Update the specific server config using partial update
			const serverConfigKey = `api.mcpServers.${serverIndex}`;
			await configManager.setGlobalConfigValue(serverConfigKey, JSON.stringify(config));
			logger.debug(`MCP Utils: Saved updated config for server ${config.id} at index ${serverIndex}`);
		} else {
			// Server not found, add it
			logger.warn(`MCP Utils: Server ${config.id} not found in global config, adding new server`);
			mcpServers.push(config);
			await configManager.updateGlobalConfig(globalConfig);
		}
	} catch (error) {
		logger.warn(`MCP Utils: Failed to save server config for ${config.id}:`, error);
		throw new Error(`Failed to save server config for ${config.id}: ${errorMessage(error)}`);
		// CNG - why not throw??
		// Don't throw - this is not critical for connection
	}
}

/**
 * Validate MCP server configuration
 * Ensures required fields are present and valid
 */
export function validateServerConfig(config: MCPServerConfig): { isValid: boolean; errors: string[] } {
	const errors: string[] = [];

	if (!config.id || typeof config.id !== 'string' || config.id.trim() === '') {
		errors.push('Server ID is required and must be a non-empty string');
	}

	if (!config.transport || !['stdio', 'http'].includes(config.transport)) {
		errors.push('Transport must be either "stdio" or "http"');
	}

	if (config.transport === 'stdio') {
		if (!config.command || typeof config.command !== 'string' || config.command.trim() === '') {
			errors.push('Command is required for stdio transport');
		}
	}

	if (config.transport === 'http') {
		if (!config.url || typeof config.url !== 'string' || config.url.trim() === '') {
			errors.push('URL is required for http transport');
		} else {
			try {
				new URL(config.url);
			} catch {
				errors.push('URL must be a valid URL for http transport');
			}
		}
	}

	// Validate OAuth config if present
	if (config.oauth) {
		if (!config.oauth.grantType || !['authorization_code', 'client_credentials'].includes(config.oauth.grantType)) {
			errors.push('OAuth grant type must be either "authorization_code" or "client_credentials"');
		}

		// Validate scopes if present
		if (config.oauth.scopes && !Array.isArray(config.oauth.scopes)) {
			errors.push('OAuth scopes must be an array of strings');
		}

		// Validate additional params if present
		if (config.oauth.additionalParams && typeof config.oauth.additionalParams !== 'object') {
			errors.push('OAuth additional parameters must be an object');
		}
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
}

/**
 * Create a default MCP server configuration
 * Provides sensible defaults for new server configurations
 */
export function createDefaultServerConfig(id: string, transport: 'stdio' | 'http'): MCPServerConfig {
	const baseConfig: MCPServerConfig = {
		id,
		name: id, // Default name to ID, can be overridden
		transport,
	};

	if (transport === 'stdio') {
		// STDIO transport defaults
		baseConfig.command = '';
		baseConfig.args = [];
		baseConfig.env = {};
	} else {
		// HTTP transport defaults
		baseConfig.url = '';
	}

	return baseConfig;
}

/**
 * Check if a server configuration has OAuth enabled
 */
export function hasOAuthEnabled(config: MCPServerConfig): boolean {
	return !!(config.oauth && config.oauth.grantType);
}

/**
 * Check if OAuth configuration is complete enough for connection attempts
 * Returns true if basic OAuth setup is present (endpoints can be discovered)
 */
export function isOAuthConfigurationSufficient(config: MCPServerConfig): boolean {
	if (!hasOAuthEnabled(config)) {
		return false;
	}

	// At minimum, we need a grant type and either:
	// 1. Client credentials (for client_credentials flow)
	// 2. Just the grant type (for discovery and dynamic registration)
	if (config.oauth!.grantType === 'client_credentials') {
		// Client credentials flow requires both client ID and secret
		return !!(config.oauth!.clientId && config.oauth!.clientSecret);
	} else if (config.oauth!.grantType === 'authorization_code') {
		// Authorization code flow can work with just grant type (discovery + dynamic registration)
		return true;
	}

	return false;
}
