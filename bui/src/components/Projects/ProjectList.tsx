import { Signal } from '@preact/signals';
import { setPath } from '../../hooks/useAppState.ts';
import { ClientProjectWithConfigSources } from 'shared/types/project.ts';
import type { ProjectId } from 'shared/types.ts';

//import { formatPathForDisplay } from '../../utils/path.utils.ts';
//import { useAppState } from '../../hooks/useAppState.ts';
import { DataSourceSummary } from '../DataSourceSummary.tsx';

interface ProjectListProps {
	projectsWithSources: Signal<ClientProjectWithConfigSources[]>;
	setSelectedProject: (projectId: ProjectId | null) => void;
	handleEdit: (projectId: ProjectId) => void;
	handleDelete: (projectId: ProjectId) => void;
}

export function ProjectList({
	projectsWithSources,
	setSelectedProject,
	handleEdit,
	handleDelete,
}: ProjectListProps) {
	//const appState = useAppState();
	return (
		<div className='w-full space-y-3 min-w-0'>
			<div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4'>
				{projectsWithSources.value.map((projectWithSources: ClientProjectWithConfigSources) => (
					<div
						key={projectWithSources.data.projectId}
						className='bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-4'
					>
						<div className='flex items-center justify-between'>
							<div className='flex-grow min-w-0'>
								<a
									href='/app/chat'
									f-partial='/app/chat/partial'
									className='block'
									onClick={(_e) => {
										setPath('/app/chat');
										setSelectedProject(projectWithSources.data.projectId);
									}}
								>
									<h3 className='text-lg font-medium text-gray-900 dark:text-gray-100 truncate'>
										{projectWithSources.data.name}
										{projectWithSources.data.status &&
											projectWithSources.data.status !== 'active' && (
											<span
												className={`ml-6 px-2 py-0.5 text-xs rounded-full ${
													projectWithSources.data.status === 'draft'
														? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
														: projectWithSources.data.status === 'archived'
														? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
														: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
												}`}
											>
												{projectWithSources.data.status.charAt(0).toUpperCase() +
													projectWithSources.data.status.slice(1)}
											</span>
										)}
									</h3>
									<div className='mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-4'>
										<span className='truncate flex items-center'>
											<DataSourceSummary
												project={projectWithSources}
												showAdditionalCount
												className='truncate'
											/>
										</span>
									</div>
								</a>
							</div>
							<div className='flex items-center space-x-2 ml-4'>
								<button
									type='button'
									onClick={(e) => {
										e.stopPropagation();
										handleEdit(projectWithSources.data.projectId);
									}}
									className='p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/50 transition-colors duration-200'
									title='Edit project'
								>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										strokeWidth={1.5}
										stroke='currentColor'
										className='w-5 h-5'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10'
										/>
									</svg>
								</button>
								<button
									type='button'
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(projectWithSources.data.projectId);
									}}
									className='p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors duration-200'
									title='Delete project'
								>
									<svg
										xmlns='http://www.w3.org/2000/svg'
										fill='none'
										viewBox='0 0 24 24'
										strokeWidth={1.5}
										stroke='currentColor'
										className='w-5 h-5'
									>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											d='M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0'
										/>
									</svg>
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
