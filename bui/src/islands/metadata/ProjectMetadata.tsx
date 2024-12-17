import { useEffect } from 'preact/hooks';
import { Signal } from '@preact/signals';
import { ChatState, ChatStatus } from '../../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';
import { CacheStatusIndicator } from '../../components/CacheStatusIndicator.tsx';
import type { ApiClient } from '../../utils/apiClient.utils.ts';
import type { ConversationEntry } from 'shared/types.ts';
import { IS_BROWSER } from '$fresh/runtime.ts';
import { ProjectSelector } from '../../components/ProjectSelector/index.ts';

interface ProjectMetadataProps {
	chatState: Signal<ChatState>;
}

export function ProjectMetadata({
	chatState,
}: ProjectMetadataProps) {
	//if (IS_BROWSER) console.log('ProjectMetadata: chatState', chatState);

	// Get projectId and conversationId from URL
	const projectId = chatState.value.projectData?.projectId || '.';
	const projectType = chatState.value.projectData?.type || 'local';
	const projectName = chatState.value.projectData?.name || 'default';
	const projectPath = chatState.value.projectData?.path || 'default';

	return (
		<div className='flex items-center justify-between px-4'>
			<div className='flex items-center space-x-8'>
				{/* Project Selector */}
				<div className='w-64'>
					<ProjectSelector placement='bottom' />
				</div>

				{/* Project Info */}
				<div className='flex items-center space-x-4'>
					{/* Project Name and ID */}
					<div className='flex flex-col'>
						<div className='flex items-center space-x-2'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
								strokeWidth='1.5'
								stroke='currentColor'
								className='w-5 h-5 text-gray-400'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
								/>
							</svg>
							<div>
								<span className='text-sm font-medium text-gray-900'>
									{projectName || 'No project selected'}
								</span>
								<div className='text-xs text-gray-500'>{projectId}</div>
							</div>
						</div>
					</div>

					{/* Project Type */}
					<div className='flex items-center space-x-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'
							className='w-4 h-4 text-gray-400'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5'
							/>
						</svg>
						<span className='text-sm text-gray-500'>{projectType}</span>
					</div>

					{/* Project Path */}
					<div className='flex items-center space-x-2'>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							strokeWidth='1.5'
							stroke='currentColor'
							className='w-4 h-4 text-gray-400'
						>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
							/>
						</svg>
						<span className='text-sm text-gray-500'>{projectPath}</span>
					</div>
				</div>

				{/* Project Stats */}
				{(chatState.value.projectData?.stats || chatState.value.conversations) && (
					<div className='flex items-center space-x-6 text-sm'>
						<div className='flex items-center text-blue-600'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='h-5 w-5 mr-1.5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={1.5}
									d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
								/>
							</svg>
							<span>{chatState.value.conversations.length.toLocaleString()}</span>
							<span className='text-gray-500 ml-1'>
								{chatState.value.conversations.length === 1 ? 'conversation' : 'conversations'}
							</span>
						</div>

						<div className='flex items-center text-purple-600'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								className='h-5 w-5 mr-1.5'
								fill='none'
								viewBox='0 0 24 24'
								stroke='currentColor'
							>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth={1.5}
									d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
								/>
							</svg>
							<span>{chatState.value.projectData?.stats?.totalTokens.toLocaleString() || '--'}</span>
							<span className='text-gray-500 ml-1'>tokens used</span>
						</div>

						{chatState.value.projectData?.stats?.lastAccessed && (
							<div className='flex items-center text-gray-500'>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									className='h-5 w-5 mr-1.5'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={1.5}
										d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
									/>
								</svg>
								<span>
									Last used:{' '}
									{new Date(chatState.value.projectData.stats.lastAccessed).toLocaleString()}
								</span>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Status Info */}
			<div className='flex items-center space-x-4'>
				{/* Divider */}
				<div className='h-4 w-px bg-gray-200' />

				{/* Cache Status */}
				<div className='flex items-center space-x-2'>
					<CacheStatusIndicator status={chatState.value.status.cacheStatus} />
				</div>

				{/* API Status */}
				<div className='flex items-center space-x-2'>
					<span
						className={`flex items-center ${
							chatState.value.status.apiStatus === ApiStatus.ERROR ? 'text-red-500' : 'text-gray-500'
						}`}
					>
						{chatState.value.status.apiStatus === ApiStatus.LLM_PROCESSING && 'Claude is thinking...'}
						{chatState.value.status.apiStatus === ApiStatus.TOOL_HANDLING && 'Using tool...'}
						{chatState.value.status.apiStatus === ApiStatus.API_BUSY && 'API is processing...'}
						{chatState.value.status.apiStatus === ApiStatus.ERROR && 'Error occurred'}
					</span>
				</div>

				{/* Connection Status */}
				<div className='flex items-center space-x-2'>
					<span
						className={`w-2 h-2 rounded-full ${
							chatState.value.status.isReady ? 'bg-green-400' : 'bg-red-400'
						}`}
					/>
					<span className='text-sm text-gray-500'>
						Conversation{'  '}{chatState.value.status.isReady
							? (chatState.value.status.apiStatus === ApiStatus.IDLE ? 'Connected' : 'Working')
							: chatState.value.status?.isConnecting
							? 'Connecting'
							: 'Disconnected'}
					</span>
				</div>
			</div>
		</div>
	);
}
