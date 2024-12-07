import { useEffect, useState } from 'preact/hooks';
import { ApiConfig, ApiStatus } from '../../types/api';
import { open } from '@tauri-apps/plugin-shell';
import { generateBuiUrl } from '../../utils/url';
import { checkApiStatus, getApiConfig, startApi, stopApi } from '../../utils/api';

// Constants for polling intervals
const NORMAL_POLL_INTERVAL = 10000; // 10 seconds
const STARTUP_POLL_INTERVAL = 500; // 0.5 seconds during startup

interface ServerControlProps {
	onStatusChange?: (status: ApiStatus) => void;
	onConnectionChange?: (isConnected: boolean) => void;
}

export function ServerControl({ onStatusChange, onConnectionChange }: ServerControlProps) {
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

	useEffect(() => {
		const init = async () => {
			try {
				const apiConfig = await getApiConfig();
				setConfig(apiConfig);
				setBuiUrl(generateBuiUrl(apiConfig));
			} catch (err) {
				setError(`Failed to load server configuration: ${err}`);
			}
			await updateStatus();
		};
		init();

		const interval = setInterval(async () => {
			await updateStatus();
		}, pollingInterval);

		return () => clearInterval(interval);
	}, [pollingInterval]);

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
			setError(null);
		} catch (err) {
			setError(`Failed to check server status: ${err}`);
		}
	};

	const toggleServer = async () => {
		if (status.api_responds) {
			await handleStopServer();
		} else {
			await handleStartServer();
		}
	};

	const handleStartServer = async () => {
		setError(null);
		setStartupPhase('Initializing...');
		setPollingInterval(STARTUP_POLL_INTERVAL);
		const maxAttempts = 10;

		setIsLoading(true);
		try {
			const result = await startApi();
			if (result.success) {
				setStartupPhase('Starting BB Server...');
				for (let attempt = 0; attempt < maxAttempts; attempt++) {
					await new Promise((resolve) => setTimeout(resolve, STARTUP_POLL_INTERVAL));
					const status = await checkApiStatus();
					if (status.api_responds) {
						setStartupPhase('BB Server is ready');
						await updateStatus();
						setPollingInterval(NORMAL_POLL_INTERVAL);
						break;
					}
					if (attempt === maxAttempts - 1) {
						setError('Server started but not responding after 5 seconds');
					}
				}
			} else {
				setError(result.error || 'Failed to start server');
			}
		} catch (err) {
			setError(`Error starting server: ${err}`);
		} finally {
			const currentStatus = await checkApiStatus();
			setIsLoading(false);
			setPollingInterval(NORMAL_POLL_INTERVAL);
		}
	};

	const handleStopServer = async () => {
		setIsLoading(true);
		try {
			await stopApi();
			await updateStatus();
		} catch (err) {
			setError(`Error stopping server: ${err}`);
		} finally {
			setIsLoading(false);
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
								status.api_responds
									? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
									: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
							}`}
						>
							{status.api_responds ? 'Running' : 'Stopped'}
						</div>
						<div className='min-w-[150px]'>
							{isLoading
								? (
									<span className='ml-3 text-sm font-medium text-gray-900 dark:text-gray-300'>
										{startupPhase || 'Processing...'}
									</span>
								)
								: <span className='invisible'>placeholder</span>}
						</div>
					</div>
				</div>

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

			{/* Error Message */}
			{error && (
				<div className='text-red-600 dark:text-red-400 text-center mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded'>
					{error}
				</div>
			)}

			{/* Configuration Info */}
			{config && (
				<div className='text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-4'>
					{buiUrl && (
						<div className='mt-2'>
							<div className='font-medium mb-1'>
								URL: <span className='break-all font-mono text-sm'>{buiUrl}</span>
							</div>
						</div>
					)}
					<div className='font-medium mb-2'>Server Configuration:</div>
					<div className='grid grid-cols-3 gap-2'>
						<div>Host: {config.hostname}</div>
						<div>Port: {config.port}</div>
						<div>TLS: {config.tls.use_tls ? 'Enabled' : 'Disabled'}</div>
						{config.log_file && <div>Log: {config.log_file}</div>}
					</div>
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
					Advanced Details
				</button>

				{showAdvanced && (
					<div className='mt-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded p-4'>
						<div className='grid grid-cols-2 gap-2'>
							<div>Process ID:</div>
							<div>{status.pid || 'Not running'}</div>
							<div>Process Status:</div>
							<div>{status.process_responds ? 'Responding' : 'Not responding'}</div>
							<div>API Status:</div>
							<div>{status.api_responds ? 'Ready' : 'Not ready'}</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
