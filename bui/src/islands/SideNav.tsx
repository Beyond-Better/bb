import { IS_BROWSER } from '$fresh/runtime.ts';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useState } from 'preact/hooks';

import { initializeAppState, setPath, useAppState } from '../hooks/useAppState.ts';
import { getApiHostname, getApiPort, getApiUrl, getApiUseTls, getWsUrl } from '../utils/url.utils.ts';
//import { ProjectSelector } from '../components/ProjectSelector/index.ts';
import { useVersion } from '../hooks/useVersion.ts';
import { ConnectionStatus } from '../components/Connection/ConnectionStatus.tsx';
import { BBAppDownload } from '../components/Connection/BBAppDownload.tsx';
import { VersionWarning } from '../components/Version/VersionWarning.tsx';
import { Toast } from '../components/Toast.tsx';
import { StatusDialog } from '../components/Status/StatusDialog.tsx';
import { UserMenu } from '../components/auth/UserMenu.tsx';
import { ExternalLink } from '../components/ExternalLink.tsx';

import { useAuthState } from '../hooks/useAuthState.ts';

interface SideNavProps {
	currentPath?: string;
}

interface NavItem {
	path: string;
	label: string;
	icon: string;
}

// Initialize collapse state signal from localStorage if available, otherwise default to false
const getInitialCollapsedState = () => {
	if (IS_BROWSER) {
		const stored = localStorage.getItem('sideNavCollapsed');
		return stored === 'true';
	}
	return false;
};

const isCollapsed = signal(getInitialCollapsedState());

// const currentPath = () => {
// 	if (IS_BROWSER) return globalThis.location.pathname;
// 	return '/';
// };

// Initialize app and auth state immediately
if (IS_BROWSER) {
	// Initialize API URLs
	const apiHostname = getApiHostname();
	const apiPort = getApiPort();
	const apiUseTls = getApiUseTls();
	const apiUrl = getApiUrl(apiHostname, apiPort, apiUseTls);
	const wsUrl = getWsUrl(apiHostname, apiPort, apiUseTls);
	console.log('SideNav: ', { apiHostname, apiPort, apiUseTls, apiUrl, wsUrl });

	initializeAppState({
		wsUrl: wsUrl,
		apiUrl: apiUrl,
		onMessage: (message) => {
			console.log('SideNav: Received message:', message);
		},
		onError: (error) => {
			console.error('SideNav: WebSocket error:', error);
		},
		onClose: () => {
			console.log('SideNav: WebSocket closed');
		},
		onOpen: () => {
			console.log('SideNav: WebSocket opened');
		},
	});
}

