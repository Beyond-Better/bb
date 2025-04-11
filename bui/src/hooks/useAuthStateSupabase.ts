import { signal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { createBrowserClient, createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { EmailOtpType, Session, SupabaseClient, User, VerifyTokenHashParams } from '@supabase/supabase-js';

import type { BuiConfig } from 'shared/config/types.ts';
import { AuthError, type AuthState, DUMMY_SESSION, DUMMY_USER } from '../types/auth.ts';

// Define our Supabase client type
export type SupabaseClientType = SupabaseClient<any, 'public', any>;

// Initialize auth state with loading true
const authState = signal<AuthState>({
	session: null,
	user: null,
	isLoading: true,
	isLocalMode: false,
	error: null,
	supabaseUrl: undefined,
	supabaseAnonKey: undefined,
});

// Initialize auth state
export async function initializeAuthState(buiConfig: BuiConfig): Promise<void> {
	//console.debug('useAuthState: Initializing', buiConfig);
	console.log('useAuthState: Initializing');

	// Reset loading state
	authState.value = {
		...authState.value,
		isLoading: true,
		error: null,
		supabaseUrl: buiConfig.supabaseUrl,
		supabaseAnonKey: buiConfig.supabaseAnonKey,
		isLocalMode: buiConfig.localMode ?? false,
	};

	try {
		const localMode = authState.value.isLocalMode;
		console.log('useAuthState: Local mode:', localMode);

		// If in local mode, we're done
		if (localMode) {
			console.log('useAuthState: Setting for localMode');
			authState.value = {
				...authState.value,
				session: DUMMY_SESSION,
				user: DUMMY_USER,
				isLoading: false,
			};
			return;
		}

		// Verify we have required config
		if (!authState.value.supabaseUrl || !authState.value.supabaseAnonKey) {
			console.log('useAuthState: Missing Supabase configuration', {
				url: authState.value.supabaseUrl,
				anonKey: authState.value.supabaseAnonKey,
			});
			throw new AuthError('Missing Supabase configuration', 'config_missing');
		}
	} catch (error) {
		console.error('Failed to initialize auth:', error);
		authState.value = {
			...authState.value,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Failed to initialize auth',
		};
	}
}

// Hook for components to access auth state and operations
export function useAuthState(): {
	authState: Signal<AuthState>;
	getServerClient: (req: Request, resp: Response) => SupabaseClientType | null;
	getBrowserClient: () => SupabaseClientType | null;
	getSessionUser: (req: Request | null, resp: Response | null) => Promise<{ user?: User; error?: string }>;
	verifyOtp: (
		req: Request | null,
		resp: Response | null,
		tokenHash: string,
		type: EmailOtpType,
	) => Promise<{ user?: User; session?: Session; error?: string }>;
	signIn: (
		req: Request | null,
		resp: Response | null,
		email: string,
		password: string,
	) => Promise<{ user?: User; session?: Session; error?: string }>;
	signUp: (
		req: Request | null,
		resp: Response | null,
		email: string,
		password: string,
	) => Promise<{ user?: User; session?: Session; error?: string }>;
	signOut: (req: Request | null, resp: Response | null) => Promise<{ user?: null; session?: null; error?: string }>;
} {
	const getServerClient = (req: Request, resp: Response): SupabaseClientType | null => {
		if (authState.value.isLocalMode) {
			return null;
		}
		if (!authState.value.supabaseUrl || !authState.value.supabaseAnonKey) {
			throw new AuthError('Missing Supabase configuration', 'config_missing');
		}
		const supabase = createServerClient(authState.value.supabaseUrl, authState.value.supabaseAnonKey, {
			cookies: {
				getAll() {
					return parseCookieHeader(req.headers.get('Cookie') || '');
				},

				setAll(cookiesToSet) {
					cookiesToSet.forEach(({ name, value, options }) => {
						const cookie = serializeCookieHeader(name, value, options);
						// If the cookie is updated, update the cookies for the response
						resp.headers.append('Set-Cookie', cookie);
					});
				},
			},
		});

		return supabase;
	};
	const getBrowserClient = (): SupabaseClientType | null => {
		if (authState.value.isLocalMode) {
			return null;
		}
		if (!authState.value.supabaseUrl || !authState.value.supabaseAnonKey) {
			throw new AuthError('Missing Supabase configuration', 'config_missing');
		}
		const supabase = createBrowserClient(authState.value.supabaseUrl, authState.value.supabaseAnonKey);

		return supabase;
	};

	return {
		authState,

		getServerClient: (req: Request, resp: Response): SupabaseClientType | null => {
			//console.log('useAuthState: Getting server client...');
			return getServerClient(req, resp);
		},

		getBrowserClient: (): SupabaseClientType | null => {
			//console.log('useAuthState: Getting browser client...');
			return getBrowserClient();
		},

		getSessionUser: async (
			req: Request | null,
			resp: Response | null,
		): Promise<{ user?: User; error?: string }> => {
			console.log('useAuthState: Attempting to get session...');

			// If in local mode, use dummy session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Using local mode dummy session');
				return { user: DUMMY_USER };
			}

			try {
				const supabase = (req && resp) ? getServerClient(req, resp) : getBrowserClient();
				if (!supabase) return { error: 'Could not create supabase client' };

				const { data, error } = await supabase.auth.getUser();

				if (error) {
					throw new AuthError(error.message, 'auth_failed');
				}

				if (!data.user) {
					throw new AuthError('No user returned after sign in', 'auth_failed');
				}

				console.log('useAuthState: Returning session user', data.user);
				return { user: data.user };
			} catch (error) {
				console.error('Sign in failed:', error);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Get session failed',
				};
				return { error: error instanceof Error ? error.message : 'Get session failed' };
			}
		},

		verifyOtp: async (
			req: Request | null,
			resp: Response | null,
			tokenHash: string,
			type: EmailOtpType,
		): Promise<{ user?: User; session?: Session; error?: string }> => {
			console.log('useAuthState: Attempting to verify OTP...');

			// If in local mode, use dummy session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Using local mode dummy session');
				return { user: DUMMY_USER };
			}

			try {
				const supabase = (req && resp) ? getServerClient(req, resp) : getBrowserClient();
				if (!supabase) return { error: 'Could not create supabase client' };

				//console.log('useAuthState: Verifying', { tokenHash, type });
				const verifyParams: VerifyTokenHashParams = { token_hash: tokenHash, type };
				const { data, error } = await supabase.auth.verifyOtp(verifyParams);
				//const { data, error } = await supabase.auth.verifyOtp({ email:'cng-1@cngarrison.com', token: tokenHash, type: 'email'})
				//console.log('useAuthState: Returning verifyOtp', { data, error });

				if (error) {
					throw new AuthError(error.message, 'auth_failed');
				}

				if (!data.session) {
					throw new AuthError('No session returned after verification', 'auth_failed');
				}

				if (!data.user) {
					throw new AuthError('No user returned after verification', 'auth_failed');
				}

				//console.log('useAuthState: Returning session user', data.user);
				authState.value = {
					...authState.value,
					session: data.session,
					user: data.user,
					isLoading: false,
					error: null,
				};

				return { user: data.user, session: data.session };
			} catch (error) {
				console.error('Sign in failed:', error);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Verify OTP failed',
				};
				return { error: error instanceof Error ? error.message : 'Verify OTP failed' };
			}
		},

		signIn: async (
			req: Request | null,
			resp: Response | null,
			email: string,
			password: string,
		): Promise<{ user?: User; session?: Session; error?: string }> => {
			console.log('useAuthState: Attempting sign in...');

			// If in local mode, use dummy session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Using local mode dummy session');
				authState.value = {
					...authState.value,
					session: DUMMY_SESSION,
					user: DUMMY_USER,
					error: null,
				};
				return { user: DUMMY_USER, session: DUMMY_SESSION };
			}

			try {
				authState.value = {
					...authState.value,
					isLoading: true,
					error: null,
				};

				const supabase = (req && resp) ? getServerClient(req, resp) : getBrowserClient();
				if (!supabase) return { error: 'Could not create supabase client' };

				console.log('useAuthState: Signing in with', { email, password });
				const { data, error } = await supabase.auth.signInWithPassword({
					email,
					password,
				});
				console.log('useAuthState: Signed in and got', { data, error });

				if (error) {
					throw new AuthError(error.message, 'auth_failed');
				}

				if (!data.session) {
					throw new AuthError('No session returned after sign in', 'auth_failed');
				}
				if (!data.user) {
					throw new AuthError('No user returned after sign in', 'auth_failed');
				}

				authState.value = {
					...authState.value,
					session: data.session,
					user: data.user,
					isLoading: false,
					error: null,
				};

				return { user: data.user, session: data.session };
			} catch (error) {
				console.error('Sign in failed:', error);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign in failed',
				};
				//throw error;
				return { error: error instanceof Error ? error.message : 'Sign in failed' };
			}
		},

		signUp: async (
			req: Request | null,
			resp: Response | null,
			email: string,
			password: string,
		): Promise<{ user?: User; session?: Session; error?: string }> => {
			console.log('useAuthState: Attempting sign up...');

			// If in local mode, don't allow signup
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Local mode does not support sign up');
				throw new AuthError('Sign up not supported in local mode', 'auth_failed');
				return { error: 'Sign up not supported in local mode' };
			}

			try {
				authState.value = {
					...authState.value,
					isLoading: true,
					error: null,
				};

				const supabase = (req && resp) ? getServerClient(req, resp) : getBrowserClient();
				if (!supabase) return { error: 'Could not create supabase client' };

				const verifyUrl = new URL('/auth/verify', req?.url || globalThis.location.href);
				//const appUrl = new URL('/app/home', req?.url || globalThis.location.href);
				console.log('useAuthState: Signing up with', { email, password, appUrl: verifyUrl.toString() });
				const { data, error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: verifyUrl.toString(),
					},
				});
				console.log('useAuthState: Signed up and got', { data, error });

				if (error) {
					throw new AuthError(error.message, 'auth_failed');
				}

				// if (!data.session) {
				// 	throw new AuthError('No session returned after sign in', 'auth_failed');
				// }
				if (!data.user) {
					throw new AuthError('No user returned after sign in', 'auth_failed');
				}

				authState.value = {
					...authState.value,
					isLoading: false,
					session: data.session,
					user: data.user,
					error: null,
				};
				return { user: data.user }; //session: data.session
			} catch (error) {
				console.error('Sign up failed:', error);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign up failed',
				};
				//throw error;
				return { error: error instanceof Error ? error.message : 'Sign in failed' };
			}
		},

		signOut: async (
			req: Request | null,
			resp: Response | null,
		): Promise<{ user?: null; session?: null; error?: string }> => {
			console.log('useAuthState: Attempting sign out...');

			// If in local mode, just clear the session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Clearing local mode session');
				authState.value = {
					...authState.value,
					session: null,
					error: null,
				};
				return { user: null, session: null };
			}

			try {
				authState.value = {
					...authState.value,
					isLoading: true,
					error: null,
				};

				const supabase = (req && resp) ? getServerClient(req, resp) : getBrowserClient();
				if (!supabase) return { error: 'Could not create supabase client' };

				const { error } = await supabase.auth.signOut();
				if (error) {
					throw new AuthError(error.message, 'auth_failed');
				}
				authState.value = {
					...authState.value,
					session: null,
					user: null,
					isLoading: false,
					error: null,
				};
				return { user: null, session: null };
			} catch (error) {
				console.error('Sign out failed:', error);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign out failed',
				};
				//throw error;
				return { error: error instanceof Error ? error.message : 'Sign in failed' };
			}
		},
	};
}
