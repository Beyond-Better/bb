import { useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { setCollaboration, setProject, useAppState } from '../../hooks/useAppState.ts';
import { useProjectState } from '../../hooks/useProjectState.ts';
import { ProjectList } from './ProjectList.tsx';
import { ProjectTrigger } from './ProjectTrigger.tsx';
import type { ClientProjectWithConfigSources } from 'shared/types/project.ts';
import { generateCollaborationId, shortenCollaborationId } from 'shared/generateIds.ts';

interface ProjectSelectorProps {
	isCollapsed?: boolean;
	className?: string;
	placement?: 'top' | 'bottom' | 'left' | 'right';
	triggerClassName?: string;
}

export function ProjectSelector({
	isCollapsed = false,
	className = '',
	placement: _placement = 'bottom',
	triggerClassName = '',
}: ProjectSelectorProps) {
	const appState = useAppState();
	const { state: projectState, loadProjects } = useProjectState(appState);

	const isOpen = useSignal(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const selectedIndex = useSignal(0);
	const searchQuery = useSignal('');

	const projects = useComputed(() => projectState.value.projects);
	const loading = useComputed(() => projectState.value.loading);
	const error = useComputed(() => projectState.value.error);
	const currentProject = useComputed(() => {
		return projects.value.find((p) => p.data.projectId === appState.value.projectId);
	});

	// Load projects on mount
	useEffect(() => {
		loadProjects();
	}, []);

	// Handle keyboard navigation
	useEffect(() => {
		if (!isOpen.value) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					selectedIndex.value = (selectedIndex.value + 1) % projects.value.length;
					break;
				case 'ArrowUp':
					e.preventDefault();
					selectedIndex.value = selectedIndex.value - 1 < 0
						? projects.value.length - 1
						: selectedIndex.value - 1;
					break;
				case 'Enter': {
					e.preventDefault();
					const selectedProject = projects.value[selectedIndex.value];
					if (selectedProject) {
						handleProjectSelect(selectedProject);
					}
					break;
				}
				case 'Escape':
					e.preventDefault();
					isOpen.value = false;
					triggerRef.current?.focus();
					break;
			}
		};

		globalThis.addEventListener('keydown', handleKeyDown);
		return () => globalThis.removeEventListener('keydown', handleKeyDown);
	}, [isOpen.value, projects.value, selectedIndex.value]);

	// Handle click outside
	useEffect(() => {
		if (!isOpen.value) return;

		const handleClickOutside = (e: MouseEvent) => {
			if (
				popoverRef.current &&
				!popoverRef.current.contains(e.target as Node) &&
				!triggerRef.current?.contains(e.target as Node)
			) {
				isOpen.value = false;
			}
		};

		globalThis.addEventListener('mousedown', handleClickOutside);
		return () => globalThis.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen.value]);

	const handleProjectSelect = (project: ClientProjectWithConfigSources) => {
		setProject(project.data.projectId);
		setCollaboration(shortenCollaborationId(generateCollaborationId()));
		isOpen.value = false;
		triggerRef.current?.focus();
	};

	return (
		<div className={`relative ${className}`}>
			<ProjectTrigger
				ref={triggerRef}
				isCollapsed={isCollapsed}
				isOpen={isOpen.value}
				project={currentProject.value}
				onClick={() => isOpen.value = !isOpen.value}
				className={triggerClassName}
			/>

			{isOpen.value && (
				<div
					ref={popoverRef}
					className='absolute z-50 bg-white dark:bg-gray-800 border-x border-b border-blue-500 dark:border-blue-400 rounded-b-lg shadow-lg overflow-hidden w-full'
					style={{
						top: '100%',
						left: 0,
						right: 0,
						marginTop: -1,
					}}
				>
					{/* Search Input */}
					<div className='border-b border-gray-200 dark:border-gray-700'>
						<input
							type='text'
							value={searchQuery.value}
							onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
							placeholder='Search projects...'
							autoComplete='off'
							className='w-full px-4 py-2 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 dark:focus:ring-blue-400 dark:focus:ring-blue-400 bg-white dark:bg-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500'
						/>
					</div>

					{/* Project List */}
					<ProjectList
						projects={projects.value
							.filter((project) => {
								const query = searchQuery.value.toLowerCase();
								if (query === '') return true;

								// Check project name
								if (project.data.name.toLowerCase().includes(query)) return true;

								// Check primary data source
								if (
									project.data.primaryDsConnection?.config.dataSourceRoot?.toString().toLowerCase()
										.includes(query)
								) return true;

								// Check other data sources
								if (
									project.data.dsConnections.some((ds) =>
										ds.name.toLowerCase().includes(query) ||
										(ds.config.dataSourceRoot?.toString().toLowerCase().includes(query))
									)
								) {
									return true;
								}

								return false;
							})}
						selectedIndex={selectedIndex.value}
						currentProjectId={appState.value.projectId}
						loading={loading.value}
						error={error.value}
						onSelect={handleProjectSelect}
					/>
				</div>
			)}
		</div>
	);
}
