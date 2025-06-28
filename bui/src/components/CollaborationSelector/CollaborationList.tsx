import type { CollaborationValues } from 'shared/types.ts';
import { useSignal } from '@preact/signals';
import { ConfirmDialog } from '../Dialogs/ConfirmDialog.tsx';
//import type { ChatState, CollaborationListState } from '../types/chat.types.ts';

interface CollaborationListProps {
	collaborations: CollaborationValues[];
	selectedIndex: number;
	currentInteractionId: string | null;
	showDeleteButton?: boolean;
	onSelect: (id: string) => Promise<void>;
	onDelete: (id: string) => Promise<void>;
	onToggleStar?: (id: string, starred: boolean) => Promise<void>;
}

interface CollaborationToDelete {
	id: string;
	title: string;
}

export function CollaborationList({
	collaborations,
	selectedIndex,
	currentInteractionId,
	showDeleteButton = false,
	onSelect,
	onDelete,
	onToggleStar,
}: CollaborationListProps) {
	const showDeleteConfirm = useSignal(false);
	const collaborationToDelete = useSignal<CollaborationToDelete | undefined>(undefined);
	const isUpdatingStar = useSignal<string | null>(null);

	// Helper function for starring
	const toggleStar = async (collaborationId: string, currentStarred: boolean) => {
		if (!onToggleStar || isUpdatingStar.value === collaborationId) return;

		try {
			isUpdatingStar.value = collaborationId;
			await onToggleStar(collaborationId, !currentStarred);
		} catch (error) {
			console.error('Failed to toggle star:', error);
		} finally {
			isUpdatingStar.value = null;
		}
	};

	// Sort collaborations: starred first, then by updatedAt
	const sortedCollaborations = collaborations.sort((a, b) => {
		// First sort by starred status (starred items first)
		if (a.starred && !b.starred) return -1;
		if (!a.starred && b.starred) return 1;
		// Then sort by updatedAt (most recent first)
		return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
	});
	if (collaborations.length === 0) {
		return (
			<div className='p-4 text-center text-gray-500 dark:text-gray-400 text-sm'>
				<p className='text-sm'>No conversations found</p>
			</div>
		);
	}

	return (
		<>
			<ul className='max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800'>
				{sortedCollaborations.map((collab, index) => (
					<li
						key={collab.id}
						className={`px-4 py-2 cursor-pointer group ${
							index === selectedIndex
								? 'bg-gray-100 dark:bg-gray-800'
								: 'hover:bg-gray-50 dark:hover:bg-gray-700'
						} ${
							collab.id === currentInteractionId
								? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/30'
								: ''
						}`}
						onClick={() => onSelect(collab.id)}
					>
						<div className='flex justify-between items-start'>
							<div className='flex-1 min-w-0'>
								{/* Title and Updated Time */}
								<div className='flex justify-between items-start mb-1'>
									<div className='flex items-center gap-2 flex-1 min-w-0'>
										{
											/* We don't need a star heading and button */ /*collab.starred && (
											<svg
												className='w-4 h-4 text-yellow-500 flex-shrink-0'
												fill='currentColor'
												viewBox='0 0 24 24'
											>
												<path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
											</svg>
										) */
										}
										<h3
											className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'
											title={collab.title || 'Untitled'}
										>
											{collab.title || 'Untitled'}
										</h3>
									</div>
								</div>

								{/* Stats Row */}
								<div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
									{/* Turn Count */}
									{collab.lastInteractionMetadata?.interactionStats && (
										<span className='flex items-center gap-1'>
											<svg
												className='w-4 h-4 mr-1'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={1.5}
													d='M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14v-1a4 4 0 00-4-4h-4m0 0l3 3m-3-3l3-3'
												/>
											</svg>
											{collab.lastInteractionMetadata.interactionStats.interactionTurnCount} turns
										</span>
									)}

									{/* Token Count */}
									{collab.tokenUsageCollaboration && (
										<span className='flex items-center gap-1'>
											<svg
												className='w-4 h-4 mr-1'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={1.5}
													d='M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z'
												/>
											</svg>
											{collab.tokenUsageCollaboration.totalAllTokens
												?.toLocaleString() ||
												0} tokens
										</span>
									)}
									{/* Updated At */}
									<span className='text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap'>
										{new Date(collab.updatedAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											hour: 'numeric',
											minute: '2-digit',
										})}
									</span>
								</div>
							</div>

							<div className='flex items-center gap-1'>
								{/* Star button */}
								{onToggleStar && (
									<button
										type='button'
										onClick={(e) => {
											e.stopPropagation();
											toggleStar(collab.id, collab.starred || false);
										}}
										disabled={isUpdatingStar.value === collab.id}
										className={`opacity-0 group-hover:opacity-100 p-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
											collab.starred
												? 'text-yellow-500 hover:text-yellow-600 opacity-100'
												: 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400'
										}`}
										title={collab.starred ? 'Remove from favorites' : 'Add to favorites'}
										aria-label={collab.starred ? 'Remove from favorites' : 'Add to favorites'}
									>
										{collab.starred
											? (
												<svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
													<path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
												</svg>
											)
											: (
												<svg
													className='w-4 h-4'
													fill='none'
													stroke='currentColor'
													viewBox='0 0 24 24'
												>
													<path
														strokeLinecap='round'
														strokeLinejoin='round'
														strokeWidth={2}
														d='M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'
													/>
												</svg>
											)}
									</button>
								)}
								{/* Delete Button */}
								{showDeleteButton &&
									(
										<button
											type='button'
											onClick={(e) => {
												e.stopPropagation();
												collaborationToDelete.value = {
													id: collab.id,
													title: collab.title?.trim() || 'Untitled',
												};
												showDeleteConfirm.value = true;
											}}
											className='opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 p-1 rounded transition-opacity duration-200'
											title='Delete conversation'
										>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={1.5}
												stroke='currentColor'
												className='w-4 h-4'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
												/>
											</svg>
										</button>
									)}
							</div>
						</div>
					</li>
				))}
			</ul>

			{/* Delete Confirmation Dialog */}
			<ConfirmDialog
				visible={showDeleteConfirm.value}
				title='Delete Conversation'
				message={`Are you sure you want to delete the conversation '${collaborationToDelete.value?.title}'?`}
				confirmLabel='Delete'
				onConfirm={async () => {
					if (collaborationToDelete.value) {
						await onDelete(collaborationToDelete.value.id);
						showDeleteConfirm.value = false;
						collaborationToDelete.value = undefined;
					}
				}}
				onCancel={() => {
					showDeleteConfirm.value = false;
					collaborationToDelete.value = undefined;
				}}
				isDangerous
			/>
		</>
	);
}
