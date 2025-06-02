import { useEffect, useState } from 'preact/hooks';
import { signal, useComputed } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { CustomSelect, type SelectOption } from './CustomSelect.tsx';
import type { ApiClient } from '../utils/apiClient.utils.ts';

// Model information interface
export interface ModelInfo {
	id: string;
	displayName: string;
	provider: string;
	providerLabel: string;
	contextWindow: number;
	responseSpeed: 'fast' | 'medium' | 'slow';
	// We'll extend this with capabilities later
}

// Model selection value interface
export interface ModelSelectionValue {
	global?: string;
	project?: string | null;
}

// Context type for different use cases
export type ModelSelectorContext = 'global' | 'project' | 'conversation';

// Role type for different model purposes
export type ModelRole = 'orchestrator' | 'agent' | 'chat';

interface ModelSelectorProps {
	apiClient: ApiClient;
	context: ModelSelectorContext;
	role: ModelRole;
	value: ModelSelectionValue | string; // string for conversation context, ModelSelectionValue for global/project
	onChange: (value: ModelSelectionValue | string) => void;
	label?: string;
	description?: string;
	className?: string;
	compact?: boolean; // For conversation context
	disabled?: boolean;
}

// Global state for models to avoid repeated API calls
const modelsState = signal<{
	models: ModelInfo[];
	loading: boolean;
	error: string | null;
	lastFetch: number;
}>({
	models: [],
	loading: false,
	error: null,
	lastFetch: 0,
});

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

// Model speed/cost/intelligence mapping
const getModelCharacteristics = (responseSpeed: string, provider: string) => {
	const characteristics = {
		speed: responseSpeed,
		cost: 'medium', // Default, could be enhanced with actual pricing data
		intelligence: 'high', // Default, could be enhanced with capability scoring
	};

	// Override based on known patterns
	if (responseSpeed === 'fast') {
		characteristics.cost = 'low';
		characteristics.intelligence = 'medium';
	} else if (responseSpeed === 'slow') {
		characteristics.cost = 'high';
		characteristics.intelligence = 'very-high';
	}

	return characteristics;
};

// Get display text for characteristics
const getCharacteristicDisplay = (type: string, value: string) => {
	const icons = {
		speed: { fast: '⚡', medium: '🚀', slow: '🐌' },
		cost: { low: '💚', medium: '💛', high: '💸', 'very-high': '💰' },
		intelligence: { medium: '🧠', high: '🎯', 'very-high': '🔮' },
	};
	return icons[type as keyof typeof icons]?.[value as keyof typeof icons[typeof type]] || value;
};

