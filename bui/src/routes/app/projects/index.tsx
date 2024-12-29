import { PageProps } from '$fresh/server.ts';
import { signal } from '@preact/signals';
import { ProjectManagerMetadata } from '../../../islands/metadata/index.ts';
import ProjectManager from '../../../islands/ProjectManager.tsx';

interface ProjectsPageProps {
	view?: 'grid' | 'list';
}

// Initialize view state with signal
const viewState = signal<'grid' | 'list'>('grid');

export default function ProjectsPage(props: PageProps<ProjectsPageProps>) {
	return (
		<div class='flex flex-col flex-1'>
			{/* Metadata Bar */}
			<div class='border-b border-gray-200 dark:border-gray-700 px-4 py-2'>
				<ProjectManagerMetadata
					view={viewState.value}
					onViewChange={(newView) => viewState.value = newView}
				/>
			</div>

			{/* Main content */}
			<div class='flex-1 flex flex-col overflow-hidden'>
				<ProjectManager />
			</div>
		</div>
	);
}
