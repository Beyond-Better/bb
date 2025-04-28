import { computed, type Signal, signal } from '@preact/signals';
import type { AppState } from './useAppState.ts';
import type {
	ClientDataSourceConnection,
	//ClientProjectData,
	ClientProjectWithConfigForUpdates,
	ClientProjectWithConfigSources,
	//ProjectWithSources,
} from 'shared/types/project.ts';
//import { toProject } from 'shared/types/project.ts';
import { MCPServerConfig } from 'shared/config/types.ts';
import type { DataSourceProviderInfo } from 'shared/types/dataSource.ts';

export interface ProjectState {
	projects: ClientProjectWithConfigSources[];
	dsProviders: DataSourceProviderInfo[]; // Add data source types
	mcpServers: MCPServerConfig[];
	loading: boolean;
	error: string | null;
}

const initialState: ProjectState = {
	projects: [],
	dsProviders: [], // Initialize empty data source types array
	mcpServers: [], // Initialize empty MCP servers array
	loading: false,
	error: null,
};

// Load initial state from localStorage and URL
const loadStoredState = () => {
	return {};
};

// Update URL parameters
const updateUrlParams = (projectId: string | null) => {
	if (typeof globalThis === 'undefined') return;

	const url = new URL(globalThis.location.href);
	if (projectId) {
		url.searchParams.set('projectId', projectId);
	} else {
		url.searchParams.delete('projectId');
	}

	globalThis.history.replaceState({}, '', url.toString());
};

// Update localStorage
const updateLocalStorage = (projectId: string | null) => {
	if (typeof localStorage === 'undefined') return;

	if (projectId) {
		localStorage.setItem('bb_projectId', projectId);
	} else {
		localStorage.removeItem('bb_projectId');
	}
};

// Global state
const projectState = signal<ProjectState>({
	...initialState,
	...loadStoredState(),
});

