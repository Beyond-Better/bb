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
	//if (!req) {
	//	console.log('useAuthState: getApiClient - Need a request to load API Client');
	//	return null;
	//}
	const apiHostname = getApiHostname(req || undefined);
	const apiPort = getApiPort(req || undefined);
	const apiUseTls = getApiUseTls(req || undefined);
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
					console.log('useAuthState: [getSessionUser] Could not load API Client');
					return { error: 'Could not load API Client [getSessionUser]' };
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
					console.log('useAuthState: [verifyOtp] Could not load API Client');
					return { error: 'Could not load API Client [verifyOtp]' };
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

		checkEmailVerification: async (
			req: Request | null,
			_resp: Response | null,
			email: string,
		): Promise<{ verified?: boolean; exists?: boolean; error?: string }> => {
			console.log('useAuthState: Checking email verification for:', email);

			// If in local mode, pretend verification is successful
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Local mode - bypassing email verification check');
				return { verified: true, exists: true };
			}

			try {
				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: [checkEmailVerification] Could not load API Client');
					return { error: 'Could not load API Client [checkEmailVerification]' };
				}

				// Call the API endpoint to check email verification status
				const result = await apiClient.post<{ verified?: boolean; exists?: boolean; error?: string }>(
					'/api/v1/auth/check-email-verification',
					{
						email,
					},
				);

				if (!result) {
					throw new Error('Failed to check email verification status');
				}

				if (result.error) {
					throw new Error(result.error);
				}

				return result;
			} catch (error) {
				console.error('useAuthState: Email verification check failed:', (error as Error).message);
				return { error: error instanceof Error ? error.message : 'Email verification check failed' };
			}
		},

		resendVerificationEmail: async (
			req: Request | null,
			_resp: Response | null,
			email: string,
		): Promise<{ error?: string }> => {
			console.log('useAuthState: Resending verification email for:', email);

			// If in local mode, pretend the operation is successful
			if (authState.value.isLocalMode) {
				console.log('useAuthState: Local mode - bypassing resend verification');
				return {};
			}

			try {
				const apiClient = getApiClient(req);
				if (!apiClient) {
					console.log('useAuthState: [resendVerificationEmail] Could not load API Client');
					return { error: 'Could not load API Client [resendVerificationEmail]' };
				}

				// Prepare the redirect URL
				const redirectUrl = `${globalThis.location.origin}/auth/verify`;

				// Call the API endpoint to resend verification email
				const result = await apiClient.post<{ success?: boolean; error?: string }>(
					'/api/v1/auth/resend-verification',
					{
						email,
						type: 'signup',
						options: {
							emailRedirectTo: redirectUrl,
						},
					},
				);

				if (!result) {
					throw new Error('Failed to resend verification email');
				}

				if (result.error) {
					throw new Error(result.error);
				}

				return {};
			} catch (error) {
				console.error('useAuthState: Resend verification failed:', (error as Error).message);
				return { error: error instanceof Error ? error.message : 'Failed to resend verification email' };
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
					console.log('useAuthState: [signIn] Could not load API Client');
					return { error: 'Could not load API Client [signIn]' };
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
			firstName?: string,
			lastName?: string,
			marketingConsent?: boolean,
			acceptedTerms?: boolean,
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
					console.log('useAuthState: [signUp] Could not load API Client');
					return { error: 'Could not load API Client [signUp]' };
				}
				const { user, session, error } = await apiClient.signUp(
					email,
					password,
					{
						first_name: firstName || null,
						last_name: lastName || null,
						marketing_consent: marketingConsent || false,
						accepted_terms: acceptedTerms || true,
					},
				);

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
					console.log('useAuthState: [signOut] Could not load API Client');
					return { error: 'Could not load API Client [signOut]' };
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
