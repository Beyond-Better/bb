import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { activeTab } from '../AppSettings.tsx';
import { Plan } from '../../types/subscription.ts';
import { useAppState } from '../../hooks/useAppState.ts';
import { useBillingState } from '../../hooks/useBillingState.ts';
import PlanCard from '../../components/Subscriptions/PlanCard.tsx';
import PaymentFlowDialog from '../../components/Subscriptions/PaymentFlowDialog.tsx';
import UsageBlockDialog from '../../components/Subscriptions/UsageBlockDialog.tsx';
import CancelDialog from '../../components/Subscriptions/CancelDialog.tsx';
import NewPaymentMethodForm from './../NewPaymentMethodForm.tsx';
import AutoTopupSettings from '../../components/AutoTopup/AutoTopupSettings.tsx';
import { formatDateSafe } from 'bui/utils/intl.ts';

const showCancelDialog = signal(false);
const showUsageBlockDialog = signal(false);
const showPaymentMethodDialog = signal(false);
const isRefreshingUsage = signal(false);

export default function PlansAndCreditsTab() {
	const { billingState, initialize, cancelSubscription, updatePaymentMethods, updateUsageData } = useBillingState();
	const appState = useAppState();

	// Track previous active state to detect tab changes
	const wasActive = useSignal(false);

	// Scroll to Change Plan section
	const scrollToChangePlan = () => {
		const element = document.getElementById('change-plan-section');
		if (element) {
			element.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	};

	// Initialize billing state and refresh when tab becomes active
	useEffect(() => {
		const isActive = activeTab.value === 'plans-credits';

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

		try {
			showCancelDialog.value = true;
		} catch (err) {
			console.error('Failed to cancel subscription:', err);
		}
	};

	// Find the next available plan for upgrade (excluding contact_for_signup plans)
	const getNextPlan = () => {
		if (!billingState.value.subscription || !billingState.value.availablePlans) return null;

		const currentPlan = billingState.value.subscription.plan;
		const availablePlans = billingState.value.availablePlans
			.filter(plan => !plan.plan_features?.contact_for_signup) // Exclude enterprise plans
			.sort((a, b) => a.plan_price_monthly - b.plan_price_monthly); // Sort by price

		const currentIndex = availablePlans.findIndex(plan => plan.plan_id === currentPlan.plan_id);
		if (currentIndex === -1 || currentIndex === availablePlans.length - 1) {
			return null; // No next plan available
		}

		return availablePlans[currentIndex + 1];
	};

	const nextPlan = getNextPlan();

	const handleExploreUpgrade = () => {
		if (nextPlan) {
			handlePlanSelect(nextPlan);
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
			<div class='flex items-center space-x-3 mb-6'>
				<div>
					<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Plans & Credits</h3>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Manage your subscription plan, purchase credits, and payment methods
					</p>
				</div>
			</div>

			{/* Hero Section: Account Overview */}
			<div class='mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700'>
				<h4 class='text-lg font-medium text-gray-900 dark:text-gray-100 mb-4'>Account Overview</h4>
				<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'>
					{/* Credit Balance Card */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
						<div class='flex items-center justify-between mb-4'>
							<h5 class='text-base font-medium text-gray-700 dark:text-gray-300'>Credit Balance</h5>
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
								title='Refresh balance'
								disabled={isRefreshingUsage.value}
							>
								<svg
									class={`h-4 w-4 ${isRefreshingUsage.value ? 'animate-spin' : ''}`}
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

						{billingState.value.purchasesBalance?.balance ? (
							<div class='text-center'>
								<div class='text-3xl font-bold text-green-600 dark:text-green-400 mb-2'>
									${billingState.value.purchasesBalance.balance.current_balance_usd?.toFixed(2)}
								</div>
								<div class='text-sm text-gray-500 dark:text-gray-400 mb-4'>Remaining Balance</div>
								
								<div class='space-y-2 text-xs text-gray-500 dark:text-gray-400'>
									{billingState.value.purchasesBalance.purchases?.length > 0 && (
										<div>
											<span>Recent: ${billingState.value.purchasesBalance.purchases[0].amount_usd?.toFixed(2)} on </span>
											<span>{formatDateSafe(
												new Date(billingState.value.purchasesBalance.purchases[0].created_at),
												{ timeZone: 'UTC', dateStyle: 'short' },
												'Unknown'
											)}</span>
										</div>
									)}
								</div>
								
								<button
									type='button'
									onClick={() => showUsageBlockDialog.value = true}
									class='mt-4 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
								>
									Buy Credits
								</button>
							</div>
						) : (
							<div class='text-center'>
								<div class='text-gray-500 dark:text-gray-400 mb-4'>No credits available</div>
								<button
									type='button'
									onClick={() => showUsageBlockDialog.value = true}
									class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
								>
									Buy Credits
								</button>
							</div>
						)}
					</div>

					{/* Current Plan Card */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
						<h5 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Current Plan</h5>
						
						<div class='text-center'>
							<div class='text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2'>
								{billingState.value.subscription?.plan.plan_name}
							</div>
							<div class='text-sm text-gray-500 dark:text-gray-400 mb-2'>
								Active until {formatDateSafe(
									new Date(billingState.value.subscription?.subscription_period_end || ''),
									{ timeZone: 'UTC', dateStyle: 'short' },
									'Not scheduled'
								)}
							</div>
							
							<span
								class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-4 ${
									billingState.value.subscription?.subscription_status === 'ACTIVE'
										? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
										: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
								}`}
							>
								{billingState.value.subscription?.subscription_status}
							</span>

							{/* Upgrade Encouragement or Congratulations */}
							{nextPlan ? (
								<div class='mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700'>
									<div class='text-sm text-blue-700 dark:text-blue-300 mb-2'>
										🚀 Upgrade to {nextPlan.plan_name}
										{nextPlan.plan_features?.proposition && (
											<span class='block mt-1'>{nextPlan.plan_features.proposition}</span>
										)}
									</div>
									<button
										type='button'
										onClick={handleExploreUpgrade}
										class='text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors'
									>
										Explore {nextPlan.plan_name} →
									</button>
								</div>
							) : (
								<div class='mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-700'>
									<div class='text-sm text-green-700 dark:text-green-300 text-center'>
										🎉 Congratulations! You're on our most powerful plan.
										<br />
										<span class='text-xs'>Thank you for being a premium subscriber!</span>
									</div>
								</div>
							)}

							{/* Cancellation Notice */}
							{billingState.value.subscription?.subscription_cancel_at && (
								<div class='mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-700'>
									<div class='text-sm text-amber-600 dark:text-amber-400 font-medium'>
										Cancels on {formatDateSafe(
											new Date(billingState.value.subscription.subscription_cancel_at),
											{ timeZone: 'UTC', dateStyle: 'short' },
											'Not scheduled'
										)}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Payment & Automation Section */}
			<div class='mb-8'>
				<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'>
					{/* Payment Method */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
						<h4 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Payment Method</h4>
						
						{billingState.value.defaultPaymentMethod ? (
							<div class='p-4 bg-gray-50 dark:bg-gray-700 rounded-md group relative'>
								<div class='flex items-center justify-between'>
									<div class='flex items-center space-x-3'>
										<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											{billingState.value.defaultPaymentMethod.card_brand?.toUpperCase()}
										</div>
										<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											•••• {billingState.value.defaultPaymentMethod.card_last4}
										</div>
									</div>
									<button
										type='button'
										onClick={async () => {
											try {
												await appState.value.apiClient?.removePaymentMethod(
													billingState.value.defaultPaymentMethod!.payment_method_id
												);
												await updatePaymentMethods();
											} catch (err) {
												console.error('Failed to remove payment method:', err);
											}
										}}
										class='hidden group-hover:block text-red-400 hover:text-red-500 dark:text-red-500 dark:hover:text-red-400'
										title='Remove payment method'
									>
										<svg class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
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
						) : (
							<div class='text-center py-8'>
								<div class='text-gray-500 dark:text-gray-400 mb-4'>No payment methods added</div>
								<button
									type='button'
									onClick={() => showPaymentMethodDialog.value = true}
									class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
								>
									Add Payment Method
								</button>
							</div>
						)}
					</div>

					{/* Quick Actions */}
					<div class='bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6'>
						<h4 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Quick Actions</h4>
						
						<div class='space-y-3'>
							<button
								type='button'
								onClick={() => showUsageBlockDialog.value = true}
								class='w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md flex items-center justify-center'
							>
								<svg class='h-4 w-4 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 6v6m0 0v6m0-6h6m-6 0H6' />
								</svg>
								Buy Credits
							</button>
							
							{!billingState.value.defaultPaymentMethod && (
								<button
									type='button'
									onClick={() => showPaymentMethodDialog.value = true}
									class='w-full px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-800/20 rounded-md flex items-center justify-center'
								>
									<svg class='h-4 w-4 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' />
									</svg>
									Add Payment Method
								</button>
							)}
							
							<button
								type='button'
								onClick={handleCancelSubscription}
								class='w-full px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-800/20 rounded-md flex items-center justify-center'
							>
								<svg class='h-4 w-4 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
								</svg>
								Cancel Subscription
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Auto Top-up Settings */}
			<div class='mb-8'>
				<AutoTopupSettings />
			</div>

			{/* Available Plans */}
			<div id='change-plan-section' class='mb-8'>
				<h4 class='text-base font-medium text-gray-700 dark:text-gray-300 mb-4'>Change Plan</h4>
				<div class='flex flex-nowrap gap-6 overflow-x-auto pb-4'>
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

			{/* Dialogs */}
			{billingState.value.subscription && (
				<CancelDialog
					isOpen={showCancelDialog.value}
					onClose={() => showCancelDialog.value = false}
					onConfirm={handleConfirmDialogCancel}
					isPaidPlan={billingState.value.subscription.plan.plan_price_monthly > 0}
				/>
			)}

			{showUsageBlockDialog.value && (
				<UsageBlockDialog
					isOpen
					onClose={() => showUsageBlockDialog.value = false}
					existingPaymentMethod={billingState.value.defaultPaymentMethod}
				/>
			)}

			{showPaymentMethodDialog.value && (
				<div
					class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
					onClick={(e) => {
						if (e.target === e.currentTarget) {
							showPaymentMethodDialog.value = false;
						}
					}}
				>
					<div class='bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6'>
						<div class='flex justify-between items-center mb-4'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Add Payment Method</h3>
							<button
								type='button'
								onClick={() => showPaymentMethodDialog.value = false}
								class='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400'
							>
								<span class='sr-only'>Close</span>
								<svg class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
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

			{billingState.value.selectedPlan && billingState.value.billingPreview && (
				<PaymentFlowDialog
					isOpen
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