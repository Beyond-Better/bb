import { IS_BROWSER } from '$fresh/runtime.ts';
import { useEffect } from 'preact/hooks';
import LoginForm from './LoginForm.tsx';
import { BBAppRequirement } from '../../components/auth/BBAppRequirement.tsx';
import { useAuthState } from '../../hooks/useAuthState.ts';

// interface LoginContentProps {}
// export default function LoginContent(props: LoginContentProps) {
export default function LoginContent() {
	const { authState, getSessionUser } = useAuthState();
	//if (IS_BROWSER) console.log('LandingHero: authState', authState.value);

	useEffect(() => {
		if (!IS_BROWSER) return;

		const checkSession = async () => {
			if (authState.value.isLocalMode) {
				globalThis.location.href = '/app/home';
				return;
			}

			try {
				const { user, error } = await getSessionUser(null, null);
				//console.log('LandingHero: getSessionUser', { user, error });
				if (error || !user) return;

				globalThis.location.href = '/app/home';
				return;
			} catch (error) {
				console.error('Session check failed:', error);
			}
		};

		checkSession();
	}, []);

	return (
		<div class='min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				{/* Login indicator bar */}
				<div class='flex justify-center mb-2'>
					<div class='inline-flex rounded-t-lg overflow-hidden border-b-2'>
						<div class='bg-purple-600 text-white px-5 py-2 font-bold cursor-default'>LOG IN</div>
						<a
							href='/auth/signup'
							class='bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-5 py-2 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
						>
							SIGN UP
						</a>
					</div>
				</div>

				<div class='flex justify-center'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						class='h-10 w-10 text-purple-600'
						fill='none'
						viewBox='0 0 24 24'
						stroke='currentColor'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							stroke-width='2'
							d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'
						/>
					</svg>
				</div>
				<h2 class='mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					<span class='text-purple-600'>LOG IN</span> to Beyond Better
				</h2>
				<p class='mt-2 text-center text-gray-600 dark:text-gray-400'>
					Don't have an account yet?
				</p>
				<div class='flex justify-center mt-2'>
					<a
						href='/auth/signup'
						class='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
					>
						<svg
							xmlns='http://www.w3.org/2000/svg'
							class='h-5 w-5 mr-2'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
							/>
						</svg>
						Create a new account
					</a>
				</div>
			</div>

			<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					{/* Login Form */}
					<LoginForm />

					{/* Divider */}
					<div class='relative mt-6'>
						<div class='absolute inset-0 flex items-center'>
							<div class='w-full border-t border-gray-300 dark:border-gray-600' />
						</div>
						<div class='relative flex justify-center text-sm'>
							<span class='px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'>
								Important Information
							</span>
						</div>
					</div>

					{/* BB App Requirement */}
					<BBAppRequirement />

					{/* Additional Links */}
					<div class='mt-6 text-center text-sm'>
						<span class='text-gray-600 dark:text-gray-400'>
							Need help? Visit our{' '}
							<a
								href='https://www.beyondbetter.dev/docs'
								target='_blank'
								rel='noopener noreferrer'
								class='font-medium text-purple-600 hover:text-purple-500'
							>
								documentation
							</a>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
