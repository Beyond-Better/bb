import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import { computed, Signal } from '@preact/signals';
import { JSX } from 'preact';
type MouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement | HTMLLIElement | HTMLDivElement>;
import { IS_BROWSER } from '$fresh/runtime.ts';

import { useChatState } from '../hooks/useChatState.ts';
import { setConversation, useAppState } from '../hooks/useAppState.ts';
import type { ChatConfig, ChatState, ConversationListState } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import { getDefaultTokenUsage, hasLogEntry, isConversationStart } from '../utils/typeGuards.utils.ts';
import { MessageEntry } from '../components/MessageEntry.tsx';
import { ConversationList } from '../components/ConversationList.tsx';
import { Toast } from '../components/Toast.tsx';
import { Button } from '../components/Button.tsx';
import { AnimatedNotification } from '../components/AnimatedNotification.tsx';
import { useVersion } from '../hooks/useVersion.ts';
import { useProjectState } from '../hooks/useProjectState.ts';

import { ChatInput } from '../components/ChatInput.tsx';
// ConversationHeader has been deprecated in favor of ChatMetadata
// ProjectMetadata is now handled in routes/chat/index.tsx
import { ConversationInfo } from '../components/ConversationInfo.tsx';
import { ApiStatus } from 'shared/types.ts';
import { ToolBar } from '../components/ToolBar.tsx';
import type {
	Conversation,
	ConversationEntry,
	ConversationLogEntry,
	ConversationMetadata,
	TokenUsage,
} from 'shared/types.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';
import { getApiHostname, getApiPort, getApiUrl, getApiUseTls, getUrlParams, getWsUrl } from '../utils/url.utils.ts';

// Helper functions for URL parameters
const getConversationId = () => {
	const params = new URLSearchParams(globalThis.location.search);
	return params?.get('conversationId') || null;
};

// Project ID is now managed by useProjectState

interface ChatProps {
	chatState: Signal<ChatState>;
}

