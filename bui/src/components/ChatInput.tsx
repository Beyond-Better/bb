import { useEffect, useRef } from 'preact/hooks';
import { batch, signal } from '@preact/signals';
import type { RefObject } from 'preact/compat';
import { LoadingSpinner } from './LoadingSpinner.tsx';
import { Action, InputStatusBar } from './InputStatusBar.tsx';
import { ChatStatus, isProcessing } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';
import { ApiClient } from '../utils/apiClient.utils.ts';
//import { formatPathForInsertion, getTextPositions, processSuggestions } from '../utils/textHandling.utils.ts';
//import { type DisplaySuggestion } from '../types/suggestions.types.ts';
import { useChatInputHistory } from '../hooks/useChatInputHistory.ts';
import { ChatHistoryDropdown } from './ChatHistoryDropdown.tsx';

// Constants
const INPUT_DEBOUNCE = 16; // One frame at 60fps
const SAVE_DEBOUNCE = 1000; // 1 second
//const SUGGESTION_DEBOUNCE = 150;
const ERROR_DISPLAY_TIME = 10000; // 10 seconds for error messages with recovery options
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

interface ErrorState {
	message: string;
	timestamp: number;
	recoveryAction?: () => void;
	recoveryMessage?: string;
}

interface ChatInputProps {
	apiClient: ApiClient;
	projectId: string;
	onCancelProcessing?: () => void;
	value: string;
	onChange: (value: string) => void;
	onSend: () => void;
	textareaRef?: RefObject<ChatInputRef>;
	status: ChatStatus;
	disabled?: boolean;
	maxLength?: number;
	conversationId: string | null;
}

// Signal-based state
const errorState = signal<ErrorState | null>(null);
const inputMetrics = signal({
	lastUpdateTime: 0,
	updateCount: 0,
	slowUpdates: 0,
});
const conversationIdSignal = signal<string | null>(null);

