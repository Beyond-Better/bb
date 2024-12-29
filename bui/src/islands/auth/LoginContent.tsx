import {  Signal } from '@preact/signals';
import LoginForm from './LoginForm.tsx';
import { BBAppRequirement } from '../../components/auth/BBAppRequirement.tsx';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { AuthState } from '../../types/auth.ts';

interface LoginContentProps {
	authState: Signal<AuthState>;
}

export default function LoginContent({ authState: authStateProp }: LoginContentProps) {
	const { authState } = useAuthState();
	//console.log('LoginContent: authStateProp', authStateProp.value);
	authState.value = authStateProp.value;
	//console.log('LoginContent: authState', authState.value);

	return (
		<div class='min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				<h2 class='mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					Sign in to Beyond Better
				</h2>
				<p class='mt-2 text-center text-sm text-gray-600 dark:text-gray-400'>
					Or{' '}
					<a href='/auth/signup' class='font-medium text-purple-600 hover:text-purple-500'>
						create a new account
					</a>
				</p>
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