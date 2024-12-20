import { forwardRef } from 'preact/compat';
import type { ConversationMetadata } from 'shared/types.ts';

interface ConversationTriggerProps {
	conversation: ConversationMetadata | undefined;
	isOpen: boolean;
	onClick: () => void;
	className?: string;
}

export const ConversationTrigger = forwardRef<HTMLButtonElement, ConversationTriggerProps>(
	({ conversation, isOpen, onClick, className = '' }, ref) => {
		return (
			<button
				ref={ref}
				onClick={onClick}
				className={`flex items-center justify-between w-full gap-2 px-4 py-2 ${
					isOpen
						? 'border border-blue-500 dark:border-blue-400 rounded-t-lg rounded-b-none border-b-0 bg-white dark:bg-gray-900 ring-2 ring-blue-200 dark:ring-blue-500/30'
						: 'border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800'
				} transition-colors ${className}`}
				style={{ height: '40px' }}
			>
				<div className='flex items-center gap-2 min-w-0'>
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

					{/* Conversation Details */}
					<div className='flex-1 min-w-0'>
						{conversation
							? (
								<div className='flex flex-col'>
									<span className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
										{conversation.title || 'Untitled'}
									</span>
								</div>
							)
							: (
								<span className='text-sm text-gray-500 dark:text-gray-400'>
									Select Conversation
								</span>
							)}
					</div>
				</div>

				{/* Dropdown Arrow */}
				<svg
					className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M19 9l-7 7-7-7'
					/>
				</svg>
			</button>
		);
	},
);
