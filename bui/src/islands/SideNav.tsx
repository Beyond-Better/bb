import { IS_BROWSER } from '$fresh/runtime.ts';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import ProjectSelector from './ProjectSelector.tsx';
import { initializeAppState, useAppState } from '../hooks/useAppState.ts';
import { useVersion } from '../hooks/useVersion.ts';
import { getApiHostname, getApiPort, getApiUseTls, getApiUrl, getWsUrl } from '../utils/url.utils.ts';

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

const currentPath = () => {
	if (IS_BROWSER) return globalThis.location.pathname;
	return '/';
};

const path = signal(currentPath());

// Initialize API URLs
const apiHostname = getApiHostname();
const apiPort = getApiPort();
const apiUseTls = getApiUseTls();
const apiUrl = getApiUrl(apiHostname, apiPort, apiUseTls);
const wsUrl = getWsUrl(apiHostname, apiPort, apiUseTls);

export default function SideNav({ currentPath = '/' }: SideNavProps) {
	//console.log('SideNav: Component mounting', { wsUrl, apiUrl });
	const appState = useAppState();
	const { versionCompatibility } = useVersion();

	// Initialize app state on mount
	// Effect for appState initialization
	useEffect(() => {
		console.log('SideNav: AppState initialization useEffect', { wsUrl, apiUrl });
		if (IS_BROWSER) {
			console.log('SideNav: Calling initializeAppState');
			console.log('SideNav: Dependencies for useEffect changed', { wsUrl, apiUrl });
			initializeAppState({
				url: wsUrl,
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
	}, [wsUrl, apiUrl]);

	// Update path when URL changes
	useEffect(() => {
		if (!IS_BROWSER) return;
		const handlePopState = () => {
			path.value = globalThis.location.pathname;
		};
		globalThis.addEventListener('popstate', handlePopState);
		return () => globalThis.removeEventListener('popstate', handlePopState);
	}, []);

	// Navigation items
	const navItems: NavItem[] = [
		{
			path: '/',
			label: 'Home',
			icon:
				'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
		},
		{
			path: '/chat',
			label: 'Chat',
			icon:
				'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z',
		},
		{
			path: '/projects',
			label: 'Projects',
			icon:
				'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
		},
		{
			path: '/settings',
			label: 'Settings',
			icon:
				'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z',
		},
	];

	return (
		<aside
			class={`bg-white border-r border-gray-200 flex flex-col h-screen ${
				isCollapsed.value ? 'w-16' : 'w-64'
			} transition-all duration-300`}
		>
			{/* Logo Section */}
			<div class='border-b border-gray-200 relative'>
				<a
					href='/'
					class={`flex items-center space-x-2 py-4 ${
						isCollapsed.value ? 'pl-2 pr-5' : 'px-4'
					} transition-all duration-300`}
				>
					<img
						src='/logo-dark.png'
						alt='BB Logo'
						className='h-6 w-6 hidden dark:block'
					/>
					<img
						src='/logo-light.png'
						alt='BB Logo'
						className='h-6 w-6 block dark:hidden'
					/>
					{!isCollapsed.value && (
						<div>
							<span class='text-sm text-gray-500 dark:text-gray-400 ml-2'>Beyond Better</span>
						</div>
					)}
				</a>
				<button
					onClick={() => {
						const newState = !isCollapsed.value;
						isCollapsed.value = newState;
						if (IS_BROWSER) {
							localStorage.setItem('sideNavCollapsed', String(newState));
						}
					}}
					class='absolute -right-3 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 bg-white border border-gray-200 shadow-sm'
					aria-label={isCollapsed.value ? 'Expand sidebar' : 'Collapse sidebar'}
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						stroke-width='1.5'
						stroke='currentColor'
						class='w-5 h-5 text-gray-500'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							d={isCollapsed.value ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 19l-7-7 7-7m8 14l-7-7 7-7'}
						/>
					</svg>
				</button>
			</div>

			{/* Project Selector */}
			<div class='px-4 py-2 border-b border-gray-200'>
				<ProjectSelector isCollapsed={isCollapsed.value} />
			</div>

			{/* Navigation Section */}
			<nav class='flex-1 overflow-y-auto py-4'>
				<ul class='space-y-1'>
					{navItems.map((item) => (
						<li key={item.path}>
							<a
								href={item.path}
								f-partial={item.path === '/' ? undefined : `${item.path}/partial`}
								onClick={() => path.value = item.path}
								class={`flex items-center ${
									isCollapsed.value ? 'justify-center' : 'justify-start'
								} px-3 py-2 mx-2 rounded-md text-sm font-medium ${
									path.value === item.path
										? 'bg-gray-100 text-gray-900'
										: 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
								}`}
								aria-current={path.value === item.path ? 'page' : undefined}
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
			<div class='border-t border-gray-200 p-4 space-y-4'>
				{/* Connection Status */}
				<div class={`flex items-center ${isCollapsed.value ? 'justify-center' : 'justify-start'}`}>
					<div
						class={`w-2 h-2 rounded-full ${appState.value.status.isReady ? 'bg-green-500' : 'bg-red-500'}`}
					/>
					{!isCollapsed.value && (
						<span class='ml-2 text-sm text-gray-500'>
							Server {appState.value.status.isReady ? 'Connected' : 'Disconnected'}
						</span>
					)}
				</div>

				{/* Version Information */}
				{!isCollapsed.value && appState.value.versionInfo && (
					<div className='text-xs text-gray-500'>
						<div>BB v{appState.value.versionInfo.version}</div>
						{versionCompatibility && !versionCompatibility.compatible && (
							<div className='text-amber-600'>
								Update required: v{versionCompatibility.requiredVersion}
							</div>
						)}
					</div>
				)}

				{/* External Links */}
				{!isCollapsed.value && (
					<div class='space-y-2'>
						<a
							href='https://beyondbetter.dev/docs'
							target='_blank'
							rel='noopener noreferrer'
							f-client-nav={false}
							class='text-sm text-gray-500 hover:text-gray-900 block'
						>
							Documentation
						</a>
						<a
							href='https://beyondbetter.dev/blog'
							target='_blank'
							rel='noopener noreferrer'
							f-client-nav={false}
							class='text-sm text-gray-500 hover:text-gray-900 block'
						>
							Blog
						</a>
						<a
							href='https://github.com/cknight/bb'
							target='_blank'
							rel='noopener noreferrer'
							f-client-nav={false}
							class='text-sm text-gray-500 hover:text-gray-900 block'
						>
							GitHub
						</a>
					</div>
				)}
			</div>
		</aside>
	);
}
