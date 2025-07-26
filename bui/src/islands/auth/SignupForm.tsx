//import { IS_BROWSER } from '$fresh/runtime.ts';
import { useComputed, useSignal } from '@preact/signals';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { errorMessage, errorName } from 'shared/error.ts';
import { ExternalLink } from '../../components/ExternalLink.tsx';

interface PasswordRequirement {
	label: string;
	test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
	{
		label: 'At least 6 characters long',
		test: (password) => password.length >= 6,
	},
	{
		label: 'At least one lowercase letter (a-z)',
		test: (password) => /[a-z]/.test(password),
	},
	{
		label: 'At least one uppercase letter (A-Z)',
		test: (password) => /[A-Z]/.test(password),
	},
	{
		label: 'At least one number (0-9)',
		test: (password) => /[0-9]/.test(password),
	},
	{
		label: 'At least one special character (!@#$%^&*()_+-=[]{};\'"|<>?,./`~)',
		test: (password) => /[!@#$%^&*()_+\-=\[\]{};':"|,.<>/?`~]/.test(password),
	},
];

export default function SignupForm() {
	const { signUp } = useAuthState();
	const firstName = useSignal('');
	const lastName = useSignal('');
	const email = useSignal('');
	const password = useSignal('');
	const confirmPassword = useSignal('');
	const acceptedTerms = useSignal(false);
	const marketingConsent = useSignal(false);
	const isSubmitting = useSignal(false);
	const successMessage = useSignal('');
	const signupError = useSignal('');
	const validationError = useSignal('');
	const showRequirements = useSignal(false);
	const cantSubmit = useComputed(() =>
		!!isSubmitting.value || firstName.value === '' || password.value === '' ||
		password.value !== confirmPassword.value || !acceptedTerms.value
	);

	const validateForm = () => {
		if (password.value !== confirmPassword.value) {
			validationError.value = 'Passwords do not match';
			return false;
		}

		const failedRequirements = PASSWORD_REQUIREMENTS.filter(
			(req) => !req.test(password.value),
		);

		if (failedRequirements.length > 0) {
			validationError.value = 'Password does not meet all requirements';
			return false;
		}

		validationError.value = '';
		return true;
	};

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		if (isSubmitting.value) return;
		if (!validateForm()) return false;

		try {
			isSubmitting.value = true;
			const data = await signUp(
				null,
				null,
				email.value,
				password.value,
				firstName.value,
				lastName.value,
				marketingConsent.value,
				acceptedTerms.value,
			);
			//console.log('SignupForm: data[after signUp]', data);

			//if (data.session && data.user) {
			if (data.user) {
				// Handle successful signup
				// Redirect to check-email page
				globalThis.location.href = `/auth/check-email?email=${encodeURIComponent(email.value)}`;
			} else {
				if (data.error === 'Failed to fetch' || data.error === 'Load failed') {
					signupError.value =
						"⚠️ BB App Required: The BB Desktop App must be installed and running to sign up. This is not optional - it's required for BB to work properly.";
				} else {
					signupError.value = data.error || 'Unknown signup error occurred.';
				}
			}
		} catch (error) {
			// Specific error handling for connection issues
			if (
				errorMessage(error) === 'Failed to fetch' || errorMessage(error) === 'Load failed' ||
				errorName(error) === 'TypeError'
			) {
				signupError.value =
					"⚠️ BB App Required: The BB Desktop App must be installed and running to sign up. This is not optional - it's required for BB to work properly.";
			} else {
				signupError.value = `Signup failed: ${errorMessage(error) || 'Unknown error occurred'}`;
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

			{/* Validation Error */}
			{validationError.value && (
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
								{validationError.value}
							</h3>
						</div>
					</div>
				</div>
			)}

			{/* Error from auth state */}
			{signupError.value && !validationError.value && (
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
								{signupError.value}
							</h3>
							{(signupError.value.includes('BB Server') ||
								signupError.value.includes('BB App Required')) && (
								<div class='mt-3 space-y-2'>
									<div class='text-sm text-red-700 dark:text-red-300'>
										<p class='font-medium mb-1'>To fix this:</p>
										<ol class='list-decimal list-inside space-y-1 text-xs'>
											<li>Download and install the BB Desktop App (see below)</li>
											<li>Launch the BB Desktop App</li>
											<li>Ensure the server toggle is enabled (green)</li>
											<li>Try signing up again</li>
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

			{/* Name fields (first and last) */}
			<div>
				<div class='grid grid-cols-2 gap-4'>
					<div>
						<label
							htmlFor='firstName'
							class='block text-sm font-medium text-gray-700 dark:text-gray-200'
						>
							First Name <span class='text-red-500'>*</span>
						</label>
						<div class='mt-1'>
							<input
								id='firstName'
								name='firstName'
								type='text'
								autoComplete='given-name'
								required
								class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
								value={firstName.value}
								onInput={(e) => firstName.value = (e.target as HTMLInputElement).value}
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor='lastName'
							class='block text-sm font-medium text-gray-700 dark:text-gray-200'
						>
							Last Name <span class='text-gray-400'>(optional)</span>
						</label>
						<div class='mt-1'>
							<input
								id='lastName'
								name='lastName'
								type='text'
								autoComplete='family-name'
								class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
								value={lastName.value}
								onInput={(e) => lastName.value = (e.target as HTMLInputElement).value}
							/>
						</div>
					</div>
				</div>
			</div>

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
					/>
				</div>
			</div>

			{/* Password field */}
			<div>
				<label
					htmlFor='password'
					class='block text-sm font-medium text-gray-700 dark:text-gray-200'
				>
					Password
				</label>
				<div class='mt-1'>
					<input
						id='password'
						name='password'
						type='password'
						autoComplete='new-password'
						required
						class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
						value={password.value}
						onInput={(e) => password.value = (e.target as HTMLInputElement).value}
						onFocus={() => showRequirements.value = true}
					/>
				</div>
				{/* Password requirements checklist */}
				{showRequirements.value && (
					<div class='mt-2 space-y-2'>
						<p class='text-sm font-medium text-gray-700 dark:text-gray-300'>
							Password requirements:
						</p>
						<ul class='space-y-1'>
							{PASSWORD_REQUIREMENTS.map((req) => {
								const isMet = req.test(password.value);
								return (
									<li class='flex items-center text-sm'>
										{isMet
											? (
												<svg
													class='h-4 w-4 text-green-500 mr-2'
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
													class='h-4 w-4 text-gray-300 dark:text-gray-600 mr-2'
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
											)}
										<span
											class={`${
												isMet
													? 'text-gray-700 dark:text-gray-300'
													: 'text-gray-500 dark:text-gray-400'
											}`}
										>
											{req.label}
										</span>
									</li>
								);
							})}
						</ul>
					</div>
				)}
			</div>

			{/* Confirm Password field */}
			<div>
				<label
					htmlFor='confirm-password'
					class='block text-sm font-medium text-gray-700 dark:text-gray-200'
				>
					Confirm Password
				</label>
				<div class='mt-1'>
					<input
						id='confirm-password'
						name='confirm-password'
						type='password'
						autoComplete='new-password'
						required
						class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
						value={confirmPassword.value}
						onInput={(e) => confirmPassword.value = (e.target as HTMLInputElement).value}
					/>
				</div>
			</div>

			{/* Terms & Conditions Checkbox */}
			<div class='mt-4'>
				<div class='flex items-start'>
					<div class='flex items-center h-5'>
						<input
							id='terms'
							name='terms'
							type='checkbox'
							required
							class='h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700'
							checked={acceptedTerms.value}
							onChange={(e) => acceptedTerms.value = (e.target as HTMLInputElement).checked}
						/>
					</div>
					<div class='ml-3 text-sm'>
						<label htmlFor='terms' class='font-medium text-gray-700 dark:text-gray-200'>
							I agree to the{' '}
							<ExternalLink
								href='https://beyondbetter.app/terms-and-conditions'
								class='text-purple-600 hover:text-purple-500'
							>
								Terms and Conditions
							</ExternalLink>{' '}
							and{' '}
							<ExternalLink
								href='https://beyondbetter.app/privacy-policy'
								class='text-purple-600 hover:text-purple-500'
							>
								Privacy Policy
							</ExternalLink>
						</label>
					</div>
				</div>
			</div>

			{/* Marketing Consent Checkbox */}
			<div class='mt-4'>
				<div class='flex items-start'>
					<div class='flex items-center h-5'>
						<input
							id='marketing'
							name='marketing'
							type='checkbox'
							class='h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded dark:border-gray-600 dark:bg-gray-700'
							checked={marketingConsent.value}
							onChange={(e) => marketingConsent.value = (e.target as HTMLInputElement).checked}
						/>
					</div>
					<div class='ml-3 text-sm'>
						<label htmlFor='marketing' class='font-medium text-gray-700 dark:text-gray-200'>
							Keep me updated with BB news, tips and features
						</label>
					</div>
				</div>
			</div>

			{/* Submit button */}
			<div>
				<button
					type='submit'
					disabled={cantSubmit.value || !!successMessage.value}
					class={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600  ${
						(cantSubmit.value || !!successMessage.value)
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
					{successMessage.value ? 'Sign up complete' : 'Sign up'}
				</button>
			</div>
		</form>
	);
}
