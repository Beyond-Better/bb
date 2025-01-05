interface CancelDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	isPaidPlan: boolean;
}

export default function CancelDialog({ isOpen, onClose, onConfirm, isPaidPlan }: CancelDialogProps) {
	if (!isOpen) return null;

	return (
		<div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
			<div class='bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6'>
				<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Cancel Subscription</h3>
				<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>
					{isPaidPlan
						? 'Your subscription will remain active until the end of the current billing period. After that, your account will revert to the free plan.'
						: 'Your subscription will be cancelled immediately.'}
				</p>
				<div class='mt-6 flex justify-end space-x-3'>
					<button
						onClick={onClose}
						class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
					>
						Keep Subscription
					</button>
					<button
						onClick={onConfirm}
						class='px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md'
					>
						Confirm Cancellation
					</button>
				</div>
			</div>
		</div>
	);
}
