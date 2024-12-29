import { PageProps } from '$fresh/server.ts';

export default function CheckEmailPage(props: PageProps) {
	const email = new URL(props.url).searchParams.get('email') || '';

	return (
		<div class='min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				<h2 class='mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white'>
					Check your email
				</h2>
				<p class='mt-2 text-center text-sm text-gray-600 dark:text-gray-400'>
					We sent a verification link to
				</p>
				<p class='mt-1 text-center text-lg font-medium text-gray-900 dark:text-white'>
					{email}
				</p>
			</div>

			<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
					<div class='space-y-6'>
						<div class='space-y-4'>
							<p class='text-sm text-gray-600 dark:text-gray-400'>
								Click the link in the email to verify your account. If you don't see the email, check your spam folder.
							</p>

							<div class='mt-6 text-center'>
								<a
									href='/auth/login'
									class='text-sm font-medium text-purple-600 hover:text-purple-500'
								>
									Return to login
								</a>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}