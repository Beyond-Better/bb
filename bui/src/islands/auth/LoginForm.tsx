//import { IS_BROWSER } from '$fresh/runtime.ts';
import { useSignal } from '@preact/signals';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { errorMessage, errorName } from 'shared/error.ts';
import { ExternalLink } from '../../components/ExternalLink.tsx';

export default function LoginForm() {
	const email = useSignal('');
	const password = useSignal('');
	const loginError = useSignal('');
	const rememberMe = useSignal(false);
	const isSubmitting = useSignal(false);
	const { signIn } = useAuthState();

	const handleSubmit = async (e: Event) => {
		e.preventDefault();

		//console.log('LoginForm: submitting form', email.value, password.value);
		if (isSubmitting.value) return;

		isSubmitting.value = true;
		try {
			const data = await signIn(null, null, email.value, password.value);
			//console.log('LoginForm: data[after signIn]', data);

			if (data.session && data.user) {
				// Handle successful login
				// Get redirectTo from URL parameters
				const urlParams = new URLSearchParams(globalThis.location.search);
				const redirectTo = urlParams.get('redirect') || '/app/home';
				globalThis.location.href = redirectTo;
			} else {
				if (data.error === 'Failed to fetch' || data.error === 'Load failed') {
					loginError.value =
						'Connection to BB Server failed. Please ensure the BB Server is running. Check the BB Desktop App and click the toggle to start the server.';
				} else if (data.error?.includes('status: 401')) {
					loginError.value = 'Authentication error. Please check your credentials.';
				} else {
					//loginError.value = `Login error: ${data.error} || 'Unknown error occurred'}`;
					loginError.value = data.error || 'Unknown authentication error. Please check your credentials.';
				}
			}
		} catch (error) {
			// Specific error handling for connection issues
			if (
				errorMessage(error) === 'Failed to fetch' || errorMessage(error) === 'Load failed' ||
				errorName(error) === 'TypeError'
			) {
				loginError.value =
					'Connection to BB Server failed. Please ensure the BB Server is running. Check the BB Desktop App and click the toggle to start the server.';
			} else if (errorMessage(error).includes('status: 401')) {
				loginError.value = 'Authentication error. Please check your credentials.';
			} else {
				loginError.value = `Login error: ${errorMessage(error) || 'Unknown error occurred'}`;
			}
		} finally {
			isSubmitting.value = false;
		}
	};

	return (
		<form method='post' class='space-y-6' onSubmit={handleSubmit}>
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
						autoComplete='current-password'
						required
						class='appearance-none block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm dark:bg-gray-700 dark:text-white'
						value={password.value}
						onInput={(e) => password.value = (e.target as HTMLInputElement).value}
					/>
				</div>
			</div>

			{/* Remember me and Forgot password */}
			<div class='flex items-center justify-between'>
				<div class='flex items-center'>
					<input
						id='remember-me'
						name='remember-me'
						type='checkbox'
						class='h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded'
						checked={rememberMe.value}
						onChange={(e) => rememberMe.value = (e.target as HTMLInputElement).checked}
					/>
					<label
						htmlFor='remember-me'
						class='ml-2 block text-sm text-gray-900 dark:text-gray-300'
					>
						Remember me
					</label>
				</div>

				<div class='text-sm'>
					<a
						href='/auth/forgot-password'
						class='font-medium text-purple-600 hover:text-purple-500'
					>
						Forgot your password?
					</a>
				</div>
			</div>

			{/* Error display */}
			{loginError.value && (
				<div class='rounded-md bg-red-50 dark:bg-red-900/50 p-4'>
					<div class='flex'>
						<div class='flex-shrink-0'>
							{/* Heroicon name: mini/x-circle */}
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
								{loginError.value}
							</h3>
							{loginError.value.includes('BB Server') && (
								<p class='mt-2 text-sm text-red-700 dark:text-red-300'>
									Need help?{' '}
									<ExternalLink
										href='https://www.beyondbetter.app/docs/install'
										class='font-medium underline'
									>
										View troubleshooting guide
									</ExternalLink>
								</p>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Submit button */}
			<div>
				<button
					type='submit'
					disabled={isSubmitting.value}
					class={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
						isSubmitting.value ? 'opacity-75 cursor-not-allowed' : ''
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
					Sign in
				</button>
			</div>
		</form>
	);
}
