import { JSX } from 'preact';

interface ErrorMessageProps {
	title?: string;
	message: string;
	onClose?: () => void;
}

export function ErrorMessage({
	title = 'Error',
	message,
	onClose,
}: ErrorMessageProps): JSX.Element {
	return (
		<div
			className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 mr-8 ml-8 animate-fade-in'
			role='alert'
		>
			<div className='flex justify-between items-start'>
				<div>
					<strong className='font-bold mr-2'>{title}:</strong>
					<span className='block sm:inline'>{message}</span>
				</div>
				{onClose && (
					<button
						onClick={onClose}
						className='ml-4 text-red-700 hover:text-red-900 transition-colors duration-300'
						aria-label='Close error message'
					>
						<svg
							className='fill-current h-4 w-4'
							role='button'
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 20 20'
						>
							<title>Close</title>
							<path d='M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z' />
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}
