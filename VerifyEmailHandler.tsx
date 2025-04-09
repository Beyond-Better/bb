import { useSignal } from '@preact/signals';
import { useEffect, useState } from 'preact/hooks';
import type { EmailOtpType } from '@supabase/supabase-js';
import ManualEmailVerificationForm from './ManualEmailVerificationForm.tsx';

export default function VerifyEmailHandler() {
	const isError = useSignal(false);
	const isVerifying = useSignal(true);
	const message = useSignal('Verifying your email...');
	const [showResendForm, setShowResendForm] = useState(false);
	const [userEmail, setUserEmail] = useState('');

	useEffect(() => {
		const handleVerification = async () => {
			const { searchParams } = new URL(globalThis.location.href);
			const tokenHash = searchParams.get('token_hash');
			const type = searchParams.get('type') as EmailOtpType;
			const email = searchParams.get('email');
			
			// Set email from URL params if available (for resend form)
			if (email) {
				setUserEmail(email);
			}

			try {
				if (tokenHash && type) {
					// Import dynamically to prevent server-side errors
					const { getSupabaseClient } = await import('../utils/supabase.ts');
					const supabase = await getSupabaseClient();

					const { error } = await supabase.auth.verifyOtp({
						token_hash: tokenHash,
						type,
					});

					if (error) {
						console.log('VerifyEmailHandler: Error verifying email', error);
						
						// If verification fails and we have email, call the edge function to check status
						if (email) {
							// Call the backup edge function to check if user is already verified
							try {
								console.log('VerifyEmailHandler: Calling edge function with email:', email);
								const { data, error: backupError } = await supabase.functions.invoke(
									'check-email-verification',
									{ body: { email } }
								);
								
								console.log('Edge function response:', data, backupError);
								
								if (data?.verified) {
									// Email already verified! Redirect to download page
									isVerifying.value = false;
									message.value = 'Email verified successfully! Redirecting to download page...';
									// Redirect after a short delay
									setTimeout(() => {
										globalThis.location.href = '/download';
									}, 2000);
									return;
								} else if (data?.exists) {
									// User exists but email not verified - show resend option
									isVerifying.value = false;
									isError.value = true;
									message.value = 'Your verification link may have expired. Please try the resend option below.';
									// Automatically open resend form since we have the email
									setShowResendForm(true);
								} else {
									// Account not found
									isVerifying.value = false;
									isError.value = true;
									message.value = 'Account not found or verification failed';
								}
							} catch (edgeFunctionError) {
								console.error('Edge function error:', edgeFunctionError);
								isVerifying.value = false;
								isError.value = true;
								message.value = 'Verification failed: Unable to check email status';
								// Still show resend form as a fallback
								setShowResendForm(true);
							}
						} else {
							// No email in URL, can't help user effectively
							isVerifying.value = false;
							isError.value = true;
							message.value = `Failed to verify email: ${error.message}`;
						}
					} else {
						isVerifying.value = false;
						message.value = 'Email verified successfully! Redirecting to download page...';
						// Redirect after a short delay
						setTimeout(() => {
							globalThis.location.href = '/download';
						}, 2000);
					}
				} else {
					isVerifying.value = false;
					isError.value = true;
					message.value = 'Invalid verification link. No token or type found.';
				}
			} catch (error) {
				console.error('Verification error:', error);
				isVerifying.value = false;
				isError.value = true;
				message.value = error instanceof Error ? error.message : 'Failed to verify email';
			}
		};

		handleVerification();
	}, []); // Only run once on mount

	const handleShowResendForm = () => {
		setShowResendForm(true);
	};

	return (
		<div class='rounded-md p-4 mb-6'>
			<div class='flex'>
				<div class='flex-shrink-0'>
					{isError.value
						? (
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
						)
						: isVerifying.value
						? (
							<svg
								class='h-5 w-5 text-blue-400 animate-spin'
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
						: (
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
						)}
				</div>
				<div class='ml-3 flex-grow'>
					<p
						class={`text-sm font-medium ${
							isError.value ? 'text-red-800' : isVerifying.value ? 'text-blue-800' : 'text-green-800'
						}`}
					>
						{message.value}
					</p>

					{isError.value && !showResendForm && (
						<div class='mt-4'>
							<button
								type='button'
								onClick={handleShowResendForm}
								class='px-4 py-2 bg-brand-blue hover:bg-brand-green text-white rounded-md transition-colors inline-block'
							>
								Resend Verification Email
							</button>
						</div>
					)}
				</div>
			</div>

			{showResendForm && (
				<div class='mt-6'>
					<h3 class='text-lg font-medium text-gray-900 mb-4'>Request New Verification Email</h3>
					<ManualEmailVerificationForm defaultEmail={userEmail} />
				</div>
			)}
			
			{isError.value && message.value.includes('Account not found') && !showResendForm && (
				<div class='mt-6'>
					<p class='mb-4'>No account found with this verification link.</p>
					<a 
						href='/auth/signup'
						class='px-4 py-2 ml-8 bg-brand-blue hover:bg-brand-green text-white rounded-md transition-colors inline-block'
					>
						Sign up for an account
					</a>
				</div>
			)}
		</div>
	);
}
