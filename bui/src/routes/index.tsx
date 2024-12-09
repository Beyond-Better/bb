import { PageProps } from '$fresh/server.ts';
import { PageContainer } from '../components/PageContainer.tsx';

export default function Home(props: PageProps) {
	return (
		<div class="flex flex-col flex-1">
			{/* Metadata Bar - empty for home page but maintains consistent layout */}
			<div class="border-b border-gray-200 px-4 py-2">
				<div class="text-sm text-gray-500">Home</div>
			</div>

			{/* Main content */}
			<div class="flex-1 flex flex-col overflow-hidden">
				<PageContainer>
					<div class='space-y-8'>
						{/* Welcome Section */}
						<section class='text-center'>
							<h1 class='text-4xl font-bold text-gray-900 mb-4'>
								Welcome to Beyond Better
							</h1>
							<p class='text-xl text-gray-600 max-w-2xl mx-auto'>
								Enhance your development workflow with AI-powered assistance for code, documentation, and more.
							</p>
						</section>

						{/* Quick Actions */}
						<section class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8'>
							{/* Chat Action */}
							<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
								<h2 class='text-xl font-semibold text-gray-900 mb-2'>Chat</h2>
								<p class='text-gray-600 mb-4'>
									Start a conversation with BB to get help with your code and documentation.
								</p>
								<a
									href='/chat'
									class='inline-flex items-center text-blue-600 hover:text-blue-700'
								>
									Open Chat
									<svg
										class='w-5 h-5 ml-1'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											stroke-linecap='round'
											stroke-linejoin='round'
											stroke-width='2'
											d='M13 7l5 5m0 0l-5 5m5-5H6'
										/>
									</svg>
								</a>
							</div>

							{/* Projects Action */}
							<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
								<h2 class='text-xl font-semibold text-gray-900 mb-2'>Projects</h2>
								<p class='text-gray-600 mb-4'>
									Manage your projects and access project-specific features.
								</p>
								<a
									href='/projects'
									class='inline-flex items-center text-blue-600 hover:text-blue-700'
								>
									View Projects
									<svg
										class='w-5 h-5 ml-1'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											stroke-linecap='round'
											stroke-linejoin='round'
											stroke-width='2'
											d='M13 7l5 5m0 0l-5 5m5-5H6'
										/>
									</svg>
								</a>
							</div>

							{/* Settings Action */}
							<div class='bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow'>
								<h2 class='text-xl font-semibold text-gray-900 mb-2'>Settings</h2>
								<p class='text-gray-600 mb-4'>
									Customize your BB experience and manage preferences.
								</p>
								<a
									href='/settings'
									class='inline-flex items-center text-blue-600 hover:text-blue-700'
								>
									Open Settings
									<svg
										class='w-5 h-5 ml-1'
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										stroke='currentColor'
									>
										<path
											stroke-linecap='round'
											stroke-linejoin='round'
											stroke-width='2'
											d='M13 7l5 5m0 0l-5 5m5-5H6'
										/>
									</svg>
								</a>
							</div>
						</section>

						{/* Getting Started */}
						<section class='mt-12 bg-white rounded-lg shadow-sm p-8'>
							<h2 class='text-2xl font-semibold text-gray-900 mb-4'>
								Getting Started
							</h2>
							<div class='space-y-4'>
								<p class='text-gray-600'>
									BB helps you work more efficiently by providing AI-powered assistance for your development
									tasks. Here's how to get started:
								</p>
								<ol class='list-decimal list-inside space-y-2 text-gray-600'>
									<li>Create or select a project to work with</li>
									<li>Start a chat conversation for assistance</li>
									<li>Use BB's tools to enhance your workflow</li>
									<li>Customize your experience in settings</li>
								</ol>
							</div>
						</section>
					</div>
				</PageContainer>
			</div>
		</div>
	);
}