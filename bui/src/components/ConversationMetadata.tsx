import { JSX } from 'preact';
import type { ConversationEntry } from 'shared/types.ts';

interface ConversationMetadataProps {
	logEntries: ConversationEntry[];
	conversationId: string | null;
	title?: string;
}

export function ConversationMetadata({ logEntries, conversationId, title }: ConversationMetadataProps): JSX.Element {
	// Get the most recent token usage from logEntries
	const latestEntry = logEntries[logEntries.length - 1];
	const tokenUsage = latestEntry?.tokenUsageConversation;

	return (
		<div className='flex items-center space-x-4 text-sm text-gray-500'>
			{/* Conversation Title */}
			{title && (
				<div className='flex items-center'>
					<span className='font-medium'>{title}</span>
				</div>
			)}

			{/* Conversation ID */}
			{conversationId && (
				<div className='font-mono'>
					<span className='text-gray-400 mr-1'>ID:</span> {conversationId}
				</div>
			)}

			{/* Token Usage */}
			{tokenUsage && (
				<div className='flex items-center space-x-3'>
					<div>
						<span className='text-gray-400'>Input:</span> {tokenUsage.inputTokens?.toLocaleString() || 0}
					</div>
					<div>
						<span className='text-gray-400'>Output:</span> {tokenUsage.outputTokens?.toLocaleString() || 0}
					</div>
					<div>
						<span className='text-gray-400'>Total:</span> {tokenUsage.totalTokens?.toLocaleString() || 0}
					</div>
				</div>
			)}
		</div>
	);
}
