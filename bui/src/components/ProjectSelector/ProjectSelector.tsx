import { useComputed, useSignal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { setConversation, setProject, useAppState } from '../../hooks/useAppState.ts';
import { useProjectState } from '../../hooks/useProjectState.ts';
import { ProjectList } from './ProjectList.tsx';
import { ProjectTrigger } from './ProjectTrigger.tsx';
import type { Project } from '../../hooks/useProjectState.ts';
import { generateConversationId } from 'shared/conversationManagement.ts';

interface ProjectSelectorProps {
	isCollapsed?: boolean;
	className?: string;
	placement?: 'top' | 'bottom' | 'left' | 'right';
	triggerClassName?: string;
}

export function ProjectSelector({
	isCollapsed = false,
	className = '',
	placement = 'bottom',
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
		return projects.value.find((p) => p.projectId === appState.value.projectId);
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
				case 'Enter':
					e.preventDefault();
					const selectedProject = projects.value[selectedIndex.value];
					if (selectedProject) {
						handleProjectSelect(selectedProject);
					}
					break;
				case 'Escape':
					e.preventDefault();
					isOpen.value = false;
					triggerRef.current?.focus();
					break;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
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

		window.addEventListener('mousedown', handleClickOutside);
		return () => window.removeEventListener('mousedown', handleClickOutside);
	}, [isOpen.value]);

	const handleProjectSelect = (project: Project) => {
		setProject(project.projectId);
		setConversation(generateConversationId());
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
					className='absolute z-30 bg-white border-x border-b border-blue-500 rounded-b-lg shadow-lg overflow-hidden w-full'
					style={{
						top: '100%',
						left: 0,
						right: 0,
						marginTop: -1,
					}}
				>
					{/* Search Input */}
					<div className='border-b border-gray-200'>
						<input
							type='text'
							value={searchQuery.value}
							onInput={(e) => searchQuery.value = (e.target as HTMLInputElement).value}
							placeholder='Search projects...'
							autoComplete='off'
							className='w-full px-4 py-2 border-0 text-sm focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 bg-white placeholder-gray-400'
						/>
					</div>

					{/* Project List */}
					<ProjectList
						projects={projects.value.filter((project) =>
							searchQuery.value === '' ||
							project.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
							project.path.toLowerCase().includes(searchQuery.value.toLowerCase())
						)}
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
