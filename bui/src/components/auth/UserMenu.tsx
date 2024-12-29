import { JSX } from 'preact';
import { useAuthState } from '../../hooks/useAuthState.ts';
import { User } from '../../types/auth.ts';

interface UserMenuProps {
	isCollapsed: boolean;
	className?: string;
}

export function UserMenu({ isCollapsed, className = '' }: UserMenuProps): JSX.Element {
	const { authState, signOut } = useAuthState();
	const { user, isLocalMode } = authState.value;
	//console.log('UserMenu: user', user);

	const handleSignOut = async () => {
		//window.location.href = '/auth/logout';

		await signOut(null, null);
		// Redirect to root after sign out
		window.location.href = '/';
	};

	return (
		<div className='space-y-1 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700 w-full'>
			{/* Show user info when not collapsed */}
			{!isCollapsed && user && (
				<div
					className={`flex items-center ${
						isCollapsed ? 'justify-center' : 'justify-start'
					} px-4 py-1.5 text-gray-500 dark:text-gray-400 ${className}`}
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						fill='none'
						viewBox='0 0 24 24'
						strokeWidth={2}
						stroke='currentColor'
						class='w-5 h-5'
					>
						<path
							strokeLinecap='round'
							strokeLinejoin='round'
							d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z'
						/>
					</svg>
					<span className='ml-3 text-sm truncate'>
						{user.email}
					</span>
					{isLocalMode && (
						<span class='ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'>
							Local
						</span>
					)}
				</div>
			)}

			{/* Status Button */}
			<button
				onClick={handleSignOut}
				title='Sign out'
				class={`flex items-center ${
					isCollapsed ? 'justify-center' : 'justify-start'
				} px-4 py-1.5 rounded-md text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700 w-full`}
			>
				<svg
					xmlns='http://www.w3.org/2000/svg'
					fill='none'
					viewBox='0 0 24 24'
					strokeWidth={2}
					stroke='currentColor'
					class='w-5 h-5'
				>
					<path
						strokeLinecap='round'
						strokeLinejoin='round'
						d='M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75'
					/>
				</svg>
				{!isCollapsed && <span class='ml-3'>Sign Out</span>}
			</button>
		</div>
	);
}
