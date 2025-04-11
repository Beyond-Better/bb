import { useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { AppState } from '../hooks/useAppState.ts';
import { formatPathForDisplay } from '../utils/path.utils.ts';

interface DirectoryItem {
	name: string;
	path: string;
	isDirectory: boolean;
}

interface Column {
	path: string;
	items: DirectoryItem[];
	selected?: string;
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
	alwaysShowPath?: boolean;
	helpText?: string;
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
	alwaysShowPath,
	helpText,
}: ColumnFileBrowserProps) {
	// Core state
	const columns = useSignal<Column[]>([]);
	const isExpanded = useSignal(defaultExpanded);
	const showHidden = useSignal(false);
	const loading = useSignal(false);
	const error = useSignal<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Scroll selected items into view
	const scrollSelectedItemsIntoView = async () => {
		// Wait for columns to be rendered
		await new Promise((resolve) => setTimeout(resolve, 100));
		if (columns.value.length > 0) {
			//console.log('ColumnFileBrowser: Scrolling selected items into view');
			const columnElements = containerRef.current?.querySelectorAll('.column-container');
			if (columnElements?.length) {
				// First scroll selected items into view vertically
				columnElements.forEach((column, _index) => {
					//console.log('ColumnFileBrowser: Checking column', index, 'for selected items');
					//const selectedItems = column.querySelectorAll('.bg-blue-100');
					//console.log('ColumnFileBrowser: Found', selectedItems.length, 'selected items');
					const selected = column.querySelector('.bg-blue-100');
					if (selected) {
						selected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
					}
				});

				// Then always scroll the last column into view horizontally
				columnElements[columnElements.length - 1].scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
					inline: 'end',
				});
			}
		}
	};

	// Keep old function for compatibility
	const scrollLastColumnIntoView = () => {
		if (columns.value.length > 0) {
			const columnElements = containerRef.current?.querySelectorAll('.column-container');
			if (columnElements?.length) {
				columnElements[columnElements.length - 1].scrollIntoView({
					behavior: 'smooth',
					block: 'nearest',
					inline: 'end',
				});
			}
		}
	};

	// Split a path into components
	const splitPath = (path: string): string[] => {
		if (!path || path === '.' || path === './') return [];
		return path.split(/[\\\/]/).filter(Boolean);
	};

	// Load directory contents
	const loadDirectory = async (path: string) => {
		// Add delay to help with debugging
		//await new Promise(resolve => setTimeout(resolve, 500));
		loading.value = true;
		error.value = null;

		try {
			const response = await appState.value.apiClient?.listDirectory(path, {
				only: type === 'directory' ? 'directories' : undefined,
				includeHidden: showHidden.value,
			});

			if (!response) {
				throw new Error('No response from directory listing');
			}

			if (response.errorMessage) {
				throw new Error(response.errorMessage);
			}

			return response.items || [];
		} catch (e) {
			error.value = e instanceof Error ? e.message : 'Failed to load directory';
			return [];
		} finally {
			loading.value = false;
		}
	};

	// Handle initial load and value changes
	useEffect(() => {
		// Always initialize if alwaysShowPath is true, otherwise only when expanded
		if (!isExpanded.value && !alwaysShowPath) return;

		const initializeBrowser = async () => {
			//console.log('ColumnFileBrowser: Initializing browser:', { rootPath, value });
			// Always start with root
			const rootItems = await loadDirectory(rootPath);
			const pathComponents = splitPath(value);
			//console.log('ColumnFileBrowser: Creating columns with pathComponents:', pathComponents);

			// Get existing selections from current columns
			//const existingSelections = new Map(columns.value.map((col) => [col.path, col.selected]));

			// Initialize with root column
			const newColumns: Column[] = [{
				path: rootPath,
				items: rootItems,
				// First column should show first path component
				selected: pathComponents[0],
			}];

			// Load each path component
			for (let i = 0; i < pathComponents.length; i++) {
				// Build full path from root
				const pathPart = pathComponents.slice(0, i + 1).join('/');
				const path = rootPath === '.' ? pathPart : `${rootPath}/${pathPart}`;
				//console.log('ColumnFileBrowser: Loading path component:', { rootPath, pathPart, path, index: i });
				const items = await loadDirectory(path);

				//console.log('ColumnFileBrowser: Adding column:', { path, selected: pathComponents[i], index: i });
				// Each column should select its own path component, except the last one
				newColumns.push({
					path,
					items,
					selected: i < pathComponents.length - 1 ? pathComponents[i + 1] : undefined,
				});
			}

			//console.log('ColumnFileBrowser: Final columns:', newColumns.map((c) => ({ path: c.path, selected: c.selected })));
			columns.value = newColumns;
			// Don't call updateSelectionValidity during initial load
			await scrollSelectedItemsIntoView();
		};

		initializeBrowser();
	}, [value, isExpanded.value]);

	// Handle directory selection
	const handleItemClick = async (item: DirectoryItem, columnIndex: number) => {
		if (type === 'directory' && !item.isDirectory) return;
		if (columns.value[columnIndex].selected === item.path) return;

		const newColumns = [...columns.value];

		// Update selection in clicked column
		newColumns[columnIndex] = {
			...newColumns[columnIndex],
			selected: item.name,
		};

		// Store the selection for persistence
		//const selectedName = item.name;

		// Update columns first
		columns.value = newColumns;

		if (item.isDirectory) {
			// Build full path from parent directories
			const parentPath = columns.value[columnIndex].path;
			const fullPath = parentPath === '.' ? item.name : `${parentPath}/${item.name}`;
			// console.log('ColumnFileBrowser: Path building:', {
			// 	columnIndex,
			// 	parentPath,
			// 	itemPath: item.path,
			// 	itemName: item.name,
			// 	fullPath,
			// });

			// Load items for new column
			const items = await loadDirectory(fullPath);

			// Remove subsequent columns and add new one
			newColumns.length = columnIndex + 1;
			newColumns.push({
				path: fullPath,
				items,
				selected: undefined, // Last column should not have a selection
			});

			// Update columns first, then trigger change
			columns.value = newColumns;
			onChange(fullPath);
			scrollLastColumnIntoView();
		} else {
			// Build full path for file selection
			const parentPath = columns.value[columnIndex].path;
			const fullPath = parentPath === '.' ? item.name : `${parentPath}/${item.name}`;
			// console.log('ColumnFileBrowser: File selection:', {
			// 	columnIndex,
			// 	parentPath,
			// 	itemPath: item.path,
			// 	itemName: item.name,
			// 	fullPath,
			// });

			columns.value = newColumns;
			onChange(fullPath);
		}

		updateSelectionValidity();
	};

	// Handle show/hide hidden files
	const reloadAllColumns = async () => {
		const newColumns: Column[] = [];

		for (const column of columns.value) {
			const items = await loadDirectory(column.path);
			newColumns.push({
				...column,
				items,
			});
		}

		columns.value = newColumns;
		updateSelectionValidity();
	};

	// Update selection validity
	const updateSelectionValidity = () => {
		if (!onSelectionValid) return;

		const lastColumn = columns.value[columns.value.length - 1];
		const secondLastColumn = columns.value[columns.value.length - 2];

		if (lastColumn?.selected) {
			const fullPath = lastColumn.path === '.'
				? lastColumn.selected
				: `${lastColumn.path}/${lastColumn.selected}`;
			onSelectionValid(true, fullPath);
		} else if (secondLastColumn?.selected) {
			const fullPath = secondLastColumn.path === '.'
				? secondLastColumn.selected
				: `${secondLastColumn.path}/${secondLastColumn.selected}`;
			onSelectionValid(true, fullPath);
		} else {
			onSelectionValid(false);
		}
	};

	return (
		<div
			class={`column-file-browser flex flex-col flex-grow ${className}`}
			style='width: 100%;'
		>
			{(alwaysShowPath || isExpanded.value) && columns.value.length > 0 && (
				<div class='ml-3 mb-2 text-lg text-gray-500 dark:text-gray-400 flex items-center'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={1.5}
						stroke='currentColor'
						class='w-4 h-4'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
						/>
					</svg>
					<span class='mx-1'>/</span>
					{columns.value[columns.value.length - 1].path !== '.' &&
						(
							<>
								<span class='font-bold font-mono'>
									{formatPathForDisplay(
										columns.value[columns.value.length - 1].path,
										appState.value.systemMeta?.pathSeparator,
									)}
								</span>
							</>
						)}
				</div>
			)}
			<div class='space-y-2'>
				<div class='flex items-center justify-between'>
					<button
						type='button'
						onClick={() => isExpanded.value = !isExpanded.value}
						class='flex items-center ml-2 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm'
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
						{isExpanded.value ? 'Collapse Browser' : 'Show Browser'}
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
			</div>

			{isExpanded.value && (
				<>
					{helpText && (
						<div class='mt-2 mb-1 ml-3 text-sm text-gray-600 dark:text-gray-400'>
							{helpText}
						</div>
					)}
					<div ref={containerRef} class='mt-3 overflow-x-auto flex-grow w-full'>
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
									{/* <div class='text-gray-500 dark:text-gray-400'>Loading directory contents...</div> */}
									<div class='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 dark:border-blue-400'>
									</div>
								</div>
							)}
							{columns.value.map((column, index) => (
								<div
									key={`${column.path}-${index}`}
									class='column-container flex-none w-52 flex flex-col bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700'
								>
									<div
										class='text-sm font-medium text-gray-600 dark:text-gray-300 px-2 py-1.5 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-md z-10 flex items-center'
										title={column.path}
									>
										{column.path === rootPath
											? (
												<>
													<svg
														xmlns='http://www.w3.org/2000/svg'
														fill='none'
														viewBox='0 0 24 24'
														strokeWidth={1.5}
														stroke='currentColor'
														className='w-4 h-4 mr-1'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															d='M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25'
														/>
													</svg>
													<span>Home</span>
												</>
											)
											: <span className='truncate'>{column.path.split('/').pop()}</span>}
									</div>
									<div class='overflow-y-auto flex-grow' style='height: calc(400px - 2rem);'>
										{column.items.length === 0
											? <div class='px-2 py-1 text-gray-500 text-sm'>Empty directory</div>
											: (
												column.items.map((item) => (
													<div
														key={item.path}
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
															column.selected === item.name
																? 'bg-blue-100 dark:bg-blue-900/50 selected-item'
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
				</>
			)}
		</div>
	);
}
