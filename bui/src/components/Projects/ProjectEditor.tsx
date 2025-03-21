import { batch, Signal, useComputed, useSignal } from '@preact/signals';
import type { Project, ProjectWithSources } from 'shared/types/project.ts';
import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import MCPServersOverview from '../MCPServersOverview.tsx';
import MCPConfigModal from '../MCPConfigModal.tsx';

// Helper function to format YAML with proper array syntax
function formatYaml(obj: unknown): string {
	if (!obj || (typeof obj === 'object' && Object.keys(obj).length === 0)) {
		return '';
	}
	let yaml = stringifyYaml(obj);
	const arrayPattern = /([\s\n]+)'\d+':\s*([^\n]+)/g;
	yaml = yaml.replace(arrayPattern, '$1- $2');
	return yaml;
}

const TOOLS_PLACEHOLDER = `run_command:
  allowedCommands:
    - npm
    - git branch
    - git checkout
    - ls
    - cd
    - pwd
    - mv
    - cp`;

import { ProjectType, MCPServerConfig } from 'shared/config/v2/types.ts';
import { ConfigValue } from 'shared/types/project.ts';
import { FileBrowser } from '../FileBrowser.tsx';
import type { AppState } from '../../hooks/useAppState.ts';

interface ConfigValueFieldProps<T> {
	value: {
		global: T | undefined;
		project: T | null;
	};
	onChange: (value: { global: T | undefined; project: T | null }) => void;
	label: string;
	description?: string;
	className?: string;
	type?: 'text' | 'number';
	placeholder?: string;
	min?: number;
	max?: number;
}

function ConfigValueField<T extends string | number | undefined>({
	value,
	onChange,
	label,
	description,
	className = '',
	type = 'text',
	placeholder,
	min,
	max,
}: ConfigValueFieldProps<T>) {
	// Convert the value to string for the input, handling undefined
	const inputValue = (value.project ?? value.global ?? '').toString();

	return (
		<div class='form-group'>
			<div class='flex items-center gap-2'>
				<label class='block text-sm font-medium text-gray-700 dark:text-gray-200'>
					{label}
				</label>
				<span
					class={`px-2 py-0.5 text-xs rounded-full ${
						!value.project
							? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
							: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
					}`}
				>
					{!value.project ? 'Global Default' : 'Project Setting'}
				</span>
			</div>
			{description && (
				<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
					{description}
				</p>
			)}
			<div class={`relative ${className}`}>
				<input
					type={type}
					value={inputValue}
					min={min}
					max={max}
					placeholder={placeholder}
					onInput={(e) => {
						const newValue = type === 'number'
							? Number((e.target as HTMLInputElement).value)
							: (e.target as HTMLInputElement).value;
						onChange({
							...value,
							project: newValue as T,
						});
					}}
					class={`mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:outline-none
						${
						value.project ? 'border-blue-300 dark:border-blue-600' : 'dark:border-gray-700'
					} bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100`}
				/>
				{value.project !== null && value.project !== undefined && (
					<button
						type='button'
						onClick={() => {
							onChange({
								...value,
								project: null,
							});
						}}
						class='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
						title='Reset to global default'
					>
						<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
							<path
								stroke-linecap='round'
								stroke-linejoin='round'
								stroke-width='2'
								d='M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
							/>
						</svg>
					</button>
				)}
			</div>
		</div>
	);
}

interface ProjectEditorProps {
	projectWithSources?: ProjectWithSources;
	appState: Signal<AppState>;
	onSave?: () => void;
	onCancel?: () => void;
	className?: string;
	onCreateProject: (projectWithSources: Omit<Project, 'projectId'>) => Promise<void>;
	onUpdateProject: (projectId: string, updates: Partial<Omit<Project, 'projectId'>>) => Promise<void>;
}