// Suggested model combinations
const SUGGESTED_COMBOS = [
	{
		name: 'Balanced Performance',
		description: 'Good balance of speed, cost, and capability',
		models: {
			orchestrator: 'claude-sonnet-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
	{
		name: 'Maximum Intelligence',
		description: 'Best reasoning and problem-solving capabilities',
		models: {
			orchestrator: 'claude-sonnet-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'claude-sonnet-4-20250514',
		},
	},
	{
		name: 'Cost Optimized',
		description: 'Minimize costs while maintaining good performance',
		models: {
			orchestrator: 'claude-3-5-haiku-20241022',
			agent: 'claude-3-5-haiku-20241022',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
];

export function ModelSelector({
	apiClient,
	context,
	role,
	value,
	onChange,
	label,
	description,
	className = '',
	compact = false,
	disabled = false,
}: ModelSelectorProps) {
	const [localError, setLocalError] = useState<string | null>(null);

	// Load models if needed
	useEffect(() => {
		const loadModels = async () => {
			const now = Date.now();
			if (
				modelsState.value.models.length === 0 ||
				now - modelsState.value.lastFetch > CACHE_DURATION
			) {
				modelsState.value = { ...modelsState.value, loading: true, error: null };
				try {
					const response = await apiClient.listModels();
					if (response) {
						modelsState.value = {
							models: response.models.map(model => ({
								...model,
								responseSpeed: model.responseSpeed as 'fast' | 'medium' | 'slow',
							})),
							loading: false,
							error: null,
							lastFetch: now,
						};
					} else {
						throw new Error('Failed to load models');
					}
				} catch (error) {
					const errorMessage = (error as Error).message;
					modelsState.value = {
						...modelsState.value,
						loading: false,
						error: errorMessage,
					};
					setLocalError(errorMessage);
				}
			}
		};

		loadModels();
	}, [apiClient]);

	// Generate select options from models
	const selectOptions = useComputed(() => {
		const options: SelectOption[] = [];

		// Group models by provider
		const modelsByProvider = modelsState.value.models.reduce((acc, model) => {
			if (!acc[model.providerLabel]) {
				acc[model.providerLabel] = [];
			}
			acc[model.providerLabel].push(model);
			return acc;
		}, {} as Record<string, ModelInfo[]>);

		// Add provider headers and models
		Object.entries(modelsByProvider).forEach(([providerLabel, models]) => {
			if (Object.keys(modelsByProvider).length > 1) {
				options.push({
					value: `header-${providerLabel}`,
					label: providerLabel,
					isHeader: true,
				});
			}

			models.forEach(model => {
				const characteristics = getModelCharacteristics(model.responseSpeed, model.provider);
				const speedIcon = getCharacteristicDisplay('speed', characteristics.speed);
				const costIcon = getCharacteristicDisplay('cost', characteristics.cost);
				const intelligenceIcon = getCharacteristicDisplay('intelligence', characteristics.intelligence);

				const label = compact
					? model.displayName
					: `${model.displayName} ${speedIcon}${costIcon}${intelligenceIcon}`;

				options.push({
					value: model.id,
					label,
				});
			});
		});

		return options;
	});

	// Get current value for display
	const currentValue = useComputed(() => {
		if (typeof value === 'string') {
			return value; // Conversation context
		}
		// Global/project context
		return (value as ModelSelectionValue).project ?? (value as ModelSelectionValue).global ?? '';
	});

	// Handle selection change
	const handleChange = (newValue: string) => {
		if (typeof value === 'string') {
			// Conversation context
			onChange(newValue);
		} else {
			// Global/project context
			const currentModelValue = value as ModelSelectionValue;
			if (context === 'global') {
				onChange({ ...currentModelValue, global: newValue });
			} else {
				onChange({ ...currentModelValue, project: newValue });
			}
		}
	};

	// Handle reset to global default (project context only)
	const handleReset = () => {
		if (context === 'project' && typeof value !== 'string') {
			const currentModelValue = value as ModelSelectionValue;
			onChange({ ...currentModelValue, project: null });
		}
	};

	// Determine if we're showing a project override
	const isProjectOverride = context === 'project' && 
		typeof value !== 'string' && 
		(value as ModelSelectionValue).project !== null;

	// Get the selected model info for additional display
	const selectedModel = useComputed(() => {
		return modelsState.value.models.find(model => model.id === currentValue.value);
	});

	if (modelsState.value.loading) {
		return (
			<div className={`space-y-2 ${className}`}>
				{label && (
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{label}
					</label>
				)}
				<div className="animate-pulse">
					<div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-md"></div>
				</div>
			</div>
		);
	}

	if (modelsState.value.error || localError) {
		return (
			<div className={`space-y-2 ${className}`}>
				{label && (
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{label}
					</label>
				)}
				<div className="text-red-600 dark:text-red-400 text-sm">
					Error loading models: {modelsState.value.error || localError}
				</div>
			</div>
		);
	}

	return (
		<div className={`space-y-2 ${className}`}>
			{label && (
				<div className="flex items-center gap-2">
					<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
						{label}
					</label>
					{context === 'project' && (
						<span
							className={`px-2 py-0.5 text-xs rounded-full ${
								isProjectOverride
									? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
									: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
							}`}
						>
							{isProjectOverride ? 'Project Setting' : 'Global Default'}
						</span>
					)}
				</div>
			)}
			
			{description && (
				<p className="text-sm text-gray-500 dark:text-gray-400">
					{description}
				</p>
			)}

			<div className="relative">
				<CustomSelect
					options={selectOptions.value}
					value={currentValue.value}
					onChange={handleChange}
					className="w-full"
				/>
				
				{context === 'project' && isProjectOverride && (
					<button
						type="button"
						onClick={handleReset}
						className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
						title="Reset to global default"
						disabled={disabled}
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</button>
				)}
			</div>

			{!compact && selectedModel.value && (
				<div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
					Context: {(selectedModel.value.contextWindow / 1000).toFixed(0)}K tokens •{' '}
					Provider: {selectedModel.value.providerLabel}
					{selectedModel.value.responseSpeed && (
						<> • Speed: {selectedModel.value.responseSpeed}</>
					)}
				</div>
			)}
		</div>
	);
}

// Suggested model combinations component
export function ModelCombinations({
	onApplyCombo,
	className = '',
}: {
	onApplyCombo: (combo: { orchestrator: string; agent: string; chat: string }) => void;
	className?: string;
}) {
	return (
		<div className={`space-y-3 ${className}`}>
			<h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
				Suggested Combinations
			</h4>
			<div className="space-y-2">
				{SUGGESTED_COMBOS.map((combo, index) => (
					<div
						key={index}
						className="border border-gray-200 dark:border-gray-700 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-800"
					>
						<div className="flex justify-between items-start">
							<div>
								<h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
									{combo.name}
								</h5>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
									{combo.description}
								</p>
							</div>
							<button
								type="button"
								onClick={() => onApplyCombo(combo.models)}
								className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
							>
								Apply
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}