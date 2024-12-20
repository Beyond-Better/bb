import { Signal, useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { ConversationTrigger } from './ConversationTrigger.tsx';
import { ConversationList } from './ConversationList.tsx';
import type { ConversationMetadata } from 'shared/types.ts';
import type { ChatState, ConversationListState } from '../../types/chat.types.ts';

interface ConversationSelectorProps {
	chatState: Signal<ChatState>;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => Promise<void>;
	className?: string;
	placement?: 'top' | 'bottom' | 'left' | 'right';
	triggerClassName?: string;
}

export function ConversationSelector({
	chatState,
	onSelect,
	onNew,
	onDelete,
	className = '',
	placement = 'bottom',
	triggerClassName = '',
}: ConversationSelectorProps) {
	const isOpen = useSignal(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const selectedIndex = useSignal(0);
	const searchQuery = useSignal('');

	// Always keep a sorted list of conversations
	const sortedConversations = useComputed(() =>
		[...chatState.value.conversations].sort((a, b) =>
			new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		)
	);

	// Filter conversations based on search query
	const displayedConversations = useComputed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		if (!query) return sortedConversations.value;

		return sortedConversations.value.filter((conv) =>
			conv.title?.toLowerCase().includes(query) ||
			conv.id.toLowerCase().includes(query)
		);
	});

	const currentConversation = useComputed<ConversationMetadata | undefined>(() =>
		chatState.value.conversations.find((c: ConversationMetadata) => c.id === chatState.value.conversationId)
	);

	// Handle keyboard navigation
	useEffect(() => {
		if (!isOpen.value) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					selectedIndex.value = (selectedIndex.value + 1) % displayedConversations.value.length;
					break;
				case 'ArrowUp':
					e.preventDefault();
					selectedIndex.value = selectedIndex.value - 1 < 0
						? displayedConversations.value.length - 1
						: selectedIndex.value - 1;
					break;
				case 'Enter':
					e.preventDefault();
					const selectedConversation = displayedConversations.value[selectedIndex.value];
					if (selectedConversation) {
						onSelect(selectedConversation.id);
						isOpen.value = false;
					}
					break;
				case 'Escape':
					e.preventDefault();
					isOpen.value = false;
					triggerRef.current?.focus();
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen.value, displayedConversations.value, selectedIndex.value]);

	// Handle click outside
	useEffect(() => {
		if (!isOpen.value) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				!triggerRef.current?.contains(e.target as Node)
			) {
				isOpen.value = false;
			}
		};

		window.addEventListener('mousedown', handleClickOutside);
		return () => window.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen.value]);

	return (
		<div className='flex items-center gap-3'>
			{/* Conversation Selector Container */}
			<div className={`relative w-[300px] ${className}`}>
				{/* Trigger */}
				<ConversationTrigger
					ref={triggerRef}
					isOpen={isOpen.value}
					conversation={currentConversation.value}
					onClick={() => isOpen.value = !isOpen.value}
					className={triggerClassName}
				/>

				{/* Dropdown */}
				{isOpen.value && (
					<div
						ref={popoverRef}
						className='absolute z-30 bg-white dark:bg-gray-900 border-x border-b border-blue-500 dark:border-blue-400 rounded-b-lg shadow-lg overflow-hidden w-full'
						style={{
							top: '100%',
							left: 0,
							right: 0,
							marginTop: -1,
						}}
					>
						{/* Search Input */}
						<div className='border-b border-gray-200 dark:border-gray-700'>
							<input
								type='text'
								value={searchQuery.value}
								onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
								placeholder='Search conversations...'
								autoComplete='off'
								className='w-full px-4 py-2 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 bg-white dark:bg-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'
							/>
						</div>

						{/* Conversation List */}
						<ConversationList
							conversations={displayedConversations.value}
							selectedIndex={selectedIndex.value}
							currentConversationId={chatState.value.conversationId}
							onSelect={async (id) => {
								isOpen.value = false;
								await onSelect(id);
							}}
							onDelete={onDelete}
						/>
					</div>
				)}
			</div>

			{/* New Conversation Button */}
			<button
				onClick={onNew}
				className='bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-2 border border-gray-300 dark:border-gray-600 h-[40px]'
			>
				<svg className='w-4 h-4 flex-shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
				</svg>
				<span className='text-sm text-gray-700 dark:text-gray-200'>New</span>
			</button>
		</div>
	);
}