export function ProjectEditor({
	projectWithSources,
	appState,
	onSave,
	onCancel,
	className = '',
	onCreateProject,
	onUpdateProject,
}: ProjectEditorProps) {
	const name = useSignal(projectWithSources?.name || '');
	const path = useSignal(projectWithSources?.path || '');
	const type = useSignal<ProjectType>(projectWithSources?.type || 'local');
	const myPersonsName = useSignal(projectWithSources?.myPersonsName || { global: '', project: null });
	const myAssistantsName = useSignal(projectWithSources?.myAssistantsName || { global: '', project: null });
	const llmGuidelinesFile = useSignal(projectWithSources?.llmGuidelinesFile || { global: '', project: null });
	const maxTurns = useSignal(projectWithSources?.settings?.api?.maxTurns || { global: 50, project: null });
	const toolConfigs = useSignal(
		projectWithSources?.settings?.api?.toolConfigs
			? {
				global: projectWithSources?.settings?.api?.toolConfigs.global
					? formatYaml(projectWithSources?.settings?.api?.toolConfigs.global)
					: '',
				project: projectWithSources?.settings?.api?.toolConfigs.project
					? formatYaml(projectWithSources?.settings?.api?.toolConfigs.project)
					: null,
			}
			: { global: '', project: null },
	);
	// Log the received project data - more detailed logging
	console.log('ProjectEditor: projectWithSources:', JSON.stringify(projectWithSources, null, 2));
	console.log('ProjectEditor: settings structure:', JSON.stringify(projectWithSources?.settings, null, 2));
	console.log('ProjectEditor: settings.api structure:', JSON.stringify(projectWithSources?.settings?.api, null, 2));
	console.log('ProjectEditor: mcpServers from source:', projectWithSources?.settings?.api?.mcpServers);
	
	// Check for raw config in the project sources - might be stored differently
	if (projectWithSources) {
		console.log('ProjectEditor: Raw project keys:', Object.keys(projectWithSources));
		if (projectWithSources.settings) {
			console.log('ProjectEditor: Raw settings keys:', Object.keys(projectWithSources.settings));
			if (projectWithSources.settings.api) {
				console.log('ProjectEditor: Raw api keys:', Object.keys(projectWithSources.settings.api));
			}
		}
	}
	
	// Also check for raw mcpServers value in case it's at a different path
	const rawProject = projectWithSources as any;
	if (rawProject?.mcpServers) {
		console.log('ProjectEditor: Found mcpServers at root level:', rawProject.mcpServers);
	}
	if (rawProject?.settings?.mcpServers) {
		console.log('ProjectEditor: Found mcpServers at settings level:', rawProject.settings.mcpServers);
	}
	
	const mcpServers = useSignal<ConfigValue<MCPServerConfig[] | undefined>>(
		projectWithSources?.settings?.api?.mcpServers
			? projectWithSources.settings.api.mcpServers
			: { global: [], project: null }
	);
	
	// Log the initialized mcpServers signal value
	console.log('ProjectEditor: initialized mcpServers signal:', JSON.stringify(mcpServers.value, null, 2));
	const isDirectoryValid = useSignal(projectWithSources && projectWithSources.projectId ? true : false);
	const activeTab = useSignal('general');

	// Show a helper message about tab switching if this is the first time
	const showTabHelper = useSignal(true);
	const showMCPModal = useSignal(false);

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
		return valid;
	});

	const handleSubmit = async (e: Event) => {
		e.stopPropagation();
		e.preventDefault();
		if (!isValid.value || saving.value) return;

		saving.value = true;
		error.value = null;

		try {
			// Create the project data with correct typing
			const projectData = {
				name: name.value,
				path: path.value,
				type: type.value,
				myPersonsName: myPersonsName.value.project ?? undefined,
				myAssistantsName: myAssistantsName.value.project ?? undefined,
				llmGuidelinesFile: llmGuidelinesFile.value.project ?? undefined,
				settings: {
					api: {
						maxTurns: maxTurns.value.project ?? undefined,
						toolConfigs: toolConfigs.value.project?.trim()
							? parseYaml(toolConfigs.value.project)
							: undefined,
						mcpServers: mcpServers.value.project ?? undefined,
					},
				},
			} as Omit<Project, 'projectId'>;

			if (projectWithSources && projectWithSources.projectId) {
				await onUpdateProject(projectWithSources.projectId, projectData);
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
					e.stopPropagation();
				}}
				class='space-y-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6 border dark:border-gray-700'
				onClick={(e) => {
					e.stopPropagation();
				}}
			>
				<h2 class='text-xl font-bold text-gray-900 dark:text-gray-100'>
					{projectWithSources && projectWithSources.projectId ? 'Edit Project' : 'Create New Project'}
				</h2>

				{/* Project Name and Type Section */}
				<div class='grid grid-cols-1 md:grid-cols-2 gap-6'>
					<div class='form-group' onClick={(e) => e.stopPropagation()}>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
							Project Name
						</label>
						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
							Give your project a meaningful name
						</p>
						<div class='relative'>
							<input
								type='text'
								value={name.value}
								onInput={(e) => name.value = (e.target as HTMLInputElement).value}
								class='mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:border-gray-700 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100 dark:focus:ring-blue-400 focus:outline-none '
								placeholder='My Project'
								required
							/>
						</div>
					</div>

					<div class='form-group'>
						<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
							Project Type
						</label>
						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
							Use 'Git Repository' for automatic saves (<code class='font-mono'>git</code>{' '}
							must be installed and repo initialized)
						</p>
						<div class='relative'>
							<select
								value={type.value}
								onChange={(e) => type.value = (e.target as HTMLSelectElement).value as ProjectType}
								class='mt-1 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 dark:border-gray-700 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100 dark:focus:ring-blue-400 focus:outline-none '
							>
								<option value='local'>Local Directory</option>
								<option value='git'>Git Repository</option>
							</select>
						</div>
					</div>
				</div>

				{/* Project Path Section */}
				<div class='form-group'>
					<label class='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
						Project Path
					</label>
					<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
						Select the root directory of your project
					</p>
					<FileBrowser
						value={path.value}
						onChange={(value) => {
							path.value = value;
						}}
						type='directory'
						className='w-full mt-3'
						appState={appState}
						defaultExpanded={!projectWithSources || !projectWithSources.projectId}
						alwaysShowPath
						onSelectionValid={(isValid, selectedPath) => {
							isDirectoryValid.value = isValid;
							if (selectedPath) path.value = selectedPath;
						}}
					/>
				</div>

				{/* Tabs Navigation */}
				<div className='mb-4 border-t border-b border-gray-200 dark:border-gray-700 py-2 mt-4'>
					<ul className='flex flex-wrap text-sm font-medium text-center'>
						<li className='mr-4'>
							<button
								type='button'
								onClick={() => activeTab.value = 'general'}
								className={`inline-flex items-center px-4 py-2 rounded-md ${
									activeTab.value === 'general'
										? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
										: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
								}`}
							>
								<svg
									className='w-4 h-4 mr-2'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='2'
										d='M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75'
									/>
								</svg>
								General
							</button>
						</li>
						<li className='mr-4'>
							<button
								type='button'
								onClick={() => activeTab.value = 'tools'}
								className={`inline-flex items-center px-4 py-2 rounded-md ${
									activeTab.value === 'tools'
										? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
										: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
								}`}
							>
								<svg
									className='w-4 h-4 mr-2'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='2'
										d='M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z'
									/>
								</svg>
								Tools
							</button>
						</li>
						<li>
							<button
								type='button'
								onClick={() => activeTab.value = 'models'}
								className={`inline-flex items-center px-4 py-2 rounded-md ${
									activeTab.value === 'models'
										? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
										: 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'
								}`}
							>
								<svg
									className='w-4 h-4 mr-2'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										stroke-linecap='round'
										stroke-linejoin='round'
										stroke-width='2'
										d='M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5'
									/>
								</svg>
								Models
							</button>
						</li>
					</ul>
				</div>

				{/* Tab Content Helper */}
				{showTabHelper.value && (
					<div className='mb-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md p-3 flex justify-between items-center'>
						<p className='text-sm text-blue-700 dark:text-blue-300'>
							You can freely switch between tabs - your changes are preserved until you save or cancel
						</p>
						<button
							type='button'
							onClick={() => showTabHelper.value = false}
							className='text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
						>
							Got it
						</button>
					</div>
				)}

				{/* Names Section */}
				{activeTab.value === 'general' && (
				<div className='general-tab'>
					{/* Project Name and Type Section are always visible */}
					<div class='grid grid-cols-1 md:grid-cols-2 gap-6'>
						{/* User's Name */}
						<ConfigValueField
							value={myPersonsName.value}
							onChange={(newValue) => myPersonsName.value = newValue}
							label='Your Name'
							description='The name the assistant will use when referring to you in conversations'
						/>

						{/* Assistant's Name */}
						<ConfigValueField
							value={myAssistantsName.value}
							onChange={(newValue) => myAssistantsName.value = newValue}
							label="Assistant's Name"
							description='What the AI assistant will call itself during conversations'
						/>
					</div>

					{/* Guidelines and Max Turns Section */}
					<div class='grid grid-cols-1 md:grid-cols-2 gap-6 mt-6'>
						{/* Guidelines File Section */}
						<div class='form-group relative'>
							<div class='flex items-center gap-2'>
								<label class='block text-sm font-medium text-gray-700 dark:text-gray-200'>
									LLM Guidelines File
								</label>
								<span
									class={`px-2 py-0.5 text-xs rounded-full ${
										!llmGuidelinesFile.value.project
											? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
											: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
									}`}
								>
									{!llmGuidelinesFile.value.project ? 'Global Default' : 'Project Setting'}
								</span>
							</div>
						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
							Select a file containing project-specific guidelines for the AI assistant
						</p>
						<div class='relative'>
							<input
								type='text'
								value={llmGuidelinesFile.value.project || llmGuidelinesFile.value.global || ''}
								class={`mt-1 w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-lg text-gray-900 dark:text-gray-100 border ${
									llmGuidelinesFile.value.project
										? 'border-blue-300 dark:border-blue-600'
										: 'border-gray-300 dark:border-gray-700'
								}`}
								onKeyDown={(e: KeyboardEvent) => {
									// Handle form submission prevention
									if (e.key === 'Enter' && showSuggestions.value && suggestions.value.length > 0) {
										e.preventDefault();
										// If we have a selection, use it
										if (selectedIndex.value !== undefined && selectedIndex.value >= 0) {
											const selected = suggestions.value[selectedIndex.value];
											llmGuidelinesFile.value = {
												...llmGuidelinesFile.value,
												project: selected.path,
											};
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
											selectedIndex.value = newIndex;
											// Ensure selected item is visible
											setTimeout(() => {
												const selectedElement = document.getElementById(
													`suggestion-${newIndex}`,
												);
												if (selectedElement) {
													selectedElement.scrollIntoView({
														block: 'nearest',
														behavior: 'smooth',
													});
												}
											}, 0);
										} else if (
											e.key === 'Enter' && selectedIndex.value && selectedIndex.value >= 0
										) {
											e.preventDefault();
											const selected = suggestions.value[selectedIndex.value];
											llmGuidelinesFile.value = {
												...llmGuidelinesFile.value,
												project: selected.path,
											};
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
									llmGuidelinesFile.value = {
										...llmGuidelinesFile.value,
										project: value,
									};

									if (value.trim()) {
										isLoadingSuggestions.value = true;
										try {
											const response = await appState.value.apiClient?.suggestFiles(
												value,
												projectWithSources?.projectId || '',
											);
											batch(() => {
												selectedIndex.value = undefined; // Reset selection with new suggestions
												suggestions.value = response?.suggestions.map((s) => ({
													path: s.path,
													display: s.path.split('/').pop() || s.path,
												})) || [];
												showSuggestions.value = true;
											});
										} catch (err) {
											console.error('Failed to fetch suggestions:', err);
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
									if (llmGuidelinesFile.value.project?.trim() && suggestions.value.length > 0) {
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
								placeholder='Select a guidelines file (optional)'
								aria-expanded={showSuggestions.value}
								aria-controls='guidelines-file-suggestions'
								aria-activedescendant={selectedIndex.value !== undefined
									? `suggestion-${selectedIndex.value}`
									: undefined}
							/>
							{llmGuidelinesFile.value.project !== null && (
								<button
									type='button'
									onClick={() => {
										llmGuidelinesFile.value = {
											...llmGuidelinesFile.value,
											project: null,
										};
									}}
									class='absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'
									title='Reset to global default'
								>
									<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											stroke-linecap='round'
											stroke-linejoin='round'
											stroke-width='2'
											d='M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
										/>
									</svg>
								</button>
							)}
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
												llmGuidelinesFile.value = {
													...llmGuidelinesFile.value,
													project: suggestion.path,
												};
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
					</div>

					{/* Max Turns Section */}
					<ConfigValueField
						value={maxTurns.value}
						onChange={(newValue) => maxTurns.value = newValue}
						label='Maximum Turns'
						description='Limits tool uses per statement to prevent infinite loops and control token usage'
						type='number'
						min={1}
						max={100}
						className='max-w-[200px]'
					/>
				</div>

				{/* Tool Configs Section */}
									</div>
			)}

			{activeTab.value === 'tools' && (
				<div className='tools-tab space-y-6'>
					{/* Tool Configs */}
					<div class='form-group mb-6'>
						<div class='flex items-center gap-2'>
							<label class='block text-sm font-medium text-gray-700 dark:text-gray-200'>
								Tool Configurations (YAML)
							</label>
							<span
								class={`px-2 py-0.5 text-xs rounded-full ${
									!toolConfigs.value.project
										? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
										: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
								}`}
							>
								{!toolConfigs.value.project ? 'Global Default' : 'Project Setting'}
							</span>
						</div>
						<p class='mt-1 text-sm text-gray-500 dark:text-gray-400'>
							Configures behavior of the assistant's tools like allowed commands and API keys. Each tool can
							have its own settings.
						</p>
						<div class='relative'>
							<textarea
								rows={10}
								value={toolConfigs.value.project || toolConfigs.value.global || ''}
								onInput={(e) => {
									toolConfigs.value = {
										...toolConfigs.value,
										project: (e.target as HTMLTextAreaElement).value.trim() || null,
									};
								}}
								placeholder={TOOLS_PLACEHOLDER}
								class={`mt-1 w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm leading-relaxed border ${
									toolConfigs.value.project
										? 'border-blue-300 dark:border-blue-600'
										: 'border-gray-300 dark:border-gray-700'
								}`}
							/>
							{toolConfigs.value.project !== null && (
								<button
									type='button'
									onClick={() => {
										toolConfigs.value = {
											...toolConfigs.value,
											project: null,
										};
									}}
									class='absolute right-2 top-2 text-gray-400 hover:text-gray-600'
									title='Reset to global default'
								>
									<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
										<path
											stroke-linecap='round'
											stroke-linejoin='round'
											stroke-width='2'
											d='M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z'
										/>
									</svg>
								</button>
							)}
						</div>
					</div>

					{/* MCP Servers Section */}
					<div className='mb-6'>
						<div className='flex items-center gap-2 mb-2'>
							<h3 className='text-sm font-medium text-gray-700 dark:text-gray-200'>MCP Servers</h3>
							<span
								class={`px-2 py-0.5 text-xs rounded-full ${
									!mcpServers.value.project
										? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
										: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
								}`}
							>
								{!mcpServers.value.project ? 'Global Default' : 'Project Setting'}
							</span>
						</div>
						<p className='mb-4 text-sm text-gray-500 dark:text-gray-400'>
							Configure Model Context Protocol servers for external integrations
						</p>

						<div className='flex justify-between items-center mb-4'>
							<div className='text-sm text-gray-700 dark:text-gray-300'>
								{(() => {
									console.log('ProjectEditor rendering: mcpServers.value', JSON.stringify(mcpServers.value, null, 2));
									return mcpServers.value.project ? mcpServers.value.project.length : (mcpServers.value.global || []).length;
								})()}{' '}
								MCP servers configured
							</div>
							<button
								type='button'
								onClick={() => showMCPModal.value = true}
								className='inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
							>
								Configure Servers
							</button>
						</div>

						{mcpServers.value.project || ((mcpServers.value.global || []).length > 0) ? (
							<div className='bg-gray-50 dark:bg-gray-800 rounded-md p-3'>
								<div className='space-y-2'>
									{(mcpServers.value.project || mcpServers.value.global || []).map((server: MCPServerConfig) => (
										<div key={server.id} className='flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2 last:border-0 last:pb-0'>
											<div className='flex flex-col'>
												<span className='font-medium text-gray-900 dark:text-gray-100'>{server.name || server.id}</span>
												<span className='text-xs text-gray-500 dark:text-gray-400'>{server.command}</span>
											</div>
											<div className='text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'>
												{server.args?.length || 0} args, {Object.keys(server.env || {}).length} env vars
											</div>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className='text-center bg-gray-50 dark:bg-gray-800 rounded-md p-4'>
								<p className='text-sm text-gray-500 dark:text-gray-400'>
									No MCP servers configured
								</p>
							</div>
						)}

						{/* Reset to global defaults button */}
						{mcpServers.value.project && (
							<button
								type='button'
								onClick={() => {
									mcpServers.value = {
										...mcpServers.value,
										project: null,
									};
								}}
								className='mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
							>
								Reset to global defaults
							</button>
						)}
					</div>
				</div>
			)}

			{activeTab.value === 'models' && (
				<div className='models-tab'>
					<div className='bg-gray-50 dark:bg-gray-800 rounded-md p-4'>
						<h3 className='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>Model Configuration</h3>
						<p className='text-sm text-gray-500 dark:text-gray-400'>
							This section will contain model-specific settings in the future.
						</p>
						<div className='flex items-center justify-center h-32'>
							<span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'>
								Coming Soon
							</span>
						</div>
					</div>
				</div>
			)}

				{error.value && (
					<div class='text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3'>
						{error.value}
					</div>
				)}

				<div class='flex justify-end space-x-3 pt-4'>
				{/* MCP Config Modal */}
				{showMCPModal.value && (
					<MCPConfigModal
						isOpen={showMCPModal.value}
						onClose={() => showMCPModal.value = false}
						servers={mcpServers.value.project || mcpServers.value.global || []}
						onSave={(updatedServers) => {
							mcpServers.value = {
								...mcpServers.value,
								project: updatedServers,
							};
							showMCPModal.value = false;
						}}
						isGlobal={false}
						projectId={projectWithSources?.projectId}
					/>
				)}
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
						{saving.value
							? 'Saving...'
							: (projectWithSources && projectWithSources.projectId
								? 'Update Project'
								: 'Create Project')}
					</button>
				</div>
			</form>
		</div>
	);
}
