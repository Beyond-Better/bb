import type { ConversationMetadata } from 'shared/types.ts';
import { useSignal } from '@preact/signals';
import { ConfirmDialog } from '../Dialogs/ConfirmDialog.tsx';
//import type { ChatState, ConversationListState } from '../types/chat.types.ts';

interface ConversationListProps {
	conversations: ConversationMetadata[];
	selectedIndex: number;
	currentConversationId: string | null;
	showDeleteButton?: boolean;
	onSelect: (id: string) => void;
	onDelete: (id: string) => Promise<void>;
}

interface ConversationToDelete {
	id: string;
	title: string;
}

export function ConversationList({
	conversations,
	selectedIndex,
	currentConversationId,
	showDeleteButton = false,
	onSelect,
	onDelete,
}: ConversationListProps) {
	const showDeleteConfirm = useSignal(false);
	const conversationToDelete = useSignal<ConversationToDelete | undefined>(undefined);
	if (conversations.length === 0) {
		return (
			<div className='p-4 text-center text-gray-500 dark:text-gray-400 text-sm'>
				<p className='text-sm'>No conversations found</p>
			</div>
		);
	}

	return (
		<>
			<ul className='max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800'>
				{conversations.map((conv, index) => (
					<li
						key={conv.id}
						className={`px-4 py-2 cursor-pointer group ${
							index === selectedIndex
								? 'bg-gray-100 dark:bg-gray-800'
								: 'hover:bg-gray-50 dark:hover:bg-gray-700'
						} ${
							conv.id === currentConversationId
								? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/30'
								: ''
						}`}
						onClick={() => onSelect(conv.id)}
					>
						<div className='flex justify-between items-start'>
							<div className='flex-1 min-w-0'>
								{/* Title and Updated Time */}
								<div className='flex justify-between items-start mb-1'>
									<h3
										className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'
										title={conv.title || 'Untitled'}
									>
										{conv.title || 'Untitled'}
									</h3>
								</div>

								{/* Stats Row */}
								<div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
									{/* Turn Count */}
									{conv.conversationStats && (
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
											{conv.conversationStats.conversationTurnCount} turns
										</span>
									)}

									{/* Token Count */}
									{conv.tokenUsageConversation && (
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
											{conv.tokenUsageConversation.totalTokens?.toLocaleString() ||
												conv.tokenUsageConversation.totalTokensTotal?.toLocaleString() ||
												0} tokens
										</span>
									)}
									<span className='text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap'>
										{new Date(conv.updatedAt).toLocaleDateString(undefined, {
											month: 'short',
											day: 'numeric',
											hour: 'numeric',
											minute: '2-digit',
										})}
									</span>
								</div>
							</div>

							{/* Delete Button */}
							{showDeleteButton &&
								(
									<button
										onClick={(e) => {
											e.stopPropagation();
											conversationToDelete.value = {
												id: conv.id,
												title: conv.title || 'Untitled',
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
					</li>
				))}
			</ul>

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
