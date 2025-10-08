import { useState } from 'preact/hooks';
import { TieredTokenProgressIndicator } from './TieredTokenProgressIndicator.tsx';
import type { TieredPricingConfig } from '../types/pricing.types.ts';

/**
 * Demo component to showcase tiered pricing visualization
 * Uses Claude Sonnet 4 pricing as an example
 */
export const TieredPricingDemo = () => {
	// This should come from the modelRegistryService JSON data
	// Example: claude-sonnet-4-5-20250929.inputTokensTieredConfig
	// Note: In real usage, this comes from API model capabilities
	const claudeSonnet4Pricing: TieredPricingConfig = {
		tiers: [
			{
				tier: 0,
				name: 'base',
				threshold: { min: 0, max: 200000 }, // From JSON: claude-sonnet-4-5-20250929.inputTokensTieredConfig.tiers[0].threshold
				// price loaded dynamically from backend edge functions
			},
			{
				tier: 1,
				name: 'extended',
				threshold: { min: 200000, max: null }, // From JSON: claude-sonnet-4-5-20250929.inputTokensTieredConfig.tiers[1].threshold
				// price loaded dynamically from backend edge functions
			},
		],
		tierDeterminedBy: 'totalInputTokens', // From JSON: claude-sonnet-4-5-20250929.inputTokensTieredConfig.tierDeterminedBy
	};

	const contextWindow = 1000000; // 1M context window

	// Demo scenarios
	const scenarios = [
		{ name: 'Light usage (50K tokens)', tokens: 50000 },
		{ name: 'Moderate usage (150K tokens)', tokens: 150000 },
		{ name: 'Tier boundary (200K tokens)', tokens: 200000 },
		{ name: 'Extended tier (350K tokens)', tokens: 350000 },
		{ name: 'Heavy usage (750K tokens)', tokens: 750000 },
		{ name: 'Near capacity (950K tokens)', tokens: 950000 },
	];

	const [selectedScenario, setSelectedScenario] = useState(0);
	const currentScenario = scenarios[selectedScenario];
	const percentage = (currentScenario.tokens / contextWindow) * 100;

	return (
		<div className='p-6 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700'>
			<h2 className='text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200'>
				Tiered Pricing Visualization Demo
			</h2>

			<div className='mb-6'>
				<h3 className='text-lg font-medium mb-2 text-gray-700 dark:text-gray-300'>
					Claude Sonnet 4 Pricing Structure
				</h3>
				<div className='space-y-2 text-sm text-gray-600 dark:text-gray-400'>
					<div className='flex items-center space-x-2'>
						<div className='w-4 h-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded'>
						</div>
						<span>
							<strong>Tier 0 (Base):</strong> 0-200K tokens
						</span>
					</div>
					<div className='flex items-center space-x-2'>
						<div className='w-4 h-4 bg-orange-100 dark:bg-orange-900 border border-orange-300 dark:border-orange-700 rounded'>
						</div>
						<span>
							<strong>Tier 1 (Extended):</strong> 200K+ tokens (higher pricing)
						</span>
					</div>
					<div className='mt-2'>
						<strong>Context Window:</strong> 1M tokens (1,000K)
					</div>
					<div className='mt-1 text-xs italic'>
						<strong>Note:</strong> Actual pricing loaded dynamically from backend
					</div>
				</div>
			</div>

			{/* Scenario Selector */}
			<div className='mb-4'>
				<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
					Select Usage Scenario:
				</label>
				<select
					value={selectedScenario}
					onChange={(e) => setSelectedScenario(parseInt((e.target as HTMLSelectElement).value))}
					className='w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
				>
					{scenarios.map((scenario, index) => <option key={index} value={index}>{scenario.name}</option>)}
				</select>
			</div>

			{/* Progress Bar Demo */}
			<div className='mb-4'>
				<h4 className='text-md font-medium mb-2 text-gray-700 dark:text-gray-300'>
					Current Usage: {currentScenario.name}
				</h4>
				<TieredTokenProgressIndicator
					percentage={percentage}
					usedTokens={currentScenario.tokens}
					contextWindow={contextWindow}
					pricingConfig={claudeSonnet4Pricing}
					showTierLabels={true}
				/>
			</div>

			{/* Usage Details */}
			<div className='mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-md'>
				<h5 className='font-medium text-gray-700 dark:text-gray-300 mb-2'>Usage Details</h5>
				<div className='space-y-1 text-sm text-gray-600 dark:text-gray-400'>
					<div>Tokens Used: {currentScenario.tokens.toLocaleString()}</div>
					<div>Context Window: {contextWindow.toLocaleString()} (100%)</div>
					<div>Context Usage: {percentage.toFixed(1)}%</div>
					<div>
						Current Pricing Tier:{' '}
						{currentScenario.tokens < 200000 ? 'Base (0-200K tokens)' : 'Extended (200K+ tokens)'}
					</div>
					<div>Tier Boundary at: 200K tokens (20% of context)</div>
				</div>
			</div>

			{/* Feature Explanation */}
			<div className='mt-6 p-4 border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20'>
				<h5 className='font-medium text-blue-800 dark:text-blue-200 mb-2'>Visual Features</h5>
				<ul className='space-y-1 text-sm text-blue-700 dark:text-blue-300'>
					<li>
						• <strong>Vertical tick mark</strong> shows tier boundary at token thresholds
					</li>
					<li>
						• <strong>Color-coded token pill</strong> indicates current tier (base vs extended)
					</li>
					<li>
						• <strong>Progress bar color</strong>{' '}
						shows context window usage (separate from tier transitions)
					</li>
					<li>
						• <strong>Hover tooltips</strong> provide detailed token usage information
					</li>
					<li>
						• <strong>Tier labels</strong> show token count boundaries for tier transitions
					</li>
					<li>
						• <strong>Actual pricing</strong> loaded dynamically from backend (not shown in demo)
					</li>
				</ul>
			</div>
		</div>
	);
};
