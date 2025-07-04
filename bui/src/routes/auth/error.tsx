import { PageProps } from '$fresh/server.ts';

interface ErrorPageData {
	message: string;
	code: string;
	action?: {
		text: string;
		href: string;
	};
}

const ERROR_MESSAGES: Record<string, ErrorPageData> = {
	'config_missing': {
		code: 'Auth Configuration Missing',
		message:
			'BB is not configured for authentication. The Supabase configuration is missing and local mode is not enabled.',
		action: {
			text: 'View Documentation',
			href: 'https://www.beyondbetter.app/docs/authentication',
		},
	},
	'auth_failed': {
		code: 'Authentication Failed',
		message: 'Your sign in attempt failed. Please check your credentials and try again.',
		action: {
			text: 'Try Again',
			href: '/auth/login',
		},
	},
	'server_error': {
		code: 'Server Error',
		message: 'An unexpected error occurred with the authentication service.',
		action: {
			text: 'Try Again',
			href: '/auth/login',
		},
	},
	'default': {
		code: 'Authentication Error',
		message: 'An error occurred during authentication.',
		action: {
			text: 'Return Home',
			href: '/',
		},
	},
};

export default function AuthErrorPage(props: PageProps) {
	const errorType = props.url.searchParams.get('type') || 'default';
	const errorData = ERROR_MESSAGES[errorType] || ERROR_MESSAGES.default;

	return (
		<div class='min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8'>
			<div class='sm:mx-auto sm:w-full sm:max-w-md'>
				<div class='text-center'>
					{/* Error Icon */}
					<div class='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900'>
						<svg
							class='h-6 w-6 text-red-600 dark:text-red-200'
							xmlns='http://www.w3.org/2000/svg'
							fill='none'
							viewBox='0 0 24 24'
							stroke-width='1.5'
							stroke='currentColor'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								d='M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z'
							/>
						</svg>
					</div>

					{/* Error Message */}
					<h2 class='mt-6 text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-white'>
						{errorData.code}
					</h2>
					<p class='mt-2 text-center text-sm text-gray-600 dark:text-gray-400'>
						{errorData.message}
					</p>
				</div>
			</div>

			{/* Action Button */}
			{errorData.action && (
				<div class='mt-8 sm:mx-auto sm:w-full sm:max-w-md'>
					<div class='bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10'>
						<div class='text-center'>
							<a
								href={errorData.action.href}
								class='inline-flex items-center rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600'
							>
								{errorData.action.text}
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
