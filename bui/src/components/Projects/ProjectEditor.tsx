import { batch, Signal, useComputed, useSignal } from '@preact/signals';
import { Project } from '../../hooks/useProjectState.ts';
import { ProjectType } from 'shared/config/v2/types.ts';
import { FileBrowser } from '../FileBrowser.tsx';
import type { AppState } from '../../hooks/useAppState.ts';

interface ProjectEditorProps {
	project?: Project;
	appState: Signal<AppState>;
	onSave?: () => void;
	onCancel?: () => void;
	className?: string;
	onCreateProject: (project: Omit<Project, 'projectId'>) => Promise<void>;
	onUpdateProject: (projectId: string, updates: Partial<Omit<Project, 'projectId'>>) => Promise<void>;
}

export function ProjectEditor({
	project,
	appState,
	onSave,
	onCancel,
	className = '',
	onCreateProject,
	onUpdateProject,
}: ProjectEditorProps) {
	const name = useSignal(project?.name || '');
	const path = useSignal(project?.path || '');
	//console.log('ProjectEditor: Initial path value:', { path: project?.path, signalValue: path.value });
	const isDirectoryValid = useSignal(project ? true : false);
	///console.log('ProjectEditor: initialized isDirectoryValid:', {
	///	isEditing: !!project,
	///	value: isDirectoryValid.value,
	///	path: path.value,
	///});
	const type = useSignal<ProjectType>(project?.type || 'local');
	const llmGuidelinesFile = useSignal(project?.llmGuidelinesFile || '');
	//console.log('ProjectEditor: Received props:', {
	//	project,
	//	hasProject: !!project,
	//	projectPath: project?.path,
	//	isDirectoryValid: isDirectoryValid.value,
	//});

	// File suggestion state
	const suggestions = useSignal<Array<{ path: string; display: string }>>([]);
	const isLoadingSuggestions = useSignal(false);
	const showSuggestions = useSignal(false);
	const selectedIndex = useSignal<number | undefined>(undefined);
	const saving = useSignal(false);
	const error = useSignal<string | null>(null);

	const isValid = useComputed(() => {
		const valid = name.value.trim() !== '' &&
			path.value.trim() !== '' &&
			isDirectoryValid.value;
		//console.log('ProjectEditor: Form validation:', {
		//	name: name.value.trim() !== '',
		//	path: path.value.trim() !== '',
		//	isDirectoryValid: isDirectoryValid.value,
		//	overallValid: valid,
		//});
		return valid;
	});

	const handleSubmit = async (e: Event) => {
		//console.log('ProjectEditor: form submit event triggered');
		e.stopPropagation();
		e.preventDefault();
		if (!isValid.value || saving.value) return;

		saving.value = true;
		error.value = null;

		try {
			const projectData = {
				llmGuidelinesFile: llmGuidelinesFile.value,
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
		<div
			class={`project-editor ${className}`}
			onClick={(e) => {
				e.stopPropagation();
			}}
		>
			<form
				onSubmit={handleSubmit}
				onReset={(e) => {
					//console.log('ProjectEditor: form reset event triggered');
					e.stopPropagation();
				}}
				class='space-y-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6 border dark:border-gray-700'
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<h2 class='text-xl font-bold text-gray-900 dark:text-gray-100'>
					{project ? 'Edit Project' : 'Create New Project'}
				</h2>
				<div class='form-group' onClick={(e) => e.stopPropagation()}>
					<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
						Project Name
					</label>
					<input
						type='text'
						value={name.value}
						onInput={(e) => name.value = (e.target as HTMLInputElement).value}
						class='w-full px-3 py-2 border dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100'
						placeholder='My Project'
						required
					/>
				</div>

				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
						Project Path
					</label>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Select the root directory of your project
					</p>
					<FileBrowser
						value={path.value}
						// Log when FileBrowser is rendered
						ref={(el) => {
							//console.log('ProjectEditor: FileBrowser rendered with path:', path.value);
							return el;
						}}
						onChange={(value) => {
							//console.log('ProjectEditor: FileBrowser onChange:', { oldValue: path.value, newValue: value });
							path.value = value;
						}}
						type='directory'
						className='w-full mt-3'
						appState={appState}
						defaultExpanded={!project} // expanded for new projects, collapsed for edit
						alwaysShowPath={true}
						onSelectionValid={(isValid, selectedPath) => {
							//console.log('ProjectEditor: FileBrowser selection:', { isValid, selectedPath });
							isDirectoryValid.value = isValid;
							//console.log('ProjectEditor: Updated isDirectoryValid:', { newValue: isValid, path: selectedPath });
							if (selectedPath) path.value = selectedPath;
						}}
					/>
				</div>

				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
						Project Type
					</label>
					<select
						value={type.value}
						onChange={(e) => type.value = (e.target as HTMLSelectElement).value as ProjectType}
						class='w-full px-3 py-2 border dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100'
					>
						<option value='local'>Local Directory</option>
						<option value='git'>Git Repository</option>
					</select>
				</div>

				<div class='form-group relative'>
					<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
						LLM Guidelines File
					</label>
					<div class='relative'>
						<input
							type='text'
							value={llmGuidelinesFile.value}
							onKeyDown={(e: KeyboardEvent) => {
								// Handle form submission prevention
								if (e.key === 'Enter' && showSuggestions.value && suggestions.value.length > 0) {
									e.preventDefault();
									// If we have a selection, use it
									if (selectedIndex.value !== undefined && selectedIndex.value >= 0) {
										const selected = suggestions.value[selectedIndex.value];
										llmGuidelinesFile.value = selected.path;
										//console.log('ProjectEditor: Closing suggestions, resetting selection');
										batch(() => {
											showSuggestions.value = false;
											selectedIndex.value = undefined;
										});
									}
									return;
								}

								// Handle suggestion navigation
								if (showSuggestions.value && suggestions.value.length > 0) {
									if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
										e.preventDefault();
										const newIndex = e.key === 'ArrowDown'
											? ((selectedIndex.value === undefined ? -1 : selectedIndex.value) + 1) %
												suggestions.value.length
											: selectedIndex.value === undefined || selectedIndex.value <= 0
											? suggestions.value.length - 1
											: selectedIndex.value - 1;
										//console.log('ProjectEditor: Changing selection:', { from: selectedIndex.value, to: newIndex });
										selectedIndex.value = newIndex;
										// Ensure selected item is visible
										setTimeout(() => {
											const selectedElement = document.getElementById(`suggestion-${newIndex}`);
											if (selectedElement) {
												selectedElement.scrollIntoView({
													block: 'nearest',
													behavior: 'smooth',
												});
											}
										}, 0);
									} else if (e.key === 'Enter' && selectedIndex.value && selectedIndex.value >= 0) {
										e.preventDefault();
										const selected = suggestions.value[selectedIndex.value];
										llmGuidelinesFile.value = selected.path;
										showSuggestions.value = false;
									} else if (e.key === 'Escape') {
										e.preventDefault();
										batch(() => {
											showSuggestions.value = false;
											selectedIndex.value = undefined;
										});
									}
								}
							}}
							onInput={async (e) => {
								const value = (e.target as HTMLInputElement).value;
								llmGuidelinesFile.value = value;

								if (value.trim()) {
									isLoadingSuggestions.value = true;
									try {
										const response = await appState.value.apiClient?.suggestFiles(
											value,
											project?.projectId || '',
										);
										batch(() => {
											//console.log('ProjectEditor: Loading new suggestions');
											selectedIndex.value = undefined; // Reset selection with new suggestions
											suggestions.value = response?.suggestions.map((s) => ({
												path: s.path,
												display: s.path.split('/').pop() || s.path,
											})) || [];
											showSuggestions.value = true;
										});
									} catch (err) {
										console.error('ProjectEditor: Failed to fetch suggestions:', err);
									} finally {
										isLoadingSuggestions.value = false;
									}
								} else {
									batch(() => {
										showSuggestions.value = false;
										selectedIndex.value = undefined;
										suggestions.value = [];
									});
								}
							}}
							onFocus={() => {
								if (llmGuidelinesFile.value.trim() && suggestions.value.length > 0) {
									showSuggestions.value = true;
								}
							}}
							onBlur={() => {
								// Delay hiding to allow click on suggestion
								setTimeout(() => {
									batch(() => {
										showSuggestions.value = false;
										selectedIndex.value = undefined;
									});
								}, 200);
							}}
							class='w-full px-3 py-2 border dark:border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100'
							placeholder='Select a guidelines file (optional)'
							aria-expanded={showSuggestions.value}
							aria-controls='guidelines-file-suggestions'
							aria-activedescendant={selectedIndex.value !== undefined
								? `suggestion-${selectedIndex.value}`
								: undefined}
						/>
						{isLoadingSuggestions.value && (
							<div class='absolute right-3 top-2.5'>
								<div class='animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent'>
								</div>
							</div>
						)}
					</div>
					{showSuggestions.value && suggestions.value.length > 0 && (
						<ul
							id='guidelines-file-suggestions'
							role='listbox'
							aria-label='File suggestions'
							class='absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 shadow-lg rounded-md py-1 text-base ring-1 ring-black dark:ring-white ring-opacity-5 dark:ring-opacity-10 overflow-auto focus:outline-none sm:text-sm max-h-60 scroll-smooth'
						>
							{suggestions.value.map((suggestion, i) => {
								const isSelected = i === selectedIndex.value;
								//console.log('ProjectEditor: Rendering suggestion:', { index: i, selectedIndex: selectedIndex.value, isSelected });
								return (
									<li
										id={`suggestion-${i}`}
										key={suggestion.path}
										role='option'
										aria-selected={isSelected}
										class={`cursor-pointer py-2 px-3 ${
											isSelected
												? 'bg-blue-600 text-white'
												: 'text-gray-900 dark:text-gray-100 hover:bg-blue-600 hover:text-white hover:no-underline'
										}`}
										onClick={() => {
											llmGuidelinesFile.value = suggestion.path;
											batch(() => {
												showSuggestions.value = false;
												selectedIndex.value = undefined;
											});
										}}
									>
										<div class='flex items-center'>
											<span class='truncate'>{suggestion.display}</span>
											<span
												class={`ml-2 truncate text-sm ${
													isSelected ? 'text-blue-100' : 'text-gray-500'
												}`}
											>
												({suggestion.path})
											</span>
										</div>
									</li>
								);
							})}
						</ul>
					)}
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Select a file containing project-specific guidelines for the AI assistant
					</p>
				</div>

				{error.value && (
					<div class='text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3'>
						{error.value}
					</div>
				)}

				<div class='flex justify-end space-x-3 pt-4'>
					{onCancel && (
						<button
							type='button'
							onClick={onCancel}
							class='px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500'
						>
							Cancel
						</button>
					)}
					<button
						type='submit'
						disabled={!isValid.value || saving.value}
						class='px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 dark:disabled:opacity-40 disabled:cursor-not-allowed'
					>
						{saving.value ? 'Saving...' : (project ? 'Update Project' : 'Create Project')}
					</button>
				</div>
			</form>
		</div>
	);
}
