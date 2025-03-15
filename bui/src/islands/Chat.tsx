import { useEffect, useRef, useState } from 'preact/hooks';
//import type { RefObject } from 'preact';
import { computed, Signal, signal } from '@preact/signals';
import { JSX } from 'preact';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { LLMRequestParams } from '../types/llm.types.ts';
import type { ModelCapabilities, ModelResponse } from '../utils/apiClient.utils.ts';

import { useChatState } from '../hooks/useChatState.ts';
import { setConversation, useAppState } from '../hooks/useAppState.ts';
import type { ChatConfig, ChatState, ConversationListState } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import { MessageEntry } from '../components/MessageEntry.tsx';
import { ConversationHeader } from '../components/ConversationHeader.tsx';
import { ConversationList } from '../components/ConversationList.tsx';
import { Toast } from '../components/Toast.tsx';
import { AnimatedNotification } from '../components/AnimatedNotification.tsx';
//import { useVersion } from '../hooks/useVersion.ts';
import { useProjectState } from '../hooks/useProjectState.ts';
import { ChatInput } from '../components/ChatInput.tsx';
//import { ToolBar } from '../components/ToolBar.tsx';
//import { ApiStatus } from 'shared/types.ts';
import type { ConversationEntry, ConversationMetadata } from 'shared/types.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { getApiHostname, getApiPort, getApiUrl, getApiUseTls, getWsUrl } from '../utils/url.utils.ts';

// Helper functions for URL parameters
const getConversationId = () => {
	const params = new URLSearchParams(globalThis.location.search);
	return params?.get('conversationId') || null;
};

const INPUT_MAX_CHAR_LENGTH = 25000;

// Default LLM request options
const defaultOptions: LLMRequestParams = {
  model: "claude-3-7-sonnet-20250219",
  temperature: 0.7,
  maxTokens: 8192,
  extendedThinking: {
    enabled: true,
    budgetTokens: 4096
  },
  usePromptCaching: true
};

// Helper to get options from conversation or defaults
const getOptionsFromConversation = (conversationId: string | null, conversations: any[]): LLMRequestParams => {
  if (!conversationId) return defaultOptions;
  
  const conversation = conversations.find(conv => conv.id === conversationId);
  if (!conversation || !conversation.requestParams) return defaultOptions;
  
  // Return conversation params with fallbacks to defaults
  return {
    ...defaultOptions,
    ...conversation.requestParams
  };
};

interface ChatProps {
	chatState: Signal<ChatState>;
}

// Initialize conversation list visibility state
const isConversationListVisible = signal(false);
const chatInputText = signal('');
const chatInputOptions = signal<LLMRequestParams>({...defaultOptions});
const modelCapabilities = signal<ModelCapabilities>({});

