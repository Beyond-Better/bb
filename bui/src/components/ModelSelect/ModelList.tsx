import type { ModelInfo } from '../ModelManager.tsx';
import type { SelectOption } from './ModelSelect.tsx';

// Provider logos/icons mapping (same as in ModelManager)
const getProviderIcon = (provider: string) => {
	const icons: Record<string, string> = {
		'anthropic': '🧠',
		'openai': '🤖',
		'google': '🔍',
		'deepseek': '🔬',
		'ollama': '🦙',
		'groq': '⚡',
	};
	return icons[provider.toLowerCase()] || '🎯';
};

// Model characteristics display (same as in ModelManager)
const getCharacteristicDisplay = (type: string, value: string) => {
	const icons: Record<string, Record<string, string>> = {
		speed: { fast: '⚡', medium: '🚀', slow: '🐌' },
		cost: { low: '💚', medium: '💛', high: '💸', 'very-high': '💰' },
		intelligence: { medium: '🧠', high: '🎯', 'very-high': '🔮' },
	};
	return icons[type]?.[value] || value;
};

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
	// Filter out headers when searching
	const validOptions = options.filter(opt => !opt.isHeader);
	
	if (validOptions.length === 0) {
		return (
			<div className='px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center'>
				{searchQuery ? 'No models found' : 'No models available'}
			</div>
		);
	}

	return (
		<div className='max-h-64 overflow-y-auto'>
			{options.map((option, index) => {
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
				const modelInfo = models.find(m => m.id === option.value);
				const validIndex = validOptions.findIndex(opt => opt.value === option.value);
				const isSelected = validIndex === selectedIndex;
				const isCurrent = option.value === currentValue;

				return (
					<button
						key={option.value}
						type='button'
						onClick={() => onSelect(option.value)}
						className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
							isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
						} ${isCurrent ? 'bg-blue-100 dark:bg-blue-800/30' : ''}`}
					>
						{modelInfo ? (
							<div className='flex items-center justify-between'>
								<div className='flex items-center gap-2 flex-1 min-w-0'>
									<span className='text-lg flex-shrink-0'>
										{getProviderIcon(modelInfo.provider)}
									</span>
									<div className='flex flex-col min-w-0'>
										<span className='font-medium text-gray-900 dark:text-gray-100 truncate'>
											{modelInfo.displayName}
										</span>
										<div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
											<span>
												{getCharacteristicDisplay('speed', modelInfo.responseSpeed)}
											</span>
											<span>
												{getCharacteristicDisplay('cost', (modelInfo as any).cost || 'medium')}
											</span>
											<span>
												{getCharacteristicDisplay('intelligence', (modelInfo as any).intelligence || 'high')}
											</span>
											<span className='ml-1'>
												{(modelInfo.contextWindow / 1000).toFixed(0)}K tokens
											</span>
										</div>
									</div>
								</div>
								{isCurrent && (
									<svg
										className='w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0'
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
						) : (
							<div className='text-gray-900 dark:text-gray-100'>
								{typeof option.label === 'string' ? option.label : option.value}
							</div>
						)}
					</button>
				);
			})}
		</div>
	);
}