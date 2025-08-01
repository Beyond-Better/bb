import { useEffect, useRef, useState } from 'preact/hooks';
//import type { RefObject } from 'preact';
import { computed, Signal, signal, useComputed } from '@preact/signals';
import { JSX } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
import { notificationManager } from '../utils/notificationManager.ts';
import { userPersistenceManager } from '../storage/userPersistence.ts';
import type {
	ModelDetails,
	//ModelResponse,
} from '../utils/apiClient.utils.ts';

import { useChatState } from '../hooks/useChatState.ts';
import { setCollaboration, useAppState } from '../hooks/useAppState.ts';
import { initializeModelState, useModelState } from '../hooks/useModelState.ts';
import type { ChatConfig, ChatState, CollaborationListState } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import { MessageEntry } from '../components/MessageEntry.tsx';
import { CollaborationHeader } from '../components/CollaborationHeader.tsx';
import { CollaborationList } from '../components/CollaborationList.tsx';
import { Toast } from '../components/Toast.tsx';
import { AnimatedNotification } from '../components/AnimatedNotification.tsx';
//import { useVersion } from '../hooks/useVersion.ts';
import { useProjectState } from '../hooks/useProjectState.ts';
import { ChatInput } from '../components/ChatInput.tsx';
import { CollaborationStateEmpty } from '../components/CollaborationStateEmpty.tsx';
//import { ToolBar } from '../components/ToolBar.tsx';
//import { ApiStatus } from 'shared/types.ts';
import type { CollaborationLogDataEntry, CollaborationValues } from 'shared/types.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/generateIds.ts';
import { getApiHostname, getApiPort, getApiUseTls } from '../utils/url.utils.ts';
import { getWorkingApiUrl } from '../utils/connectionManager.utils.ts';
import { LLMRolesModelConfig } from 'api/types.ts';
import { focusChatInputSync } from '../utils/focusManagement.utils.ts';

// Helper functions for URL parameters
const getCollaborationId = () => {
	const params = new URLSearchParams(globalThis.location.search);
	return params?.get('collaborationId') || null;
};

const INPUT_MAX_CHAR_LENGTH = 25000;

// Model state hook for centralized model management
const {
	modelState,
	getDefaultRolesModelConfig,
	getModelCapabilities,
} = useModelState();

const defaultChatConfig: ChatConfig = {
	apiUrl: '',
	wsUrl: '',

	onMessage: (message) => console.log('ChatIsland: WebSocket message received:', message),
	onError: (error) => console.error('ChatIsland: WebSocket error:', error),
	onClose: () => console.log('ChatIsland: WebSocket closed'),
	onOpen: () => console.log('ChatIsland: WebSocket opened'),
};

// Helper to get options from collaboration or defaults
// For new collaborations, this will use the default models from the model state hook
const getInputOptionsFromCollaboration = (
	selectedCollaboration: CollaborationValues | null,
	//collaborationId: string | null,
	//collaborations: CollaborationValues[],
): LLMRequestParams => {
	//if (!collaborationId) {
	if (!selectedCollaboration) {
		// Use defaults from model state hook
		const defaultRolesConfig = getDefaultRolesModelConfig();
		return {
			rolesModelConfig: defaultRolesConfig || {
				orchestrator: null,
				agent: null,
				chat: null,
			},
		};
	}

	if (!selectedCollaboration.collaborationParams || !selectedCollaboration.collaborationParams.rolesModelConfig) {
		// Fallback to defaults from model state hook
		const defaultRolesConfig = getDefaultRolesModelConfig();
		return {
			rolesModelConfig: defaultRolesConfig || {
				orchestrator: null,
				agent: null,
				chat: null,
			},
		};
	}

	// Return collaboration params
	return {
		rolesModelConfig: selectedCollaboration.collaborationParams.rolesModelConfig,
	};
};

