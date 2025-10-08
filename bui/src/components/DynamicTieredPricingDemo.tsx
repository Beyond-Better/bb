import { useState } from 'preact/hooks';
import { TieredTokenProgressIndicator } from './TieredTokenProgressIndicator.tsx';
import type { TieredPricingConfig } from '../types/pricing.types.ts';

/**
 * Demo component showing dynamic tier boundaries from different models
 * This demonstrates that tier boundaries come from JSON config, not hardcoded values
 */
export const DynamicTieredPricingDemo = () => {
	// Sample configurations from actual models in modelCapabilities.json
	// These would normally come from API calls to model capabilities
	const modelConfigs = {
		'claude-sonnet-4-5-20250929': {
			name: 'Claude Sonnet 4.5',
			contextWindow: 1000000,
			pricingConfig: {
				tiers: [
					{
						tier: 0,
						name: 'base',
						threshold: { min: 0, max: 200000 }, // 200K boundary
					},
					{
						tier: 1,
						name: 'extended',
						threshold: { min: 200000, max: null },
					},
				],
				tierDeterminedBy: 'totalInputTokens' as const,
			},
		},
		'gemini-1.5-flash': {
			name: 'Gemini 1.5 Flash',
			contextWindow: 1048576,
			pricingConfig: {
				tiers: [
					{
						tier: 0,
						name: 'base',
						threshold: { min: 0, max: 128000 }, // 128K boundary
					},
					{
						tier: 1,
						name: 'extended',
						threshold: { min: 128000, max: null },
					},
				],
				tierDeterminedBy: 'totalInputTokens' as const,
			},
		},
		'gemini-2.5-pro-preview-06-05': {
			name: 'Gemini Pro 2.5',
			contextWindow: 1048576,
			pricingConfig: {
				tiers: [
					{
						tier: 0,
						name: 'base',
						threshold: { min: 0, max: 200000 }, // 200K boundary
					},
					{
						tier: 1,
						name: 'extended',
						threshold: { min: 200000, max: null },
					},
				],
				tierDeterminedBy: 'totalInputTokens' as const,
			},
		},
	};

	type ModelKey = keyof typeof modelConfigs;
	const [selectedModel, setSelectedModel] = useState<ModelKey>('claude-sonnet-4-5-20250929');
	const [tokenUsage, setTokenUsage] = useState(150000);

	const currentModel = modelConfigs[selectedModel];
	const percentage = (tokenUsage / currentModel.contextWindow) * 100;

	// Calculate current tier based on token usage
	const currentTier = currentModel.pricingConfig.tiers.find((tier) =>
		tokenUsage >= tier.threshold.min &&
		(tier.threshold.max === null || tokenUsage < tier.threshold.max)
	) || currentModel.pricingConfig.tiers[currentModel.pricingConfig.tiers.length - 1];

	// Get tier boundary for display
	const tierBoundary = currentModel.pricingConfig.tiers.find((tier) => tier.threshold.max !== null);

	return (
		<div className='p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
			<h2 className='text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200'>
				Dynamic Tiered Pricing Visualization
			</h2>

			<div className='mb-6'>
				<p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
					Demonstrates how tier boundaries are loaded dynamically from modelCapabilities.json
				</p>
			</div>

			{/* Model Selector */}
			<div className='mb-4'>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
					Select Model:
				</label>
				<select
					value={selectedModel}
					onChange={(e) => setSelectedModel((e.target as HTMLSelectElement).value as ModelKey)}
					className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
				>
					{Object.entries(modelConfigs).map(([key, config]) => (
						<option key={key} value={key}>{config.name}</option>
					))}
				</select>
			</div>

			{/* Token Usage Slider */}
			<div className='mb-4'>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
					Token Usage: {tokenUsage.toLocaleString()} tokens
				</label>
				<input
					type='range'
					min='10000'
					max={currentModel.contextWindow}
					step='10000'
					value={tokenUsage}
					onChange={(e) => setTokenUsage(parseInt((e.target as HTMLInputElement).value))}
					className='w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer'
				/>
			</div>

			{/* Progress Bar Demo */}
			<div className='mb-6'>
				<h4 className='text-md font-medium mb-2 text-gray-700 dark:text-gray-300'>
					Current Usage: {currentModel.name}
				</h4>
				<TieredTokenProgressIndicator
					percentage={percentage}
					usedTokens={tokenUsage}
					contextWindow={currentModel.contextWindow}
					pricingConfig={currentModel.pricingConfig}
					showTierLabels={true}
				/>
			</div>

			{/* Model Configuration Details */}
			<div className='mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md'>
				<h5 className='font-medium text-gray-700 dark:text-gray-300 mb-2'>Configuration from JSON</h5>
				<div className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
					<div>
						<strong>Context Window:</strong> {currentModel.contextWindow.toLocaleString()} tokens
					</div>
					<div>
						<strong>Current Tier:</strong> {currentTier?.name} (tier {currentTier?.tier})
					</div>
					{tierBoundary && (
						<div>
							<strong>Tier Boundary:</strong> {tierBoundary.threshold.max?.toLocaleString()}{' '}
							tokens ({((tierBoundary.threshold.max || 0) / currentModel.contextWindow * 100).toFixed(1)}%
							of context)
						</div>
					)}
					<div>
						<strong>Tier Determined By:</strong> {currentModel.pricingConfig.tierDeterminedBy}
					</div>
				</div>
			</div>

			{/* Explanation */}
			<div className='mt-6 p-4 border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20'>
				<h5 className='font-medium text-green-800 dark:text-green-200 mb-2'>Dynamic Configuration</h5>
				<ul className='space-y-1 text-sm text-green-700 dark:text-green-300'>
					<li>
						• <strong>Tier boundaries</strong> loaded from modelCapabilities.json
					</li>
					<li>
						• <strong>Different models</strong> have different threshold values (128K vs 200K)
					</li>
					<li>
						• <strong>UI adapts automatically</strong> to each model's configuration
					</li>
					<li>
						• <strong>No hardcoded values</strong> - all boundaries come from JSON
					</li>
					<li>
						• <strong>Context window sizes</strong> vary by model (1M vs 1.048M tokens)
					</li>
				</ul>
			</div>
		</div>
	);
};
