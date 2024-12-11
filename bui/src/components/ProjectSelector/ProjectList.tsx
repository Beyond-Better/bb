import type { Project } from '../../hooks/useProjectState.ts';

interface ProjectListProps {
	projects: Project[];
	selectedIndex: number;
	currentProjectId: string | null;
	loading: boolean;
	error: string | null;
	onSelect: (project: Project) => void;
}

export function ProjectList({
	projects,
	selectedIndex,
	currentProjectId,
	loading,
	error,
	onSelect,
}: ProjectListProps) {
	if (loading) {
		return (
			<div className='p-4'>
				<div className='animate-pulse flex space-x-4'>
					<div className='flex-1 space-y-4 py-1'>
						<div className='h-4 bg-gray-200 rounded w-3/4'></div>
						<div className='space-y-2'>
							<div className='h-4 bg-gray-200 rounded'></div>
							<div className='h-4 bg-gray-200 rounded w-5/6'></div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-4 text-red-600'>
				<p>Error loading projects:</p>
				<p className='text-sm'>{error}</p>
			</div>
		);
	}

	if (projects.length === 0) {
		return (
			<div className='p-4 text-gray-500 text-center'>
				<p>No projects found</p>
				<a
					href='/projects/new'
					className='mt-2 inline-block text-sm text-blue-600 hover:text-blue-800'
				>
					Create a new project
				</a>
			</div>
		);
	}

	return (
		<div className='max-h-96 overflow-y-auto'>
			<div className='p-2 sticky top-0 bg-white border-b border-gray-100'>
				<h3 className='text-sm font-medium text-gray-700'>Select Project</h3>
			</div>
			<ul className='py-2'>
				{projects.map((project, index) => (
					<li
						key={project.projectId}
						className={`px-4 py-2 cursor-pointer ${index === selectedIndex ? 'bg-gray-100' : ''} ${
							project.projectId === currentProjectId ? 'text-blue-600' : 'text-gray-900'
						} hover:bg-gray-50`}
						onClick={() => onSelect(project)}
					>
						<div className='flex flex-col space-y-2'>
							<div className='flex items-start space-x-3'>
								{/* Project Icon based on type */}
								<div className='flex-shrink-0 mt-1'>
									{project.type === 'local'
										? (
											<svg
												xmlns='http://www.w3.org/2000/svg'
												className='h-5 w-5 text-gray-400'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z'
												/>
											</svg>
										)
										: (
											<svg
												xmlns='http://www.w3.org/2000/svg'
												className='h-5 w-5 text-gray-400'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
												/>
											</svg>
										)}
								</div>

								{/* Project Info */}
								<div className='flex-1 min-w-0'>
									<div className='flex items-center justify-between'>
										<p className='text-sm font-medium truncate'>
											{project.name}
										</p>
										<p className='text-xs text-gray-500'>
											{project.type}
										</p>
									</div>
									<p className='text-xs text-gray-500 truncate'>
										{project.path}
									</p>
								</div>
							</div>

							{/* Project Stats */}
							{project.stats && (
								<div className='flex space-x-4 text-xs text-gray-500 pl-8'>
									<div className='flex items-center'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-4 w-4 mr-1'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
											/>
										</svg>
										{project.stats.conversationCount}{' '}
										{project.stats.conversationCount === 1 ? 'conversation' : 'conversations'}
									</div>
									<div className='flex items-center'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											className='h-4 w-4 mr-1'
											fill='none'
											viewBox='0 0 24 24'
											stroke='currentColor'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z'
											/>
										</svg>
										{project.stats.totalTokens.toLocaleString()} tokens
									</div>
									{project.stats.lastAccessed && (
										<div className='flex items-center'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												className='h-4 w-4 mr-1'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={1.5}
													d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
												/>
											</svg>
											Last used: {new Date(project.stats.lastAccessed).toLocaleDateString()}
										</div>
									)}
								</div>
							)}
						</div>
					</li>
				))}
			</ul>

			{/* Quick Actions */}
			<div className='p-2 border-t border-gray-100'>
				<div className='flex justify-between'>
					<a
						href='/projects'
						className='text-xs text-gray-600 hover:text-gray-900'
					>
						Manage Projects
					</a>
					<a
						href='/projects/new'
						className='text-xs text-blue-600 hover:text-blue-800'
					>
						New Project
					</a>
				</div>
			</div>
		</div>
	);
}
