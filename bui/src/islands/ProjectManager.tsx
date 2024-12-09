import { useEffect } from 'preact/hooks';
import { JSX } from 'preact';
type MouseEvent = JSX.TargetedMouseEvent<HTMLButtonElement | HTMLLIElement | HTMLDivElement>;
import { IS_BROWSER } from '$fresh/runtime.ts';
import { PageContainer } from '../components/PageContainer.tsx';

import { useAppState } from '../hooks/useAppState.ts';

interface ProjectManagerProps {
}

export default function ProjectManager(): JSX.Element {
	// Initialize version checking

	const appState = useAppState();

	// 	// Initialize chat configuration
	// 	const apiHostname = getApiHostname();
	// 	const apiPort = getApiPort();
	// 	const apiUseTls = getApiUseTls();

	return (
		<PageContainer>
			<div class='space-y-6 max-w-5xl mx-auto'>
				{/* Header */}
				<div class='border-b border-gray-200 pb-4'>
					<h1 class='text-2xl font-semibold text-gray-900'>Projects</h1>
					<p class='mt-1 text-gray-500'>
						Manage your projects and access project-specific features.
					</p>
				</div>

				{/* Placeholder content */}
				<div class='bg-white shadow-sm rounded-lg p-6'>
					<div class='text-center py-12'>
						<svg
							class='mx-auto h-12 w-12 text-gray-400'
							fill='none'
							viewBox='0 0 24 24'
							stroke='currentColor'
							aria-hidden='true'
						>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4'
							/>
						</svg>
						<h3 class='mt-2 text-sm font-medium text-gray-900'>No projects</h3>
						<p class='mt-1 text-sm text-gray-500'>
							Get started by creating a new project.
						</p>
						<div class='mt-6'>
							<button
								type='button'
								class='inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
							>
								<svg
									class='-ml-1 mr-2 h-5 w-5'
									xmlns='http://www.w3.org/2000/svg'
									viewBox='0 0 20 20'
									fill='currentColor'
									aria-hidden='true'
								>
									<path
										fill-rule='evenodd'
										d='M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z'
										clip-rule='evenodd'
									/>
								</svg>
								New Project
							</button>
						</div>
					</div>
				</div>

				{/* Coming Soon Section */}
				<div class='bg-gray-50 rounded-lg p-6 mt-6'>
					<h2 class='text-lg font-medium text-gray-900 mb-2'>Coming Soon</h2>
					<ul class='list-disc list-inside text-gray-600 space-y-1'>
						<li>Project templates</li>
						<li>Google Docs integration</li>
						<li>Notion integration</li>
						<li>Team collaboration features</li>
					</ul>
				</div>
			</div>
		</PageContainer>
	);
}
