import { JSX } from 'preact';
import { useState } from 'preact/hooks';
import { Signal } from '@preact/signals';
import type { ModelDetails } from '../utils/apiClient.utils.ts';
import type { LLMModelConfig } from '../types/llm.types.ts';
import type { TokenUsage } from 'shared/types.ts';

interface ModelInfoPanelProps {
	isOpen: boolean;
	onClose: () => void;
	modelInfo: {
		model: string;
		provider: string;
		modelConfig?: LLMModelConfig;
		tokenUsageConversation?: TokenUsage;
		tokenUsageTurn?: TokenUsage;
	};
	modelData: Signal<ModelDetails | null>;
}

export function ModelInfoPanel({ isOpen, onClose, modelInfo, modelData }: ModelInfoPanelProps): JSX.Element {
	if (!isOpen) return <></>; // Don't render if not open

	//console.log(`ModelInfoPanel: ${isOpen ? 'Open' : 'Closed'}`);
	//console.log(`ModelInfoPanel:`, {modelInfo});
	console.log(`ModelInfoPanel:`, { modelData: modelData.value });
	const { model, provider, modelConfig, tokenUsageTurn, tokenUsageConversation } = modelInfo;

	// Extract request parameters or use defaults
	const temperature = modelConfig?.temperature ?? 0;
	const maxTokens = modelConfig?.maxTokens ?? 0;
	const extendedThinking = modelConfig?.extendedThinking;
	const promptCaching = modelConfig?.usePromptCaching ?? false;

	// Extract token usage values
	const contextWindow = modelData.value?.capabilities.contextWindow || 0;
	const usedTokens = tokenUsageTurn?.totalAllTokens ?? tokenUsageTurn?.totalTokens ?? 0;
	const tokenLimit = contextWindow;
	const tokenPercentage = tokenLimit > 0 ? Math.min(100, Math.round((usedTokens / tokenLimit) * 100)) : 0;

	// Determine the progress bar color based on usage percentage
	const getProgressColor = (percentage: number): string => {
		if (percentage < 30) return 'bg-green-500';
		if (percentage < 70) return 'bg-yellow-500';
		return 'bg-red-500';
	};

	// Handle temperature visualization
	const temperatureScale = [...Array(11)].map((_, i) => i / 10);
	const temperatureIndex = Math.round(temperature * 10);
	//console.log(`Temperature:`, { temperatureScale, temperatureIndex, temperature });

	return (
		<div className='absolute top-full left-0 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-b-lg z-20 mt-0'>
			<div className='p-4 w-full mx-auto'>
				{/* Header */}
				<div className='flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 mb-3'>
					<h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
						Model: {modelData.value?.displayName} ({modelData.value?.providerLabel}) -{' '}
						{(contextWindow / 1000).toFixed(0)}K tokens
					</h3>
					<button
						type='button'
						onClick={onClose}
						className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							className='h-5 w-5'
							viewBox='0 0 20 20'
							fill='currentColor'
						>
							<path
								fillRule='evenodd'
								d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
								clipRule='evenodd'
							/>
						</svg>
					</button>
				</div>

				<div className='grid grid-cols-4 md:grid-cols-4 sm:grid-cols-2 gap-6'>
					{/* Left column */}
					<div className='space-y-6'>
						{/* Token Usage Progress Bar */}
						<div>
							<div className='flex justify-between text-sm mb-1'>
								<span className='font-medium text-gray-700 dark:text-gray-300'>
									Tokens: {usedTokens.toLocaleString()} / {tokenLimit.toLocaleString()}
								</span>
								<span className='text-gray-500 dark:text-gray-400'>{tokenPercentage}%</span>
							</div>
							<div className='w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5'>
								<div
									className={`h-2.5 rounded-full ${getProgressColor(tokenPercentage)}`}
									style={{ width: `${tokenPercentage}%` }}
								>
								</div>
							</div>
						</div>
					</div>

					<div className='space-y-6'>
						{/* Temperature Visualization */}
						<div>
							<div className='flex justify-between text-sm mb-1'>
								<span className='font-medium text-gray-700 dark:text-gray-300'>
									Temperature: {temperature.toFixed(1)}
								</span>
								<span className='text-gray-500 dark:text-gray-400'>
									{temperature < 0.4
										? 'More precise'
										: temperature > 0.7
										? 'More creative'
										: 'Balanced'}
								</span>
							</div>
							<div className='flex justify-between w-full bg-gray-200 dark:bg-gray-700 rounded-full h-7 p-1'>
								{temperatureScale.map((t, i) => (
									<div
										key={i}
										className={`w-5 h-5 rounded-full flex items-center justify-center ${
											i === temperatureIndex
												? 'bg-blue-500 text-white'
												: 'bg-gray-300 dark:bg-gray-600'
										}`}
										title={`${t.toFixed(1)}`}
									>
										{i === temperatureIndex && '●'}
									</div>
								))}
							</div>
						</div>
					</div>

					<div className='space-y-6'>
						{/* Extended Thinking Status */}
						{extendedThinking?.enabled && (
							<div>
								<div className='flex justify-between text-sm mb-1'>
									<span className='font-medium text-gray-700 dark:text-gray-300'>
										Extended Thinking: ON
									</span>
									<span className='text-gray-500 dark:text-gray-400'>
										{extendedThinking.budgetTokens.toLocaleString()} tokens
									</span>
								</div>
								<div className='p-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm'>
									<div className='flex items-center'>
										<svg
											className='w-4 h-4 mr-2 text-green-500'
											fill='currentColor'
											viewBox='0 0 20 20'
										>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
												clipRule='evenodd'
											/>
										</svg>
										<span>
											Extended thinking allows the model to reason through complex problems
										</span>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className='space-y-6'>
						{/* Prompt Caching Status */}
						<div>
							<div className='flex justify-between text-sm mb-1'>
								<span className='font-medium text-gray-700 dark:text-gray-300'>
									Prompt Caching: {promptCaching ? 'ENABLED' : 'DISABLED'}
								</span>
							</div>
							{promptCaching && tokenUsageTurn?.cacheCreationInputTokens !== undefined &&
								tokenUsageTurn?.cacheReadInputTokens !== undefined && (
								<div className='p-2 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-sm'>
									<div className='flex items-center'>
										<svg
											className='w-4 h-4 mr-2 text-green-500'
											fill='currentColor'
											viewBox='0 0 20 20'
										>
											<path
												fillRule='evenodd'
												d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
												clipRule='evenodd'
											/>
										</svg>
										<span>
											Cache Impact:
											{tokenUsageTurn.cacheReadInputTokens > 0 && (
												<span className='font-medium'>
													Saved {tokenUsageTurn.cacheReadInputTokens.toLocaleString()} tokens
												</span>
											)}
										</span>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
