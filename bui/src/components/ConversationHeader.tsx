import { JSX } from 'preact';
import { Status } from '../types/chat.types.ts';
import type { ConversationEntry } from 'shared/types.ts';

interface ConversationHeaderProps {
	startDir: string;
	onStartDirChange: (dir: string) => void;
	onClearConversation: () => void;
	status: Status;
	conversationCount: number;
	totalTokens: number;
	projectType?: 'git' | 'local';
	createdAt?: string;
}

export function ConversationHeader({
	startDir,
	onStartDirChange,
	onClearConversation,
	status,
	conversationCount,
	totalTokens,
	projectType,
	createdAt,
}: ConversationHeaderProps): JSX.Element {
	return (
		<header className='bg-[#1B2333] text-white py-2 px-4 shadow-lg'>
			<div className='max-w-7xl mx-auto flex justify-between items-center gap-8 px-4'>
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

				{/* Connection Status */}
				<div className='flex items-center space-x-4 text-sm shrink-0 border-l border-gray-600 pl-4'>
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
						{status.isReady ? 'Connected' : status.isConnecting ? 'Connecting' : 'Disconnected'}
					</span>
				</div>
			</div>
		</header>
	);
}
