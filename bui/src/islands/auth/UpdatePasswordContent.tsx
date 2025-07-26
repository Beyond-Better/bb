import UpdatePasswordForm from './UpdatePasswordForm.tsx';
import { BBAppRequirement } from '../../components/auth/BBAppRequirement.tsx';
import { ExternalLink } from '../../components/ExternalLink.tsx';

export default function UpdatePasswordContent() {
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
						<div class='bg-blue-600 text-white px-5 py-2 font-bold cursor-default'>UPDATE PASSWORD</div>
					</div>
				</div>

				<div class='flex justify-center'>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						class='h-10 w-10 text-blue-600'
						fill='none'
						viewBox='0 0 24 24'
						stroke='currentColor'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							stroke-width='2'
							d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
						/>
					</svg>
				</div>
				<h2 class='mt-2 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					<span class='text-blue-600'>UPDATE PASSWORD</span> for Beyond Better
				</h2>
				<p class='mt-2 text-center text-gray-600 dark:text-gray-400'>
					Choose a strong new password for your account.
				</p>
			</div>

			<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					{/* Update Password Form */}
					<UpdatePasswordForm />

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