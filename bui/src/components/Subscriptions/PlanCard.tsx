import { Plan } from '../../types/subscription.ts';

interface PlanCardProps {
	plan: Plan;
	isCurrentPlan: boolean;
	onSelect: () => void;
}

export default function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
	//const yearlySavings = Math.round((1 - (plan.plan_price_yearly / (plan.plan_price_monthly * 12))) * 100);

	const isContactPlan = plan.plan_features?.contact_for_signup === true;

	// Helper function to format cents to dollars
	const formatCents = (cents: number) => {
		return `${(cents / 100).toFixed(2)}`;
	};

	// Check if plan has credits to show
	const hasCredits = (plan.plan_features?.signup_credits_cents ?? 0) > 0 ||
		(plan.plan_features?.upgrade_credits_cents ?? 0) > 0;
	console.log('PlanCard: hasCredits', hasCredits);

	// Filter out credits from features array since we're showing them separately
	const filteredFeatures =
		plan.plan_features?.features?.filter((feature) =>
			!feature.toLowerCase().includes('free credits') &&
			!feature.toLowerCase().includes('signup') &&
			!feature.toLowerCase().includes('upgrade credits')
		) || [];

	const handleContactClick = () => {
		// Open contact page in new tab
		window.open('https://beyondbetter.app/contact', '_blank');
	};

	return (
		<div
			class={`relative p-6 rounded-lg border w-[300px] flex-shrink-0 flex flex-col ${
				isCurrentPlan
					? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
					: 'border-gray-200 dark:border-gray-700'
			}`}
		>
			{isCurrentPlan && (
				<span class='absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
					Current Plan
				</span>
			)}

			<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>{plan.plan_name}</h3>
			<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>{plan.plan_description}</p>

			<div class='mt-4'>
				{isContactPlan
					? <span class='text-3xl font-bold text-gray-900 dark:text-gray-100'>Custom</span>
					: plan.plan_price_monthly > 0
					? (
						<>
							<span class='text-3xl font-bold text-gray-900 dark:text-gray-100'>
								${plan.plan_price_monthly}
							</span>
							<span class='text-gray-500 dark:text-gray-400'>/ monthly (USD)</span>
						</>
					)
					: <span class='text-3xl font-bold text-gray-900 dark:text-gray-100'>Free</span>}
			</div>
			{
				/*<div class='mt-2 flex items-center gap-2'>
				<div>
					<span class='text-xl text-gray-600 dark:text-gray-300'>${plan.plan_price_yearly}</span>
					<span class='text-gray-500 dark:text-gray-400'>/ yearly (USD)</span>
				</div>
				{plan.plan_price_monthly > 0 && yearlySavings > 0 && (
					<span class='text-xs font-medium text-green-600 dark:text-green-400'>
						Save {yearlySavings}%
					</span>
				)}
			</div>*/
			}

			{/* Credits Section - Make it special and prominent */}
			{hasCredits && (
				<div class='mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800 relative overflow-hidden'>
					{/* Background decoration */}
					<div class='absolute top-0 right-0 w-16 h-16 bg-emerald-100 dark:bg-emerald-800/30 rounded-full -mr-8 -mt-8 opacity-30'>
					</div>
					<div class='absolute bottom-0 left-0 w-12 h-12 bg-teal-100 dark:bg-teal-800/30 rounded-full -ml-6 -mb-6 opacity-30'>
					</div>

					<div class='relative z-10'>
						<div class='flex items-center gap-2 mb-2'>
							<svg
								class='w-5 h-5 text-emerald-600 dark:text-emerald-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									stroke-width='2'
									d='M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1'
								/>
							</svg>
							<span class='font-semibold text-emerald-800 dark:text-emerald-200 text-sm'>
								Free Credits Included
							</span>
						</div>

						<div class='space-y-2'>
							{/* {(plan.plan_features?.signup_credits_cents ?? 0) > 0 && ( */}
								<div class='flex items-center justify-between'>
									<span class='text-sm text-gray-700 dark:text-gray-300'>On signup:</span>
									<span class='font-bold text-emerald-700 dark:text-emerald-300 text-lg'>
										${formatCents(plan.plan_features.signup_credits_cents)}
									</span>
								</div>
							{/* )} */}

							{/* {(plan.plan_features?.upgrade_credits_cents ?? 0) > 0 && ( */}
								<div class='flex items-center justify-between'>
									<span class='text-sm text-gray-700 dark:text-gray-300'>On upgrade:</span>
									<span class='font-bold text-emerald-700 dark:text-emerald-300 text-lg'>
										{(plan.plan_features?.upgrade_credits_cents ?? 0) > 0 ? '$'+formatCents(plan.plan_features.upgrade_credits_cents) : 'N/A'}
									</span>
								</div>
							{/* )} */}
						</div>

						{/* Total credits display if both exist */}
						{
							/* {(plan.plan_features?.signup_credits_cents ?? 0) > 0 &&
							(plan.plan_features?.upgrade_credits_cents ?? 0) > 0 &&
							(
								<div class='mt-3 pt-2 border-t border-emerald-200 dark:border-emerald-700'>
									<div class='flex items-center justify-between'>
										<span class='text-sm font-medium text-emerald-800 dark:text-emerald-200'>
											Total value:
										</span>
										<span class='font-bold text-emerald-700 dark:text-emerald-300 text-xl'>
											${formatCents(
												plan.plan_features?.signup_credits_cents +
													plan.plan_features.upgrade_credits_cents,
											)}
										</span>
									</div>
								</div>
							)} */
						}
					</div>
				</div>
			)}

			{/* Enterprise Value Section - For contact plans without credits */}
			{isContactPlan && !hasCredits && (
				<div class='mt-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800 relative overflow-hidden'>
					{/* Background decoration */}
					<div class='absolute top-0 right-0 w-16 h-16 bg-purple-100 dark:bg-purple-800/30 rounded-full -mr-8 -mt-8 opacity-30'>
					</div>
					<div class='absolute bottom-0 left-0 w-12 h-12 bg-indigo-100 dark:bg-indigo-800/30 rounded-full -ml-6 -mb-6 opacity-30'>
					</div>

					<div class='relative z-10'>
						<div class='flex items-center gap-2 mb-2'>
							<svg
								class='w-5 h-5 text-purple-600 dark:text-purple-400'
								fill='none'
								stroke='currentColor'
								viewBox='0 0 24 24'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									stroke-width='2'
									d='M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'
								/>
							</svg>
							<span class='font-semibold text-purple-800 dark:text-purple-200 text-sm'>
								Enterprise Value
							</span>
						</div>

						<div class='space-y-2'>
							{
								/*<div class='flex items-center justify-between'>
								<span class='text-sm text-gray-700 dark:text-gray-300'>Custom Credits:</span>
								<span class='font-bold text-purple-700 dark:text-purple-300 text-lg'>Negotiated</span>
							</div>*/
							}

							<div class='flex items-center justify-between'>
								<span class='text-sm text-gray-700 dark:text-gray-300'>Dedicated Support:</span>
								<span class='font-bold text-purple-700 dark:text-purple-300 text-lg'>24/7</span>
							</div>

							<div class='flex items-center justify-between'>
								<span class='text-sm text-gray-700 dark:text-gray-300'>Custom Integrations:</span>
								<span class='font-bold text-purple-700 dark:text-purple-300 text-lg'>Included</span>
							</div>
						</div>

						{
							/*<div class='mt-3 pt-2 border-t border-purple-200 dark:border-purple-700'>
							<div class='flex items-center justify-between'>
								<span class='text-sm font-medium text-purple-800 dark:text-purple-200'>Contact for pricing:</span>
								<span class='font-bold text-purple-700 dark:text-purple-300 text-xl'>Custom</span>
							</div>
						</div>*/
						}
					</div>
				</div>
			)}

			<ul class='mt-6 mb-8 space-y-4'>
				{filteredFeatures.map((feature: string, index: number) => (
					<li key={index} class='flex items-start'>
						<svg
							class='flex-shrink-0 h-5 w-5 text-green-500 dark:text-green-400'
							viewBox='0 0 20 20'
							fill='currentColor'
						>
							<path
								fill-rule='evenodd'
								d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
								clip-rule='evenodd'
							/>
						</svg>
						<span class='ml-3 text-sm text-gray-500 dark:text-gray-400'>{feature}</span>
					</li>
				))}
			</ul>

			{/* Action Button */}
			{isContactPlan
				? (
					<button
						type='button'
						onClick={handleContactClick}
						class='mt-auto w-full px-4 py-2 rounded-md text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105'
					>
						Contact Sales
					</button>
				)
				: (
					<button
						type='button'
						onClick={onSelect}
						disabled={isCurrentPlan}
						class={`mt-auto w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
							isCurrentPlan
								? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
								: 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
						}`}
					>
						{isCurrentPlan ? 'Current Plan' : 'Change Plan'}
					</button>
				)}
		</div>
	);
}
