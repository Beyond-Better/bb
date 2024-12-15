import { useEffect, useRef, useState } from 'preact/hooks';
import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, exists, stat, watchImmediate } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-shell';
import { AnsiUp } from 'ansi_up';
import { viewLastLines, watchLogs } from '../../utils/logViewer.utils';

const ansiUp = new AnsiUp();
// Configure AnsiUp to use appropriate colors
// ansiUp.use_classes = true;
// ansiUp.dark_mode = true;
const MAX_LINES = 500; // Limit number of lines to prevent memory issues

interface LogViewerProps {
	className?: string;
}

export function LogViewer({ className = '' }: LogViewerProps) {
	const [isExpanded, setIsExpanded] = useState(false);
	const [logPath, setLogPath] = useState<string | null>(null);
	const [logLines, setLogLines] = useState<string[]>([]);
	const [filterText, setFilterText] = useState('');
	const [error, setError] = useState<string | null>(null);
	const logContainerRef = useRef<HTMLDivElement>(null);
	const shouldAutoScroll = useRef(true);

	useEffect(() => {
		// Get log path when component mounts
		console.log('LogViewer: Requesting log path from backend');
		invoke<string | null>('get_log_path')
			.then(async (path) => {
				console.log('LogViewer: Got log path:', path);
				if (!path) {
					throw new Error('No log path returned from backend');
				}

				console.log('LogViewer: Checking if path exists:', {
					path,
					baseDir: BaseDirectory.AppLog,
				});

				const pathExists = await exists(path, {
					baseDir: BaseDirectory.AppLog,
				});

				console.log('LogViewer: Path exists check result:', {
					path,
					exists: pathExists,
					baseDir: BaseDirectory.AppLog,
				});

				const pathMetadata = await stat(path, {
					baseDir: BaseDirectory.AppLog,
				});
				console.log('LogViewer: Path pathMetadata:', {
					path,
					metadata: pathMetadata,
					baseDir: BaseDirectory.AppLog,
				});

				if (pathExists) {
					console.log('LogViewer: Log file exists, setting path:', path);
					setLogPath(path);
				} else {
					console.log('LogViewer: Log file does not exist:', path);
					throw new Error('Log file not found');
				}
			})
			.catch((err) => {
				console.error('LogViewer: Failed to get log path:', {
					error: err,
					errorMessage: err instanceof Error ? err.message : String(err),
					stackTrace: err instanceof Error ? err.stack : undefined,
				});
				setError(`Failed to get log path: ${err instanceof Error ? err.message : String(err)}`);
			});
	}, []);

	useEffect(() => {
		let cleanup: (() => void) | null = null;

		console.log('LogViewer: isExpanded', {
			logPath,
			isExpanded,
		});

		const readLog = async () => {
			if (!logPath || !isExpanded) {
				console.log('LogViewer: Skipping log read - path or expansion conditions not met', {
					logPath,
					isExpanded,
				});
				return;
			}

			try {
				console.log('LogViewer: Loading initial content, max lines:', MAX_LINES);
				const initialContent = await viewLastLines(logPath, MAX_LINES);
				const lines = initialContent.split('\n').filter((line) => line.trim() !== '');
				console.log('LogViewer: Initial content loaded, lines count:', lines.length);

				setLogLines(lines);

				console.log('LogViewer: Setting up log watcher');
				cleanup = await watchLogs(logPath, (newContent) => {
					if (!newContent.trim()) {
						console.log('LogViewer: Received empty content, skipping update');
						return;
					}

					const newLines = newContent.split('\n').filter((line) => line.trim() !== '');
					if (newLines.length === 0) {
						console.log('LogViewer: No new lines after filtering, skipping update');
						return;
					}

					console.log('LogViewer: Processing new lines:', newLines.length);
					setLogLines((prevLines) => {
						const combinedLines = [...prevLines, ...newLines];
						const trimmedLines = combinedLines.slice(-MAX_LINES);
						console.log('LogViewer: Updated lines count:', trimmedLines.length);
						return trimmedLines;
					});
				});
			} catch (err) {
				console.error('LogViewer: Error in readLog:', {
					error: err,
					errorMessage: err instanceof Error ? err.message : String(err),
					stackTrace: err instanceof Error ? err.stack : undefined,
					logPath,
					isExpanded,
				});
				setError(`Failed to read log: ${err instanceof Error ? err.message : String(err)}`);
			}
		};

		readLog();

		if (!isExpanded) {
			setError(null);
			setLogLines([]);
		}

		return () => {
			if (cleanup) {
				console.log('LogViewer: Cleaning up log watcher');
				cleanup();
				cleanup = null;
			}
		};
	}, [logPath, isExpanded]);

	useEffect(() => {
		if (shouldAutoScroll.current && logContainerRef.current) {
			logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
		}
	}, [logLines]);

	const handleScroll = () => {
		if (!logContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
		// Auto-scroll if we're near the bottom
		shouldAutoScroll.current = scrollHeight - (scrollTop + clientHeight) < 50;
	};

	const filteredLines = logLines.filter((line) =>
		!filterText || line.toLowerCase().includes(filterText.toLowerCase())
	);

	return (
		<div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mt-4 ${className}`}>
			<div className='flex items-center justify-between mb-4'>
				<button
					onClick={() => setIsExpanded(!isExpanded)}
					className='flex items-center text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
				>
					<svg
						className={`w-5 h-5 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
					</svg>
					<span className='ml-2 font-medium'>Log Viewer</span>
				</button>

				{logPath && (
					<button
						onClick={() => open(logPath)}
						className='text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
					>
						Reveal Log File
					</button>
				)}
			</div>

			{isExpanded && (
				<>
					<div className='mb-4'>
						<input
							type='text'
							placeholder='Filter logs...'
							value={filterText}
							onChange={(e) => setFilterText((e.target as HTMLInputElement).value)}
							className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                                     focus:outline-none focus:ring-2 focus:ring-blue-500'
						/>
					</div>

					{error && (
						<div className='text-red-600 dark:text-red-400 mb-4 p-2 bg-red-50 dark:bg-red-900/20 rounded'>
							{error}
						</div>
					)}

					<div
						ref={logContainerRef}
						onScroll={handleScroll}
						className='font-mono text-sm bg-gray-50 dark:bg-gray-900 rounded-md p-4 
                                 overflow-auto whitespace-pre'
						style={{ height: 'calc(100vh - 400px)', minHeight: '200px' }}
					>
						{filteredLines.map((line, index) => (
							<div
								key={index}
								dangerouslySetInnerHTML={{ __html: ansiUp.ansi_to_html(line) }}
								className='leading-5 text-gray-900 dark:text-gray-100'
							/>
						))}
					</div>
				</>
			)}
		</div>
	);
}
