import type { Project } from '../../hooks/useProjectState.ts';
import { setPath } from '../../hooks/useAppState.ts';

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
			<div className='p-4 text-center text-gray-500 text-sm'>
				<p>No projects found</p>
				<a
					href='/projects?new=true'
					onClick={(e) => {
						setPath('/projects');
					}}
					className='mt-2 inline-block text-sm text-blue-600 hover:text-blue-900'
				>
					Create a new project
				</a>
			</div>
		);
	}

	return (
		<ul className='max-h-96 overflow-y-auto divide-y divide-gray-100'>
			{/* Quick Actions */}
			<li className='px-4 py-2 border-t border-gray-200'>
				<div className='flex justify-between'>
					<a
						href='/projects'
						onClick={(e) => {
							setPath('/projects');
						}}
						className='text-xs text-blue-600 hover:text-blue-900'
					>
						Manage Projects
					</a>
					<a
						href='/projects?new=true'
						onClick={(e) => {
							setPath('/projects');
						}}
						className='text-xs text-blue-600 hover:text-blue-900'
					>
						New Project
					</a>
				</div>
			</li>

			{projects.map((project, index) => (
				<li
					key={project.projectId}
					className={`px-4 py-2 cursor-pointer group ${
						index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
					} ${project.projectId === currentProjectId ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
					onClick={() => onSelect(project)}
				>
					<div className='flex justify-between items-start'>
						<div className='flex-1 min-w-0'>
							{/* Title and Path */}
							<div className='flex justify-between items-start mb-1'>
								<h3
									className='text-sm font-medium text-gray-900 truncate'
									title={project.name}
								>
									{project.name}
								</h3>
								<span className='text-xs text-gray-500 ml-2'>
									{project.type}
								</span>
							</div>

							{/* Path */}
							<p className='text-xs text-gray-500 truncate mb-2' title={project.path}>
								{project.path}
							</p>

							{/* Stats Row */}
							{project.stats && (
								<div className='flex items-center gap-1 text-xs text-gray-500'>
									{/* Conversation Count */}
									<span className='flex items-center gap-1'>
										<svg
											className='w-4 h-4 mr-1'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z'
											/>
										</svg>
										{project.stats.conversationCount} conversations
									</span>

									{/* Token Count */}
									<span className='flex items-center gap-1'>
										<svg
											className='w-4 h-4 mr-1'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z'
											/>
										</svg>
										{project.stats.totalTokens.toLocaleString()} tokens
									</span>

									{/* Last Used */}
									{project.stats.lastAccessed && (
										<span className='text-xs text-gray-500 ml-2 whitespace-nowrap'>
											{new Date(project.stats.lastAccessed).toLocaleDateString(undefined, {
												month: 'short',
												day: 'numeric',
												hour: 'numeric',
												minute: '2-digit',
											})}
										</span>
									)}
								</div>
							)}
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}
