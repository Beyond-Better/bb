interface LoadingSpinnerProps {
	size?: 'small' | 'medium' | 'large';
	color?: string;
	message?: string;
	className?: string;
}

export function LoadingSpinner({
	size = 'medium',
	color = 'text-blue-500',
	message,
	className,
}: LoadingSpinnerProps) {
	const sizeClasses = {
		small: 'h-4 w-4',
		medium: 'h-8 w-8',
		large: 'h-12 w-12',
	};

	return (
		<div className={`flex items-center justify-center ${className}`}>
			<svg
				className={`animate-spin ${sizeClasses[size]} ${color}`}
				xmlns='http://www.w3.org/2000/svg'
				fill='none'
				viewBox='0 0 24 24'
			>
				<circle
					className='opacity-25'
					cx='12'
					cy='12'
					r='10'
					stroke='currentColor'
					stroke-width='4'
				/>
				<path
					className='opacity-75'
					fill='currentColor'
					d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
				/>
			</svg>
			{message && <span className={`ml-2 ${color}`}>{message}</span>}
		</div>
	);
}
