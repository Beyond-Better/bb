interface HelpButtonProps {
	onClick: () => void;
	disabled: boolean;
}

export function HelpButton({ onClick, disabled }: HelpButtonProps) {
	return (
		<>
			{/* Divider */}
			<div className='h-6 w-px bg-gray-200' />

			<button
				onClick={onClick}
				disabled={disabled}
				title='Show help'
				className='flex items-center gap-1.5 px-2.5 py-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth={2}
					stroke='currentColor'
					className='w-5 h-5'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z'
					/>
				</svg>
				<span className='text-sm font-medium'>Help</span>
			</button>
		</>
	);
}
