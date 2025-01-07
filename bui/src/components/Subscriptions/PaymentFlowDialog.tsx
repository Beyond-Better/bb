import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { StripeError } from '@stripe/stripe-js';
import { BillingPreviewWithUsage, Plan } from '../../types/subscription.ts';
import { useAppState } from '../../hooks/useAppState.ts';
import { useBillingState } from '../../hooks/useBillingState.ts';
import NewPaymentMethodForm from '../../islands/NewPaymentMethodForm.tsx';

type PaymentFlowStep = 'preview' | 'payment' | 'confirm' | 'processing';

interface PaymentFlowDialogProps {
	isOpen: boolean;
	onClose: () => void;
	selectedPlan: Plan;
	currentPlan: Plan;
	billingPreview: BillingPreviewWithUsage;
	existingPaymentMethod?: {
		payment_method_id: string;
		stripe_payment_method_id: string;
		card_brand: string;
		card_last4: string;
		card_exp_month: number;
		card_exp_year: number;
	};
}

// Payment flow state signals
const paymentFlowStep = signal<PaymentFlowStep>('preview');
const paymentFlowError = signal<string | null>(null);
const selectedPaymentMethod = signal<string | null>(null);

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
		} else {
			// Cleanup when dialog closes
			paymentFlowStep.value = 'preview';
			paymentFlowError.value = null;
			selectedPaymentMethod.value = null;
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

	if (!isOpen) return null;

	const handlePaymentSuccess = (paymentMethodId: string) => {
		selectedPaymentMethod.value = paymentMethodId;
		paymentFlowStep.value = 'confirm';
		paymentFlowError.value = null;
	};

	const handlePaymentError = (error: StripeError) => {
		paymentFlowError.value = error.message ?? 'Payment failed';
		paymentFlowStep.value = 'payment';
	};

	const handleConfirm = async () => {
		if (!selectedPaymentMethod.value) {
			paymentFlowError.value = 'Please add a payment method';
			paymentFlowStep.value = 'payment';
			return;
		}

		paymentFlowStep.value = 'processing';
		paymentFlowError.value = null;

		try {
			const apiClient = appState.value.apiClient;
			if (!apiClient) throw new Error('API client not available');

			// payment intent is created in useBillingState.changePlan()
			// // Create a payment intent for the prorated amount if needed
			// const proratedAmount = Math.round(billingPreview.prorationFactor * selectedPlan.plan_price_monthly * 100);
			// console.log('PaymentFlowDialog: handleConfirm-proratedAmount:', proratedAmount);
			//
			// if (proratedAmount > 0) {
			// 	// Create payment intent with existing payment method
			// 	await apiClient.createPaymentIntent({
			// 		amount: proratedAmount,
			// 		stripe_payment_method_id: selectedPaymentMethod.value,
			// 		subscription_id: billingState.value.subscription?.subscription_id || '',
			// 		payment_type: 'subscription',
			// 		source: 'PaymentFlowDialog',
			// 	});
			// }

			console.log('PaymentFlowDialog: handleConfirm-changing plan to:', selectedPlan);
			// Change the plan - ABI will handle the payment success via webhook
			await changePlan(selectedPlan.plan_id, selectedPaymentMethod.value);

			// Start polling for subscription status
			let retries = 0;
			const maxRetries = 5;
			const baseDelay = 1000;

			const pollSubscriptionStatus = async () => {
				try {
					if (retries >= maxRetries) {
						console.log('Max retries reached waiting for subscription update');
						onClose();
						return;
					}

					const subscription = await apiClient.getCurrentSubscription();
					console.log('PaymentFlowDialog: Polling subscription status:', subscription?.subscription_status);

					if (subscription?.subscription_status === 'ACTIVE') {
						//const defaultPaymentMethod = subscription.PaymentMethods?.find((pm) => pm.isDefault) || null;
						billingState.value = {
							...billingState.value,
							subscription,
							//defaultPaymentMethod,
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
		switch (paymentFlowStep.value) {
			case 'preview':
				return (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Change Plan</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

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
								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400 group relative'>
										Initial Payment (Prorated)
										<span class='ml-1 cursor-help'>ⓘ</span>
										<div class='invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10'>
											This is your first payment, adjusted for the remaining days in the current
											billing period. You'll be charged the full amount on your next billing date.
										</div>
									</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										${(billingPreview.prorationFactor * selectedPlan.plan_price_monthly).toFixed(2)}
									</dd>
								</div>
								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400 group relative'>
										Next Payment (Full Amount)
										<span class='ml-1 cursor-help'>ⓘ</span>
										<div class='invisible group-hover:visible absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg z-10'>
											This is the regular monthly amount you'll be charged on your next billing
											date and thereafter.
										</div>
									</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										${selectedPlan.plan_price_monthly.toFixed(2)}
									</dd>
								</div>
								<div class='flex justify-between'>
									<dt class='text-sm text-gray-500 dark:text-gray-400'>Next Billing Date:</dt>
									<dd class='text-sm font-medium text-gray-900 dark:text-gray-100'>
										{new Date(billingPreview.periodEnd).toLocaleDateString()}
									</dd>
								</div>
							</dl>
						</div>
						<div class='mt-6 flex justify-end space-x-3'>
							<button
								onClick={onClose}
								class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
							>
								Cancel
							</button>
							<button
								onClick={() => {
									paymentFlowStep.value = existingPaymentMethod ? 'confirm' : 'payment';
								}}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
							>
								Continue
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
							<p class='text-sm text-gray-500 dark:text-gray-400'>
								You will be charged ${(billingPreview.prorationFactor * selectedPlan.plan_price_monthly)
									.toFixed(2)} now, and ${selectedPlan.plan_price_monthly.toFixed(2)} on{' '}
								{new Date(billingPreview.periodEnd).toLocaleDateString()}.
							</p>
							{existingPaymentMethod && (
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
												Expires {existingPaymentMethod.card_exp_month}/{existingPaymentMethod
													.card_exp_year}
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
						<div class='mt-6 flex justify-end space-x-3'>
							<button
								onClick={() => paymentFlowStep.value = 'preview'}
								class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
							>
								Back
							</button>
							<button
								onClick={handleConfirm}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
							>
								Confirm Plan Change
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
