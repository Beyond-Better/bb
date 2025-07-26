import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { StripeError } from '@stripe/stripe-js';
import { BillingPreviewWithUsage, PaymentMethod, Plan } from '../../types/subscription.ts';
import { useAppState } from '../../hooks/useAppState.ts';
import { useBillingState } from '../../hooks/useBillingState.ts';
import NewPaymentMethodForm from '../../islands/NewPaymentMethodForm.tsx';
import { formatDateSafe } from 'bui/utils/intl.ts';

type PaymentFlowStep = 'preview' | 'payment' | 'confirm' | 'processing';

interface PaymentFlowDialogProps {
	isOpen: boolean;
	onClose: () => void;
	selectedPlan: Plan;
	currentPlan: Plan;
	billingPreview: BillingPreviewWithUsage;
	existingPaymentMethod: PaymentMethod | null;
}

// Payment flow state signals
const paymentFlowStep = signal<PaymentFlowStep>('preview');
const paymentFlowError = signal<string | null>(null);
const selectedPaymentMethod = signal<string | null>(null);
const couponCode = signal<string>('');
const isRefreshingPreview = signal<boolean>(false);

export default function PaymentFlowDialog({
	isOpen,
	onClose,
	selectedPlan,
	currentPlan,
	billingPreview,
	existingPaymentMethod,
}: PaymentFlowDialogProps) {
	const { changePlan, billingState, updatePaymentMethods } = useBillingState();
	const appState = useAppState();

	// Reset state when dialog opens/closes
	useEffect(() => {
		if (isOpen) {
			paymentFlowStep.value = 'preview';
			paymentFlowError.value = null;
			selectedPaymentMethod.value = existingPaymentMethod?.stripe_payment_method_id || null;
			couponCode.value = '';
			isRefreshingPreview.value = false;
		} else {
			// Cleanup when dialog closes
			paymentFlowStep.value = 'preview';
			paymentFlowError.value = null;
			selectedPaymentMethod.value = null;
			couponCode.value = '';
			isRefreshingPreview.value = false;
		}
	}, [isOpen, existingPaymentMethod]);

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose();
			}
		};

		globalThis.addEventListener('keydown', handleEscape);
		return () => globalThis.removeEventListener('keydown', handleEscape);
	}, [isOpen, onClose]);

	// Function to refresh preview with current coupon code
	const refreshPreview = async () => {
		isRefreshingPreview.value = true;
		paymentFlowError.value = null;

		console.log('PaymentFlowDialog: couponCode', couponCode.value);
		try {
			const apiClient = appState.value.apiClient;
			if (!apiClient) throw new Error('API client not available');

			const newPreview = await apiClient.getBillingPreview(selectedPlan.plan_id, couponCode.value || undefined);
			console.log('PaymentFlowDialog: newPreview', newPreview);
			if (newPreview) {
				// Update the billing state with new preview
				billingState.value = {
					...billingState.value,
					billingPreview: newPreview,
				};
			}
		} catch (error) {
			console.error('Failed to refresh preview:', error);
			paymentFlowError.value = error instanceof Error ? error.message : 'Failed to refresh preview';
		} finally {
			isRefreshingPreview.value = false;
		}
	};

	if (!isOpen) return null;

	const handlePaymentSuccess = async (paymentMethodId: string) => {
		try {
			// Save the payment method to the database
			const apiClient = appState.value.apiClient;
			if (!apiClient) throw new Error('API client not available');

			// Save the payment method and set it as default
			await apiClient.savePaymentMethod(paymentMethodId);

			// Update local state
			selectedPaymentMethod.value = paymentMethodId;
			paymentFlowStep.value = 'confirm';
			paymentFlowError.value = null;

			// Refresh payment methods to get the newly saved one
			await updatePaymentMethods();
		} catch (error) {
			console.error('Failed to save payment method:', error);
			paymentFlowError.value = error instanceof Error ? error.message : 'Failed to save payment method';
		}
	};

	const handlePaymentError = (error: StripeError) => {
		paymentFlowError.value = error.message ?? 'Payment failed';
		paymentFlowStep.value = 'payment';
	};

	const handleConfirm = async () => {
		// For upgrades (immediate changes), require payment method; for downgrades (delayed changes), payment method is optional
		const requiresPayment = billingPreview.changeType === 'upgrade' || billingPreview.immediateChange;
		if (requiresPayment && !selectedPaymentMethod.value) {
			paymentFlowError.value = 'Please add a payment method';
			paymentFlowStep.value = 'payment';
			return;
		}

		paymentFlowStep.value = 'processing';
		paymentFlowError.value = null;

		try {
			const apiClient = appState.value.apiClient;
			if (!apiClient) throw new Error('API client not available');

			console.log('PaymentFlowDialog: handleConfirm-changing plan to:', selectedPlan);
			console.log('PaymentFlowDialog: changeType:', billingPreview.changeType);

			// For downgrades, we might not have a payment method, so use empty string
			const paymentMethodId = selectedPaymentMethod.value || '';

			// Change the plan - ABI will handle the payment success via webhook
			await changePlan(selectedPlan.plan_id, paymentMethodId, couponCode.value || undefined);

			// Start polling for subscription status
			let retries = 0;
			const maxRetries = 10;
			const baseDelay = 1000;

			const pollSubscriptionStatus = async () => {
				try {
					if (retries >= maxRetries) {
						console.log('Max retries reached waiting for subscription update');
						onClose();
						return;
					}

					const subscriptionResponse = await apiClient.getCurrentSubscription();
					const subscription = subscriptionResponse?.subscription || null;
					//const futureSubscription = subscriptionResponse?.futureSubscription || null;
					//const paymentMethods = subscriptionResponse?.paymentMethods || [];
					console.log('PaymentFlowDialog: Polling subscription status:', subscription?.subscription_status);

					// For downgrades or non-immediate changes, we don't need to wait for ACTIVE status since it's scheduled
					if (
						subscription &&
						(subscription.subscription_status === 'ACTIVE' || billingPreview.changeType === 'downgrade' ||
							!billingPreview.immediateChange)
					) {
						billingState.value = {
							...billingState.value,
							subscription,
						};
						onClose();

						await updatePaymentMethods();

						return;
					}

					// Exponential backoff
					retries++;
					const delay = baseDelay * Math.pow(2, retries - 1);
					setTimeout(pollSubscriptionStatus, delay);
				} catch (error) {
					console.error('Error polling subscription status:', error);
					onClose();
				}
			};

			// Start polling
			await pollSubscriptionStatus();
		} catch (error) {
			paymentFlowError.value = error instanceof Error ? error.message : 'Failed to change plan';
			paymentFlowStep.value = 'confirm';
		}
	};

	const ErrorAlert = () => {
		return paymentFlowError.value
			? (
				<div class='mb-4 mt-2 p-4 rounded-md bg-red-50 dark:bg-red-900/20'>
					<p class='text-sm text-red-700 dark:text-red-200'>{paymentFlowError.value}</p>
				</div>
			)
			: null;
	};

	const CloseButton = () => {
		return (
			<button
				type='button'
				onClick={onClose}
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
		);
	};

	const renderStepContent = () => {
		console.log('PaymentFlowDialog: billingPreview', billingPreview);
		switch (paymentFlowStep.value) {
			case 'preview':
				return (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Change Plan</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

						{/* Description based on change type */}
						{billingPreview.description && (
							<div
								class={`mt-4 p-4 rounded-md ${
									billingPreview.changeType === 'upgrade'
										? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
										: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
								}`}
							>
								<p class='text-sm'>{billingPreview.description}</p>
							</div>
						)}

						{/* Coupon Code Section */}
						<div class='mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700'>
							<h5 class='text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'>Coupon Code</h5>
							<div class='flex space-x-2'>
								<input
									type='text'
									value={couponCode.value}
									onInput={(e) => couponCode.value = (e.target as HTMLInputElement).value}
									placeholder='Enter coupon code'
									class='flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
									disabled={isRefreshingPreview.value}
								/>
								<button
									type='button'
									onClick={refreshPreview}
									disabled={isRefreshingPreview.value}
									class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md flex items-center space-x-2'
								>
									{isRefreshingPreview.value
										? (
											<>
												<svg class='animate-spin h-4 w-4' fill='none' viewBox='0 0 24 24'>
													<circle
														class='opacity-25'
														cx='12'
														cy='12'
														r='10'
														stroke='currentColor'
														stroke-width='4'
													/>
													<path
														class='opacity-75'
														fill='currentColor'
														d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
													/>
												</svg>
												<span>Checking</span>
											</>
										)
										: (
											<>
												<svg
													class='h-4 w-4'
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
												<span>Apply</span>
											</>
										)}
								</button>
							</div>

							{/* Coupon Status Display */}
							{billingPreview.coupon && (
								<div class='mt-3'>
									{billingPreview.coupon.valid
										? (
											<div class='flex items-center space-x-2 text-green-600 dark:text-green-400'>
												<svg
													class='h-4 w-4'
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														stroke-linecap='round'
														stroke-linejoin='round'
														stroke-width='2'
														d='M5 13l4 4L19 7'
													/>
												</svg>
												<span class='text-sm font-medium'>
													Coupon "{billingPreview.coupon.code}" applied successfully!
												</span>
											</div>
										)
										: (
											<div class='flex items-center space-x-2 text-red-600 dark:text-red-400'>
												<svg
													class='h-4 w-4'
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														stroke-linecap='round'
														stroke-linejoin='round'
														stroke-width='2'
														d='M6 18L18 6M6 6l12 12'
													/>
												</svg>
												<span class='text-sm font-medium'>
													{billingPreview.coupon.error || 'Invalid coupon code'}
												</span>
											</div>
										)}
								</div>
							)}
						</div>

						<div class='mt-4 bg-gray-50 dark:bg-gray-700 rounded-md p-4'>
							<h4 class='text-sm font-medium text-gray-900 dark:text-gray-100'>Billing Preview</h4>
							<dl class='mt-2 space-y-2'>
								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400'>Current Plan:</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										{currentPlan.plan_name}
									</dd>
								</div>
								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400'>New Plan:</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										{selectedPlan.plan_name}
									</dd>
								</div>

								{/* Show effective date - different messaging for upgrades vs downgrades */}
								{billingPreview.effectiveDate && (
									<div class='flex justify-between'>
										<dt class='text-sm text-gray-500 dark:text-gray-400'>
											{billingPreview.changeType === 'upgrade'
												? 'Effective Date:'
												: 'Change Date:'}
										</dt>
										<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
											{formatDateSafe(new Date(billingPreview.effectiveDate), {
												timeZone: 'UTC',
												dateStyle: 'short',
											}, 'Not scheduled')}
											{billingPreview.changeType === 'upgrade'
												? ' (Immediate)'
												: ' (Next billing cycle)'}
										</dd>
									</div>
								)}

								{/* Show different payment info based on change type */}
								{billingPreview.changeType === 'upgrade'
									? (
										<>
											<div class='flex justify-between'>
												<dt class='text-sm text-gray-500 dark:text-gray-400 group relative'>
													Initial Payment (Prorated)
													<span class='ml-1 cursor-help'>ⓘ</span>
													<div class='invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10'>
														This is your first payment, adjusted for the remaining days in
														the current billing period. You'll be charged the full amount on
														your next billing date.
													</div>
												</dt>
												<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
													${billingPreview.proratedAmount
														? billingPreview.proratedAmount.toFixed(2)
														: ((billingPreview.prorationFactor !== undefined
															? billingPreview.prorationFactor
															: 0) *
															(billingPreview.fullAmount !== undefined
																? billingPreview.fullAmount
																: selectedPlan.plan_price_monthly))
															.toFixed(2)}
												</dd>
											</div>
											<div class='flex justify-between'>
												<dt class='text-sm text-gray-500 dark:text-gray-400 group relative'>
													Next Payment (Full Amount)
													<span class='ml-1 cursor-help'>ⓘ</span>
													<div class='invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10'>
														This is the regular monthly amount you'll be charged on your
														next billing date and thereafter.
													</div>
												</dt>
												<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
													${billingPreview.fullAmount !== undefined
														? billingPreview.fullAmount.toFixed(2)
														: selectedPlan.plan_price_monthly.toFixed(2)}
												</dd>
											</div>
										</>
									)
									: (
										<>
											<div class='flex justify-between'>
												<dt class='text-sm text-gray-500 dark:text-gray-400'>
													Immediate Payment:
												</dt>
												<dd class='text-sm font-medium text-green-600 dark:text-green-400'>
													$0.00 (No immediate charge)
												</dd>
											</div>
											<div class='flex justify-between'>
												<dt class='text-sm text-gray-500 dark:text-gray-400'>
													New Monthly Amount:
												</dt>
												<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
													${billingPreview.fullAmount !== undefined
														? billingPreview.fullAmount.toFixed(2)
														: selectedPlan.plan_price_monthly.toFixed(2)}
												</dd>
											</div>
										</>
									)}

								{/* Coupon Discount and Bonus Credits */}
								{billingPreview.coupon?.valid && (
									<>
										{billingPreview.originalAmount && billingPreview.discount &&
												billingPreview.discount > 0
											? (
												<>
													<div class='flex justify-between border-t border-gray-200 dark:border-gray-600 pt-2 mt-2'>
														<dt class='text-sm text-gray-500 dark:text-gray-400'>
															Original Price:
														</dt>
														<dd class='text-sm text-gray-500 dark:text-gray-400 line-through'>
															${billingPreview.originalAmount.toFixed(2)}
														</dd>
													</div>
													<div class='flex justify-between'>
														<dt class='text-sm text-green-600 dark:text-green-400 font-medium'>
															Coupon Discount:
														</dt>
														<dd class='text-sm text-green-600 dark:text-green-400 font-medium'>
															-${billingPreview.discount.toFixed(2)}
														</dd>
													</div>
												</>
											)
											: null}
										{billingPreview.bonusCredits && billingPreview.bonusCredits > 0
											? (
												<div class='flex justify-between'>
													<dt class='text-sm text-blue-600 dark:text-blue-400 font-medium'>
														Bonus Credits:
													</dt>
													<dd class='text-sm text-blue-600 dark:text-blue-400 font-medium'>
														+${billingPreview.bonusCredits.toFixed(2)}
													</dd>
												</div>
											)
											: null}
									</>
								)}

								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400'>Next Billing Date:</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										{formatDateSafe(
											new Date(billingPreview.nextPeriodStart || billingPreview.periodEnd),
											{
												timeZone: 'UTC',
												dateStyle: 'short',
											},
											'Not scheduled',
										)}
									</dd>
								</div>
							</dl>
						</div>
						<div class='mt-6 flex justify-end space-x-3'>
							<button
								type='button'
								onClick={onClose}
								class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
							>
								Cancel
							</button>
							<button
								type='button'
								onClick={() => {
									// For downgrades, skip payment collection since there's no immediate charge
									if (billingPreview.changeType === 'downgrade' || !billingPreview.immediateChange) {
										paymentFlowStep.value = 'confirm';
									} else {
										// For upgrades, check if payment method is needed
										paymentFlowStep.value = existingPaymentMethod ? 'confirm' : 'payment';
									}
								}}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
							>
								{billingPreview.changeType === 'downgrade' ? 'Schedule Change' : 'Continue'}
							</button>
						</div>
					</>
				);

			case 'payment':
				return (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Add Payment Method</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

						<div class='flex flex-col flex-grow space-y-4'>
							<NewPaymentMethodForm
								onSuccess={handlePaymentSuccess}
								onError={handlePaymentError}
								onCancel={() => paymentFlowStep.value = 'preview'}
							/>
						</div>
					</>
				);

			case 'confirm':
				return (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Confirm Plan Change</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

						<div class='mt-4'>
							{/* Use description from backend if available, otherwise fall back to custom messaging */}
							{billingPreview.description
								? (
									<p class='text-sm text-gray-500 dark:text-gray-400'>
										{billingPreview.description}
										{billingPreview.changeType === 'upgrade' && (
											<>
												<br />
												<br />
												You will be charged ${billingPreview.proratedAmount
													? billingPreview.proratedAmount.toFixed(2)
													: (billingPreview.prorationFactor * selectedPlan.plan_price_monthly)
														.toFixed(2)} now, and ${billingPreview.fullAmount
													? billingPreview.fullAmount.toFixed(2)
													: selectedPlan.plan_price_monthly.toFixed(2)} on {formatDateSafe(
														new Date(
															billingPreview.nextPeriodStart || billingPreview.periodEnd,
														),
														{
															timeZone: 'UTC',
															dateStyle: 'short',
														},
														'Not scheduled',
													)}.
											</>
										)}
										{billingPreview.changeType === 'downgrade' && (
											<>
												<br />
												<br />
												Starting {formatDateSafe(
													new Date(
														billingPreview.effectiveDate ||
															billingPreview.nextPeriodStart ||
															billingPreview.periodEnd,
													),
													{
														timeZone: 'UTC',
														dateStyle: 'short',
													},
													'Not scheduled',
												)}, you will be charged ${selectedPlan
													.plan_price_monthly.toFixed(2)} monthly.
											</>
										)}
									</p>
								)
								: billingPreview.changeType === 'upgrade'
								? (
									<p class='text-sm text-gray-500 dark:text-gray-400'>
										You will be charged ${billingPreview.proratedAmount
											? billingPreview.proratedAmount.toFixed(2)
											: (billingPreview.prorationFactor * selectedPlan.plan_price_monthly)
												.toFixed(2)} now, and ${billingPreview.fullAmount
											? billingPreview.fullAmount.toFixed(2)
											: selectedPlan.plan_price_monthly.toFixed(2)} on {formatDateSafe(
												new Date(billingPreview.nextPeriodStart || billingPreview.periodEnd),
												{
													timeZone: 'UTC',
													dateStyle: 'short',
												},
												'Not scheduled',
											)}.
									</p>
								)
								: (
									<p class='text-sm text-gray-500 dark:text-gray-400'>
										Your plan will be changed to <strong>{selectedPlan.plan_name}</strong> on{' '}
										{formatDateSafe(
											new Date(
												billingPreview.effectiveDate || billingPreview.nextPeriodStart ||
													billingPreview.periodEnd,
											),
											{
												timeZone: 'UTC',
												dateStyle: 'short',
											},
											'Not scheduled',
										)}. You will continue to have access to your current plan until then.
										<br />
										<br />
										Starting {formatDateSafe(
											new Date(
												billingPreview.effectiveDate || billingPreview.nextPeriodStart ||
													billingPreview.periodEnd,
											),
											{
												timeZone: 'UTC',
												dateStyle: 'short',
											},
											'Not scheduled',
										)}, you will be charged ${selectedPlan
											.plan_price_monthly.toFixed(2)} monthly.
									</p>
								)}

							{/* Payment method info - show for upgrades (required) or downgrades (optional future billing) */}
							{existingPaymentMethod &&
								(billingPreview.changeType === 'upgrade' ||
									billingPreview.changeType === 'downgrade') &&
								(
									<div class='mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-md'>
										<div class='flex items-center justify-between'>
											<div class='flex items-center'>
												<div class='text-sm font-medium text-gray-900 dark:text-gray-100'>
													{existingPaymentMethod.card_brand?.toUpperCase()}
												</div>
												<div class='ml-4 text-sm font-medium text-gray-900 dark:text-gray-100'>
													•••• {existingPaymentMethod.card_last4}
												</div>
												<div class='ml-4 text-sm text-gray-500 dark:text-gray-400'>
													Expires{' '}
													{existingPaymentMethod.card_exp_month}/{existingPaymentMethod
														.card_exp_year}
												</div>
											</div>
										</div>
									</div>
								)}
						</div>
						<div class='mt-6 flex justify-end space-x-3'>
							<button
								type='button'
								onClick={() => paymentFlowStep.value = 'preview'}
								class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
							>
								Back
							</button>
							<button
								type='button'
								onClick={handleConfirm}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
							>
								{billingPreview.changeType === 'upgrade' ? 'Confirm Upgrade' : 'Schedule Downgrade'}
							</button>
						</div>
					</>
				);

			case 'processing':
				return (
					<>
						<ErrorAlert />

						<div class='p-6 flex flex-col items-center justify-center'>
							<svg
								class='animate-spin h-10 w-10 text-blue-600 dark:text-blue-500'
								xmlns='http://www.w3.org/2000/svg'
								fill='none'
								viewBox='0 0 24 24'
							>
								<circle
									class='opacity-25'
									cx='12'
									cy='12'
									r='10'
									stroke='currentColor'
									stroke-width='4'
								>
								</circle>
								<path
									class='opacity-75'
									fill='currentColor'
									d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
								>
								</path>
							</svg>
							<p class='mt-4 text-sm text-gray-500 dark:text-gray-400'>Processing your plan change...</p>
						</div>
					</>
				);
		}
	};

	return (
		<div
			class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
			onClick={(e) => {
				// Close dialog when clicking outside
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
		>
			<div class='bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6'>
				{paymentFlowStep.value && renderStepContent()}
			</div>
		</div>
	);
}
