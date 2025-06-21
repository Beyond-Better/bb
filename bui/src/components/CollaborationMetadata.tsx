import { JSX } from 'preact';
import type { CollaborationLogDataEntry } from 'shared/types.ts';

interface CollaborationMetadataProps {
	logDataEntries: CollaborationLogDataEntry[];
	collaborationId: string | null;
	title?: string;
}

export function CollaborationMetadata(
	{ logDataEntries, collaborationId, title }: CollaborationMetadataProps,
): JSX.Element {
	// Get the most recent token usage from logDataEntries
	const latestEntry = logDataEntries[logDataEntries.length - 1];
	const tokenUsage = latestEntry?.tokenUsageStats.tokenUsageInteraction;

	return (
		<div className='flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400'>
			{/* Collaboration Title */}
			{title && (
				<div className='flex items-center'>
					<span className='font-medium text-gray-700 dark:text-gray-200'>{title}</span>
				</div>
			)}

			{/* Collaboration ID */}
			{collaborationId && (
				<div className='font-mono'>
					<span className='text-gray-400 dark:text-gray-500 mr-1'>ID:</span> {collaborationId}
				</div>
			)}

			{/* Token Usage */}
			{tokenUsage && (
				<div className='flex items-center space-x-3'>
					<div>
						<span className='text-gray-400 dark:text-gray-500'>Input:</span>{' '}
						{tokenUsage.inputTokens?.toLocaleString() || 0}
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
