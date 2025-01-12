import { Signal, signal, useComputed } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';

const MAX_ENTRIES = 20;
const MIN_INPUT_LENGTH = 1;
//const BATCH_DEBOUNCE = 500;

export interface ChatInputHistoryEntry {
	value: string;
	timestamp: number;
	isPinned: boolean;
}

// Global state for all conversations
const historyMap = new Map<string, ChatInputHistoryEntry[]>();
const currentHistory = signal<ChatInputHistoryEntry[]>([]);
const isDropdownOpen = signal(false);

export function useChatInputHistory(conversationId: Signal<string | null>) {
	// Refs for batching
	const batchUpdateRef = useRef<number | null>(null);
	//const pendingUpdatesRef = useRef<ChatInputHistoryEntry[]>([]);

	// Storage keys as computed values
	const storageKey = useComputed(() => {
		const key = conversationId.value ? `bb-chat-history-${conversationId.value}` : null;
		return key;
	});

	const currentInputKey = useComputed(() => {
		const key = conversationId.value ? `bb-chat-current-${conversationId.value}` : null;
		return key;
	});

	// Computed signals for filtered lists
	const pinnedEntries = useComputed(() => {
		return currentHistory.value.filter((entry) => entry.isPinned);
	});

	const recentEntries = useComputed(() => {
		return currentHistory.value.filter((entry) => !entry.isPinned);
	});

	// Save current input with validation
	const saveCurrentInput = (value: string) => {
		// Ensure we have a valid key and value
		if (!conversationId.value) {
			console.info('ChatHistory: No conversation ID for save');
			return;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue) {
			//console.info('ChatHistory: Empty input, clearing storage');
			clearCurrentInput();
			return;
		}
		// Force immediate computation of storage key
		const key = currentInputKey.value;
		// console.info('ChatHistory: Attempting to save input', {
		// 	conversationId: conversationId.value,
		// 	hasKey: !!key,
		// 	valueLength: value.length,
		// });
		if (!key) {
			console.info('ChatHistory: No storage key available');
			return;
		}

		// console.info('ChatHistory: Saving input', {
		// 	key,
		// 	hasValue: !!trimmedValue,
		// 	length: trimmedValue.length,
		// 	minLength: MIN_INPUT_LENGTH,
		// });

		try {
			if (trimmedValue.length >= MIN_INPUT_LENGTH) {
				localStorage.setItem(key, value);
				// console.info('ChatHistory: Input saved successfully');
			} else {
				localStorage.removeItem(key);
				// console.info('ChatHistory: Input too short, removed from storage');
			}
		} catch (e) {
			console.error('ChatHistory: Failed to save input:', e);
		}
	};

	// Get saved input with validation and error handling
	const getSavedInput = () => {
		// Ensure we have a valid conversation ID
		if (!conversationId.value) {
			console.info('ChatHistory: No conversation ID for retrieval');
			return '';
		}

		// Force immediate computation of storage key
		const key = currentInputKey.value;
		// console.info('ChatHistory: Attempting to get saved input', {
		// 	conversationId: conversationId.value,
		// 	hasKey: !!key,
		// });
		if (!key) {
			console.info('ChatHistory: No storage key to retrieve');
			return '';
		}

		try {
			const saved = localStorage.getItem(key);
			// console.info('ChatHistory: Retrieved saved input', {
			// 	key,
			// 	hasValue: !!saved,
			// 	length: saved?.length || 0,
			// });
			return saved || '';
		} catch (e) {
			console.error('ChatHistory: Error retrieving saved input:', e);
			return '';
		}
	};

	// Clear current input
	const clearCurrentInput = () => {
		const key = currentInputKey.value;
		if (!key) {
			console.info('ChatHistory: No storage key to clear');
			return;
		}

		console.info('ChatHistory: Clearing saved input', { key });
		try {
			localStorage.removeItem(key);
		} catch (e) {
			console.error('ChatHistory: Failed to clear input:', e);
		}
	};

	// Add entry to history
	const addToHistory = (value: string) => {
		if (!storageKey.value || !value.trim()) {
			console.debug('ChatHistory: Invalid conditions for addToHistory', {
				hasStorageKey: !!storageKey.value,
				valueLength: value.length,
				trimmedLength: value.trim().length,
			});
			return;
		}

		const newEntry: ChatInputHistoryEntry = {
			value,
			timestamp: Date.now(),
			isPinned: false,
		};

		const newHistory = [newEntry, ...currentHistory.value].slice(0, MAX_ENTRIES);
		historyMap.set(storageKey.value, newHistory);
		currentHistory.value = newHistory;
		localStorage.setItem(storageKey.value, JSON.stringify({ entries: newHistory }));
	};

	// Toggle pin status
	const togglePin = (index: number) => {
		if (!storageKey.value) return;

		const newHistory = [...currentHistory.value];
		newHistory[index] = {
			...newHistory[index],
			isPinned: !newHistory[index].isPinned,
		};

		historyMap.set(storageKey.value, newHistory);
		currentHistory.value = newHistory;
		localStorage.setItem(storageKey.value, JSON.stringify({ entries: newHistory }));
	};

	// Handle conversation changes and data loading
	useEffect(() => {
		const id = conversationId.value;
		// console.info('ChatHistory: Conversation changed', {
		// 	id,
		// 	hasStorageKey: !!storageKey.value,
		// 	hasInputKey: !!currentInputKey.value,
		// });

		if (!id) {
			console.info('ChatHistory: No conversation ID, clearing state');
			currentHistory.value = [];
			return;
		}

		// Check for saved input first
		const savedInput = localStorage.getItem(currentInputKey.value!);
		// console.info('ChatHistory: Checked for saved input', {
		// 	hasInput: !!savedInput,
		// 	inputLength: savedInput?.length,
		// });
		// console.info('ChatHistory: Conversation changed, checking storage', {
		// 	conversationId: conversationId.value,
		// 	hasStorageKey: !!storageKey.value,
		// 	hasInputKey: !!currentInputKey.value,
		// });
		const key = storageKey.value;
		if (!key) {
			currentHistory.value = [];
			return;
		}

		// Check if we already have this conversation's history in memory
		if (historyMap.has(key)) {
			currentHistory.value = historyMap.get(key) || [];
			return;
		}

		// Load history from localStorage
		try {
			//console.info('ChatHistory: Loading history from storage', { key });
			const savedHistory = localStorage.getItem(key);
			if (savedHistory) {
				const parsed = JSON.parse(savedHistory);
				// console.info('ChatHistory: Found saved history', {
				// 	historyLength: parsed?.entries?.length || 0,
				// });
				const entries = parsed.entries || [];
				historyMap.set(key, entries);
				currentHistory.value = entries;
			} else {
				historyMap.set(key, []);
				currentHistory.value = [];
			}
		} catch (e) {
			console.error('ChatHistory: Failed to load history:', e);
			historyMap.set(key, []);
			currentHistory.value = [];
		}
	}, [storageKey.value]);

	// Cleanup on unmount or conversation change
	useEffect(() => {
		return () => {
			if (currentInputKey.value) {
				console.info('ChatHistory: Cleaning up saved input on unmount/change');
				clearCurrentInput();
			}
		};
	}, [conversationId.value]);

	// Cleanup timeouts
	useEffect(() => {
		return () => {
			if (batchUpdateRef.current) {
				clearTimeout(batchUpdateRef.current);
			}
		};
	}, []);

	return {
		history: currentHistory,
		pinnedEntries,
		recentEntries,
		isDropdownOpen,
		addToHistory,
		togglePin,
		saveCurrentInput,
		getSavedInput,
		clearCurrentInput,
	};
}
