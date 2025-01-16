import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { AppState } from '../hooks/useAppState.ts';

interface DirectoryItem {
	name: string;
	path: string;
	isDirectory: boolean;
}

interface ColumnFileBrowserProps {
	value: string;
	onChange: (path: string) => void;
	type: 'file' | 'directory';
	className?: string;
	rootPath?: string;
	appState: Signal<AppState>;
	defaultExpanded?: boolean;
	onSelectionValid?: (isValid: boolean, selectedPath?: string) => void;
}

export function ColumnFileBrowser({
	value,
	onChange,
	type,
	className = '',
	rootPath = '.',
	appState,
	defaultExpanded = true,
	onSelectionValid,
}: ColumnFileBrowserProps) {
	const currentPath = useSignal(rootPath);
	const columns = useSignal<Array<{ path: string; items: DirectoryItem[]; selected?: string }>>([]);
	const loading = useSignal(false);
	const error = useSignal<string | null>(null);
	const showHidden = useSignal(false);
	const isExpanded = useSignal(defaultExpanded);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const scrollToEnd = () => {
		setTimeout(() => {
			if (scrollContainerRef.current) {
				scrollContainerRef.current.scrollTo({
					left: scrollContainerRef.current.scrollWidth,
					behavior: 'smooth',
				});
			}
		}, 100);
	};

	// Debug render
	// console.log('ColumnFileBrowser render:', {
	// 	currentPath: currentPath.value,
	// 	columnsCount: columns.value.length,
	// 	loading: loading.value,
	// 	rootPath,
	// 	error: error.value,
	// 	type,
	// 	defaultExpanded,
	// });

	useEffect(() => {
		console.log('Initial load effect triggered with rootPath:', rootPath);
		error.value = null;
		if (isExpanded.value) {
			loadDirectory(rootPath, true);
		}
	}, [rootPath, isExpanded.value]);

	const reloadAllColumns = async () => {
		console.log('Reloading all columns with showHidden:', showHidden.value);
		const currentColumns = [...columns.value];
		const selections = new Map(currentColumns.map((col) => [col.path, col.selected]));
		columns.value = [];

		for (const column of currentColumns) {
			const response = await appState.value.apiClient?.listDirectory(column.path, {
				only: type === 'directory' ? 'directories' : undefined,
				includeHidden: showHidden.value,
			});

			if (response && !response.errorMessage && response.items) {
				// Preserve the previous selection if the item still exists
				const selectedPath = selections.get(column.path);
				const itemStillExists = selectedPath && response.items.some((item) => item.path === selectedPath);

				columns.value = [...columns.value, {
					path: column.path,
					items: response.items,
					selected: itemStillExists ? selectedPath : undefined,
				}];

				// If this is the last column, update selection validity
				if (column === currentColumns[currentColumns.length - 1]) {
					updateSelectionValidity();
				}
			}
		}
		console.log('Columns after reload:', columns.value);
	};

	const loadDirectory = async (path: string, isInitial = false) => {
		if (!path) return;
		console.log('loadDirectory called:', { path, isInitial, showHidden: showHidden.value });
		loading.value = true;
		error.value = null;

		try {
			const apiClient = appState.value.apiClient;
			const response = await apiClient?.listDirectory(path, {
				only: type === 'directory' ? 'directories' : undefined,
				includeHidden: showHidden.value,
			});
			console.log('Directory response:', response);

			if (!response) {
				error.value = 'no response from directory listing';
				return;
			}

			if (response.errorMessage) {
				error.value = response.errorMessage;
				return;
			}

			if (response.items) {
				if (isInitial) {
					console.log('Setting initial column');
					columns.value = [{ path, items: response.items }];
				} else {
					// Find the column index for this path
					const columnIndex = columns.value.findIndex((col) => col.path === path);
					console.log('Found column index:', columnIndex, 'for path:', path);

					if (columnIndex !== -1) {
						// Remove all columns after this one and update this column
						console.log('Updating column and removing subsequent ones');
						columns.value = [
							...columns.value.slice(0, columnIndex),
							{ path, items: response.items },
						];
					} else {
						// Add new column
						console.log('Adding new column');
						columns.value = [...columns.value, { path, items: response.items }];
					}
				}
				console.log('Updated columns count:', columns.value.length);
				updateSelectionValidity();
				scrollToEnd();
			}
		} catch (e) {
			console.error('Error loading directory:', e);
			error.value = e instanceof Error ? e.message : 'Failed to load directory';
		} finally {
			loading.value = false;
		}
	};

	const handleItemClick = async (item: DirectoryItem, columnIndex: number) => {
		console.log('Item clicked:', item, 'in column:', columnIndex);

		// Update selection in current column
		const newColumns = [...columns.value];
		newColumns[columnIndex] = { ...newColumns[columnIndex], selected: item.path };

		if (item.isDirectory) {
			// Remove all columns after this one
			newColumns.splice(columnIndex + 1);
			columns.value = newColumns;

			currentPath.value = item.path;
			await loadDirectory(item.path);
		} else {
			// For files, just update the selection
			columns.value = newColumns;
			onChange(item.path);
		}

		updateSelectionValidity();
	};

	const updateSelectionValidity = () => {
		if (!onSelectionValid) return;

		const lastColumn = columns.value[columns.value.length - 1];
		const secondLastColumn = columns.value[columns.value.length - 2];

		// If last column has a selection, use that
		if (lastColumn?.selected) {
			onSelectionValid(true, lastColumn.selected);
		} // Otherwise use second-last column if it exists and has a selection
		else if (secondLastColumn?.selected) {
			onSelectionValid(true, secondLastColumn.selected);
		} // No valid selection
		else {
			onSelectionValid(false);
		}
	};

	return (
		<div class={`column-file-browser flex flex-col flex-grow ${className}`} style='width: 100%;'>
			<div class='space-y-2'>
				<div class='flex items-center justify-between'>
					<button
						onClick={() => isExpanded.value = !isExpanded.value}
						class='flex items-center px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm'
						aria-label={isExpanded.value ? 'Collapse file browser' : 'Expand file browser'}
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 20 20'
							fill='currentColor'
							class={`w-4 h-4 mr-1.5 transition-transform ${
								isExpanded.value ? 'transform rotate-90' : ''
							}`}
						>
							<path
								fill-rule='evenodd'
								d='M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z'
								clip-rule='evenodd'
							/>
						</svg>
						{isExpanded.value ? 'Collapse Browser' : 'Browse Files'}
					</button>
					{isExpanded.value && (
						<label class='flex items-center text-sm text-gray-600 dark:text-gray-400'>
							<input
								type='checkbox'
								checked={showHidden.value}
								onChange={() => {
									showHidden.value = !showHidden.value;
									if (columns.value.length > 0) {
										reloadAllColumns();
									}
								}}
								class='mr-2'
							/>
							Show Hidden Files
						</label>
					)}
				</div>
				{isExpanded.value && columns.value.length > 0 && (
					<div class='text-sm text-gray-500 dark:text-gray-400 px-2'>
						Current path:{' '}
						<span class='pl-2 font-bold font-mono'>{columns.value[columns.value.length - 1].path}</span>
					</div>
				)}
			</div>

			{isExpanded.value && (
				<div ref={scrollContainerRef} class='mt-3 overflow-x-auto flex-grow w-full'>
					<div
						class='flex space-x-0.5 bg-gray-50 dark:bg-gray-900 rounded-lg p-1'
						style='height: 300px; min-width: min-content;'
					>
						{error.value && (
							<div class='flex-none w-52 flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow-lg'>
								<div class='text-red-500 dark:text-red-400 px-4 text-center'>{error.value}</div>
							</div>
						)}
						{!error.value && columns.value.length === 0 && !loading.value && (
							<div class='flex-none w-52 flex items-center justify-center bg-white rounded-lg shadow'>
								<div class='text-gray-500 dark:text-gray-400'>Loading directory contents...</div>
							</div>
						)}
						{columns.value.map((column, index) => (
							<div
								key={`${column.path}-${index}`}
								class='flex-none w-52 flex flex-col bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700'
							>
								<div class='text-sm font-medium text-gray-600 dark:text-gray-300 px-2 py-1.5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-md z-10'>
									{column.path === rootPath ? 'Root' : column.path.split('/').pop()}
								</div>
								<div class='overflow-y-auto flex-grow' style='height: calc(400px - 2rem);'>
									{column.items.length === 0
										? <div class='px-2 py-1 text-gray-500 text-sm'>Empty directory</div>
										: (
											column.items.map((item) => (
												<div
													key={`${item.path}-${index}`}
													onClick={() => handleItemClick(item, index)}
													class={`
                          px-2 py-1 cursor-pointer text-sm flex items-center justify-between
                          ${
														item.isDirectory
															? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/50'
															: 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
													}
                          ${
														type === 'directory' && !item.isDirectory
															? 'opacity-50 cursor-not-allowed'
															: ''
													}
                          ${
														column.selected === item.path
															? 'bg-blue-100 dark:bg-blue-900/50'
															: ''
													}
                        `}
												>
													<div class='flex items-center flex-grow min-w-0'>
														<span class='truncate'>{item.name}</span>
													</div>
													{item.isDirectory && (
														<span class='text-gray-400 dark:text-gray-500 ml-2'>›</span>
													)}
												</div>
											))
										)}
								</div>
							</div>
						))}
						{loading.value && (
							<div class='flex-none w-52 flex items-center justify-center bg-white rounded-lg shadow'>
								<div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400'>
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