export function ChatInput({
	//apiClient,
	value,
	onChange,
	onSend,
	textareaRef: _externalRef,
	status,
	disabled = false,
	maxLength = 25000,
	onCancelProcessing,
	//projectId,
	conversationId,
}: ChatInputProps) {
	// Refs for debouncing
	const inputDebounceRef = useRef<number | null>(null);
	const saveDebounceRef = useRef<number | null>(null);
	const suggestionDebounceRef = useRef<number | null>(null);
	const errorTimeoutRef = useRef<number | null>(null);
	const isInitialMount = useRef(true);

	const {
		history,
		pinnedEntries,
		recentEntries,
		isDropdownOpen,
		addToHistory,
		togglePin,
		saveCurrentInput,
		getSavedInput,
		clearCurrentInput,
	} = useChatInputHistory(conversationIdSignal);

	// Initialize conversation ID signal and handle saved input
	useEffect(() => {
		// Skip if no conversation ID
		if (!conversationId) {
			console.info('ChatInput: No conversation ID to initialize');
			return;
		}

		// Update signal immediately
		conversationIdSignal.value = conversationId;

		// Check for saved input
		const saved = getSavedInput();
		if (saved && !value) {
			console.info('ChatInput: Found saved input to restore', {
				savedLength: saved.length,
			});
			onChange(saved);
		}
	}, [conversationId, value, onChange]);

	// Handle initial mount
	useEffect(() => {
		if (!isInitialMount.current) return;

		console.info('ChatInput: Initial mount', {
			conversationId,
			hasValue: !!value,
		});

		isInitialMount.current = false;
	}, [conversationId, value]);

	// Safe operation wrapper with rate limit handling
	const safeOperation = async (operation: () => Promise<void> | void, errorMessage: string) => {
		let retryCount = 0;

		const executeWithRetry = async () => {
			try {
				await operation();
			} catch (e) {
				const error = e as Error;
				// Check for rate limit error
				if (error.message?.includes('rate limit') && retryCount < MAX_RETRIES) {
					console.warn('ChatInput: Rate limit hit, retrying...', { retryCount });
					retryCount++;
					await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY * retryCount));
					return executeWithRetry();
				}
				throw error;
			}
		};

		try {
			await executeWithRetry();
		} catch (e) {
			console.error('ChatInput: Operation failed:', e);
			errorState.value = {
				message: errorMessage,
				timestamp: Date.now(),
				recoveryAction: () => executeWithRetry(),
				recoveryMessage: 'Retry',
			};

			// Don't auto-dismiss errors that have recovery actions
			if (!errorState.value.recoveryAction && errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current);
				errorTimeoutRef.current = setTimeout(() => {
					errorState.value = null;
				}, ERROR_DISPLAY_TIME);
			}
		}
	};

	// Input handling with performance tracking and error recovery
	const handleInput = (e: Event) => {
		if (!conversationId) {
			console.info('ChatInput: No conversation ID, input will not be saved');
		}
		const startTime = performance.now();
		const target = e.target as HTMLTextAreaElement;
		const newValue = target.value;

		// Debounce input updates
		if (inputDebounceRef.current) {
			clearTimeout(inputDebounceRef.current);
		}

		inputDebounceRef.current = setTimeout(() => {
			try {
				batch(() => {
					onChange(newValue);

					// Track performance
					const duration = performance.now() - startTime;
					if (duration > 50) {
						console.warn('ChatInput: Slow input update:', duration.toFixed(2), 'ms');
						inputMetrics.value = {
							...inputMetrics.value,
							slowUpdates: inputMetrics.value.slowUpdates + 1,
						};
					}
				});
			} catch (e) {
				console.error('ChatInput: Failed to process input:', e);
				errorState.value = {
					message: 'Failed to process input. Your text has been saved.',
					timestamp: Date.now(),
					recoveryMessage: 'Click to restore',
					recoveryAction: () => {
						if (newValue) {
							onChange(newValue);
						}
					},
				};
				// Preserve input in case of error
				safeOperation(
					() => saveCurrentInput(newValue),
					'Failed to save input',
				);
			}
		}, INPUT_DEBOUNCE);

		// Handle auto-save
		const handleAutoSave = () => {
			if (!conversationId) {
				console.info('ChatInput: No conversation ID for auto-save');
				return;
			}

			// Don't save empty input
			if (!newValue.trim()) {
				console.info('ChatInput: Empty input, skipping auto-save');
				clearCurrentInput();
				return;
			}

			console.info('ChatInput: Auto-save triggered', {
				hasValue: !!newValue.trim(),
				length: newValue.length,
				conversationId,
			});

			safeOperation(
				() => saveCurrentInput(newValue),
				'Failed to save input',
			);
		};

		// Debounce auto-save
		if (saveDebounceRef.current) {
			clearTimeout(saveDebounceRef.current);
		}

		saveDebounceRef.current = setTimeout(handleAutoSave, SAVE_DEBOUNCE);
	};

	// Handle message sending
	const handleSend = () => {
		const currentValue = value;
		console.info('ChatInput: Sending message', {
			hasValue: !!value.trim(),
			length: value.length,
			conversationId,
		});

		// Validate input before sending
		if (!currentValue.trim()) {
			console.info('ChatInput: Nothing to send');
			return;
		}

		safeOperation(
			async () => {
				try {
					// Add to history and clear auto-save
					console.info('ChatInput: Message sent successfully, clearing auto-save');
					addToHistory(currentValue);
					clearCurrentInput();
					await onSend();
				} catch (e) {
					console.error('ChatInput: Send failed:', e);
					errorState.value = {
						message: 'Failed to send message. Your text has been preserved.',
						timestamp: Date.now(),
						recoveryMessage: 'Try again',
						recoveryAction: () => handleSend(),
					};
					// On error, ensure input is saved
					console.info('ChatInput: Send failed, ensuring input is saved');
					await saveCurrentInput(currentValue);
					throw e;
				}
			},
			'Failed to send message',
		);
	};

	// Key press handling
	const handleKeyPress = (e: KeyboardEvent) => {
		// Prevent help dialog from intercepting question mark
		if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
			e.stopPropagation();
		}

		if (
			((e.key === 'Enter' && (e.metaKey || e.ctrlKey)) || (e.code === 'NumpadEnter')) &&
			!disabled &&
			!status.isLoading &&
			!isProcessing(status)
		) {
			e.preventDefault();
			handleSend();
		}
	};

	// Cleanup
	useEffect(() => {
		return () => {
			[inputDebounceRef, saveDebounceRef, suggestionDebounceRef, errorTimeoutRef].forEach((ref) => {
				if (ref.current) {
					clearTimeout(ref.current);
				}
			});
		};
	}, []);

	// Status info
	const getStatusInfo = () => {
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
		<div className='bg-white dark:bg-gray-900 px-4 py-2 w-full'>
			<InputStatusBar
				visible={statusInfo.visible}
				message={statusInfo.message}
				status={statusInfo.status || ApiStatus.IDLE}
				action={statusInfo.action as Action}
				className='mx-1'
			/>

			{errorState.value && (
				<div className='text-sm text-red-500 dark:text-red-400 mb-2 flex items-center justify-between'>
					<span>{errorState.value.message}</span>
					<div className='flex items-center'>
						{errorState.value.recoveryAction && (
							<button
								onClick={() => {
									errorState.value?.recoveryAction?.();
									errorState.value = null;
								}}
								className='ml-4 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
							>
								{errorState.value.recoveryMessage || 'Retry'}
							</button>
						)}
						<button
							onClick={() => errorState.value = null}
							className='ml-4 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200'
							title='Dismiss'
						>
							✕
						</button>
					</div>
				</div>
			)}

			<div className='flex items-end space-x-3'>
				<div className='flex-grow relative'>
					<textarea
						value={value}
						onInput={handleInput}
						onKeyDown={handleKeyPress}
						className={`w-full px-3 py-2 pr-14 border dark:border-gray-700 rounded-md resize-none overflow-y-auto 
              dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 
              dark:focus:ring-blue-400 focus:border-transparent transition-all duration-200
              ${disabled ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
              ${isProcessing(status) ? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800' : ''}`}
						placeholder={isProcessing(status)
							? 'Type your message... (Statement in progress)'
							: 'Type your message... (Enter for new line, Cmd/Ctrl + Enter to send)'}
						rows={1}
						maxLength={maxLength}
						disabled={disabled}
					/>

					<ChatHistoryDropdown
						pinnedEntries={pinnedEntries}
						recentEntries={recentEntries}
						isOpen={isDropdownOpen}
						onSelect={(value) => {
							console.info('ChatInput: History entry selected', { valueLength: value.length });
							onChange(value);
							isDropdownOpen.value = false;
						}}
						onTogglePin={togglePin}
					/>

					<div className='absolute bottom-1.5 right-2.5 flex flex-col items-end space-y-1'>
						<button
							onClick={() => {
								const newValue = !isDropdownOpen.value;
								console.info('ChatInput: History toggled', {
									wasOpen: isDropdownOpen.value,
									nowOpen: newValue,
									hasHistory: history.value.length > 0,
									pinnedCount: pinnedEntries.value.length,
									recentCount: recentEntries.value.length,
								});
								isDropdownOpen.value = newValue;
							}}
							className='p-0.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
							title='Show history'
						>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
								/>
							</svg>
						</button>
						<span
							className={`text-xs ${
								value.length > maxLength * 0.9
									? 'text-red-500 dark:text-red-400'
									: 'text-gray-400 dark:text-gray-500'
							}`}
						>
							{value.length} / {maxLength}
						</span>
					</div>
				</div>

				<button
					onClick={handleSend}
					className={`px-4 py-2 mb-1 rounded-md transition-colors focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:ring-opacity-50 min-w-[60px] ml-2
            ${
						isProcessing(status)
							? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
							: disabled
							? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
							: 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
					}`}
					disabled={status.isLoading || disabled || isProcessing(status)}
					aria-label={status.isLoading ? 'Sending message...' : 'Send message'}
				>
					{status.isLoading ? <LoadingSpinner size='small' color='text-white dark:text-gray-200' /> : 'Send'}
				</button>
			</div>
		</div>
	);
}
