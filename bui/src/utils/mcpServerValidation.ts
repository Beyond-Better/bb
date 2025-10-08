import { MCPServerConfig } from 'shared/config/types.ts';

/**
 * Validation function for MCP server configurations
 * @param server - The server configuration to validate
 * @param existingServerIds - Array of existing server IDs to check for duplicates
 * @returns Object with validation errors keyed by field name
 */
export function validateMCPServer(
	server: MCPServerConfig,
	existingServerIds: string[] = [],
): Record<string, string> {
	const errors: Record<string, string> = {};

	// Server ID validation
	if (!server.id?.trim()) {
		errors.id = 'Server ID is required';
	} else if (existingServerIds.includes(server.id)) {
		errors.id = `Server ID '${server.id}' already exists`;
	}

	// Transport type validation
	if (!server.transport) {
		errors.transport = 'Transport type is required';
	}

	// Transport-specific validation
	if (server.transport === 'stdio' || !server.transport) {
		// STDIO transport validation
		if (!server.command?.trim()) {
			errors.command = 'Command is required for STDIO transport';
		}
	} else if (server.transport === 'http') {
		// HTTP transport validation
		if (!server.url?.trim()) {
			errors.url = 'URL is required for HTTP transport';
		} else {
			// URL format validation
			try {
				const url = new URL(server.url);
				// Enforce HTTPS for remote servers (except localhost)
				if (url.protocol !== 'https:' && !url.hostname.includes('localhost') && url.hostname !== '127.0.0.1') {
					errors.url = 'HTTPS is required for remote servers. Localhost is allowed over HTTP.';
				}
			} catch {
				errors.url = 'Invalid URL format';
			}
		}

		// OAuth validation for HTTP transport
		// NOTE: Most OAuth fields are now auto-discovered/registered, so we only validate user-provided fields
		if (server.oauth) {
			// Grant type is required (user must choose)
			if (!server.oauth.grantType) {
				errors.grantType = 'Grant type is required when OAuth is enabled';
			}

			// Client credentials and endpoints are optional now:
			// - Will be auto-discovered via /.well-known/oauth-authorization-server
			// - Client ID/secret will be auto-registered via Dynamic Registration (RFC7591)
			// - If auto-registration fails, user will be prompted to configure manually

			// Only validate redirect URI for authorization code flow if manually provided
			// (System provides defaults, but user can override)
			if (
				server.oauth.grantType === 'authorization_code' &&
				server.oauth.redirectUri &&
				!server.oauth.redirectUri.trim()
			) {
				errors.redirectUri = 'Redirect URI cannot be empty if provided';
			}
		}
	}

	return errors;
}

/**
 * Check if the server configuration has validation errors
 * @param errors - Validation errors object from validateMCPServer
 * @returns true if there are validation errors, false otherwise
 */
export function hasValidationErrors(errors: Record<string, string>): boolean {
	return Object.keys(errors).length > 0;
}

/**
 * Get a user-friendly error message for the first validation error
 * @param errors - Validation errors object from validateMCPServer
 * @returns First error message or empty string if no errors
 */
export function getFirstErrorMessage(errors: Record<string, string>): string {
	const errorKeys = Object.keys(errors);
	return errorKeys.length > 0 ? errors[errorKeys[0]] : '';
}
