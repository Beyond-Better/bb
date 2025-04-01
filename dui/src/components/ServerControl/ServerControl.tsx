import { useEffect, useState } from 'preact/hooks';
import { GlobalConfig, ServerStartResult, ServerStatus } from '../../types/api';
import { open } from '@tauri-apps/plugin-shell';
import { getAllWebviewWindows, WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';
import { generateWebviewBuiUrl, generateWebviewBuiUrlWithPlatform } from '../../utils/url';
import { getProxyInfo, ProxyInfo, setProxyTarget } from '../../utils/proxy';
import { useDebugMode } from '../../providers/DebugModeProvider';
import {
	checkServerStatus,
	getApiLogPath,
	getBuiLogPath,
	getGlobalConfig,
	startServer,
	stopServer,
} from '../../utils/api';
import { loadWindowState, saveWindowState, setupWindowStateHandlers } from '../../utils/window';

const CHAT_WINDOW_LABEL = 'bb_chat';

interface ChatWebviewOptions {
	url?: string;
	title?: string;
	width?: number;
	height?: number;
	x?: number;
	y?: number;
	scaleFactor?: number;
	visible?: boolean;
	focus?: boolean;
	center?: boolean;
	resizable?: boolean;
	decorations?: boolean;
	skipTaskbar?: boolean;
}

// Default window dimensions - these match the Rust defaults in window_state.rs
const DEFAULT_WINDOW_SIZE_LOGICAL = {
	width: 800, // Chat window logical size
	height: 650,
	x: null as number | null,
	y: null as number | null,
	scaleFactor: globalThis.devicePixelRatio || 2.0, // Default to common HiDPI scaling
};

// Ensure chat window is visible on screen
const ensureWindowVisible = (options: ChatWebviewOptions): ChatWebviewOptions => {
	const screenWidth = globalThis.screen.availWidth;
	const screenHeight = globalThis.screen.availHeight;

	// If position would put window off screen, adjust it
	if (options.x !== undefined && options.width !== undefined) {
		if (options.x + options.width > screenWidth) {
			options.x = Math.max(0, screenWidth - options.width);
		}
	}
	if (options.y !== undefined && options.height !== undefined) {
		if (options.y + options.height > screenHeight) {
			options.y = Math.max(0, screenHeight - options.height);
		}
	}

	return options;
};
const DEFAULT_WINDOW_SIZE_PHYSICAL = {
	width: DEFAULT_WINDOW_SIZE_LOGICAL.width * DEFAULT_WINDOW_SIZE_LOGICAL.scaleFactor,
	height: DEFAULT_WINDOW_SIZE_LOGICAL.height * DEFAULT_WINDOW_SIZE_LOGICAL.scaleFactor,
	x: null as number | null,
	y: null as number | null,
	scaleFactor: globalThis.devicePixelRatio || 2.0, // Match logical default
};

// Constants for polling intervals
const NORMAL_POLL_INTERVAL = 15000; // 15 seconds for normal operation
const STARTUP_POLL_INTERVAL = 500; // 500ms during startup/status changes

interface ServerControlProps {
	onStatusChange?: (status: ServerStatus) => void;
	onConnectionChange?: (isConnected: boolean) => void;
	onNavigate: (path: string) => void;
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
	//const [webviewBuiUrlWithPlatform, setWebviewBuiUrlWithPlatform] = useState<string>('');
	const [directBuiUrl, setDirectBuiUrl] = useState<string>('');
	const [proxyInfo, setProxyInfo] = useState<ProxyInfo | null>(null);
	const [isChatWindowOpen, setIsChatWindowOpen] = useState(false);
	const [isVisible, setIsVisible] = useState(true);

	// Check initial window state
	useEffect(() => {
		const checkWindow = async () => {
			if (debugMode) console.info('[DEBUG] Checking initial window state');
			try {
				const windows = await getAllWebviewWindows();
				const chatWindow = windows.find((w) => w.label === CHAT_WINDOW_LABEL);
				if (debugMode) console.info('[DEBUG] Found existing chat window:', chatWindow?.label);
				if (debugMode) console.info('[DEBUG] Checking for existing chat window:', chatWindow);
				setIsChatWindowOpen(!!chatWindow);
			} catch (error) {
				console.error('Error checking window state:', error);
			}
		};
		checkWindow();
	}, []);

	// Update BUI URL when globalConfig or debug mode changes
	useEffect(() => {
		const updateBuiUrl = async () => {
			if (!globalConfig?.bui) return;

			//const direct = debugMode ? 'https://localhost:8080' : 'https://chat.beyondbetter.dev';
			const direct = `${
				globalConfig.bui.tls.useTls ? 'https' : 'http'
			}://${globalConfig.bui.hostname}:${globalConfig.bui.port}`;
			setDirectBuiUrl(direct);

			// Set proxy target based on debug mode
			if (globalConfig?.api && !globalConfig.api.tls.useTls) {
				try {
					await setProxyTarget(direct);
					if (debugMode) console.info('[DEBUG] Set proxy target to:', direct);
				} catch (err) {
					console.error('Failed to set proxy target:', err);
				}
			}

			if (debugMode) console.info('[DEBUG] URL effect triggered with:', { globalConfig, debugMode });

			if (globalConfig?.api) {
				const apiConfig = globalConfig.api;
				const buiConfig = globalConfig.bui;
				if (!globalConfig.api.tls.useTls) {
					if (debugMode) console.info('[DEBUG] Getting proxy info...', { globalConfig, debugMode });
					try {
						const proxyInfo = await getProxyInfo();
						if (debugMode) {
							console.info('[DEBUG] Received proxy info:', proxyInfo);
							console.info(
								`[DEBUG] Using proxy on port ${proxyInfo.port} with target ${proxyInfo.target}`,
							);
						}
						setProxyInfo(proxyInfo);
						const url = generateWebviewBuiUrl({ apiConfig, buiConfig, proxyInfo, debugMode });
						if (debugMode) console.info('[DEBUG] Setting BUI URL with proxy:', url);
						setWebviewBuiUrl(url);
					} catch (err) {
						console.error('Failed to get proxy info:', err);
						if (debugMode) {
							if (err instanceof Error) {
								console.info('[DEBUG] Error details:', {
									message: err.message,
									stack: err.stack,
									error: err,
								});
							} else {
								console.info('[DEBUG] Error details:', {
									error: err,
								});
							}
						}
						const url = generateWebviewBuiUrl({ apiConfig, buiConfig, debugMode });
						if (debugMode) console.info('[DEBUG] Setting BUI URL without proxy:', url);
						setWebviewBuiUrl(url);
					}
				} else {
					if (debugMode) console.info('[DEBUG] Using direct HTTPS connection');
					setWebviewBuiUrl(generateWebviewBuiUrl({ apiConfig, buiConfig, debugMode }));
				}
			}
		};

		updateBuiUrl();
	}, [globalConfig, debugMode]);

	// Handle window visibility
	useEffect(() => {
		const handleVisibilityChange = () => setIsVisible(!document.hidden);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, []);

	// Reload chat window when server status changes (including TLS changes)
	useEffect(() => {
		const reloadChatWindow = async () => {
			if (status.all_services_ready && webviewBuiUrl) {
				if (debugMode) console.info('[DEBUG] Reloading BB Chat with webview URL:', webviewBuiUrl);
				try {
					await handleReloadChat();
				} catch (error) {
					console.error('Error reloading chat window:', error);
				}
			}
		};

		reloadChatWindow();
	}, [status.all_services_ready, webviewBuiUrl]);

	// Initialize configuration and status
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
			interval = setInterval(updateStatus, pollingInterval);
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [pollingInterval, isVisible]);

	// Update parent components when status changes
	useEffect(() => {
		if (onStatusChange) onStatusChange(status);
		if (onConnectionChange) onConnectionChange(status.all_services_ready);
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
			setError(
				`Failed to check server status: ${(err instanceof Error) ? (err.message || 'Unknown error') : err}`,
			);
			// Use faster polling when there are issues
			setPollingInterval(STARTUP_POLL_INTERVAL);
			setStatus({
				api: {
					pid_exists: false,
					process_responds: false,
					service_responds: false,
					pid: null,
					error: (err instanceof Error) ? (err.message || 'Unknown error') : err,
				},
				bui: {
					pid_exists: false,
					process_responds: false,
					service_responds: false,
					pid: null,
					error: (err instanceof Error) ? (err.message || 'Unknown error') : err,
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
				`Failed to ${status.all_services_ready ? 'stop' : 'start'} services: ${
					(err instanceof Error) ? (err.message || 'Unknown error') : err
				}`,
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
			const result: ServerStartResult = await startServer();
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
			setError(`Failed to start services: ${(err instanceof Error) ? (err.message || 'Unknown error') : err}`);
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
			setError(`Failed to stop services: ${(err instanceof Error) ? (err.message || 'Unknown error') : err}`);
			// Try to get current status
			await updateStatus();
		}
	};

	const handleReloadChat = async (): Promise<void> => {
		if (!status.all_services_ready) {
			if (debugMode) console.info('[DEBUG] Services not ready, skipping chat reload');
			return;
		}

		if (debugMode) console.info('[DEBUG] Reloading BB Chat with URL:', webviewBuiUrl);

		try {
			// Find and close existing window
			const windows = await getAllWebviewWindows();
			const chatWindow = windows.find((w) => w.label === CHAT_WINDOW_LABEL);

			if (debugMode) {
				console.info('[DEBUG] Window state check:', {
					existingWindows: windows.map((w) => w.label),
					foundChatWindow: chatWindow?.label,
				});
			}

			// Save state of existing window before closing
			if (chatWindow) {
				if (debugMode) console.info('[DEBUG] Found existing chat window, saving state before closing');
				try {
					await saveWindowState(chatWindow, true); // Force save on window close
					if (debugMode) console.info('[DEBUG] Successfully saved chat window state');
					await chatWindow.close();
					if (debugMode) console.info('[DEBUG] Existing chat window closed');
				} catch (error) {
					console.error('[ERROR] Error handling existing window:', error);
				}
			}

			// Load saved state before creating window
			let windowStateLogical;
			let windowStatePhysical;
			try {
				//if (debugMode) console.info('[DEBUG] Loading saved window state');
				windowStateLogical = await loadWindowState(CHAT_WINDOW_LABEL, true); // Use logical size
				windowStatePhysical = await loadWindowState(CHAT_WINDOW_LABEL, false); // Use logical size
				if (debugMode) console.info('[DEBUG] Loaded window state (physical):', windowStatePhysical);
			} catch (error) {
				console.error('[ERROR] Failed to load window state:', error);
				if (debugMode) console.info('[DEBUG] Using default window state');
				windowStateLogical = DEFAULT_WINDOW_SIZE_LOGICAL;
				windowStatePhysical = DEFAULT_WINDOW_SIZE_PHYSICAL;
			}

			// Create window centered initially
			if (debugMode) {
				console.info('[DEBUG] Creating chat window with state (physical):', {
					width: windowStatePhysical.width,
					height: windowStatePhysical.height,
					x: windowStatePhysical.x,
					y: windowStatePhysical.y,
					scaleFactor: windowStatePhysical.scale_factor,
				});
			}

			const webviewBuiUrlWithPlatform = generateWebviewBuiUrlWithPlatform(webviewBuiUrl);
			console.info('[DEBUG] Reloading BB Chat with platform URL:', webviewBuiUrlWithPlatform);
			let options: ChatWebviewOptions = {
				url: webviewBuiUrlWithPlatform,
				title: 'BB Chat',
				width: windowStateLogical.width,
				height: windowStateLogical.height,
				//center: true, // Always create centered, will move after
				resizable: true,
				decorations: true,
				skipTaskbar: false,
			};

			// Only set position if we have both coordinates
			if (windowStateLogical.x !== null && windowStateLogical.y !== null) {
				if (debugMode) {
					console.info('[DEBUG] Will apply position after window creation (physical):', {
						x: windowStateLogical.x,
						y: windowStateLogical.y,
						scaleFactor: windowStateLogical.scale_factor,
					});
				}
				options.x = windowStateLogical.x;
				options.y = windowStateLogical.y;
			}

			if (debugMode) console.info('[DEBUG] Creating chat window with original options:', options);
			// Ensure window will be visible on screen
			options = ensureWindowVisible(options);

			if (debugMode) console.info('[DEBUG] Creating chat window with validated options:', options);
			const newWindow = new WebviewWindow(CHAT_WINDOW_LABEL, options);

			// Set up window lifecycle handlers
			if (debugMode) console.info('[DEBUG] Setting up window handlers');

			newWindow.once('tauri://created', async () => {
				if (debugMode) console.info('[DEBUG] Chat window created');
				setIsChatWindowOpen(true);

				// Apply window state using Rust command
				if (windowStatePhysical.x !== null && windowStatePhysical.y !== null) {
					if (debugMode) console.info('[DEBUG] Applying window state via Rust command');
					try {
						await invoke('apply_window_state', {
							windowLabel: CHAT_WINDOW_LABEL,
							state: windowStatePhysical,
						});
						if (debugMode) console.info('[DEBUG] Window state applied successfully');
					} catch (error) {
						console.error('[ERROR] Failed to apply window state:', error);
					}
				}

				// Set up state handlers after window is ready
				if (debugMode) console.info('[DEBUG] Setting up window state handlers');
				setupWindowStateHandlers(newWindow);
			});

			newWindow.once('tauri://error', (e) => {
				if (debugMode) console.info('[DEBUG] Chat window error event fired:', e);
				setIsChatWindowOpen(false);
				console.error('[ERROR] Failed to create chat window:', e);
			});

			newWindow.once('tauri://destroyed', () => {
				if (debugMode) console.info('[DEBUG] Chat window destroyed event fired');
				setIsChatWindowOpen(false);
			});
		} catch (error) {
			console.error('[ERROR] Failed to manage chat window:', error);
			if (debugMode) console.info('[DEBUG] Chat window management error:', error);
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
						{status.all_services_ready ? "Server Status:" : "Start Server:"}
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
								className={`relative w-14 h-7 ${
									status.all_services_ready 
									  ? 'bg-green-600' 
									  : 'bg-gray-200 dark:bg-gray-700 border-2 border-blue-400 dark:border-blue-500'
								} rounded-full peer 
                                after:content-[''] after:absolute after:top-0.5 after:left-[4px] 
                                after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all
                                peer-checked:after:translate-x-full ${isLoading ? 'opacity-50' : ''}`}
							>
							  {!status.all_services_ready && (
							    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-blue-600 dark:text-blue-300 z-10">
							      START
							    </span>
							  )}
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
				
				{/* Call-to-action message when server is stopped */}
				{!status.all_services_ready && !isLoading && (
				  <div className="mt-2 text-blue-600 dark:text-blue-400 font-medium text-center animate-pulse">
				    Click the toggle above to start the server
				  </div>
				)}

				{/* Chat buttons row */}
				<div className='flex items-center gap-4 justify-center'>
					{globalConfig && (
						<div className='flex gap-2'>
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
						</div>
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
								className='h-5 w-5 flex-shrink-0'
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
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
									<div className='col-span-6 font-bold text-lg mb-1'>
										BUI Status <span className='ml-2 text-sm'>(Browser User Interface)</span>
									</div>
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
