/**
 * Interface definitions for Authentication in data sources.
 * Authentication is a cross-cutting concern that affects multiple components in the data source system.
 */

/**
 * Supported authentication methods for data sources
 */
export type AuthMethod =
	| 'none' // No authentication required
	| 'apiKey' // Simple API key
	| 'oauth2' // OAuth 2.0
	| 'basic' // Basic auth (username/password)
	| 'bearer' // Bearer token
	| 'custom'; // Custom authentication mechanism

/**
 * Authentication configuration for data sources
 */
export interface AuthConfig {
	/**
	 * The authentication method to use
	 */
	method: AuthMethod;

	/**
	 * API key for 'apiKey' method
	 */
	apiKey?: string;

	/**
	 * Credentials for various auth methods
	 * Stored as key-value pairs appropriate to the method
	 */
	credentials?: Record<string, unknown>;

	/**
	 * OAuth token data when using 'oauth2' method
	 */
	tokenData?: {
		/**
		 * Timestamp when the token expires (in milliseconds since epoch)
		 */
		expiresAt: number;

		/**
		 * Refresh token for obtaining a new access token
		 */
		refreshToken?: string;

		/**
		 * Scope of access granted by the token
		 */
		scope?: string;
	};
}

/**
 * OAuth-specific configuration
 */
export interface OAuth2Config {
	/**
	 * Client ID for the OAuth application
	 */
	clientId: string;

	/**
	 * Client secret for the OAuth application
	 */
	clientSecret?: string;

	/**
	 * Authorization endpoint URL
	 */
	authUrl: string;

	/**
	 * Token endpoint URL
	 */
	tokenUrl: string;

	/**
	 * Redirect URL for OAuth flow
	 */
	redirectUrl: string;

	/**
	 * Scopes to request
	 */
	scopes: string[];
}
