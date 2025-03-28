import { useEffect } from 'preact/hooks';
import { Signal, signal, useComputed } from '@preact/signals';
import { StatusQueue } from '../utils/statusQueue.utils.ts';
import { ApiStatus } from 'shared/types.ts';
import type { ConversationLogDataEntry } from 'shared/types.ts';
//import { useVersion } from './useVersion.ts';
import { useProjectState } from './useProjectState.ts';
import { type AppState, useAppState } from '../hooks/useAppState.ts';

import type { ChatConfig, ChatHandlers, ChatState } from '../types/chat.types.ts';
import type { LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
//import { isProcessing } from '../types/chat.types.ts';
//import type { ConversationLogDataEntry, ConversationMetadata } from 'shared/types.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';
import type { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { createApiClientManager } from '../utils/apiClient.utils.ts';
import { createWebSocketManager } from '../utils/websocketManager.utils.ts';
import type { VersionInfo } from 'shared/types/version.ts';

import { generateConversationId, shortenConversationId } from 'shared/conversationManagement.ts';
import { addLogDataEntry, createNestedLogDataEntries } from 'shared/utils/logEntries.ts';

interface InitializationResult {
	apiClient: ApiClient;
	wsManager: WebSocketManager;
}

interface ScrollIndicatorState {
	isVisible: boolean;
	unreadCount: number;
	isAnswerMessage: boolean;
}

const scrollIndicatorState = signal<ScrollIndicatorState>({
	isVisible: false,
	unreadCount: 0,
	isAnswerMessage: false,
});

export function initializeChat(
	config: ChatConfig,
	appState: Signal<AppState>,
): InitializationResult {
	// Create API client first
	const apiClient = createApiClientManager(config.apiUrl);

	// Create WebSocket manager last
	const wsManager = createWebSocketManager({
		wsUrl: config.wsUrl,
		apiUrl: config.apiUrl,
		projectId: appState.value.projectId || '',
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

// Performance tracking for state updates
let lastStateUpdateTime = Date.now();
const trackStateUpdate = (operation: string) => {
	const now = Date.now();
	const timeSinceLastUpdate = now - lastStateUpdateTime;
	console.debug('useChatState: State update timing', {
		operation,
		timeSinceLastUpdate,
		timestamp: new Date(now).toISOString(),
	});
	lastStateUpdateTime = now;
};

export function useChatState(
	config: ChatConfig,
	chatState: Signal<ChatState>,
	chatInputOptions?: Signal<LLMRequestParams>,
): [ChatHandlers, Signal<ScrollIndicatorState>] {
	// Get project state
	const appState = useAppState();
	const { state: projectState } = useProjectState(appState);

	// Create computed signal for project data
	const projectData = useComputed(() => {
		const project = projectState.value.projects.find((p) => p.projectId === appState.value.projectId);
		return project
			? {
				projectId: project.projectId,
				name: project.name,
				type: project.type,
				path: project.path,
				stats: project.stats,
			}
			: null;
	});

	// Update chatState with computed project data
	useEffect(() => {
		trackStateUpdate('setState');
		chatState.value = {
			...chatState.value,
			projectData: projectData.value,
		};
	}, [projectData.value]);
	// console.log('useChatState: hook called with config', {
	// 	projectId: config.projectId,
	// 	existingWsManager: chatState.value.wsManager?.constructor.name,
	// 	existingApiClient: chatState.value.apiClient?.constructor.name,
	// });
	// Watch for project changes and reinitialize chat when needed
	// 	useEffect(async () => {
	// 		if (chatState.value.apiClient) {
	// 			// Load conversation list before WebSocket setup
	// 		console.log('useChatState: got useEffect for projectId', appState.value.projectId);
	// 			const conversationResponse = await chatState.value.apiClient.getConversations(
	// 				appState.value.projectId,
	// 			);
	// 			if (!conversationResponse) {
	// 				throw new Error('Failed to load conversations');
	// 			}
	// 			const conversations = conversationResponse.conversations;
	//
	// 			// Load conversation data first
	// 			const conversation = await chatState.value.apiClient.getConversation(
	// 				appState.value.conversationId,
	// 				appState.value.projectId,
	// 			);
	// 			const logDataEntries = conversation?.logDataEntries || [];
	// 			// Clear current chat state
	// 			chatState.value = {
	// 				...chatState.value,
	// 				conversationId: appState.value.conversationId ||'',
	// 				logDataEntries,
	// 				conversations,
	// 				status: {
	// 					...chatState.value.status,
	// 					isLoading: false,
	// 				},
	// 			};
	// 		} else {
	// 			// Clear current chat state
	// 			chatState.value = {
	// 				...chatState.value,
	// 				conversationId: '',
	// 				logDataEntries: [],
	// 				conversations: [],
	// 				status: {
	// 					...chatState.value.status,
	// 					isLoading: true,
	// 				},
	// 			};
	// 		}
	// 	}, [appState.value.projectId]);
	// 	//}, [projectState.value.selectedProjectId]);

	// Initialize chat
	useEffect(() => {
		console.log('useChatState: got useEffect for config initialize', config);

		let mounted = true;
		let currentWsManager: WebSocketManager | null = null;

		async function initialize() {
			//const initStart = performance.now();
			console.debug('useChatState: Starting initialization');
			console.log('useChatState: initialize called', {
				mounted,
				existingWsManager: chatState.value.wsManager?.constructor.name,
				existingApiClient: chatState.value.apiClient?.constructor.name,
			});
			try {
				// Set initial loading state
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: true },
				};

				const { apiClient, wsManager } = initializeChat(config, appState);

				// Load conversation list before WebSocket setup
				const conversationResponse = appState.value.projectId
					? await apiClient.getConversations(appState.value.projectId)
					: null;
				if (!conversationResponse) {
					throw new Error('Failed to load conversations');
				}
				const conversations = conversationResponse.conversations;
				console.log('useChatState: conversations', conversations);

				// Get conversation ID from URL if it exists, or create a new one
				const params = new URLSearchParams(globalThis.location.search);
				const urlConversationId = params.get('conversationId');
				const conversationId = urlConversationId || chatState.value.conversationId ||
					appState.value.conversationId || shortenConversationId(generateConversationId());

				// Load conversation data first
				const conversation = (conversationId && appState.value.projectId)
					? await apiClient.getConversation(
						conversationId,
						appState.value.projectId,
					)
					: null;
				const logDataEntries = createNestedLogDataEntries(conversation?.logDataEntries || []);
				console.log('useChatState: initialize-logDataEntries', logDataEntries);

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
					logDataEntries,
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

				console.debug('useChatState: Initialization complete', {
					// duration: initDuration.toFixed(2) + 'ms',
					logDataEntriesCount: chatState.value.logDataEntries.length,
					conversationsCount: chatState.value.conversations.length,
				});

				// Update final status
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: false },
				};
			} catch (error) {
				console.error('useChatState: initialization error:', error);
				if (!mounted) return;

				// Provide user-friendly error messages
				let errorMessage = 'Failed to initialize chat - create or select a project';
				if ((error as Error).message.includes('timeout')) {
					errorMessage = 'Connection timed out. Please check your network and try again.';
				} else if ((error as Error).message.includes('WebSocket')) {
					errorMessage = 'Failed to establish real-time connection. Please refresh the page.';
				}

				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: false, error: errorMessage },
				};
			}
		}

		initialize();

		return () => {
			console.log('useChatState: cleanup', {
				currentWsManager: currentWsManager?.constructor.name,
				existingWsManager: chatState.value.wsManager?.constructor.name,
				mounted,
			});
			mounted = false;
			if (currentWsManager) {
				currentWsManager.disconnect();
				// Reset chatState to initial state
				chatState.value = {
					...chatState.value,
					wsManager: null,
					apiClient: null,
					status: {
						isConnecting: false,
						isLoading: false,
						isReady: false,
						cacheStatus: 'inactive',
						lastApiCallTime: null,
						apiStatus: ApiStatus.IDLE,
						toolName: undefined,
						error: null,
					},
				};
			}
		};
	}, [config.apiUrl, config.wsUrl, appState.value.projectId]);

	// WebSocket event handlers
	useEffect(() => {
		console.log('useChatState: WebSocket event handlers useEffect', {
			hasWsManager: !!chatState.value.wsManager,
			wsManagerType: chatState.value.wsManager?.constructor.name,
		});
		if (!chatState.value.wsManager) return;

		const wsManager = chatState.value.wsManager;
		//const { setVersionInfo } = useVersion();
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

		const handleMessage = (data: { msgType: string; logDataEntry: ConversationLogDataEntry }) => {
			const startTime = performance.now();
			console.debug('useChatState: Processing message:', {
				type: data.msgType,
				currentLogEntries: chatState.value.logDataEntries.length,
				timestamp: new Date().toISOString(),
			});
			console.debug('useChatState: Processing message:', data.msgType);
			// Get current project for stats updates
			const currentProject = projectState.value.projects.find((p) => p.projectId === appState.value.projectId);
			if (!currentProject) return;
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
				// Update project stats for new conversation
				//await updateProjectStats(currentProject.projectId, {
				//	conversationCount: (currentProject.stats?.conversationCount || 0) + 1,
				//	totalTokens: currentProject.stats?.totalTokens || 0,
				//	lastAccessed: new Date().toISOString(),
				//});
				chatState.value = {
					...chatState.value,
					conversations: [...chatState.value.conversations, {
						id: data.logDataEntry.conversationId,
						title: data.logDataEntry.conversationTitle,
						tokenUsageStats: data.logDataEntry.tokenUsageStats,
						requestParams: data.logDataEntry.requestParams,
						conversationStats: data.logDataEntry.conversationStats,
						createdAt: data.logDataEntry.timestamp,
						updatedAt: data.logDataEntry.timestamp,
						llmProviderName: 'anthropic', // Default provider
						model: 'claude-3', // Default model
					}],
				};
				return;
			}

			// Handle conversation deletion
			if (data.msgType === 'conversationDeleted') {
				// Update project stats for deleted conversation
				const deletedConversation = chatState.value.conversations.find((c) =>
					c.id === data.logDataEntry.conversationId
				);
				if (deletedConversation) {
					// await updateProjectStats(currentProject.projectId, {
					// 	conversationCount: Math.max(0, (currentProject.stats?.conversationCount || 1) - 1),
					// 	totalTokens: Math.max(
					// 		0,
					// 		(currentProject.stats?.totalTokens || 0) -
					// 			(deletedConversation.tokenUsageConversation?.totalTokens || 0),
					// 	),
					// 	lastAccessed: new Date().toISOString(),
					// });
				}
				const deletedId = data.logDataEntry.conversationId;
				chatState.value = {
					...chatState.value,
					conversations: chatState.value.conversations.filter((conv) => conv.id !== deletedId),
					// Clear current conversation if it was deleted
					conversationId: chatState.value.conversationId === deletedId
						? null
						: chatState.value.conversationId,
					// Clear log entries if current conversation was deleted
					logDataEntries: chatState.value.conversationId === deletedId ? [] : chatState.value.logDataEntries,
				};
				return;
			}

			// Handle continue/answer messages
			if (!mounted) return;

			// Only process messages for the current conversation
			if (data.logDataEntry.conversationId !== chatState.value.conversationId) return;

			// Update log entries and conversation stats
			chatState.value = {
				...chatState.value,
				conversations: chatState.value.conversations.map((conv) => {
					if (conv.id === data.logDataEntry.conversationId) {
						return {
							...conv,
							tokenUsageStats: data.logDataEntry.tokenUsageStats,
							conversationStats: data.logDataEntry.conversationStats,
							requestParams: data.logDataEntry.requestParams,
							updatedAt: data.logDataEntry.timestamp,
						};
					}
					return conv;
				}),
				logDataEntries: (() => {
					const newEntries = addLogDataEntry(chatState.value.logDataEntries, data.logDataEntry);
					console.debug('useChatState: Updated logDataEntries', {
						previousCount: chatState.value.logDataEntries.length,
						newCount: newEntries.length,
						processingTime: performance.now() - startTime,
						messageId: data.logDataEntry.messageId,
						parentMessageId: data.logDataEntry.parentMessageId || 'none',
						agentInteractionId: data.logDataEntry.agentInteractionId || 'none',
					});
					return newEntries;
				})(),
			};
			console.log('useChatState: handleMessage-logDataEntries', chatState.value.logDataEntries);

			if (scrollIndicatorState.value.isVisible) {
				scrollIndicatorState.value = {
					...scrollIndicatorState.value,
					unreadCount: scrollIndicatorState.value.unreadCount + 1,
				};
			}

			// If this is an answer, end processing and set idle state
			if (data.msgType === 'answer') {
				// Update project stats for token usage
				// const tokenUsage = data.logDataEntry.tokenUsageStats.tokenUsage?.totalTokens || 0;
				// await updateProjectStats(currentProject.projectId, {
				// 	conversationCount: currentProject.stats?.conversationCount || 1,
				// 	totalTokens: (currentProject.stats?.totalTokens || 0) + tokenUsage,
				// 	lastAccessed: new Date().toISOString(),
				// });

				// Update chatInputOptions with the request parameters from the response if available
				if (chatInputOptions && data.logDataEntry.requestParams) {
					console.info(
						'useChatState: Updating options from message response',
						data.logDataEntry.requestParams,
					);
					chatInputOptions.value = {
						...chatInputOptions.value,
						...data.logDataEntry.requestParams,
					};
				}

				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						isLoading: false,
					},
				};
				// Handle scroll indicator for answer messages
				if (scrollIndicatorState.value.isVisible) {
					scrollIndicatorState.value = {
						...scrollIndicatorState.value,
						isAnswerMessage: true,
					};
				}
				// Clear queue and force immediate IDLE status
				statusQueue.reset({
					status: ApiStatus.IDLE,
					timestamp: Date.now(),
					statementCount: data.logDataEntry.conversationStats.statementCount,
					sequence: Number.MAX_SAFE_INTEGER,
				});
			}
		};

		const handleVersionInfo = (_versionInfo: VersionInfo) => {
			if (!mounted) return;
			// Update local state
			//chatState.value = {
			//	...chatState.value,
			//	versionInfo,
			//};
			// Update version context
			//setVersionInfo(versionInfo);
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
				status: {
					...chatState.value.status,
					isLoading: false,
					apiStatus: ApiStatus.IDLE,
					error: errorMessage,
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
				status: {
					...chatState.value.status,
					error: null,
				},
			};
		};

		wsManager.on('statusChange', handleStatusChange);
		wsManager.on('readyChange', handleReadyChange);
		wsManager.on('message', handleMessage);
		wsManager.on('cancelled', handleCancelled);
		wsManager.on('error', handleError);
		wsManager.on('clearError', handleClearError);
		wsManager.on('progressStatus', handleProgressStatus);
		wsManager.on('promptCacheTimer', handlePromptCacheTimer);
		wsManager.on('versionInfo', handleVersionInfo);

		return () => {
			console.log('useChatState: WebSocket event handlers cleanup', {
				hasWsManager: !!chatState.value.wsManager,
				wsManagerType: chatState.value.wsManager?.constructor.name,
			});
			mounted = false;
			wsManager.off('statusChange', handleStatusChange);
			wsManager.off('readyChange', handleReadyChange);
			wsManager.off('message', handleMessage);
			wsManager.off('cancelled', handleCancelled);
			wsManager.off('error', handleError);
			wsManager.off('clearError', handleClearError);
			wsManager.off('progressStatus', handleProgressStatus);
			wsManager.off('promptCacheTimer', handlePromptCacheTimer);
			wsManager.off('versionInfo', handleVersionInfo);
			statusQueue.reset();
		};
	}, [chatState.value.wsManager]);

	// Message and conversation handlers
	const handlers: ChatHandlers = {
		// Scroll indicator handlers
		updateScrollVisibility: (isAtBottom: boolean) => {
			scrollIndicatorState.value = {
				...scrollIndicatorState.value,
				isVisible: !isAtBottom,
				// Reset counts when scrolled to bottom
				unreadCount: isAtBottom ? 0 : scrollIndicatorState.value.unreadCount,
				isAnswerMessage: isAtBottom ? false : scrollIndicatorState.value.isAnswerMessage,
			};
		},

		/*
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
		 */

		sendConverse: async (message: string, requestParams?: LLMRequestParams, attachedFiles?: LLMAttachedFiles) => {
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
				await chatState.value.wsManager.sendConverse(message, requestParams, attachedFiles);
			} catch (error) {
				console.error('Failed to send message:', error);
				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						apiStatus: ApiStatus.IDLE,
						error: 'Failed to send message. Please try again.',
					},
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
				const conversation = (id && appState.value.projectId)
					? await chatState.value.apiClient.getConversation(
						id,
						appState.value.projectId,
					)
					: null;
				console.log(`useChatState: selectConversation for ${id}: loaded`, conversation?.logDataEntries);

				// Update conversation ID and logDataEntries
				chatState.value = {
					...chatState.value,
					conversationId: id,
					logDataEntries: conversation?.logDataEntries || [],
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
						error: 'Failed to load conversation. Please try again.',
					},
				};
				throw error;
			}
		},

		clearConversation: () => {
			chatState.value = {
				...chatState.value,
				logDataEntries: [],
				status: { ...chatState.value.status, apiStatus: ApiStatus.IDLE },
			};
		},

		clearError: () => {
			chatState.value = {
				...chatState.value,
				status: {
					...chatState.value.status,
					error: null,
				},
			};
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
					status: {
						...chatState.value.status,
						error: 'Failed to cancel processing. Please try again.',
					},
				};
				throw error;
			}
		},
	};

	//return [chatState, handlers, scrollIndicatorState];
	return [handlers, scrollIndicatorState];
}
