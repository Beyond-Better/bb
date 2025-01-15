import { useComputed, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { setPath } from '../hooks/useAppState.ts';
import { ProjectEditor } from '../components/ProjectEditor.tsx';
import { FileBrowser } from '../components/FileBrowser.tsx';
import { useAppState } from '../hooks/useAppState.ts';
import { Project, useProjectState } from '../hooks/useProjectState.ts';

export default function ProjectManager() {
	const appState = useAppState();

	const {
		state: projectState,
		loadProjects,
		createProject,
		updateProject,
		deleteProject,
		setSelectedProject,
		findV1Projects,
		migrateAndAddProject,
	} = useProjectState(appState);

	const showEditor = useSignal(false);
	const editingProject = useSignal<Project | undefined>(undefined);
	const loading = useComputed(() => projectState.value.loading);
	const error = useComputed(() => projectState.value.error);
	const projects = useComputed(() => projectState.value.projects);
	const findingProjects = useSignal(false);
	const foundProjects = useSignal<string[]>([]);
	const searchDirectory = useSignal('');
	const isDirectoryValid = useSignal(false);

	useEffect(() => {
		// Check URL parameters for new project flag
		const params = new URLSearchParams(globalThis.location.search);
		if (params.get('new') === 'true') {
			showEditor.value = true;
			editingProject.value = undefined;
		}

		loadProjects();
	}, []);

	const handleCreateNew = () => {
		editingProject.value = undefined;
		showEditor.value = true;
	};

	const handleEdit = (project: Project) => {
		editingProject.value = project;
		showEditor.value = true;
	};

	const handleDelete = async (project: Project) => {
		if (confirm(`Are you sure you want to delete project "${project.name}"?`)) {
			await deleteProject(project.projectId);
		}
	};

	const handleEditorSave = () => {
		showEditor.value = false;
		editingProject.value = undefined;
		loadProjects();
	};

	const handleEditorCancel = () => {
		showEditor.value = false;
		editingProject.value = undefined;
	};

	const handleMigrateProject = async (projectPath: string) => {
		try {
			await migrateAndAddProject(projectPath);
			// Remove the migrated project from the found projects list
			foundProjects.value = foundProjects.value.filter((path) => path !== projectPath);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error(`Failed to migrate project: ${errorMessage}`);
			alert(`Failed to migrate project: ${errorMessage}`);
		}
	};

	const handleFindV1Projects = async () => {
		console.log('Finding projects in:', searchDirectory.value);

		if (!searchDirectory.value) {
			alert('Please select a directory to search in');
			return;
		}

		findingProjects.value = true;
		try {
			const projects = await findV1Projects(searchDirectory.value);
			console.log('Finding projects in:', projects);
			foundProjects.value = projects;
			findingProjects.value = false;
		} finally {
			findingProjects.value = false;
		}
	};

	if (showEditor.value) {
		return (
			<div className='container mx-auto px-4 py-8 max-h-[calc(100vh-4rem)] overflow-y-auto dark:bg-gray-900'>
				<h1 className='text-2xl text-gray-900 dark:text-gray-100 font-bold mb-6'>
					{editingProject.value ? 'Edit Project' : 'Create New Project'}
				</h1>
				<ProjectEditor
					project={editingProject.value}
					onSave={handleEditorSave}
					onCancel={handleEditorCancel}
					onCreateProject={createProject}
					onUpdateProject={updateProject}
				/>
			</div>
		);
	}

	if (loading.value) {
		return <div className='text-center py-8 dark:text-gray-300'>Loading projects...</div>;
	}

	if (projects.value.length === 0) {
		return (
			<div className='container mx-auto px-4 py-8 h-screen overflow-y-auto dark:bg-gray-900'>
				<div className='text-center'>
					<h1 className='text-2xl font-bold mb-6'>Welcome to BB</h1>
					<p className='mb-8'>Get started by creating a new project or finding existing projects.</p>

					<div className='flex flex-col items-center space-y-4'>
						<button
							onClick={handleCreateNew}
							className='px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
						>
							Create New Project
						</button>

						<div className='w-full max-w-md mt-8'>
							<h2 className='text-xl font-semibold mb-4'>Find Existing Projects</h2>
							<div className='space-y-4'>
								<div className='form-group dark:text-gray-300'>
									<label className='block text-sm font-medium text-gray-700 mb-2'>
										Search Directory
									</label>
									<FileBrowser
										value={searchDirectory.value}
										onChange={(value) => searchDirectory.value = value}
										type='directory'
										className='w-full'
										viewMode='column'
										appState={appState}
									/>
								</div>
								<button
									onClick={handleFindV1Projects}
									disabled={findingProjects.value || !isDirectoryValid.value}
									className={`w-full px-4 py-2 ${
										isDirectoryValid.value ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400'
									} text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50`}
								>
									{findingProjects.value ? 'Searching...' : 'Find Projects'}
								</button>
							</div>

							{foundProjects.value.length > 0 && (
								<div className='mt-4'>
									<h3 className='text-lg font-medium mb-2'>Found Projects:</h3>
									<ul className='bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto'>
										{foundProjects.value.map((path) => (
											<li key={path} className='px-6 py-4 flex justify-between items-center'>
												<span>{path}</span>
												<button
													onClick={() =>
														handleMigrateProject(path)}
													className='ml-4 text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full p-1'
													title='Add Project'
												>
													<svg
														xmlns='http://www.w3.org/2000/svg'
														className='h-6 w-6'
														fill='none'
														viewBox='0 0 24 24'
														stroke='currentColor'
													>
														<path
															strokeLinecap='round'
															strokeLinejoin='round'
															strokeWidth='2'
															d='M12 4v16m8-8H4'
														/>
													</svg>
												</button>
											</li>
										))}
									</ul>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className='container mx-auto px-4 py-8 h-screen overflow-y-auto dark:bg-gray-900'>
			<div className='flex justify-between items-center mb-6'>
				<h1 className='text-2xl font-bold dark:text-gray-200'>Project Manager</h1>
				<div className='space-x-4'>
					<button
						onClick={handleCreateNew}
						className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
					>
						Create New Project
					</button>
				</div>
			</div>

			{error.value && (
				<div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4'>
					{error.value}
				</div>
			)}

			<div className='bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-8'>
				<table className='min-w-full divide-y divide-gray-200 dark:divide-gray-700'>
					<thead className='bg-gray-50 dark:bg-gray-700'>
						<tr>
							<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider'>
								Name
							</th>
							<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Path
							</th>
							<th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Type
							</th>
							<th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className='bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700'>
						{projects.value.map((project) => (
							<tr key={project.projectId} className='hover:bg-gray-50'>
								<td className='px-6 py-4 whitespace-nowrap'>
									<a
										href='/app/chat'
										f-partial='/app/chat/partial'
										className='block dark:text-gray-300 -mx-6 px-6 py-4 -my-4'
										onClick={(_e) => {
											setPath('/app/chat');
											setSelectedProject(project.projectId);
										}}
									>
										{project.name}
									</a>
								</td>
								<td className='px-6 py-4 whitespace-nowrap'>
									<a
										href='/app/chat'
										f-partial='/app/chat/partial'
										className='block dark:text-gray-300 -mx-6 px-6 py-4 -my-4'
										onClick={(_e) => {
											setPath('/app/chat');
											setSelectedProject(project.projectId);
										}}
									>
										{project.path}
									</a>
								</td>
								<td className='px-6 py-4 whitespace-nowrap'>
									<a
										href='/app/chat'
										f-partial='/app/chat/partial'
										className='block dark:text-gray-300 -mx-6 px-6 py-4 -my-4'
										onClick={(_e) => {
											setPath('/app/chat');
											setSelectedProject(project.projectId);
										}}
									>
										{project.type}
									</a>
								</td>
								<td className='px-6 py-4 whitespace-nowrap text-right'>
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleEdit(project);
										}}
										className='text-blue-600 hover:text-blue-900 mr-4'
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
										onClick={(e) => {
											e.stopPropagation();
											handleDelete(project);
										}}
										className='text-red-600 hover:text-red-900'
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
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className='mt-8'>
				<h2 className='text-xl font-semibold mb-4 dark:text-gray-200'>Find More Projects</h2>
				<div className='max-w-md space-y-4 pb-8'>
					<div className='form-group'>
						<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
							Search Directory
						</label>
						<FileBrowser
							value={searchDirectory.value}
							onChange={(value) => searchDirectory.value = value}
							type='directory'
							className='w-full'
							viewMode='column'
							appState={appState}
							defaultExpanded={false}
							onSelectionValid={(isValid, selectedPath) => {
								console.log('Directory selection changed:', { isValid, selectedPath });
								isDirectoryValid.value = isValid;
								if (selectedPath) searchDirectory.value = selectedPath;
							}}
						/>
					</div>
					<button
						onClick={handleFindV1Projects}
						disabled={findingProjects.value || !searchDirectory.value}
						className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50'
					>
						{findingProjects.value ? 'Searching...' : 'Find Projects'}
					</button>

					{foundProjects.value.length > 0 && (
						<div className='mt-4'>
							<h3 className='text-lg font-medium mb-2'>Found Projects:</h3>
							<ul className='bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-[400px] overflow-y-auto'>
								{foundProjects.value.map((path) => (
									<li
										key={path}
										className='px-6 py-4 flex justify-between items-center dark:text-gray-300'
									>
										<span>{path}</span>
										<button
											onClick={() => handleMigrateProject(path)}
											className='ml-4 text-green-600 hover:text-green-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-full p-1'
											title='Add Project'
										>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												className='h-6 w-6'
												fill='none'
												viewBox='0 0 24 24'
												stroke='currentColor'
											>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth='2'
													d='M12 4v16m8-8H4'
												/>
											</svg>
										</button>
									</li>
								))}
							</ul>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
