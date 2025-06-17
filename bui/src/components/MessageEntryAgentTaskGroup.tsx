import { JSX } from 'preact';
import { useCallback, useState } from 'preact/hooks';
import { MessageEntry } from './MessageEntry.tsx';
import type { CollaborationLogDataEntry } from 'shared/types.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';
import { getInitialCollapseState, saveCollapseState } from '../utils/messageUtils.utils.tsx';

interface MessageEntryAgentTaskGroupProps {
	entries: CollaborationLogDataEntry[];
	parentEntry: CollaborationLogDataEntry;
	parentIndex: number;
	onCopy: (text: string) => void;
	apiClient: ApiClient;
	projectId: string;
	conversationId: string;
}

export function MessageEntryAgentTaskGroup({
	entries,
	parentEntry: _parentEntry,
	parentIndex,
	onCopy,
	apiClient,
	projectId,
	conversationId,
}: MessageEntryAgentTaskGroupProps): JSX.Element {
	const agentInteractionId = entries.length > 0 ? entries[0].agentInteractionId : null;

	// State for collapse control
	const [isExpanded, setIsExpanded] = useState(() =>
		getInitialCollapseState(
			conversationId,
			`group-${agentInteractionId}`,
			parentIndex,
			'agent_group',
		)
	);

	const toggleExpanded = useCallback(() => {
		setIsExpanded((prev) => {
			const newState = !prev;
			saveCollapseState(conversationId, `group-${agentInteractionId}`, parentIndex, newState);
			return newState;
		});
	}, [conversationId, agentInteractionId, parentIndex]);

	// Extract info from entries
	//const taskTitle = entries.find(entry =>
	//  entry.logEntry?.entryType === 'orchestrator' &&
	//  entry.logEntry?.content?.includes('Instructions:'))?.logEntry?.content || 'Agent Task';

	const taskCount = entries.length;
	const toolResults = entries.filter((entry) => entry.logEntry?.entryType === 'tool_result');

	const successCount = toolResults.filter((entry) => {
		const isToolResult = entry.logEntry?.entryType === 'tool_result';
		//const toolSubtitle = String(entry?.formattedResult?.subtitle);
		const toolContent = String(entry.logEntry?.content);
		const toolStatus = isToolResult
			? (toolContent.includes('failed') && !toolContent.includes('0 failed')) ? 'error' : 'success'
			: null;
		return toolStatus === 'success';
		//if (typeof entry.logEntry?.content === 'object' && entry.logEntry?.content !== null) {
		//  return entry.logEntry?.content.success !== false;
		//}
		//return true;
	}).length;
	const failCount = toolResults.length - successCount;

	return (
		<div className='bb-agent-task-group bg-gray-50 dark:bg-gray-800 rounded-md overflow-hidden mb-4 border border-gray-200 dark:border-gray-700'>
			{/* Group Header */}
			<div
				className='p-3 bg-gray-100 dark:bg-gray-700 flex items-center justify-between cursor-pointer group'
				onClick={toggleExpanded}
			>
				<div className='flex items-center'>
					<span className='mr-2'>
						<svg
							className={`w-4 h-4 text-gray-500 dark:text-gray-400 transform transition-transform duration-200 ${
								isExpanded ? 'rotate-90' : ''
							}`}
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'
						>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
						</svg>
					</span>
					<div>
						<h3 className='font-medium text-sm text-gray-500 dark:text-gray-400'>Agent Task Group</h3>
						<p className='text-xs text-gray-500 dark:text-gray-400'>
							{taskCount} entries • {successCount} success • {failCount} failed
						</p>
					</div>
				</div>
				<div className='opacity-0 group-hover:opacity-100 transition-opacity'>
					<button
						type='button'
						className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600'
						onClick={(e) => {
							e.stopPropagation();
							toggleExpanded();
						}}
					>
						{isExpanded
							? (
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M5 15l7-7 7 7'
									/>
								</svg>
							)
							: (
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M19 9l-7 7-7-7'
									/>
								</svg>
							)}
					</button>
				</div>
			</div>

			{/* Group Content */}
			{isExpanded && (
				<div className='max-h-96 overflow-y-auto bb-custom-scrollbar p-2'>
					{entries.map((entry, idx) => (
						<MessageEntry
							key={`${entry.messageId || entry.agentInteractionId}-${idx}`}
							logDataEntry={entry}
							index={parentIndex * 1000 + idx} // Use a composite index to avoid conflicts
							onCopy={onCopy}
							apiClient={apiClient}
							projectId={projectId}
							conversationId={conversationId}
						/>
					))}
				</div>
			)}
		</div>
	);
}
