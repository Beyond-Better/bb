import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';

export interface SelectOption {
	value: string;
	label: string | JSX.Element;
	isHeader?: boolean;
}

interface CustomSelectProps {
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
}

export function CustomSelect({ options, value, onChange, className = '' }: CustomSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, [ref]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
				setIsOpen(true);
				e.preventDefault();
			}
			return;
		}

		if (e.key === 'Escape') {
			setIsOpen(false);
			return;
		}

		// Add more keyboard navigation...
	};

	const selectedOption = options.find((option) => option.value === value);
	//console.log('CustomSelect: value =', value, 'selectedOption =', selectedOption, 'options count =', options.length);

	return (
		<div ref={ref} className={`relative ${className}`} tabIndex={0} onKeyDown={handleKeyDown}>
			<div
				onClick={() => setIsOpen(!isOpen)}
				className='w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm bg-white dark:bg-gray-800 dark:text-gray-100 cursor-pointer flex justify-between items-center'
			>
				<span>{selectedOption?.label || 'Select...'}</span>
				<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
				</svg>
			</div>

			{isOpen && (
				<div className='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto'>
					{options.map((option) =>
						option.isHeader
							? (
								<div
									key={option.value}
									className='px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
								>
									{option.label}
								</div>
							)
							: (
								<div
									key={option.value}
									onClick={() => {
										if (!option.isHeader) {
											onChange(option.value);
											setIsOpen(false);
										}
									}}
									className={`px-3 py-2 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 dark:text-gray-100 ${
										option.value === value ? 'bg-blue-100 dark:bg-blue-800' : ''
									}`}
								>
									{option.label}
								</div>
							)
					)}
				</div>
			)}
		</div>
	);
}
