import { Signal } from '@preact/signals';
import { formatDistanceToNow } from 'date-fns';
import { memo } from 'preact/compat';
import type { ChatInputHistoryEntry } from '../hooks/useChatInputHistory.ts';

interface ChatHistoryDropdownProps {
	pinnedEntries: Signal<ChatInputHistoryEntry[]>;
	recentEntries: Signal<ChatInputHistoryEntry[]>;
	isOpen: Signal<boolean>;
	onSelect: (value: string) => void;
	onTogglePin: (index: number) => void;
}

// Memoized entry component to prevent unnecessary re-renders
const HistoryEntry = memo(({
	entry,
	onSelect,
	onTogglePin,
}: {
	entry: ChatInputHistoryEntry;
	onSelect: (value: string) => void;
	onTogglePin: () => void;
}) => {
	return (
		<div className='px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-start group'>
			<div
				className='flex-1 min-w-0 cursor-pointer'
				onClick={() => {
					console.log('ChatHistory: Entry selected');
					onSelect(entry.value);
				}}
			>
				<div className='text-sm text-gray-500 dark:text-gray-400 truncate'>{entry.value}</div>
				<div className='text-xs text-gray-500 dark:text-gray-400'>
					{formatDistanceToNow(entry.timestamp)} ago
				</div>
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					console.log('ChatHistory: Pin toggled');
					onTogglePin();
				}}
				className='ml-2 p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
				title={entry.isPinned ? 'Unpin' : 'Pin'}
			>
				{entry.isPinned
					? (
						<svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
							<path d='M9.828 4.172a4 4 0 00-5.656 0 4 4 0 000 5.656L10 15.657l5.828-5.829a4 4 0 000-5.656 4 4 0 00-5.656 0L10 4.172z' />
						</svg>
					)
					: (
						<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
						</svg>
					)}
			</button>
		</div>
	);
}, (prevProps, nextProps) => {
	// Custom comparison for memo
	return (
		prevProps.entry.value === nextProps.entry.value &&
		prevProps.entry.timestamp === nextProps.entry.timestamp &&
		prevProps.entry.isPinned === nextProps.entry.isPinned
	);
});

export function ChatHistoryDropdown({
	pinnedEntries,
	recentEntries,
	isOpen,
	onSelect,
	onTogglePin,
}: ChatHistoryDropdownProps) {
	// Log only when dropdown state changes
	if (!isOpen.value) {
		return null;
	}

	console.log('ChatHistory: Rendering dropdown', {
		pinnedCount: pinnedEntries.value.length,
		recentCount: recentEntries.value.length,
	});

	return (
		<div className='absolute bottom-full right-0 mb-1 w-96 bg-white dark:bg-gray-900 shadow-lg rounded-md py-1 max-h-96 overflow-y-auto'>
			{pinnedEntries.value.length > 0 && (
				<>
					<div className='px-3 py-1 text-sm text-gray-500 dark:text-gray-400'>Pinned</div>
					{pinnedEntries.value.map((entry, index) => (
						<HistoryEntry
							key={`pinned-${entry.timestamp}`}
							entry={entry}
							onSelect={onSelect}
							onTogglePin={() => onTogglePin(index)}
						/>
					))}
					<div className='border-t border-gray-200 dark:border-gray-700 my-1' />
				</>
			)}

			<div className='px-3 py-1 text-sm text-gray-500 dark:text-gray-400'>Recent</div>
			{recentEntries.value.map((entry, index) => (
				<HistoryEntry
					key={`recent-${entry.timestamp}`}
					entry={entry}
					onSelect={onSelect}
					onTogglePin={() => onTogglePin(index + pinnedEntries.value.length)}
				/>
			))}
		</div>
	);
}
