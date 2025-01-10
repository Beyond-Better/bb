import { invoke } from '@tauri-apps/api/core';
import { ServerControl } from './components/ServerControl/ServerControl';
import { LogViewer } from './components/LogViewer/LogViewer';
import { Header } from './components/Header/Header';
import { Settings } from './components/Settings/Settings';
import { VersionProvider } from './providers/VersionProvider';
import { DebugModeProvider } from './providers/DebugModeProvider';
import { VersionUpgradePrompt } from './components/VersionUpgradePrompt/VersionUpgradePrompt';
import { useEffect, useState } from 'preact/hooks';
import { ApiStatus } from './types/ApiStatus';
import './App.css';

function App() {
	const [serverStatus, setServerStatus] = useState(ApiStatus.Ready);
	const [isConnected, setIsConnected] = useState(true);
	const [currentRoute, setCurrentRoute] = useState('/');
	const [isInitialized, setIsInitialized] = useState(false);

	const checkAndInitialize = async () => {
		// VersionProvider handles all version and binary checks
		// Just set initialization status
		setIsInitialized(true);
	};

	useEffect(() => {
		checkAndInitialize();
	}, []);

	useEffect(() => {
		// Handle browser back/forward buttons
		const handlePopState = () => {
			setCurrentRoute(window.location.pathname);
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, []);

	const navigate = (path: string) => {
		window.history.pushState(null, '', path);
		setCurrentRoute(path);
	};

	const handleStatusChange = (status: any) => {
		// console.log('status', status);
		if (status.api.error || status.bui.error) {
			setServerStatus(ApiStatus.Error);
		} else if (status.api.service_responds && status.bui.service_responds) {
			setServerStatus(ApiStatus.Ready);
		} else if (status.api.process_responds || status.bui.process_responds) {
			setServerStatus(ApiStatus.Processing);
		} else {
			setServerStatus(ApiStatus.Error);
		}
	};

	const handleConnectionChange = (isConnected: boolean) => {
		setIsConnected(isConnected);
	};

	return (
		<VersionProvider>
			<DebugModeProvider>
				<div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
					<Header
						serverStatus={serverStatus}
						isConnected={isConnected}
						onNavigate={navigate}
					/>
					<main className='container mx-auto px-4 py-8'>
						<VersionUpgradePrompt />
						{currentRoute === '/' && (
							<>
								<ServerControl
									onStatusChange={handleStatusChange}
									onConnectionChange={handleConnectionChange}
									onNavigate={navigate}
								/>
								{/*<LogViewer className="max-w-2xl mx-auto" />*/}
							</>
						)}
						{currentRoute === '/settings' && <Settings />}
					</main>
				</div>
			</DebugModeProvider>
		</VersionProvider>
	);
}

export default App;
