import type { AuthSession, AuthUser } from '../../../src/shared/types/auth.ts';

/**
 * Complete session information stored by the API
 */
export type User = AuthUser;
export type Session = AuthSession;

/**
 * Session data as stored in KV storage, including metadata
 */
export interface StoredSession extends Session {
	created_at: number;
	last_accessed: number;
}

/**
 * Supabase configuration required for authentication
 */
export interface SupabaseConfig {
	url: string;
	anonKey: string;
	verifyUrl: string;
}

/**
 * Error response format for auth-related errors
 */
export interface AuthErrorResponse {
	error: {
		code: string;
		message: string;
	};
}

/**
 * Error thrown when config fetching fails
 */
export class ConfigFetchError extends Error {
	constructor(message: string, public readonly attempt: number) {
		super(`Failed to fetch Supabase config (attempt ${attempt}): ${message}`);
		this.name = 'ConfigFetchError';
	}
}

/**
 * Error thrown for session-related failures
 */
export class SessionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SessionError';
	}
}
