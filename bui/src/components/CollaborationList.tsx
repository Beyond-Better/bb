import { Signal, useSignal } from '@preact/signals';
import { ConfirmDialog } from './Dialogs/ConfirmDialog.tsx';
import type { CollaborationListState } from '../types/chat.types.ts';
import type { CollaborationValues } from 'shared/types.ts';

interface CollaborationListProps {
	onClose?: () => void;
	collaborationListState: Signal<CollaborationListState>;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => Promise<void>;
	onTitleUpdate: (id: string, newTitle: string) => Promise<void>;
	onToggleStar: (id: string, starred: boolean) => Promise<void>;
}

// [TODO] collaborations being passed through via collaborationListState are still the legacy version, not this new interface
/*
export interface Collaboration {
	version?: number; // defaults to 1 for existing collaborations, 2 for new token usage format
	id: InteractionId;
	title: string;

	logDataEntries: CollaborationLogDataEntry[];

	interactionMetrics?: InteractionMetrics;
	tokenUsageTurn: TokenUsage;
	tokenUsageStatement: TokenUsage;
	tokenUsageInteraction: TokenUsage;

	//tools?: Array<{ name: string; description: string }>;
	model: string;
	createdAt: string;
	updatedAt: string;
}
 */

interface CollaborationToDelete {
	id: string;
	title: string;
}

