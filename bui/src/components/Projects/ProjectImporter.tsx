import { Signal } from '@preact/signals';
import { useSignal } from '@preact/signals';
import { useProjectState } from '../../hooks/useProjectState.ts';
import type { AppState } from '../../hooks/useAppState.ts';
import { FileBrowser } from '../FileBrowser.tsx';

interface ProjectImporterProps {
	appState: Signal<AppState>;
}

export function ProjectImporter({
	appState,
}: ProjectImporterProps) {
	const {
		findV1Projects,
		migrateAndAddProject,
	} = useProjectState(appState);

	const findingProjects = useSignal(false);
	const foundProjects = useSignal<string[]>([]);
	const searchDirectory = useSignal('');
	const isDirectoryValid = useSignal(false);

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

	return (
		<div className='mt-8 lg:mt-0 lg:w-[30rem] bg-white dark:bg-gray-800 rounded-lg p-6 lg:sticky lg:top-8 max-h-[calc(100vh-8rem)] overflow-y-auto'>
			<div className='flex items-center justify-between mb-4'>
				<h2 className='text-xl font-semibold dark:text-gray-200'>Import Projects</h2>
				{
					/* <button
					className='text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-2 text-sm'
					onClick={() => isDirectoryValid.value = !isDirectoryValid.value}
				>
					<span>Browse Files</span>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						viewBox='0 0 20 20'
						fill='currentColor'
						className={`w-5 h-5 transition-transform ${
							isDirectoryValid.value ? 'transform rotate-180' : ''
						}`}
					>
						<path
							fill-rule='evenodd'
							d='M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z'
							clip-rule='evenodd'
						/>
					</svg>
				</button> */
				}
			</div>

			<div className='max-w-md space-y-4 pb-4'>
				<div className='form-group bg-white dark:bg-gray-800'>
					<label className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4'>
						Select Directory to Search
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
					disabled={findingProjects.value || !isDirectoryValid.value}
					className='w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:hover:bg-green-600 transition-colors duration-200'
				>
					{findingProjects.value ? 'Searching...' : 'Search for Projects'}
				</button>

				{foundProjects.value.length > 0 && (
					<div className='mt-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm'>
						<h3 className='text-lg font-medium mb-3 text-gray-900 dark:text-gray-100'>
							Found Projects
						</h3>
						<ul className='divide-y divide-gray-100 dark:divide-gray-700 max-h-[300px] overflow-y-auto rounded-lg'>
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
	);
}
