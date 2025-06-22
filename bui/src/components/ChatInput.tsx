import { useEffect, useRef } from 'preact/hooks';
import { batch, type Signal, signal, useComputed, useSignal, useSignalEffect } from '@preact/signals';
import type { RefObject } from 'preact/compat';
import type { TargetedEvent } from 'preact/compat';
import type {
	LLMAttachedFile,
	LLMAttachedFiles,
	LLMModelConfig,
	LLMRequestParams,
	LLMRolesModelConfig,
} from '../types/llm.types.ts';
//import type { ModelDetails } from '../utils/apiClient.utils.ts';
//import { dirname } from '@std/path';
import { LoadingSpinner } from './LoadingSpinner.tsx';
import { Action, InputStatusBar } from './InputStatusBar.tsx';
import { ChatStatus, isProcessing } from '../types/chat.types.ts';
import { ApiStatus, ProjectId } from 'shared/types.ts';
import { ApiClient, type ModelDetails } from '../utils/apiClient.utils.ts';
import { formatPathForInsertion, getTextPositions, processSuggestions } from '../utils/textHandling.utils.ts';
import { type DisplaySuggestion } from '../types/suggestions.types.ts';
import { useChatInputHistory } from '../hooks/useChatInputHistory.ts';
import { ChatHistoryDropdown } from './ChatHistoryDropdown.tsx';
import { type ModelSelectionValue, ModelSelector } from './ModelManager.tsx';
import { getControllerRoleIcon } from 'shared/svgImages.tsx';
import { useModelState } from '../hooks/useModelState.ts';

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
	projectId: ProjectId;
	primaryDataSourceName?: string;
	onCancelProcessing?: () => void;
	chatInputText: Signal<string>;
	chatInputOptions: Signal<LLMRequestParams>;
	attachedFiles: Signal<LLMAttachedFiles>;
	onChange: (value: string, source?: 'user' | 'restore' | 'clear' | 'programmatic') => void;
	onSend: () => Promise<void>;
	textareaRef?: RefObject<ChatInputRef>;
	statusState: Signal<ChatStatus>;
	maxLength?: number;
	collaborationId: string | null;
	onHeightChange?: (height: number) => void;
	chatState?: Signal<any>; // For accessing collaboration data
}

enum TabState {
	INITIAL = 0, // No suggestions shown
	SUGGESTIONS = 1, // Suggestions shown (with or without selection)
}

// Constants
const INPUT_DEBOUNCE = 16; // One frame at 60fps
const SAVE_DEBOUNCE = 1000; // 1 second
//const SUGGESTION_DEBOUNCE = 150;
const ERROR_DISPLAY_TIME = 10000; // 10 seconds for error messages with recovery options
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const INPUT_MAX_CHAR_LENGTH = 25000;
const INPUT_MAX_SCROLL_HEIGHT = 350;

// Helper function to check if we should show suggestions
const shouldShowSuggestions = (text: string, forceShow: boolean = false): boolean => {
	// Don't show suggestions if text contains spaces
	if (text.includes(' ')) return false;

	// Show suggestions if forced by tab
	if (forceShow) return true;

	// Show suggestions only if text starts with / or \
	return text.startsWith('/') || text.startsWith('\\');
};

// Signal-based state
const errorState = signal<ErrorState | null>(null);

const suggestions = signal<DisplaySuggestion[]>([]);
const suggestionsError = signal<string | null>(null);
const isLoadingSuggestions = signal<boolean>(false);
const isShowingSuggestions = signal<boolean>(false);
const tabState = signal<TabState>(TabState.INITIAL);
const cursorPosition = signal<number>(0);
const selectedIndex = signal<number>(-1);
const shouldShowDataSourceInfo = signal<boolean>(false);

// State for options panel visibility
const isOptionsOpen = signal<boolean>(false);
const selectedModelRole = signal<'orchestrator' | 'agent' | 'chat'>('orchestrator');

const ROLE_LABEL_MAPPING = {
	orchestrator: 'Orchestrator',
	agent: 'Agent',
	chat: 'Admin',
};

// Use centralized model state hook
const {
	modelState,
	//hasModelCapabilities, isLoadingModel
	getModelCapabilities,
} = useModelState();

const inputMetrics = signal({
	lastUpdateTime: 0,
	updateCount: 0,
	slowUpdates: 0,
});
const collaborationIdSignal = signal<string | null>(null);

// Token Progress Indicator Component
const TokenProgressIndicator = ({ percentage }: { percentage: number }) => {
	const getProgressColor = (pct: number): string => {
		if (pct < 30) return 'bg-green-500';
		if (pct < 70) return 'bg-yellow-500';
		return 'bg-red-500';
	};

	// Only show if there's meaningful progress (> 1%)
	if (percentage <= 1) return null;

	return (
		<div className="w-full h-0.5 bg-gray-200 dark:bg-gray-700">
			<div
				className={`h-full transition-all duration-300 ${getProgressColor(percentage)}`}
				style={{ width: `${Math.min(100, percentage)}%` }}
			/>
		</div>
	);
};

