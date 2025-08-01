import ForgotPasswordForm from './ForgotPasswordForm.tsx';
import { BBAppRequirement } from '../../components/auth/BBAppRequirement.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';

export default function ForgotPasswordContent() {
	return (
		<div class='py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				{/* Navigation indicator bar */}
				<div class='flex justify-center mb-2'>
					<div class='inline-flex rounded-t-lg overflow-hidden border-b-2'>
						<a
							href='/auth/login'
							class='bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-5 py-2 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
						>
							LOG IN
						</a>
						<div class='bg-orange-600 text-white px-5 py-2 font-bold cursor-default'>RESET PASSWORD</div>
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
						class='h-10 w-10 text-orange-600'
						fill='none'
						viewBox='0 0 24 24'
						stroke='currentColor'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							stroke-width='2'
							d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3.586l4.293-4.293A6 6 0 0119 9z'
						/>
					</svg>
				</div>
				<h2 class='mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					<span class='text-orange-600'>RESET PASSWORD</span> for Beyond Better
				</h2>
				<p class='mt-2 text-center text-gray-600 dark:text-gray-400'>
					Forgot your password? We'll help you reset it.
				</p>
				<div class='flex justify-center mt-2'>
					<a
						href='/auth/login'
						class='inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
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
								d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'
							/>
						</svg>
						Back to login
					</a>
				</div>
			</div>

			<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					{/* Reset Password Form */}
					<ForgotPasswordForm />

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
							<ExternalLink
								href='https://www.beyondbetter.app/docs'
								class='font-medium text-purple-600 hover:text-purple-500'
							>
								documentation
							</ExternalLink>
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
