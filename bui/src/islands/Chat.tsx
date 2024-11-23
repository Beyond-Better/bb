import { useEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import { computed } from '@preact/signals';
import { JSX } from 'preact';
type MouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement | HTMLLIElement | HTMLDivElement>;
import { IS_BROWSER } from '$fresh/runtime.ts';

import { useChatState } from '../hooks/useChatState.ts';
import type { ChatConfig, ConversationListState } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import {
	getDefaultConversationTokenUsage,
	getDefaultTokenUsage,
	hasLogEntry,
	isConversationStart,
} from '../utils/typeGuards.utils.ts';
import { MessageEntry } from '../components/MessageEntry.tsx';
import { ConversationList } from '../components/ConversationList.tsx';
import { Toast } from '../components/Toast.tsx';
import { AnimatedNotification } from '../components/AnimatedNotification.tsx';

import { ChatInput } from '../components/ChatInput.tsx';
import { ConversationHeader } from '../components/ConversationHeader.tsx';
import { ConversationMetadata } from '../components/ConversationMetadata.tsx';
import { ToolBar } from '../components/ToolBar.tsx';
import type {
	Conversation,
	ConversationEntry,
	ConversationLogEntry,
	ConversationTokenUsage,
	TokenUsage,
} from 'shared/types.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';

// Helper functions for URL parameters
const getHashParams = () => {
	if (!IS_BROWSER) return null;
	// console.log('Chat: URL parameters:', {
	// 	hash: window.location.hash,
	// 	params: params ? Object.fromEntries(params.entries()) : null,
	// });
	const hash = window.location.hash.slice(1);
	return new URLSearchParams(hash);
};

const getQueryParams = () => {
	if (!IS_BROWSER) return null;
	return new URLSearchParams(window.location.search);
};

const getUrlParams = () => {
	// For backward compatibility, return hash params
	return getHashParams();
};

const getConversationId = () => {
	const params = getQueryParams();
	return params?.get('conversationId') || null;
};

const getApiHostname = () => {
	const params = getUrlParams();
	return params?.get('apiHostname') || 'localhost';
};

const getApiPort = () => {
	const params = getUrlParams();
	return params?.get('apiPort') || '3000';
};

const getApiUseTls = () => {
	const params = getUrlParams();
	return params?.get('apiUseTls') === 'true';
};

const getStartDir = () => {
	const params = getUrlParams();
	const startDirFromHash = params?.get('startDir');
	const startDirFromStorage = IS_BROWSER ? localStorage.getItem('startDir') : null;
	return startDirFromHash || startDirFromStorage || '.';
};

const getApiUrl = (hostname: string, port: string, useTls: boolean): string => {
	return `${useTls ? 'https' : 'http'}://${hostname}:${port}`;
};

const getWsUrl = (hostname: string, port: string, useTls: boolean): string => {
	return `${useTls ? 'wss' : 'ws'}://${hostname}:${port}/api/v1/ws`;
};

export default function Chat(): JSX.Element {
	// State management
	const [startDir, setStartDir] = useState(getStartDir);
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [input, setInput] = useState('');
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
		startDir,

		onMessage: (message) => console.log('ChatIsland: WebSocket message received:', message),
		onError: (error) => console.error('ChatIsland: WebSocket error:', error),
		onClose: () => console.log('ChatIsland: WebSocket closed'),
		onOpen: () => console.log('ChatIsland: WebSocket opened'),
	};

	const [chatState, handlers] = useChatState(config);

	// Update cache status every 30 seconds
	useEffect(() => {
		if (!IS_BROWSER) return;

		const updateCacheStatus = () => {
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
	const updateStartDir = (newDir: string) => {
		setStartDir(newDir);
		if (IS_BROWSER && newDir) {
			localStorage.setItem('startDir', newDir);
		}
	};

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

			await chatState.value.apiClient.deleteConversation(id, startDir);

			// Update conversations list immediately
			chatState.value = {
				...chatState.value,
				conversations: chatState.value.conversations.filter((conv) => conv.id !== id),
			};

			// Handle currently selected conversation
			if (id === chatState.value.conversationId) {
				await handlers.clearConversation();
				const url = new URL(window.location.href);
				url.searchParams.delete('conversationId');
				const hash = window.location.hash;
				window.history.pushState({}, '', url.pathname + url.search + hash);
			}
		} catch (error) {
			console.error('Failed to delete conversation:', error);
			setToastMessage(error.message || 'Failed to delete conversation');
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
			// Update URL while preserving hash parameters
			const url = new URL(window.location.href);
			url.searchParams.set('conversationId', id);
			const hash = window.location.hash;
			window.history.pushState({}, '', url.pathname + url.search + hash);
		} catch (error) {
			console.error('Failed to switch conversation:', error);
			setToastMessage('Failed to switch conversation');
			setShowToast(true);
			// Clear the conversation ID from URL on error
			const url = new URL(window.location.href);
			url.searchParams.delete('conversationId');
			const hash = window.location.hash;
			window.history.pushState({}, '', url.pathname + url.search + hash);
		}
	};

	// Browser history navigation support
	// Handle cancel processing event
	useEffect(() => {
		const handleCancelProcessing = () => {
			handlers.cancelProcessing();
		};
		window.addEventListener('bb:cancel-processing', handleCancelProcessing);
		return () => window.removeEventListener('bb:cancel-processing', handleCancelProcessing);
	}, [handlers]);

	useEffect(() => {
		if (!IS_BROWSER) return;

		setInput('');

		const handlePopState = async () => {
			const urlConversationId = getConversationId();
			if (urlConversationId && urlConversationId !== chatState.value.conversationId) {
				await selectConversation(urlConversationId);
			}
		};

		window.addEventListener('popstate', handlePopState);
		return () => window.removeEventListener('popstate', handlePopState);
	}, [chatState.value.conversationId]);

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollTo({
				top: messagesEndRef.current.scrollHeight,
				behavior: 'smooth',
			});
		}
	}, [chatState.value.logEntries]);

	// Handle page visibility and focus events at the component level
	useEffect(() => {
		if (!IS_BROWSER) return;

		if (messagesEndRef.current && isProcessing(chatState.value.status)) {
			messagesEndRef.current.scrollTo({
				top: messagesEndRef.current.scrollHeight,
				behavior: 'smooth',
			});
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden' && isProcessing(chatState.value.status)) {
				setToastMessage('Claude is working in background');
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
		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			window.removeEventListener('beforeunload', handleBeforeUnload);
		};
	}, [chatState.value.status.apiStatus]);

	useEffect(() => {
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
		<div className='flex flex-col h-screen bg-gray-50 overflow-hidden'>
			{/* Connection status banner */}
			<AnimatedNotification
				visible={chatState.value.status.isConnecting && !chatState.value.error}
				type='warning'
			>
				<div className='flex items-center justify-center'>
					<span>Connection lost. Attempting to reconnect...</span>
				</div>
			</AnimatedNotification>

			<ConversationHeader
				startDir={startDir}
				onStartDirChange={updateStartDir}
				onClearConversation={handlers.clearConversation}
				status={chatState.value.status}
				conversationCount={chatState.value.conversations.length}
				totalTokens={chatState.value.conversations.reduce(
					(total, conv) => total + (conv.tokenUsageConversation?.totalTokensTotal ?? 0),
					0,
				)}
				cacheStatus={chatState.value.status.cacheStatus}
			/>

			{/* Main content */}
			<div className='flex-1 flex overflow-hidden'>
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
				<main className='flex-1 flex flex-col bg-white overflow-hidden'>
					{/* Messages header */}
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

							{/* Conversation Metadata */}
							<ConversationMetadata
								logEntries={chatState.value.logEntries}
								conversationId={chatState.value.conversationId}
								title={chatState.value.conversations.find((c) =>
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
							startDir={startDir}
						/>
					</div>

					{/* Messages */}
					<div className='flex-1 overflow-hidden relative flex flex-col'>
						<div
							ref={messagesEndRef}
							className='flex-1 overflow-y-auto px-6 py-8 space-y-6 min-h-0 min-w-0'
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
										startDir={startDir}
										conversationId={chatState.value.conversationId!}
									/>
								))}
						</div>
					</div>

					{/* Input area */}
					<div className='border-t border-gray-200 flex-shrink-0 bg-white'>
						<ChatInput
							value={input}
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
