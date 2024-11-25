import { useEffect } from 'preact/hooks';
import { Signal, signal } from '@preact/signals';
import { StatusQueue } from '../utils/statusQueue.utils.ts';
import { ApiStatus } from 'shared/types.ts';

import type { ChatConfig, ChatHandlers, ChatState } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import type { ConversationEntry, ConversationMetadata } from 'shared/types.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';
import type { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { createApiClientManager } from '../utils/apiClient.utils.ts';
import { createWebSocketManager } from '../utils/websocketManager.utils.ts';

import { generateConversationId } from 'shared/conversationManagement.ts';

interface InitializationResult {
	apiClient: ApiClient;
	wsManager: WebSocketManager;
}

export async function initializeChat(
	config: ChatConfig,
): Promise<InitializationResult> {
	// Create API client first
	const apiClient = createApiClientManager(config.apiUrl);

	// Create WebSocket manager last
	const wsManager = createWebSocketManager({
		url: config.wsUrl,
		startDir: config.startDir,
		onMessage: config.onMessage,
		onError: config.onError,
		onClose: config.onClose,
		onOpen: config.onOpen,
	});

	return {
		apiClient,
		wsManager,
	};
}

const initialState: ChatState = {
	conversationId: null,
	apiClient: null,
	wsManager: null,
	conversations: [],
	logEntries: [],
	status: {
		isConnecting: false,
		isLoading: false,
		isReady: false,
		cacheStatus: 'inactive',
		lastApiCallTime: null,
		apiStatus: ApiStatus.IDLE,
		toolName: undefined,
	},
	error: null,
};

const chatState = signal<ChatState>(initialState);

export function useChatState(config: ChatConfig): [Signal<ChatState>, ChatHandlers] {
	// Initialize chat
	useEffect(() => {
		console.log('useChatState: got useEffect for config initialize');

		let mounted = true;
		let currentWsManager: WebSocketManager | null = null;

		async function initialize() {
			try {
				// Set initial loading state
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: true },
				};

				const { apiClient, wsManager } = await initializeChat(config);

				// Load conversation list before WebSocket setup
				const conversationResponse = await apiClient.getConversations(config.startDir);
				if (!conversationResponse) {
					throw new Error('Failed to load conversations');
				}
				const conversations = conversationResponse.conversations;

				// Get conversation ID from URL if it exists, or create a new one
				const params = new URLSearchParams(window.location.search);
				const urlConversationId = params.get('conversationId');
				const conversationId = urlConversationId || generateConversationId();

				// Load conversation data first
				const conversation = await apiClient.getConversation(conversationId, config.startDir);
				const logEntries = conversation?.logEntries || [];

				if (!mounted) {
					console.log('useChatState: useEffect for config initialize - not mounted, bailing');
					wsManager?.disconnect();
					return;
				}

				// Update state with initial data
				chatState.value = {
					...chatState.value,
					apiClient,
					wsManager,
					conversationId,
					conversations,
					logEntries,
				};

				currentWsManager = wsManager;

				// Initialize WebSocket connection last and wait for ready state
				await wsManager.setConversationId(conversationId);

				// Wait for WebSocket to be ready
				await new Promise<void>((resolve, reject) => {
					const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
					const readyHandler = (ready: boolean) => {
						if (ready) {
							clearTimeout(timeout);
							wsManager.off('readyChange', readyHandler);
							resolve();
						}
					};
					wsManager.on('readyChange', readyHandler);
					// Check if already ready
					if (wsManager.status.isReady) {
						clearTimeout(timeout);
						resolve();
					}
				});

				console.log('useChatState: initialization complete');

				// Update final status
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: false },
				};
			} catch (error) {
				console.error('useChatState: initialization error:', error);
				if (!mounted) return;

				// Provide user-friendly error messages
				let errorMessage = 'Failed to initialize chat';
				if ((error as Error).message.includes('timeout')) {
					errorMessage = 'Connection timed out. Please check your network and try again.';
				} else if ((error as Error).message.includes('WebSocket')) {
					errorMessage = 'Failed to establish real-time connection. Please refresh the page.';
				}

				chatState.value = {
					...chatState.value,
					error: errorMessage,
					status: { ...chatState.value.status, isLoading: false },
				};
			}
		}

		initialize();

		return () => {
			console.log('useChatState: cleanup');
			mounted = false;
			if (currentWsManager) {
				currentWsManager.disconnect();
			}
		};
	}, [config.apiUrl, config.wsUrl, config.startDir]);

	// WebSocket event handlers
	useEffect(() => {
		if (!chatState.value.wsManager) return;

		const wsManager = chatState.value.wsManager;
		// Create StatusQueue instance
		const statusQueue = new StatusQueue((status) => {
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					apiStatus: status.status,
					toolName: status.metadata?.toolName?.replace(/_/g, ' '),
				},
			};
		});
		let mounted = true;

		const handleStatusChange = (connected: boolean) => {
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					isConnecting: !connected && !chatState.value.status.isReady,
					isLoading: chatState.value.status.isLoading && !connected,
				},
			};
		};

		const handleReadyChange = (ready: boolean) => {
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					isReady: ready,
					isLoading: chatState.value.status.isLoading && !ready,
				},
			};
		};

		const handleMessage = (data: { msgType: string; logEntryData: any }) => {
			// Update cache status on any API interaction
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					lastApiCallTime: Date.now(),
					cacheStatus: 'active',
				},
			};
			if (!mounted) return;

			// Handle new conversation message
			if (data.msgType === 'conversationNew') {
				chatState.value = {
					...chatState.value,
					conversations: [...chatState.value.conversations, {
						id: data.logEntryData.conversationId,
						title: data.logEntryData.conversationTitle,
						tokenUsageConversation: data.logEntryData.tokenUsageConversation,
						conversationStats: data.logEntryData.conversationStats,
						createdAt: data.logEntryData.timestamp,
						updatedAt: data.logEntryData.timestamp,
						llmProviderName: 'anthropic', // Default provider
						model: 'claude-3', // Default model
					}],
				};
				return;
			}

			// Handle conversation deletion
			if (data.msgType === 'conversationDeleted') {
				const deletedId = data.logEntryData.conversationId;
				chatState.value = {
					...chatState.value,
					conversations: chatState.value.conversations.filter((conv) => conv.id !== deletedId),
					// Clear current conversation if it was deleted
					conversationId: chatState.value.conversationId === deletedId
						? null
						: chatState.value.conversationId,
					// Clear log entries if current conversation was deleted
					logEntries: chatState.value.conversationId === deletedId ? [] : chatState.value.logEntries,
				};
				return;
			}

			// Handle continue/answer messages
			if (!mounted) return;

			// Only process messages for the current conversation
			if (data.logEntryData.conversationId !== chatState.value.conversationId) return;

			// Update log entries
			chatState.value = {
				...chatState.value,
				logEntries: [...chatState.value.logEntries, data.logEntryData],
			};

			// If this is an answer, end processing and set idle state
			if (data.msgType === 'answer') {
				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						isLoading: false,
					},
				};
				// Clear queue and force immediate IDLE status
				statusQueue.reset({
					status: ApiStatus.IDLE,
					timestamp: Date.now(),
					statementCount: data.logEntryData.conversationStats.statementCount,
					sequence: Number.MAX_SAFE_INTEGER,
				});
			}
		};

		const handleCancelled = () => {
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					apiStatus: ApiStatus.IDLE,
					isLoading: false,
				},
			};
		};

		const handleProgressStatus = (data: any) => {
			console.log('useChatState: Received progressStatus:', data);
			if (!mounted) return;
			console.log('useChatState: Adding message to status queue');
			statusQueue.addMessage({
				status: data.status,
				timestamp: Date.now(),
				statementCount: data.statementCount,
				sequence: data.sequence,
				metadata: data.metadata,
			});
		};

		const handlePromptCacheTimer = (data: any) => {
			console.log('useChatState: Received promptCacheTimer:', data);
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					lastApiCallTime: data.startTimestamp,
					cacheStatus: 'active',
				},
			};
		};

		const handleError = (error: Error) => {
			if (!mounted) return;

			// Provide user-friendly error messages
			let errorMessage = error.message;
			if (error.message.includes('WebSocket')) {
				errorMessage = 'Lost connection to server.';
			} else if (error.message.includes('timeout')) {
				errorMessage = 'Request timed out. Please try again.';
			}

			chatState.value = {
				...chatState.value,
				error: errorMessage,
				status: {
					...chatState.value.status,
					isLoading: false,
					apiStatus: ApiStatus.IDLE,
				},
			};
		};

		// [TODO] There can be errors other websocket errors that get displayed
		// So we need to have error tracking and only clear appropriate error messages
		// The whole error display layer needs re-working
		const handleClearError = () => {
			if (!mounted) return;
			chatState.value = {
				...chatState.value,
				error: null,
			};
		};

		wsManager.on('statusChange', handleStatusChange);
		wsManager.on('readyChange', handleReadyChange);
		wsManager.on('message', handleMessage);
		wsManager.on('cancelled', handleCancelled);
		wsManager.on('progressStatus', handleProgressStatus);
		wsManager.on('promptCacheTimer', handlePromptCacheTimer);
		wsManager.on('error', handleError);
		wsManager.on('clearError', handleClearError);
		wsManager.on('progressStatus', handleProgressStatus);
		wsManager.on('promptCacheTimer', handlePromptCacheTimer);

		return () => {
			mounted = false;
			wsManager.off('statusChange', handleStatusChange);
			wsManager.off('readyChange', handleReadyChange);
			wsManager.off('message', handleMessage);
			wsManager.off('cancelled', handleCancelled);
			wsManager.off('error', handleError);
			wsManager.off('clearError', handleClearError);
			wsManager.off('progressStatus', handleProgressStatus);
			wsManager.off('promptCacheTimer', handlePromptCacheTimer);
			statusQueue.reset();
		};
	}, [chatState.value.wsManager]);

	// Message and conversation handlers
	const handlers: ChatHandlers = {
		updateCacheStatus: () => {
			if (!chatState.value.status.lastApiCallTime) {
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, cacheStatus: 'inactive' },
				};
				return;
			}

			const timeSinceLastCall = Date.now() - chatState.value.status.lastApiCallTime;
			const timeUntilExpiry = 5 * 60 * 1000 - timeSinceLastCall; // 5 minutes in milliseconds

			let newStatus: 'active' | 'expiring' | 'inactive';
			if (timeUntilExpiry <= 0) {
				newStatus = 'inactive';
			} else if (timeUntilExpiry <= 60 * 1000) { // Last minute
				newStatus = 'expiring';
			} else {
				newStatus = 'active';
			}

			chatState.value = {
				...chatState.value,
				status: { ...chatState.value.status, cacheStatus: newStatus },
			};
		},
		sendConverse: async (message: string) => {
			if (!chatState.value.wsManager) {
				console.error('sendConverse: wsManager is null');
				throw new Error('Chat system is not initialized');
			}
			if (!chatState.value.status.isReady) {
				throw new Error('Chat is not ready to send messages');
			}

			chatState.value = {
				...chatState.value,
				status: { ...chatState.value.status, apiStatus: ApiStatus.LLM_PROCESSING },
			};

			try {
				if (!chatState.value.wsManager) {
					console.error('sendConverse: wsManager is null before sending message');
					throw new Error('Chat WebSocket manager was lost during message send');
				}
				await chatState.value.wsManager.sendConverse(message);
			} catch (error) {
				console.error('Failed to send message:', error);
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, apiStatus: ApiStatus.IDLE },
					error: 'Failed to send message. Please try again.',
				};
				throw error;
			}
		},

		selectConversation: async (id: string) => {
			console.log(`useChatState: selectConversation for ${id}`);
			if (!chatState.value.apiClient) {
				console.error('selectConversation: apiClient is null');
				throw new Error('Chat API client is not initialized');
			}
			if (!chatState.value.wsManager) {
				console.error('selectConversation: wsManager is null');
				throw new Error('Chat WebSocket manager is not initialized');
			}

			chatState.value = {
				...chatState.value,
				status: { ...chatState.value.status, isLoading: true },
			};

			try {
				// Load conversation data first
				if (!chatState.value.apiClient) {
					console.error('selectConversation: apiClient is null before getConversation');
					throw new Error('Chat API client was lost during conversation load');
				}
				const conversation = await chatState.value.apiClient.getConversation(id, config.startDir);
				console.log(`useChatState: selectConversation for ${id}: loaded`);

				// Update conversation ID and logEntries
				chatState.value = {
					...chatState.value,
					conversationId: id,
					logEntries: conversation?.logEntries || [],
				};

				// Then set up WebSocket connection
				console.log(`useChatState: selectConversation for ${id}: setting id for wsManager`);
				if (!chatState.value.wsManager) {
					console.error('selectConversation: wsManager is null before setConversationId');
					throw new Error('Chat WebSocket manager was lost during conversation selection');
				}
				await chatState.value.wsManager.setConversationId(id);
			} catch (error) {
				console.error('Failed to switch conversation:', error);
				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						isLoading: false,
						apiStatus: ApiStatus.IDLE,
					},
					error: 'Failed to load conversation. Please try again.',
				};
				throw error;
			}
		},

		clearConversation: async () => {
			chatState.value = {
				...chatState.value,
				logEntries: [],
				status: { ...chatState.value.status, apiStatus: ApiStatus.IDLE },
			};
		},

		clearError: () => {
			chatState.value = { ...chatState.value, error: null };
		},

		cancelProcessing: async () => {
			if (!chatState.value.wsManager || !chatState.value.status.isReady) {
				throw new Error('Chat is not ready to cancel processing');
			}

			try {
				await chatState.value.wsManager.sendCancellation();
			} catch (error) {
				console.error('Failed to cancel processing:', error);
				chatState.value = {
					...chatState.value,
					error: 'Failed to cancel processing. Please try again.',
				};
				throw error;
			}
		},
	};

	return [chatState, handlers];
}