export default function Chat({
	chatState,
}: ChatProps): JSX.Element {
	//console.log('Chat: Component mounting');
	// Initialize version checking
	const { versionCompatibility } = useVersion();
	const appState = useAppState();


	// Get project state
	const { state: projectState } = useProjectState(appState);
	// Use projectId from projectState
	const projectId = projectState.value.selectedProjectId || '.';
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [input, setInput] = useState('');
	const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

	interface ChatInputRef {
		textarea: HTMLTextAreaElement;
		adjustHeight: () => void;
	}

	const chatInputRef = useRef<ChatInputRef>(null);

	// Refs
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Initialize chat configuration
	const apiHostname = getApiHostname();
	const apiPort = getApiPort();
	const apiUseTls = getApiUseTls();

	if (!apiHostname || !apiPort) {
		return (
			<div className='flex items-center justify-center h-screen'>
				<AnimatedNotification
					visible={true}
					type='error'
				>
					<span>Missing required URL parameters. Expected format: #apiHostname=host&apiPort=port</span>
				</AnimatedNotification>
			</div>
		);
	}

	const config: ChatConfig = {
		apiUrl: getApiUrl(apiHostname, apiPort, apiUseTls),
		wsUrl: getWsUrl(apiHostname, apiPort, apiUseTls),

		onMessage: (message) => console.log('ChatIsland: WebSocket message received:', message),
		onError: (error) => console.error('ChatIsland: WebSocket error:', error),
		onClose: () => console.log('ChatIsland: WebSocket closed'),
		onOpen: () => console.log('ChatIsland: WebSocket opened'),
	};

	//const [chatState, handlers, scrollIndicatorState] = useChatState(config);
	const [handlers, scrollIndicatorState] = useChatState(config, chatState);

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
		// Update lastApiCallTime when sending a message
		chatState.value.status.lastApiCallTime = Date.now();
		chatState.value.status.cacheStatus = 'active';
		if (!input.trim() || !chatState.value.status.isReady || isProcessing(chatState.value.status)) return;

		const trimmedInput = input.trim();
		const maxRetries = 3;

		try {
			await handlers.sendConverse(trimmedInput);
			setInput('');
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
				await handlers.clearConversation();
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

		setInput('');

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
				return (event.returnValue = 'Claude is still working. Are you sure you want to leave?');
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
		if (!chatState.value.status.isReady && !chatState.value.error) {
			// Delay showing disconnection message
			disconnectTimeoutId = setTimeout(() => {
				if (!chatState.value.status.isReady && !chatState.value.error) {
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
	}, [chatState.value.status.isReady, chatState.value.status.isConnecting, chatState.value.error]);

	const conversationListState = computed<ConversationListState>(() => ({
		conversations: chatState.value.conversations,
		selectedId: chatState.value.conversationId,
		isLoading: chatState.value.status.isLoading,
	}));

	return (
		<div className='flex flex-col h-full bg-gray-50 overflow-hidden relative'>
			{/* Connection status banner */}
			<AnimatedNotification
				visible={chatState.value.status.isConnecting && !chatState.value.error}
				type='warning'
			>
				<div className='flex items-center justify-center'>
					<span>Connection lost. Attempting to reconnect...</span>
				</div>
			</AnimatedNotification>

			{/* ProjectMetadata is now handled in routes/chat/index.tsx */}

			{/* Main content */}
			<div className='flex flex-1 min-h-0'>
				{/* Conversation list */}
				<ConversationList
					conversationListState={conversationListState}
					onSelect={async (id) => {
						await selectConversation(id);
					}}
					onNew={async () => {
						const id = generateConversationId();
						await selectConversation(id);
					}}
					onDelete={deleteConversation}
				/>

				{/* Chat area */}
				<main className='flex-1 flex flex-col min-h-0 bg-white overflow-hidden w-full relative'>
					{/* ConversationInfo and ToolBar row */}
					<div className='py-3 px-4 border-b border-gray-200 flex justify-between items-center bg-white shadow-sm'>
						<div className='flex items-center space-x-4'>
							{/* Messages Icon */}
							<div className='flex items-center text-gray-500'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth={1.5}
									stroke='currentColor'
									className='w-6 h-6'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z'
									/>
								</svg>
							</div>
							<ConversationInfo
								logEntries={chatState.value.logEntries}
								conversationId={chatState.value.conversationId || ''}
								title={chatState.value.conversations.find((c: ConversationMetadata) =>
									c.id === chatState.value.conversationId
								)?.title}
							/>
						</div>

						<ToolBar
							onSendMessage={async (message) => {
								await handlers.sendConverse(message);
							}}
							chatInputRef={chatInputRef}
							disabled={!chatState.value.status.isReady || isProcessing(chatState.value.status)}
							projectId={projectId}
							apiClient={chatState.value.apiClient!}
						/>
					</div>

					{/* Messages */}
					<div className='flex-1 min-h-0 relative flex flex-col'>
						{scrollIndicatorState.value.isVisible && (
							<button
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
							{chatState.value.logEntries.length === 0 && !isProcessing(chatState.value.status) && (
								<div className='flex flex-col items-center justify-center min-h-[400px] text-gray-500'>
									<svg
										className='w-12 h-12 mb-4 text-gray-400'
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
									<p className='text-lg font-medium'>No messages yet</p>
									<p className='text-sm'>Type a message to begin</p>
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
					<div className='border-t border-gray-200 flex-none bg-white flex justify-center'>
						<ChatInput
							value={input}
							apiClient={chatState.value.apiClient!}
							projectId={projectId}
							textareaRef={chatInputRef}
							onChange={(value) => {
								if (!chatState.value.status.isReady) return;
								setInput(value.slice(0, 10000));
							}}
							onSend={sendConverse}
							status={chatState.value.status}
							disabled={!chatState.value.status.isReady}
							onCancelProcessing={handlers.cancelProcessing}
							maxLength={10000}
						/>
					</div>
				</main>
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
				visible={!!chatState.value.error}
				type='error'
			>
				<div className='flex items-center justify-between'>
					<span>{chatState.value.error}</span>
					<button
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
