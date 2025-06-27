import { useEffect } from 'preact/hooks';
import { Signal, signal, useComputed } from '@preact/signals';
import { StatusQueue } from '../utils/statusQueue.utils.ts';
import { notificationManager } from '../utils/notificationManager.ts';
//import { userPersistenceManager } from '../storage/userPersistence.ts';
import { ApiStatus } from 'shared/types.ts';
//import { useVersion } from './useVersion.ts';
import { useProjectState } from './useProjectState.ts';
import { type AppState, useAppState } from '../hooks/useAppState.ts';

import type { CollaborationLogDataEntry, ProgressStatusMessage, PromptCacheTimerMessage } from 'shared/types.ts';
//import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type { ChatConfig, ChatHandlers, ChatState } from '../types/chat.types.ts';
import type { LLMAttachedFiles, LLMRequestParams } from '../types/llm.types.ts';
//import { isProcessing } from '../types/chat.types.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';
import type { WebSocketManager } from '../utils/websocketManager.utils.ts';
import { createApiClientManager } from '../utils/apiClient.utils.ts';
import { createWebSocketManager } from '../utils/websocketManager.utils.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import type { VersionInfo } from 'shared/types/version.ts';

import { generateCollaborationId, shortenCollaborationId } from 'shared/generateIds.ts';
import { addLogDataEntry, createNestedLogDataEntries } from 'shared/utils/logEntries.ts';
import { getWorkingApiUrl } from '../utils/connectionManager.utils.ts';

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

