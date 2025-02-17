import { useComputed, useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { PageContainer } from '../components/PageContainer.tsx';
import { ProjectEditor } from '../components/Projects/ProjectEditor.tsx';
import { ProjectList } from '../components/Projects/ProjectList.tsx';
import { ProjectImporter } from '../components/Projects/ProjectImporter.tsx';
import { useAppState } from '../hooks/useAppState.ts';
import { useProjectState } from '../hooks/useProjectState.ts';
import { type Project, type ProjectWithSources } from 'shared/types/project.ts';

export default function ProjectManager() {
	const appState = useAppState();

	const {
		state: projectState,
		loadProjects,
		createProject,
		updateProject,
		deleteProject,
		setSelectedProject,
		getBlankProject,
	} = useProjectState(appState);

	const showEditor = useSignal(false);
	const editingProject = useSignal<Project | undefined>(undefined);
	const editingProjectWithSources = useSignal<ProjectWithSources | undefined>(undefined);
	const loading = useComputed(() => projectState.value.loading);
	const error = useComputed(() => projectState.value.error);
	//const projects = useComputed(() => projectState.value.projects);
	const projectsWithSources = useComputed(() => projectState.value.projectsWithSources);

	useEffect(() => {
		// Check URL parameters for new project flag
		const params = new URLSearchParams(globalThis.location.search);
		if (params.get('new') === 'true') {
			showEditor.value = true;
			editingProject.value = undefined;
		}

		loadProjects();
	}, []);

	const handleCreateNew = async () => {
		editingProjectWithSources.value = await getBlankProject();
		showEditor.value = true;
	};

	const handleEdit = (projectWithSources: ProjectWithSources) => {
		editingProjectWithSources.value = projectWithSources;
		showEditor.value = true;
	};

	const handleDelete = async (projectWithSources: ProjectWithSources) => {
		if (confirm(`Are you sure you want to delete project "${projectWithSources.name}"?`)) {
			await deleteProject(projectWithSources.projectId);
		}
	};

	const handleEditorSave = () => {
		showEditor.value = false;
		editingProjectWithSources.value = undefined;
		loadProjects();
	};

	const handleEditorCancel = () => {
		console.log('ProjectManager: handleEditorCancel called');
		showEditor.value = false;
		editingProjectWithSources.value = undefined;
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
						<div class='border-b border-gray-200 dark:border-gray-700 pb-5 mb-8'>
							<h1 class='text-2xl font-bold text-gray-900 dark:text-gray-100'>Project Manager</h1>
							<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>
								Manage BB projects.
							</p>
						</div>

						{error.value && (
							<div className='w-full mb-8 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
								{error.value}
							</div>
						)}
						{showEditor.value
							? (
								<ProjectEditor
									projectWithSources={editingProjectWithSources.value}
									appState={appState}
									onSave={handleEditorSave}
									onCancel={handleEditorCancel}
									onCreateProject={createProject}
									onUpdateProject={updateProject}
								/>
							)
							: projectsWithSources.value.length === 0
							? (
								<>
									<h2 class='text-xl font-bold text-gray-900 dark:text-gray-100'>
										Get Started with Beyond Better
									</h2>
									<p class='mt-2 text-sm text-gray-500 dark:text-gray-400'>
										Get started by creating a new project or importing existing projects.
									</p>
									<div className='mt-8 flex flex-col items-center space-y-8'>
										<button
											onClick={handleCreateNew}
											className='px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200'
										>
											Create New Project
										</button>

										<ProjectImporter
											appState={appState}
										/>
									</div>
								</>
							)
							: (
								<div className='grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-8'>
									<ProjectList
										projectsWithSources={projectsWithSources}
										setSelectedProject={setSelectedProject}
										handleEdit={handleEdit}
										handleDelete={handleDelete}
									/>

									<div className='flex flex-col gap-4'>
										<button
											onClick={handleCreateNew}
											className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200'
										>
											Create New Project
										</button>

										<ProjectImporter
											appState={appState}
										/>
									</div>
								</div>
							)}
					</div>
				</PageContainer>
			</div>
		</div>
	);
}
