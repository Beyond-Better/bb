import type { Session, User } from '@supabase/supabase-js';
export type { Session, User } from '@supabase/supabase-js';

/**
 * Core authentication types for the BUI
 */

// export interface User {
// 	id: string;
// 	email: string;
// 	created_at: string;
// 	last_sign_in_at?: string;
// }

// export interface Session {
// 	access_token: string;
// 	refresh_token?: string;
// 	expires_at?: number;
// 	user: User;
// }

export interface AuthState {
	session: Session | null;
	user: User | null;
	isLoading: boolean;
	isLocalMode: boolean;
	error: string | null;
	// Supabase configuration
	//supabaseUrl?: string;
	//supabaseAnonKey?: string;
}

// Dummy session for local mode
export const DUMMY_USER: User = {
	id: 'local-user', // 'dummy_user',
	email: 'local@beyondbetter.dev',
	created_at: new Date().toISOString(),
	last_sign_in_at: new Date().toISOString(),
	app_metadata: {},
	user_metadata: {},
	aud: '',
};

// Default expiration time (24 hours from now in seconds)
const DEFAULT_EXPIRATION = () => Math.floor(Date.now() / 1000) + 24 * 60 * 60;
const DEFAULT_EXPIRES_IN = 24 * 60 * 60;

// For local development mode
export const DUMMY_SESSION: Session = {
	access_token: 'dummy_token',
	expires_at: DEFAULT_EXPIRATION(),
	refresh_token: '',
	expires_in: DEFAULT_EXPIRES_IN,
	token_type: '',
	user: DUMMY_USER,
};

export class AuthError extends Error {
	constructor(
		message: string,
		public readonly type: 'config_missing' | 'auth_failed' | 'server_error' = 'server_error',
	) {
		super(message);
		this.name = 'AuthError';
	}
}
