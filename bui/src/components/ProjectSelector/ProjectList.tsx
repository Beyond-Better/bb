import { useState } from 'preact/hooks';
import type { ClientProjectWithConfigSources } from 'shared/types/project.ts';
import { setPath } from '../../hooks/useAppState.ts';
import { DataSourceSummary } from '../DataSourceSummary.tsx';

interface ProjectListProps {
	projects: ClientProjectWithConfigSources[];
	selectedIndex: number;
	currentProjectId: string | null;
	loading: boolean;
	error: string | null;
	onSelect: (project: ClientProjectWithConfigSources) => void;
}

export function ProjectList({
	projects,
	selectedIndex,
	currentProjectId,
	loading,
	error,
	onSelect,
}: ProjectListProps) {
	const [statusFilter //, setStatusFilter
	] = useState<string | null>('active');
	if (loading) {
		return (
			<div className='p-4'>
				<div className='animate-pulse flex space-x-4'>
					<div className='flex-1 space-y-4 py-1'>
						<div className='h-4 bg-gray-200 dark:bg-gray-700 dark:bg-gray-700 rounded w-3/4'></div>
						<div className='space-y-2'>
							<div className='h-4 bg-gray-200 dark:bg-gray-700 rounded'></div>
							<div className='h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6'></div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className='p-4 text-red-600 dark:text-red-400'>
				<p>Error loading projects:</p>
				<p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
			</div>
		);
	}

	if (projects.length === 0) {
		return (
			<div className='p-4 text-center text-gray-500 dark:text-gray-400 text-sm'>
				<p>No projects found</p>
				<a
					href='/app/projects?new=true'
					f-partial='/app/projects/partial?new=true'
					onClick={(_e) => {
						setPath('/app/projects');
					}}
					className='mt-2 inline-block text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
				>
					Create a new project
				</a>
			</div>
		);
	}
	const filteredProjects = statusFilter ? projects.filter((p) => p.data.status === statusFilter) : projects;

	return (
		<ul className='max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700'>
			{
				/*<div className='flex justify-between items-center'>
				<span className='px-2 text-xs text-gray-600 dark:text-gray-400'>Filter:</span>
				<div className='flex space-x-2'>
					<button
						type='button'
						onClick={() => setStatusFilter(null)}
						className={`px-2 py-1 text-xs rounded ${
							statusFilter === null ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'
						}`}
					>
						All
					</button>
					<button
						type='button'
						onClick={() => setStatusFilter('active')}
						className={`px-2 py-1 text-xs rounded ${
							statusFilter === 'active' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'
						}`}
					>
						Active
					</button>
					<button
						type='button'
						onClick={() => setStatusFilter('draft')}
						className={`px-2 py-1 text-xs rounded ${
							statusFilter === 'draft' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400'
						}`}
					>
						Draft
					</button>
				</div>
			</div>*/
			}
			{/* Quick Actions */}
			<li className='px-4 py-2 border-t border-gray-200 dark:border-gray-700'>
				<div className='flex justify-between'>
					<a
						href='/app/projects'
						f-partial='/app/projects/partial'
						onClick={(_e) => {
							setPath('/app/projects');
						}}
						className='text-xs text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
					>
						Manage Projects
					</a>
					{
						/* // [TODO] /app/projects?new=true doesn’t create a new project - need to call `handleCreateNew`
					<a
						href='/app/projects?new=true'
						f-partial='/app/projects/partial?new=true'
						onClick={(_e) => {
							setPath('/app/projects');
						}}
						className='text-xs text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300'
					>
						New Project
					</a>*/
					}
				</div>
			</li>

			{filteredProjects.map((project, index) => (
				<li
					key={project.data.projectId}
					className={`px-4 py-2 cursor-pointer group ${
						index === selectedIndex
							? 'bg-gray-100 dark:bg-gray-700'
							: 'hover:bg-gray-50 dark:hover:bg-gray-700'
					} ${
						project.data.projectId === currentProjectId
							? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-50 dark:hover:bg-blue-900/30'
							: ''
					}`}
					onClick={() => onSelect(project)}
				>
					<div className='flex justify-between items-start'>
						<div className='flex-1 min-w-0'>
							{/* Title and Type */}
							<div className='flex justify-between items-start mb-1'>
								<h3
									className='text-sm font-medium text-gray-900 dark:text-gray-100 truncate'
									title={project.data.name}
								>
									{project.data.name}
								</h3>
							</div>

							{/* Data Source Summary */}
							<div className='text-xs text-gray-500 dark:text-gray-400 truncate mb-2'>
								<DataSourceSummary project={project} className='max-w-full' />
							</div>

							{/* Stats Row */}
							<div className='flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400'>
								{/* Data Source Count */}
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
											d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4'
										/>
									</svg>
									{project.data.dsConnections.length}{' '}
									data source{project.data.dsConnections.length !== 1 ? 's' : ''}
								</span>

								{/* Token Limit */}
								{project.data.repoInfo?.tokenLimit && (
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
										{project.data.repoInfo.tokenLimit.toLocaleString()} token limit
									</span>
								)}
							</div>
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}
