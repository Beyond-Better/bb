import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact/compat';
import { dirname } from '@std/path';
import { LoadingSpinner } from './LoadingSpinner.tsx';
import { Action, InputStatusBar } from './InputStatusBar.tsx';
import { ChatStatus, isProcessing } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';
import { ApiClient } from '../utils/apiClient.utils.ts';
import { formatPathForInsertion, getTextPositions, processSuggestions } from '../utils/textHandling.utils.ts';
import { type DisplaySuggestion } from '../types/suggestions.types.ts';

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

interface ChatInputProps {
	apiClient: ApiClient;
	startDir: string;
	onCancelProcessing?: () => void;
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	textareaRef?: RefObject<ChatInputRef>;
	status: ChatStatus;
	disabled?: boolean;
	maxLength?: number;
}

enum TabState {
	INITIAL = 0, // No suggestions shown
	SUGGESTIONS = 1, // Suggestions shown (with or without selection)
}

const inputMaxCharLength = 5000;
const inputMaxScrollHeight = 350;

// Helper function to check if we should show suggestions
const shouldShowSuggestions = (text: string, forceShow: boolean = false): boolean => {
	// Show suggestions if forced by tab or if there's a path separator
	return forceShow || text.includes('/') || text.includes('\\') || text.startsWith('.');
};