export default function Chat({
	chatState,
}: ChatProps): JSX.Element {
	//console.info('Chat: Component rendering');
	// Initialize version checking
	//const { versionCompatibility } = useVersion();
	const appState = useAppState();

	// Get project state and selectedProjectId signal
	//const { state: projectState, selectedProjectId } = useProjectState(appState);
	const { selectedProjectId } = useProjectState(appState);
	// Use projectId from selectedProjectId signal
	const projectId = selectedProjectId.value || null;
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

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

	// Initialize chat configuration
	const apiHostname = getApiHostname();
	const apiPort = getApiPort();
	const apiUseTls = getApiUseTls();
	//console.log('Chat: ', { apiHostname, apiPort, apiUseTls });

	const config: ChatConfig = {
		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),

		onMessage: (message) => console.log('ChatIsland: WebSocket message received:', message),
		onError: (error) => console.error('ChatIsland: WebSocket error:', error),
		onClose: () => console.log('ChatIsland: WebSocket closed'),
		onOpen: () => console.log('ChatIsland: WebSocket opened'),
	};

	//const [chatState, handlers, scrollIndicatorState] = useChatState(config);
	const [handlers, scrollIndicatorState] = useChatState(config, chatState, chatInputOptions);

	// Remove initial useEffect as projectData is now handled by computed signal in useChatState

	// Update cache status every 30 seconds
	useEffect(() => {
		if (!IS_BROWSER) return;
		console.log('Chat: status.lastApiCallTime effect running', chatState.value.status.lastApiCallTime);

		const updateCacheStatus = () => {
			console.log(
				'Chat: status.lastApiCallTime effect - updateCacheStatus',
				chatState.value.status.lastApiCallTime,
			);
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
			// Pass the options from the signal to the handler
			await handlers.sendConverse(trimmedInput, chatInputOptions.value);
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

	const transformEntry = (logEntryData: ConversationEntry): ConversationEntry => {
		// Simply return the entry as it's already a valid ConversationEntry
		// The type guards are used in the UI components to safely access properties
		return logEntryData;
	};

	const deleteConversation = async (id: string) => {
		try {
			if (!projectId) throw new Error('projectId is undefined for delete conversation');
			if (!chatState.value.apiClient) throw new Error('API client not initialized');
			if (!chatState.value.status.isReady) {
				throw new Error('WebSocket connection not ready. Please try again.');
			}

			// Prevent multiple simultaneous deletions
			if (isProcessing(chatState.value.status)) {
				throw new Error('Please wait for the current operation to complete');
			}

			await chatState.value.apiClient.deleteConversation(id, projectId);

			// Update conversations list immediately
			chatState.value = {
				...chatState.value,
				conversations: chatState.value.conversations.filter((conv: ConversationMetadata) => conv.id !== id),
			};

			// Handle currently selected conversation
			if (id === chatState.value.conversationId) {
				handlers.clearConversation();
				const url = new URL(globalThis.location.href);
				url.searchParams.delete('conversationId');
				const hash = globalThis.location.hash;
				globalThis.history.pushState({}, '', url.pathname + url.search + hash);
			}
		} catch (error) {
			console.error('Failed to delete conversation:', error);
			setToastMessage((error as Error).message || 'Failed to delete conversation');
			setShowToast(true);

			// If WebSocket is disconnected, wait for reconnection and retry
			if (!chatState.value.status.isReady) {
				const retryInterval = setInterval(() => {
					if (chatState.value.status.isReady) {
						clearInterval(retryInterval);
						deleteConversation(id).catch(console.error);
					}
				}, 1000);
				// Clear interval after 10 seconds
				setTimeout(() => clearInterval(retryInterval), 10000);
			}
		}
	};

	const selectConversation = async (id: string) => {
		try {
			await handlers.selectConversation(id);
			setConversation(id);

			// Update options based on the selected conversation
			chatInputOptions.value = getOptionsFromConversation(id, chatState.value.conversations);
			console.info('Chat: Updated options for selected conversation', id, chatInputOptions.value);
			
			// Fetch model capabilities for the selected model
			const modelName = chatInputOptions.value.model;
			if (modelName && chatState.value.apiClient) {
				try {
					const modelData = await chatState.value.apiClient.getModelCapabilities(modelName);
					if (modelData) {
						modelCapabilities.value = modelData.model.capabilities;
						console.info('Chat: Updated model capabilities', modelCapabilities.value);
					}
				} catch (error) {
					console.error('Chat: Failed to fetch model capabilities', error);
				}
			}

			// Update URL while preserving hash parameters
			//const url = new URL(globalThis.location.href);
			//url.searchParams.set('conversationId', id);
			//const hash = globalThis.location.hash;
			//globalThis.history.pushState({}, '', url.pathname + url.search + hash);
		} catch (error) {
			console.error('Failed to switch conversation:', error);
			setToastMessage('Failed to switch conversation');
			setShowToast(true);
			// Clear the conversation ID from URL on error
			const url = new URL(globalThis.location.href);
			url.searchParams.delete('conversationId');
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
		console.log('Chat: Navigation useEffect', { chatState: chatState.value });
		if (!IS_BROWSER) return;

		chatInputText.value = '';

		// Initialize options from current conversation
		if (chatState.value.conversationId) {
			chatInputOptions.value = getOptionsFromConversation(
				chatState.value.conversationId, 
				chatState.value.conversations
			);
			console.info('Chat: Initialized options from conversation', chatInputOptions.value);
			
			// Fetch model capabilities for the current model
			const modelName = chatInputOptions.value.model;
			if (modelName && chatState.value.apiClient) {
				chatState.value.apiClient.getModelCapabilities(modelName)
					.then(modelData => {
						if (modelData) {
							modelCapabilities.value = modelData.model.capabilities;
							console.info('Chat: Loaded model capabilities', modelCapabilities.value);
						}
					})
					.catch(error => console.error('Chat: Failed to fetch model capabilities', error));
			}
		}

		const handlePopState = async () => {
			const urlConversationId = getConversationId();
			if (urlConversationId && urlConversationId !== chatState.value.conversationId) {
				await selectConversation(urlConversationId);
			}
		};

		globalThis.addEventListener('popstate', handlePopState);
		return () => globalThis.removeEventListener('popstate', handlePopState);
	}, [chatState.value.conversationId]);

	// Handle scroll behavior
	useEffect(() => {
		console.log('Chat: Scroll useEffect');
		if (!messagesEndRef.current) return;

		const messagesContainer = messagesEndRef.current;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
			// Consider user at bottom if within 50 pixels of bottom
			const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
			const isAtBottom = distanceFromBottom <= 50;

			// Only log if something is changing
			// if (shouldAutoScroll !== isAtBottom || scrollIndicatorState.value.unreadCount > 0) {
			// 	console.log('ChatIsland: Scroll state:', {
			// 		distanceFromBottom,
			// 		isAtBottom,
			// 		shouldAutoScroll,
			// 		scrollIndicator: scrollIndicatorState.value,
			// 	});
			// }

			// Always update scroll indicator UI based on current scroll position
			handlers.updateScrollVisibility(isAtBottom);

			// Update auto-scroll behavior only when it changes
			if (shouldAutoScroll !== isAtBottom) {
				console.log('ChatIsland: Auto-scroll behavior changing to:', isAtBottom);
				setShouldAutoScroll(isAtBottom);
			}
		};

		// Add scroll event listener
		messagesContainer.addEventListener('scroll', handleScroll);

		// Auto-scroll only if at bottom
		if (shouldAutoScroll) {
			messagesContainer.scrollTo({
				top: messagesContainer.scrollHeight,
				behavior: 'smooth',
			});
		}

		return () => messagesContainer.removeEventListener('scroll', handleScroll);
	}, [chatState.value.logEntries, shouldAutoScroll]);

	// Handle page visibility and focus events at the component level
	useEffect(() => {
		console.log('Chat: Visibility useEffect');
		if (!IS_BROWSER) return;

		// Don't force scroll during processing - respect user's scroll position

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden' && isProcessing(chatState.value.status)) {
				console.log('ChatIsland: Page hidden while processing');
				setToastMessage('Statement in progress in background');
				setShowToast(true);
			}
		};

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (isProcessing(chatState.value.status)) {
				event.preventDefault();
				//return (event.returnValue = 'Claude is still working. Are you sure you want to leave?');
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		globalThis.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			console.log('Chat: Cleanup for useEffect');
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			globalThis.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [chatState.value.status.apiStatus]);

	useEffect(() => {
		console.log('Chat: Connection status useEffect');
		let disconnectTimeoutId: number;
		let reconnectTimeoutId: number;

		// Ignore connection changes during conversation switching
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

	const conversationListState = computed<ConversationListState>(() => ({
		conversations: chatState.value.conversations,
		selectedId: chatState.value.conversationId,
		isLoading: chatState.value.status.isLoading,
	}));

	if (!apiHostname || !apiPort) {
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
							{/* Collapsible Conversation List */}
							<div
								className={`absolute top-0 left-0 h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out z-40 ${
									isConversationListVisible.value
										? 'w-[30%] min-w-[20rem] translate-x-0'
										: 'w-0 -translate-x-full'
								}`}
							>
								<div className='h-full w-full overflow-hidden'>
									<ConversationList
										conversationListState={conversationListState}
										onSelect={async (id) => {
											await selectConversation(id);
											isConversationListVisible.value = false;
										}}
										onNew={async () => {
											const id = generateConversationId();
											await selectConversation(id);
											isConversationListVisible.value = false;
										}}
										onDelete={deleteConversation}
										onClose={() => isConversationListVisible.value = false}
									/>
								</div>
							</div>
							{/* Chat area */}
							<main className='flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 overflow-hidden w-full relative'>
								{/* ConversationHeader */}
								<ConversationHeader
									cacheStatus={chatState.value.status.cacheStatus}
									status={chatState.value.status}
									onSelect={selectConversation}
									onNew={async () => {
										const id = generateConversationId();
										await selectConversation(id);
									}}
									onDelete={deleteConversation}
									onToggleList={() =>
										isConversationListVisible.value = !isConversationListVisible.value}
									isListVisible={isConversationListVisible.value}
									apiClient={chatState.value.apiClient!}
									chatState={chatState}
									modelCapabilities={modelCapabilities}
									onSendMessage={async (message) => {
										await handlers.sendConverse(message);
									}}
									chatInputRef={chatInputRef}
									disabled={!chatState.value.status.isReady ||
										isProcessing(chatState.value.status)}
									projectId={projectId}
								/>

								{/* Messages */}
								<div className='flex-1 min-h-0 relative flex flex-col'>
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
											className={`absolute bottom-4 right-8 z-10 flex items-center gap-2 px-3 py-2 ${
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
										{chatState.value.logEntries.length === 0 &&
											!isProcessing(chatState.value.status) &&
											(
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
													<p className='text-lg font-medium dark:text-gray-300'>
														No messages yet
													</p>
													<p className='text-sm dark:text-gray-400'>
														Type a message to begin
													</p>
												</div>
											)}
										{chatState.value.logEntries.length > 0 &&
											chatState.value.logEntries.map((logEntryData, index) => (
												<MessageEntry
													key={index}
													logEntryData={transformEntry(logEntryData)}
													index={index}
													onCopy={handleCopy}
													apiClient={chatState.value.apiClient!}
													projectId={projectId}
													conversationId={chatState.value.conversationId!}
												/>
											))}
									</div>
								</div>

								{/* Input area */}
								<div className='border-t border-gray-200 dark:border-gray-700 flex-none bg-white dark:bg-gray-800 flex justify-center'>
									<ChatInput
										chatInputText={chatInputText}
										chatInputOptions={chatInputOptions}
										modelCapabilities={modelCapabilities}
										apiClient={chatState.value.apiClient!}
										projectId={projectId}
										textareaRef={chatInputRef}
										onChange={(value) => {
											if (!chatState.value.status.isReady) return;
											setInputWithTracking(value.slice(0, INPUT_MAX_CHAR_LENGTH));
										}}
										onSend={sendConverse}
										status={chatState.value.status}
										disabled={!chatState.value.status.isReady}
										onCancelProcessing={handlers.cancelProcessing}
										maxLength={INPUT_MAX_CHAR_LENGTH}
										conversationId={chatState.value.conversationId}
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
						className='ml-4 text-red-700 hover:text-red-800'
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
