import { useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { AppState } from '../hooks/useAppState.ts';
import type { FileSuggestionsResponse } from 'api/utils/fileSuggestions.ts';
import { ColumnFileBrowser } from './ColumnFileBrowser.tsx';

interface FileBrowserProps {
	value: string;
	onChange: (path: string) => void;
	type: 'file' | 'directory';
	className?: string;
	rootPath?: string;
	appState: Signal<AppState>;
	viewMode?: 'column' | 'dropdown';
	defaultExpanded?: boolean;
	onSelectionValid?: (isValid: boolean, selectedPath?: string) => void;
	alwaysShowPath?: boolean;
	helpText?: string;
}

export function FileBrowser({
	value,
	onChange,
	type,
	className = '',
	rootPath = '.',
	appState,
	viewMode = 'column',
	defaultExpanded,
	onSelectionValid,
	alwaysShowPath,
	helpText,
}: FileBrowserProps) {
	// If using column view, render the ColumnFileBrowser
	if (viewMode === 'column') {
		//console.log('FileBrowser: rendering ColumnFileBrowser with props:', {
		//	value,
		//	rootPath,
		//	type,
		//	defaultExpanded,
		//});
		return (
			<ColumnFileBrowser
				value={value}
				onChange={onChange}
				type={type}
				className={className}
				rootPath={rootPath}
				appState={appState}
				defaultExpanded={defaultExpanded}
				onSelectionValid={onSelectionValid}
				alwaysShowPath={alwaysShowPath}
				helpText={helpText}
			/>
		);
	}

	// Below is the original dropdown implementation
	const inputValue = useSignal(value);
	const suggestions = useSignal<FileSuggestionsResponse['suggestions']>([]);
	const showSuggestions = useSignal(false);
	const loading = useSignal(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const suggestionsRef = useRef<HTMLDivElement>(null);

	// Filter suggestions based on type
	const filteredSuggestions = useComputed(() =>
		suggestions.value.filter((s) => type === 'directory' ? s.isDirectory : !s.isDirectory)
	);

	useEffect(() => {
		// Update input value when prop changes
		inputValue.value = value;
	}, [value]);

	useEffect(() => {
		// Handle clicks outside the component to close suggestions
		function handleClickOutside(event: MouseEvent) {
			if (
				inputRef.current &&
				!inputRef.current.contains(event.target as Node) &&
				suggestionsRef.current &&
				!suggestionsRef.current.contains(event.target as Node)
			) {
				showSuggestions.value = false;
			}
		}

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	const fetchSuggestions = async (path: string) => {
		if (!path) {
			suggestions.value = [];
			return;
		}
		loading.value = true;
		try {
			const apiClient = appState.value.apiClient;
			const response = await apiClient?.suggestFilesForPath(path, rootPath, { type });
			if (response) {
				suggestions.value = response.suggestions;
			}
		} catch (error) {
			console.error('Error fetching suggestions:', error);
			suggestions.value = [];
		} finally {
			loading.value = false;
		}
	};

	const handleInput = async (e: Event) => {
		const target = e.target as HTMLInputElement;
		const newValue = target.value;
		inputValue.value = newValue;
		showSuggestions.value = true;
		await fetchSuggestions(newValue);
	};

	const handleSuggestionClick = (path: string) => {
		inputValue.value = path;
		onChange(path);
		showSuggestions.value = false;
	};

	return (
		<div class={`file-browser relative ${className}`}>
			<div class='flex items-center'>
				<input
					ref={inputRef}
					type='text'
					value={inputValue.value}
					onInput={handleInput}
					onFocus={() => showSuggestions.value = true}
					placeholder={`Select ${type}...`}
					class='w-full px-3 py-2 border dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
				/>
				{loading.value && (
					<div class='absolute right-3 top-1/2 transform -translate-y-1/2'>
						<div class='animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 dark:border-blue-400'>
						</div>
					</div>
				)}
			</div>

			{showSuggestions.value && filteredSuggestions.value.length > 0 && (
				<div
					ref={suggestionsRef}
					class='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto'
				>
					{filteredSuggestions.value.map((suggestion) => (
						<div
							key={suggestion.path}
							onClick={() => handleSuggestionClick(suggestion.path)}
							class='px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center'
						>
							<span class={suggestion.isDirectory ? 'text-blue-600' : ''}>
								{suggestion.path}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
