import { useState } from 'preact/hooks';
import { Signal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import type { ClientDataSource, ClientProjectWithConfigSources } from 'shared/types/project.ts';
import { DataSourceItem } from './DataSourceItem.tsx';
import { DataSourceModal } from './DataSourceModal.tsx';
import type { AppState } from '../hooks/useAppState.ts';
import { useProjectState } from '../hooks/useProjectState.ts';
import { generateId } from 'shared/projectData.ts';
//import type { DataSourceTypeInfo } from 'api/resources/dataSourceRegistry.ts';

interface DataSourceListProps {
	editingProject: Signal<ClientProjectWithConfigSources | undefined>;
	onUpdate: (projectId: string, updatedProject: ClientProjectWithConfigSources) => Promise<void>;
	appState: Signal<AppState>;
}

const DEFAULT_DATA_SOURCE = (isPrimary: boolean): ClientDataSource => ({
	id: `ds-${generateId()}`,
	name: '',
	type: 'filesystem',
	accessMethod: 'bb',
	enabled: true,
	isPrimary,
	priority: 50,
	capabilities: ['read'],
	description: '',
	config: {},
});

/**
 * Displays and manages a list of data sources for a project
 */
export function DataSourceList({ editingProject, onUpdate: _onUpdate, appState }: DataSourceListProps) {
	const [editingDataSource, setEditingDataSource] = useState<ClientDataSource | null>(null);
	const [newDataSource, setNewDataSource] = useState<ClientDataSource | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const {
		state: projectState,
		addDataSource,
		removeDataSource,
		updateDataSource,
		setPrimaryDataSource,
	} = useProjectState(appState);

	const projectId = useComputed(() => editingProject.value?.data.projectId);
	const dataSources = useComputed(() => editingProject.value?.data.dataSources || []);
	const dataSourceTypes = useComputed(() => projectState.value?.dataSourceTypes || []);

	// Sort data sources: primary first, then by priority
	const sortedDataSources = useComputed(() =>
		[...dataSources.value].sort((a, b) => {
			if (a.isPrimary) return -1;
			if (b.isPrimary) return 1;
			return b.priority - a.priority;
		})
	);

	const handleSetPrimary = async (dataSourceId: string) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to set primary data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await setPrimaryDataSource(projectId.value, dataSourceId);
			// // Get the updated project from projectState and pass to onUpdate
			// const updatedProject = getSelectedProject();
			// if (updatedProject) {
			// 	await onUpdate(projectId.value, updatedProject);
			// }
		} catch (err) {
			setError(`Failed to set primary data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleAddDataSource = async (dataSource: ClientDataSource) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to add data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await addDataSource(projectId.value, dataSource);
			setNewDataSource(null);
		} catch (err) {
			setError(`Failed to add data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateDataSource = async (dataSource: ClientDataSource) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to update data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await updateDataSource(projectId.value, dataSource.id, dataSource);
			setEditingDataSource(null);
		} catch (err) {
			setError(`Failed to update data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleRemoveDataSource = async (dataSourceId: string) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to set primary data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await removeDataSource(projectId.value, dataSourceId);
		} catch (err) {
			setError(`Failed to remove data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='w-full p-2 space-y-4'>
			<div className='flex justify-between items-center mb-4'>
				<h3 className='text-lg font-semibold text-gray-900 dark:text-gray-100'>Data Sources</h3>
				<button
					type='button'
					className='px-3 py-1.5 rounded text-sm bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-400 transition-colors'
					onClick={() => setNewDataSource(DEFAULT_DATA_SOURCE(dataSources.value.length === 0))}
					disabled={loading}
				>
					Add Data Source
				</button>
			</div>

			{error && (
				<div className='text-red-500 dark:text-red-400 p-2 border border-red-200 dark:border-red-800 rounded bg-red-50 dark:bg-red-900/20'>
					{error}
				</div>
			)}

			{loading && <div className='text-center py-2 text-gray-500 dark:text-gray-400'>Loading...</div>}

			<div className='space-y-4'>
				{sortedDataSources.value.length === 0
					? (
						<div className='text-gray-500 dark:text-gray-400 text-center py-4'>
							No data sources configured. Add one to get started.
						</div>
					)
					: (
						sortedDataSources.value.map((source) => (
							<DataSourceItem
								key={source.id}
								dataSource={source}
								onSetPrimary={() => handleSetPrimary(source.id)}
								onEdit={() => setEditingDataSource(source)}
								onRemove={() => handleRemoveDataSource(source.id)}
							/>
						))
					)}
			</div>

			{newDataSource && (
				<DataSourceModal
					dataSource={newDataSource}
					appState={appState}
					onClose={() => setNewDataSource(null)}
					onSave={handleAddDataSource}
					dataSourceTypes={dataSourceTypes}
				/>
			)}

			{editingDataSource && (
				<DataSourceModal
					dataSource={editingDataSource}
					appState={appState}
					onClose={() => setEditingDataSource(null)}
					onSave={handleUpdateDataSource}
					dataSourceTypes={dataSourceTypes}
				/>
			)}
		</div>
	);
}
