import { type Signal, useComputed } from '@preact/signals';
import type { //PricingTier,
	TieredPricingConfig,
} from '../types/pricing.types.ts';

interface TieredTokenProgressIndicatorProps {
	tokenPercentage: Signal<number>;
	usedTokens: Signal<number>;
	contextWindow: number;
	pricingConfig: Signal<TieredPricingConfig | undefined>;
	showTierLabels?: boolean;
}

/**
 * Enhanced token progress indicator with pricing tier visualization
 * Shows vertical tick marks at tier boundaries and color-coded token count
 */
export const TieredTokenProgressIndicator = ({
	tokenPercentage,
	usedTokens,
	contextWindow,
	pricingConfig,
	showTierLabels = true,
}: TieredTokenProgressIndicatorProps) => {
	// Calculate current tier
	const currentTier = useComputed(() => {
		if (!pricingConfig.value?.tiers) {
			console.log('TieredTokenProgressIndicator: No pricing config or tiers');
			return null;
		}

		const foundTier = pricingConfig.value.tiers.find((tier) =>
			usedTokens.value >= tier.threshold.min &&
			(tier.threshold.max === null || usedTokens.value < tier.threshold.max)
		) || pricingConfig.value.tiers[pricingConfig.value.tiers.length - 1];

		//console.log('TieredTokenProgressIndicator: Tier calculation', {
		//	usedTokens: usedTokens.value,
		//	tiers: pricingConfig.value.tiers,
		//	foundTier,
		//	tierDeterminedBy: pricingConfig.value.tierDeterminedBy,
		//});

		return foundTier;
	});

	// Calculate tier boundary positions as percentages of context window
	const tierBoundaries = useComputed(() => {
		if (!pricingConfig.value?.tiers || !contextWindow) return [];

		return pricingConfig.value.tiers
			.filter((tier) => tier.threshold.max !== null && tier.threshold.max < contextWindow)
			.map((tier) => ({
				...tier,
				percentage: ((tier.threshold.max || 0) / contextWindow) * 100,
			}));
	});

	// Get dynamic tier color based on number of tiers and current tier
	const tierColor = useComputed(() => {
		if (!currentTier.value || !pricingConfig.value?.tiers) {
			console.log('TieredTokenProgressIndicator: getTierColor - no tier or config', {
				tier: currentTier.value,
				hasPricingConfig: !!pricingConfig.value,
			});
			return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
		}

		const totalTiers = pricingConfig.value.tiers.length;
		const tierIndex = currentTier.value.tier;

		//console.log('TieredTokenProgressIndicator: getTierColor', {
		//	tier: currentTier.value,
		//	tierIndex,
		//	totalTiers,
		//	tierName: currentTier.value.name,
		//});

		// Dynamic color scheme based on total number of tiers
		if (totalTiers === 2) {
			// 2 tiers: blue → red
			return tierIndex === 0
				? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
				: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
		} else if (totalTiers === 3) {
			// 3 tiers: blue → orange → red
			switch (tierIndex) {
				case 0:
					return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
				case 1:
					return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300';
				default:
					return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
			}
		} else if (totalTiers === 4) {
			// 4 tiers: blue → yellow → orange → red
			switch (tierIndex) {
				case 0:
					return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
				case 1:
					return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
				case 2:
					return 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300';
				default:
					return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
			}
		} else {
			// 5+ tiers: use a color progression
			const colors = [
				'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
				'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
				'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
				'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300',
				'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300',
				'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
				'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-300',
			];
			return colors[tierIndex] || colors[colors.length - 1];
		}
	});

	// Get progress bar color based on context usage (not tier)
	const getProgressColor = (pct: number): string => {
		if (pct < 50) return 'bg-green-500 dark:bg-green-400';
		if (pct < 75) return 'bg-yellow-500 dark:bg-yellow-400';
		return 'bg-red-500 dark:bg-red-400';
	};

	// Format token count for display
	const formatTokenCount = (tokens: number): string => {
		if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
		if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
		return tokens.toString();
	};

	// Only show if there's meaningful progress (> 1%)
	if (tokenPercentage.value <= 1) return null;

	// Debug logging for the main component
	//console.log('TieredTokenProgressIndicator: Main render', {
	//	percentage: tokenPercentage.value,
	//	usedTokens: usedTokens.value,
	//	contextWindow,
	//	hasPricingConfig: !!pricingConfig.value,
	//	formattedUsedTokens: formatTokenCount(usedTokens.value),
	//});

	return (
		<div className='w-full relative mb-4'>
			{/* Main progress bar container */}
			<div className='relative h-2 bg-gray-200 dark:bg-gray-700 rounded-sm overflow-visible'>
				{/* Progress bar fill */}
				<div
					title={`Context window usage: ${tokenPercentage.value.toFixed(1)}% (${
						formatTokenCount(usedTokens.value)
					} / ${formatTokenCount(contextWindow)} tokens)`}
					className={`h-full transition-all duration-300 ${getProgressColor(tokenPercentage.value)}`}
					style={{ width: `${Math.min(100, tokenPercentage.value)}%` }}
				/>

				{/* Tier boundary tick marks */}
				{tierBoundaries.value.map((boundary, index) => (
					<div
						key={`boundary-${boundary.tier}-${index}`}
						className='absolute top-0 h-full w-0.5 bg-gray-800 dark:bg-gray-100 opacity-60'
						style={{ left: `${boundary.percentage}%` }}
						title={`Pricing tier boundary: ${formatTokenCount(boundary.threshold.max || 0)} tokens`}
					/>
				))}

				{/* Tier boundary labels - positioned directly below tick marks with lower z-index */}
				{showTierLabels && tierBoundaries.value.map((boundary, index) => (
					<div
						key={`label-${boundary.tier}-${index}`}
						className='absolute top-3 transform -translate-x-1/2 text-xs text-gray-400 dark:text-gray-500 z-10'
						style={{ left: `${boundary.percentage}%` }}
					>
						↑ {formatTokenCount(boundary.threshold.max || 0)}
					</div>
				))}
			</div>

			{/* Moving token count pill - positioned relative to progress */}
			{showTierLabels && (
				<div className='relative mt-1'>
					{/* Token count pill with tier coloring - moves with progress */}
					<div
						className={`absolute inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-all duration-300 z-10 whitespace-nowrap ${tierColor.value}`}
						style={{
							left: `${Math.min(85, Math.max(0, tokenPercentage.value))}%`,
							transform: tokenPercentage.value > 90
								? 'translateX(-100%)'
								: tokenPercentage.value < 10
								? 'translateX(0%)'
								: 'translateX(-50%)',
						}}
					>
						{formatTokenCount(usedTokens.value)}
						{currentTier.value && (
							<span className='ml-1 text-xs opacity-75'>
								({currentTier.value.name} tier)
							</span>
						)}
					</div>

					{/* Context percentage - with right padding */}
					<div className='absolute right-0 top-0 text-xs text-gray-500 dark:text-gray-400 pr-2'>
						{tokenPercentage.value.toFixed(1)}% of context
					</div>
				</div>
			)}
		</div>
	);
};
