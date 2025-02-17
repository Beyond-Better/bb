import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import type { EmailOtpType } from '@supabase/supabase-js';
import { useAuthState } from '../../hooks/useAuthState.ts';
//import { AuthState } from '../../types/auth.ts';

// interface VerifyContentProps {}
// export default function VerifyContent(_props: VerifyContentProps) {
export default function VerifyContent() {
	const { verifyOtp } = useAuthState();

	const isError = useSignal(false);
	const isVerifying = useSignal(false);
	const successMessage = useSignal('');

	useEffect(() => {
		const handleVerification = async () => {
			console.log('VerifyEmail');

			const { searchParams } = new URL(globalThis.location.href);
			//const code = searchParams.get('code');
			const tokenHash = searchParams.get('token_hash');
			const type = searchParams.get('type') as EmailOtpType;
			const next = searchParams.get('next') ?? '/app/home';

			try {
				if (tokenHash && type) {
					console.log('VerifyEmail: ', tokenHash, type);
					const data = await verifyOtp(null, null, tokenHash, type);
					console.log('VerifyEmail: data[after getUser]', data);

					if (data.error) {
						isVerifying.value = false;
						isError.value = true;
						successMessage.value = `Failed to verify email: ${data.error}`;
					}
					if (data.user) {
						isVerifying.value = false;
						successMessage.value = 'Email verified successfully! Redirecting...';
						// Redirect after a short delay
						setTimeout(() => {
							globalThis.location.href = next;
						}, 2000);
					}
				} else {
					isVerifying.value = false;
					isError.value = true;
					successMessage.value = `No token_hash or type found in URL`;
				}
			} catch (error) {
				console.error('Verification error:', error);
				isVerifying.value = false;
				isError.value = true;
				successMessage.value = error instanceof Error ? error.message : 'Failed to verify email';
			}
		};

		handleVerification();
	}, []); // Only run once on mount

	return (
		<div class='min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				<h2 class='mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					Email Verification
				</h2>
			</div>

			<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					{/* Status Message */}
					<div
						class={`rounded-md p-4 ${
							isError.value
								? 'bg-red-50 dark:bg-red-900/50'
								: successMessage.value
								? 'bg-green-50 dark:bg-green-900/50'
								: 'bg-blue-50 dark:bg-blue-900/50'
						}`}
					>
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
									: successMessage.value
									? (
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
									)
									: (
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
									)}
							</div>
							<div class='ml-3'>
								<p
									class={`text-sm font-medium ${
										isError.value
											? 'text-red-800 dark:text-red-200'
											: successMessage.value
											? 'text-green-800 dark:text-green-200'
											: 'text-blue-800 dark:text-blue-200'
									}`}
								>
									{successMessage.value}
								</p>
							</div>
						</div>
					</div>

					{/* Error actions */}
					{isError.value && (
						<div class='mt-6'>
							<div class='space-y-4'>
								<p class='text-sm text-gray-600 dark:text-gray-400'>
									Please try:
								</p>
								<ul class='list-disc pl-5 text-sm text-gray-600 dark:text-gray-400'>
									<li>Clicking the verification link in your email again</li>
									<li>
										<a
											href='/auth/login'
											class='text-purple-600 hover:text-purple-500'
										>
											Going back to login
										</a>
									</li>
									<li>Requesting a new verification email</li>
								</ul>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
