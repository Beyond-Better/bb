import {
	BaseDirectory,
	open,
	readTextFileLines,
	SeekMode,
	//readTextFile,
	type WatchEvent,
	watchImmediate,
} from '@tauri-apps/plugin-fs';

// Buffer updates to prevent too frequent UI updates
const UPDATE_BUFFER_MS = 100;

export async function watchLogs(logFilePath: string, onNewContent: (content: string) => void) {
	console.log('watchLogs: Starting with path:', logFilePath);

	let lastContentLength = 0;
	let updateTimeout: NodeJS.Timeout | null = null;
	let pendingContent = '';

	const flushContent = () => {
		if (pendingContent) {
			console.log('watchLogs: Flushing buffered content, length:', pendingContent.length);
			onNewContent(pendingContent);
			pendingContent = '';
		}
	};

	try {
		// Set up watch options according to Tauri v2 docs
		const watchOptions = {
			baseDir: BaseDirectory.AppLog,
			recursive: false, // Only watch this specific file
		};

		console.log('watchLogs: Setting up watch with options:', {
			...watchOptions,
			path: logFilePath,
		});

		// Get initial file size
		const file = await open(logFilePath, {
			read: true,
			baseDir: BaseDirectory.AppLog,
		});
		const initialStats = await file.stat();
		lastContentLength = initialStats.size;
		await file.close();

		const unwatch = await watchImmediate(
			logFilePath,
			// Event handler
			async (event: WatchEvent) => {
				console.log('watchLogs: Event received:', {
					type: event.type,
					paths: event.paths,
					attrs: event.attrs,
				});

				// Only process events for our specific file
				if (!event.paths.some((p) => p === logFilePath)) {
					console.log('watchLogs: Ignoring event for different path:', event.paths);
					return;
				}

				// Handle all relevant event types
				if (event.type === 'modify' || event.type === 'create' || event.type === 'any') {
					console.log('watchLogs: Processing file change event');
					try {
						const file = await open(logFilePath, {
							read: true,
							baseDir: BaseDirectory.AppLog,
						});

						const stats = await file.stat();
						if (stats.size > lastContentLength) {
							// Only read the new content
							if (lastContentLength > 0) {
								await file.seek(lastContentLength, SeekMode.Start);
							}

							// Read new content
							const buffer = new Uint8Array(stats.size - lastContentLength);
							const bytesRead = await file.read(buffer);

							if (bytesRead) {
								const newContent = new TextDecoder().decode(buffer);
								console.log('watchLogs: Read new content, length:', newContent.length);

								// Buffer the update
								pendingContent += newContent;

								// Schedule flush if not already scheduled
								if (!updateTimeout) {
									updateTimeout = setTimeout(() => {
										flushContent();
										updateTimeout = null;
									}, UPDATE_BUFFER_MS);
								}
							}

							lastContentLength = stats.size;
						}
						await file.close();
					} catch (err) {
						console.error('watchLogs: Error reading file after event:', {
							error: err,
							errorMessage: err instanceof Error ? err.message : String(err),
							stackTrace: err instanceof Error ? err.stack : undefined,
							logFilePath,
						});
					}
				}
			},
			// Watch options
			watchOptions,
		);

		console.log('watchLogs: Watch setup complete');
		return () => {
			console.log('watchLogs: Cleaning up watch');
			if (updateTimeout) {
				clearTimeout(updateTimeout);
				flushContent();
			}
			unwatch();
		};
	} catch (err) {
		console.error('watchLogs: Error setting up watch:', {
			error: err,
			errorMessage: err instanceof Error ? err.message : String(err),
			stackTrace: err instanceof Error ? err.stack : undefined,
			logFilePath,
		});
		throw err;
	}
}

export async function viewLastLines(logFilePath: string, lines: number): Promise<string> {
	console.log('viewLastLines: Starting to read file:', logFilePath, 'max lines:', lines);
	try {
		console.log('viewLastLines: Getting lines iterator');
		const linesIterator = await readTextFileLines(logFilePath, {
			baseDir: BaseDirectory.AppLog,
		});

		console.log('viewLastLines: Got iterator, starting to read lines');
		const allLines: string[] = [];

		for await (const line of linesIterator) {
			if (line.trim() !== '') {
				allLines.push(line);
				if (allLines.length > lines) {
					allLines.shift(); // Remove oldest line when we exceed the limit
				}
			}
		}

		const result = allLines.join('\n');
		console.log('viewLastLines: Returning content, lines count:', allLines.length);
		return result;
	} catch (err) {
		console.error('viewLastLines: Error reading file:', logFilePath, err);
		console.error('viewLastLines: Error details:', {
			error: err,
			errorMessage: err instanceof Error ? err.message : String(err),
			stackTrace: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}
}
