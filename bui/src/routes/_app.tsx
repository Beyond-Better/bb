import { PageProps } from '$fresh/server.ts';
import { Head } from '$fresh/runtime.ts';
import { Partial } from '$fresh/runtime.ts';

import SideNav from '../islands/SideNav.tsx';
import AuthContext from '../islands/AuthContext.tsx';
import AppConfigContext from '../islands/Context/appConfig.tsx';
import { ThemeProvider } from '../components/ThemeProvider.tsx';
import ThemeManager from '../islands/ThemeManager.tsx';
//import { useAuthState } from '../hooks/useAuthState.ts';
//import { User } from '../types/auth.ts';
import type { BuiConfig } from 'shared/config/types.ts';

// List of routes that don't have SideNav or auth protection
export const CUSTOM_PATHS = [
	'/doctor',
	'/auth/',
	'/api/',
];

export function isCustomPath(path: string): boolean {
	return path === '/' || CUSTOM_PATHS.some((custom_path) => path.startsWith(custom_path));
}

interface PageHeadProps {
	title: string;
}

const PageHead = ({ title }: PageHeadProps) => {
	return (
		<Head>
			<link rel='preconnect' href='https://fonts.googleapis.com' />
			<link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
			<link
				href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
				rel='stylesheet'
			/>
			<meta charset='utf-8' />
			<meta name='viewport' content='width=device-width, initial-scale=1.0' />
			<link rel='stylesheet' href='/styles.css' />
			{/* Theme initialization script - runs immediately to prevent flashing */}
			<script
				type='module'
				dangerouslySetInnerHTML={{
					__html: `
					// Immediate theme application to prevent flashing
					const THEME_STORAGE_KEY = 'bb_user_preferences';
					
					function loadThemeFromStorage() {
						try {
							const stored = localStorage.getItem(THEME_STORAGE_KEY);
							if (stored) {
								const parsed = JSON.parse(stored);
								const theme = parsed?.theme;
								if (theme === 'light' || theme === 'dark' || theme === 'system') {
									return theme;
								}
							}
						} catch (error) {
							console.warn('Failed to load theme from localStorage:', error);
						}
						return 'system';
					}
					
					function applyThemeImmediately() {
						const theme = loadThemeFromStorage();
						
						if (theme === 'dark') {
							document.documentElement.classList.add('dark');
						} else if (theme === 'light') {
							document.documentElement.classList.remove('dark');
						} else {
							// System preference
							const prefersDark = globalThis.matchMedia('(prefers-color-scheme: dark)').matches;
							if (prefersDark) {
								document.documentElement.classList.add('dark');
							} else {
								document.documentElement.classList.remove('dark');
							}
						}
					}
					
					// Apply theme immediately
					applyThemeImmediately();
				`,
				}}
			/>
			<title>BB - {title}</title>
		</Head>
	);
};

export default function App({ Component, url, state }: PageProps) {
	//const { authState } = useAuthState();

	// Pages that use a custom layout
	const isCustomPage = isCustomPath(url.pathname);

	if (isCustomPage) {
		return (
			<html>
				<PageHead title='Beyond Better' />
				<body class='bg-gray-50 dark:bg-gray-900'>
					<AppConfigContext buiConfig={state.buiConfig as BuiConfig}>
						<ThemeProvider>
							<Component />
						</ThemeProvider>
						{/* Theme Manager Island - handles browser-side theme logic */}
						<ThemeManager />
					</AppConfigContext>
				</body>
			</html>
		);
	}

	//authState.value = {
	//	...authState.value,
	//	user: state.user as User,
	//};

	// Standard layout with navigation and auth protection
	return (
		<html>
			<PageHead title='Beyond Better' />
			<body class='overflow-hidden dark:bg-gray-900' f-client-nav>
				<AuthContext buiConfig={state.buiConfig as BuiConfig}>
					<ThemeProvider>
						<div class='flex h-screen bg-gray-50 dark:bg-gray-900'>
							<SideNav currentPath={url.pathname} />
							<div class='flex-1 flex flex-col overflow-hidden'>
								<Partial name='page-content'>
									<Component />
								</Partial>
							</div>
						</div>
					</ThemeProvider>
					{/* Theme Manager Island - handles browser-side theme logic */}
					<ThemeManager />
				</AuthContext>
			</body>
		</html>
	);
}
