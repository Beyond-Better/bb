import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useAppState } from '../../hooks/useAppState.ts';
import { useBillingState } from '../../hooks/useBillingState.ts';

interface UsageBlockDialogProps {
	isOpen: boolean;
	onClose: () => void;
	existingPaymentMethod?: {
		id: string;
		card_brand: string;
		card_last4: string;
		card_exp_month: number;
		card_exp_year: number;
	};
}

type UsageBlockStep = 'amount' | 'confirm' | 'processing';

const usageBlockStep = signal<UsageBlockStep>('amount');
const usageBlockError = signal<string | null>(null);
const customAmount = signal<string>('');
const selectedAmount = signal<number | null>(null);

const PREDEFINED_AMOUNTS = [10, 20, 50, 100];
const MIN_AMOUNT = 5;
const MAX_AMOUNT = 100;

export default function UsageBlockDialog({ isOpen, onClose, existingPaymentMethod }: UsageBlockDialogProps) {
	const { billingState } = useBillingState();
	const appState = useAppState();

	const handleOnClose = () => {
		selectedAmount.value = null;
		customAmount.value = '';
		usageBlockStep.value = 'amount';
		onClose();
	};

	// Handle escape key
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				handleOnClose();
			}
		};

		globalThis.addEventListener('keydown', handleEscape);
		return () => globalThis.removeEventListener('keydown', handleEscape);
	}, [isOpen, onClose]);

	// Reset state when dialog opens/closes
	useEffect(() => {
		if (!isOpen) {
			// Reset all state when dialog closes
			usageBlockStep.value = 'amount';
			usageBlockError.value = null;
			customAmount.value = '';
			selectedAmount.value = null;
		}
	}, [isOpen]);

	const handleAmountSelect = (amount: number) => {
		selectedAmount.value = amount;
		usageBlockStep.value = 'confirm';
	};

	const handleCustomAmountChange = (e: Event) => {
		const value = (e.target as HTMLInputElement).value;
		customAmount.value = value;
		// Clear any previous error when user starts typing
		usageBlockError.value = null;
	};

	const handleCustomAmountSubmit = () => {
		const amount = parseFloat(customAmount.value);
		if (isNaN(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
			usageBlockError.value = `Amount must be between ${MIN_AMOUNT} and ${MAX_AMOUNT}`;
			return;
		}
		handleAmountSelect(amount);
	};

	const handleConfirm = async () => {
		if (!selectedAmount.value || !existingPaymentMethod) {
			usageBlockError.value = 'Please select an amount and ensure you have a payment method';
			return;
		}

		usageBlockStep.value = 'processing';
		usageBlockError.value = null;

		try {
			const apiClient = appState.value.apiClient;
			if (!apiClient) throw new Error('API client not available');

			// Create payment intent with existing payment method
			await apiClient.createPaymentIntent({
				amount: Math.round(selectedAmount.value * 100),
				subscription_id: billingState.value.subscription?.subscription_id || '',
				payment_type: 'token_purchase',
				stripe_payment_method_id: existingPaymentMethod.stripe_payment_method_id,
			});

			// Purchase the usage block - ABI will handle the payment success via webhook
			await apiClient.purchaseUsageBlock(selectedAmount.value, existingPaymentMethod.stripe_payment_method_id);

			// Start polling for updated usage data
			let retries = 0;
			const maxRetries = 5;
			const baseDelay = 1000;

			const pollUsageUpdate = async () => {
				try {
					if (retries >= maxRetries) {
						console.log('Max retries reached waiting for usage update');
						return;
					}

					const subscription = await apiClient.getCurrentSubscription();
					if (subscription) {
						billingState.value = {
							...billingState.value,
							subscription,
						};
					}

					retries++;
					const delay = baseDelay * Math.pow(2, retries - 1);
					setTimeout(pollUsageUpdate, delay);
				} catch (error) {
					console.error('Error polling usage update:', error);
				}
			};

			// Start polling and close dialog
			pollUsageUpdate();
			handleOnClose();
		} catch (error) {
			usageBlockError.value = error instanceof Error ? error.message : 'Failed to purchase usage block';
			usageBlockStep.value = 'confirm';
		}
	};

	const ErrorAlert = () => {
		return usageBlockError.value
			? (
				<div class='mb-4 mt-2 p-4 rounded-md bg-red-50 dark:bg-red-900/20'>
					<p class='text-sm text-red-700 dark:text-red-200'>{usageBlockError.value}</p>
				</div>
			)
			: null;
	};

	const CloseButton = () => {
		return (
			<button
				onClick={handleOnClose}
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

	if (!isOpen) return null;

	return (
		<div
			class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'
			onClick={(e) => {
				// Close dialog when clicking outside
				if (e.target === e.currentTarget) {
					handleOnClose();
				}
			}}
		>
			<div class='bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6'>
				{usageBlockStep.value === 'amount' && (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Purchase Usage Block</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

						<div class='mt-4 space-y-4'>
							<div class='grid grid-cols-4 gap-4'>
								{PREDEFINED_AMOUNTS.map((amount) => (
									<button
										key={amount}
										onClick={() => handleAmountSelect(amount)}
										class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
									>
										${amount}
									</button>
								))}
							</div>
							<div class='mt-4'>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-300'>
									Custom Amount
								</label>
								<div class='mt-1 flex rounded-md shadow-sm'>
									<span class='inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 sm:text-sm'>
										$
									</span>
									<input
										type='number'
										step='1.0'
										min={MIN_AMOUNT}
										max={MAX_AMOUNT}
										value={customAmount.value}
										onChange={handleCustomAmountChange}
										class='flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus:ring-blue-500 focus:border-blue-500 sm:text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700'
										placeholder='Enter amount'
									/>
								</div>
								<div class='flex gap-3 mt-2'>
									<button
										onClick={handleOnClose}
										class='flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
									>
										Cancel
									</button>
									<button
										onClick={handleCustomAmountSubmit}
										class='flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
									>
										Continue
									</button>
								</div>
							</div>
						</div>
					</>
				)}

				{usageBlockStep.value === 'confirm' && (
					<>
						<div class='flex justify-between items-center'>
							<h3 class='text-lg font-medium text-gray-900 dark:text-gray-100'>Confirm Purchase</h3>
							<CloseButton />
						</div>
						<ErrorAlert />

						<div class='mt-4'>
							<p class='text-sm text-gray-500 dark:text-gray-400'>
								You will be charged ${selectedAmount.value?.toFixed(2)} for additional usage.
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
								onClick={() => usageBlockStep.value = 'amount'}
								class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
							>
								Back
							</button>
							<button
								onClick={handleConfirm}
								class='px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-md'
							>
								Confirm Purchase
							</button>
						</div>
					</>
				)}

				{usageBlockStep.value === 'processing' && (
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
							<p class='mt-4 text-sm text-gray-500 dark:text-gray-400'>Processing your purchase...</p>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
