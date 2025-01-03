import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { BillingPreviewWithUsage, Plan, SubscriptionWithUsage } from '../types/subscription.ts';
import { useAppState } from '../hooks/useAppState.ts';

interface PlanCardProps {
	plan: Plan;
	isCurrentPlan: boolean;
	onSelect: () => void;
}

function PlanCard({ plan, isCurrentPlan, onSelect }: PlanCardProps) {
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
				<span class='text-gray-500 dark:text-gray-400'> / monthly (USD)</span>
			</div>
			<div class='mt-2 flex items-center gap-2'>
				<div>
					<span class='text-xl text-gray-600 dark:text-gray-300'>${plan.plan_price_yearly}</span>
					<span class='text-gray-500 dark:text-gray-400'> / yearly (USD)</span>
				</div>
				{plan.plan_price_monthly > 0 && (
					<span class='text-xs font-medium text-green-600 dark:text-green-400'>
						Save {Math.round((1 - (plan.plan_price_yearly / (plan.plan_price_monthly * 12))) * 100)}%
					</span>
				)}
			</div>
			<ul class='mt-6 mb-8 space-y-4'>
				{plan.plan_features?.features?.map((feature) => (
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

interface ConfirmationDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: () => void;
	title: string;
	message: string;
	billingPreview: BillingPreviewWithUsage | null;
}

function ConfirmationDialog({ isOpen, onClose, onConfirm, title, message, billingPreview }: ConfirmationDialogProps) {
	if (!isOpen) return null;

	return (
		<div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
			<div class='bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6'>
				<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>{title}</h3>
				<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>{message}</p>

				{billingPreview && (
					<div class='mt-4 bg-gray-50 dark:bg-gray-700 rounded-md p-4'>
						<h4 class='text-sm font-medium text-gray-900 dark:text-gray-100'>Billing Preview</h4>
						<dl class='mt-2 space-y-2'>
							<div class='flex justify-between'>
								<dt class='text-sm text-gray-500 dark:text-gray-400'>Current Plan:</dt>
								<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
									{billingPreview.currentPlan.plan_name}
								</dd>
							</div>
							<div class='flex justify-between'>
								<dt class='text-sm text-gray-500 dark:text-gray-400'>New Plan:</dt>
								<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
									{billingPreview.newPlan.plan_name}
								</dd>
							</div>
							<div class='flex justify-between'>
								<dt class='text-sm text-gray-500 dark:text-gray-400'>Current Period:</dt>
								<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
									{new Date(billingPreview.periodStart).toLocaleDateString()} - {new Date(billingPreview.periodEnd).toLocaleDateString()}
								</dd>
							</div>
							<div class='flex justify-between'>
								<dt class='text-sm text-gray-500 dark:text-gray-400'>Days Remaining:</dt>
								<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
									{billingPreview.daysRemaining} of {billingPreview.daysInMonth} days
								</dd>
							</div>
							<div class='flex justify-between'>
								<dt class='text-sm text-gray-500 dark:text-gray-400'>Proration Factor:</dt>
								<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
									{(billingPreview.prorationFactor * 100).toFixed(1)}%
								</dd>
							</div>
						</dl>
					</div>
				)}

				<div class='mt-6 flex justify-end space-x-3'>
					<button
						onClick={onClose}
						class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
					>
						Cancel
					</button>
					<button
						onClick={onConfirm}
						class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
					>
						Confirm
					</button>
				</div>
			</div>
		</div>
	);
}

const currentSubscription = signal<SubscriptionWithUsage | null>(null);
const availablePlans = signal<Plan[]>([]);
const selectedPlan = signal<Plan | null>(null);
const billingPreview = signal<BillingPreviewWithUsage | null>(null);
const isLoading = signal(true);
const error = signal<string | null>(null);
const showConfirmation = signal(false);
export default function SubscriptionSettings() {
	const appState = useAppState();

	const apiClient = appState.value.apiClient;

	// Fetch current subscription and available plans
	useEffect(() => {
		if (!apiClient) {
			error.value = 'API Client not available';
			isLoading.value = false;
			return;
		}

		Promise.all([
			apiClient.getCurrentSubscription(),
			apiClient.getAvailablePlans(),
		])
			.then(([subscription, plans]) => {
				console.log('SubscriptionSettings: ', { subscription, plans });
				if (subscription) currentSubscription.value = subscription;
				if (plans) availablePlans.value = plans;
			})
			.catch((err) => error.value = err.message)
			.finally(() => isLoading.value = false);
	}, []);

	const handlePlanSelect = async (plan: Plan) => {
		try {
			const preview = await appState.value.apiClient!.getBillingPreview(plan.plan_id);
			console.log('SubscriptionSettings: handlePlanSelect-preview', preview);
			if (preview) {
				billingPreview.value = preview;
				selectedPlan.value = plan;
				showConfirmation.value = true;
			}
		} catch (err) {
			error.value = (err as Error).message;
		}
	};

	const handlePlanChange = async () => {
		if (!selectedPlan.value) return;

		try {
			const newSub = await appState.value.apiClient!.changePlan(selectedPlan.value.plan_id);
			if (newSub) {
				currentSubscription.value = newSub;
				showConfirmation.value = false;
				selectedPlan.value = null;
				billingPreview.value = null;
			}
		} catch (err) {
			error.value = (err as Error).message;
		}
	};

	if (isLoading.value) {
		return (
			<div class='p-6'>
				<div class='animate-pulse space-y-4'>
					<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
					<div class='space-y-3'>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
						<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
					</div>
				</div>
			</div>
		);
	}

	if (error.value) {
		return (
			<div class='p-6'>
				<div class='rounded-md bg-red-50 dark:bg-red-900/20 p-4'>
					<div class='flex'>
						<div class='flex-shrink-0'>
							<svg class='h-5 w-5 text-red-400' viewBox='0 0 20 20' fill='currentColor'>
								<path
									fill-rule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
									clip-rule='evenodd'
								/>
							</svg>
						</div>
						<div class='ml-3'>
							<h3 class='text-sm font-medium text-red-800 dark:text-red-200'>
								Error loading subscription details
							</h3>
							<p class='mt-2 text-sm text-red-700 dark:text-red-300'>{error.value}</p>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div class='p-6'>
			<h2 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Subscription</h2>

			{/* Subscription Information */}
			{currentSubscription.value && (
				<div class='mt-4 flex flex-wrap gap-8'>
					{/* Current Subscription Status */}
					<div class='flex-1 min-w-[300px]'>
						<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Current Plan</h3>
						<div class='mt-4'>
							<div class='space-y-4'>
								<div class='flex flex-wrap items-center gap-2'>
									<span class='text-sm text-gray-500 dark:text-gray-400'>
										Plan:
									</span>
									<span class='ml-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
										{currentSubscription.value.plan.plan_name}
									</span>
									<span
										class={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
											currentSubscription.value.subscription_status === 'ACTIVE'
												? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
												: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
										}`}
									>
										{currentSubscription.value.subscription_status.toUpperCase()}
									</span>
								</div>

								<div class='flex flex-wrap items-center gap-2'>
									<span class='text-sm text-gray-500 dark:text-gray-400'>
										Current period:
									</span>
									<span class='ml-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
										{new Date(currentSubscription.value.subscription_period_start).toLocaleDateString()}
										{' '}
										- {new Date(currentSubscription.value.subscription_period_end).toLocaleDateString()}
									</span>
								</div>

								{currentSubscription.value.subscription_cancel_at && (
									<p class='text-sm text-amber-600 dark:text-amber-400'>
										Cancels on:{' '}
										{new Date(currentSubscription.value.subscription_cancel_at)
											.toLocaleDateString()}
									</p>
								)}

								{currentSubscription.value.stripe_subscription_id && (
									<p class='text-sm text-gray-500 dark:text-gray-400'>
										Stripe Subscription ID: {currentSubscription.value.stripe_subscription_id}
									</p>
								)}
							</div>
						</div>
					</div>

					{/* Usage Information */}
					{currentSubscription.value.usage && (
						<div class='flex-1 min-w-[300px] border-l border-gray-200 dark:border-gray-700 pl-8'>
							<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Usage</h3>
							<div class='mt-4'>
								<div class='space-y-3'>
									<div class='flex items-center justify-between'>
										<span class='text-sm text-gray-500 dark:text-gray-400'>Current Usage:</span>
										<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${currentSubscription.value.usage.currentUsage.costUsd.toFixed(2)} USD
										</span>
									</div>
									<div class='flex items-center justify-between'>
										<span class='text-sm text-gray-500 dark:text-gray-400'>Base Monthly Limit:</span>
										<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${currentSubscription.value.usage.quotaLimits.base_cost_monthly.toFixed(2)} USD
										</span>
									</div>
									{ /* <div class='flex items-center justify-between'>
										<span class='text-sm text-gray-500 dark:text-gray-400'>Maximum Monthly Limit:</span>
										<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${currentSubscription.value.usage.quotaLimits.max_cost_monthly.toFixed(2)} USD
										</span>
									</div> */ }
									<div class='mt-4'>
										<div class='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
											<div
												class='h-full bg-blue-600 dark:bg-blue-500 rounded-full'
												style={{
													width: `${Math.min(
														(currentSubscription.value.usage.currentUsage.costUsd /
															currentSubscription.value.usage.quotaLimits.base_cost_monthly) *
															100,
														100
													)}%`
												}}
											></div>
										</div>
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Available Plans */}
			<div class='mt-8'>
				<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Available Plans</h3>
				<div class='mt-4 flex flex-nowrap gap-6 overflow-x-auto pb-4 -mx-4'>
					{availablePlans.value && availablePlans.value.map((plan) => (
						<PlanCard
							key={plan.plan_id}
							plan={plan}
							isCurrentPlan={currentSubscription.value?.plan_id === plan.plan_id}
							onSelect={() => handlePlanSelect(plan)}
						/>
					))}
				</div>
			</div>

			{/* Confirmation Dialog */}
			<ConfirmationDialog
				isOpen={showConfirmation.value}
				onClose={() => {
					showConfirmation.value = false;
					selectedPlan.value = null;
					billingPreview.value = null;
				}}
				onConfirm={handlePlanChange}
				title='Confirm Plan Change'
				message={`Are you sure you want to change to the ${selectedPlan.value?.plan_name} plan?`}
				billingPreview={billingPreview.value}
			/>
		</div>
	);
}
