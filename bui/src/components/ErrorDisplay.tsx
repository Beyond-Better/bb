import { Signal } from '@preact/signals';

interface ErrorState {
	message: string;
	timestamp: number;
	recoveryAction?: () => void;
	recoveryMessage?: string;
}

interface ErrorDisplayProps {
	error: Signal<ErrorState | null>;
}

export function ErrorDisplay({ error }: ErrorDisplayProps) {
	if (!error.value) return null;

	return (
		<div className='text-sm text-red-500 dark:text-red-400 mb-2 flex items-center justify-between'>
			<span>{error.value.message}</span>
			<div className='flex items-center'>
				{error.value.recoveryAction && (
					<button
						type='button'
						onClick={() => {
							error.value?.recoveryAction?.();
							error.value = null;
						}}
						className='ml-4 text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300'
					>
						{error.value.recoveryMessage || 'Retry'}
					</button>
				)}
				<button
					type='button'
					onClick={() => error.value = null}
					className='ml-4 text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200'
					title='Dismiss'
				>
					✕
				</button>
			</div>
		</div>
	);
}