// Dedicated function to initialize chat input options
const initializeChatInputOptions = async (
	selectedCollaboration: CollaborationValues | null,
	//collaborationId: string | null, collaborations: CollaborationValues[]
) => {
	// Get options from collaboration or defaults
	const inputOptions = getInputOptionsFromCollaboration(selectedCollaboration);
	chatInputOptions.value = inputOptions;

	// Fetch model capabilities for all models in the configuration
	const rolesConfig = inputOptions.rolesModelConfig;
	if (rolesConfig) {
		const modelIds = [
			rolesConfig.orchestrator?.model,
			rolesConfig.agent?.model,
			rolesConfig.chat?.model,
		].filter((model): model is string => Boolean(model));

		// Remove duplicates
		const uniqueModelIds = [...new Set(modelIds)];

		// Load capabilities for all models used in this collaboration
		if (uniqueModelIds.length > 0) {
			try {
				// Load capabilities for the primary model (orchestrator) for backward compatibility
				if (rolesConfig.orchestrator?.model) {
					const capabilities = await getModelCapabilities(rolesConfig.orchestrator.model);
					if (capabilities) {
						modelData.value = capabilities;
						console.info('Chat: Updated model capabilities for orchestrator:', capabilities.displayName);
					}
				}
				// Preload other model capabilities in background
				uniqueModelIds.forEach((modelId) => {
					if (modelId !== rolesConfig.orchestrator?.model) {
						getModelCapabilities(modelId).catch((error) => {
							console.warn(`Chat: Failed to preload capabilities for ${modelId}:`, error);
						});
					}
				});
			} catch (error) {
				console.error('Chat: Failed to fetch model capabilities', error);
			}
		}
	}
};

interface ChatProps {
	chatState: Signal<ChatState>;
}

// Initialize collaboration list visibility state
const isCollaborationListVisible = signal(false);
const chatInputText = signal('');
const chatInputOptions = signal<{ rolesModelConfig: LLMRolesModelConfig }>(getInputOptionsFromCollaboration(null));
const chatConfig = signal<ChatConfig>({ ...defaultChatConfig });
const modelData = signal<ModelDetails | null>(null);
const attachedFiles = signal<LLMAttachedFiles>([]);

