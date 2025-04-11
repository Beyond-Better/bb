import { useComputed, useSignal } from '@preact/signals';
import { ConfirmDialog } from '../components/Dialogs/ConfirmDialog.tsx';
import { useEffect } from 'preact/hooks';
import { PageContainer } from '../components/PageContainer.tsx';
import { ProjectEditor } from '../components/Projects/ProjectEditor.tsx';
import { ProjectList } from '../components/Projects/ProjectList.tsx';
//import { ProjectImporter } from '../components/Projects/ProjectImporter.tsx';
import { ProjectManagerEmpty } from '../components/Projects/ProjectManagerEmpty.tsx';
import { useAppState } from '../hooks/useAppState.ts';
import { useProjectState } from '../hooks/useProjectState.ts';
import type { ClientProjectWithConfigSources } from 'shared/types/project.ts';
//import type { ProjectConfig } from 'shared/config/types.ts';

export default function ProjectManager() {
	const appState = useAppState();
	const {
		state: projectState,
		loadProjects,
		createProject,
		updateProject,
		deleteProject,
		setSelectedProject,
		//getBlankProject,
	} = useProjectState(appState);

	const showEditor = useSignal(false);
	const showDeleteConfirm = useSignal(false);
	const loading = useComputed(() => projectState.value.loading);
	const error = useComputed(() => projectState.value.error);
	//const projects = useComputed(() => projectState.value.projects);
	const projectsWithSources = useComputed(() => projectState.value.projects);

	const editingProjectId = useSignal<string | null>(null);
	const deleteProjectId = useSignal<string | null>(null);
	const blankProject = useSignal<ClientProjectWithConfigSources | undefined>(undefined);

	const editingProject = useComputed(() => {
		if (!editingProjectId.value) return undefined;
		if (editingProjectId.value === '_blank') return blankProject.value;
		return projectState.value.projects.find(
			(p) => p.data.projectId === editingProjectId.value,
		) || undefined;
	});

	const projectToDelete = useComputed(() => {
		if (!deleteProjectId.value) return undefined;
		return projectState.value.projects.find(
			(p) => p.data.projectId === deleteProjectId.value,
		) || undefined;
	});

	useEffect(() => {
		// Check URL parameters for new project flag
		const params = new URLSearchParams(globalThis.location.search);
		if (params.get('new') === 'true') {
			showEditor.value = true;
		}

		loadProjects();
	}, []);

	const handleCreateNew = async () => {
		//blankProject.value = await getBlankProject();
		//editingProjectId.value = '_blank';
		const project = await createProject({ data: {}, config: { version: '2.2.0' } });
		editingProjectId.value = project?.data.projectId || null;
		setSelectedProject(editingProjectId.value);
		showEditor.value = true;
	};

	const handleEdit = (projectId: string) => {
		editingProjectId.value = projectId;
		setSelectedProject(editingProjectId.value);
		showEditor.value = true;
	};

	const handleDelete = (projectId: string) => {
		deleteProjectId.value = projectId;
		showDeleteConfirm.value = true;
	};

	const handleConfirmDelete = async () => {
		if (projectToDelete.value) {
			await deleteProject(projectToDelete.value.data.projectId);
			showDeleteConfirm.value = false;
			deleteProjectId.value = null;
		}
	};

	const handleCancelDelete = () => {
		showDeleteConfirm.value = false;
		deleteProjectId.value = null;
	};

	const handleEditorSave = () => {
		showEditor.value = false;
		editingProjectId.value = null;
		setSelectedProject(editingProjectId.value);
		loadProjects();
	};

	const handleEditorCancel = () => {
		console.log('ProjectManager: handleEditorCancel called');
		showEditor.value = false;
		editingProjectId.value = null;
		setSelectedProject(editingProjectId.value);
	};

	if (loading.value) {
		return (
			<div class='container mx-auto pb-10 h-screen overflow-y-auto'>
				<div class='flex flex-col flex-1'>
					<PageContainer>
						<div class='flex flex-col w-full'>
							<div className='container mx-auto px-4 py-8'>
								<div className='text-center py-8 dark:text-gray-300'>Loading projects...</div>
							</div>
						</div>
					</PageContainer>
				</div>
			</div>
		);
	}

	return (
		<div class='container mx-auto pb-10 h-screen overflow-y-auto'>
			<div class='flex flex-col flex-1'>
				<PageContainer>
					<div class='flex flex-col w-full'>
						<div class='border-b border-gray-200 dark:border-gray-700 pb-5 mb-6'>
							<div class='flex items-center justify-between h-12'>
								<div class='flex flex-col justify-center'>
									<h1 class='mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100'>
										Project Manager
									</h1>
									<p class='text-sm text-gray-500 dark:text-gray-400'>
										Manage BB projects.
									</p>
								</div>
								<div class='flex-shrink-0'>
									{!showEditor.value
										? (
											<button
												type='button'
												onClick={handleCreateNew}
												className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 flex items-center h-10'
											>
												<svg
													xmlns='http://www.w3.org/2000/svg'
													class='h-5 w-5 mr-2'
													fill='none'
													viewBox='0 0 24 24'
													stroke='currentColor'
												>
													<path
														stroke-linecap='round'
														stroke-linejoin='round'
														stroke-width='2'
														d='M12 6v6m0 0v6m0-6h6m-6 0H6'
													/>
												</svg>
												Create New Project
											</button>
										)
										: <div class='h-10 w-36'></div>}
								</div>
							</div>
						</div>

						{error.value && (
							<div className='w-full mb-8 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
								{error.value}
							</div>
						)}
						{showEditor.value && editingProject.value
							? (
								<ProjectEditor
									editingProject={editingProject}
									appState={appState}
									onSave={handleEditorSave}
									onCancel={handleEditorCancel}
									onUpdateProject={updateProject}
								/>
							)
							: projectsWithSources.value.length === 0
							? <ProjectManagerEmpty onCreateNew={handleCreateNew} />
							: (
								<div className='w-full'>
									<ProjectList
										projectsWithSources={projectsWithSources}
										setSelectedProject={setSelectedProject}
										handleEdit={handleEdit}
										handleDelete={handleDelete}
									/>
								</div>
							)}
					</div>
				</PageContainer>
			</div>
			<ConfirmDialog
				visible={showDeleteConfirm.value}
				title='Delete Project'
				message={`Are you sure you want to delete project "${projectToDelete.value?.data.name || ''}"?`}
				confirmLabel='Delete'
				onConfirm={handleConfirmDelete}
				onCancel={handleCancelDelete}
				isDangerous
			/>
		</div>
	);
}
