import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { errorMessage, errorName } from 'shared/error.ts';
import { ExternalLink } from '../../components/ExternalLink.tsx';

export default function ForgotPasswordForm() {
	const { resetPasswordForEmail } = useAuthState();
	const email = useSignal('');
	const isSubmitting = useSignal(false);
	const successMessage = useSignal('');
	const resetError = useSignal('');

	// Get email from URL parameters if provided (client-side only)
	useEffect(() => {
		if (typeof globalThis !== 'undefined' && globalThis.location) {
			const urlParams = new URLSearchParams(globalThis.location.search);
			const emailFromUrl = urlParams.get('email');
			if (emailFromUrl && email.value === '') {
				email.value = emailFromUrl;
			}
		}
	}, []);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		if (isSubmitting.value) return;

		try {
			isSubmitting.value = true;
			resetError.value = '';

			const data = await resetPasswordForEmail(null, null, email.value);

			if (data.error) {
				if (data.error === 'Failed to fetch' || data.error === 'Load failed') {
					resetError.value =
						"⚠️ BB App Required: The BB Desktop App must be installed and running to reset your password. This is not optional - it's required for BB to work properly.";
				} else {
					resetError.value = data.error;
				}
			} else {
				// Success
				successMessage.value =
					'Password reset email sent! Please check your inbox and follow the instructions to reset your password.';
			}
		} catch (error) {
			// Specific error handling for connection issues
			if (
				errorMessage(error) === 'Failed to fetch' || errorMessage(error) === 'Load failed' ||
				errorName(error) === 'TypeError'
			) {
				resetError.value =
					"⚠️ BB App Required: The BB Desktop App must be installed and running to reset your password. This is not optional - it's required for BB to work properly.";
			} else {
				resetError.value = `Password reset failed: ${errorMessage(error) || 'Unknown error occurred'}`;
			}
		} finally {
			isSubmitting.value = false;
		}
	};

	return (
		<form method='post' class='space-y-6' onSubmit={handleSubmit}>
			{/* Success Message */}
			{successMessage.value && (
				<div class='rounded-md bg-green-50 dark:bg-green-900/50 p-4'>
					<div class='flex'>
						<div class='flex-shrink-0'>
							<svg
								class='h-5 w-5 text-green-400'
								xmlns='http://www.w3.org/2000/svg'
								viewBox='0 0 20 20'
								fill='currentColor'
							>
								<path
									fill-rule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z'
									clip-rule='evenodd'
								/>
							</svg>
						</div>
						<div class='ml-3'>
							<p class='text-sm font-medium text-green-800 dark:text-green-200'>
								{successMessage.value}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Error display */}
			{resetError.value && !successMessage.value && (
				<div class='rounded-md bg-red-50 dark:bg-red-900/50 p-4'>
					<div class='flex'>
						<div class='flex-shrink-0'>
							<svg
								class='h-5 w-5 text-red-400'
								xmlns='http://www.w3.org/2000/svg'
								viewBox='0 0 20 20'
								fill='currentColor'
							>
								<path
									fill-rule='evenodd'
									d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z'
									clip-rule='evenodd'
								/>
							</svg>
						</div>
						<div class='ml-3'>
							<h3 class='text-sm font-medium text-red-800 dark:text-red-200'>
								{resetError.value}
							</h3>
							{(resetError.value.includes('BB Server') || resetError.value.includes('BB App Required')) &&
								(
									<div class='mt-3 space-y-2'>
										<div class='text-sm text-red-700 dark:text-red-300'>
											<p class='font-medium mb-1'>To fix this:</p>
											<ol class='list-decimal list-inside space-y-1 text-xs'>
												<li>Download and install the BB Desktop App (see below)</li>
												<li>Launch the BB Desktop App</li>
												<li>Ensure the server toggle is enabled (green)</li>
												<li>Try resetting your password again</li>
											</ol>
										</div>
										<p class='text-xs text-red-600 dark:text-red-400'>
											Need more help?{' '}
											<ExternalLink
												href='https://www.beyondbetter.app/docs/install'
												class='font-medium underline'
											>
												View troubleshooting guide
											</ExternalLink>
										</p>
									</div>
								)}
						</div>
					</div>
				</div>
			)}

			{/* Email field */}
			<div>
				<label
					htmlFor='email'
					class='block text-sm font-medium text-gray-700 dark:text-gray-200'
				>
					Email address
				</label>
				<div class='mt-1'>
					<input
						id='email'
						name='email'
						type='email'
						autoComplete='email'
						required
						class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
						value={email.value}
						onInput={(e) => email.value = (e.target as HTMLInputElement).value}
						disabled={!!successMessage.value}
					/>
				</div>
				<p class='mt-2 text-sm text-gray-600 dark:text-gray-400'>
					We'll send you a link to reset your password.
				</p>
			</div>

			{/* Submit button */}
			<div>
				<button
					type='submit'
					disabled={isSubmitting.value || !!successMessage.value}
					class={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 ${
						(isSubmitting.value || !!successMessage.value)
							? 'opacity-75 cursor-not-allowed'
							: 'hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
					}`}
				>
					{isSubmitting.value
						? (
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
						)
						: null}
					{successMessage.value ? 'Email sent' : 'Send reset link'}
				</button>
			</div>

			{/* Back to login */}
			{!successMessage.value && (
				<div class='text-center'>
					<p class='text-sm text-gray-600 dark:text-gray-400'>
						Remember your password?{' '}
						<a
							href='/auth/login'
							class='font-medium text-purple-600 hover:text-purple-500'
						>
							Back to login
						</a>
					</p>
				</div>
			)}

			{successMessage.value && (
				<div class='text-center space-y-2'>
					<p class='text-sm text-gray-600 dark:text-gray-400'>
						Didn't receive the email? Check your spam folder or{' '}
						<button
							type='button'
							onClick={() => {
								successMessage.value = '';
								resetError.value = '';
							}}
							class='font-medium text-purple-600 hover:text-purple-500'
						>
							try again
						</button>
					</p>
					<p class='text-sm text-gray-600 dark:text-gray-400'>
						<a
							href='/auth/login'
							class='font-medium text-purple-600 hover:text-purple-500'
						>
							Back to login
						</a>
					</p>
				</div>
			)}
		</form>
	);
}