export default function Chat({
	chatState,
}: ChatProps): JSX.Element {
	//console.info('Chat: Component rendering');
	// Initialize version checking
	//const { versionCompatibility } = useVersion();
	const appState = useAppState();

	// Get project state and selectedProjectId signal
	const { state: projectState, selectedProjectId, loadProjectConfig } = useProjectState(appState);
	// Use projectId from selectedProjectId signal
	const projectId = selectedProjectId.value || null;
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
	const [inputAreaHeight, setInputAreaHeight] = useState(80); // Default height estimate
	const inputAreaRef = useRef<HTMLDivElement>(null);
	const lastScrollPositionRef = useRef<number>(0);
	const statusState = useComputed(() => chatState.value.status);

	// Refs
	interface ChatInputRef {
		textarea: HTMLTextAreaElement;
		adjustHeight: () => void;
	}
	const chatInputRef = useRef<ChatInputRef>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	// Track input changes for performance monitoring
	//const lastInputUpdateRef = useRef<number>(Date.now());

	const setInputWithTracking = (value: string) => {
		//const now = Date.now();
		//const timeSinceLastUpdate = now - lastInputUpdateRef.current;
		//if (timeSinceLastUpdate < 16) { // Less than one frame at 60fps
		//	console.debug('Chat: Rapid input updates detected:', timeSinceLastUpdate, 'ms');
		//}
		//lastInputUpdateRef.current = now;
		chatInputText.value = value;
		//console.debug('Chat: Current chatInputText length:', chatInputText.value.length);
	};

	// Initialize connection with protocol detection
	useEffect(() => {
		let isMounted = true;

		async function initializeConnection() {
			try {
				// Get connection parameters
				const { hostname, port, useTls } = {
					hostname: getApiHostname(),
					port: getApiPort(),
					useTls: getApiUseTls(),
				};

				console.log('Chat: Getting working API URL with params:', { hostname, port, useTls });

				// Auto-detect the working protocol
				const { apiUrl, wsUrl, fallbackUsed } = await getWorkingApiUrl();

				console.log('Chat: Connection established', {
					apiUrl,
					wsUrl,
					fallbackUsed,
					originalProtocol: useTls ? 'HTTPS/WSS' : 'HTTP/WS',
				});

				if (isMounted) {
					chatConfig.value = {
						...chatConfig.value,
						apiUrl,
						wsUrl,
						//onMessage: (message) => console.log('ChatIsland: WebSocket message received:', message),
						//onError: (error) => console.error('ChatIsland: WebSocket error:', error),
						//onClose: () => console.log('ChatIsland: WebSocket closed'),
						//onOpen: () => console.log('ChatIsland: WebSocket opened'),
					};
				}
			} catch (error) {
				console.error('Chat: Failed to initialize connection:', error);

				// Use default parameters as fallback
				const apiHostname = getApiHostname();
				const apiPort = getApiPort();
				const apiUseTls = getApiUseTls();
				const apiUrl = `${apiUseTls ? 'https' : 'http'}://${apiHostname}:${apiPort}`;
				const wsUrl = `${apiUseTls ? 'wss' : 'ws'}://${apiHostname}:${apiPort}/api/v1/ws`;

				console.warn('Chat: Falling back to default connection parameters', {
					apiHostname,
					apiPort,
					apiUseTls,
					apiUrl,
					wsUrl,
				});

				if (isMounted) {
					chatConfig.value = {
						...chatConfig.value,
						apiUrl,
						wsUrl,
					};
				}
			}
		}

		initializeConnection();

		return () => {
			isMounted = false;
		};
	}, []);

	// Initialize notification system
	useEffect(() => {
		if (!IS_BROWSER) return;

		async function initializeNotifications() {
			try {
				// Initialize user persistence with API client and local mode status
				const isLocalMode = !chatState.value.apiClient; // Simple check for local mode
				userPersistenceManager.initialize(chatState.value.apiClient, isLocalMode);

				// Load user preferences
				await userPersistenceManager.loadPreferences();

				// Initialize notification manager
				await notificationManager.initialize();

				console.log('Chat: Notification system initialized successfully');
			} catch (error) {
				console.warn('Chat: Failed to initialize notification system:', error);
			}
		}

		initializeNotifications();

		// Cleanup on unmount
		return () => {
			notificationManager.dispose();
		};
	}, [chatState.value.apiClient]);

	const [handlers, scrollIndicatorState] = useChatState(chatConfig, chatState, chatInputOptions);

	// Remove initial useEffect as projectData is now handled by computed signal in useChatState

	// Update cache status every 30 seconds
	useEffect(() => {
		if (!IS_BROWSER) return;
		// console.log('Chat: status.lastApiCallTime effect running', chatState.value.status.lastApiCallTime);

		const updateCacheStatus = () => {
			// console.log(
			// 	'Chat: status.lastApiCallTime effect - updateCacheStatus',
			// 	chatState.value.status.lastApiCallTime,
			// );
			if (!chatState.value.status.lastApiCallTime) {
				chatState.value.status.cacheStatus = 'inactive';
				return;
			}

			const timeSinceLastCall = Date.now() - chatState.value.status.lastApiCallTime;
			const timeUntilExpiry = 5 * 60 * 1000 - timeSinceLastCall; // 5 minutes in milliseconds

			if (timeUntilExpiry <= 0) {
				chatState.value.status.cacheStatus = 'inactive';
			} else if (timeUntilExpiry <= 60 * 1000) { // Last minute
				chatState.value.status.cacheStatus = 'expiring';
			} else {
				chatState.value.status.cacheStatus = 'active';
			}
		};

		const intervalId = setInterval(updateCacheStatus, 30000); // Update every 30 seconds
		updateCacheStatus(); // Initial update

		return () => clearInterval(intervalId);
	}, [chatState.value.status.lastApiCallTime]);

	// Initialize model state when project and API client are available
	useEffect(() => {
		if (!IS_BROWSER) return;
		if (!projectId || !chatState.value.apiClient) return;

		// Initialize model state with API client and project ID
		initializeModelState(chatState.value.apiClient, projectId);

		// Load project configuration for the selected project
		loadProjectConfig(projectId);
	}, [projectId, chatState.value.apiClient]);
	//}, [projectId, chatState.value.apiClient, loadProjectConfig]);

	// Re-initialize chat input options when model state becomes available
	useEffect(() => {
		if (!IS_BROWSER) return;
		if (!chatState.value.collaborationId) return;

		// Check if model state is available
		const defaultRolesConfig = getDefaultRolesModelConfig();
		if (!defaultRolesConfig || modelState.value.isLoadingDefaults) {
			return;
		}

		// If we have a blank collaboration and no valid options, reinitialize
		const currentConfig = chatInputOptions.value.rolesModelConfig;
		const hasValidConfig = currentConfig && (
			currentConfig.orchestrator?.model ||
			currentConfig.agent?.model ||
			currentConfig.chat?.model
		);

		if (!hasValidConfig) {
			initializeChatInputOptions(chatState.value.selectedCollaboration)
				.catch((error) => {
					console.error('Chat: Failed to reinitialize chat input options:', error);
				});
		}
	}, [chatState.value.collaborationId, modelState.value.defaultRolesModelConfig, modelState.value.isLoadingDefaults]);

	// Utility functions

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setToastMessage('Content copied to clipboard!');
			setShowToast(true);
		} catch (err) {
			console.error('ChatIsland: Failed to copy:', err);
			setToastMessage('Failed to copy content');
			setShowToast(true);
		}
	};

	const sendConverse = async (retryCount = 0) => {
		const startTime = performance.now();
		//console.debug('Chat: Starting message send');
		//console.debug('Chat: Sending message, length:', chatInputText.value.length);
		// Update lastApiCallTime when sending a message
		chatState.value.status.lastApiCallTime = Date.now();
		chatState.value.status.cacheStatus = 'active';
		if (!chatInputText.value.trim() || !chatState.value.status.isReady || isProcessing(chatState.value.status)) {
			return;
		}

		const trimmedInput = chatInputText.value.trim();
		const maxRetries = 3;

		try {
			console.info('Chat: sendConverse - chatInputOptions', chatInputOptions.value);
			// Pass the options from the signal to the handler
			await handlers.sendConverse(trimmedInput, chatInputOptions.value, attachedFiles.value);
			const duration = performance.now() - startTime;
			console.info('Chat: Message send completed in', duration.toFixed(2), 'ms');
			console.info('Chat: Clearing input');
			setInputWithTracking('');
		} catch (error) {
			console.error('ChatIsland: Failed to send message:', error);
			if (retryCount < maxRetries) {
				setToastMessage('Retrying to send message...');
				setShowToast(true);
				setTimeout(() => sendConverse(retryCount + 1), 1000);
			} else {
				setToastMessage('Failed to send message after multiple attempts. Please try again.');
				setShowToast(true);
			}
		}
	};

	const transformEntry = (logDataEntry: CollaborationLogDataEntry): CollaborationLogDataEntry => {
		// Simply return the entry as it's already a valid CollaborationLogDataEntry
		// The type guards are used in the UI components to safely access properties
		return logDataEntry;
	};

	const deleteCollaboration = async (id: string) => {
		try {
			if (!projectId) throw new Error('projectId is undefined for delete collaboration');
			if (!chatState.value.apiClient) throw new Error('API client not initialized');
			if (!chatState.value.status.isReady) {
				throw new Error('WebSocket connection not ready. Please try again.');
			}

			// Prevent multiple simultaneous deletions
			if (isProcessing(chatState.value.status)) {
				throw new Error('Please wait for the current operation to complete');
			}

			await chatState.value.apiClient.deleteCollaboration(id, projectId);

			// Update collaborations list immediately
			chatState.value = {
				...chatState.value,
				collaborations: chatState.value.collaborations.filter((collab: CollaborationValues) =>
					collab.id !== id
				),
			};

			// Handle currently selected collaboration
			if (id === chatState.value.collaborationId) {
				handlers.clearCollaboration();
				const url = new URL(globalThis.location.href);
				url.searchParams.delete('collaborationId');
				const hash = globalThis.location.hash;
				globalThis.history.pushState({}, '', url.pathname + url.search + hash);
			}
		} catch (error) {
			console.error('Failed to delete collaboration:', error);
			setToastMessage((error as Error).message || 'Failed to delete conversation');
			setShowToast(true);

			// If WebSocket is disconnected, wait for reconnection and retry
			if (!chatState.value.status.isReady) {
				const retryInterval = setInterval(() => {
					if (chatState.value.status.isReady) {
						clearInterval(retryInterval);
						deleteCollaboration(id).catch(console.error);
					}
				}, 1000);
				// Clear interval after 10 seconds
				setTimeout(() => clearInterval(retryInterval), 10000);
			}
		}
	};

	const updateCollaborationTitle = async (id: string, newTitle: string) => {
		try {
			if (!projectId) throw new Error('projectId is undefined for update collaboration title');
			if (!chatState.value.apiClient) throw new Error('API client not initialized');
			if (!chatState.value.status.isReady) {
				throw new Error('WebSocket connection not ready. Please try again.');
			}

			// Prevent updates during processing
			if (isProcessing(chatState.value.status)) {
				throw new Error('Please wait for the current operation to complete');
			}

			// Optimistic update
			const updatedCollaborations = chatState.value.collaborations.map((collab: CollaborationValues) =>
				collab.id === id ? { ...collab, title: newTitle, updatedAt: new Date().toISOString() } : collab
			);

			chatState.value = {
				...chatState.value,
				collaborations: updatedCollaborations,
			};

			// Update selected collaboration if it's the current one
			if (id === chatState.value.collaborationId && chatState.value.selectedCollaboration) {
				chatState.value.selectedCollaboration = {
					...chatState.value.selectedCollaboration,
					title: newTitle,
					updatedAt: new Date().toISOString(),
				};
			}

			// Make API call
			if (!chatState.value.apiClient) {
				throw new Error('API client not available');
			}
			await chatState.value.apiClient.updateCollaborationTitle(id, newTitle, projectId);

			setToastMessage('Title updated successfully');
			setShowToast(true);
		} catch (error) {
			console.error('Failed to update collaboration title:', error);
			setToastMessage((error as Error).message || 'Failed to update title');
			setShowToast(true);

			// Revert optimistic update on error
			if (chatState.value.apiClient && projectId) {
				try {
					const collaborations = await chatState.value.apiClient.listCollaborations(projectId);
					if (collaborations) {
						chatState.value = {
							...chatState.value,
							collaborations: collaborations.collaborations,
						};
					}
				} catch (revertError) {
					console.error('Failed to revert collaboration list:', revertError);
				}
			}
		}
	};

	const toggleCollaborationStar = async (id: string, starred: boolean) => {
		try {
			if (!projectId) throw new Error('projectId is undefined for toggle collaboration star');
			if (!chatState.value.apiClient) throw new Error('API client not initialized');
			if (!chatState.value.status.isReady) {
				throw new Error('WebSocket connection not ready. Please try again.');
			}

			// Prevent updates during processing
			if (isProcessing(chatState.value.status)) {
				throw new Error('Please wait for the current operation to complete');
			}

			// Optimistic update
			const updatedCollaborations = chatState.value.collaborations.map((collab: CollaborationValues) =>
				collab.id === id ? { ...collab, starred, updatedAt: new Date().toISOString() } : collab
			);

			chatState.value = {
				...chatState.value,
				collaborations: updatedCollaborations,
			};

			// Update selected collaboration if it's the current one
			if (id === chatState.value.collaborationId && chatState.value.selectedCollaboration) {
				chatState.value.selectedCollaboration = {
					...chatState.value.selectedCollaboration,
					starred,
					updatedAt: new Date().toISOString(),
				};
			}

			// Make API call
			if (!chatState.value.apiClient) {
				throw new Error('API client not available');
			}
			await chatState.value.apiClient.toggleCollaborationStar(id, starred, projectId);

			setToastMessage(starred ? 'Added to favorites' : 'Removed from favorites');
			setShowToast(true);
		} catch (error) {
			console.error('Failed to toggle collaboration star:', error);
			setToastMessage((error as Error).message || 'Failed to update favorites');
			setShowToast(true);

			// Revert optimistic update on error
			if (chatState.value.apiClient && projectId) {
				try {
					const collaborations = await chatState.value.apiClient.listCollaborations(projectId);
					if (collaborations) {
						chatState.value = {
							...chatState.value,
							collaborations: collaborations.collaborations,
						};
					}
				} catch (revertError) {
					console.error('Failed to revert collaboration list:', revertError);
				}
			}
		}
	};

	const selectCollaboration = async (id: string) => {
		try {
			await handlers.selectCollaboration(id);
			setCollaboration(id);

			// Initialize chat input options with the selected collaboration
			await initializeChatInputOptions(chatState.value.selectedCollaboration);

			// Update URL while preserving hash parameters
			//const url = new URL(globalThis.location.href);
			//url.searchParams.set('collaborationId', id);
			//const hash = globalThis.location.hash;
			//globalThis.history.pushState({}, '', url.pathname + url.search + hash);

			// Focus the chat input after selecting a collaboration
			focusChatInputSync(chatInputRef);
		} catch (error) {
			console.error('Failed to switch collaboration:', error);
			setToastMessage('Failed to switch conversation');
			setShowToast(true);
			// Clear the collaboration ID from URL on error
			const url = new URL(globalThis.location.href);
			url.searchParams.delete('collaborationId');
			const hash = globalThis.location.hash;
			globalThis.history.pushState({}, '', url.pathname + url.search + hash);
		}
	};

	// Browser history navigation support
	// Handle cancel processing event
	useEffect(() => {
		const handleCancelProcessing = () => {
			handlers.cancelProcessing();
		};
		globalThis.addEventListener('bb:cancel-processing', handleCancelProcessing);
		return () => globalThis.removeEventListener('bb:cancel-processing', handleCancelProcessing);
	}, [handlers]);

	useEffect(() => {
		if (!IS_BROWSER) return;

		chatInputText.value = '';

		// Initialize options from current collaboration
		if (chatState.value.collaborationId) {
			// Use the centralized initialization function
			initializeChatInputOptions(chatState.value.selectedCollaboration)
				.catch((error) => {
					console.error('Chat: Failed to initialize chat input options:', error);
					// Fallback to basic initialization
					const fallbackOptions = getInputOptionsFromCollaboration(
						chatState.value.selectedCollaboration,
						//chatState.value.collaborationId,
						//chatState.value.collaborations,
					);
					chatInputOptions.value = fallbackOptions;
				});
		}

		const handlePopState = async () => {
			const urlCollaborationId = getCollaborationId();
			if (urlCollaborationId && urlCollaborationId !== chatState.value.collaborationId) {
				await selectCollaboration(urlCollaborationId);
			}
		};

		globalThis.addEventListener('popstate', handlePopState);
		return () => globalThis.removeEventListener('popstate', handlePopState);
	}, [chatState.value.collaborationId]);

	// Track input area height changes
	useEffect(() => {
		if (!inputAreaRef.current || !IS_BROWSER) return;

		const resizeObserver = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const newHeight = entry.contentRect.height;
				setInputAreaHeight(newHeight);
			}
		});

		resizeObserver.observe(inputAreaRef.current);

		return () => {
			resizeObserver.disconnect();
		};
	}, []);

	// Handle scroll behavior with stable positioning
	useEffect(() => {
		//console.log('Chat: Scroll useEffect');
		if (!messagesEndRef.current) return;

		const messagesContainer = messagesEndRef.current;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
			lastScrollPositionRef.current = scrollTop;

			// Consider user at bottom if within 50 pixels of bottom
			// Account for any rounding errors with a small tolerance
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
			const isAtBottom = distanceFromBottom <= 50;

			// Always update scroll indicator UI based on current scroll position
			// Pass false to show indicator when NOT at bottom
			handlers.updateScrollVisibility(isAtBottom);

			// Update auto-scroll behavior only when it changes
			if (shouldAutoScroll !== isAtBottom) {
				//console.log('ChatIsland: Auto-scroll behavior changing to:', isAtBottom);
				setShouldAutoScroll(isAtBottom);
			}
			// Log current state for debugging
			// console.debug('ChatIsland: Scroll state debug', {
			// 	isAtBottom,
			// 	distanceFromBottom,
			// 	currentVisibility: scrollIndicatorState.value.isVisible,
			// 	scrollHeight: messagesContainer.scrollHeight,
			// 	clientHeight: messagesContainer.clientHeight,
			// 	scrollTop,
			// });
		};

		// Add scroll event listener
		messagesContainer.addEventListener('scroll', handleScroll);

		// Trigger initial scroll check to set indicator state
		handleScroll();

		// Auto-scroll only if at bottom and content has changed
		if (shouldAutoScroll) {
			requestAnimationFrame(() => {
				messagesContainer.scrollTo({
					top: messagesContainer.scrollHeight,
					behavior: 'smooth',
				});
			});
		}

		return () => messagesContainer.removeEventListener('scroll', handleScroll);
	}, [chatState.value.logDataEntries, shouldAutoScroll]);

	// Maintain scroll position when input height changes
	useEffect(() => {
		if (!messagesEndRef.current || inputAreaHeight === 0) return;

		const messagesContainer = messagesEndRef.current;
		const { scrollHeight, clientHeight } = messagesContainer;
		const maxScroll = scrollHeight - clientHeight;

		// If user was at bottom, stay at bottom
		if (shouldAutoScroll && maxScroll > 0) {
			requestAnimationFrame(() => {
				messagesContainer.scrollTop = maxScroll;
			});
		} else if (lastScrollPositionRef.current > 0) {
			// Otherwise maintain relative position
			requestAnimationFrame(() => {
				messagesContainer.scrollTop = lastScrollPositionRef.current;
			});
		}

		// Trigger scroll handler to update indicator visibility
		setTimeout(() => {
			messagesContainer.dispatchEvent(new Event('scroll'));
		}, 100);
	}, [inputAreaHeight]);

	// Handle page visibility and focus events at the component level
	useEffect(() => {
		// console.log('Chat: Visibility useEffect');
		if (!IS_BROWSER) return;

		// Don't force scroll during processing - respect user's scroll position

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden' && isProcessing(chatState.value.status)) {
				console.log('ChatIsland: Page hidden while processing');
				setToastMessage('Statement in progress in background');
				setShowToast(true);
			} else if (document.visibilityState === 'visible') {
				// User returned to page - clear any notifications
				notificationManager.clearNotifications();
			}
		};

		const handleFocus = () => {
			// User focused window - clear any notifications
			notificationManager.clearNotifications();
		};

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (isProcessing(chatState.value.status)) {
				event.preventDefault();
				//return (event.returnValue = 'Assistant is still working. Are you sure you want to leave?');
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		globalThis.addEventListener('focus', handleFocus);
		globalThis.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			//console.log('Chat: Cleanup for useEffect');
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			globalThis.removeEventListener('focus', handleFocus);
			globalThis.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [chatState.value.status.apiStatus]);

	useEffect(() => {
		//console.log('Chat: Connection status useEffect');
		let disconnectTimeoutId: number;
		let reconnectTimeoutId: number;

		// Ignore connection changes during collaboration switching
		if (chatState.value.status.isLoading) {
			return;
		}

		// Handle disconnection
		if (!chatState.value.status.isReady && !chatState.value.status.error) {
			// Delay showing disconnection message
			disconnectTimeoutId = setTimeout(() => {
				if (!chatState.value.status.isReady && !chatState.value.status.error) {
					setToastMessage('Connection lost. Attempting to reconnect...');
					setShowToast(true);
				}
			}, 1000);
		} // Handle reconnection
		else if (
			chatState.value.status.isReady && showToast &&
			toastMessage === 'Connection lost. Attempting to reconnect...'
		) {
			setToastMessage('Connected successfully!');
			reconnectTimeoutId = setTimeout(() => {
				setShowToast(false);
			}, 2000);
		}

		return () => {
			if (disconnectTimeoutId) clearTimeout(disconnectTimeoutId);
			if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
		};
	}, [chatState.value.status.isReady, chatState.value.status.isConnecting, chatState.value.status.error]);

	const collaborationListState = computed<CollaborationListState>(() => ({
		collaborations: chatState.value.collaborations,
		selectedId: chatState.value.collaborationId,
		isLoading: chatState.value.status.isLoading,
	}));

	if (!chatConfig.value.apiUrl || !chatConfig.value.wsUrl) {
		return (
			<div className='flex items-center justify-center h-screen'>
				<AnimatedNotification
					visible
					type='error'
				>
					<span>Missing required URL parameters. Expected format: #apiHostname=host&apiPort=port</span>
				</AnimatedNotification>
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full bg-gray-50 dark:bg-gray-900 overflow-hidden relative'>
			{/* Connection status banner */}
			<AnimatedNotification
				visible={chatState.value.status.isConnecting && !chatState.value.status.error}
				type='warning'
			>
				<div className='flex items-center justify-center'>
					<span>Connection lost. Attempting to reconnect...</span>
				</div>
			</AnimatedNotification>

			{/* ProjectMetadata is now handled in routes/chat/index.tsx */}

			{/* Main content */}
			<div className='flex flex-1 min-h-0 relative overflow-hidden'>
				{!projectId
					? (
						<main className='flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 overflow-hidden w-full relative'>
							<div className='flex flex-col items-center justify-center min-h-[400px] text-gray-500 dark:text-gray-400'>
								<svg
									className='w-12 h-12 mb-4 text-gray-400 dark:text-gray-500'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
									/>
								</svg>
								<p className='text-lg font-medium dark:text-gray-300'>No Project selected</p>
								<p className='text-sm dark:text-gray-400'>Select a project to begin</p>
							</div>
						</main>
					)
					: (
						<>
							{/* Collapsible Collaboration List */}
							<div
								className={`absolute top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out z-40 ${
									isCollaborationListVisible.value
										? 'w-[30%] min-w-[20rem] translate-x-0'
										: 'w-0 -translate-x-full'
								}`}
							>
								<div className='h-full w-full overflow-hidden'>
									<CollaborationList
										collaborationListState={collaborationListState}
										onSelect={async (id) => {
											await selectCollaboration(id);
											isCollaborationListVisible.value = false;
										}}
										onNew={async () => {
											const id = shortenInteractionId(generateInteractionId());
											await selectCollaboration(id);
											isCollaborationListVisible.value = false;
										}}
										onDelete={deleteCollaboration}
										onTitleUpdate={updateCollaborationTitle}
										onToggleStar={toggleCollaborationStar}
										onClose={() => isCollaborationListVisible.value = false}
									/>
								</div>
							</div>
							{/* Chat area */}
							<main className='flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 overflow-hidden w-full relative'>
								{/* CollaborationHeader */}
								<CollaborationHeader
									cacheStatus={chatState.value.status.cacheStatus}
									status={chatState.value.status}
									onSelect={selectCollaboration}
									onNew={async () => {
										const id = shortenInteractionId(generateInteractionId());
										await selectCollaboration(id);
									}}
									onDelete={deleteCollaboration}
									onToggleStar={toggleCollaborationStar}
									onToggleList={() =>
										isCollaborationListVisible.value = !isCollaborationListVisible.value}
									isListVisible={isCollaborationListVisible.value}
									apiClient={chatState.value.apiClient!}
									chatState={chatState}
									modelData={modelData}
									onSendMessage={async (message) => {
										await handlers.sendConverse(message, chatInputOptions.value);
									}}
									chatInputRef={chatInputRef}
									disabled={!chatState.value.status.isReady ||
										isProcessing(chatState.value.status)}
									projectId={projectId}
								/>

								{/* Messages */}
								<div
									className='flex-1 min-h-0 relative flex flex-col'
									style={{ paddingBottom: `${inputAreaHeight}px` }}
								>
									{scrollIndicatorState.value.isVisible && (
										<button
											type='button'
											onClick={() => {
												if (messagesEndRef.current) {
													messagesEndRef.current.scrollTo({
														top: messagesEndRef.current.scrollHeight,
														behavior: 'smooth',
													});
													setShouldAutoScroll(true);
													handlers.updateScrollVisibility(true);
												}
											}}
											style={{ bottom: `${inputAreaHeight + 20}px` }}
											className={`absolute right-8 z-30 flex items-center gap-2 px-3 py-2 mb-2 ${
												scrollIndicatorState.value.isAnswerMessage
													? 'bg-green-500 hover:bg-green-600 scale-110 animate-pulse'
													: 'bg-blue-500 hover:bg-blue-600'
											} text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-105`}
											title='Scroll to bottom'
										>
											{scrollIndicatorState.value.unreadCount > 0 && (
												<span
													className={`px-1.5 py-0.5 text-xs bg-white font-medium ${
														scrollIndicatorState.value.isAnswerMessage
															? 'text-green-500'
															: 'text-blue-500'
													} rounded-full`}
												>
													{scrollIndicatorState.value.unreadCount}
												</span>
											)}

											<svg
												xmlns='http://www.w3.org/2000/svg'
												className='h-5 w-5'
												viewBox='0 0 20 20'
												fill='currentColor'
											>
												<path
													fillRule='evenodd'
													d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
													clipRule='evenodd'
												/>
											</svg>
										</button>
									)}
									<div
										ref={messagesEndRef}
										className='flex-1 overflow-y-auto px-4 py-4 w-full overflow-x-hidden'
										style={{ maxWidth: '100%' }}
									>
										{chatState.value.logDataEntries.length === 0 &&
											!isProcessing(chatState.value.status) &&
											(
												<div className='flex flex-col items-center justify-center min-h-[400px] px-6 py-8'>
													<CollaborationStateEmpty
														setInputWithTracking={setInputWithTracking}
														chatInputRef={chatInputRef}
													/>
												</div>
											)}
										{chatState.value.logDataEntries.length > 0 &&
											chatState.value.logDataEntries.map((logDataEntry, index) => (
												<MessageEntry
													key={index}
													logDataEntry={transformEntry(logDataEntry)}
													index={index}
													onCopy={handleCopy}
													apiClient={chatState.value.apiClient!}
													projectId={projectId}
													collaborationId={chatState.value.collaborationId!}
												/>
											))}
									</div>
								</div>

								{/* Input area */}
								<div
									ref={inputAreaRef}
									className='absolute bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex justify-center z-20'
								>
									<ChatInput
										chatInputText={chatInputText}
										chatInputOptions={chatInputOptions}
										attachedFiles={attachedFiles}
										apiClient={chatState.value.apiClient!}
										projectId={projectId}
										primaryDataSourceName={chatState.value.projectData?.dsConnections?.find((ds) =>
											ds.id === chatState.value.projectData?.primaryDsConnection?.id
										)?.name}
										textareaRef={chatInputRef}
										onChange={(value, source = 'user') => {
											// Only block user input when not ready, allow programmatic updates
											if (source === 'user' && !chatState.value.status.isReady) {
												return;
											}
											setInputWithTracking(value.slice(0, INPUT_MAX_CHAR_LENGTH));
										}}
										onSend={sendConverse}
										statusState={statusState}
										onCancelProcessing={handlers.cancelProcessing}
										maxLength={INPUT_MAX_CHAR_LENGTH}
										collaborationId={chatState.value.collaborationId}
										onHeightChange={setInputAreaHeight}
										chatState={chatState}
										projectConfig={projectState.value.projectConfig}
									/>
								</div>
							</main>
						</>
					)}
			</div>

			{/* Toast notifications */}
			{showToast && (
				<Toast
					message={toastMessage}
					type='success'
					duration={2000}
					onClose={() => setShowToast(false)}
				/>
			)}

			{/* Error display */}
			<AnimatedNotification
				visible={!!chatState.value.status.error}
				type='error'
			>
				<div className='flex items-center justify-between'>
					<span>{chatState.value.status.error}</span>
					<button
						type='button'
						onClick={() => handlers.clearError()}
						className='ml-4 text-red-700 hover:text-red-800 z-50'
						aria-label='Dismiss error'
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
			</AnimatedNotification>
		</div>
	);
}
