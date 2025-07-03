import { IS_BROWSER } from '$fresh/runtime.ts';
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

import { useAuthState } from '../hooks/useAuthState.ts';
import { initializeAppState, useAppState } from '../hooks/useAppState.ts';
import { BBAppDownload } from '../components/Connection/BBAppDownload.tsx';
import { getApiHostname, getApiPort, getApiUrl, getApiUseTls, getWsUrl } from '../utils/url.utils.ts';

if (IS_BROWSER) {
	// Initialize API URLs
	const apiHostname = getApiHostname();
	const apiPort = getApiPort();
	const apiUseTls = getApiUseTls();
	const apiUrl = getApiUrl(apiHostname, apiPort, apiUseTls);
	const wsUrl = getWsUrl(apiHostname, apiPort, apiUseTls);
	console.log('LandingHero: ', { apiHostname, apiPort, apiUseTls, apiUrl, wsUrl });

	initializeAppState({
		wsUrl: wsUrl,
		apiUrl: apiUrl,
		onMessage: (message) => {
			console.log('LandingHero: Received message:', message);
		},
		onError: (error) => {
			console.error('LandingHero: WebSocket error:', error);
		},
		onClose: () => {
			console.log('LandingHero: WebSocket closed');
		},
		onOpen: () => {
			console.log('LandingHero: WebSocket opened');
		},
	});
}

// isAuthorized moved to component scope

export default function LandingHero() {
	const isAuthorized = useSignal(false);
	const { authState, getSessionUser } = useAuthState();
	const appState = useAppState();
	const showDownload = useSignal(false);
	//if (IS_BROWSER) console.log('LandingHero: authState', authState.value);

	const checkSession = async () => {
		//if (IS_BROWSER) {
		//	console.log('LandingHero: checkSession:', {
		//		isLocalMode: authState.value.isLocalMode,
		//		isAuthorized: isAuthorized.value,
		//	});
		//}
		if (authState.value.isLocalMode) {
			isAuthorized.value = true;
			return;
		}
		isAuthorized.value = false;

		try {
			const { user, error } = await getSessionUser(null, null);
			//console.log('LandingHero: getSessionUser', { user, error });
			if (error || !user) return;

			authState.value = {
				...authState.value,
				user,
			};
			isAuthorized.value = true;
		} catch (error) {
			console.error('Session check failed:', error);
		}
	};

	useEffect(() => {
		if (!IS_BROWSER) return;
		//if (IS_BROWSER) console.log('LandingHero: Initial mount effect');
		checkSession();
	}, []);

	useEffect(() => {
		if (!IS_BROWSER) return;
		//if (IS_BROWSER) console.log('LandingHero: isLocalMode changed to:', authState.value.isLocalMode);
		checkSession();
	}, [authState.value.isLocalMode]);

	// Show download component after a delay if API is not connected
	useEffect(() => {
		if (!appState.value.status.isReady) {
			const timer = setTimeout(() => {
				showDownload.value = true;
			}, 1000);
			return () => clearTimeout(timer);
		}
		showDownload.value = false;
	}, [appState.value.status.isReady]);

	return (
		<div class='relative isolate px-6 pt-14 lg:px-8'>
			<div class='mx-auto max-w-2xl py-16 sm:py-24 lg:py-32'>
				<div class='text-center'>
					<h1 class='text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl'>
						<div className='flex items-center justify-center gap-4 mb-6'>
							<img src='/logo.png' alt='BB Logo' className='h-16 w-16 sm:h-20 sm:w-20' />
							<span className='font-bold leading-none tracking-tight'>Beyond Better</span>
						</div>

						<div class='mt-6'>
							Your Intelligent <br />Project Partner
						</div>
					</h1>
					<p class='mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400'>
						Beyond Better is your AI-powered agentic assistant <br />that handles the complexity while you focus
						on results.
					</p>
					<div class='mt-10 flex items-center justify-center gap-x-6 flex-wrap'>
						{appState.value.status.isReady
							? (
								<a
									href={isAuthorized.value ? '/app/home' : '/auth/login'}
									class='rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 px-8 py-4 text-2xl font-bold text-white shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200 animate-fade-in focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 min-w-[200px]'
								>
									{isAuthorized.value ? 'Open BB' : 'Sign In'}
								</a>
							)
							: showDownload.value
							? <BBAppDownload isCollapsed={false} className='w-full max-w-md' />
							: (
								<div class='animate-pulse rounded-xl bg-gradient-to-r from-purple-600 to-purple-800 px-8 py-4 text-lg font-bold text-white shadow-lg min-w-[200px]'>
									Checking API Status...
								</div>
							)}
					</div>
				</div>
			</div>
		</div>
	);
}