export function CollaborationList({
	collaborationListState,
	onClose,
	onSelect,
	onNew,
	onDelete,
	onTitleUpdate,
	onToggleStar,
}: CollaborationListProps) {
	const isLoading = collaborationListState.value.isLoading;
	const showDeleteConfirm = useSignal(false);
	const collaborationToDelete = useSignal<CollaborationToDelete | undefined>(undefined);
	const editingCollaboration = useSignal<string | null>(null);
	const editedTitle = useSignal<string>('');
	const isUpdatingTitle = useSignal(false);
	const isUpdatingStar = useSignal<string | null>(null);

	// Helper functions for title editing
	const startEditing = (collaboration: CollaborationValues) => {
		editingCollaboration.value = collaboration.id;
		editedTitle.value = collaboration.title || '';
	};

	const cancelEditing = () => {
		editingCollaboration.value = null;
		editedTitle.value = '';
	};

	const saveTitle = async (collaborationId: string) => {
		if (isUpdatingTitle.value || !editedTitle.value.trim()) return;

		try {
			isUpdatingTitle.value = true;
			await onTitleUpdate(collaborationId, editedTitle.value.trim());
			cancelEditing();
		} catch (error) {
			console.error('Failed to update title:', error);
		} finally {
			isUpdatingTitle.value = false;
		}
	};

	// Helper function for starring
	const toggleStar = async (collaborationId: string, currentStarred: boolean) => {
		if (isUpdatingStar.value === collaborationId) return;

		try {
			isUpdatingStar.value = collaborationId;
			await onToggleStar(collaborationId, !currentStarred);
		} catch (error) {
			console.error('Failed to toggle star:', error);
		} finally {
			isUpdatingStar.value = null;
		}
	};

	return (
		<>
			<div className='flex flex-col h-full'>
				{/* New Collaboration Button */}
				<div className='p-4 border-b border-gray-200 dark:border-gray-700 flex-none bg-gray-50 dark:bg-gray-800'>
					<div className='flex items-center gap-2 w-full'>
						{/* Close Button */}
						<button
							type='button'
							onClick={onNew}
							className='flex-grow bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600'
							disabled={isLoading}
						>
							{isLoading
								? (
									<>
										<div className='animate-spin rounded-full h-4 w-4 border-2 border-gray-200 dark:border-gray-700 border-t-transparent'>
										</div>
										<span>Loading...</span>
										<div className='animate-spin rounded-full h-4 w-4 border-2 border-blue-600 dark:border-blue-400 border-t-transparent'>
										</div>
									</>
								)
								: (
									<>
										<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M12 6v6m0 0v6m0-6h6m-6 0H6'
											/>
										</svg>
										<span>New Conversation</span>
									</>
								)}
						</button>
						{onClose && (
							<button
								type='button'
								onClick={onClose}
								className='p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors shrink-0'
								title='Close conversation list'
							>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									strokeWidth={1.5}
									stroke='currentColor'
									className='w-5 h-5'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										d='M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5'
									/>
								</svg>
							</button>
						)}
					</div>
				</div>

				{/* Collaborations List */}
				<div className='flex-1 overflow-y-auto'>
					{collaborationListState.value.collaborations.length === 0
						? (
							<div className='text-center text-gray-500 dark:text-gray-400 dark:text-gray-400 py-8'>
								<svg
									className='w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-500 dark:text-gray-500'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z'
									/>
								</svg>
								<p className='text-sm font-medium text-gray-500 dark:text-gray-400 dark:text-gray-400'>
									No conversations yet
								</p>
								<p className='text-xs mt-1 text-gray-500 dark:text-gray-400 dark:text-gray-400'>
									Start a new conversation to begin
								</p>
							</div>
						)
						: (
							<ul className='space-y-2 p-2 text-gray-600 dark:text-gray-300'>
								{collaborationListState.value.collaborations
									.sort((a, b) => {
										// First sort by starred status (starred items first)
										if (a.starred && !b.starred) return -1;
										if (!a.starred && b.starred) return 1;
										// Then sort by updatedAt (most recent first)
										return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
									})
									.map((collab) => (
										<li
											key={collab.id}
											className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 rounded-lg border dark:border-gray-700 group ${
												collab.id === collaborationListState.value.selectedId
													? 'bg-blue-50 dark:bg-blue-900/30'
													: ''
											} ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
											onClick={() => !isLoading && onSelect(collab.id)}
										>
											<div className='space-y-2'>
												{/* Row 1: Title and Buttons */}
												<div className='flex justify-between items-start gap-2'>
													<div className='flex-1 min-w-0'>
														{editingCollaboration.value === collab.id
															? (
																<div className='flex items-center gap-2'>
																	<input
																		type='text'
																		value={editedTitle.value}
																		onInput={(e) =>
																			editedTitle.value =
																				(e.target as HTMLInputElement).value}
																		onClick={(e) => e.stopPropagation()}
																		onKeyDown={(e) => {
																			if (e.key === 'Enter') {
																				e.preventDefault();
																				saveTitle(collab.id);
																			} else if (e.key === 'Escape') {
																				e.preventDefault();
																				cancelEditing();
																			}
																		}}
																		className='flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
																		placeholder='Enter title...'
																		autoFocus
																		aria-label='Edit collaboration title'
																	/>
																	<button
																		type='button'
																		onClick={(e) => {
																			e.stopPropagation();
																			saveTitle(collab.id);
																		}}
																		disabled={isUpdatingTitle.value ||
																			!editedTitle.value.trim()}
																		className='p-1 text-green-600 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed'
																		title='Save title'
																		aria-label='Save title'
																	>
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
																				d='M5 13l4 4L19 7'
																			/>
																		</svg>
																	</button>
																	<button
																		type='button'
																		onClick={(e) => {
																			e.stopPropagation();
																			cancelEditing();
																		}}
																		className='p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
																		title='Cancel editing'
																		aria-label='Cancel editing'
																	>
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
																				d='M6 18L18 6M6 6l12 12'
																			/>
																		</svg>
																	</button>
																</div>
															)
															: (
																<div className='flex items-center gap-2 flex-1 min-w-0'>
																	{
																		/* We don't need a star heading and button */ /* collab.starred && (
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
																		className='font-medium text-gray-900 dark:text-gray-100 text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate'
																		title={collab.title || 'Untitled'}
																		onClick={(e) => {
																			e.stopPropagation();
																			startEditing(collab);
																		}}
																		aria-label='Click to edit title'
																	>
																		{collab.title || 'Untitled'}
																	</h3>
																</div>
															)}
													</div>
													<div className='flex items-center gap-1'>
														{/* Star button */}
														<button
															type='button'
															onClick={(e) => {
																e.stopPropagation();
																toggleStar(collab.id, collab.starred || false);
															}}
															disabled={isUpdatingStar.value === collab.id}
															className={`p-1 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
																collab.starred
																	? 'text-yellow-500 hover:text-yellow-600'
																	: 'text-gray-400 hover:text-yellow-500 dark:text-gray-500 dark:hover:text-yellow-400'
															}`}
															title={collab.starred
																? 'Remove from favorites'
																: 'Add to favorites'}
															aria-label={collab.starred
																? 'Remove from favorites'
																: 'Add to favorites'}
														>
															{collab.starred
																? (
																	<svg
																		className='w-4 h-4'
																		fill='currentColor'
																		viewBox='0 0 24 24'
																	>
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
														{/* Delete button - only visible on hover */}
														<button
															type='button'
															onClick={(e) => {
																e.stopPropagation();
																collaborationToDelete.value = {
																	id: collab.id,
																	title: collab.title || 'Untitled',
																};
																showDeleteConfirm.value = true;
															}}
															className='opacity-0 group-hover:opacity-100 text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-300 dark:hover:text-red-400 p-1 rounded transition-opacity duration-200'
															disabled={isLoading}
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
													</div>
												</div>

												{/* Row 2: ID and Date */}
												<div className='grid grid-cols-2 gap-1.5 text-xs text-gray-500 dark:text-gray-400'>
													<span className='truncate'>ID: {collab.id}</span>
													<span className='flex items-center whitespace-nowrap'>
														<svg
															className='w-3.5 h-3.5 mr-1'
															fill='none'
															stroke='currentColor'
															viewBox='0 0 24 24'
														>
															<path
																strokeLinecap='round'
																strokeLinejoin='round'
																strokeWidth={2}
																d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
															/>
														</svg>
														{new Date(collab.updatedAt).toLocaleDateString(undefined, {
															month: 'short',
															day: 'numeric',
															hour: 'numeric',
															minute: '2-digit',
														})}
													</span>
												</div>

												{/* Row 3: Turns and Tokens */}
												<div className='grid grid-cols-2 gap-1.5 text-xs'>
													{collab.lastInteractionMetadata?.interactionStats && (
														<p className='flex items-center text-blue-600 dark:text-blue-400 dark:text-blue-400'>
															<svg
																className='w-3.5 h-3.5 mr-1'
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'
															>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	strokeWidth={2}
																	d='M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'
																/>
															</svg>
															{collab.lastInteractionMetadata?.interactionStats
																.interactionTurnCount} turns
														</p>
													)}
													{collab.tokenUsageCollaboration && (
														<p className='flex items-center text-purple-600 dark:text-purple-400 dark:text-purple-400'>
															<svg
																className='w-3.5 h-3.5 mr-1'
																fill='none'
																stroke='currentColor'
																viewBox='0 0 24 24'
															>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	strokeWidth={2}
																	d='M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z'
																/>
															</svg>
															{collab.tokenUsageCollaboration.totalAllTokens
																?.toLocaleString() ||
																0} tokens
														</p>
													)}
												</div>
											</div>
										</li>
									))}
							</ul>
						)}
				</div>
			</div>

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
