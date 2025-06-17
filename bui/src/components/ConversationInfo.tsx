import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { CollaborationContinue, CollaborationLogDataEntry } from 'shared/types.ts';

interface ConversationInfoProps {
	logDataEntries?: CollaborationLogDataEntry[];
	conversationId?: string;
	title?: string;
}

interface InteractionMetadata {
	title?: string;
	messageCount: number;
	tokenUsage: {
		total: number;
		current: number;
	};
}

// Initialize metadata signal with default values
const metadata = signal<InteractionMetadata>({
	messageCount: 0,
	tokenUsage: {
		total: 0,
		current: 0,
	},
});

export function ConversationInfo({ logDataEntries = [], conversationId, title }: ConversationInfoProps) {
	useEffect(() => {
		if (logDataEntries) {
			metadata.value = {
				title: title,
				messageCount: logDataEntries.length,
				tokenUsage: {
					total: 200000, // TODO: Get from actual token limits
					//current: logDataEntries[logDataEntries.length].tokenUsageInteraction?.totalTokens || 0,
					current: logDataEntries.reduce(
						(sum, entry) =>
							sum + ((entry as CollaborationContinue).tokenUsageStats.tokenUsageTurn?.totalTokens || 0),
						0,
					),
				},
			};
		}
	}, [logDataEntries, title]);

	return (
		<div className='flex items-center space-x-4'>
			{/* Message Count */}
			<div className='flex items-center space-x-1 text-gray-500 dark:text-gray-400'>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth='1.5'
					stroke='currentColor'
					className='w-4 h-4 text-gray-400 dark:text-gray-500'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z'
					/>
				</svg>
				<span className='text-sm text-gray-500 dark:text-gray-400'>
					{metadata.value.messageCount} messages
				</span>
			</div>

			{/* Token Usage */}
			<div className='flex items-center space-x-1'>
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
						d='M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125'
					/>
				</svg>
				<span className='text-sm text-gray-500'>
					{metadata.value.tokenUsage.current.toLocaleString()} tokens
				</span>
			</div>
		</div>
	);
}
