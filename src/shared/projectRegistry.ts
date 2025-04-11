import { ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import { getGlobalConfigDir } from 'shared/dataDir.ts';
import { logger } from 'shared/logger.ts';
import type { ProjectType } from 'shared/config/types.ts';
import type { ProjectData, ProjectStatus } from 'shared/types/project.ts';

// Storage interfaces
export interface StoredProjectV0 {
	name: string;
	path: string;
	type: ProjectType;
}

export interface StoredProjectV1 {
	name: string;
	status: ProjectStatus;
	dataSourcePaths: string[]; // Array of paths for filesystem datasources
}
export interface ReturnedProjectV1 {
	projectId: string;
	name: string;
	status: ProjectStatus;
	dataSourcePaths: string[]; // Array of paths for filesystem datasources
}

export interface ProjectsFileV1 {
	version: string;
	projects: {
		[projectId: string]: StoredProjectV1;
	};
}

/**
 * ProjectRegistry manages the global registry of projects in projects.json
 * It serves as the single source of truth for mapping project IDs to filesystem paths.
 *
 * IMPORTANT: This class has a limited responsibility - it only manages the mapping between
 * project IDs and filesystem paths. It does not manage project configuration or data.
 * It should not be used directly by most code - use ProjectPersistence instead.
 */
export class ProjectRegistry {
	private static instance: ProjectRegistry;
	private static testInstances = new Map<string, ProjectRegistry>();
	private projectsPath!: string;
	private initialized = false;
	private ensuredDirs: Set<string> = new Set();
	private projectsData: ProjectsFileV1 | null = null;

	private constructor() {}

	/**
	 * Gets the singleton instance of the ProjectRegistry.
	 */
	public static async getInstance(): Promise<ProjectRegistry> {
		if (!ProjectRegistry.instance) {
			ProjectRegistry.instance = new ProjectRegistry();
			await ProjectRegistry.instance.init();
		}
		return ProjectRegistry.instance;
	}

	// used for testing - constructor is private so create instance here
	public static async getOneUseInstance(): Promise<ProjectRegistry> {
		logger.warn(`ProjectRegistry: Creating a ONE-TIME instance of projectRegistry - USE ONLY FOR TESTING`);
		const instance = new ProjectRegistry();
		await instance.init();
		return instance;
	}
	public static async getTestInstance(testId: string): Promise<ProjectRegistry> {
		if (!ProjectRegistry.testInstances.has(testId)) {
			logger.warn(`ProjectRegistry: Creating a TEST instance of projectRegistry with ID: ${testId}`);
			const instance = new ProjectRegistry();
			await instance.init();
			ProjectRegistry.testInstances.set(testId, instance);
		}
		return ProjectRegistry.testInstances.get(testId)!;
	}

	/**
	 * Initializes the ProjectRegistry by setting up the projects.json path
	 */
	private async init(): Promise<void> {
		const configDir = await getGlobalConfigDir();
		this.projectsPath = join(configDir, 'projects.json');
		await this.ensureDirectory(dirname(this.projectsPath));
		this.initialized = true;
	}

	/**
	 * Ensures a directory exists, tracking which directories have been created to avoid redundant calls
	 */
	private async ensureDirectory(dir: string): Promise<void> {
		if (!this.ensuredDirs.has(dir)) {
			await ensureDir(dirname(dir)); // Ensure parent directory exists
			await ensureDir(dir);
			this.ensuredDirs.add(dir);
		}
	}

	/**
	 * Reads projects.json file and performs migration if needed
	 */
	private async loadProjectsFile(): Promise<ProjectsFileV1> {
		if (!await exists(this.projectsPath)) {
			logger.info(`ProjectRegistry: Creating new projects.json - using: ${this.projectsPath}`);
			// Create new empty projects file with the new format
			const newData: ProjectsFileV1 = {
				version: '1.0',
				projects: {},
			};
			await Deno.writeTextFile(this.projectsPath, JSON.stringify(newData, null, '\t'));
			return newData;
		}

		try {
			const content = await Deno.readTextFile(this.projectsPath);
			const data = JSON.parse(content);

			// Detect format and migrate if needed
			return await this.migrateProjectsFileIfNeeded(data);
		} catch (error) {
			logger.error(`ProjectRegistry: Failed to read projects.json: ${(error as Error).message}`);
			throw new Error(`Failed to read projects registry: ${(error as Error).message}`);
		}
	}

	/**
	 * Checks if projects file needs migration and performs it if necessary
	 */
	private async migrateProjectsFileIfNeeded(data: any): Promise<ProjectsFileV1> {
		// If already in the new format with version and projects, return as is
		if (data.version && data.projects) {
			return data as ProjectsFileV1;
		}

		// Old format detected - migrate to new format
		logger.info(`ProjectRegistry: Migrating projects.json to new format`);

		const migratedData: ProjectsFileV1 = {
			version: '1.0',
			projects: {},
		};

		// Copy projects from old format to new structure
		for (const [id, project] of Object.entries(data)) {
			const { type, path, ...rest } = project as { type: string; path: string };
			migratedData.projects[id] = {
				...rest as StoredProjectV0,
				status: 'active',
				// Initialize with single dataSourcePath matching the original path
				dataSourcePaths: [path],
			};
		}

		// Save the migrated format
		await Deno.writeTextFile(this.projectsPath, JSON.stringify(migratedData, null, '\t'));
		logger.info(`ProjectRegistry: Successfully migrated projects.json to new format`);

		return migratedData;
	}

	/**
	 * Saves the projects file with current data
	 */
	private async saveProjectsFile(): Promise<void> {
		if (!this.projectsData) {
			throw new Error('Cannot save projects file: No data loaded');
		}

		try {
			//logger.info(`ProjectRegistry: Saving file projects.json: ${this.projectsPath}`, { projectsData: this.projectsData });
			await Deno.writeTextFile(this.projectsPath, JSON.stringify(this.projectsData, null, '\t'));
		} catch (error) {
			logger.error(`ProjectRegistry: Failed to save projects.json: ${(error as Error).message}`);
			throw new Error(`Failed to save projects registry: ${(error as Error).message}`);
		}
	}

	/**
	 * Lists all projects in the registry
	 */
	public async listProjects(): Promise<Array<ReturnedProjectV1>> {
		if (!this.projectsData) {
			this.projectsData = await this.loadProjectsFile();
		}

		return Object.entries(this.projectsData.projects).map(([id, project]) => ({
			projectId: id,
			...project,
		}));
	}

	/**
	 * Gets a project by its ID
	 */
	public async getProject(projectId: string): Promise<ReturnedProjectV1 | null> {
		if (!this.projectsData) {
			//logger.info(`ProjectRegistry: No projectsData - loading from file for: ${projectId}`);
			this.projectsData = await this.loadProjectsFile();
			//logger.info(`ProjectRegistry: Loaded projectsData - Getting data for: ${projectId}`, {
			//	projectsData: this.projectsData,
			//});
		}

		const project = this.projectsData.projects[projectId];
		return project
			? {
				projectId,
				//status: 'active', // this is temporary - poor mans migration to add status field
				...project,
			}
			: null;
	}

	/**
	 * Gets a project by its ID
	 */
	public async getDataSourcePaths(projectId: string): Promise<string[]> {
		const project = await this.getProject(projectId);
		if (!project) {
			return [];
		}
		return project.dataSourcePaths || [];
	}

	/**
	 * Finds a project by its path
	 * First checks exact path match, then checks if path is in dataSourcePaths
	 */
	public async findProjectByPath(path: string): Promise<ReturnedProjectV1 | null> {
		if (!this.projectsData) {
			this.projectsData = await this.loadProjectsFile();
		}

		// // First check for exact path match
		// for (const [id, project] of Object.entries(this.projectsData.projects)) {
		// 	if (project.path === path) {
		// 		return { projectId: id, ...project };
		// 	}
		// }

		// Then check dataSourcePaths if path is in any project's dataSources
		for (const [id, project] of Object.entries(this.projectsData.projects)) {
			if (project.dataSourcePaths && project.dataSourcePaths.includes(path)) {
				return { projectId: id, ...project };
			}
		}

		return null;
	}

	/**
	 * Adds or updates a project in the registry
	 */
	public async saveProject(project: ReturnedProjectV1): Promise<void> {
		if (!this.projectsData) {
			//logger.info(`ProjectRegistry: No projectsData - loading from file`);
			this.projectsData = await this.loadProjectsFile();
		}

		const { projectId, ...projectData } = project;
		//logger.info(`ProjectRegistry: Saving projects:`, { projectId, projectData });
		this.projectsData.projects[projectId] = projectData;

		await this.saveProjectsFile();
		logger.info(`ProjectRegistry: Saved project ${projectId}`);
	}

	/**
	 * Removes a project from the registry
	 */
	public async deleteProject(projectId: string): Promise<void> {
		if (!this.projectsData) {
			this.projectsData = await this.loadProjectsFile();
		}

		if (projectId in this.projectsData.projects) {
			delete this.projectsData.projects[projectId];
			await this.saveProjectsFile();
			logger.info(`ProjectRegistry: Deleted project ${projectId}`);
		}
	}

	/**
	 * Updates or adds a data source path to a project
	 */
	public async addDataSourcePath(projectId: string, path: string): Promise<void> {
		if (!this.projectsData) {
			this.projectsData = await this.loadProjectsFile();
		}

		const project = this.projectsData.projects[projectId];
		if (!project) {
			throw new Error(`Project ${projectId} not found in registry`);
		}

		// // Initialize dataSourcePaths if not exists
		// if (!project.dataSourcePaths) {
		// 	project.dataSourcePaths = [project.path]; // Add original path as first dataSource
		// }

		// Add new path if not already present
		if (!project.dataSourcePaths?.includes(path)) {
			if (!project.dataSourcePaths) project.dataSourcePaths = [];
			project.dataSourcePaths.push(path);
			await this.saveProjectsFile();
			logger.info(`ProjectRegistry: Added data source path ${path} to project ${projectId}`);
		}
	}

	/**
	 * Removes a data source path from a project
	 */
	public async removeDataSourcePath(projectId: string, path: string): Promise<void> {
		if (!this.projectsData) {
			this.projectsData = await this.loadProjectsFile();
		}

		const project = this.projectsData.projects[projectId];
		if (!project) {
			throw new Error(`Project ${projectId} not found in registry`);
		}

		if (!project.dataSourcePaths) {
			return; // Nothing to remove
		}

		// Remove path
		const index = project.dataSourcePaths.indexOf(path);
		if (index !== -1) {
			project.dataSourcePaths.splice(index, 1);
			await this.saveProjectsFile();
			logger.info(`ProjectRegistry: Removed data source path ${path} from project ${projectId}`);
		}
	}
}

/**
 * Gets the global project registry instance
 */
export async function getProjectRegistry(): Promise<ProjectRegistry> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_PROJECT_REGISTRY'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return ProjectRegistry.getOneUseInstance();
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return ProjectRegistry.getTestInstance(testId);
	return ProjectRegistry.getInstance();
}
