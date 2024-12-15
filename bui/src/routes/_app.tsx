import { PageProps } from '$fresh/server.ts';
import { Head } from '$fresh/runtime.ts';
import { Partial } from '$fresh/runtime.ts';
import SideNav from '../islands/SideNav.tsx';

export default function App({ Component, url }: PageProps) {
	// Pages that use a custom layout
	const isCustomPage = url.pathname === '/doctor' || url.pathname === '/doctor/';

	if (isCustomPage) {
		return (
			<html>
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
				</Head>
				<body class='overflow-hidden'>
					<Component />
				</body>
			</html>
		);
	}

	// Standard layout with navigation
	return (
		<html>
			<Head>
				<link rel='preconnect' href='https://fonts.googleapis.com' />
				<link rel='preconnect' href='https://fonts.gstatic.com' crossOrigin='anonymous' />
				<link
					href='https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'
					rel='stylesheet'
				/>
				<meta charset='utf-8' />
				<meta name='viewport' content='width=device-width, initial-scale=1.0' />
				<title>Beyond Better</title>
				<link rel='stylesheet' href='/styles.css' />
			</Head>
			<body class='overflow-hidden' f-client-nav>
				<div class='flex h-screen bg-gray-50'>
					{/* Side Navigation with app state initialization */}
					<SideNav currentPath={url.pathname} />

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
