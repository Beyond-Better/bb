import { forwardRef } from 'preact/compat';
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

interface ModelTriggerProps {
	isOpen: boolean;
	selectedOption?: SelectOption;
	selectedModel?: ModelInfo;
	placeholder: string;
	onClick: () => void;
	className?: string;
}

export const ModelTrigger = forwardRef<HTMLButtonElement, ModelTriggerProps>(
	({ isOpen, selectedOption, selectedModel, placeholder, onClick, className = '' }, ref) => {
		const renderSelectedContent = () => {
			if (!selectedOption || !selectedModel) {
				return (
					<span className='text-gray-500 dark:text-gray-400'>
						{placeholder}
					</span>
				);
			}

			const providerIcon = getProviderIcon(selectedModel.provider);
			const speedIcon = getCharacteristicDisplay('speed', selectedModel.responseSpeed);
			const costIcon = getCharacteristicDisplay('cost', (selectedModel as any).cost || 'medium');
			const intelligenceIcon = getCharacteristicDisplay('intelligence', (selectedModel as any).intelligence || 'high');

			return (
				<div className='flex items-center justify-between w-full'>
					<div className='flex items-center gap-2 flex-1 min-w-0'>
						<span className='text-lg'>{providerIcon}</span>
						<div className='flex flex-col min-w-0'>
							<span className='font-medium text-gray-900 dark:text-gray-100 truncate'>
								{selectedModel.displayName}
							</span>
							<div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
								<span>{speedIcon}</span>
								<span>{costIcon}</span>
								<span>{intelligenceIcon}</span>
								<span className='ml-1'>
									{(selectedModel.contextWindow / 1000).toFixed(0)}K
								</span>
							</div>
						</div>
					</div>
				</div>
			);
		};

		return (
			<button
				ref={ref}
				type='button'
				onClick={onClick}
				className={`w-full flex items-center justify-between px-3 py-2 text-left bg-white dark:bg-gray-800 border rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors ${
					isOpen
						? 'border-blue-500 dark:border-blue-400 rounded-b-none'
						: 'border-gray-300 dark:border-gray-600'
				} ${className}`}
			>
				{renderSelectedContent()}
				
				{/* Chevron Icon */}
				<svg
					className={`ml-2 h-5 w-5 text-gray-400 transition-transform flex-shrink-0 ${
						isOpen ? 'rotate-180' : ''
					}`}
					fill='none'
					stroke='currentColor'
					viewBox='0 0 24 24'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth={2}
						d='M19 9l-7 7-7-7'
					/>
				</svg>
			</button>
		);
	}
);