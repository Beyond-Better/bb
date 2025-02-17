import { useEffect, useState } from 'preact/hooks';
import type { StripeElement, StripeError } from '@stripe/stripe-js';
import { useBillingState } from '../hooks/useBillingState.ts';

interface NewPaymentMethodFormProps {
	onSuccess: (paymentMethodId: string) => void;
	onError: (error: StripeError) => void;
	onCancel: () => void;
}

export default function NewPaymentMethodForm({
	onSuccess,
	onError,
	onCancel,
}: NewPaymentMethodFormProps) {
	const { billingState, createPaymentElements } = useBillingState();
	const [isProcessing, setIsProcessing] = useState(false);
	const [message, setMessage] = useState('');
	const [paymentElement, setPaymentElement] = useState<StripeElement | null>(null);

	useEffect(() => {
		let mounted = true;
		const initializePayment = async () => {
			try {
				// Create elements without payment intent since we're just collecting the method
				await createPaymentElements();

				if (billingState.value.elements) {
					try {
						// Clean up any existing element
						if (paymentElement) {
							paymentElement.unmount();
						}

						// Create and mount new element
						const element = billingState.value.elements.create('payment');
						element.mount('#payment-element');
						if (mounted) {
							setPaymentElement(element);
						}
					} catch (mountError) {
						console.error('Failed to mount payment element:', mountError);
						setMessage('Failed to initialize payment form');
						onError(mountError as StripeError);
					}
				}
			} catch (error) {
				setMessage('Failed to load payment form');
				onError(error as StripeError);
			}
		};

		initializePayment();

		return () => {
			mounted = false;
			if (paymentElement) {
				try {
					paymentElement.unmount();
				} catch (error) {
					console.error('Error unmounting payment element:', error);
				}
				setPaymentElement(null);
			}
		};
	}, []);

	const handleSubmit = async (event: Event) => {
		event.preventDefault();

		if (!billingState.value.stripe || !billingState.value.elements) {
			setMessage('Payment system not initialized');
			return;
		}

		setIsProcessing(true);
		setMessage('');

		try {
			// First submit the form to validate
			const { error: submitError } = await billingState.value.elements.submit();
			if (submitError) {
				setMessage(submitError.message ?? 'Validation failed');
				onError(submitError);
				return;
			}

			// Create the payment method
			const { error, paymentMethod } = await billingState.value.stripe.createPaymentMethod({
				elements: billingState.value.elements,
			});

			if (error) {
				setMessage(error.message ?? 'An error occurred');
				onError(error);
				return;
			}

			if (!paymentMethod) {
				throw new Error('No payment method created');
			}

			// Call the success callback with the payment method ID
			onSuccess(paymentMethod.id);
		} catch (error) {
			setMessage('An unexpected error occurred');
			onError(error as StripeError);
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} class='space-y-6'>
			<div class='min-h-[300px] p-4 border rounded-lg bg-white dark:bg-gray-800'>
				<div id='payment-element'>
					<div class='p-6'>
						<div class='animate-pulse space-y-4'>
							<div class='h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4'></div>
							<div class='space-y-3'>
								<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded'></div>
								<div class='h-8 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Error Message */}
			{message && (
				<div class='p-4 rounded-md bg-red-50 dark:bg-red-900/20'>
					<p class='text-sm text-red-700 dark:text-red-200'>{message}</p>
				</div>
			)}

			{/* Buttons */}
			<div class='flex justify-end space-x-4'>
				<button
					type='button'
					onClick={onCancel}
					disabled={isProcessing}
					class='px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md'
				>
					Cancel
				</button>
				<button
					type='submit'
					disabled={isProcessing}
					class={`px-4 py-2 text-sm font-medium text-white rounded-md ${
						isProcessing
							? 'bg-blue-400 dark:bg-blue-500 cursor-not-allowed'
							: 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'
					}`}
				>
					{isProcessing
						? (
							<div class='flex items-center'>
								<svg
									class='animate-spin -ml-1 mr-3 h-5 w-5 text-white'
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
								Processing...
							</div>
						)
						: (
							'Add Payment Method'
						)}
				</button>
			</div>
		</form>
	);
}