export default function SideNav({ currentPath: _currentPath = '/' }: SideNavProps) {
	const [showToast, setShowToast] = useState(false);
	const [showStatus, setShowStatus] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const appState = useAppState();
	const { authState } = useAuthState();
	const { versionCompatibility } = useVersion();
	if (IS_BROWSER) console.log('AuthContext: authState', authState.value);

	// Update path when URL changes
	useEffect(() => {
		if (!IS_BROWSER) return;
		const handlePopState = () => {
			setPath(globalThis.location.pathname);
		};
		globalThis.addEventListener('popstate', handlePopState);
		return () => globalThis.removeEventListener('popstate', handlePopState);
	}, []);

	// Navigation items
	const navItems: NavItem[] = [
		{
			path: '/app/home',
			label: 'Home',
			icon:
				'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
		},
		{
			path: '/app/chat',
			label: 'Chat',
			icon:
				'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
		},
		{
			path: '/app/projects',
			label: 'Projects',
			icon:
				'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
		},
		{
			path: '/app/settings',
			label: 'Settings',
			icon:
				'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
		},
	];

	return (
		<aside
			class={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen z-50 relative ${
				isCollapsed.value ? 'w-16' : 'w-64'
			} transition-all duration-300`}
		>
			{/* Logo Section */}
			<div class='border-b border-gray-200 relative'>
				<a
					href='/'
					class={`flex items-center space-x-2 py-2 ${
						isCollapsed.value ? 'pl-2 pr-4' : 'px-4'
					} transition-all duration-300`}
				>
					<img
						src='/logo-dark.png'
						alt='BB Logo'
						className='h-8 w-8 hidden dark:block'
					/>
					<img
						src='/logo-light.png'
						alt='BB Logo'
						className='h-8 w-8 block dark:hidden'
					/>
					{!isCollapsed.value && (
						<div>
							<span class='text-md text-gray-500 dark:text-gray-400 ml-1'>Beyond Better</span>
						</div>
					)}
				</a>
				<button
					type='button'
					onClick={() => {
						const newState = !isCollapsed.value;
						isCollapsed.value = newState;
						if (IS_BROWSER) {
							localStorage.setItem('sideNavCollapsed', String(newState));
						}
					}}
					class='absolute -right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm'
					aria-label={isCollapsed.value ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-5 h-5 text-gray-500 dark:text-gray-400'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d={isCollapsed.value ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
						/>
					</svg>
				</button>
			</div>

			{/* Navigation Section */}
			<nav class='flex-1 overflow-y-auto py-4'>
				<ul class='space-y-1'>
					{navItems.map((item) => (
						<li key={item.path}>
							<a
								href={item.path}
								f-partial={`${item.path}/partial`}
								onClick={() => setPath(item.path)}
								class={`flex items-center ${
									isCollapsed.value ? 'justify-center' : 'justify-start'
								} px-4 py-2 rounded-md text-sm font-medium ${
									appState.value.path === item.path
										? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
										: 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
								}`}
								aria-current={appState.value.path === item.path ? 'page' : undefined}
							>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									stroke-width='1.5'
									stroke='currentColor'
									class='w-5 h-5'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										d={item.icon}
									/>
								</svg>
								{!isCollapsed.value && <span class='ml-3'>{item.label}</span>}
							</a>
						</li>
					))}
				</ul>
			</nav>

			{/* Footer Section */}
			<div class='border-t border-gray-200 dark:border-gray-700 pt-4 px-2 space-y-3 mb-3'>
				{/* User Menu */}
				{authState.value.user && <UserMenu isCollapsed={isCollapsed.value} />}

				{/* Connection Status with Version Info */}
				<ConnectionStatus
					isCollapsed={isCollapsed.value}
					className='mb-2'
				/>

				{/* BB App Download Prompt */}
				{!appState.value.status.isReady && (
					<BBAppDownload
						isCollapsed={isCollapsed.value}
						onClose={() => {
							if (appState.value.status.isReady) {
								setToastMessage('Connected to BB server successfully');
								setShowToast(true);
							}
						}}
					/>
				)}

				{/* Version Information */}
				{!isCollapsed.value &&
					versionCompatibility && !versionCompatibility.compatible && (
					<div className='text-xs text-gray-500 dark:text-gray-400 relative'>
						<div className='text-amber-600'>
							Update required: v{versionCompatibility.requiredVersion}
						</div>
						<div className='absolute left-full ml-4 bottom-0 z-[100]'>
							<VersionWarning
								apiClient={appState.value.apiClient!}
								className='shadow-lg w-80'
							/>
						</div>
					</div>
				)}

				{/* Status Button */}
				<button
					type='button'
					onClick={() => setShowStatus(true)}
					title='View API status'
					class={`flex items-center ${
						isCollapsed.value ? 'justify-center' : 'justify-start'
					} px-4 py-1.5 rounded-md text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 w-full`}
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={2}
						stroke='currentColor'
						class='w-5 h-5'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z'
						/>
					</svg>
					{!isCollapsed.value && <span class='ml-3'>Status</span>}
				</button>

				{/* External Links */}
				<div class='space-y-0.5'>
					<ExternalLink
						href='https://beyondbetter.app/docs'
						f-client-nav={false}
						class={`flex items-center ${
							isCollapsed.value ? 'justify-center' : 'justify-start'
						} px-4 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700`}
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
							class='w-5 h-5'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d='M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25'
							/>
						</svg>
						{!isCollapsed.value ? <span class='ml-3'>Help Center</span> : <div></div>}
					</ExternalLink>
					<ExternalLink
						href='https://beyondbetter.app/blog'
						f-client-nav={false}
						class={`flex items-center ${
							isCollapsed.value ? 'justify-center' : 'justify-start'
						} px-4 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700`}
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
							class='w-5 h-5'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
							/>
						</svg>
						{!isCollapsed.value ? <span class='ml-3'>Blog</span> : <div></div>}
					</ExternalLink>
					<ExternalLink
						href='https://github.com/Beyond-Better/bb'
						f-client-nav={false}
						class={`flex items-center ${
							isCollapsed.value ? 'justify-center' : 'justify-start'
						} px-4 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700`}
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							class='w-5 h-5'
							viewBox='0 0 24 24'
							fill='currentColor'
						>
							<path d='M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z' />
						</svg>
						{!isCollapsed.value ? <span class='ml-3'>GitHub</span> : <div></div>}
					</ExternalLink>
				</div>
			</div>

			{/* Status Dialog */}
			<StatusDialog
				visible={showStatus}
				onClose={() => setShowStatus(false)}
				apiClient={appState.value.apiClient!}
			/>

			{/* Toast notifications */}
			{showToast && (
				<Toast
					message={toastMessage}
					type='success'
					duration={2000}
					onClose={() => setShowToast(false)}
				/>
			)}
		</aside>
	);
}