export function ChatInput({
	apiClient,
	chatInputText,
	chatInputOptions,
	attachedFiles,
	onChange,
	onSend,
	textareaRef: externalRef,
	statusState,
	maxLength = INPUT_MAX_CHAR_LENGTH,
	onCancelProcessing,
	projectId,
	primaryDataSourceName,
	collaborationId,
	onHeightChange,
	chatState,
}: ChatInputProps) {
	const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
	const internalRef = useRef<ChatInputRef | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const optionsModalRef = useRef<HTMLDivElement>(null);
	const suggestionDebounceRef = useRef<number | null>(null);
	const inputDebounceRef = useRef<number | null>(null);
	const saveDebounceRef = useRef<number | null>(null);
	const errorTimeoutRef = useRef<number | null>(null);
	const isMessageSentRef = useRef<boolean>(false);
	const isInitialMount = useRef(true);
	const disabled = useComputed(() => !statusState.value.isReady);
	// const disabled = useComputed(() => {
	//   return !statusState.value.isReady ||
	// 		 isProcessing(statusState.value);
	// });

	// Computed signal for current role's model capabilities
	// const currentRoleModelCapabilities = useComputed(() => {
	// 	const currentModel = chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.model;
	// 	if (!currentModel) return null;
	// 	const modelCapabilities = modelState.value.modelCapabilities[currentModel] ||
	// 		await getModelCapabilities(currentModel) || null;
	// 	console.info('ChatInput: currentRoleModelCapabilities called', {
	// 		selectedModelRole: selectedModelRole.value,
	// 		modelCapabilities,
	// 	});
	// 	return modelCapabilities;
	// });
	const currentRoleModelCapabilities = useSignal<ModelDetails | null>(null);

	useSignalEffect(() => {
		const currentModel = chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.model;
		if (!currentModel) {
			currentRoleModelCapabilities.value = null;
			return;
		}

		const cached = modelState.value.modelCapabilities[currentModel];
		if (cached) {
			currentRoleModelCapabilities.value = cached;
			return;
		}

		getModelCapabilities(currentModel).then((capabilities) => {
			currentRoleModelCapabilities.value = capabilities || null;
		});
	});

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
	} = useChatInputHistory(collaborationIdSignal);

	// Calculate token usage percentage
	const tokenPercentage = useComputed(() => {
		if (!chatState?.value || !collaborationId) return 0;
		
		// Find current collaboration
		const currentCollaboration = chatState.value.collaborations?.find(
			(collab: any) => collab.id === collaborationId
		);
		
		if (!currentCollaboration?.lastInteractionMetadata?.tokenUsageStatsForInteraction?.tokenUsageTurn) {
			return 0;
		}
		
		// Get orchestrator model from current options
		const orchestratorModel = chatInputOptions.value.rolesModelConfig?.orchestrator?.model;
		if (!orchestratorModel) return 0;
		
		// Get model capabilities
		const modelCapabilities = modelState.value.modelCapabilities[orchestratorModel];
		if (!modelCapabilities?.capabilities?.contextWindow) return 0;
		
		// Extract token usage (same logic as ModelInfoPanel)
		const tokenUsageTurn = currentCollaboration.lastInteractionMetadata.tokenUsageStatsForInteraction.tokenUsageTurn;
		const contextWindow = modelCapabilities.capabilities.contextWindow;
		const usedTokens = tokenUsageTurn?.totalAllTokens ?? tokenUsageTurn?.totalTokens ?? 0;
		const tokenLimit = contextWindow;
		
		return tokenLimit > 0 ? Math.min(100, Math.round((usedTokens / tokenLimit) * 100)) : 0;
	});

	const fetchSuggestions = async (searchPath: string, forceShow: boolean = false) => {
		console.debug('ChatInput: fetchSuggestions called', { searchPath, tabState: tabState.value, forceShow });
		if (!apiClient) {
			console.error('ChatInput: API client not initialized');
			return;
		}

		// Handle empty input with tab press
		// Only use root path for initial empty tab press
		let effectivePath = searchPath;
		if (!effectivePath) {
			if (tabState.value === TabState.INITIAL && forceShow) {
				// Initial tab press on empty input - show root
				effectivePath = '/';
			} else if (tabState.value !== TabState.INITIAL) {
				// Typing after tab - treat as search term
				effectivePath = '';
			}
		}

		// Always show suggestions if forced or if we have a path separator
		const shouldShow = forceShow || shouldShowSuggestions(effectivePath);
		// console.debug('ChatInput: Checking if should show suggestions', {
		// 	effectivePath,
		// 	forceShow,
		// 	shouldShow,
		// 	tabState:tabState.value,
		// });

		if (!shouldShow) {
			suggestions.value = [];
			isShowingSuggestions.value = false;
			tabState.value = TabState.INITIAL;
			return;
		}

		isLoadingSuggestions.value = true;
		suggestionsError.value = null;

		try {
			// console.debug('ChatInput: Fetching suggestions', { effectivePath, projectId });
			const response = await apiClient.suggestFiles(effectivePath, projectId);
			if (!response) throw new Error('Failed to fetch suggestions');
			// console.debug('ChatInput: Got suggestions response', { searchPath, suggestions: response.suggestions });

			// Process suggestions into display format
			const processedSuggestions = processSuggestions(response.suggestions);

			// Check if we need to show data source info:
			// 1. When multiple data sources are represented, OR
			// 2. When any suggestion is from a non-primary data source
			const dataSourceNames = new Set(processedSuggestions.map((s) => s.dataSourceName).filter(Boolean));
			const hasMultipleDataSources = dataSourceNames.size > 1;
			const hasNonPrimaryDataSource = processedSuggestions.some((s) =>
				s.dataSourceName && s.dataSourceName !== primaryDataSourceName
			);
			shouldShowDataSourceInfo.value = hasMultipleDataSources || hasNonPrimaryDataSource;
			// console.debug('ChatInput: Processed suggestions', processedSuggestions);

			// Update suggestions list
			// console.debug('ChatInput: Setting suggestions', {
			// 	searchPath,
			// 	count: processedSuggestions.length,
			// 	tabState:tabState.value,
			// 	hasMore: response.hasMore,
			// 	forceShow,
			// });
			suggestions.value = processedSuggestions;
			isShowingSuggestions.value = processedSuggestions.length > 0;
		} catch (error) {
			const errorMessage = (error as Error).message || 'Failed to fetch suggestions';
			console.error('ChatInput: Error fetching suggestions:', error);
			suggestionsError.value = errorMessage;
			suggestions.value = [];
			isShowingSuggestions.value = false;
		} finally {
			isLoadingSuggestions.value = false;
		}
	};

	const debouncedFetchSuggestions = (searchPath: string, forceShow: boolean = false) => {
		// console.debug('ChatInput: Debouncing suggestion fetch', { searchPath, forceShow, tabState:tabState.value });
		if (suggestionDebounceRef.current) {
			globalThis.clearTimeout(suggestionDebounceRef.current);
		}
		// If we're in suggestions mode but have no search path, use root
		if (tabState.value === TabState.SUGGESTIONS && !searchPath) {
			searchPath = '/';
		}
		suggestionDebounceRef.current = globalThis.setTimeout(() => {
			fetchSuggestions(searchPath, forceShow);
		}, 150); // 150ms debounce delay
	};

	const adjustTextareaHeight = () => {
		if (internalTextareaRef.current) {
			internalTextareaRef.current.style.height = 'auto';
			const newHeight = Math.min(internalTextareaRef.current.scrollHeight, INPUT_MAX_SCROLL_HEIGHT);
			internalTextareaRef.current.style.height = `${newHeight}px`;
		}
	};

	const validateFile = (file: File): boolean => {
		// For phase 1, only accept image files
		if (!file.type.startsWith('image/')) {
			errorState.value = {
				message: 'Only image files are supported in this phase',
				timestamp: Date.now(),
			};
			return false;
		}

		// Check file size (5MB limit)
		const maxSize = 5 * 1024 * 1024; // 5MB in bytes
		if (file.size > maxSize) {
			errorState.value = {
				message: 'File exceeds maximum size of 5MB',
				timestamp: Date.now(),
			};
			return false;
		}

		// Check if maximum number of files reached
		if (attachedFiles.value.length >= 10) {
			errorState.value = {
				message: 'Maximum of 10 files per message reached',
				timestamp: Date.now(),
			};
			return false;
		}

		return true;
	};

	// Add upload function
	// deno-lint-ignore require-await
	const uploadFile = async (file: File, fileId: string): Promise<string | undefined> => {
		if (!apiClient) {
			console.error('ChatInput: uploadFile - API client not initialized');
			return;
		}
		try {
			// Create a copy of the array to avoid direct mutation
			const updatedFiles = [...attachedFiles.value];
			const fileIndex = updatedFiles.findIndex((f) => f.id === fileId);
			if (fileIndex === -1) return;

			updatedFiles[fileIndex] = {
				...updatedFiles[fileIndex],
				uploadStatus: 'uploading',
			};
			attachedFiles.value = updatedFiles;

			// Create FormData
			const formData = new FormData();
			formData.append('file', file);
			formData.append('projectId', projectId);

			// Use XMLHttpRequest for progress tracking
			return new Promise<string | undefined>((resolve, reject) => {
				const xhr = new XMLHttpRequest();
				xhr.open('POST', `${apiClient.baseUrl}/api/v1/files`);

				// // Add auth headers
				// const headers = apiClient.getAuthHeaders();
				// Object.keys(headers).forEach(key => {
				//   xhr.setRequestHeader(key, headers[key]);
				// });

				// Track progress
				xhr.upload.onprogress = (event) => {
					if (event.lengthComputable) {
						const progress = Math.round((event.loaded / event.total) * 100);
						const updatedFiles = [...attachedFiles.value];
						const fileIndex = updatedFiles.findIndex((f) => f.id === fileId);
						if (fileIndex !== -1) {
							updatedFiles[fileIndex] = {
								...updatedFiles[fileIndex],
								uploadProgress: progress,
							};
							attachedFiles.value = updatedFiles;
						}
					}
				};

				xhr.onload = () => {
					if (xhr.status >= 200 && xhr.status < 300) {
						try {
							const response = JSON.parse(xhr.responseText);
							const updatedFiles = [...attachedFiles.value];
							const fileIndex = updatedFiles.findIndex((f) => f.id === fileId);

							if (fileIndex !== -1) {
								updatedFiles[fileIndex] = {
									...updatedFiles[fileIndex],
									uploadStatus: 'complete',
									fileId: response.fileId,
									uploadProgress: 100,
								};
								attachedFiles.value = updatedFiles;
							}

							resolve(response.fileId);
						} catch (e) {
							reject(new Error(`Invalid response: ${e instanceof Error ? e.message : 'Unknown error'}`));
						}
					} else {
						reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
					}
				};

				xhr.onerror = () => {
					reject(new Error('Network error during upload'));
				};

				xhr.send(formData);
			});
		} catch (error) {
			console.error('ChatInput: File upload failed', error);

			// Update status to error
			const updatedFiles = [...attachedFiles.value];
			const fileIndex = updatedFiles.findIndex((f) => f.id === fileId);
			if (fileIndex !== -1) {
				updatedFiles[fileIndex] = {
					...updatedFiles[fileIndex],
					uploadStatus: 'error',
				};
				attachedFiles.value = updatedFiles;
			}

			return undefined;
		}
	};

	// Add file processing function
	const processFile = async (file: File) => {
		// Create unique ID for tracking
		const fileId = crypto.randomUUID();

		// Create preview URL for images
		const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;

		// Add to attached files with initial status
		attachedFiles.value = [
			...attachedFiles.value,
			{
				id: fileId,
				file,
				name: file.name || `pasted-file-${fileId}`,
				type: file.type,
				size: file.size,
				previewUrl,
				uploadStatus: 'uploading',
				uploadProgress: 0,
			},
		];

		console.info('ChatInput: File attached', {
			id: fileId,
			type: file.type,
			size: file.size,
			name: file.name,
			totalAttached: attachedFiles.value.length,
		});

		// Start upload immediately
		try {
			const uploadedFileId = await uploadFile(file, fileId);
			console.info('ChatInput: File uploaded successfully', {
				id: fileId,
				uploadedFileId,
			});
			return uploadedFileId;
		} catch (error) {
			console.error('ChatInput: File upload failed', error);
			errorState.value = {
				message: 'Failed to upload file. Please try again.',
				timestamp: Date.now(),
			};
			return undefined;
		}
	};

	// Add paste event handling
	useEffect(() => {
		const textarea = internalTextareaRef.current;
		if (!textarea) return;

		const handlePaste = async (e: ClipboardEvent) => {
			// Check if clipboard contains file data
			const items = e.clipboardData?.items;
			if (!items) return;

			//let hasProcessedFile = false;

			for (let i = 0; i < items.length; i++) {
				// For now, only process image files (first phase)
				if (items[i].type.indexOf('image') !== -1) {
					const file = items[i].getAsFile();
					if (file && validateFile(file)) {
						//hasProcessedFile = true;
						await processFile(file);
						e.preventDefault(); // Prevent default paste behavior
					}
				}
			}
		};

		// Register event listener
		textarea.addEventListener('paste', handlePaste);

		// Cleanup
		return () => {
			textarea.removeEventListener('paste', handlePaste);
			// Release any object URLs to prevent memory leaks
			attachedFiles.value
				.filter((f: LLMAttachedFile) => f.previewUrl)
				.forEach((f: LLMAttachedFile) => URL.revokeObjectURL(f.previewUrl!));
		};
	}, [internalTextareaRef.current, projectId, apiClient]);

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
	}, [chatInputText.value]);

	// Track container height changes
	useEffect(() => {
		if (!containerRef.current || !onHeightChange) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newHeight = entry.contentRect.height;
				onHeightChange(newHeight);
			}
		});

		resizeObserver.observe(containerRef.current);

		return () => {
			resizeObserver.disconnect();
		};
	}, [onHeightChange]);

	// Cleanup debounce timer
	useEffect(() => {
		return () => {
			if (suggestionDebounceRef.current) {
				globalThis.clearTimeout(suggestionDebounceRef.current);
			}
		};
	}, []);

	// Initialize collaboration ID signal and handle saved input
	useEffect(() => {
		// Skip if no collaboration ID
		if (!collaborationId) {
			console.info('ChatInput: No collaboration ID to initialize');
			return;
		}

		// Update signal immediately
		collaborationIdSignal.value = collaborationId;

		// Handle collaboration change
		const isCollaborationChange = collaborationIdSignal.value !== collaborationId;

		// Reset initial mount flag for collaboration changes
		if (isCollaborationChange) {
			isInitialMount.current = true;
		}

		// Auto-migrate from legacy single model to role structure
		if (chatInputOptions.value.model && !chatInputOptions.value.rolesModelConfig) {
			const legacyConfig: LLMModelConfig = {
				model: chatInputOptions.value.model,
				temperature: chatInputOptions.value.temperature || 0.7,
				maxTokens: chatInputOptions.value.maxTokens || 4000,
				extendedThinking: chatInputOptions.value.extendedThinking,
				usePromptCaching: chatInputOptions.value.usePromptCaching,
			};

			const newOptions = {
				...chatInputOptions.value,
				rolesModelConfig: {
					orchestrator: legacyConfig,
					agent: legacyConfig,
					chat: legacyConfig,
				} as LLMRolesModelConfig,
			};

			chatInputOptions.value = newOptions;
			console.info('ChatInput: Migrated legacy model config to role-based structure');
		}

		// Check for saved input
		// console.info('ChatInput: Checking for saved input', {
		// 	collaborationId,
		// 	hasInputText: !!chatInputText.value,
		// 	inputTextLength: chatInputText.value.length,
		// });
		const saved = getSavedInput();
		// console.info('ChatInput: getSavedInput result', {
		// 	hasSaved: !!saved,
		// 	savedLength: saved?.length || 0,
		// 	savedContent: saved ? saved.substring(0, 50) + '...' : 'none',
		// });
		// Only restore on initial mount or collaboration change, not when user clears input
		if (saved && !chatInputText.value && isInitialMount.current) {
			//console.info('ChatInput: Found saved input to restore', {
			//	savedLength: saved.length,
			//});
			onChange(saved, 'restore');
		}

		// Always mark initial mount as complete after processing restore logic
		if (isInitialMount.current) {
			isInitialMount.current = false;
		}
	}, [collaborationId, chatInputText.value]);

	// Load model capabilities when role or model changes
	// useEffect(() => {
	// 	const currentModelConfig = chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value];
	// 	if (currentModelConfig?.model) {
	// 		// Load capabilities using the centralized hook
	// 		getModelCapabilities(currentModelConfig.model)
	// 			.then(capabilities => {
	// 				if (capabilities) {
	// 					console.info(`ChatInput: Loaded capabilities for ${selectedModelRole.value} model: ${currentModelConfig.model}`);
	// 				}
	// 			})
	// 			.catch(error => {
	// 				console.warn(`ChatInput: Failed to load capabilities for ${currentModelConfig.model}:`, error);
	// 			});
	// 	}
	// }, [selectedModelRole.value, chatInputOptions.value.rolesModelConfig]);

	// Note: Initial mount handling moved to collaboration ID effect for proper restore timing

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

	// Handle message sending
	const handleSend = () => {
		const currentValue = chatInputText.value;

		// Check if any files are still uploading
		const stillUploading = attachedFiles.value.some((file: LLMAttachedFile) => file.uploadStatus === 'uploading');

		if (stillUploading) {
			errorState.value = {
				message: 'Please wait for all files to finish uploading',
				timestamp: Date.now(),
			};
			return;
		}

		// Get file IDs for successfully uploaded files
		const fileIds = attachedFiles.value
			.filter((file: LLMAttachedFile) => file.uploadStatus === 'complete' && file.fileId)
			.map((file: LLMAttachedFile) => file.fileId!)
			.filter(Boolean);

		console.info('ChatInput: Sending message', {
			hasValue: !!chatInputText.value.trim(),
			length: chatInputText.value.length,
			collaborationId,
			chatInputOptions: chatInputOptions.value,
			hasFiles: fileIds.length > 0,
			fileCount: fileIds.length,
		});

		// Validate input before sending
		if (!currentValue.trim()) {
			console.info('ChatInput: Nothing to send');
			return;
		}

		safeOperation(
			async () => {
				try {
					// Cancel any pending auto-save and input operations before clearing
					if (saveDebounceRef.current) {
						clearTimeout(saveDebounceRef.current);
						saveDebounceRef.current = null;
						console.info('ChatInput: Cancelled pending auto-save before message send');
					}
					if (inputDebounceRef.current) {
						clearTimeout(inputDebounceRef.current);
						inputDebounceRef.current = null;
						console.info('ChatInput: Cancelled pending input operations before message send');
					}

					// Set flag to prevent auto-save after send
					isMessageSentRef.current = true;

					// Add to history and clear auto-save
					console.info('ChatInput: Message sent successfully, clearing auto-save');
					addToHistory(currentValue);
					clearCurrentInput();

					await onSend();

					// Immediately clear the input UI after successful send
					console.info('ChatInput: Clearing input UI after successful send');
					onChange('', 'clear');

					// Clear attached files and their previews
					attachedFiles.value
						.filter((f: LLMAttachedFile) => f.previewUrl)
						.forEach((f: LLMAttachedFile) => URL.revokeObjectURL(f.previewUrl!));
					attachedFiles.value = [];
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
					saveCurrentInput(currentValue);
					throw e;
				}
			},
			'Failed to send message',
		);
	};

	// Track cursor position
	const handleSelect = (e: Event) => {
		const target = e.target as HTMLTextAreaElement;
		cursorPosition.value = target.selectionStart || 0;
	};

	const handleInput = (e: Event) => {
		if (!collaborationId) {
			console.info('ChatInput: No collaboration ID, input will not be saved');
		}
		// Reset the message sent flag when user starts typing again
		isMessageSentRef.current = false;
		const startTime = performance.now();

		// Handle space key to close suggestions
		const target = e.target as HTMLTextAreaElement;
		if (target.value.endsWith(' ')) {
			isShowingSuggestions.value = false;
			tabState.value = TabState.INITIAL;
			selectedIndex.value = -1;
		}
		const newValue = target.value;
		const newPosition = target.selectionStart;
		// console.debug('ChatInput: handleInput', { newValue, cursorPosition: newPosition });
		cursorPosition.value = newPosition;

		// Update input value immediately without debounce to prevent jumping
		onChange(newValue);

		// Debounce other updates
		if (inputDebounceRef.current) {
			clearTimeout(inputDebounceRef.current);
		}

		inputDebounceRef.current = setTimeout(() => {
			try {
				batch(() => {
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
			if (!collaborationId) {
				console.info('ChatInput: No collaboration ID for auto-save');
				return;
			}

			// Don't save if message was just sent
			if (isMessageSentRef.current) {
				console.info('ChatInput: Skipping auto-save, message was just sent');
				return;
			}

			// Don't save empty input
			// Always check current input state, not closure value
			const currentValue = chatInputText.value;
			if (!currentValue.trim()) {
				console.info('ChatInput: Current input empty, clearing auto-save');
				clearCurrentInput();
				return;
			}

			// console.info('ChatInput: Auto-save triggered', {
			// 	hasValue: !!newValue.trim(),
			// 	length: newValue.length,
			// 	collaborationId,
			// 	valuePreview: newValue.substring(0, 50) + '...',
			// });

			safeOperation(
				() => saveCurrentInput(currentValue),
				'Failed to save input',
			);
		};

		// Debounce auto-save
		if (saveDebounceRef.current) {
			clearTimeout(saveDebounceRef.current);
		}

		saveDebounceRef.current = setTimeout(handleAutoSave, SAVE_DEBOUNCE);

		// Reset selection when typing
		if (selectedIndex.value >= 0) {
			// console.debug('ChatInput: Clearing selection due to typing');
			selectedIndex.value = -1;
			// Keep suggestions visible but clear selection
			if (tabState.value !== TabState.INITIAL) {
				tabState.value = TabState.SUGGESTIONS;
			}
		}

		// Get current path context
		const pos = getTextPositions(newValue, newPosition);
		// Get the full current word/path
		const currentText = newValue.slice(pos.start, pos.end);

		// console.debug('ChatInput: Processing input', {
		// 	currentText,
		// 	tabState:tabState.value,
		// 	wordBoundaries: { start: pos.start, end: pos.end },
		// 	cursorPosition: newPosition,
		// });

		// Check if we should show suggestions
		if (currentText.includes('../') || currentText.includes('..\\') || currentText.includes(' ')) {
			// Disable suggestions for relative paths or when space is typed
			// console.debug('ChatInput: Relative path or space detected, hiding suggestions');
			isShowingSuggestions.value = false;
			tabState.value = TabState.INITIAL;
			selectedIndex.value = -1;
		} else if (shouldShowSuggestions(currentText)) {
			// Show suggestions only if text starts with / or \ (checked in shouldShowSuggestions)
			if (tabState.value === TabState.INITIAL) {
				tabState.value = TabState.SUGGESTIONS;
			}
			// If we're in a directory, append a slash to show its contents
			const searchPath = currentText;
			// if (currentText.endsWith('/') || currentText.endsWith('\\')) {
			// 	console.debug('ChatInput: Directory path detected, showing contents');
			// }
			// console.debug('ChatInput: Updating suggestions for', { searchPath, currentText, tabState:tabState.value });
			debouncedFetchSuggestions(searchPath, false);
		} else if (tabState.value === TabState.SUGGESTIONS && !currentText) {
			// If backspaced to empty while suggestions are showing, use root
			// console.debug('ChatInput: Empty input in suggestions mode, showing root');
			debouncedFetchSuggestions('/', true);
		} else {
			// Hide suggestions in all other cases
			isShowingSuggestions.value = false;
			tabState.value = TabState.INITIAL;
			selectedIndex.value = -1;
		}
	};

	const handleKeyPress = async (e: KeyboardEvent) => {
		// console.debug('ChatInput: handleKeyPress', { key: e.key, altKey: e.altKey, tabState:tabState.value });
		if (e.key === 'Tab') {
			e.preventDefault(); // Prevent default tab behavior immediately

			// Skip if alt is pressed
			if (e.altKey) return;

			// // Log the current state
			// console.debug('ChatInput: Tab key detected', {
			// 	key: e.key,
			// 	altKey: e.altKey,
			// 	tabState:tabState.value,
			// 	selectedIndex:selectedIndex.value,
			// 	hasSuggestions: suggestions.value.length > 0,
			// 	isShowingSuggestions: isShowingSuggestions.value,
			// });

			// Get current text at cursor
			const pos = getTextPositions(chatInputText.value, cursorPosition.value);
			const currentSearchText = chatInputText.value.slice(pos.start, pos.end);
			// console.debug('ChatInput: Tab pressed', { currentSearchText, tabState:tabState.value, suggestions: suggestions.value });

			// Handle tab based on current state
			switch (tabState.value) {
				case TabState.INITIAL: {
					// First tab press - show suggestions
					// console.debug('ChatInput: Initial tab with text:', currentSearchText);
					tabState.value = TabState.SUGGESTIONS;

					// If we have text, use it as search, otherwise show root
					const searchPath = currentSearchText || '/';
					// console.debug('ChatInput: Fetching suggestions for', searchPath);
					await fetchSuggestions(searchPath, true);

					// If we have suggestions and text, try to select best match
					if (suggestions.value.length > 0 && currentSearchText) {
						const matchIndex = suggestions.value.findIndex((s) =>
							s.display.toLowerCase().startsWith(currentSearchText.toLowerCase())
						);
						if (matchIndex >= 0) {
							// console.debug('ChatInput: Found matching suggestion:', suggestions.value[matchIndex]);
							selectedIndex.value = matchIndex;
						}
					}
					break;
				}
				case TabState.SUGGESTIONS: {
					// console.debug('ChatInput: Tab in SUGGESTIONS state', {
					// 	selectedIndex:selectedIndex.value,
					// 	suggestionCount: suggestions.value.length,
					// 	selectedItem: selectedIndex.value >= 0 ? suggestions.value[selectedIndex.value] : null,
					// 	tabState:tabState.value,
					// });

					// If we have suggestions and a selected item, handle tab completion
					if (
						suggestions.value.length > 0 && selectedIndex.value >= 0 &&
						selectedIndex.value < suggestions.value.length
					) {
						const selected = suggestions.value[selectedIndex.value];
						// console.debug('ChatInput: Tab completing selected item into search', selected);

						// Get current text positions
						const pos = getTextPositions(chatInputText.value, cursorPosition.value);
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
					if (suggestions.value.length > 0) {
						// console.debug('ChatInput: Selecting first suggestion');
						selectedIndex.value = 0;
					}
					break;
				}
			}
			return;
		}

		if (isShowingSuggestions.value && suggestions.value.length > 0) {
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault();
				const newIndex = e.key === 'ArrowDown'
					? (selectedIndex.value + 1) % suggestions.value.length
					: selectedIndex.value <= 0
					? suggestions.value.length - 1
					: selectedIndex.value - 1;
				// console.debug(`ChatInput: ${e.key} pressed, selecting suggestion`, { newIndex, tabState:tabState.value });
				selectedIndex.value = newIndex;
				tabState.value = TabState.SUGGESTIONS;

				// Auto-scroll to keep selected item visible
				setTimeout(() => {
					const selectedElement = document.getElementById(`suggestion-${newIndex}`);
					if (selectedElement) {
						selectedElement.scrollIntoView({
							block: 'nearest',
							behavior: 'smooth',
						});
					}
				}, 0);
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				const newIndex = selectedIndex.value <= 0 ? suggestions.value.length - 1 : selectedIndex.value - 1;
				// console.debug('ChatInput: Arrow up, selecting previous suggestion', { newIndex, tabState:tabState.value });
				selectedIndex.value = newIndex;
				// Ensure we stay in SUGGESTIONS state
				if (tabState.value !== TabState.SUGGESTIONS) {
					tabState.value = TabState.SUGGESTIONS;
				}

				// Auto-scroll to keep selected item visible
				setTimeout(() => {
					const selectedElement = document.getElementById(`suggestion-${newIndex}`);
					if (selectedElement) {
						selectedElement.scrollIntoView({
							block: 'nearest',
							behavior: 'smooth',
						});
					}
				}, 0);
				return;
			}
			if (e.key === 'Enter' && selectedIndex.value >= 0) {
				e.preventDefault();
				const selected = suggestions.value[selectedIndex.value];
				// console.debug('ChatInput: Enter pressed on suggestion', selected);
				if (selected.isDirectory) {
					// For directories: complete and show contents
					applySuggestion(selected, true, true);
					// Reset selection and fetch directory contents
					selectedIndex.value = -1;
					fetchSuggestions(selected.path + '/', true);
				} else {
					// For files: apply and close
					applySuggestion(selected, false, false);
					tabState.value = TabState.INITIAL;
				}
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				// console.debug('ChatInput: Escape pressed, hiding suggestions');
				isShowingSuggestions.value = false;
				tabState.value = TabState.INITIAL;
				return;
			}
		}

		// Two ways to send a message:
		// 1. Primary method: Cmd/Ctrl + Enter (standard across platforms)
		// 2. Power user method: NumpadEnter (numeric keypad Enter key)
		//
		// Note about NumpadEnter:
		// - Only triggered by the Enter key on numeric keypad
		// - Regular Enter/Return key reports as 'Enter', not 'NumpadEnter'
		// - Keyboards without numeric keypad won't generate NumpadEnter events
		// - Safe to use without modifier keys as it won't conflict with regular Enter
		if (
			(
				// Standard Cmd/Ctrl + Enter combination
				(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ||
				// Power user method: NumpadEnter (no modifier required)
				(e.code === 'NumpadEnter')
			) && !disabled.value && !statusState.value.isLoading && !isProcessing(statusState.value)
		) {
			e.preventDefault();
			//onSend();
			handleSend();
		}
	};

	// Handle page reload confirmation for unsaved content
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			// Check if there's unsaved content
			if (chatInputText.value.trim()) {
				console.info('ChatInput: Preventing page reload with unsaved content');
				e.preventDefault();
			}
		};

		globalThis.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			globalThis.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [chatInputText.value]);

	// Handle clicking outside the options modal to close it
	useEffect(() => {
		if (!isOptionsOpen.value) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (
				optionsModalRef.current &&
				!optionsModalRef.current.contains(event.target as Node)
			) {
				isOptionsOpen.value = false;
			}
		};

		// Use setTimeout to avoid immediate trigger from the same click that opened the modal
		const timeoutId = setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside);
		}, 0);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [isOptionsOpen.value]);

	// Close options modal when user starts editing the prompt input
	useEffect(() => {
		if (isOptionsOpen.value) {
			isOptionsOpen.value = false;
		}
	}, [chatInputText.value]);

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

	const applySuggestion = (
		suggestion: DisplaySuggestion,
		keepOpen: boolean = false,
		isNavigating: boolean = false,
	) => {
		// console.debug('ChatInput: Applying suggestion', { suggestion, keepOpen, isNavigating, tabState:tabState.value });
		let newText: string;
		if (isNavigating) {
			// During navigation, just use the raw path
			const pos = getTextPositions(chatInputText.value, cursorPosition.value);
			// Use full path for directories to maintain context
			const displayPath = suggestion.isDirectory ? suggestion.path + '/' : suggestion.display;
			// Replace only the current word
			newText = pos.beforeText + displayPath + pos.afterText;

			// Calculate new cursor position after the inserted text
			const newCursorPos = pos.beforeText.length + displayPath.length;

			// console.debug('ChatInput: Navigation text replacement', {
			// 	pos,
			// 	displayPath,
			// 	newText,
			// 	newCursorPos,
			// 	isDirectory: suggestion.isDirectory,
			// });

			// Update cursor position after React updates the input value
			setTimeout(() => {
				if (internalTextareaRef.current) {
					internalTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
				}
			}, 0);
		} else {
			// Final selection - use full formatting
			const pos = getTextPositions(chatInputText.value, cursorPosition.value);
			// console.debug('ChatInput: Text positions for final selection', pos);
			newText = formatPathForInsertion(
				suggestion.path,
				pos,
				shouldShowDataSourceInfo.value ? suggestion.dataSourceName : undefined,
			);
			// For final selection, place cursor at end of the line
			setTimeout(() => {
				if (internalTextareaRef.current) {
					//const lines = newText.split('\n');
					//const lastLine = lines[lines.length - 1];
					const newPos: number = newText.length;
					internalTextareaRef.current.setSelectionRange(newPos, newPos);
				}
			}, 0);
		}
		// console.debug('ChatInput: Formatted text for insertion', { newText });
		onChange(newText);

		if (!keepOpen) {
			// Close suggestions for files or when explicitly closing
			isShowingSuggestions.value = false;
			tabState.value = TabState.INITIAL;
		} else if (suggestion.isDirectory) {
			// For directories, immediately show their contents
			// console.debug('ChatInput: Showing directory contents');
			selectedIndex.value = -1;
			tabState.value = TabState.SUGGESTIONS;
			// Use the full path to fetch directory contents
			fetchSuggestions(suggestion.path + '/', true);
		} else {
			// For files with keepOpen, just update suggestions
			selectedIndex.value = -1;
			const pos = getTextPositions(newText, newText.length);
			const currentText = newText.slice(pos.start, pos.end);
			debouncedFetchSuggestions(currentText, true);
		}
	};

	// Determine status message and type
	const getStatusInfo = (status: ChatStatus) => {
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

		if (disabled.value) {
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
					message: 'Assistant is thinking...',
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
					message: 'Beyond Better is processing...',
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

	const statusInfo = useComputed(() => {
		return getStatusInfo(statusState.value);
	});

	return (
		<div ref={containerRef} className='bg-white dark:bg-gray-900 px-3 py-2 w-full relative'>
			{/* Token Progress Indicator */}
			<TokenProgressIndicator percentage={tokenPercentage.value} />
			
			<InputStatusBar
				visible={statusInfo.value.visible}
				message={statusInfo.value.message}
				status={statusInfo.value.status || ApiStatus.IDLE}
				action={statusInfo.value.action as Action}
				statusState={statusState}
				className='mx-0'
			/>

			{errorState.value && (
				<div className='text-sm text-red-500 dark:text-red-400 mb-2 flex items-center justify-between'>
					<span>{errorState.value.message}</span>
					<div className='flex items-center'>
						{errorState.value.recoveryAction && (
							<button
								type='button'
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
							type='button'
							onClick={() => errorState.value = null}
							className='ml-4 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200'
							title='Dismiss'
						>
							✕
						</button>
					</div>
				</div>
			)}

			{attachedFiles.value.length > 0 && (
				<div className='mt-0 flex flex-wrap gap-2 max-w-full overflow-x-auto pt-2 pb-2'>
					{attachedFiles.value.map((file) => (
						<div key={file.id} className='relative group'>
							{file.type.startsWith('image/') && file.previewUrl
								? (
									// Image preview
									<div className='relative'>
										<img
											src={file.previewUrl}
											alt={file.name}
											className='h-16 w-auto rounded border border-gray-300 dark:border-gray-700 object-cover'
										/>
										<div className='absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 truncate'>
											{(file.size / 1024).toFixed(0)} KB
										</div>
									</div>
								)
								: (
									// Generic file preview (for future non-image support)
									<div className='h-16 w-16 flex flex-col items-center justify-center rounded border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800'>
										<div className='text-2xl'>📄</div>
										<div className='text-xs truncate max-w-full px-1'>
											{(file.size / 1024).toFixed(0)} KB
										</div>
									</div>
								)}

							{/* Upload progress indicator */}
							{file.uploadStatus === 'uploading' && (
								<div className='absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center'>
									<div className='w-full px-2'>
										<div className='h-1 bg-gray-300 rounded-full overflow-hidden'>
											<div
												className='h-full bg-blue-500'
												style={{ width: `${file.uploadProgress}%` }}
											/>
										</div>
										<div className='text-white text-xs mt-1 text-center'>
											{file.uploadProgress}%
										</div>
									</div>
								</div>
							)}

							{/* Error indicator */}
							{file.uploadStatus === 'error' && (
								<div className='absolute inset-0 bg-red-500 bg-opacity-30 flex items-center justify-center'>
									<div className='text-white text-xs text-center'>
										Upload failed
									</div>
								</div>
							)}

							{/* Remove button */}
							<button
								type='button'
								onClick={() => {
									// Release object URL if it exists
									if (file.previewUrl) {
										URL.revokeObjectURL(file.previewUrl);
									}
									// Remove from state
									attachedFiles.value = attachedFiles.value.filter((f) => f.id !== file.id);
								}}
								className='absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 dark:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center'
								title='Remove file'
							>
								×
							</button>
						</div>
					))}
				</div>
			)}

			<div className='flex items-end space-x-3'>
				<div className='flex-grow relative'>
					<textarea
						ref={internalTextareaRef}
						value={chatInputText.value}
						onInput={handleInput}
						onKeyDown={handleKeyPress}
						onSelect={handleSelect}
						onClick={() => {
							if (isDropdownOpen.value) {
								isDropdownOpen.value = false;
							}
							if (isOptionsOpen.value) {
								isOptionsOpen.value = false;
							}
						}}
						className={`w-full px-3 py-2 pr-14 border dark:border-gray-700 rounded-md resize-none overflow-y-auto 
						  dark:bg-gray-800 dark:text-gray-100 
						  focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-blue-400 focus:border-transparent
						  transition-all duration-200 max-h-[200px]
						  ${disabled.value ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}
						  ${
							isProcessing(statusState.value)
								? 'border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800'
								: ''
						}`}
						placeholder={isProcessing(statusState.value)
							? 'Type your message... (Statement in progress)'
							: 'Type your message... (Enter for new line, Cmd/Ctrl + Enter to send, Tab for file suggestions)'}
						rows={1}
						maxLength={maxLength}
						disabled={disabled.value}
						aria-label='Message input'
						aria-expanded={isShowingSuggestions.value}
						aria-haspopup='listbox'
						aria-controls={isShowingSuggestions.value ? 'suggestions-list' : undefined}
						aria-activedescendant={selectedIndex.value >= 0
							? `suggestion-${selectedIndex.value}`
							: undefined}
					/>

					{(isShowingSuggestions.value || isLoadingSuggestions.value || suggestionsError.value) && (
						<div
							className='absolute z-10 w-full bg-white dark:bg-gray-900 shadow-lg rounded-md py-1 text-base ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10 overflow-auto focus:outline-none sm:text-sm bottom-full mb-1'
							style={{ maxHeight: 'min(300px, calc(100vh - 120px))' }}
						>
							{isLoadingSuggestions.value && (
								<div className='flex items-center justify-center py-4 text-gray-600 dark:text-gray-300'>
									<LoadingSpinner size='small' color='text-blue-500 dark:text-blue-400' />
									<span className='ml-2 text-gray-600 dark:text-gray-300'>
										Loading suggestions...
									</span>
								</div>
							)}

							{suggestionsError.value && (
								<div className='text-red-500 dark:text-red-400 p-3 text-sm'>
									Error: {suggestionsError.value}
								</div>
							)}

							{!isLoadingSuggestions.value && !suggestionsError.value && suggestions.value.length > 0 && (
								<ul
									id='suggestions-list'
									role='listbox'
								>
									{suggestions.value.map((suggestion, index) => (
										<li
											id={`suggestion-${index}`}
											key={suggestion.dataSourceName
												? `${suggestion.dataSourceName}:${suggestion.path}`
												: suggestion.path}
											role='option'
											aria-selected={index === selectedIndex.value}
											className={`cursor-pointer py-2 pl-3 pr-9 ${
												index === selectedIndex.value
													? 'bg-blue-600 text-white'
													: 'text-gray-900 dark:text-gray-100 hover:bg-blue-600 hover:text-white'
											}`}
											onClick={() => {
												if (suggestion.isDirectory) {
													// For directories: complete and show contents
													applySuggestion(suggestion, true, true);
													// Reset selection and fetch directory contents
													selectedIndex.value = -1;
													fetchSuggestions(suggestion.path + '/', true);
												} else {
													// For files: apply and close
													applySuggestion(suggestion, false, false);
													tabState.value = TabState.INITIAL;
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
														index === selectedIndex.value
															? 'text-blue-200'
															: 'text-gray-500'
													}`}
												>
													({suggestion.parent}){' '}
													{shouldShowDataSourceInfo.value && suggestion.dataSourceName
														? <span className='ml-1'>[{suggestion.dataSourceName}]</span>
														: ''}
												</span>
											</div>
										</li>
									))}
								</ul>
							)}
						</div>
					)}

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
							type='button'
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
								chatInputText.value.length > maxLength * 0.9
									? 'text-red-500 dark:text-red-400'
									: 'text-gray-400 dark:text-gray-500'
							}`}
						>
							{chatInputText.value.length} / {maxLength}
						</span>
					</div>
				</div>
				<div className='flex items-center'>
					<button
						type='button'
						onClick={() => isOptionsOpen.value = !isOptionsOpen.value}
						className={`p-2 mr-2 mb-1 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300`}
						title='Chat Options'
						aria-label='Chat Options'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-5 w-5'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
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
					</button>
					<button
						type='button'
						onClick={handleSend}
						className={`px-4 py-2 mb-1 rounded-md transition-colors 
							focus:outline-none focus:ring-2 focus:ring-blue-500 
							focus:ring-opacity-50 min-w-[60px] ml-2
							${
							isProcessing(statusState.value)
								? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
								: disabled.value
								? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
								: 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700'
						}`}
						disabled={statusState.value.isLoading || disabled.value || isProcessing(statusState.value)}
						aria-label={statusState.value.isLoading ? 'Sending message...' : 'Send message'}
					>
						{statusState.value.isLoading
							? <LoadingSpinner size='small' color='text-white dark:text-gray-200' />
							: 'Send'}
					</button>
				</div>
			</div>

			{/* LLM Options Panel */}
			{isOptionsOpen.value && (
				<div
					ref={optionsModalRef}
					className='absolute bottom-16 mb-2 right-6 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 z-50'
				>
					<div className='flex justify-between items-center mb-3'>
						<h3 className='font-medium text-gray-800 dark:text-gray-200'>Chat Options</h3>
						<button
							type='button'
							onClick={() => isOptionsOpen.value = false}
							className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
						>
							<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={2}
									d='M6 18L18 6M6 6l12 12'
								/>
							</svg>
						</button>
					</div>

					<div className='space-y-3'>
						{/* Role Tabs */}
						<div className='flex rounded-md border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-900'>
							{(['orchestrator', 'agent', 'chat'] as const).map((role) => {
								const isSelected = selectedModelRole.value === role;

								return (
									<button
										type='button'
										key={role}
										onClick={() => selectedModelRole.value = role}
										className={`flex-1 py-2 px-2 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
											isSelected
												? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 shadow-sm'
												: 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
										}`}
									>
										{getControllerRoleIcon(role, {
											className: 'mr-1 w-4 h-4',
											'aria-label': `${role} model`,
										})}
										<span className='hidden sm:inline'>{ROLE_LABEL_MAPPING[role]}</span>
									</button>
								);
							})}
						</div>

						{/* Model Selector for Selected Role */}
						<ModelSelector
							key={`model-selector-${selectedModelRole.value}-${
								chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.model || ''
							}`}
							apiClient={apiClient}
							context='collaboration'
							role={selectedModelRole.value}
							value={chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.model || ''}
							onChange={(modelId: string | ModelSelectionValue) => {
								console.log(
									'ChatInput: Model changed for role',
									selectedModelRole.value,
									'to',
									modelId,
								);
								const newOptions = { ...chatInputOptions.value };
								if (!newOptions.rolesModelConfig) {
									newOptions.rolesModelConfig = {
										orchestrator: null,
										agent: null,
										chat: null,
									};
								}
								const currentModelConfig = newOptions.rolesModelConfig[selectedModelRole.value] || {
									model: '',
									temperature: 0.7,
									maxTokens: 4000,
									usePromptCaching: true,
								};
								newOptions.rolesModelConfig[selectedModelRole.value] = {
									...currentModelConfig,
									model: modelId as string,
								};
								chatInputOptions.value = newOptions;
								console.log(
									'ChatInput: Changed model config for role',
									selectedModelRole.value,
									newOptions.rolesModelConfig[selectedModelRole.value],
								);
							}}
							label={`${ROLE_LABEL_MAPPING[selectedModelRole.value]} Model`}
							compact
						/>

						{/* Max Tokens slider */}
						<div className='space-y-1'>
							<div className='flex justify-between'>
								<label className='text-sm text-gray-700 dark:text-gray-300'>
									Max Tokens:{' '}
									{chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.maxTokens ||
										4000}
								</label>
							</div>
							<input
								type='range'
								min='1000'
								max={currentRoleModelCapabilities.value?.capabilities?.maxOutputTokens || 100000}
								step='1000'
								value={chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.maxTokens ||
									4000}
								onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
									if (!e.target) return;
									const input = e.target as HTMLInputElement;
									const newOptions = { ...chatInputOptions.value };
									if (!newOptions.rolesModelConfig) {
										newOptions.rolesModelConfig = {
											orchestrator: null,
											agent: null,
											chat: null,
										};
									}
									const currentModelConfig = newOptions.rolesModelConfig[selectedModelRole.value] || {
										model: '',
										temperature: 0.7,
										maxTokens: 4000,
										usePromptCaching: true,
									};
									newOptions.rolesModelConfig[selectedModelRole.value] = {
										...currentModelConfig,
										maxTokens: parseInt(input.value, 10),
									};
									chatInputOptions.value = newOptions;
								}}
								className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer'
							/>
						</div>

						{/* Temperature slider */}
						<div className='space-y-1'>
							<div className='flex justify-between'>
								<label className='text-sm text-gray-700 dark:text-gray-300'>
									Temperature:{' '}
									{(chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]?.temperature ||
										0.7).toFixed(1)}
								</label>
							</div>
							<input
								type='range'
								min={currentRoleModelCapabilities.value?.capabilities?.constraints?.temperature?.min ||
									0}
								max={currentRoleModelCapabilities.value?.capabilities?.constraints?.temperature?.max ||
									1}
								step='0.1'
								value={chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
									?.temperature || 0.7}
								onChange={(e: TargetedEvent<HTMLInputElement, Event>) => {
									if (!e.target) return;
									const input = e.target as HTMLInputElement;
									const newOptions = { ...chatInputOptions.value };
									if (!newOptions.rolesModelConfig) {
										newOptions.rolesModelConfig = {
											orchestrator: null,
											agent: null,
											chat: null,
										};
									}
									const currentModelConfig = newOptions.rolesModelConfig[selectedModelRole.value] || {
										model: '',
										temperature: 0.7,
										maxTokens: 4000,
										usePromptCaching: true,
									};
									newOptions.rolesModelConfig[selectedModelRole.value] = {
										...currentModelConfig,
										temperature: parseFloat(input.value),
									};
									chatInputOptions.value = newOptions;
								}}
								className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer'
							/>
						</div>

						{/* Extended Thinking Toggle */}
						<div>
							<div className='flex items-center justify-between'>
								<label
									className={`text-sm ${
										!currentRoleModelCapabilities?.value ||
											currentRoleModelCapabilities.value.capabilities?.supportedFeatures
													?.extendedThinking === false
											? 'text-gray-400 dark:text-gray-500'
											: 'text-gray-700 dark:text-gray-300'
									}`}
								>
									Extended Thinking
								</label>
								<div className='relative inline-block w-12 align-middle select-none'>
									<input
										type='checkbox'
										checked={chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
											?.extendedThinking?.enabled || false}
										disabled={!currentRoleModelCapabilities?.value ||
											currentRoleModelCapabilities.value.capabilities?.supportedFeatures
													?.extendedThinking === false}
										onChange={(e) => {
											if (!e.target) return;
											const input = e.target as HTMLInputElement;
											const newOptions = { ...chatInputOptions.value };
											//console.log('ChatInput - ExtendedThinking Toggle - onChange:', {chatInputOptions: chatInputOptions.value});
											//console.log('ChatInput - ExtendedThinking Toggle - onChange:', {newOptions});
											if (!newOptions.rolesModelConfig) {
												newOptions.rolesModelConfig = {
													orchestrator: null,
													agent: null,
													chat: null,
												};
											}
											const currentModelConfig =
												newOptions.rolesModelConfig[selectedModelRole.value] || {
													model: '',
													temperature: 0.7,
													maxTokens: 4000,
													usePromptCaching: true,
												};
											//console.log('ChatInput - ExtendedThinking Toggle - onChange:', {currentModelConfig});
											if (!currentModelConfig.extendedThinking) {
												currentModelConfig.extendedThinking = {
													enabled: input.checked,
													budgetTokens: 4096,
												};
											} else {
												currentModelConfig.extendedThinking.enabled = input.checked;
											}
											newOptions.rolesModelConfig[selectedModelRole.value] = currentModelConfig;
											chatInputOptions.value = newOptions;
										}}
										className='sr-only'
										id='toggle-extended-thinking'
									/>
									<label
										htmlFor='toggle-extended-thinking'
										className={`block overflow-hidden h-6 rounded-full transition-colors duration-200 ease-in-out ${
											!currentRoleModelCapabilities?.value ||
												currentRoleModelCapabilities.value.capabilities?.supportedFeatures
														?.extendedThinking === false
												? 'cursor-not-allowed opacity-50'
												: 'cursor-pointer'
										} ${
											chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
													?.extendedThinking?.enabled
												? 'bg-blue-500'
												: 'bg-gray-300 dark:bg-gray-600'
										}`}
									>
										<span
											className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
												chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
														?.extendedThinking?.enabled
													? 'translate-x-6'
													: 'translate-x-0'
											}`}
										/>
									</label>
								</div>
							</div>
						</div>

						{/* Prompt Caching Toggle */}
						<div>
							<div className='flex items-center justify-between'>
								<label
									className={`text-sm ${
										!currentRoleModelCapabilities?.value ||
											currentRoleModelCapabilities.value.capabilities?.supportedFeatures
													?.promptCaching === false
											? 'text-gray-400 dark:text-gray-500'
											: 'text-gray-700 dark:text-gray-300'
									}`}
								>
									Use Prompt Caching
								</label>
								<div className='relative inline-block w-12 align-middle select-none'>
									<input
										type='checkbox'
										checked={chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
											?.usePromptCaching !== false}
										disabled={!currentRoleModelCapabilities?.value ||
											currentRoleModelCapabilities.value.capabilities?.supportedFeatures
													?.promptCaching === false}
										onChange={(e) => {
											if (!e.target) return;
											const input = e.target as HTMLInputElement;
											const newOptions = { ...chatInputOptions.value };
											if (!newOptions.rolesModelConfig) {
												newOptions.rolesModelConfig = {
													orchestrator: null,
													agent: null,
													chat: null,
												};
											}
											const currentModelConfig =
												newOptions.rolesModelConfig[selectedModelRole.value] || {
													model: '',
													temperature: 0.7,
													maxTokens: 4000,
													usePromptCaching: true,
												};
											newOptions.rolesModelConfig[selectedModelRole.value] = {
												...currentModelConfig,
												usePromptCaching: input.checked,
											};
											chatInputOptions.value = newOptions;
										}}
										className='sr-only'
										id='toggle-prompt-caching'
									/>
									<label
										htmlFor='toggle-prompt-caching'
										className={`block overflow-hidden h-6 rounded-full transition-colors duration-200 ease-in-out ${
											!currentRoleModelCapabilities?.value ||
												currentRoleModelCapabilities.value.capabilities?.supportedFeatures
														?.promptCaching === false
												? 'cursor-not-allowed opacity-50'
												: 'cursor-pointer'
										} ${
											chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
													?.usePromptCaching !== false
												? 'bg-blue-500'
												: 'bg-gray-300 dark:bg-gray-600'
										}`}
									>
										<span
											className={`block h-6 w-6 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${
												chatInputOptions.value.rolesModelConfig?.[selectedModelRole.value]
														?.usePromptCaching !== false
													? 'translate-x-6'
													: 'translate-x-0'
											}`}
										/>
									</label>
								</div>
							</div>
						</div>

						{/* Model information - display context window and provider info */}
						{currentRoleModelCapabilities?.value && (
							<div className='mt-4 pt-3 border-t border-gray-200 dark:border-gray-700'>
								<div className='text-xs text-gray-500 dark:text-gray-400'>
									Context window: {currentRoleModelCapabilities.value.capabilities?.contextWindow
										? (currentRoleModelCapabilities.value.capabilities?.contextWindow / 1000)
											.toFixed(
												0,
											)
										: '--'}K tokens
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
