import { JSX } from 'preact';
import { useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { ModelTrigger } from './ModelTrigger.tsx';
import { ModelList } from './ModelList.tsx';
import type { ModelInfo } from '../ModelManager.tsx';

export interface SelectOption {
	value: string;
	label: string | JSX.Element;
	isHeader?: boolean;
	disabled?: boolean;
}

interface ModelSelectProps {
	options: SelectOption[];
	value: string;
	onChange: (value: string) => void;
	className?: string;
	placeholder?: string;
	disabled?: boolean;
	models?: ModelInfo[]; // For additional model info display
}

export function ModelSelect({
	options,
	value,
	onChange,
	className = '',
	placeholder = 'Select a model...',
	disabled = false,
	models = [],
}: ModelSelectProps) {
	const isOpen = useSignal(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const selectedIndex = useSignal(0);
	const searchQuery = useSignal('');

	// Filter options based on search query (exclude headers from filtering)
	const displayedOptions = useComputed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		if (!query) return options;

		return options.filter((option) => {
			if (option.isHeader) return false; // Hide headers when searching

			// Search in the option label if it's a string
			if (typeof option.label === 'string') {
				return option.label.toLowerCase().includes(query) ||
					option.value.toLowerCase().includes(query);
			}

			// For JSX elements, search in the value
			return option.value.toLowerCase().includes(query);
		});
	});

	// Find the current selected option
	const selectedOption = useComputed(() => options.find((opt) => opt.value === value && !opt.isHeader));

	// Find the current selected model info
	const selectedModel = useComputed(() => models.find((model) => model.id === value));

	// Handle keyboard navigation
	useEffect(() => {
		if (!isOpen.value) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			const validOptions = displayedOptions.value.filter((opt) => !opt.isHeader && !opt.disabled);

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					selectedIndex.value = (selectedIndex.value + 1) % validOptions.length;
					break;
				case 'ArrowUp':
					e.preventDefault();
					selectedIndex.value = selectedIndex.value - 1 < 0
						? validOptions.length - 1
						: selectedIndex.value - 1;
					break;
				case 'Enter': {
					e.preventDefault();
					const selectedOpt = validOptions[selectedIndex.value];
					if (selectedOpt && !selectedOpt.isHeader && !selectedOpt.disabled) {
						onChange(selectedOpt.value);
						isOpen.value = false;
					}
					break;
				}
				case 'Escape':
					e.preventDefault();
					isOpen.value = false;
					triggerRef.current?.focus();
					break;
			}
		};

		globalThis.addEventListener('keydown', handleKeyDown);
		return () => globalThis.removeEventListener('keydown', handleKeyDown);
	}, [isOpen.value, displayedOptions.value, selectedIndex.value]);

	// Handle click outside
	useEffect(() => {
		if (!isOpen.value) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				!triggerRef.current?.contains(e.target as Node)
			) {
				isOpen.value = false;
			}
		};

		globalThis.addEventListener('mousedown', handleClickOutside);
		return () => globalThis.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen.value]);

	if (disabled) {
		return (
			<div className={`relative ${className}`}>
				<div className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'>
					{selectedOption.value?.label || placeholder}
				</div>
			</div>
		);
	}

	return (
		<div className={`relative ${className}`}>
			<ModelTrigger
				ref={triggerRef}
				isOpen={isOpen.value}
				selectedOption={selectedOption.value}
				selectedModel={selectedModel.value}
				placeholder={placeholder}
				onClick={() => isOpen.value = !isOpen.value}
			/>

			{isOpen.value && (
				<div
					ref={popoverRef}
					className='absolute z-50 bg-white dark:bg-gray-800 border-x border-b border-blue-500 dark:border-blue-400 rounded-b-lg shadow-lg overflow-hidden w-full'
					style={{
						top: '100%',
						left: 0,
						right: 0,
						marginTop: -1,
					}}
				>
					{/* Search Input */}
					<div className='border-b border-gray-200 dark:border-gray-700 relative'>
						<input
							type='text'
							value={searchQuery.value}
							onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
							placeholder='Search models...'
							autoComplete='off'
							className='w-full px-4 py-2 pr-10 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'
						/>
						{searchQuery.value && (
							<button
								type='button'
								onClick={() => searchQuery.value = ''}
								className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
								title='Clear search'
							>
								<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth='2'
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						)}
					</div>

					{/* Model List */}
					<ModelList
						options={displayedOptions.value}
						models={models}
						selectedIndex={selectedIndex.value}
						currentValue={value}
						searchQuery={searchQuery.value}
						onSelect={(optionValue) => {
							onChange(optionValue);
							isOpen.value = false;
						}}
					/>
				</div>
			)}
		</div>
	);
}