export function useProjectState(appState: Signal<AppState>) {
	// Compute selectedProjectId from appState
	const selectedProjectId = computed(() => appState.value.projectId);
	// functions for managing ProjectState
	async function loadProjects() {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			// Get project list

			// Create both promises simultaneously
			const projectsPromise = apiClient?.listProjects();
			const datasourceTypesPromise = apiClient?.getDsProviders(); //projectState.value.mcpServers
			const globalConfigPromise = apiClient?.getGlobalConfig();

			// Wait for both to complete
			const [projectsResponse, datasourceTypesResponse, globalConfigResponse] = await Promise.all([
				projectsPromise,
				datasourceTypesPromise,
				globalConfigPromise,
			]);

			console.log('useProjectState: loadProjects', projectsResponse);
			if (projectsResponse) {
				const projectExists = projectsResponse.projects.some(
					(p) => p.data.projectId === selectedProjectId.value,
				);

				projectState.value = {
					...projectState.value,
					projects: projectsResponse.projects,
					loading: false,
				};

				if (!projectExists && selectedProjectId.value) {
					setSelectedProject(null);
				}
			}

			if (datasourceTypesResponse) {
				//console.log('useProjectState: setting dsProviders', { dsProviders: datasourceTypesResponse.dsProviders });
				projectState.value = {
					...projectState.value,
					dsProviders: datasourceTypesResponse.dsProviders,
				};
			}

			if (globalConfigResponse) {
				//console.log('useProjectState: setting mcpServers', { mcpServers: globalConfigResponse.api.mcpServers });
				projectState.value = {
					...projectState.value,
					mcpServers: globalConfigResponse.api.mcpServers || [],
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to load projects: ${(error as Error).message}`,
				loading: false,
			};
		}
	}

	async function getBlankProject(): Promise<ClientProjectWithConfigSources | undefined> {
		const apiClient = appState.value.apiClient;
		try {
			const response = await apiClient?.blankProject();
			return response?.project || undefined;
		} catch (error) {
			console.log('useProjectState: unable to get blank project', error);
			return undefined;
		}
	}

	async function createProject(
		project: ClientProjectWithConfigForUpdates,
	): Promise<ClientProjectWithConfigSources | undefined> {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			const response = await apiClient?.createProject(project);
			if (response) {
				projectState.value = {
					...projectState.value,
					projects: [...projectState.value.projects, response.project],
					loading: false,
				};
				return response.project;
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to create project: ${(error as Error).message}`,
				loading: false,
			};
		}
	}

	async function updateProject(projectId: string, updates: Partial<ClientProjectWithConfigForUpdates>) {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			// Update project metadata
			const response = await apiClient?.updateProject(projectId, updates);

			if (response) {
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) =>
						p.data.projectId === projectId ? response.project : p
					),
					loading: false,
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to update project: ${(error as Error).message}`,
				loading: false,
			};
		}
	}

	async function deleteProject(projectId: string) {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			await apiClient?.deleteProject(projectId);
			projectState.value = {
				...projectState.value,
				projects: projectState.value.projects.filter((p) => p.data.projectId !== projectId),
				loading: false,
			};
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to delete project: ${(error as Error).message}`,
				loading: false,
			};
		}
	}

	async function migrateAndAddProject(projectPath: string): Promise<void> {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			await apiClient?.migrateAndAddProject(projectPath);
			await loadProjects(); // Refresh the project list
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to migrate project: ${(error as Error).message}`,
			};
			throw error; // Re-throw to allow UI to handle the error
		} finally {
			projectState.value = { ...projectState.value, loading: false };
		}
	}

	async function findV1Projects(searchDir: string): Promise<string[]> {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		console.log('useProjectState: findV1Projects', searchDir);
		try {
			const response = await apiClient?.findV1Projects(searchDir);
			if (response) {
				await loadProjects();
				return response.projects;
			}
			return [];
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to find v1 projects: ${(error as Error).message}`,
			};
			return [];
		} finally {
			projectState.value = { ...projectState.value, loading: false };
		}
	}

	function setSelectedProject(projectId: string | null) {
		// Update appState instead of projectState
		appState.value = {
			...appState.value,
			projectId: projectId,
		};

		// Update URL and localStorage
		updateUrlParams(projectId);
		updateLocalStorage(projectId);

		// If we have a projectId and an API client, fetch the filtered data source types
		if (projectId && appState.value.apiClient) {
			// This won't block the function from returning
			//console.log(`useProjectState: setSelectedProject: ${projectId}`);
			appState.value.apiClient.getDsProvidersForProject(projectId)
				.then((response) => {
					//console.log(`useProjectState: setSelectedProject: ${projectId} - got dsProviders`, {
					//	dsProviders: response?.dsProviders,
					//});
					if (response) {
						// Only update if this is still the selected project (user might have changed)
						if (appState.value.projectId === projectId) {
							projectState.value = {
								...projectState.value,
								dsProviders: response.dsProviders,
							};
						}
					}
				})
				.catch((error) => {
					console.error('Failed to fetch data source types for project:', error);
					// Don't update the error state since this is a background operation
				});
		} else if (!projectId) {
			// If no project is selected, reset to all data source types
			appState.value.apiClient?.getDsProviders()
				.then((response) => {
					//console.log(`useProjectState: setSelectedProject: no-project`, {
					//	dsProviders: response?.dsProviders,
					//});
					if (response) {
						projectState.value = {
							...projectState.value,
							dsProviders: response.dsProviders,
						};
					}
				})
				.catch((error) => {
					console.error('Failed to fetch all data source types:', error);
				});
		}
	}

	//function getSelectedProject(): ClientProjectWithConfigSources | null {
	//	if (!selectedProjectId.value) return null;
	//
	//	const project = projectState.value.projects.find(
	//		(p) => p.data.projectId === selectedProjectId.value,
	//	) || null;
	//
	//	return project;
	//}
	//// Helper function to get project config for selected project
	//function getSelectedProjectConfig(): ProjectWithSources | null {
	//	const project = getSelectedProject();
	//	if (!project) return null;
	//	return project.config;
	//}
	//// Helper function to get project data for selected project
	//function getSelectedProjectData(): ClientProjectData | null {
	//	const project = getSelectedProject();
	//	if (!project) return null;
	//	return project.data;
	//}

	// Helper function to get available data source types
	function getDsProviders(): DataSourceProviderInfo[] {
		return projectState.value.dsProviders;
	}
	// Helper function to get available data source types
	function getMCPServers(): MCPServerConfig[] {
		return projectState.value.mcpServers;
	}

	// Data source management methods
	async function addDsConnection(projectId: string, dsConnection: ClientDataSourceConnection): Promise<void> {
		const apiClient = appState.value.apiClient;
		if (!apiClient) return;

		try {
			projectState.value = { ...projectState.value, loading: true, error: null };
			const response = await apiClient.addDsConnection(projectId, dsConnection);

			if (response) {
				// Update the projects list with the new data
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) =>
						p.data.projectId === projectId ? response.project : p
					),
					loading: false,
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to add data source: ${(error as Error).message}`,
				loading: false,
			};
			throw error;
		}
	}

	// Update an existing data source
	async function updateDsConnection(
		projectId: string,
		dsConnectionId: string,
		updates: Partial<ClientDataSourceConnection>,
	): Promise<void> {
		const apiClient = appState.value.apiClient;
		if (!apiClient) return;

		try {
			projectState.value = { ...projectState.value, loading: true, error: null };
			const response = await apiClient.updateDsConnection(projectId, dsConnectionId, updates);

			if (response) {
				// Update the projects list with the new data
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) =>
						p.data.projectId === projectId ? response.project : p
					),
					loading: false,
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to update data source: ${(error as Error).message}`,
				loading: false,
			};
			throw error;
		}
	}

	// Remove a data source
	async function removeDsConnection(projectId: string, dsConnectionId: string): Promise<void> {
		const apiClient = appState.value.apiClient;
		if (!apiClient) return;

		try {
			projectState.value = { ...projectState.value, loading: true, error: null };
			const response = await apiClient.removeDsConnection(projectId, dsConnectionId);

			if (response) {
				// Update the projects list with the new data
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) =>
						p.data.projectId === projectId ? response.project : p
					),
					loading: false,
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to remove data source: ${(error as Error).message}`,
				loading: false,
			};
			throw error;
		}
	}

	// Set a data source as primary
	async function setPrimaryDsConnection(projectId: string, dsConnectionId: string): Promise<void> {
		const apiClient = appState.value.apiClient;
		if (!apiClient) return;

		try {
			projectState.value = { ...projectState.value, loading: true, error: null };
			const response = await apiClient.setPrimaryDsConnection(projectId, dsConnectionId);

			if (response) {
				// Update the projects list with the new data
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) =>
						p.data.projectId === projectId ? response.project : p
					),
					loading: false,
				};
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to set primary data source: ${(error as Error).message}`,
				loading: false,
			};
			throw error;
		}
	}

	// Update project stats
	/*
	async function updateProjectStats(projectId: string, stats: ProjectStats) {
		const apiClient = appState.value.apiClient;
		let retryCount = 0;
		const maxRetries = 3;

		while (retryCount < maxRetries) {
			try {
				await apiClient.put(`/api/v1/project/${projectId}/stats`, stats);
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) => p.projectId === projectId ? { ...p, stats } : p),
				};
			} catch (error) {
				console.error(
					`Failed to update project stats (attempt ${retryCount + 1}): ${(error as Error).message}`,
				);
				retryCount++;
				if (retryCount < maxRetries) {
					// Wait before retrying (exponential backoff)
					await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
					continue;
				}
				// Only set error state if all retries failed and it's a network error
				if (error instanceof Error && error.message.includes('network')) {
					projectState.value = {
						...projectState.value,
						error: `Failed to update project stats: ${error.message}`,
					};
				}
				// For other errors, just log them as this is a background operation
				console.error('Failed to update project stats after all retries:', error);
			}
			break;
		}
	}
	 */

	return {
		state: projectState,
		selectedProjectId,
		loadProjects,
		getBlankProject,
		createProject,
		updateProject,
		deleteProject,
		findV1Projects,
		migrateAndAddProject,
		setSelectedProject,
		//getSelectedProject,
		//getSelectedProjectConfig,
		//getSelectedProjectData,
		getDsProviders,
		getMCPServers,
		// Data source management methods
		addDsConnection,
		updateDsConnection,
		removeDsConnection,
		setPrimaryDsConnection,
		//updateProjectStats,
	};
}
