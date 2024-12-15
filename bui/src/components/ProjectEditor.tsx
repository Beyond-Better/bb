import { useComputed, useSignal } from '@preact/signals';
import { Project } from '../hooks/useProjectState.ts';
import { ProjectType } from 'shared/config/v2/types.ts';
import { FileBrowser } from './FileBrowser.tsx';
import { useAppState } from '../hooks/useAppState.ts';

interface ProjectEditorProps {
	project?: Project;
	onSave?: () => void;
	onCancel?: () => void;
	className?: string;
	onCreateProject: (project: Omit<Project, 'projectId'>) => Promise<void>;
	onUpdateProject: (projectId: string, updates: Partial<Omit<Project, 'projectId'>>) => Promise<void>;
}

export function ProjectEditor({
	project,
	onSave,
	onCancel,
	className = '',
	onCreateProject,
	onUpdateProject,
}: ProjectEditorProps) {
	const name = useSignal(project?.name || '');
	const path = useSignal(project?.path || '');
	const isDirectoryValid = useSignal(false);
	const type = useSignal<ProjectType>(project?.type || 'local');
	const saving = useSignal(false);
	const error = useSignal<string | null>(null);

	const appState = useAppState();

	const isValid = useComputed(() =>
		name.value.trim() !== '' &&
		path.value.trim() !== '' &&
		isDirectoryValid.value
	);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		if (!isValid.value || saving.value) return;

		saving.value = true;
		error.value = null;

		try {
			const projectData = {
				name: name.value,
				path: path.value,
				type: type.value,
			};

			if (project) {
				await onUpdateProject(project.projectId, projectData);
			} else {
				await onCreateProject(projectData);
			}

			onSave?.();
		} catch (err) {
			error.value = (err as Error).message;
		} finally {
			saving.value = false;
		}
	};

	return (
		<div class={`project-editor ${className}`}>
			<form onSubmit={handleSubmit} class='space-y-6 bg-white shadow rounded-lg p-6'>
				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 mb-2'>
						Project Name
					</label>
					<input
						type='text'
						value={name.value}
						onInput={(e) => name.value = (e.target as HTMLInputElement).value}
						class='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
						placeholder='My Project'
						required
					/>
				</div>

				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 mb-2'>
						Project Path
					</label>
					<FileBrowser
						value={path.value}
						onChange={(value) => path.value = value}
						type='directory'
						className='w-full'
						appState={appState}
						defaultExpanded={!project} // expanded for new projects, collapsed for edit
						onSelectionValid={(isValid, selectedPath) => {
							isDirectoryValid.value = isValid;
							if (selectedPath) path.value = selectedPath;
						}}
					/>
					<p class='mt-1 text-sm text-gray-500'>
						Select the root directory of your project
					</p>
				</div>

				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 mb-2'>
						Project Type
					</label>
					<select
						value={type.value}
						onChange={(e) => type.value = (e.target as HTMLSelectElement).value as ProjectType}
						class='w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
					>
						<option value='local'>Local Directory</option>
						<option value='git'>Git Repository</option>
					</select>
				</div>

				{error.value && (
					<div class='text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3'>
						{error.value}
					</div>
				)}

				<div class='flex justify-end space-x-3 pt-4'>
					{onCancel && (
						<button
							type='button'
							onClick={onCancel}
							class='px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
						>
							Cancel
						</button>
					)}
					<button
						type='submit'
						disabled={!isValid.value || saving.value}
						class='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
					>
						{saving.value ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
					</button>
				</div>
			</form>
		</div>
	);
}
