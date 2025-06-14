import { useEffect, useState, useRef } from 'preact/hooks';
import { signal, useComputed } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { ModelSelect, type SelectOption } from './ModelSelect/index.ts';
import type { ApiClient } from '../utils/apiClient.utils.ts';

// Model information interface
export interface ModelInfo {
	id: string;
	displayName: string;
	provider: string;
	providerLabel: string;
	contextWindow: number;
	responseSpeed: 'fast' | 'medium' | 'slow';
	cost?: 'low' | 'medium' | 'high' | 'very-high';
	intelligence?: 'medium' | 'high' | 'very-high';
	releaseDate?: string;
	trainingCutoff?: string;
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
	label: string | JSX.Element;
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

// Provider logos/icons mapping
const getProviderIcon = (provider: string) => {
	const icons: Record<string, string> = {
		'anthropic': '🧠', // Temporary emoji until we add SVG logos
		'openai': '🤖',
		'google': '🔍',
		'deepseek': '🔬',
		'ollama': '🦙',
		'groq': '⚡',
	};
	return icons[provider.toLowerCase()] || '🎯';
};

// Model speed/cost/intelligence mapping
const getModelCharacteristics = (model: ModelInfo) => {
	return {
		speed: model.responseSpeed,
		cost: (model as any).cost || 'medium', // Use actual cost from model data
		intelligence: (model as any).intelligence || 'high', // Use actual intelligence from model data
	};
};

// Get display text for characteristics
const getCharacteristicDisplay = (type: string, value: string) => {
	const icons: Record<string, Record<string, string>> = {
		speed: { fast: '⚡', medium: '🚀', slow: '🐌' },
		cost: { low: '💚', medium: '💛', high: '💸', 'very-high': '💰' },
		intelligence: { medium: '🧠', high: '🎯', 'very-high': '🔮' },
	};
	return icons[type]?.[value] || value;
};

// Suggested model combinations
const SUGGESTED_COMBOS = [
	{
		name: 'Balanced Performance',
		description: 'Good balance of speed, cost, and capability',
		provider: 'Claude',
		models: {
			orchestrator: 'claude-sonnet-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
	{
		name: 'Maximum Intelligence',
		description: 'Best reasoning and problem-solving capabilities',
		provider: 'Claude',
		models: {
			orchestrator: 'claude-opus-4-20250514',
			agent: 'claude-opus-4-20250514',
			chat: 'claude-sonnet-4-20250514',
		},
	},
	{
		name: 'Competent Orchestrator',
		description: 'Best reasoning for orchestrator and good problem-solving for agent',
		provider: 'Claude',
		models: {
			orchestrator: 'claude-opus-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
	{
		name: 'Cost Optimized',
		description: 'Minimize costs while maintaining good performance',
		provider: 'Claude',
		models: {
			orchestrator: 'claude-3-5-haiku-20241022',
			agent: 'claude-3-5-haiku-20241022',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
	{
		name: 'Deep Research',
		description: 'Optimal for complex analysis and research tasks',
		provider: 'Cross-Provider',
		models: {
			orchestrator: 'claude-opus-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'gpt-4o',
		},
	},
	{
		name: 'Coding Specialist',
		description: 'Optimized for software development and programming',
		provider: 'Cross-Provider',
		models: {
			orchestrator: 'claude-sonnet-4-20250514',
			agent: 'gpt-4o',
			chat: 'claude-3-5-haiku-20241022',
		},
	},
	{
		name: 'Content Creation',
		description: 'Perfect for writing, editing, and creative tasks',
		provider: 'Cross-Provider',
		models: {
			orchestrator: 'claude-opus-4-20250514',
			agent: 'claude-sonnet-4-20250514',
			chat: 'gpt-4o',
		},
	},
	{
		name: 'Speed Optimized',
		description: 'Fast responses for real-time interactions',
		provider: 'Multi-Provider',
		models: {
			orchestrator: 'claude-3-5-haiku-20241022',
			agent: 'gpt-3.5-turbo',
			chat: 'gemini-1.5-flash',
		},
	},
	{
		name: 'Gemini Balanced',
		description: 'Google Gemini for reliability and consistency',
		provider: 'Gemini',
		models: {
			orchestrator: 'gemini-2.5-pro-preview-06-05',
			agent: 'gemini-2.5-flash-preview-05-20',
			chat: 'gemini-2.5-flash-preview-05-20',
		},
	},
	{
		name: 'Gemini Performance',
		description: 'Google Gemini for multimodal capabilities',
		provider: 'Gemini',
		models: {
			orchestrator: 'gemini-2.5-flash-preview-05-20',
			agent: 'gemini-2.5-flash-preview-05-20',
			chat: 'gemini-1.5-flash',
		},
	},
	{
		name: 'OpenAI Balanced',
		description: 'OpenAI models for reliability and consistency',
		provider: 'OpenAI',
		models: {
			orchestrator: 'gpt-4o',
			agent: 'gpt-4',
			chat: 'gpt-3.5-turbo',
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
					//console.log('ModelSelector: ', { models: response?.models });
					if (response) {
						// Define sort order for providers (matching getProviderIcon order)
						const providerOrder = ['anthropic', 'openai', 'google', 'deepseek', 'ollama', 'groq'];
						// Define sort order for cost and intelligence enums
						const costOrder = ['low', 'medium', 'high', 'very-high'];
						const intelligenceOrder = ['medium', 'high', 'very-high'];

						const sortedModels = response.models
							.map((model) => ({
								...model,
								responseSpeed: model.responseSpeed as 'fast' | 'medium' | 'slow',
							}))
							.sort((a, b) => {
								// 1. Sort by provider (using defined order)
								const providerA = providerOrder.indexOf(a.provider.toLowerCase());
								const providerB = providerOrder.indexOf(b.provider.toLowerCase());
								const providerComparison = (providerA === -1 ? 999 : providerA) -
									(providerB === -1 ? 999 : providerB);
								if (providerComparison !== 0) return providerComparison;

								// 2. Sort by release date (newest first)
								const dateA = (a as any).releaseDate ? new Date((a as any).releaseDate).getTime() : 0;
								const dateB = (b as any).releaseDate ? new Date((b as any).releaseDate).getTime() : 0;
								const dateComparison = dateB - dateA;
								if (dateComparison !== 0) return dateComparison;

								// 3. Sort by cost (low to high)
								const costA = costOrder.indexOf((a as any).cost || 'medium');
								const costB = costOrder.indexOf((b as any).cost || 'medium');
								const costComparison = (costA === -1 ? 1 : costA) - (costB === -1 ? 1 : costB);
								if (costComparison !== 0) return costComparison;

								// 4. Sort by intelligence (high to low)
								const intelligenceA = intelligenceOrder.indexOf((a as any).intelligence || 'high');
								const intelligenceB = intelligenceOrder.indexOf((b as any).intelligence || 'high');
								const intelligenceComparison = (intelligenceB === -1 ? 1 : intelligenceB) -
									(intelligenceA === -1 ? 1 : intelligenceA);
								return intelligenceComparison;
							});
						//console.log('ModelSelector: ', {sortedModels});

						modelsState.value = {
							models: sortedModels,
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
		// [TODO]  All instances of this component load at the same time, so this check doesn't stop multiple requests
		// A hook for useState is probably needed to optimize this call.
		//if (modelsState.value.models.length > 0) return;
		loadModels();
	}, [apiClient]);

	// Generate select options from models
	const selectOptions = useComputed(() => {
		const options: SelectOption[] = [];
		//console.log('ModelSelector: Generating options from models:', modelsState.value.models.map(m => ({id: m.id, displayName: m.displayName})));

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
				const providerIcon = getProviderIcon(models[0]?.provider || '');
				options.push({
					value: `header-${providerLabel}`,
					label: `${providerIcon} ${providerLabel}`,
					isHeader: true,
				});
			}

			models.forEach((model) => {
				const characteristics = getModelCharacteristics(model);
				const speedIcon = getCharacteristicDisplay('speed', characteristics.speed);
				const costIcon = getCharacteristicDisplay('cost', characteristics.cost);
				const intelligenceIcon = getCharacteristicDisplay('intelligence', characteristics.intelligence);
				const providerIcon = getProviderIcon(model.provider);

				const label = compact ? model.displayName : (
					<span>
						<span className='mr-2'>{providerIcon}</span> {model.displayName}
						<span className='ml-4 whitespace-nowrap'>{`${speedIcon} ${costIcon} ${intelligenceIcon}`}</span>
					</span>
				);

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
			//console.log('ModelSelector: currentValue (conversation context):', value);
			return value; // Conversation context
		}
		// Global/project context
		return (value as ModelSelectionValue).project ?? (value as ModelSelectionValue).global ?? '';
		//const result = (value as ModelSelectionValue).project ?? (value as ModelSelectionValue).global ?? '';
		//console.log('ModelSelector: currentValue (global/project context):', result);
		//return result;
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
		return modelsState.value.models.find((model) => model.id === currentValue.value);
	});

	if (modelsState.value.loading) {
		return (
			<div className={`space-y-2 ${className}`}>
				{label && (
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
						{label}
					</label>
				)}
				<div className='animate-pulse'>
					<div className='h-10 bg-gray-200 dark:bg-gray-700 rounded-md'></div>
				</div>
			</div>
		);
	}

	if (modelsState.value.error || localError) {
		return (
			<div className={`space-y-2 ${className}`}>
				{label && (
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
						{label}
					</label>
				)}
				<div className='text-red-600 dark:text-red-400 text-sm'>
					Error loading models: {modelsState.value.error || localError}
				</div>
			</div>
		);
	}

	return (
		<div className={`space-y-2 ${className}`}>
			{label && (
				<div className='flex items-center gap-2'>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
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
					{context === 'project' && isProjectOverride && (
						<button
							type='button'
							onClick={handleReset}
							className='text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400'
							title='Reset to global default'
							disabled={disabled}
						>
							<svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path
									strokeLinecap='round'
									strokeLinejoin='round'
									strokeWidth='2'
									d='M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
								/>
							</svg>
						</button>
					)}
				</div>
			)}

			{description && (
				<p className='text-sm text-gray-500 dark:text-gray-400'>
					{description}
				</p>
			)}

			<div className='relative'>
				<ModelSelect
					options={selectOptions.value}
					models={modelsState.value.models}
					value={currentValue.value}
					onChange={handleChange}
					className='w-full'
					disabled={disabled}
					placeholder='Select a model...'
				/>

				{context === 'project' && isProjectOverride && (
					<button
						type='button'
						onClick={handleReset}
						className='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
						title='Reset to global default'
						disabled={disabled}
					>
						<svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth='2'
								d='M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					</button>
				)}
			</div>

			{!compact && selectedModel.value && (
				<div className='mt-2 text-xs text-gray-500 dark:text-gray-400'>
					Context: {(selectedModel.value.contextWindow / 1000).toFixed(0)}K tokens • Provider:{' '}
					{getProviderIcon(selectedModel.value.provider)} {selectedModel.value.providerLabel}
					{selectedModel.value.responseSpeed && <>• Speed: {selectedModel.value.responseSpeed}</>}
				</div>
			)}
		</div>
	);
}

// Icon Legend Component
export function ModelIconLegend({
	className = '',
	collapsible = true,
}: {
	className?: string;
	collapsible?: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);

	// Handle click outside to close popover
	useEffect(() => {
		if (!isExpanded || !collapsible) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				!buttonRef.current?.contains(e.target as Node)
			) {
				setIsExpanded(false);
			}
		};

		globalThis.addEventListener('mousedown', handleClickOutside);
		return () => globalThis.removeEventListener('mousedown', handleClickOutside);
	}, [isExpanded, collapsible]);

	return (
		<div className={`relative ${className}`}>
			{collapsible
				? (
					<>
						<button
							ref={buttonRef}
							type='button'
							onClick={() => setIsExpanded(!isExpanded)}
							className='px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 transition-colors flex items-center gap-2'
						>
							<span>Model Icons</span>
							<svg
								className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
							</svg>
						</button>
						
						{/* Popover */}
						{isExpanded && (
							<div
								ref={popoverRef}
								className='absolute z-50 mt-2 right-0 w-80 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 shadow-lg p-4'
								style={{
									top: '100%',
								}}
							>
								<h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>Model Icons Guide</h4>
								<IconLegendContent className='text-gray-700 dark:text-gray-300' />
							</div>
						)}
					</>
				)
				: (
					<div className='bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-3'>
						<h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>Model Icons</h4>
						<IconLegendContent className='text-gray-700 dark:text-gray-300' />
					</div>
				)}
		</div>
	);
}

export function IconLegendContent({ className = '' }: { className?: string }) {
	return (
		<div className={`space-y-2 text-xs ${className}`}>
			<div>
				<div className='font-medium text-gray-600 dark:text-gray-400 mb-1'>Speed:</div>
				<div className='flex gap-3'>
					<span>⚡ Fast</span>
					<span>🚀 Medium</span>
					<span>🐌 Slow</span>
				</div>
			</div>
			<div>
				<div className='font-medium text-gray-600 dark:text-gray-400 mt-4 mb-1'>Cost:</div>
				<div className='flex gap-3'>
					<span>💚 Low</span>
					<span>💛 Medium</span>
					<span>💸 High</span>
					<span>💰 Very High</span>
				</div>
			</div>
			<div>
				<div className='font-medium text-gray-600 dark:text-gray-400 mt-4 mb-1'>Intelligence:</div>
				<div className='flex gap-3'>
					<span>🧠 Medium</span>
					<span>🎯 High</span>
					<span>🔮 Very High</span>
				</div>
			</div>
		</div>
	);
}

// Model Role Explanations Content
export function ModelRoleExplanationsContent({ className = '' }: { className?: string }) {
	return (
		<div className={`space-y-3 text-sm ${className}`}>
			<div>
				<div className='font-medium'>🎯 Orchestrator Model</div>
				<div className='text-xs mt-1'>
					Coordinates multi-agent workflows and delegates tasks to agents. Also used for single-agent
					scenarios when the orchestrator performs all tasks directly. Requires strong reasoning capabilities.
				</div>
			</div>
			<div>
				<div className='font-medium'>📥 Agent Model</div>
				<div className='text-xs mt-1'>
					Executes specific tasks delegated by the orchestrator. Only used when the orchestrator delegates
					work. Should be capable of focused task execution and tool usage.
				</div>
			</div>
			<div>
				<div className='font-medium'>🔧 Admin Model</div>
				<div className='text-xs mt-1'>
					Handles administrative tasks like generating conversation titles, summarizing objectives, creating
					audit trail messages, and other meta-operations. Can be more cost-effective.
				</div>
			</div>
		</div>
	);
}
// Model Role Explanations Component
export function ModelRoleExplanations({ className = '' }: { className?: string }) {
	return (
		<div
			className={`bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-4 ${className}`}
		>
			<h4 className='text-sm font-medium text-blue-900 dark:text-blue-100 mb-3'>
				Model Roles Explained
			</h4>
			<ModelRoleExplanationsContent className='text-blue-800 dark:text-blue-200' />
		</div>
	);
}
export function ModelSelectHelp({ className = '' }: { className?: string }) {
	/* Model Role Explanations and Icon Legend - updated for column layout */
	return (
		<div className={`space-y-4 ${className}`}>
			{/* Icon Legend - Now collapsible */}
			<ModelIconLegend collapsible={true} />
		</div>
	);
}

// System Cards Modal Component
export function SystemCardsModal({
	isOpen,
	onClose,
	models,
	className = '',
}: {
	isOpen: boolean;
	onClose: () => void;
	models: ModelInfo[];
	className?: string;
}) {
	if (!isOpen) return null;

	// Group models by provider
	const modelsByProvider = models.reduce((acc, model) => {
		if (!acc[model.providerLabel]) {
			acc[model.providerLabel] = [];
		}
		acc[model.providerLabel].push(model);
		return acc;
	}, {} as Record<string, ModelInfo[]>);

	return (
		<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
			<div
				className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-auto ${className}`}
			>
				<div className='flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
						All Available Models
					</h3>
					<button
						type='button'
						className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl font-bold'
						onClick={onClose}
					>
						×
					</button>
				</div>

				<div className='px-6 py-4 space-y-6'>
					{Object.entries(modelsByProvider).map(([providerLabel, providerModels]) => (
						<div key={providerLabel}>
							<h4 className='text-md font-medium text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2'>
								{getProviderIcon(providerModels[0]?.provider || '')} {providerLabel}
							</h4>
							<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
								{providerModels.map((model) => {
									const characteristics = getModelCharacteristics(model);
									const speedIcon = getCharacteristicDisplay('speed', characteristics.speed);
									const costIcon = getCharacteristicDisplay('cost', characteristics.cost);
									const intelligenceIcon = getCharacteristicDisplay(
										'intelligence',
										characteristics.intelligence,
									);

									return (
										<div
											key={model.id}
											className='border border-gray-200 dark:border-gray-700 rounded-md p-3 hover:shadow-md transition-shadow'
										>
											<div className='font-medium text-gray-900 dark:text-gray-100 mb-2'>
												{model.displayName}
											</div>
											<div className='text-sm text-gray-600 dark:text-gray-400 space-y-1'>
												<div>Context: {(model.contextWindow / 1000).toFixed(0)}K tokens</div>
												<div>Speed: {speedIcon} {model.responseSpeed}</div>
												<div>Cost: {costIcon} {characteristics.cost}</div>
												<div>
													Intelligence: {intelligenceIcon} {characteristics.intelligence}
												</div>
												{(model as any).releaseDate && (
													<div>Release: {(model as any).releaseDate}</div>
												)}
												{(model as any).trainingCutoff && (
													<div>Training Cutoff: {(model as any).trainingCutoff}</div>
												)}
												<div className='text-xs text-gray-500 dark:text-gray-500 mt-2'>
													ID: {model.id}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

// Suggested model combinations component - now compact and expandable
export function ModelCombinations({
	onApplyCombo,
	className = '',
}: {
	onApplyCombo: (combo: { orchestrator: string; agent: string; chat: string }) => void;
	className?: string;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	return (
		<div className={`space-y-3 ${className}`}>
			<div className='bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700'>
				<button
					type='button'
					onClick={() => setIsExpanded(!isExpanded)}
					className='w-full px-4 py-3 text-left flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors'
				>
					<div className='flex flex-col items-start gap-1'>
						<div className='flex items-center gap-2'>
							<span>Suggested Model Combinations</span>
							<span className='px-2 py-0.5 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 rounded-full'>
								{SUGGESTED_COMBOS.length}
							</span>
						</div>
						<p className='text-xs text-gray-500 dark:text-gray-400 font-normal'>
							Pre-configured model sets optimized for different use cases like cost efficiency, maximum intelligence, or specialized tasks
						</p>
					</div>
					<svg
						className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
						fill='none'
						stroke='currentColor'
						viewBox='0 0 24 24'
					>
						<path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M19 9l-7 7-7-7' />
					</svg>
				</button>
				{isExpanded && (
					<div className='px-4 pb-4 pt-1 border-t border-gray-200 dark:border-gray-700'>
						<div className='flex justify-end mb-3 mt-2'>
							<ModelSystemCardsLink />
						</div>
						<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
							{SUGGESTED_COMBOS.map((combo, index) => (
								<div
									key={index}
									className='border border-gray-200 dark:border-gray-600 rounded-md p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
								>
									<div className='space-y-2'>
										<div className='flex-1 min-w-0'>
											<h5 className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'>
												{getProviderIcon(combo.models.orchestrator.split('-')[0])} {combo.name}
											</h5>
											<p className='text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2'>
												{combo.description}
											</p>
											<p className='text-xs text-blue-600 dark:text-blue-400 mt-1'>
												{combo.provider}
											</p>
										</div>
										<button
											type='button'
											onClick={() => onApplyCombo(combo.models)}
											className='w-full text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium py-1 px-2 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors'
										>
											Apply
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

export function ModelSystemCardsLink({
	className = '',
}: {
	className?: string;
}) {
	const [showSystemCards, setShowSystemCards] = useState(false);

	return (
		<div>
			<button
				type='button'
				onClick={() => setShowSystemCards(true)}
				className='px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-700 transition-colors'
			>
				View All Models
			</button>
			{/* System Cards Modal */}
			<SystemCardsModal
				isOpen={showSystemCards}
				onClose={() => setShowSystemCards(false)}
				models={modelsState.value.models}
			/>
		</div>
	);
}
