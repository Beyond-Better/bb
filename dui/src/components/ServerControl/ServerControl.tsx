import { useEffect, useState } from 'preact/hooks';
import { ApiConfig, ApiStatus } from '../../types/api';

interface ApiStartResult {
    success: boolean;
    pid: number | null;
    error: string | null;
    requires_settings: boolean;
}
import { open } from '@tauri-apps/plugin-shell';
import { generateBuiUrl } from '../../utils/url';
import { checkApiStatus, getApiConfig, startApi, stopApi } from '../../utils/api';

// Constants for polling intervals
const NORMAL_POLL_INTERVAL = 15000; // 15 seconds for normal operation
const STARTUP_POLL_INTERVAL = 500; // 500ms during startup/status changes

interface ServerControlProps {
	onStatusChange?: (status: ApiStatus) => void;
	onConnectionChange?: (isConnected: boolean) => void;
	onNavigate: (path: string) => void;
}

export function ServerControl({ onStatusChange, onConnectionChange, onNavigate }: ServerControlProps) {
	const [status, setStatus] = useState<ApiStatus>({
		pid_exists: false,
		process_responds: false,
		api_responds: false,
		pid: null,
		error: null,
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [startupPhase, setStartupPhase] = useState<string>('');
	const [config, setConfig] = useState<ApiConfig | null>(null);
	const [showAdvanced, setShowAdvanced] = useState(false);
	const [pollingInterval, setPollingInterval] = useState<number>(NORMAL_POLL_INTERVAL);
	const [buiUrl, setBuiUrl] = useState<string>('');

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

	useEffect(() => {
		const init = async () => {
			try {
				const apiConfig = await getApiConfig();
				console.log('apiConfig', apiConfig);
				setConfig(apiConfig);
				setBuiUrl(generateBuiUrl(apiConfig));

				// Initial status check
				const status = await checkApiStatus();
				// Note: Auto-start removed to allow manual control via toggle
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
			onConnectionChange(status.process_responds);
		}
	}, [status, onStatusChange, onConnectionChange]);

	const updateStatus = async () => {
		try {
			const apiStatus = await checkApiStatus();
			setStatus(apiStatus);

			// Clear error if API is responding
			if (apiStatus.api_responds) {
				setError(null);
				setPollingInterval(NORMAL_POLL_INTERVAL);
			} else if (apiStatus.error) {
				setError(apiStatus.error);
				// Use faster polling when there are issues
				setPollingInterval(STARTUP_POLL_INTERVAL);
			}
		} catch (err) {
			console.error('Status check error:', err);
			setError(`Failed to check server status: ${err.message || 'Unknown error'}`);
			// Use faster polling when there are issues
			setPollingInterval(STARTUP_POLL_INTERVAL);
			setStatus({
				pid_exists: false,
				process_responds: false,
				api_responds: false,
				pid: null,
				error: err.message || 'Unknown error',
			});
		}
	};

	const toggleServer = async () => {
		setIsLoading(true);
		setError(null);
		try {
			if (status.api_responds) {
				setStartupPhase('Stopping Server...');
				await handleStopServer();
			} else {
				setStartupPhase('Starting Server...');
				await handleStartServer();
			}
			// Force an immediate status check
			await updateStatus();
		} catch (err) {
			console.error('Toggle error:', err);
			setError(`Failed to ${status.api_responds ? 'stop' : 'start'} server: ${err.message || 'Unknown error'}`);
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
			// Start the API process
			const result = await startApi();
			if (result.requires_settings) {
				setError(result.error || 'Configuration required');
				setStartupPhase('Configuration needed');
				navigateToSettings();
				return;
			}
			if (!result.success) {
				throw new Error(result.error || 'Failed to start server');
			}

			// Wait for API to become responsive
			setStartupPhase('Waiting for Server...');
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
				const status = await checkApiStatus();

				if (status.api_responds) {
					setStartupPhase('Server is ready');
					setPollingInterval(NORMAL_POLL_INTERVAL);
					return;
				}

				// Update phase with attempt count
				setStartupPhase(`Waiting for Server (${attempt + 1}/${maxAttempts})...`);
			}

			// If we get here, API didn't respond in time
			throw new Error('Server process started but not responding after 5 seconds');
		} catch (err) {
			console.error('Start server error:', err);
			setError(`Failed to start server: ${err.message || 'Unknown error'}`);
			// Try to get current status
			await updateStatus();
		}
	};

	const handleStopServer = async () => {
		setError(null);
		setStartupPhase('Stopping Server...');
		setPollingInterval(STARTUP_POLL_INTERVAL);
		const maxAttempts = 25; // 5 seconds with 200ms intervals

		try {
			// Stop the API process
			await stopApi();

			// Wait for API to stop responding
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
				const status = await checkApiStatus();

				if (!status.api_responds) {
					setStartupPhase('Server stopped');
					setPollingInterval(NORMAL_POLL_INTERVAL);
					return;
				}

				// Update phase with attempt count
				setStartupPhase(`Waiting for Server to stop (${attempt + 1}/${maxAttempts})...`);
			}

			// If we get here, API is still responding
			throw new Error('Server process stop requested but Server is still responding after 5 seconds');
		} catch (err) {
			console.error('Stop server error:', err);
			setError(`Failed to stop server: ${err.message || 'Unknown error'}`);
			// Try to get current status
			await updateStatus();
		}
	};

	return (
		<div className='bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto'>
			{/* Toggle Switch */}
			<div className='flex flex-col items-center gap-4 mb-6'>
				<div className='flex items-center gap-2'>
					{/* Toggle and status container */}
					<div className='flex items-center min-w-[100px] text-gray-900 dark:text-gray-300 mr-3'>
						Server Status:
					</div>
					<div className='flex items-center min-w-[300px]'>
						<label className='relative inline-flex items-center cursor-pointer'>
							<input
								type='checkbox'
								className='sr-only peer'
								checked={status.api_responds}
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
									: status.api_responds
									? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
									: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
							}`}
						>
							{isLoading
								? (startupPhase || 'Processing...')
								: status.api_responds
								? 'Running'
								: 'Stopped'}
						</div>
					</div>
				</div>

				<div className='flex items-center gap-4'>
					<button
						onClick={() => onNavigate('/settings')}
						className='inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800'
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

					<button
						onClick={async () => {
							try {
								await open(buiUrl);
							} catch (err) {
								console.error('Failed to open BUI URL:', err);
								alert(`Please open this URL manually: ${buiUrl}`);
							}
						}}
						disabled={!status.api_responds}
						className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
            ${status.api_responds ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800`}
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
								d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
							/>
						</svg>
						Launch Beyond Better
					</button>
				</div>
				{buiUrl && (
					<div className='text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-4'>
						<div className='mt-1'>
							<div className='font-medium mb-1'>
								<span className='break-all font-mono text-sm'>{buiUrl}</span>
							</div>
						</div>
					</div>
				)}
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
					<div className='mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-4 grid gap-4'>
						{/* Configuration Info */}
						{/* {config.logFile && <div>Log: </div><div className='col-span-5'>{config.log_file}</div>} */}
						{config && (
							<div className='grid grid-cols-6 gap-y-4'>
								<div className='font-bold'>Host:</div>
								<div>{config.hostname}</div>
								<div className='font-bold'>Port:</div>
								<div>{config.port}</div>
								<div className='font-bold'>TLS:</div>
								<div>{config.tls.use_tls ? 'Enabled' : 'Disabled'}</div>
								<div className='font-bold'>Server Status:</div>
								<div>{status.api_responds ? 'Ready' : 'Not ready'}</div>
								<div className='font-bold'>Process Status:</div>
								<div>{status.process_responds ? 'Responding' : 'Not responding'}</div>
								<div className='font-bold'>Process ID:</div> <div>{status.pid || 'Not running'}</div>
								{config.logFile && (
									<>
										<div className='font-bold'>Server Log:</div>
										<div className='col-span-5'>{config.logFile}</div>
									</>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
