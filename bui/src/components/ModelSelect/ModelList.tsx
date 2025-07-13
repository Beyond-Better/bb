import type { ModelInfo } from '../ModelManager.tsx';
import type { SelectOption } from './ModelSelect.tsx';

interface ModelListProps {
	options: SelectOption[];
	models: ModelInfo[];
	selectedIndex: number;
	currentValue: string;
	searchQuery: string;
	onSelect: (value: string) => void;
}

export function ModelList({
	options,
	models,
	selectedIndex,
	currentValue,
	searchQuery,
	onSelect,
}: ModelListProps) {
	// Filter out headers and disabled options when counting valid options for navigation
	const validOptions = options.filter((opt) => !opt.isHeader && !opt.disabled);

	if (validOptions.length === 0) {
		return (
			<div className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center'>
				{searchQuery ? 'No models found' : 'No models available'}
			</div>
		);
	}
	console.log('ModelList', options);

	return (
		<div className='max-h-64 overflow-y-auto'>
			{options.map((option, _index) => {
				if (option.isHeader) {
					return (
						<div
							key={option.value}
							className='px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600'
						>
							{option.label}
						</div>
					);
				}

				// Find the corresponding model info
				const modelInfo = models.find((m) => m.id === option.value);
				const validIndex = validOptions.findIndex((opt) => opt.value === option.value);
				const isSelected = validIndex === selectedIndex;
				const isCurrent = option.value === currentValue;

				return (
					<button
						key={option.value}
						type='button'
						onClick={() => !option.disabled && onSelect(option.value)}
						disabled={option.disabled}
						className={`w-full px-4 py-3 text-left border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
							option.disabled 
								? 'cursor-not-allowed bg-gray-50 dark:bg-gray-800' 
								: 'hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700'
						} ${
							isSelected && !option.disabled ? 'bg-blue-50 dark:bg-blue-900/20' : ''
						} ${isCurrent && !option.disabled ? 'bg-blue-100 dark:bg-blue-800/30' : ''}`}
					>
						<div className='flex items-center justify-between'>
							<div className='flex-1 min-w-0'>
								{option.label}
							</div>
							{isCurrent && !option.disabled && (
								<svg
									className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 ml-2'
									fill='currentColor'
									viewBox='0 0 20 20'
								>
									<path
										fillRule='evenodd'
										d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
										clipRule='evenodd'
									/>
								</svg>
							)}
						</div>
					</button>
				);
			})}
		</div>
	);
}
