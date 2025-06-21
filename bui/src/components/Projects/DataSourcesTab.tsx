import { useState } from 'preact/hooks';
import { Signal } from '@preact/signals';
import type { ClientProjectWithConfigSources } from 'shared/types/project.ts';
import type { ProjectId } from 'shared/types.ts';
import { DataSourceList } from '../DataSourceList.tsx';
//import type { useProjectState } from '../../hooks/useProjectState.ts';
import type { AppState } from '../../hooks/useAppState.ts';

interface DataSourcesTabProps {
	editingProject: Signal<ClientProjectWithConfigSources | undefined>;
	onUpdate: (updatedProject: ClientProjectWithConfigSources) => Promise<void>;
	appState: Signal<AppState>;
}

/**
 * Tab component for managing data sources in the project editor
 */
export function DataSourcesTab({ editingProject, onUpdate, appState }: DataSourcesTabProps) {
	const [error, setError] = useState<string | null>(null);

	const handleProjectUpdate = async (_projectId: ProjectId, updatedProject: ClientProjectWithConfigSources) => {
		try {
			setError(null);
			await onUpdate(updatedProject);
		} catch (err) {
			setError(`Failed to update project: ${(err as Error).message}`);
		}
	};

	return (
		<div className='data-sources-tab'>
			<div className='mb-4'>
				{
					/*<h3 className='text-base font-medium text-gray-900 dark:text-gray-100 mb-2'>
					Data Sources
				</h3>*/
				}
				<p className='px-4 text-sm text-gray-500 dark:text-gray-400'>
					Configure where BB can access files and other resources for this project. The primary data source
					determines the default resources to use.
				</p>
			</div>

			{error && (
				<div className='text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4'>
					{error}
				</div>
			)}

			{editingProject
				? (
					<DataSourceList
						editingProject={editingProject}
						appState={appState}
						onUpdate={handleProjectUpdate}
					/>
				)
				: (
					<div className='text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4'>
						No valid Project
					</div>
				)}

			<div className='mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-md'>
				<h4 className='text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'>
					About Data Sources
				</h4>
				<ul className='text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1'>
					<li>
						The <strong>primary data source</strong> is where BB will look for resources by default
					</li>
					<li>Each data source can have different capabilities (read, write, list, search)</li>
					<li>Data sources with higher priority will be used first when multiple sources match</li>
					<li>Different types of data sources connect to different services (filesystem, databases, APIs)</li>
				</ul>
			</div>
		</div>
	);
}
