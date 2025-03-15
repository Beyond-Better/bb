import { JSX } from 'preact';
import type { RefObject } from 'preact';
import { Signal, signal, useComputed } from '@preact/signals';
import { useState } from 'preact/hooks';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { ChatState, ChatStatus } from '../types/chat.types.ts';
import { isProcessing } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';
import { CacheStatusIndicator } from './CacheStatusIndicator.tsx';
import type { ConversationMetadata } from 'shared/types.ts';
import type { ModelCapabilities,ApiClient } from '../utils/apiClient.utils.ts';
import { ConversationSelector } from './ConversationSelector/index.ts';
import { ToolBar } from './ToolBar.tsx';
import { ModelInfoPanel } from './ModelInfoPanel.tsx';

// Initialize collapse state signal from localStorage if available, otherwise default to true
const getInitialCollapsedState = () => {
	if (IS_BROWSER) {
		const stored = localStorage.getItem('conversationListCollapsed');
		return stored === null ? true : stored === 'true';
	}
	return true;
};

const isCollapsed = signal(getInitialCollapsedState());

interface ChatInputRef {
	textarea: HTMLTextAreaElement;
	adjustHeight: () => void;
}

interface ConversationHeaderProps {
	cacheStatus: 'active' | 'expiring' | 'inactive';
	status: ChatStatus;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => Promise<void>;
	onToggleList: () => void;
	isListVisible: boolean;
	chatState: Signal<ChatState>;
	modelCapabilities?: Signal<ModelCapabilities | null>;
	onSendMessage: (message: string) => Promise<void>;
	chatInputRef: RefObject<ChatInputRef>;
	disabled: boolean;
	projectId: string;
	apiClient: ApiClient;
}

