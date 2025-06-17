import { Signal, useSignal } from '@preact/signals';
import { ConfirmDialog } from './Dialogs/ConfirmDialog.tsx';
import type { ConversationListState } from '../types/chat.types.ts';

interface ConversationListProps {
	onClose?: () => void;
	conversationListState: Signal<ConversationListState>;
	onSelect: (id: string) => void;
	onNew: () => void;
	onDelete: (id: string) => Promise<void>;
}

// [TODO] conversations being passed through via conversationListState are still the legacy version, not this new interface
/*
export interface Conversation {
	version?: number; // defaults to 1 for existing conversations, 2 for new token usage format
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

interface ConversationToDelete {
	id: string;
	title: string;
}

export function ConversationList({
	conversationListState,
	onClose,
	onSelect,
	onNew,
	onDelete,
}: ConversationListProps) {
	const isLoading = conversationListState.value.isLoading;
	const showDeleteConfirm = useSignal(false);
	const conversationToDelete = useSignal<ConversationToDelete | undefined>(undefined);

	return (
		<>
			<div className='flex flex-col h-full'>
				{/* New Conversation Button */}
				<div className='p-4 border-b border-gray-200 dark:border-gray-700 flex-none bg-gray-50 dark:bg-gray-800'>
					<div className='flex items-center gap-2 w-full'>
						{/* Close Button */}
						<button
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

				{/* Conversations List */}
				<div className='flex-1 overflow-y-auto'>
					{conversationListState.value.conversations.length === 0
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
								{conversationListState.value.conversations
									.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
									.map((conv) => (
										<li
											key={conv.id}
											className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 rounded-lg border dark:border-gray-700 group ${
												conv.id === conversationListState.value.selectedId
													? 'bg-blue-50 dark:bg-blue-900/30'
													: ''
											} ${isLoading ? 'opacity-50 cursor-wait' : ''}`}
											onClick={() => !isLoading && onSelect(conv.id)}
										>
											<div className='flex justify-between items-start'>
												<h3
													className='font-medium text-gray-900 dark:text-gray-100 dark:text-gray-100 truncate text-sm'
													title={conv.title || 'Untitled'}
												>
													{conv.title || 'Untitled'}
												</h3>
												{/* Delete button - only visible on hover */}
												<button
													type='button'
													onClick={(e) => {
														e.stopPropagation();
														conversationToDelete.value = {
															id: conv.id,
															title: conv.title || 'Untitled',
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
											<div className='grid grid-cols-2 gap-1.5 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-400 mt-1'>
												<span className='truncate'>ID: {conv.id}</span>
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
													{new Date(conv.updatedAt).toLocaleDateString(undefined, {
														month: 'short',
														day: 'numeric',
														hour: 'numeric',
														minute: '2-digit',
													})}
												</span>
											</div>
											<div className='grid grid-cols-2 gap-1.5 text-xs mt-1'>
												{conv.interactionStats && (
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
														{conv.interactionStats.interactionTurnCount} turns
													</p>
												)}
												{conv.tokenUsageStats.tokenUsageInteraction && (
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
														{conv.tokenUsageStats.tokenUsageInteraction.totalTokens
															?.toLocaleString() ||
															conv.tokenUsageStats.tokenUsageInteraction.totalTokensTotal
																?.toLocaleString() ||
															0} tokens
													</p>
												)}
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
				message={`Are you sure you want to delete the conversation '${conversationToDelete.value?.title}'?`}
				confirmLabel='Delete'
				onConfirm={async () => {
					if (conversationToDelete.value) {
						await onDelete(conversationToDelete.value.id);
						showDeleteConfirm.value = false;
						conversationToDelete.value = undefined;
					}
				}}
				onCancel={() => {
					showDeleteConfirm.value = false;
					conversationToDelete.value = undefined;
				}}
				isDangerous={true}
			/>
		</>
	);
}
