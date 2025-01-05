import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { StripeError } from '@stripe/stripe-js';
import { BillingPreviewWithUsage, Plan } from '../types/subscription.ts';
import { useAppState } from '../hooks/useAppState.ts';
import { useBillingState } from '../hooks/useBillingState.ts';
import PlanCard from '../components/Subscriptions/PlanCard.tsx';
import PaymentFlowDialog from '../components/Subscriptions/PaymentFlowDialog.tsx';
import UsageBlockDialog from '../components/Subscriptions/UsageBlockDialog.tsx';
import CancelDialog from '../components/Subscriptions/CancelDialog.tsx';

const showCancelDialog = signal(false);
const showUsageBlockDialog = signal(false);

export default function SubscriptionSettings() {
	const { billingState, initialize } = useBillingState();
	const appState = useAppState();

	// Initialize billing state
	useEffect(() => {
		initialize();
	}, []);

	const handlePlanSelect = async (plan: Plan) => {
		if (!billingState.value.stripe) {
			console.error('Stripe not initialized');
			return;
		}

		try {
			const preview = await appState.value.apiClient!.getBillingPreview(plan.plan_id);
			if (preview) {
				billingState.value = {
					...billingState.value,
					billingPreview: preview,
					selectedPlan: plan,
					paymentFlowError: null,
				};
			}
		} catch (err) {
			console.error('Failed to get billing preview:', err);
		}
	};

	const handleConfirmDialogCancel = async () => {
		const { cancelSubscription, initialize, billingState } = useBillingState();
		// Initialize billing state
		initialize();

		if (!billingState.value.subscription) return;

		const isPaidPlan = billingState.value.subscription.plan.plan_price_monthly > 0;
		try {
			await cancelSubscription(!isPaidPlan); // immediate cancellation for free plans
			showCancelDialog.value = false;
		} catch (err) {
			console.error('Failed to cancel subscription:', err);
		}
	};

	const handleCancelSubscription = () => {
		if (!billingState.value.subscription) return;

		//const isPaidPlan = billingState.value.subscription.plan.plan_price_monthly > 0;
		try {
			showCancelDialog.value = true;
		} catch (err) {
			console.error('Failed to cancel subscription:', err);
		}
	};

	if (
		!billingState.value.subscription || !billingState.value.availablePlans ||
		billingState.value.loading.subscription || billingState.value.loading.plans
	) {
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

	return (
		<div class='p-6'>
			<div class='mt-0'>
				<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Current Subscription</h3>
				{billingState.value.subscription && (
					<div class='mt-4 grid grid-cols-3 gap-6'>
						{/* Each section uses flex-col to allow button positioning at bottom */}
						{/* Current Subscription */}
						<div class='flex flex-col min-h-[250px] p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
							<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Current Plan</h3>
							<div class='flex flex-col flex-grow mt-4 mx-2 space-y-4'>
								<div class='flex flex-wrap items-center gap-2'>
									<span class='text-sm text-gray-500 dark:text-gray-400'>Plan:</span>
									<span class='ml-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
										{billingState.value.subscription.plan.plan_name}
									</span>
									<span
										class={`ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
											billingState.value.subscription.subscription_status === 'ACTIVE'
												? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
												: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
										}`}
									>
										{billingState.value.subscription.subscription_status}
									</span>
								</div>

								<div class='flex flex-wrap items-center gap-2'>
									<span class='text-sm text-gray-500 dark:text-gray-400'>Current period:</span>
									<span class='ml-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
										{new Date(billingState.value.subscription.subscription_period_start)
											.toLocaleDateString()}
										{' - '}
										{new Date(billingState.value.subscription.subscription_period_end)
											.toLocaleDateString()}
									</span>
								</div>

								{billingState.value.subscription.subscription_cancel_at && (
									<p class='text-sm text-amber-600 dark:text-amber-400'>
										Cancels on: {new Date(billingState.value.subscription.subscription_cancel_at)
											.toLocaleDateString()}
									</p>
								)}
							</div>

							<button
								onClick={handleCancelSubscription}
								class='mt-auto w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-40 dark:hover:bg-red-800/20 rounded-md'
							>
								Cancel Subscription
							</button>
						</div>

						{/* Usage Information */}
						{billingState.value.subscription?.usage &&
							billingState.value.subscription?.subscription_status === 'ACTIVE' && (
							<div class='flex flex-col min-h-[250px] p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
								<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Usage</h3>
								<div class='flex flex-col flex-grow mt-4 ml-2 mr-6 space-y-4'>
									<div class='flex items-center justify-between'>
										<span class='text-sm text-gray-500 dark:text-gray-400'>Current Usage:</span>
										<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${billingState.value.subscription.usage.currentUsage.costUsd.toFixed(2)} USD
										</span>
									</div>
									<div class='flex items-center justify-between'>
										<span class='text-sm text-gray-500 dark:text-gray-400'>
											Base Monthly Limit:
										</span>
										<span class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											${billingState.value.subscription.usage.quotaLimits.base_cost_monthly
												.toFixed(
													2,
												)} USD
										</span>
									</div>
									<div class='mt-4'>
										<div class='h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'>
											<div
												class='h-full bg-blue-600 dark:bg-blue-500 rounded-full'
												style={{
													width: `${
														Math.min(
															(billingState.value.subscription.usage.currentUsage
																.costUsd /
																billingState.value.subscription.usage.quotaLimits
																	.base_cost_monthly) *
																100,
															100,
														)
													}%`,
												}}
											>
											</div>
										</div>
									</div>
								</div>
								<button
									onClick={() => showUsageBlockDialog.value = true}
									class='mt-auto w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
								>
									Purchase Usage Block
								</button>
							</div>
						)}

						{/* Payment Methods */}
						<div class='flex flex-col min-h-[250px] p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700'>
							<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Billing</h3>
							<div class='flex flex-col flex-grow mt-4 mx-2 space-y-4'>
								<div class='flex items-center justify-between'>
									{billingState.value.defaultPaymentMethod
										? (
											<div class='p-4 bg-gray-50 dark:bg-gray-700 rounded-md w-full'>
												<div class='flex items-center justify-between'>
													<div class='flex items-center'>
														<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
															{billingState.value.defaultPaymentMethod.card_brand
																?.toUpperCase()}
														</div>
														<div class='ml-4 text-sm font-medium text-gray-900 dark:text-gray-100'>
															•••• {billingState.value.defaultPaymentMethod.card_last4}
														</div>
														<div class='ml-4 text-sm text-gray-500 dark:text-gray-400'>
															Default
														</div>
													</div>
												</div>
											</div>
										)
										: (
											<p class='text-sm text-gray-500 dark:text-gray-400'>
												No payment methods added
											</p>
										)}
								</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Available Plans */}
			<div class='mt-8'>
				<h3 class='text-sm font-medium text-gray-500 dark:text-gray-400'>Available Plans</h3>
				<div class='mt-4 flex flex-nowrap gap-6 overflow-x-auto pb-4'>
					{billingState.value.availablePlans.map((plan) => (
						<PlanCard
							key={plan.plan_id}
							plan={plan}
							isCurrentPlan={billingState.value.subscription?.plan_id === plan.plan_id}
							onSelect={() => handlePlanSelect(plan)}
						/>
					))}
				</div>
			</div>

			{/* Cancel Dialog */}
			{billingState.value.subscription && (
				<CancelDialog
					isOpen={showCancelDialog.value}
					onClose={() => showCancelDialog.value = false}
					onConfirm={handleConfirmDialogCancel}
					isPaidPlan={billingState.value.subscription.plan.plan_price_monthly > 0}
				/>
			)}

			{/* Usage Block Dialog */}
			{showUsageBlockDialog.value && (
				<UsageBlockDialog
					isOpen={true}
					onClose={() => {
						showUsageBlockDialog.value = false;
					}}
					existingPaymentMethod={billingState.value.defaultPaymentMethod}
				/>
			)}

			{/* Payment Flow Dialog */}
			{billingState.value.selectedPlan && billingState.value.billingPreview && (
				<PaymentFlowDialog
					isOpen={true}
					onClose={() => {
						billingState.value = {
							...billingState.value,
							selectedPlan: null,
							billingPreview: null,
						};
					}}
					selectedPlan={billingState.value.selectedPlan}
					currentPlan={billingState.value.subscription?.plan!}
					billingPreview={billingState.value.billingPreview}
					existingPaymentMethod={billingState.value.defaultPaymentMethod}
				/>
			)}
		</div>
	);
}