// deno-lint-ignore require-await
export async function initializeChat(
	chatConfig: Signal<ChatConfig>,
	appState: Signal<AppState>,
): Promise<InitializationResult> {
	console.log('useChatState: initializeChat: Starting with config', {
		apiUrl: chatConfig.value.apiUrl,
		wsUrl: chatConfig.value.wsUrl,
		projectId: appState.value.projectId,
	});

	// Create API client first
	const apiClient = createApiClientManager(chatConfig.value.apiUrl);

	// Create WebSocket manager last
	const wsManager = createWebSocketManager({
		wsUrl: chatConfig.value.wsUrl,
		apiUrl: chatConfig.value.apiUrl,
		projectId: appState.value.projectId || '',
		onMessage: chatConfig.value.onMessage,
		onError: chatConfig.value.onError,
		onClose: chatConfig.value.onClose,
		onOpen: chatConfig.value.onOpen,
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

const randomStringForEffect = (length: number): string => {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export function useChatState(
	chatConfig: Signal<ChatConfig>,
	chatState: Signal<ChatState>,
	_chatInputOptions?: Signal<LLMRequestParams>,
): [ChatHandlers, Signal<ScrollIndicatorState>] {
	// Get project state
	const appState = useAppState();
	const { state: projectState } = useProjectState(appState);
	//let mounted = false;

	// Create computed signal for project data
	const projectData = useComputed(() => {
		const project = projectState.value.projects.find((p) => p.data.projectId === appState.value.projectId);
		return project
			? {
				projectId: project.data.projectId,
				name: project.data.name,
				status: project.data.status,
				// Using new data source structure
				primaryDataSourceRoot: project.data.primaryDsConnection?.config.dataSourceRoot,
				dsConnections: project.data.dsConnections || [],
				//defaultModels: project.data.defaultModels || DefaultModelsConfigDefaults,
				repoInfo: {
					tokenLimit: 1024,
				},
				// Note: Stats may need to be added elsewhere in the new structure
				stats: {
					collaborationCount: 0,
					totalTokens: 0,
					lastAccessed: new Date().toISOString(),
				},
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
	// 			// Load collaboration list before WebSocket setup
	// 		console.log('useChatState: got useEffect for projectId', appState.value.projectId);
	// 			const collaborationResponse = await chatState.value.apiClient.listCollaborations(
	// 				appState.value.projectId,
	// 			);
	// 			if (!collaborationResponse) {
	// 				throw new Error('Failed to load collaborations');
	// 			}
	// 			const collaborations = collaborationResponse.collaborations;
	//
	// 			// Load collaboration data first
	// 			const collaboration = await chatState.value.apiClient.getCollaboration(
	// 				appState.value.collaborationId,
	// 				appState.value.projectId,
	// 			);
	// 			const logDataEntries = collaboration?.logDataEntries || [];
	// 			// Clear current chat state
	// 			chatState.value = {
	// 				...chatState.value,
	// 				collaborationId: appState.value.collaborationId ||'',
	// 				logDataEntries,
	// 				collaborations,
	// 				status: {
	// 					...chatState.value.status,
	// 					isLoading: false,
	// 				},
	// 			};
	// 		} else {
	// 			// Clear current chat state
	// 			chatState.value = {
	// 				...chatState.value,
	// 				collaborationId: '',
	// 				logDataEntries: [],
	// 				collaborations: [],
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
		const effectId = randomStringForEffect(8);
		//console.log(`useChatState: url/projectId effect[${effectId}]: got useEffect for config initialize`, {
		//	apiUrl: chatConfig.value.apiUrl,
		//	wsUrl: chatConfig.value.wsUrl,
		//	projectId: appState.value.projectId,
		//});

		let mounted = true;
		//mounted = true;
		let currentWsManager: WebSocketManager | null = null;

		async function initialize() {
			//const initStart = performance.now();
			// console.debug(`useChatState: url/projectId effect[${effectId}]: Starting initialization`);
			// console.log(`useChatState: url/projectId effect[${effectId}]: initialize called`, {
			// 	mounted,
			// 	existingWsManager: chatState.value.wsManager?.constructor.name,
			// 	existingApiClient: chatState.value.apiClient?.constructor.name,
			// });
			try {
				if (!chatConfig.value.apiUrl || !chatConfig.value.wsUrl) {
					// Auto-detect the working protocol
					// const originalApiUrl = chatConfig.value.apiUrl;
					// const originalWsUrl = chatConfig.value.wsUrl;

					const { apiUrl, wsUrl, fallbackUsed: _fallbackUsed } = await getWorkingApiUrl();

					chatConfig.value = {
						...chatConfig.value,
						apiUrl,
						wsUrl,
					};

					// console.log(`useChatState: url/projectId effect[${effectId}]: set URLs for chatConfig, bailing`, {
					// 	apiUrl,
					// 	wsUrl,
					// 	fallbackUsed,
					// 	originalApiUrl,
					// 	originalWsUrl,
					// });

					return;
				}

				// Set initial loading state
				chatState.value = {
					...chatState.value,
					status: { ...chatState.value.status, isLoading: true },
				};

				// Try to get a working connection with protocol detection
				let apiClient;
				let wsManager;

				try {
					// Use the detected working URLs
					const initResult = await initializeChat(
						chatConfig,
						appState,
					);

					apiClient = initResult.apiClient;
					wsManager = initResult.wsManager;
				} catch (error) {
					console.error(
						`useChatState: url/projectId effect[${effectId}]: Protocol detection failed, using original URLs:`,
						error,
					);

					// Fall back to original URLs if protocol detection fails
					const initResult = await initializeChat(chatConfig, appState);
					apiClient = initResult.apiClient;
					wsManager = initResult.wsManager;
				}

				// Load collaboration list before WebSocket setup
				const collaborationResponse = appState.value.projectId
					? await apiClient.listCollaborations(appState.value.projectId)
					: null;
				if (!collaborationResponse) {
					throw new Error('Failed to load collaborations');
				}
				const collaborations = collaborationResponse.collaborations;
				console.log(
					`useChatState: url/projectId effect[${effectId}]: initialize-collaborations`,
					collaborations,
				);
				const totalCollaborations = collaborationResponse.pagination.totalItems; // Total number of saved collaborations - collaborations array is a paginated subset
				const collaborationsPagination = collaborationResponse.pagination;

				// Get collaboration ID from URL if it exists, or create a new one
				const params = new URLSearchParams(globalThis.location.search);
				const urlCollaborationId = params.get('collaborationId');
				const collaborationId = urlCollaborationId || chatState.value.collaborationId ||
					appState.value.collaborationId || shortenCollaborationId(generateCollaborationId());

				// Load collaboration data first
				const collaboration = (collaborationId && appState.value.projectId)
					? await apiClient.getCollaboration(
						collaborationId,
						appState.value.projectId,
					)
					: null;
				// if (collaboration?.lastInteractionMetadata) {
				// 	collaboration.lastInteractionMetadata.tokenUsageStatsForInteraction.tokenUsageCollaboration =
				// 		collaboration.tokenUsageCollaboration;
				// }
				console.log(`useChatState: url/projectId effect[${effectId}]: initialize-collaboration`, collaboration);
				// const interaction = (collaboration && appState.value.projectId)
				// 	? await apiClient.getInteraction(
				// 		collaborationId,
				// 		collaboration.lastInteractionId || '',
				// 		appState.value.projectId,
				// 	)
				// 	: null;
				// console.log(`useChatState: url/projectId effect[${effectId}]: initialize-interaction`, interaction);
				const logDataEntries = createNestedLogDataEntries(collaboration?.logDataEntries || []);
				// console.log(
				// 	`useChatState: url/projectId effect[${effectId}]: initialize-logDataEntries`,
				// 	logDataEntries,
				// );

				// Update collaborations array with the loaded collaboration
				const updatedCollaborations = [...collaborations];
				if (collaboration) {
					//console.log(`useChatState: url/projectId effect[${effectId}]: initialize-collaboration`, collaboration);
					const existingIndex = updatedCollaborations.findIndex((c) => c.id === collaboration.id);
					if (existingIndex >= 0) {
						// Update existing collaboration
						updatedCollaborations[existingIndex] = collaboration;
					} else {
						// Add new collaboration
						updatedCollaborations.push(collaboration);
					}
				}

				if (!mounted) {
					// console.log(`useChatState: url/projectId effect[${effectId}]: not mounted, bailing`);
					wsManager?.disconnect();
					return;
				}

				// Update state with initial data
				chatState.value = {
					...chatState.value,
					apiClient,
					wsManager,
					collaborationId,
					collaborations: updatedCollaborations,
					selectedCollaboration: collaboration, // Set selected collaboration directly
					totalCollaborations,
					collaborationsPagination,
					logDataEntries,
				};

				currentWsManager = wsManager;

				// Initialize WebSocket connection last and wait for ready state
				try {
					await wsManager.setCollaborationId(collaborationId);

					// Wait for WebSocket to be ready with a longer timeout
					await new Promise<void>((resolve, reject) => {
						const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 10000); // Increased from 5000
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
				} catch (error) {
					console.error(
						`useChatState: url/projectId effect[${effectId}]: Failed to establish WebSocket connection:`,
						error,
					);
					throw new Error(
						`WebSocket connection failed: ${error instanceof Error ? error.message : String(error)}`,
					);
				}

				// console.debug(`useChatState: url/projectId effect[${effectId}]: Initialization complete`, {
				// 	// duration: initDuration.toFixed(2) + 'ms',
				// 	logDataEntriesCount: chatState.value.logDataEntries.length,
				// 	collaborationsCount: chatState.value.collaborations.length,
				// });

				// Update final status
				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						isLoading: false,
						// [TODO] we should be letting the `collaborationReady` websocket event set isReady via the readyChange handler
						// but there is a race condition that needs to be resolved, so forcing it here for now
						isReady: true,
					},
				};
			} catch (error) {
				console.error(`useChatState: url/projectId effect[${effectId}]: initialization error:`, error);
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
			// console.log(`useChatState: url/projectId effect[${effectId}]: cleanup`, {
			// 	currentWsManager: currentWsManager?.constructor.name,
			// 	existingWsManager: chatState.value.wsManager?.constructor.name,
			// 	mounted,
			// });
			mounted = false;
			if (currentWsManager) {
				currentWsManager.disconnect();
				// Reset chatState to initial state
				chatState.value = {
					...chatState.value,
					wsManager: null,
					apiClient: null,
					selectedCollaboration: null,
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
	}, [chatConfig.value.apiUrl, chatConfig.value.wsUrl, appState.value.projectId]);

	// WebSocket event handlers
	useEffect(() => {
		// console.log('useChatState: wsManager effect: useEffect', {
		// 	hasWsManager: !!chatState.value.wsManager,
		// 	wsManagerType: chatState.value.wsManager?.constructor.name,
		// });
		if (!chatState.value.wsManager) return;

		let mounted = true;
		//mounted = true;

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

		const handleStatusChange = (connected: boolean) => {
			// console.log('useChatState: wsManager effect: Handling statusChange', {
			// 	mounted,
			// 	connected,
			// 	isReady: chatState.value.status.isReady,
			// 	isLoading: chatState.value.status.isLoading,
			// });
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
			// console.log('useChatState: wsManager effect: Handling readyChange', {
			// 	mounted,
			// 	ready,
			// 	isLoading: chatState.value.status.isLoading,
			// });
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

		const handleMessage = async (data: { msgType: string; logDataEntry: CollaborationLogDataEntry }) => {
			const startTime = performance.now();
			// console.debug('useChatState: wsManager effect: Processing message:', {
			// 	type: data.msgType,
			// 	currentLogEntries: chatState.value.logDataEntries.length,
			// 	timestamp: new Date().toISOString(),
			// });
			console.debug('useChatState: handleMessage: Processing message:', data.msgType);
			// Get current project for stats updates
			const currentProject = projectState.value.projects.find((p) =>
				p.data.projectId === appState.value.projectId
			);
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

			// Handle new collaboration message
			if (data.msgType === 'collaborationNew') {
				// Update project stats for new collaboration
				//await updateProjectStats(currentProject.projectId, {
				//	collaborationCount: (currentProject.stats?.collaborationCount || 0) + 1,
				//	totalTokens: currentProject.stats?.totalTokens || 0,
				//	lastAccessed: new Date().toISOString(),
				//});

				// Load collaboration data first
				if (!chatState.value.apiClient) {
					console.error('useChatState: handleMessage: apiClient is null before getCollaboration');
					throw new Error('Chat API client was lost during collaboration load');
				}
				const collaboration = (data.logDataEntry.collaborationId && appState.value.projectId)
					? await chatState.value.apiClient.getCollaboration(
						data.logDataEntry.collaborationId,
						appState.value.projectId,
					)
					: null;
				// if (collaboration?.lastInteractionMetadata) {
				// 	collaboration.lastInteractionMetadata.tokenUsageStatsForInteraction.tokenUsageCollaboration =
				// 		collaboration.tokenUsageCollaboration;
				// }
				// const interaction = (collaboration && appState.value.projectId)
				// 	? await chatState.value.apiClient.getInteraction(
				// 		id,
				// 		collaboration.lastInteractionId || '',
				// 		appState.value.projectId,
				// 	)
				// 	: null;
				console.log(
					`useChatState: handleMessage: collaborationNew for ${data.logDataEntry.collaborationId}: loaded`,
					collaboration,
				);

				// Update collaborations array with the loaded collaboration
				const updatedCollaborations = [...chatState.value.collaborations];
				//if (data.logDataEntry.collaborationId) {
				if (collaboration) {
					const existingIndex = updatedCollaborations.findIndex((c) =>
						c.id === data.logDataEntry.collaborationId
					);

					if (existingIndex >= 0) {
						// Update existing collaboration
						updatedCollaborations[existingIndex] = collaboration;
					} else {
						// Add new collaboration
						updatedCollaborations.push(collaboration);
					}
				}

				// Update selectedCollaboration if it's the current collaboration being created
				const updatedSelectedCollaboration =
					data.logDataEntry.collaborationId === chatState.value.collaborationId
						? collaboration
						: chatState.value.selectedCollaboration;

				chatState.value = {
					...chatState.value,
					collaborations: updatedCollaborations,
					selectedCollaboration: updatedSelectedCollaboration,
				};
				return;
			}

			// Handle collaboration deletion
			if (data.msgType === 'collaborationDeleted') {
				// Update project stats for deleted collaboration
				const deletedCollaboration = chatState.value.collaborations.find((c) =>
					c.id === data.logDataEntry.collaborationId
				);
				if (deletedCollaboration) {
					// await updateProjectStats(currentProject.projectId, {
					// 	collaborationCount: Math.max(0, (currentProject.stats?.collaborationCount || 1) - 1),
					// 	totalTokens: Math.max(
					// 		0,
					// 		(currentProject.stats?.totalTokens || 0) -
					// 			(deletedCollaboration.tokenUsageInteraction?.totalTokens || 0),
					// 	),
					// 	lastAccessed: new Date().toISOString(),
					// });
				}
				const deletedId = data.logDataEntry.collaborationId;
				chatState.value = {
					...chatState.value,
					collaborations: chatState.value.collaborations.filter((collab) => collab.id !== deletedId),
					// Clear current collaboration if it was deleted
					collaborationId: chatState.value.collaborationId === deletedId
						? null
						: chatState.value.collaborationId,
					// Clear selectedCollaboration if it was deleted
					selectedCollaboration: chatState.value.selectedCollaboration?.id === deletedId
						? null
						: chatState.value.selectedCollaboration,
					// Clear log entries if current collaboration was deleted
					logDataEntries: chatState.value.collaborationId === deletedId ? [] : chatState.value.logDataEntries,
				};
				return;
			}

			// Handle continue/answer messages
			if (!mounted) return;

			// Only process messages for the current collaboration
			if (data.logDataEntry.collaborationId !== chatState.value.collaborationId) return;

			// Update log entries and collaboration stats
			const updatedCollaborations = chatState.value.collaborations.map((collab) => {
				if (
					collab.id === data.logDataEntry.collaborationId && // only update the current collaboration
					data.logDataEntry.logEntry // and only if we have a valid logEntry
				) {
					const newCollab = { ...collab };
					if (
						// update collaborationParams if there is a rolesModelConfig and all the roles are not null
						data.logDataEntry.collaborationParams?.rolesModelConfig &&
						Object.values(data.logDataEntry.collaborationParams.rolesModelConfig).some((config) =>
							config !== null
						)
					) {
						console.info('useChatState: handleMessage: Updating newCollab.collaborationParams');
						newCollab.collaborationParams = data.logDataEntry.collaborationParams;
					}

					if (
						data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageCollaboration?.totalAllTokens &&
						data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageCollaboration.totalAllTokens > 0 // but only if the values are not zero
					) {
						console.info(
							'useChatState: handleMessage: Updating newCollab.tokenUsageStatsForCollaboration',
							data.logDataEntry.tokenUsageStatsForCollaboration,
						);
						newCollab.tokenUsageCollaboration =
							data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageCollaboration;
					}

					// if (
					// 	// update the common values for lastInteractionMetadata - in particular the counts in interactionStats
					// 	collab.lastInteractionId === data.logDataEntry.interactionId && //  only if this logDataEntry is for the top-level interaction (not a chat interaction)
					// 	!data.logDataEntry.agentInteractionId && // and only if this logDataEntry is not an agent interaction
					// 	newCollab.lastInteractionMetadata &&
					// 	data.logDataEntry.logEntry.entryType !== 'auxiliary' // but not if it's an auxiliary logEntry
					// ) {
					// 	console.info(
					// 		'useChatState: handleMessage: Updating newCollab.lastInteractionMetadata [general]',
					// 		data.logDataEntry.interactionStats,
					// 	);
					// 	newCollab.lastInteractionMetadata = {
					// 		...newCollab.lastInteractionMetadata,
					// 		interactionStats: data.logDataEntry.interactionStats,
					// 		modelConfig: data.logDataEntry.modelConfig,
					// 		//createdAt: data.logDataEntry.createdAt,
					// 		updatedAt: data.logDataEntry.updatedAt,
					// 	};
					// }

					if (
						// update the tokenUsageStats
						collab.lastInteractionId === data.logDataEntry.interactionId && //  only if this logDataEntry is for the top-level interaction (not a chat interaction)
						!data.logDataEntry.agentInteractionId && // and only if this logDataEntry is not an agent interaction
						newCollab.lastInteractionMetadata &&
						data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageTurn.totalAllTokens &&
						data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageTurn.totalAllTokens > 0 && // but only if the values are not zero
						['assistant', 'tool_use', 'answer'].includes(data.logDataEntry.logEntry.entryType) // and only if a "token usage" type turn
					) {
						newCollab.tokenUsageCollaboration =
							data.logDataEntry.tokenUsageStatsForCollaboration.tokenUsageCollaboration;
						newCollab.lastInteractionMetadata = {
							...newCollab.lastInteractionMetadata,
							tokenUsageStatsForInteraction: data.logDataEntry.tokenUsageStatsForCollaboration,
							interactionStats: data.logDataEntry.interactionStats,
							modelConfig: data.logDataEntry.modelConfig,
							//createdAt: data.logDataEntry.createdAt,
							updatedAt: data.logDataEntry.updatedAt,
						};
						console.info('useChatState: handleMessage: Updating newCollab', newCollab);
					}
					return newCollab;
				}
				return collab;
			});

			// Update selectedCollaboration if it's the current collaboration being updated
			const updatedSelectedCollaboration = data.logDataEntry.collaborationId === chatState.value.collaborationId
				? updatedCollaborations.find((c) => c.id === data.logDataEntry.collaborationId) ||
					chatState.value.selectedCollaboration
				: chatState.value.selectedCollaboration;

			chatState.value = {
				...chatState.value,
				collaborations: updatedCollaborations,
				selectedCollaboration: updatedSelectedCollaboration,
				logDataEntries: (() => {
					const newEntries = addLogDataEntry(chatState.value.logDataEntries, data.logDataEntry);
					console.debug('useChatState: wsManager effect: Updated logDataEntries', {
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
			// console.log('useChatState: wsManager effect: handleMessage-logDataEntries', chatState.value.logDataEntries);

			if (scrollIndicatorState.value.isVisible) {
				scrollIndicatorState.value = {
					...scrollIndicatorState.value,
					unreadCount: scrollIndicatorState.value.unreadCount + 1,
				};
			}

			// If this is an answer from top-level interaction, end processing and set idle state
			if (data.msgType === 'answer') {
				// const collaboration = chatState.value.collaborations.find((collab) =>
				// 	collab.id === data.logDataEntry.collaborationId
				// );
				// if (
				// 	collaboration?.lastInteractionId &&
				// 	collaboration.lastInteractionId === data.logDataEntry.interactionId // only if this logDataEntry is for the top-level interaction
				// ) {
				if (!data.logDataEntry.agentInteractionId) { // this is not logDataEntry for agentInteraction, so finalize the statement
					// Update project stats for token usage
					// const tokenUsage = data.logDataEntry.tokenUsageStats.tokenUsage?.totalTokens || 0;
					// await updateProjectStats(currentProject.projectId, {
					// 	collaborationCount: currentProject.stats?.collaborationCount || 1,
					// 	totalTokens: (currentProject.stats?.totalTokens || 0) + tokenUsage,
					// 	lastAccessed: new Date().toISOString(),
					// });

					// Update chatInputOptions with the request parameters from the response if available
					// if (chatInputOptions && data.logDataEntry.collaborationParams) {
					// 	console.info(
					// 		'useChatState: wsManager effect: Updating options from message response',
					// 		data.logDataEntry.collaborationParams,
					// 	);
					// 	chatInputOptions.value = {
					// 		...chatInputOptions.value,
					// 		rolesModelConfig: {
					// 			...chatInputOptions.value.rolesModelConfig,
					// 			...data.logDataEntry.collaborationParams.rolesModelConfig,
					// 		},
					// 	};
					// }

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

					// **TRIGGER NOTIFICATION** - Statement processing complete!
					console.info('useChatState: Sending Completion to notification manager');
					notificationManager.notifyStatementComplete(
						'Your statement has been processed and is ready for review',
					).then(() => {
						console.info('useChatState: Completion notification sent successfully');
					}).catch((error) => {
						console.warn('useChatState: Failed to send completion notification:', error);
					});

					// Clear queue and force immediate IDLE status
					statusQueue.reset({
						status: ApiStatus.IDLE,
						timestamp: Date.now(),
						statementCount: data.logDataEntry.interactionStats.statementCount,
						sequence: Number.MAX_SAFE_INTEGER,
					});
				}
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

		const handleProgressStatus = (data: ProgressStatusMessage) => {
			console.log('useChatState: wsManager effect: Received progressStatus:', data);
			if (!mounted) return;
			console.log('useChatState: wsManager effect: Adding message to status queue');
			statusQueue.addMessage({
				status: data.status,
				timestamp: Date.now(),
				statementCount: data.statementCount,
				sequence: data.sequence,
				metadata: data.metadata,
			});
		};

		const handlePromptCacheTimer = (data: PromptCacheTimerMessage) => {
			console.log('useChatState: wsManager effect: Received promptCacheTimer:', data);
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
				errorMessage = 'Lost connection to server. Attempting to reconnect...';
			} else if (error.message.includes('timeout')) {
				errorMessage = 'Request timed out. Please try again.';
			} else if (error.message.includes('collaboration')) {
				errorMessage = 'Error with collaboration. Please try refreshing the page.';
			}

			console.error(`useChatState: wsManager effect: Error in chat websocket: ${errorMessage}`, error);

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
			console.log('useChatState: wsManager effect: WebSocket event handlers cleanup', {
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

	// Message and collaboration handlers
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

		sendConverse: async (message: string, statementParams?: StatementParams, attachedFiles?: LLMAttachedFiles) => {
			if (!chatState.value.wsManager) {
				console.error('useChatState: sendConverse: wsManager is null');
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
					console.error('useChatState: sendConverse: wsManager is null before sending message');
					throw new Error('Chat WebSocket manager was lost during message send');
				}
				console.log(`useChatState: sendConverse statementParams: `, statementParams);
				await chatState.value.wsManager.sendConverse(message, statementParams, attachedFiles);
			} catch (error) {
				console.error('useChatState: sendConverse: Failed to send message:', error);
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

		selectCollaboration: async (id: string) => {
			console.log(`useChatState: selectCollaboration for ${id}`);
			if (!chatState.value.apiClient) {
				console.error('useChatState: selectCollaboration: apiClient is null');
				throw new Error('Chat API client is not initialized');
			}
			if (!chatState.value.wsManager) {
				console.error('useChatState: selectCollaboration: wsManager is null');
				throw new Error('Chat WebSocket manager is not initialized');
			}

			chatState.value = {
				...chatState.value,
				status: { ...chatState.value.status, isLoading: true },
			};

			try {
				// Load collaboration data first
				if (!chatState.value.apiClient) {
					console.error('useChatState: selectCollaboration: apiClient is null before getCollaboration');
					throw new Error('Chat API client was lost during collaboration load');
				}
				const collaboration = (id && appState.value.projectId)
					? await chatState.value.apiClient.getCollaboration(
						id,
						appState.value.projectId,
					)
					: null;
				// const interaction = (collaboration && appState.value.projectId)
				// 	? await chatState.value.apiClient.getInteraction(
				// 		id,
				// 		collaboration.lastInteractionId || '',
				// 		appState.value.projectId,
				// 	)
				// 	: null;
				//console.log(`useChatState: selectCollaboration for ${id}: loaded`, collaboration);

				// Update collaborations array with the loaded collaboration
				const updatedCollaborations = [...chatState.value.collaborations];
				if (collaboration) {
					const existingIndex = updatedCollaborations.findIndex((c) => c.id === collaboration.id);
					// const collaborationData = {
					// 	id: collaboration.id,
					// 	title: collaboration.title || 'Untitled Conversation',
					// 	collaborationParams: collaboration.collaborationParams,
					// 	tokenUsageStats: collaboration.lastInteractionMetadata?.tokenUsageStats,
					// 	modelConfig: collaboration.lastInteractionMetadata?.modelConfig,
					// 	interactionStats: collaboration.lastInteractionMetadata?.interactionStats,
					// 	llmProviderName: collaboration.lastInteractionMetadata?.llmProviderName || 'anthropic',
					// 	model: collaboration.lastInteractionMetadata?.model || 'claude-sonnet-4-20250514',
					// 	createdAt: collaboration.lastInteractionMetadata?.createdAt || new Date().toISOString(),
					// 	updatedAt: collaboration.lastInteractionMetadata?.updatedAt || new Date().toISOString(),
					// };

					if (existingIndex >= 0) {
						// Update existing collaboration
						updatedCollaborations[existingIndex] = collaboration;
					} else {
						// Add new collaboration
						updatedCollaborations.push(collaboration);
					}
				}

				// Update collaboration ID and logDataEntries
				chatState.value = {
					...chatState.value,
					collaborationId: id,
					collaborations: updatedCollaborations,
					selectedCollaboration: collaboration, // Set selected collaboration directly
					logDataEntries: collaboration?.logDataEntries || [],
					//status: { ...chatState.value.status, isLoading: false, isReady: true },
				};

				// Then set up WebSocket connection
				console.log(`useChatState: selectCollaboration for ${id}: setting id for wsManager`);
				if (!chatState.value.wsManager) {
					console.error('useChatState: selectCollaboration: wsManager is null before setCollaborationId');
					throw new Error('Chat WebSocket manager was lost during collaboration selection');
				}
				await chatState.value.wsManager.setCollaborationId(id);
			} catch (error) {
				console.error('useChatState: Failed to switch collaboration:', error);
				chatState.value = {
					...chatState.value,
					status: {
						...chatState.value.status,
						isLoading: false,
						apiStatus: ApiStatus.IDLE,
						error: 'Failed to load collaboration. Please try again.',
					},
				};
				throw error;
			}
		},

		clearCollaboration: () => {
			chatState.value = {
				...chatState.value,
				selectedCollaboration: null,
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
				console.error('useChatState: Failed to cancel processing:', error);
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
