/**
 * Shared authentication types used by both API and clients
 */

/**
 * Basic user information needed by clients
 */
export interface AuthUser {
	id: string;
	email?: string;
}

export interface AuthSession {
	user: AuthUser;
	access_token: string;
	refresh_token: string;
	expires_at?: number;
}

/**
 * Standardized error format for auth-related errors
 */
export interface AuthError {
	code: string;
	message: string;
}
