import { Signal, useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { CollaborationTrigger } from './CollaborationTrigger.tsx';
import { CollaborationList } from './CollaborationList.tsx';
import type { CollaborationValues } from 'shared/types.ts';
import type { ChatState, CollaborationListState } from '../../types/chat.types.ts';

interface CollaborationSelectorProps {
	chatState: Signal<ChatState>;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => Promise<void>;
	className?: string;
	placement?: 'top' | 'bottom' | 'left' | 'right';
	triggerClassName?: string;
}

export function CollaborationSelector({
	chatState,
	onSelect,
	onNew,
	onDelete,
	className = '',
	placement = 'bottom',
	triggerClassName = '',
}: CollaborationSelectorProps) {
	const isOpen = useSignal(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const selectedIndex = useSignal(0);
	const searchQuery = useSignal('');

	// Always keep a sorted list of collaborations
	const sortedCollaborations = useComputed(() =>
		[...chatState.value.collaborations].sort((a, b) =>
			new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		)
	);

	// Filter collaborations based on search query
	const displayedCollaborations = useComputed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		if (!query) return sortedCollaborations.value;

		return sortedCollaborations.value.filter((collab) =>
			collab.title?.toLowerCase().includes(query) ||
			collab.id.toLowerCase().includes(query)
		);
	});

	// Use selectedCollaboration from chatState for better reactivity
	const currentCollaboration = useComputed<CollaborationValues | undefined>(() =>
		chatState.value.selectedCollaboration || undefined
	);
	//console.log('CollaborationSelector: currentCollaboration', currentCollaboration.value);
	//console.log('CollaborationSelector: sortedCollaborations', sortedCollaborations.value);

	// Handle keyboard navigation
	useEffect(() => {
		if (!isOpen.value) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'ArrowDown': {
					e.preventDefault();
					selectedIndex.value = (selectedIndex.value + 1) % displayedCollaborations.value.length;
					break;
				}
				case 'ArrowUp': {
					e.preventDefault();
					selectedIndex.value = selectedIndex.value - 1 < 0
						? displayedCollaborations.value.length - 1
						: selectedIndex.value - 1;
					break;
				}
				case 'Enter': {
					e.preventDefault();
					const selectedCollaboration = displayedCollaborations.value[selectedIndex.value];
					if (selectedCollaboration) {
						onSelect(selectedCollaboration.id);
						isOpen.value = false;
					}
					break;
				}
				case 'Escape': {
					e.preventDefault();
					isOpen.value = false;
					triggerRef.current?.focus();
					break;
				}
			}
		};

		globalThis.addEventListener('keydown', handleKeyDown);
		return () => globalThis.removeEventListener('keydown', handleKeyDown);
	}, [isOpen.value, displayedCollaborations.value, selectedIndex.value]);

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

		globalThis.addEventListener('mousedown', handleClickOutside);
		return () => globalThis.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen.value]);

	return (
		<div className='flex items-center gap-3'>
			{/* Collaboration Selector Container */}
			<div className={`relative w-[300px] ${className}`}>
				{/* Trigger */}
				<CollaborationTrigger
					ref={triggerRef}
					isOpen={isOpen.value}
					collaboration={currentCollaboration.value}
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

						{/* Collaboration List */}
						<CollaborationList
							collaborations={displayedCollaborations.value}
							selectedIndex={selectedIndex.value}
							currentInteractionId={chatState.value.collaborationId}
							onSelect={async (id) => {
								isOpen.value = false;
								await onSelect(id);
							}}
							onDelete={onDelete}
						/>
					</div>
				)}
			</div>

			{/* New Collaboration Button */}
			<button
				type='button'
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
