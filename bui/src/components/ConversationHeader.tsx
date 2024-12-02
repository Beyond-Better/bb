import { JSX } from 'preact';
import { ChatStatus } from '../types/chat.types.ts';
import { ApiStatus } from 'shared/types.ts';
import { CacheStatusIndicator } from './CacheStatusIndicator.tsx';
import type { ConversationEntry } from 'shared/types.ts';
import type { VersionInfo } from 'shared/types/version.ts';
import { VersionDisplay } from '../components/Version/VersionDisplay.tsx';
import type { ApiClient } from '../utils/apiClient.utils.ts';

interface ConversationHeaderProps {
	cacheStatus: 'active' | 'expiring' | 'inactive';
	startDir: string;
	onStartDirChange: (dir: string) => void;
	onClearConversation: () => void;
	status: ChatStatus;
	conversationCount: number;
	totalTokens: number;
	projectType?: 'git' | 'local';
	createdAt?: string;
	apiClient: ApiClient;
}

export function ConversationHeader({
	cacheStatus,
	startDir,
	onStartDirChange,
	onClearConversation,
	status,
	conversationCount,
	totalTokens,
	projectType,
	createdAt,
	apiClient,
}: ConversationHeaderProps): JSX.Element {
	return (
		<header className='bg-[#1B2333] text-white py-2 pl-4 pr-0 shadow-lg'>
			<div className='max-w-7xl ml-auto mr-4 flex justify-between items-center gap-8 pl-4 pr-1'>
				<div className='flex items-center gap-3 flex-1'>
					{/* Logo */}
					<div className='flex items-center gap-2'>
						<img src='/logo.png' alt='BB Logo' className='h-6 w-6' />
						<h1 className='text-lg font-bold leading-none tracking-tight'>Beyond Better</h1>
					</div>

					{/* Project Directory Input */}
					<div className='flex items-center gap-2'>
						<label className='text-sm font-medium text-gray-300 whitespace-nowrap'>
							Project Directory:
						</label>
						<input
							type='text'
							value={startDir}
							onChange={(e: Event) => {
								const target = e.target as HTMLInputElement;
								onStartDirChange(target.value);
								onClearConversation();
							}}
							className='bg-gray-700 text-white px-2 py-1.5 rounded-md w-[400px] focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm placeholder-gray-400 border border-gray-600 hover:border-gray-500 transition-colors'
							placeholder='Enter project path'
						/>
					</div>

					{/* Project Metadata */}
					<div className='flex items-center space-x-4 text-sm text-gray-300'>
						{/* Project Type */}
						{projectType && (
							<div>
								<span className='text-gray-400'>Type:</span> {projectType}
							</div>
						)}

						{/* Created Date */}
						{createdAt && (
							<div>
								<span className='text-gray-400'>Created:</span>{' '}
								{new Date(createdAt).toLocaleDateString()}
							</div>
						)}

						{/* Conversation Count */}
						<div>
							<span className='text-gray-400'>Conversations:</span> {conversationCount.toLocaleString()}
						</div>

						{/* Total Token Usage */}
						<div>
							<span className='text-gray-400'>Total Tokens:</span> {totalTokens.toLocaleString()}
						</div>
					</div>
				</div>

				{/* Status Indicators */}
				<div className='flex items-center space-x-4 text-sm shrink-0 border-l border-gray-600 pl-4'>
					{/* Connection Status */}
					<span
						className={`flex items-center ${
							status.isReady ? 'text-green-400' : status.isConnecting ? 'text-yellow-400' : 'text-red-400'
						}`}
					>
						<span
							className={`w-2 h-2 rounded-full mr-2 ${
								status.isReady ? 'bg-green-400' : status.isConnecting ? 'bg-yellow-400' : 'bg-red-400'
							}`}
						/>
						{status.isReady
							? (status.apiStatus === ApiStatus.IDLE ? 'Connected' : 'Working')
							: status.isConnecting
							? 'Connecting'
							: 'Disconnected'}
					</span>

					{/* Cache Status */}
					<div className='flex items-center space-x-2'>
						<CacheStatusIndicator status={cacheStatus} />
						{/* API Status */}
						<div className='flex items-center space-x-2'>
							<span
								className={`flex items-center ${
									status.apiStatus === ApiStatus.ERROR ? 'text-red-400' : 'text-gray-300'
								}`}
							>
								{status.apiStatus === ApiStatus.LLM_PROCESSING && 'Claude is thinking...'}
								{status.apiStatus === ApiStatus.TOOL_HANDLING &&
									`Using tool: ${status.toolName || 'unknown'}`}
								{status.apiStatus === ApiStatus.API_BUSY && 'API is processing...'}
								{status.apiStatus === ApiStatus.ERROR && 'Error occurred'}
							</span>
						</div>
					</div>
					<VersionDisplay showWarning={true} apiClient={apiClient} />
				</div>
			</div>
		</header>
	);
}
