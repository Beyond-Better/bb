import { type Signal, signal, useSignal } from '@preact/signals';
import { ProjectType } from 'shared/config/v2/types.ts';
import type { AppState } from '../types/websocket.types.ts';

export interface ProjectStats {
	conversationCount: number;
	totalTokens: number;
	lastAccessed: string;
}

export interface Project {
	projectId: string;
	name: string;
	path: string;
	type: ProjectType;
	stats?: ProjectStats;
}

export interface ProjectState {
	projects: Project[];
	loading: boolean;
	error: string | null;
}

const initialState: ProjectState = {
	projects: [],
	loading: false,
	error: null,
};

// Load initial state from localStorage and URL
const loadStoredState = () => {
	return {};
};

// Update URL parameters
const updateUrlParams = (projectId: string | null) => {
	if (typeof window === 'undefined') return;

	const url = new URL(window.location.href);
	if (projectId) {
		url.searchParams.set('projectId', projectId);
	} else {
		url.searchParams.delete('projectId');
	}

	window.history.replaceState({}, '', url.toString());
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
			const response = await apiClient?.listProjects();
			console.log('useProjectState: loadProjects', response);
			if (response) {
				// If we have a selectedProjectId but it's not in the projects list,
				// we should clear it
				const projectExists = response.projects.some(
					(p) => p.projectId === projectState.value.selectedProjectId,
				);

				projectState.value = {
					...projectState.value,
					projects: response.projects,
	
					loading: false,
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

	async function createProject(project: Omit<Project, 'projectId'>) {
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
			}
		} catch (error) {
			projectState.value = {
				...projectState.value,
				error: `Failed to create project: ${(error as Error).message}`,
				loading: false,
			};
		}
	}

	async function updateProject(projectId: string, updates: Partial<Omit<Project, 'projectId'>>) {
		const apiClient = appState.value.apiClient;
		projectState.value = { ...projectState.value, loading: true, error: null };
		try {
			const response = await apiClient?.updateProject(projectId, updates);
			if (response) {
				projectState.value = {
					...projectState.value,
					projects: projectState.value.projects.map((p) => p.projectId === projectId ? response.project : p),
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
				projects: projectState.value.projects.filter((p) => p.projectId !== projectId),

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
	}

	function getSelectedProject(): Project | null {
		if (!selectedProjectId.value) return null;
		return projectState.value.projects.find(
			(p) => p.projectId === selectedProjectId.value,
		) || null;
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
		loadProjects,
		createProject,
		updateProject,
		deleteProject,
		findV1Projects,
		migrateAndAddProject,
		setSelectedProject,
		getSelectedProject,
		//updateProjectStats,
	};
}
