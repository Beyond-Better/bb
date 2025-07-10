import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { activeTab } from '../AppSettings.tsx';
//import type { StripeError } from '@stripe/stripe-js';
import { Plan } from '../../types/subscription.ts';
import { useAppState } from '../../hooks/useAppState.ts';
import { useBillingState } from '../../hooks/useBillingState.ts';
import PlanCard from '../../components/Subscriptions/PlanCard.tsx';
import PaymentFlowDialog from '../../components/Subscriptions/PaymentFlowDialog.tsx';
import UsageBlockDialog from '../../components/Subscriptions/UsageBlockDialog.tsx';
import CancelDialog from '../../components/Subscriptions/CancelDialog.tsx';
import NewPaymentMethodForm from './../NewPaymentMethodForm.tsx';

const showCancelDialog = signal(false);
const showUsageBlockDialog = signal(false);
const showPaymentMethodDialog = signal(false);
const isRefreshingUsage = signal(false);

export default function SubscriptionSettings() {
	const { billingState, initialize, updatePaymentMethods, updateUsageData } = useBillingState();
	const appState = useAppState();

	// Track previous active state to detect tab changes
	const wasActive = useSignal(false);

	// Initialize billing state and refresh when tab becomes active
	useEffect(() => {
		const isActive = activeTab.value === 'subscription';

		if (isActive) {
			initialize();
		}

		// Refresh when first mounted or when becoming active after being inactive
		if (isActive && (!wasActive.value || !billingState.value.purchasesBalance)) {
			updateUsageData();
		}

		wasActive.value = isActive;
	}, [activeTab.value]);

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

	//console.log('SubscriptionSettings: billingState', billingState.value);
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
			<div class='flex items-center space-x-3 mb-6'>
				<div>
					<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Plans and Billing</h3>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Manage your subscription, purchase token credits, and update your payment methods
					</p>
				</div>
			</div>
			{/* Section 1: Current Subscription */}
			<div class='mt-0'>
				{billingState.value.subscription && (
					<div class='mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-6'>
						{/* Section 1: Current Subscription */}
						<div class='lg:col-span-1 mb-6'>
							<h3 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>
								Current Subscription
							</h3>
							<div class='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col'>
								<div class='flex-grow space-y-4'>
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
											Cancels on:{' '}
											{new Date(billingState.value.subscription.subscription_cancel_at)
												.toLocaleDateString()}
										</p>
									)}
								</div>

								<button
									type='button'
									onClick={handleCancelSubscription}
									class='mt-4 w-full px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-40 dark:hover:bg-red-800/20 rounded-md'
								>
									Cancel Subscription
								</button>
							</div>
						</div>

						{/* Section 2: Purchased Tokens */}
						<div class='lg:col-span-1 mb-6'>
							<h3 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>
								Credit Balance and Purchases
							</h3>
							{billingState.value.purchasesBalance?.balance
								? (
									<div class='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col'>
										<div class='flex items-center justify-between mb-4'>
											<h4 class='text-sm font-medium text-gray-500 dark:text-gray-400'>
												Credit Balance
											</h4>
											<button
												type='button'
												onClick={async () => {
													isRefreshingUsage.value = true;
													try {
														await updateUsageData();
													} finally {
														isRefreshingUsage.value = false;
													}
												}}
												class='p-1 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700'
												title='Refresh token balance'
												disabled={isRefreshingUsage.value}
											>
												<svg
													class={`h-5 w-5 ${isRefreshingUsage.value ? 'animate-spin' : ''}`}
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														stroke-linecap='round'
														stroke-linejoin='round'
														stroke-width='2'
														d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
													/>
												</svg>
											</button>
										</div>

										<div class='flex-grow flex flex-col space-y-4'>
											{/* Current Balance */}
											<div class='text-center'>
												<div class='text-2xl font-bold text-gray-900 dark:text-gray-100'>
													${billingState.value.purchasesBalance.balance.current_balance_usd
														?.toFixed(2)}
												</div>
												<div class='text-sm text-gray-500 dark:text-gray-400'>
													Remaining Balance (USD)
												</div>
											</div>

											{/* Recent Purchase Info */}
											{billingState.value.purchasesBalance.purchases?.length > 0 && (
												<div class='pt-4 border-t border-gray-200 dark:border-gray-700'>
													<div class='text-center text-sm'>
														<div class='text-gray-500 dark:text-gray-400 mb-1'>
															Recent Purchase
														</div>
														<div class='font-medium text-gray-900 dark:text-gray-100'>
															${billingState.value.purchasesBalance.purchases[0]
																.amount_usd?.toFixed(2)}
														</div>
														<div class='text-gray-500 dark:text-gray-400'>
															{new Date(
																billingState.value.purchasesBalance.purchases[0]
																	.created_at,
															).toLocaleDateString()}
														</div>
													</div>
												</div>
											)}
										</div>

										{/* Buy Tokens Button */}
										<button
											onClick={() => showUsageBlockDialog.value = true}
											class='w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
										>
											Buy Credits
										</button>
									</div>
								)
								: (
									<div class='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col items-center justify-center'>
										<p class='text-sm text-gray-500 dark:text-gray-400 mb-4 text-center'>
											No token balance available
										</p>
										<button
											onClick={() => showUsageBlockDialog.value = true}
											class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
										>
											Buy Tokens
										</button>
									</div>
								)}
						</div>

						{/* Section 3: Payment Methods */}
						<div class='lg:col-span-1 mb-6'>
							<h3 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Payment Methods</h3>
							<div class='p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 h-full flex flex-col'>
								{billingState.value.defaultPaymentMethod
									? (
										<div class='flex-grow'>
											<div class='p-4 bg-gray-50 dark:bg-gray-700 rounded-md group relative'>
												<div class='flex items-center justify-between'>
													<div class='flex items-center space-x-3'>
														<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
															{billingState.value.defaultPaymentMethod.card_brand
																?.toUpperCase()}
														</div>
														<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
															•••• {billingState.value.defaultPaymentMethod.card_last4}
														</div>
													</div>
													<button
														onClick={async () => {
															try {
																await appState.value.apiClient?.removePaymentMethod(
																	billingState.value.defaultPaymentMethod!
																		.payment_method_id,
																);
																await updatePaymentMethods();
															} catch (err) {
																console.error('Failed to remove payment method:', err);
															}
														}}
														class='hidden group-hover:block text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400'
														title='Remove payment method'
													>
														<svg
															class='h-5 w-5'
															fill='none'
															viewBox='0 0 24 24'
															stroke='currentColor'
														>
															<path
																stroke-linecap='round'
																stroke-linejoin='round'
																stroke-width='2'
																d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
															/>
														</svg>
													</button>
												</div>
												<div class='mt-2'>
													<span class='text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded'>
														Default
													</span>
												</div>
											</div>
										</div>
									)
									: (
										<div class='flex-grow flex flex-col items-center justify-center'>
											<p class='text-sm text-gray-500 dark:text-gray-400 mb-4 text-center'>
												No payment methods added
											</p>
											<button
												onClick={() => showPaymentMethodDialog.value = true}
												class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
											>
												Add Payment Method
											</button>
										</div>
									)}
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Section 4: Available Plans */}
			<div class='mt-8'>
				<h3 class='text-base font-medium text-gray-700 dark:text-gray-300'>Change Plan</h3>
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

			{/* Payment Method Dialog */}
			{showPaymentMethodDialog.value && (
				<div
					class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
					onClick={(e) => {
						// Close dialog when clicking outside
						if (e.target === e.currentTarget) {
							showPaymentMethodDialog.value = false;
						}
					}}
				>
					<div class='bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6'>
						<div class='flex justify-between items-center mb-4'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Add Payment Method</h3>
							<button
								onClick={() => showPaymentMethodDialog.value = false}
								class='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'
							>
								<span class='sr-only'>Close</span>
								<svg class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='2'
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>
						<NewPaymentMethodForm
							onSuccess={async (paymentMethodId) => {
								try {
									await appState.value.apiClient?.savePaymentMethod(paymentMethodId);
									showPaymentMethodDialog.value = false;
									await updatePaymentMethods();
								} catch (err) {
									console.error('Failed to save payment method:', err);
								}
							}}
							onError={(error) => {
								console.error('Payment method error:', error);
							}}
							onCancel={() => showPaymentMethodDialog.value = false}
						/>
					</div>
				</div>
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
