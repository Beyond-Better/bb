import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { initializeAuthState, useAuthState } from '../hooks/useAuthState.ts';
import type { BuiConfig } from 'shared/config/v2/types.ts';
import { AuthError, authError } from './auth/AuthError.tsx';

interface AuthContextProps {
	children: ComponentChildren;
	buiConfig: BuiConfig;
}

const isAuthorized = signal(false);
const isLoading = signal(true);

export default function AuthContext({ children, buiConfig }: AuthContextProps) {
	const { authState, getSessionUser } = useAuthState();
	if (IS_BROWSER) console.log('AuthContext: authState', authState.value);

	let sessionCheckInterval: number;

	useEffect(() => {
		if (!IS_BROWSER) return;

		const checkSession = async () => {
			if (authState.value.isLocalMode) {
				isAuthorized.value = true;
				return;
			}

			try {
				const { user, error } = await getSessionUser(null, null);
				if (error) {
					console.error('Session check failed:', error);
					authError.value = new Error(error);
					isAuthorized.value = false;
					return;
				}

				if (!user) {
					console.error('Session check: No user returned');
					authError.value = new Error('Session invalid');
					isAuthorized.value = false;
					return;
				}

				// Update auth state with current user
				authState.value = {
					...authState.value,
					user,
				};
				isAuthorized.value = true;
			} catch (error) {
				console.error('Session check failed:', error);
				authError.value = error instanceof Error ? error : new Error('Session check failed');
				isAuthorized.value = false;
			}
		};

		// Initial auth check
		const initialCheck = async () => {
			initializeAuthState(buiConfig);
			await checkSession();
			isLoading.value = false;
		};

		initialCheck();

		// Set up periodic session check (every 5 minutes)
		sessionCheckInterval = setInterval(checkSession, 5 * 60 * 1000);

		return () => {
			if (sessionCheckInterval) clearInterval(sessionCheckInterval);
		};
	}, []);

	return (
		<>
			<AuthError />
			{isLoading.value
				? (
					<div class='flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900'>
						<div class='animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white' />
					</div>
				)
				: !isAuthorized.value && IS_BROWSER
				? (
					(() => {
						const currentUrl = globalThis.location.pathname + globalThis.location.search;
						const loginUrl = `/auth/login?redirect=${encodeURIComponent(currentUrl)}`;
						globalThis.location.href = loginUrl;
						return null;
					})()
				)
				: children}
		</>
	);
}
