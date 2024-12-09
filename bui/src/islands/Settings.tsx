import { useEffect } from 'preact/hooks';
import { JSX } from 'preact';
type MouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement | HTMLLIElement | HTMLDivElement>;
import { IS_BROWSER } from '$fresh/runtime.ts';
import { PageContainer } from '../components/PageContainer.tsx';

import { useAppState } from '../hooks/useAppState.ts';

interface SettingsProps {
}

export default function Settings(): JSX.Element {
	// Initialize version checking

	const appState = useAppState();

	// 	// Initialize chat configuration
	// 	const apiHostname = getApiHostname();
	// 	const apiPort = getApiPort();
	// 	const apiUseTls = getApiUseTls();

	return (
		<PageContainer>
			<div class='space-y-6 max-w-5xl mx-auto'>
				{/* Settings Grid */}
				<div class='grid grid-cols-1 gap-6 sm:grid-cols-2'>
					{/* Appearance */}
					<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
						<div class='flex items-center space-x-3'>
							<div class='flex-shrink-0'>
								<svg
									class='h-6 w-6 text-gray-600'
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='1.5'
										d='M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z'
									/>
								</svg>
							</div>
							<div>
								<h3 class='text-lg font-medium text-gray-900'>Appearance</h3>
								<p class='mt-1 text-sm text-gray-500'>
									Customize the look and feel of BB
								</p>
							</div>
						</div>
						<span class='absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
							Coming Soon
						</span>
					</div>

					{/* Project Defaults */}
					<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
						<div class='flex items-center space-x-3'>
							<div class='flex-shrink-0'>
								<svg
									class='h-6 w-6 text-gray-600'
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='1.5'
										d='M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z'
									/>
								</svg>
							</div>
							<div>
								<h3 class='text-lg font-medium text-gray-900'>Project Defaults</h3>
								<p class='mt-1 text-sm text-gray-500'>
									Set default behaviors for projects
								</p>
							</div>
						</div>
						<span class='absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
							Coming Soon
						</span>
					</div>

					{/* Notifications */}
					<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
						<div class='flex items-center space-x-3'>
							<div class='flex-shrink-0'>
								<svg
									class='h-6 w-6 text-gray-600'
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='1.5'
										d='M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0'
									/>
								</svg>
							</div>
							<div>
								<h3 class='text-lg font-medium text-gray-900'>Notifications</h3>
								<p class='mt-1 text-sm text-gray-500'>
									Configure notification preferences
								</p>
							</div>
						</div>
						<span class='absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
							Coming Soon
						</span>
					</div>

					{/* Keyboard Shortcuts */}
					<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
						<div class='flex items-center space-x-3'>
							<div class='flex-shrink-0'>
								<svg
									class='h-6 w-6 text-gray-600'
									xmlns='http://www.w3.org/2000/svg'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='1.5'
										d='M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z'
									/>
								</svg>
							</div>
							<div>
								<h3 class='text-lg font-medium text-gray-900'>Keyboard Shortcuts</h3>
								<p class='mt-1 text-sm text-gray-500'>
									Customize keyboard shortcuts
								</p>
							</div>
						</div>
						<span class='absolute top-4 right-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
							Coming Soon
						</span>
					</div>
				</div>

				{/* Additional Info */}
				<div class='bg-gray-50 rounded-lg p-6 mt-6'>
					<h2 class='text-lg font-medium text-gray-900 mb-2'>More Features Coming Soon</h2>
					<p class='text-gray-600'>
						We're working on additional settings and customization options. Stay tuned for updates!
					</p>
				</div>
			</div>
		</PageContainer>
	);
}
