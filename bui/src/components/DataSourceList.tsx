import { useState } from 'preact/hooks';
import { Signal } from '@preact/signals';
import { useComputed } from '@preact/signals';
import type { ClientDataSourceConnection, ClientProjectWithConfigSources } from 'shared/types/project.ts';
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

const DEFAULT_DATA_SOURCE = (isPrimary: boolean): ClientDataSourceConnection => ({
	id: `ds-${generateId()}`,
	name: '',
	providerType: 'filesystem',
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
	const [editingDsConnection, setEditingDsConnection] = useState<ClientDataSourceConnection | null>(null);
	const [newDsConnection, setNewDsConnection] = useState<ClientDataSourceConnection | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const {
		state: projectState,
		addDsConnection,
		removeDsConnection,
		updateDsConnection,
		setPrimaryDsConnection,
	} = useProjectState(appState);

	const projectId = useComputed(() => editingProject.value?.data.projectId);
	const dsConnections = useComputed(() => editingProject.value?.data.dsConnections || []);
	const dsProviders = useComputed(() => projectState.value?.dsProviders || []);

	// Sort data sources: primary first, then by priority
	const sortedDsConnections = useComputed(() =>
		[...dsConnections.value].sort((a, b) => {
			if (a.isPrimary) return -1;
			if (b.isPrimary) return 1;
			return b.priority - a.priority;
		})
	);

	const handleSetPrimary = async (dsConnectionId: string) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to set primary data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await setPrimaryDsConnection(projectId.value, dsConnectionId);
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

	const handleAddDsConnection = async (dsConnection: ClientDataSourceConnection) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to add data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await addDsConnection(projectId.value, dsConnection);
			setNewDsConnection(null);
		} catch (err) {
			setError(`Failed to add data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleUpdateDsConnection = async (dsConnection: ClientDataSourceConnection) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to update data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await updateDsConnection(projectId.value, dsConnection.id, dsConnection);
			setEditingDsConnection(null);
		} catch (err) {
			setError(`Failed to update data source: ${(err as Error).message}`);
		} finally {
			setLoading(false);
		}
	};

	const handleRemoveDsConnection = async (dsConnectionId: string) => {
		try {
			if (!projectId.value) {
				setLoading(false);
				setError(`Failed to set primary data source: projectId is not set`);
				return;
			}
			setLoading(true);
			setError(null);
			await removeDsConnection(projectId.value, dsConnectionId);
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
					onClick={() => setNewDsConnection(DEFAULT_DATA_SOURCE(dsConnections.value.length === 0))}
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
				{sortedDsConnections.value.length === 0
					? (
						<div className='text-gray-500 dark:text-gray-400 text-center py-4'>
							No data sources configured. Add one to get started.
						</div>
					)
					: (
						sortedDsConnections.value.map((source) => (
							<DataSourceItem
								key={source.id}
								dsConnection={source}
								onSetPrimary={() => handleSetPrimary(source.id)}
								onEdit={() => setEditingDsConnection(source)}
								onRemove={() => handleRemoveDsConnection(source.id)}
							/>
						))
					)}
			</div>

			{newDsConnection && (
				<DataSourceModal
					dsConnection={newDsConnection}
					appState={appState}
					onClose={() => setNewDsConnection(null)}
					onSave={handleAddDsConnection}
					dsProviders={dsProviders}
				/>
			)}

			{editingDsConnection && (
				<DataSourceModal
					dsConnection={editingDsConnection}
					appState={appState}
					onClose={() => setEditingDsConnection(null)}
					onSave={handleUpdateDsConnection}
					dsProviders={dsProviders}
				/>
			)}
		</div>
	);
}
