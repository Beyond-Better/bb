import { Plan } from '../../types/subscription.ts';

interface PlanCardProps {
	plan: Plan;
	isCurrentPlan: boolean;
	onSelect: () => void;
}

export default function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
	//const yearlySavings = Math.round((1 - (plan.plan_price_yearly / (plan.plan_price_monthly * 12))) * 100);
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
				<span class='text-3xl font-bold text-gray-900 dark:text-gray-100'>${plan.plan_price_monthly}</span>
				<span class='text-gray-500 dark:text-gray-400'>/ monthly (USD)</span>
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
			<ul class='mt-6 mb-8 space-y-4'>
				{plan.plan_features?.features?.map((feature: string) => (
					<li class='flex items-start'>
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
			<button
				type='button'
				onClick={onSelect}
				disabled={isCurrentPlan}
				class={`mt-auto w-full px-4 py-2 rounded-md text-sm font-medium ${
					isCurrentPlan
						? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
						: 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600'
				}`}
			>
				{isCurrentPlan ? 'Current Plan' : 'Change Plan'}
			</button>
		</div>
	);
}
