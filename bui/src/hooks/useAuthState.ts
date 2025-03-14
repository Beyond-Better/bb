import { signal } from '@preact/signals';
//import type { Signal } from "@preact/signals";
import type { Session, User } from '@supabase/supabase-js';
import type { BuiConfig } from 'shared/config/v2/types.ts';
import { AuthError, type AuthState, DUMMY_SESSION, DUMMY_USER } from '../types/auth.ts';
import { getApiHostname, getApiPort, getApiUrl, getApiUseTls } from '../utils/url.utils.ts';
import { type ApiClient, createApiClientManager } from '../utils/apiClient.utils.ts';
import { useAppState } from '../hooks/useAppState.ts';

// Initialize auth state with loading true
const authState = signal<AuthState>({
	session: null,
	user: null,
	isLoading: true,
	isLocalMode: false,
	error: null,
});

// Initialize auth state
export function initializeAuthState(buiConfig: BuiConfig): void {
	console.log('useAuthState: Initializing');

	// Reset loading state
	authState.value = {
		...authState.value,
		isLoading: true,
		error: null,
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
	} catch (error) {
		console.error('Failed to initialize auth:', error);
		authState.value = {
			...authState.value,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Failed to initialize auth',
		};
	}
}

function getApiClient(req: Request | null): ApiClient | null {
	const appState = useAppState();
	if (appState && appState.value.apiClient) {
		return appState.value.apiClient;
	}
	if (!req) {
		console.log('useAuthState: getApiClient - Need a request to load API Client');
		return null;
	}
	const apiHostname = getApiHostname(req);
	const apiPort = getApiPort(req);
	const apiUseTls = getApiUseTls(req);
	const apiUrl = getApiUrl(apiHostname, apiPort, apiUseTls);
	const apiClient: ApiClient = createApiClientManager(apiUrl);
	return apiClient;
}

// Hook for components to access auth state and operations
export function useAuthState() {
	return {
		authState,

		getSessionUser: async (
			req: Request | null,
			_resp: Response | null,
		): Promise<{ user?: User; error?: string }> => {
			console.log('useAuthState: Attempting to get session...');

			// If in local mode, use dummy session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Using local mode dummy session');
				return { user: DUMMY_USER };
			}

			try {
				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: Could not load API Client');
					return { error: 'Could not load API Client' };
				}
				const { session, error } = await apiClient.getSession();
				//console.log('useAuthState: Returning session', session);
				const user = session?.user;

				if (error) {
					throw new AuthError(error, 'auth_failed');
				}

				if (!user) {
					throw new AuthError('No user returned', 'auth_failed');
				}

				//console.log('useAuthState: Returning session user', user);
				return { user };
			} catch (error) {
				console.error('Get session failed:', (error as Error).message);
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
			_resp: Response | null,
			tokenHash: string,
			type: string,
		): Promise<{ user?: User; session?: Session; error?: string }> => {
			console.log('useAuthState: Attempting to verify OTP...');

			// If in local mode, use dummy session
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Using local mode dummy session');
				return { user: DUMMY_USER };
			}

			try {
				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: Could not load API Client');
					return { error: 'Could not load API Client' };
				}
				const { user, session, error } = await apiClient.verifyOtp(tokenHash, type);

				if (error) {
					throw new AuthError(error, 'auth_failed');
				}

				if (!session) {
					throw new AuthError('No session returned after verification', 'auth_failed');
				}

				if (!user) {
					throw new AuthError('No user returned after verification', 'auth_failed');
				}

				authState.value = {
					...authState.value,
					session,
					user,
					isLoading: false,
					error: null,
				};

				return { user, session };
			} catch (error) {
				console.error('useAuthState: Verify OTP failed:', (error as Error).message);
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
			_resp: Response | null,
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

				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: Could not load API Client');
					return { error: 'Could not load API Client' };
				}
				const { user, session, error } = await apiClient.signIn(email, password);
				console.log('useAuthState: Sign in user', user);

				if (error) {
					throw new AuthError(error, 'auth_failed');
				}

				if (!session) {
					throw new AuthError('No session returned after sign in', 'auth_failed');
				}

				if (!user) {
					throw new AuthError('No user returned after sign in', 'auth_failed');
				}

				authState.value = {
					...authState.value,
					session,
					user,
					isLoading: false,
					error: null,
				};

				return { user, session };
			} catch (error) {
				console.error('useAuthState: Sign in failed:', (error as Error).message);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign in failed',
				};
				return { error: error instanceof Error ? error.message : 'Sign in failed' };
			}
		},

		signUp: async (
			req: Request | null,
			_resp: Response | null,
			email: string,
			password: string,
		): Promise<{ user?: User; session?: Session; error?: string }> => {
			console.log('useAuthState: Attempting sign up...');

			// If in local mode, don't allow signup
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Local mode does not support sign up');
				return { error: 'Sign up not supported in local mode' };
			}

			try {
				authState.value = {
					...authState.value,
					isLoading: true,
					error: null,
				};

				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: Could not load API Client');
					return { error: 'Could not load API Client' };
				}
				const { user, session, error } = await apiClient.signUp(email, password);

				if (error) {
					throw new AuthError(error, 'auth_failed');
				}

				if (!user) {
					throw new AuthError('No user returned after sign up', 'auth_failed');
				}

				authState.value = {
					...authState.value,
					isLoading: false,
					session: null, // signUp doesn't return a session ???
					user,
					error: null,
				};
				return { user, session };
			} catch (error) {
				console.error('useAuthState: Sign up failed:', (error as Error).message);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign up failed',
				};
				return { error: error instanceof Error ? error.message : 'Sign up failed' };
			}
		},

		signOut: async (
			req: Request | null,
			_resp: Response | null,
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

				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: Could not load API Client');
					return { error: 'Could not load API Client' };
				}
				const { error } = await apiClient.signOut();

				if (error) {
					throw new AuthError(error, 'auth_failed');
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
				console.error('useAuthState: Sign out failed:', (error as Error).message);
				authState.value = {
					...authState.value,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Sign out failed',
				};
				return { error: error instanceof Error ? error.message : 'Sign out failed' };
			}
		},
	};
}