export function ConversationHeader({
	cacheStatus,
	status,
	onSelect,
	onNew,
	onDelete,
	onToggleList,
	isListVisible,
	chatState,
	modelCapabilities,
	onSendMessage,
	chatInputRef,
	disabled,
	projectId,
	apiClient,
}: ConversationHeaderProps): JSX.Element {
	const [isModelInfoOpen, setIsModelInfoOpen] = useState(false);
	const currentConversation = useComputed(() =>
		chatState.value.conversations.find((c) => c.id === chatState.value.conversationId)
	);

	// Find the latest assistant message that might have request params
	const getModelInfo = () => {
		if (!currentConversation.value) {
			return {
				model: 'Unknown',
				provider: 'Unknown',
			};
		}

		const logEntries = chatState.value.logEntries || [];
		//console.log('ConversationHeader: getModelInfo', {logEntries});
		const assistantEntries = logEntries.filter((entry) =>
			entry.logEntry.entryType === 'assistant' || entry.logEntry.entryType === 'tool_use' || entry.logEntry.entryType === 'answer'
		);

		// Find the most recent entry with tokenUsageTurn
		const entryWithTokenUsageTurn = assistantEntries.findLast((entry) => entry.tokenUsageTurn || entry.tokenUsageStats?.tokenUsageTurn);

		return {
			model: currentConversation.value.model || 'Unknown',
			provider: currentConversation.value.llmProviderName || 'Unknown',
			requestParams: currentConversation.value.requestParams,
			tokenUsageTurn: entryWithTokenUsageTurn?.tokenUsageTurn || entryWithTokenUsageTurn?.tokenUsageStats?.tokenUsageTurn,
			tokenUsageConversation: currentConversation.value.tokenUsageStats?.tokenUsageConversation,
		};
	};

	// Find the latest assistant message that might have request params
	const getModelInfo = () => {
		if (!currentConversation.value) {
			return {
				model: 'Unknown',
				provider: 'Unknown',
			};
		}

		const logEntries = chatState.value.logEntries || [];
		//console.log('ConversationHeader: getModelInfo', {logEntries});
		const assistantEntries = logEntries.filter((entry) =>
			entry.logEntry.entryType === 'assistant' || entry.logEntry.entryType === 'tool_use' || entry.logEntry.entryType === 'answer'
		);

		// Find the most recent entry with tokenUsageTurn
		const entryWithTokenUsageTurn = assistantEntries.findLast((entry) => entry.tokenUsageTurn || entry.tokenUsageStats?.tokenUsageTurn);

		return {
			model: currentConversation.value.model || 'Unknown',
			provider: currentConversation.value.llmProviderName || 'Unknown',
			requestParams: currentConversation.value.requestParams,
			tokenUsageTurn: entryWithTokenUsageTurn?.tokenUsageTurn || entryWithTokenUsageTurn?.tokenUsageStats?.tokenUsageTurn,
			tokenUsageConversation: currentConversation.value.tokenUsageStats?.tokenUsageConversation,
		};
	};

	return (
		<header className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 px-4 shadow-sm relative'>
			<div className='flex justify-between items-center'>
				<div className='flex items-center space-x-8'>
					{/* Toggle List Button */}
					<button
						type='button'
						onClick={() => {
							onToggleList();
							isCollapsed.value = !isCollapsed.value;
							if (IS_BROWSER) {
								localStorage.setItem('conversationListCollapsed', String(!isListVisible));
							}
						}}
						className='p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
						title={isListVisible ? 'Hide conversation list' : 'Show conversation list'}
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth={1.5}
							stroke='currentColor'
							className='w-5 h-5'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d={
									isListVisible
										? 'M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5' // Double chevron left
										: 'M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5' // Double chevron right
								}
							/>
						</svg>
					</button>

					{/* Conversation Selector */}
					<ConversationSelector
						chatState={chatState}
						onSelect={onSelect}
						onNew={onNew}
						onDelete={onDelete}
						placement='bottom'
						className='w-96'
					/>

					{/* Current Conversation Stats */}
					{currentConversation.value && (
						<div className='flex items-center space-x-8 text-sm text-gray-500 dark:text-gray-400 ml-4'>
							{currentConversation.value && (
								<>
									<div className='flex items-center space-x-4'>
										{/* Project Name and ID */}
										<div className='flex flex-col'>
											<div className='flex items-center space-x-2'>
												{/* Conversation Icon */}
												<svg
													className='w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={1.5}
														d='M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z'
													/>
												</svg>
												<div>
													<span className='text-sm font-medium text-gray-900 dark:text-gray-100'>
														{currentConversation.value.title || 'No converstaion selected'}
													</span>
													<div className='text-xs text-gray-500 dark:text-gray-400'>
														{currentConversation.value.id}
														<span className='ml-4 whitespace-nowrap'>
															{new Date(currentConversation.value.updatedAt)
																.toLocaleDateString(undefined, {
																	month: 'short',
																	day: 'numeric',
																	hour: 'numeric',
																	minute: '2-digit',
																})}
														</span>
													</div>
												</div>
											</div>
										</div>
									</div>

									<div className='flex items-center'>
										<svg
											className='w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14v-1a4 4 0 00-4-4h-4m0 0l3 3m-3-3l3-3'
											/>
										</svg>
										{currentConversation.value.conversationStats.conversationTurnCount} turns
									</div>

									<div className='flex items-center'>
										<svg
											className='w-4 h-4 mr-1.5'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'
											/>
										</svg>
										{currentConversation.value.tokenUsageStats?.tokenUsageConversation
											?.totalAllTokens
											?.toLocaleString() ||
											0} tokens
									</div>
									<div className='flex items-center mr-4'>
										<button
											type='button'
											onClick={() => setIsModelInfoOpen(!isModelInfoOpen)}
											className='flex items-center space-x-1 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-1.5 rounded-lg'
											title='View model information'
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
													strokeWidth={1.5}
													d='M13 10V3L4 14h7v7l9-11h-7z'
												/>
											</svg>
											<span className='text-sm hidden md:inline'>Model Info</span>
											<svg
												className='w-4 h-4 ml-1'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M19 9l-7 7-7-7'
												/>
											</svg>
										</button>
									</div>
								</>
							)}
						</div>
					)}
				</div>

				<div className='flex justify-end'>
					<ToolBar
						onSendMessage={onSendMessage}
						chatInputRef={chatInputRef}
						disabled={disabled}
						projectId={projectId}
						apiClient={chatState.value.apiClient!}
					/>
				</div>
			</div>
			{/* Model Info Panel */}
			<ModelInfoPanel
				isOpen={isModelInfoOpen}
				onClose={() => setIsModelInfoOpen(false)}
				modelInfo={getModelInfo()}
				modelCapabilities={modelCapabilities}
			/>
		</header>
	);
}
