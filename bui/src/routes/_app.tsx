import { PageProps } from '$fresh/server.ts';
import { Head } from '$fresh/runtime.ts';
import { Partial } from '$fresh/runtime.ts';
import SideNav from '../islands/SideNav.tsx';
import { useAuthState } from '../hooks/useAuthState.ts';
import { User } from '../types/auth.ts';

// List of routes that don't have SideNav
export const CUSTOM_PATHS = [
	'/doctor',
	'/auth/',
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
			<title>BB - {title}</title>
		</Head>
	);
};

//export default async function App(req: Request, ctx: RouteContext) {
export default function App({ Component, url, state }: PageProps) {
	const { authState } = useAuthState();

	// Pages that use a custom layout
	const isCustomPage = isCustomPath(url.pathname);

	if (isCustomPage) {
		return (
			<html>
				<PageHead title='Beyond Better' />
				<body class='overflow-hidden bg-gray-50 dark:bg-gray-900'>
					<Component />
				</body>
			</html>
		);
	}

	authState.value = {
		...authState.value,
		user: state.user as User,
	};

	// Standard layout with navigation
	return (
		<html>
			<PageHead title='Beyond Better' />
			<body class='overflow-hidden dark:bg-gray-900' f-client-nav>
				<div class='flex h-screen bg-gray-50 dark:bg-gray-900'>
					{/* Side Navigation with app state initialization */}
					<SideNav authState={authState} currentPath={url.pathname} />

					{/* Main content area - updates via Partials */}
					<div class='flex-1 flex flex-col overflow-hidden'>
						<Partial name='page-content'>
							<Component />
						</Partial>
					</div>
				</div>
			</body>
		</html>
	);
}
