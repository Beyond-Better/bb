/**
 * Interface definitions for Authentication in data sources.
 * Authentication is a cross-cutting concern that affects multiple components in the data source system.
 */

import type { DataSourceAuth } from 'shared/types/dataSource.ts';

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
// Important - there is also DataSourceAuth type in shared/types/dataSource.ts - which is the canonical definition??
export type AuthConfig = DataSourceAuth;
// export interface AuthConfig {
// 	/**
// 	 * The authentication method to use
// 	 */
// 	method: AuthMethod;
// 
// 	/**
// 	 * API key for 'apiKey' method
// 	 */
// 	apiKey?: string;
// 
// 	/**
// 	 * Credentials for various auth methods
// 	 */
// 
// 	// References to future secure credential storage
// 	// These would be keys to look up in a secure storage mechanism
// 	credentialRefs?: string[];
// 
// 	basic?: DataSourceAuthBasic;
// 	bearer?: DataSourceAuthBearer;
// 
// 	/**
// 	 * OAuth token data when using 'oauth2' method
// 	 */
// 	oauth2?: {
// 		//clientId: string;
// 		//clientSecret: string;
// 		//tokenData?: {
// 			accessToken: string;
// 			/**
// 			 * Refresh token for obtaining a new access token
// 			 */
// 			refreshToken?: string;
// 			/**
// 			 * Timestamp when the token expires (in milliseconds since epoch)
// 			 */
// 			expiresAt: number;
// 			/**
// 			 * Scope of access granted by the token
// 			 */
// 			scopes?: string;
// 			tokenType?: string;
// 		//};
// 	};
// }

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
