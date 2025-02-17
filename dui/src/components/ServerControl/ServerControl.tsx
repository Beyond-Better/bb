import { useEffect, useState } from 'preact/hooks';
import { GlobalConfig, ServerStartResult, ServerStatus, ServiceStartResult } from '../../types/api';
import { open } from '@tauri-apps/plugin-shell';
import { getAllWebviewWindows, PhysicalPosition, PhysicalSize, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { load } from '@tauri-apps/plugin-store';
import { generateWebviewBuiUrl } from '../../utils/url';
import { getProxyInfo, ProxyInfo, setProxyTarget } from '../../utils/proxy';
import { useDebugMode } from '../../providers/DebugModeProvider';
import { checkServerStatus, getApiLogPath, getBuiLogPath, getGlobalConfig, startServer, stopServer } from '../../utils/api';

// Constants for polling intervals
const NORMAL_POLL_INTERVAL = 15000; // 15 seconds for normal operation
const STARTUP_POLL_INTERVAL = 500; // 500ms during startup/status changes

interface ServerControlProps {
	onStatusChange?: (status: ServerStatus) => void;
	onConnectionChange?: (isConnected: boolean) => void;
	onNavigate: (path: string) => void;
}

interface WindowState {
	width: number;
	height: number;
	x: number;
	y: number;
	scaleFactor: number;
}

export function ServerControl({ onStatusChange, onConnectionChange, onNavigate }: ServerControlProps) {
	const { debugMode } = useDebugMode();
	const [status, setStatus] = useState<ServerStatus>({
		api: {
			pid_exists: false,
			process_responds: false,
			service_responds: false,
			pid: null,
			error: null,
		},
		bui: {
			pid_exists: false,
			process_responds: false,
			service_responds: false,
			pid: null,
			error: null,
		},
		all_services_ready: false,
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [startupPhase, setStartupPhase] = useState<string>('');
	const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
	const [apiLogPath, setApiLogPath] = useState<string | null>(null);
	const [buiLogPath, setBuiLogPath] = useState<string | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [pollingInterval, setPollingInterval] = useState<number>(NORMAL_POLL_INTERVAL);
	const [webviewBuiUrl, setWebviewBuiUrl] = useState<string>('');
	const [directBuiUrl, setDirectBuiUrl] = useState<string>('');
	const [proxyInfo, setProxyInfo] = useState<ProxyInfo | null>(null);
	const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);
	const [chatWindowState, setChatWindowState] = useState<WindowState>({
		width: 800,
		height: 600,
		x: 50,
		y: 50,
		scaleFactor: 1,
	});

	// Check initial window state
	useEffect(() => {
		const checkWindow = async () => {
			try {
				const windows = await getAllWebviewWindows();
				const chatWindow = windows.find((w) => w.label === 'bb_chat');
				setIsChatWindowOpen(!!chatWindow);
			} catch (error) {
				console.error('Error checking window state:', error);
			}
		};
		checkWindow();
	}, []);

	// Update BUI URL when globalConfig or debug mode changes
	useEffect(async () => {
		//const direct = debugMode ? 'https://localhost:8080' : 'https://chat.beyondbetter.dev';
		const direct = `${globalConfig.bui.tls.useTls ? 'https' : 'http'}://${globalConfig.bui.hostname}:${globalConfig.bui.port}`
		setDirectBuiUrl(direct);
		// Set proxy target based on debug mode
		if (globalConfig?.api && !globalConfig.api.tls.useTls) {
			try {
				await setProxyTarget(direct);
				console.debug('Set proxy target to:', direct);
			} catch (err) {
				console.error('Failed to set proxy target:', err);
			}
		}

		console.debug('URL effect triggered with:', { globalConfig, debugMode });
		if (globalConfig?.api) {
			const apiConfig = globalConfig.api;
			const buiConfig = globalConfig.bui;
			if (!globalConfig.api.tls.useTls) {
				// Only get proxy info if TLS is disabled
				console.debug('Getting proxy info...', { globalConfig, debugMode });
				try {
					console.debug('About to call getProxyInfo...');
					const proxyInfo = await getProxyInfo();
					console.debug('Received proxy info:', proxyInfo);
					setProxyInfo(proxyInfo);
					console.debug(`Using proxy on port ${proxyInfo.port} with target ${proxyInfo.target}`);
					const url = generateWebviewBuiUrl({ apiConfig, buiConfig, proxyInfo, debugMode });
					console.debug('Setting BUI URL with proxy:', url);
					setWebviewBuiUrl(url);
				} catch (err) {
					console.error('Failed to get proxy info:', err);
					console.debug('Error details:', {
						message: err.message,
						stack: err.stack,
						error: err,
					});
					// Fallback to direct connection
					const url = generateWebviewBuiUrl({ apiConfig, buiConfig, debugMode });
					console.debug('Setting BUI URL without proxy:', url);
					setWebviewBuiUrl(url);
				}
			} else {
				// Use direct connection with TLS
				console.debug('Using direct HTTPS connection');
				setWebviewBuiUrl(generateWebviewBuiUrl({ apiConfig, buiConfig, debugMode }));
			}
		}
	}, [globalConfig, debugMode]);

	const [isVisible, setIsVisible] = useState(true);

	useEffect(() => {
		// Handle visibility change
		const handleVisibilityChange = () => {
			setIsVisible(!document.hidden);
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, []);

	// Reload chat window when server status changes (including TLS changes)
	useEffect(() => {
		const reloadChatWindow = async () => {
			if (status.all_services_ready && webviewBuiUrl) {
				console.debug('Reloading BB Chat with webview URL:', webviewBuiUrl);
				try {
					await handleReloadChat();
				} catch (error) {
					console.error('Error reloading chat window:', error);
				}
			}
		};

		reloadChatWindow();
	}, [status.all_services_ready, webviewBuiUrl]);

	useEffect(() => {
		const init = async () => {
			try {
				const logPath = await getApiLogPath();
				setApiLogPath(logPath);
			} catch (err) {
				console.error('Failed to get API log path:', err);
			}
			try {
				const logPath = await getBuiLogPath();
				setBuiLogPath(logPath);
			} catch (err) {
				console.error('Failed to get BUI log path:', err);
			}
			try {
				const config = await getGlobalConfig();
				setGlobalConfig(config);

				// Initial status check
				const status = await checkServerStatus();
				setStatus(status);
			} catch (err) {
				setError(`Failed to load server configuration: ${err}`);
			}
			await updateStatus();
		};
		init();

		let interval: number | undefined;

		// Only set up polling if window is visible
		if (isVisible) {
			// Do an immediate check when becoming visible
			updateStatus();

			// Set up the polling interval
			interval = setInterval(async () => {
				await updateStatus();
			}, pollingInterval);
		}

		return () => {
			if (interval) {
				clearInterval(interval);
			}
		};
	}, [pollingInterval, isVisible]);

	// Update parent components when status changes
	useEffect(() => {
		if (onStatusChange) {
			onStatusChange(status);
		}
		if (onConnectionChange) {
			onConnectionChange(status.all_services_ready);
		}
	}, [status, onStatusChange, onConnectionChange]);

	const updateStatus = async () => {
		try {
			const serverStatus = await checkServerStatus();
			setStatus(serverStatus);

			// Clear error if all services are ready
			if (serverStatus.all_services_ready) {
				setError(null);
				setPollingInterval(NORMAL_POLL_INTERVAL);
			} else if (serverStatus.api.error || serverStatus.bui.error) {
				setError(serverStatus.api.error || serverStatus.bui.error);
				// Use faster polling when there are issues
				setPollingInterval(STARTUP_POLL_INTERVAL);
			}
		} catch (err) {
			console.error('Status check error:', err);
			setError(`Failed to check server status: ${err.message || 'Unknown error'}`);
			// Use faster polling when there are issues
			setPollingInterval(STARTUP_POLL_INTERVAL);
			setStatus({
				api: {
					pid_exists: false,
					process_responds: false,
					service_responds: false,
					pid: null,
					error: err.message || 'Unknown error',
				},
				bui: {
					pid_exists: false,
					process_responds: false,
					service_responds: false,
					pid: null,
					error: err.message || 'Unknown error',
				},
				all_services_ready: false,
			});
		}
	};

	const toggleServer = async () => {
		setIsLoading(true);
		setError(null);
		try {
			if (status.all_services_ready) {
				setStartupPhase('Stopping Services...');
				await handleStopServer();
			} else {
				setStartupPhase('Starting Services...');
				await handleStartServer();
			}
			// Force an immediate status check
			await updateStatus();
		} catch (err) {
			console.error('Toggle error:', err);
			setError(
				`Failed to ${status.all_services_ready ? 'stop' : 'start'} services: ${err.message || 'Unknown error'}`,
			);
		} finally {
			setIsLoading(false);
			setStartupPhase('');
		}
	};

	const handleStartServer = async () => {
		const navigateToSettings = () => {
			setStartupPhase('');
			setPollingInterval(NORMAL_POLL_INTERVAL);
			onNavigate('/settings');
		};
		setError(null);
		setStartupPhase('Initializing...');
		setPollingInterval(STARTUP_POLL_INTERVAL);
		const maxAttempts = 25; // 5 seconds with 200ms intervals

		try {
			// Start both services
			const result = await startServer();
			if (!result.all_services_ready) {
				if (result.api.requires_settings || result.bui.requires_settings) {
					setError('Configuration required');
					setStartupPhase('Configuration needed');
					navigateToSettings();
					return;
				}
				throw new Error(result.api.error || result.bui.error || 'Failed to start services');
			}

			// Wait for services to become responsive
			setStartupPhase('Waiting for Services...');
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
				const status = await checkServerStatus();

				if (status.all_services_ready) {
					setStartupPhase('Services are ready');
					setPollingInterval(NORMAL_POLL_INTERVAL);
					return;
				}

				// Update phase with attempt count
				setStartupPhase(`Waiting for Services (${attempt + 1}/${maxAttempts})...`);
			}

			// If we get here, services didn't respond in time
			throw new Error('Services started but not responding after 5 seconds');
		} catch (err) {
			console.error('Start services error:', err);
			setError(`Failed to start services: ${err.message || 'Unknown error'}`);
			// Try to get current status
			await updateStatus();
		}
	};

	const handleStopServer = async () => {
		setError(null);
		setStartupPhase('Stopping Services...');
		setPollingInterval(STARTUP_POLL_INTERVAL);
		const maxAttempts = 25; // 5 seconds with 200ms intervals

		try {
			// Stop both services
			await stopServer();

			// Wait for services to stop responding
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
				const status = await checkServerStatus();

				if (!status.api.service_responds && !status.bui.service_responds) {
					setStartupPhase('Services stopped');
					setPollingInterval(NORMAL_POLL_INTERVAL);
					return;
				}

				// Update phase with attempt count
				setStartupPhase(`Waiting for Services to stop (${attempt + 1}/${maxAttempts})...`);
			}

			// If we get here, services are still responding
			throw new Error('Services stop requested but still responding after 5 seconds');
		} catch (err) {
			console.error('Stop services error:', err);
			setError(`Failed to stop services: ${err.message || 'Unknown error'}`);
			// Try to get current status
			await updateStatus();
		}
	};

	const loadWindowState = async () => {
		try {
			const store = await load('bb-window-state.json', { autoSave: true });
			const state = await store.get('chatWindow');
			console.debug('Loaded chat window state:', state);
			return state || {
				width: 1200,
				height: 800,
				x: null,
				y: null,
				scaleFactor: 1,
			};
		} catch (error) {
			console.error('Error loading window state:', error);
			return {
				width: 1200,
				height: 800,
				x: null,
				y: null,
				scaleFactor: 1,
			};
		}
	};

	const saveWindowState = async (window: WebviewWindow) => {
		try {
			const position = await window.outerPosition();
			const size = await window.outerSize();
			const scaleFactor = await window.scaleFactor();
			const windowState = {
				width: size.width,
				height: size.height,
				x: position.x,
				y: position.y,
				scaleFactor,
			};
			setChatWindowState(windowState);
			const store = await load('bb-window-state.json', { autoSave: true });
			console.debug('Saving chat window state:', windowState);
			await store.set('chatWindow', windowState);
		} catch (error) {
			console.error('Error saving window state:', error);
		}
	};

	const handleReloadChat = async () => {
		const setupWindowListeners = (window: WebviewWindow) => {
			window.once('tauri://created', () => {
				console.log('BB Chat window created');
				setIsChatWindowOpen(true);
			});
			window.once('tauri://error', (e) => {
				console.error('Error creating BB Chat window:', e);
				setIsChatWindowOpen(false);
			});
			window.once('tauri://destroyed', () => {
				console.log('BB Chat window closed');
				setIsChatWindowOpen(false);
			});
			window.listen('tauri://move', async () => {
				await saveWindowState(window);
			});
			window.listen('tauri://resize', async () => {
				await saveWindowState(window);
			});
		};

		if (!status.all_services_ready) {
			console.debug('Services not ready, skipping chat reload');
			return;
		}

		console.info('Reloading BB Chat with webview URL:', webviewBuiUrl);
		try {
			const windows = await getAllWebviewWindows();
			const chatWindow = windows.find((w) => w.label === 'bb_chat');
			if (chatWindow) {
				// If window exists, close it and create a new one
				await saveWindowState(chatWindow);
				await chatWindow.close();
			}
			// Create new window
			const windowState = await loadWindowState();
			console.log('windowState', windowState);
			const newWindow = new WebviewWindow('bb_chat', {
				url: webviewBuiUrl,
				title: 'BB Chat',
				width: windowState.width / windowState.scaleFactor,
				height: windowState.height / windowState.scaleFactor,
				x: windowState.x / windowState.scaleFactor,
				y: windowState.y / windowState.scaleFactor,
				center: windowState.x === null,
				resizable: true,
				decorations: true,
			});
			setupWindowListeners(newWindow);
		} catch (error) {
			console.error('Error managing chat window:', error);
		}
	};

	return (
		<div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto'>
			{/* Main Controls Container */}
			<div className='flex flex-col gap-4 mb-6'>
				{/* Top row with server controls and settings */}
				<div className='flex items-center justify-between gap-2'>
					{/* Toggle and status container */}
					<div className='flex items-center min-w-[100px] text-gray-900 dark:text-gray-300 mr-3'>
						Server Status:
					</div>
					<div className='flex items-center min-w-[300px]'>
						<label className='relative inline-flex items-center cursor-pointer'>
							<input
								type='checkbox'
								className='sr-only peer'
								checked={status.all_services_ready}
								onChange={toggleServer}
								disabled={isLoading}
							/>
							<div
								className={`relative w-14 h-7 bg-gray-200 rounded-full peer 
                                dark:bg-gray-700 peer-checked:after:translate-x-full 
                                after:content-[''] after:absolute after:top-0.5 after:left-[4px] 
                                after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all
                                peer-checked:bg-green-600 ${isLoading ? 'opacity-50' : ''}`}
							>
							</div>
						</label>
						<div
							className={`ml-4 px-3 py-1 rounded-full font-medium text-sm ${
								isLoading
									? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
									: status.all_services_ready
									? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
									: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
							}`}
						>
							{isLoading
								? (startupPhase || 'Processing...')
								: status.all_services_ready
								? 'Running'
								: 'Stopped'}
						</div>
					</div>
					{/* Settings button */}
					<button
						onClick={() => onNavigate('/settings')}
						className='inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800'
					>
						<svg
							className='w-4 h-4 mr-1'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
							/>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
							/>
						</svg>
						Settings
					</button>
				</div>

				{/* Chat buttons row */}
				<div className='flex items-center gap-4 justify-center'>
					{globalConfig && (
						<button
							onClick={handleReloadChat}
							disabled={!status.all_services_ready}
							className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
								status.all_services_ready
									? 'bg-blue-600 hover:bg-blue-700'
									: 'bg-gray-400 cursor-not-allowed'
							} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800`}
						>
							<svg
								className='w-5 h-5 mr-2'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
								/>
							</svg>
							{isChatWindowOpen ? 'Reload Chat' : 'Open Chat'}
						</button>
					)}
					{directBuiUrl && (
						<div
							onClick={async () => {
								try {
									await open(directBuiUrl);
								} catch (err) {
									console.error('Failed to open direct BUI URL:', err);
									alert(`Please open this URL manually: ${directBuiUrl}`);
								}
							}}
							className='font-medium text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-3 cursor-pointer transition-colors duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2'
						>
							<svg
								className="h-5 w-5 flex-shrink-0"
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
								/>
							</svg>
							<span className='break-all font-mono text-sm'>
								{directBuiUrl}
							</span>
						</div>
					)}
				</div>
			</div>

			{/* Error Message */}
			{error && (
				<div className='text-red-600 dark:text-red-400 text-center mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded'>
					{error}
				</div>
			)}

			{/* Advanced Section */}
			<div className='mt-4'>
				<button
					onClick={() => setShowAdvanced(!showAdvanced)}
					className='text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1'
				>
					<svg
						className={`w-4 h-4 transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
					</svg>
					Server Details
				</button>

				{showAdvanced && (
					<div className='mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-4'>
						{globalConfig && (
							<div className='grid gap-4'>
								{/* API Status */}
								<div className='grid grid-cols-6 gap-y-4'>
									<div className='col-span-6 font-bold text-lg mb-1'>API Status</div>
									<div className='font-bold'>Host:</div>
									<div>{globalConfig.api.hostname}</div>
									<div className='font-bold'>Port:</div>
									<div>{globalConfig.api.port}</div>
									<div className='font-bold'>TLS:</div>
									<div>{globalConfig.api.tls.useTls ? 'Enabled' : 'Disabled'}</div>
									<div className='font-bold'>Server Status:</div>
									<div>{status.api.service_responds ? 'Ready' : 'Not ready'}</div>
									<div className='font-bold'>Process Status:</div>
									<div>{status.api.process_responds ? 'Responding' : 'Not responding'}</div>
									<div className='font-bold'>Process ID:</div>
									<div>{status.api.pid || 'Not running'}</div>
									{apiLogPath && (
										<>
											<div className='font-bold'>Server Log:</div>
											<div className='col-span-5'>{apiLogPath}</div>
										</>
									)}
								</div>

								{/* API Proxy */}
								<div className='grid grid-cols-6 gap-y-4 mt-4'>
									<div className='col-span-6 font-bold text-lg mb-1'>API Proxy</div>
									{proxyInfo && !globalConfig.api.tls.useTls
										? (
											<>
												<div className='font-bold'>Proxy Port:</div>
												<div>{proxyInfo.port}</div>
												<div className='font-bold'>Proxy Target:</div>
												<div className='col-span-3'>{proxyInfo.target}</div>
											</>
										)
										: (
											<>
												<div className='font-bold'>Proxy:</div>
												<div>disabled</div>
											</>
										)}
								</div>

								{/* BUI Status */}
								<div className='grid grid-cols-6 gap-y-4 mt-4'>
									<div className='col-span-6 font-bold text-lg mb-1'>BUI Status <span className="ml-2 text-sm">(Browser User Interface)</span></div>
									<div className='font-bold'>Host:</div>
									<div>{globalConfig.bui.hostname}</div>
									<div className='font-bold'>Port:</div>
									<div>{globalConfig.bui.port}</div>
									<div className='font-bold'>TLS:</div>
									<div>{globalConfig.bui.tls.useTls ? 'Enabled' : 'Disabled'}</div>
									<div className='font-bold'>Server Status:</div>
									<div>{status.bui.service_responds ? 'Ready' : 'Not ready'}</div>
									<div className='font-bold'>Process Status:</div>
									<div>{status.bui.process_responds ? 'Responding' : 'Not responding'}</div>
									<div className='font-bold'>Process ID:</div>
									<div>{status.bui.pid || 'Not running'}</div>
									{buiLogPath && (
										<>
											<div className='font-bold'>Server Log:</div>
											<div className='col-span-5'>{buiLogPath}</div>
										</>
									)}
								</div>

							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