export function ChatInput({
	apiClient,
	value,
	onChange,
	onSend,
	textareaRef: externalRef,
	status,
	disabled = false,
	maxLength = inputMaxCharLength,
	onCancelProcessing,
	startDir,
}: ChatInputProps) {
	const [suggestions, setSuggestions] = useState<DisplaySuggestion[]>([]);
	const [isShowingSuggestions, setIsShowingSuggestions] = useState(false);
	const [cursorPosition, setCursorPosition] = useState<number>(0);
	const [selectedIndex, setSelectedIndex] = useState<number>(-1);
	const [tabState, setTabState] = useState<TabState>(TabState.INITIAL);
	const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
	const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const internalRef = useRef<ChatInputRef | null>(null);
	const suggestionDebounceRef = useRef<number | null>(null);

	const fetchSuggestions = async (searchPath: string, forceShow: boolean = false) => {
		console.debug('ChatInput: fetchSuggestions called', { searchPath, tabState, forceShow });
		if (!apiClient) {
			console.error('ChatInput: API client not initialized');
			return;
		}

		// Handle empty input with tab press
		// Only use root path for initial empty tab press
		let effectivePath = searchPath;
		if (!effectivePath) {
			if (tabState === TabState.INITIAL && forceShow) {
				// Initial tab press on empty input - show root
				effectivePath = '/';
			} else if (tabState !== TabState.INITIAL) {
				// Typing after tab - treat as search term
				effectivePath = '';
			}
		}

		// Always show suggestions if forced or if we have a path separator
		const shouldShow = forceShow || shouldShowSuggestions(effectivePath);
		console.debug('ChatInput: Checking if should show suggestions', {
			effectivePath,
			forceShow,
			shouldShow,
			tabState,
		});

		if (!shouldShow) {
			setSuggestions([]);
			setIsShowingSuggestions(false);
			setTabState(TabState.INITIAL);
			return;
		}

		setIsLoadingSuggestions(true);
		setSuggestionsError(null);

		try {
			console.debug('ChatInput: Fetching suggestions', { effectivePath, startDir });
			const response = await apiClient.suggestFiles(effectivePath, startDir);
			if (!response) throw new Error('Failed to fetch suggestions');
			console.debug('ChatInput: Got suggestions response', { searchPath, suggestions: response.suggestions });

			// Process suggestions into display format
			const processedSuggestions = processSuggestions(response.suggestions);
			console.debug('ChatInput: Processed suggestions', processedSuggestions);

			// Update suggestions list
			console.debug('ChatInput: Setting suggestions', {
				searchPath,
				count: processedSuggestions.length,
				tabState,
				hasMore: response.hasMore,
				forceShow,
			});
			setSuggestions(processedSuggestions);
			setIsShowingSuggestions(processedSuggestions.length > 0);
		} catch (error) {
			const errorMessage = (error as Error).message || 'Failed to fetch suggestions';
			console.error('ChatInput: Error fetching suggestions:', error);
			setSuggestionsError(errorMessage);
			setSuggestions([]);
			setIsShowingSuggestions(false);
		} finally {
			setIsLoadingSuggestions(false);
		}
	};

	const debouncedFetchSuggestions = (searchPath: string, forceShow: boolean = false) => {
		console.debug('ChatInput: Debouncing suggestion fetch', { searchPath, forceShow, tabState });
		if (suggestionDebounceRef.current) {
			window.clearTimeout(suggestionDebounceRef.current);
		}
		// If we're in suggestions mode but have no search path, use root
		if (tabState === TabState.SUGGESTIONS && !searchPath) {
			searchPath = '/';
		}
		suggestionDebounceRef.current = window.setTimeout(() => {
			fetchSuggestions(searchPath, forceShow);
		}, 150); // 150ms debounce delay
	};

	const adjustTextareaHeight = () => {
		if (internalTextareaRef.current) {
			internalTextareaRef.current.style.height = 'auto';
			const newHeight = Math.min(internalTextareaRef.current.scrollHeight, inputMaxScrollHeight);
			internalTextareaRef.current.style.height = `${newHeight}px`;
		}
	};

	useEffect(() => {
		if (internalTextareaRef.current) {
			const ref: ChatInputRef = {
				textarea: internalTextareaRef.current,
				adjustHeight: adjustTextareaHeight,
			};
			internalRef.current = ref;
			if (externalRef) {
				externalRef.current = ref;
			}
		}
	}, [internalTextareaRef.current]);

	useEffect(() => {
		adjustTextareaHeight();
	}, [value]);

	// Cleanup debounce timer
	useEffect(() => {
		return () => {
			if (suggestionDebounceRef.current) {
				window.clearTimeout(suggestionDebounceRef.current);
			}
		};
	}, []);

	const handleInput = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		const newValue = target.value;
		const newPosition = target.selectionStart;
		console.debug('ChatInput: handleInput', { newValue, cursorPosition: newPosition });
		setCursorPosition(newPosition);
		onChange(newValue);

		// Reset selection when typing
		if (selectedIndex >= 0) {
			console.debug('ChatInput: Clearing selection due to typing');
			setSelectedIndex(-1);
			// Keep suggestions visible but clear selection
			if (tabState !== TabState.INITIAL) {
				setTabState(TabState.SUGGESTIONS);
			}
		}

		// Get current path context
		const pos = getTextPositions(newValue, newPosition);
		// Get the full current word/path
		const currentText = newValue.slice(pos.start, pos.end);

		console.debug('ChatInput: Processing input', {
			currentText,
			tabState,
			wordBoundaries: { start: pos.start, end: pos.end },
			cursorPosition: newPosition,
		});

		// Check if we should show suggestions
		if (currentText.includes('../') || currentText.includes('..\\')) {
			// Disable suggestions for relative paths
			console.debug('ChatInput: Relative path detected, hiding suggestions');
			setIsShowingSuggestions(false);
			setTabState(TabState.INITIAL);
		} else if (shouldShowSuggestions(currentText) || tabState === TabState.SUGGESTIONS) {
			// Show suggestions if we have a path separator or already showing suggestions
			if (tabState === TabState.INITIAL) {
				setTabState(TabState.SUGGESTIONS);
			}
			// If we're in a directory, append a slash to show its contents
			let searchPath = currentText;
			if (currentText.endsWith('/') || currentText.endsWith('\\')) {
				console.debug('ChatInput: Directory path detected, showing contents');
			} else if (!currentText && tabState === TabState.SUGGESTIONS) {
				// If backspaced to empty while suggestions are showing, use root
				searchPath = '/';
			}
			console.debug('ChatInput: Updating suggestions for', { searchPath, currentText, tabState });
			debouncedFetchSuggestions(searchPath, true);
		} else if (!currentText) {
			// Hide suggestions if no text
			setIsShowingSuggestions(false);
			setTabState(TabState.INITIAL);
		}
	};

	const handleKeyPress = async (e: KeyboardEvent) => {
		console.debug('ChatInput: handleKeyPress', { key: e.key, altKey: e.altKey, tabState });
		if (e.key === 'Tab') {
			e.preventDefault(); // Prevent default tab behavior immediately

			// Skip if alt is pressed
			if (e.altKey) return;

			// Log the current state
			console.debug('ChatInput: Tab key detected', {
				key: e.key,
				altKey: e.altKey,
				tabState,
				selectedIndex,
				hasSuggestions: suggestions.length > 0,
				isShowingSuggestions,
			});

			// Get current text at cursor
			const pos = getTextPositions(value, cursorPosition);
			const currentSearchText = value.slice(pos.start, pos.end);
			console.debug('ChatInput: Tab pressed', { currentSearchText, tabState, suggestions });

			// Handle tab based on current state
			switch (tabState) {
				case TabState.INITIAL:
					// First tab press - show suggestions
					console.debug('ChatInput: Initial tab with text:', currentSearchText);
					setTabState(TabState.SUGGESTIONS);

					// If we have text, use it as search, otherwise show root
					const searchPath = currentSearchText || '/';
					console.debug('ChatInput: Fetching suggestions for', searchPath);
					await fetchSuggestions(searchPath, true);

					// If we have suggestions and text, try to select best match
					if (suggestions.length > 0 && currentSearchText) {
						const matchIndex = suggestions.findIndex((s) =>
							s.display.toLowerCase().startsWith(currentSearchText.toLowerCase())
						);
						if (matchIndex >= 0) {
							console.debug('ChatInput: Found matching suggestion:', suggestions[matchIndex]);
							setSelectedIndex(matchIndex);
						}
					}
					break;

				case TabState.SUGGESTIONS:
					console.debug('ChatInput: Tab in SUGGESTIONS state', {
						selectedIndex,
						suggestionCount: suggestions.length,
						selectedItem: selectedIndex >= 0 ? suggestions[selectedIndex] : null,
						tabState,
					});

					// If we have suggestions and a selected item, handle tab completion
					if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
						const selected = suggestions[selectedIndex];
						console.debug('ChatInput: Tab completing selected item into search', selected);

						// Get current text positions
						const pos = getTextPositions(value, cursorPosition);
						// Replace only the search text portion
						const displayText = selected.isDirectory ? selected.path + '/' : selected.display;
						const newText = pos.beforeText + displayText + pos.afterText;

						// Update the input text but keep suggestions open
						onChange(newText);
						// Move cursor to end of inserted text
						setTimeout(() => {
							if (internalTextareaRef.current) {
								const newPos = pos.beforeText.length + displayText.length;
								internalTextareaRef.current.setSelectionRange(newPos, newPos);
							}
						}, 0);
						return;
					}

					// No selection or no suggestions - select first item if available
					if (suggestions.length > 0) {
						console.debug('ChatInput: Selecting first suggestion');
						setSelectedIndex(0);
					}
					break;
			}
			return;
		}

		if (isShowingSuggestions && suggestions.length > 0) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				const newIndex = e.key === 'ArrowDown'
					? (selectedIndex + 1) % suggestions.length
					: selectedIndex <= 0
					? suggestions.length - 1
					: selectedIndex - 1;
				console.debug(`ChatInput: ${e.key} pressed, selecting suggestion`, { newIndex, tabState });
				setSelectedIndex(newIndex);
				setTabState(TabState.SUGGESTIONS);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const newIndex = selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1;
				console.debug('ChatInput: Arrow up, selecting previous suggestion', { newIndex, tabState });
				setSelectedIndex(newIndex);
				// Ensure we stay in SUGGESTIONS state
				if (tabState !== TabState.SUGGESTIONS) {
					setTabState(TabState.SUGGESTIONS);
				}
				return;
			}
			if (e.key === 'Enter' && selectedIndex >= 0) {
				e.preventDefault();
				const selected = suggestions[selectedIndex];
				console.debug('ChatInput: Enter pressed on suggestion', selected);
				if (selected.isDirectory) {
					// For directories: complete and show contents
					applySuggestion(selected, true, true);
					// Reset selection and fetch directory contents
					setSelectedIndex(-1);
					fetchSuggestions(selected.path + '/', true);
				} else {
					// For files: apply and close
					applySuggestion(selected, false, false);
					setTabState(TabState.INITIAL);
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				console.debug('ChatInput: Escape pressed, hiding suggestions');
				setIsShowingSuggestions(false);
				setTabState(TabState.INITIAL);
				return;
			}
		}

		if (e.key === 'Enter' && e.shiftKey && !disabled && !status.isLoading && !isProcessing(status)) {
			e.preventDefault();
			onSend();
		}
	};

	const applySuggestion = (
		suggestion: DisplaySuggestion,
		keepOpen: boolean = false,
		isNavigating: boolean = false,
	) => {
		console.debug('ChatInput: Applying suggestion', { suggestion, keepOpen, isNavigating, tabState });
		let newText: string;
		if (isNavigating) {
			// During navigation, just use the raw path
			const pos = getTextPositions(value, cursorPosition);
			// Use full path for directories to maintain context
			const displayPath = suggestion.isDirectory ? suggestion.path + '/' : suggestion.display;
			// Replace only the current word
			newText = pos.beforeText + displayPath + pos.afterText;

			// Calculate new cursor position after the inserted text
			const newCursorPos = pos.beforeText.length + displayPath.length;

			console.debug('ChatInput: Navigation text replacement', {
				pos,
				displayPath,
				newText,
				newCursorPos,
				isDirectory: suggestion.isDirectory,
			});

			// Update cursor position after React updates the input value
			setTimeout(() => {
				if (internalTextareaRef.current) {
					internalTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
				}
			}, 0);
		} else {
			// Final selection - use full formatting
			const pos = getTextPositions(value, cursorPosition);
			console.debug('ChatInput: Text positions for final selection', pos);
			newText = formatPathForInsertion(suggestion.path, pos);
			// For final selection, place cursor at end of the line
			setTimeout(() => {
				if (internalTextareaRef.current) {
					const lines = newText.split('\n');
					const lastLine = lines[lines.length - 1];
					const newPos: number = newText.length;
					internalTextareaRef.current.setSelectionRange(newPos, newPos);
				}
			}, 0);
		}
		console.debug('ChatInput: Formatted text for insertion', { newText });
		onChange(newText);

		if (!keepOpen) {
			// Close suggestions for files or when explicitly closing
			setIsShowingSuggestions(false);
			setTabState(TabState.INITIAL);
		} else if (suggestion.isDirectory) {
			// For directories, immediately show their contents
			console.debug('ChatInput: Showing directory contents');
			setSelectedIndex(-1);
			setTabState(TabState.SUGGESTIONS);
			// Use the full path to fetch directory contents
			fetchSuggestions(suggestion.path + '/', true);
		} else {
			// For files with keepOpen, just update suggestions
			setSelectedIndex(-1);
			const pos = getTextPositions(newText, newText.length);
			const currentText = newText.slice(pos.start, pos.end);
			debouncedFetchSuggestions(currentText, true);
		}
	};

	// Determine status message and type
	const getStatusInfo = () => {
		// Check critical states first
		if (!status.isReady) {
			return {
				message: 'Connecting to server...',
				type: 'warning' as const,
				visible: true,
				status: ApiStatus.IDLE,
			};
		}

		if (status.isLoading) {
			return {
				message: 'Sending message...',
				type: 'info' as const,
				visible: true,
				status: ApiStatus.API_BUSY,
			};
		}

		if (disabled) {
			return {
				message: 'Chat is currently unavailable',
				type: 'error' as const,
				visible: true,
				status: ApiStatus.ERROR,
			};
		}

		// Then handle specific API states
		switch (status.apiStatus) {
			case ApiStatus.LLM_PROCESSING:
				return {
					message: 'Claude is thinking...',
					type: 'info' as const,
					status: status.apiStatus,
					visible: true,
					action: onCancelProcessing
						? {
							label: 'Stop',
							onClick: onCancelProcessing,
							variant: 'danger',
						}
						: undefined,
				};

			case ApiStatus.TOOL_HANDLING:
				return {
					message: `Using tool: ${status.toolName || 'unknown'}`,
					type: 'info' as const,
					visible: true,
					status: status.apiStatus,
					action: onCancelProcessing
						? {
							label: 'Stop',
							onClick: onCancelProcessing,
							variant: 'danger',
						}
						: undefined,
				};

			case ApiStatus.API_BUSY:
				return {
					message: 'API is processing...',
					type: 'info' as const,
					visible: true,
					status: status.apiStatus,
				};

			case ApiStatus.ERROR:
				return {
					message: 'An error occurred',
					type: 'error' as const,
					visible: true,
					status: status.apiStatus,
				};

			case ApiStatus.IDLE:
			default:
				return {
					message: '',
					type: 'info' as const,
					visible: false,
					status: ApiStatus.IDLE,
				};
		}
	};

	const statusInfo = getStatusInfo();

	return (
		<div className='bg-white px-4 py-2'>
			<InputStatusBar
				visible={statusInfo.visible}
				message={statusInfo.message}
				status={statusInfo.status || ApiStatus.IDLE}
				action={statusInfo.action as Action}
				className='mx-1'
			/>

			<div className='flex items-end space-x-3'>
				<div className='flex-grow relative'>
					<textarea
						ref={internalTextareaRef}
						value={value}
						onInput={handleInput}
						onKeyDown={handleKeyPress}
						className={`w-full px-3 py-2 border rounded-md resize-none overflow-y-auto 
						  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
						  transition-all duration-200 max-h-[200px]
						  ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
						  ${isProcessing(status) ? 'border-blue-200 bg-white' : ''}`}
						placeholder={isProcessing(status)
							? 'Type your message... (Statement in progress)'
							: 'Type your message... (Enter for new line, Shift + Enter to send, Tab for file suggestions)'}
						rows={1}
						maxLength={maxLength}
						disabled={disabled}
						aria-label='Message input'
						aria-expanded={isShowingSuggestions}
						aria-haspopup='listbox'
						aria-controls={isShowingSuggestions ? 'suggestions-list' : undefined}
						aria-activedescendant={selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined}
					/>

					{(isShowingSuggestions || isLoadingSuggestions || suggestionsError) && (
						<div
							className='absolute z-10 w-full bg-white shadow-lg rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm bottom-full mb-1'
							style={{ maxHeight: 'min(300px, calc(100vh - 120px))' }}
						>
							{isLoadingSuggestions && (
								<div className='flex items-center justify-center py-4'>
									<LoadingSpinner size='small' color='text-blue-500' />
									<span className='ml-2 text-gray-600'>Loading suggestions...</span>
								</div>
							)}

							{suggestionsError && (
								<div className='text-red-500 p-3 text-sm'>
									Error: {suggestionsError}
								</div>
							)}

							{!isLoadingSuggestions && !suggestionsError && suggestions.length > 0 && (
								<ul
									id='suggestions-list'
									role='listbox'
								>
									{suggestions.map((suggestion, index) => (
										<li
											id={`suggestion-${index}`}
											key={suggestion.path}
											role='option'
											aria-selected={index === selectedIndex}
											className={`cursor-pointer py-2 pl-3 pr-9 ${
												index === selectedIndex
													? 'bg-blue-600 text-white'
													: 'text-gray-900 hover:bg-blue-600 hover:text-white'
											}`}
											onClick={() => {
												if (suggestion.isDirectory) {
													// For directories: complete and show contents
													applySuggestion(suggestion, true, true);
													// Reset selection and fetch directory contents
													setSelectedIndex(-1);
													fetchSuggestions(suggestion.path + '/', true);
												} else {
													// For files: apply and close
													applySuggestion(suggestion, false, false);
													setTabState(TabState.INITIAL);
												}
											}}
										>
											<div className='flex items-center'>
												<span className='truncate'>
													{suggestion.display}
													{suggestion.isDirectory && '/'}
												</span>
												<span
													className={`ml-2 truncate text-sm ${
														index === selectedIndex ? 'text-blue-200' : 'text-gray-500'
													}`}
												>
													({suggestion.parent})
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					)}

					<div className='absolute bottom-2 right-2 flex items-center space-x-2'>
						<span
							className={`text-xs ${value.length > maxLength * 0.9 ? 'text-red-500' : 'text-gray-400'}`}
						>
							{value.length} / {maxLength}
						</span>
					</div>
				</div>
				<button
					onClick={onSend}
					className={`px-4 py-2 mb-1 rounded-md transition-colors 
						focus:outline-none focus:ring-2 focus:ring-blue-500 
						focus:ring-opacity-50 min-w-[60px] ml-2
						${
						isProcessing(status)
							? 'bg-gray-100 text-gray-400 cursor-not-allowed'
							: disabled
							? 'bg-gray-300 cursor-not-allowed'
							: 'bg-blue-500 text-white hover:bg-blue-600'
					}`}
					disabled={status.isLoading || disabled || isProcessing(status)}
					aria-label={status.isLoading ? 'Sending message...' : 'Send message'}
				>
					{status.isLoading ? <LoadingSpinner size='small' color='text-white' /> : 'Send'}
				</button>
			</div>
		</div>
	);
}
