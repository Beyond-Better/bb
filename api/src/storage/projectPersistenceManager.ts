import { walk } from '@std/fs';
import { dirname, join, relative, resolve } from '@std/path';

import { logger } from 'shared/logger.ts';
import { migrateConversationResources } from 'shared/conversationMigration.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import { createExcludeRegexPatterns } from 'api/utils/fileHandling.ts';
import { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
//import type { RepoInfoConfigSchema } from 'shared/config/types.ts';
import type { CreateProjectData, ProjectData } from 'shared/types/project.ts';
import type { ProjectId } from 'shared/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import { getProjectRegistry, type ProjectRegistry } from 'shared/projectRegistry.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { createDataSourceBbDir, createDataSourceBbIgnore } from 'shared/dataDir.ts';
import { generateId } from 'shared/projectData.ts';
import ProjectPersistence from 'api/storage/projectPersistence.ts';
import { gitInitDataSource } from '../utils/git.utils.ts';

/**
 * Manager for ProjectPersistence instances
 * Serves as a factory for creating and retrieving ProjectPersistence instances
 * and provides operations that span multiple projects
 */
class ProjectPersistenceManager {
	private static instance: ProjectPersistenceManager;
	private static testInstances = new Map<string, ProjectPersistenceManager>();
	private registry!: ProjectRegistry;
	private projectCache = new Map<string, ProjectPersistence>();
	private pendingProjectOperations = new Map<string, Promise<ProjectPersistence | undefined>>();
	private initialized = false;

	private constructor() {}

	/**
	 * Gets the singleton instance of the ProjectPersistenceManager
	 */
	public static async getInstance(): Promise<ProjectPersistenceManager> {
		if (!ProjectPersistenceManager.instance) {
			ProjectPersistenceManager.instance = new ProjectPersistenceManager();
			await ProjectPersistenceManager.instance.init();
		}
		return ProjectPersistenceManager.instance;
	}

	// used for testing - constructor is private so create instance here
	public static async getOneUseInstance(): Promise<ProjectPersistenceManager> {
		logger.warn(
			`ProjectPersistenceManager: Creating a ONE-TIME instance of projectPersistenceManager - USE ONLY FOR TESTING`,
		);
		const instance = new ProjectPersistenceManager();
		await instance.init();
		return instance;
	}
	public static async getTestInstance(testId: string): Promise<ProjectPersistenceManager> {
		if (!ProjectPersistenceManager.testInstances.has(testId)) {
			logger.warn(
				`ProjectPersistenceManager: Creating a TEST instance of projectPersistenceManager with ID: ${testId}`,
			);
			const instance = new ProjectPersistenceManager();
			await instance.init();
			ProjectPersistenceManager.testInstances.set(testId, instance);
		}
		return ProjectPersistenceManager.testInstances.get(testId)!;
	}

	/**
	 * Initialize the ProjectPersistenceManager instance
	 */
	async init(): Promise<ProjectPersistenceManager> {
		logger.info(`ProjectPersistenceManager: Initializing`);
		this.registry = await getProjectRegistry();
		this.initialized = true;
		return this;
	}

	/**
	 * Ensure the instance is initialized
	 */
	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
		}
	}

	/**
	 * Gets a ProjectPersistence instance for a project
	 * If the project doesn't exist, returns null
	 */
	async getProject(projectId: ProjectId): Promise<ProjectPersistence | undefined> {
		await this.ensureInitialized();

		// Check if project exists in registry
		const registryProject = await this.registry.getProject(projectId);
		if (!registryProject) {
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to load project from registry: ${projectId}`,
				{
					projectId: projectId,
				} as ProjectHandlingErrorOptions,
			);
		}

		// Return from cache if available
		if (this.projectCache.has(projectId)) {
			return this.projectCache.get(projectId)!;
		}

		// Use atomic check-and-set pattern for concurrent requests
		let projectOperation = this.pendingProjectOperations.get(projectId);

		if (!projectOperation) {
			// Only create a new promise if one doesn't exist yet
			//logger.info(`ProjectPersistenceManager: getProject: Creating ProjectPersistence for ${projectId}`);
			projectOperation = this.createProjectWithLock(projectId);
			this.pendingProjectOperations.set(projectId, projectOperation);

			// Since we created this promise, we're responsible for cleanup
			this.scheduleCleanup(projectId, projectOperation);
		}

		// Wait on the promise, whether we just created it or found an existing one
		return await projectOperation;
	}

	/**
	 * Helper method to clean up pending operations
	 */
	private scheduleCleanup(projectId: ProjectId, operation: Promise<ProjectPersistence | undefined>): void {
		const cleanup = async () => {
			// logger.info(
			// 	`ProjectPersistenceManager: Waiting to clean up after creating ProjectPersistence for ${projectId}`,
			// );
			try {
				await operation;
			} finally {
				// Only delete if our promise is still the one in the map
				if (this.pendingProjectOperations.get(projectId) === operation) {
					this.pendingProjectOperations.delete(projectId);
					logger.info(`ProjectPersistenceManager: Cleaned up promise for ${projectId}`);
				}
			}
		};
		// Start cleanup process but don't wait for it
		cleanup();
	}

	/**
	 * Atomic operation to create a ProjectPersistence instance
	 */
	private async createProjectWithLock(projectId: ProjectId): Promise<ProjectPersistence | undefined> {
		try {
			const projectPersistence = new ProjectPersistence(projectId);
			await projectPersistence.init();

			// Migrate conversation resources to the new format
			try {
				//logger.info(`ProjectPersistenceManager: Migrating conversation resources for project ${projectId}`);
				await migrateConversationResources(projectId, projectPersistence);
				//logger.info(
				//	`ProjectPersistenceManager: Successfully migrated conversation resources for project ${projectId}`,
				//);
			} catch (migrationError) {
				logger.warn(
					`ProjectPersistenceManager: Error during resource migration for project ${projectId}: ${
						(migrationError as Error).message
					}`,
				);
				// Continue loading project even if migration fails
			}

			this.projectCache.set(projectId, projectPersistence);
			return projectPersistence;
		} catch (error) {
			logger.error(
				`ProjectPersistenceManager: Failed to get project: ${(error as Error).message}`,
			);
			return undefined;
		}
	}

	/**
	 * Creates a new project
	 */
	async createProject(projectData: CreateProjectData): Promise<ProjectPersistence> {
		await this.ensureInitialized();

		try {
			// Generate new project ID
			const projectId = await this.generateProjectId();
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: `);

			// Create project data
			const newProjectData: ProjectData = {
				projectId,
				name: projectData.name,
				status: projectData.status || 'draft',
				dsConnections: projectData.dsConnections as DataSourceConnection[],
				repoInfo: projectData.repoInfo || { tokenLimit: 1024 },
				//defaultModels: projectData.defaultModels || DefaultModelsConfigDefaults,
				mcpServers: projectData.mcpServers || [],
			};

			// Extract filesystem paths from data sources
			const dataSourcePaths = DataSourceConnection.getDataSourcePathsFromDsConnections(projectData.dsConnections);
			const primaryDataSourceRoot = dataSourcePaths[0] || '';
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: `, {
			//	primaryDataSourceRoot,
			//	dataSourcePaths,
			//});

			// Save to registry
			await this.registry.saveProject({
				projectId,
				name: projectData.name,
				status: projectData.status || 'draft',
				dataSourcePaths,
			});
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: saved project to registry`);

			// Initialize config (app behavior overrides)
			const newConfigData = {
				projectId,
				name: projectData.name,
				myPersonsName: projectData.myPersonsName,
				myAssistantsName: projectData.myAssistantsName,
				defaultModels: projectData.defaultModels || DefaultModelsConfigDefaults,
			};
			const configManager = await getConfigManager();
			await configManager.createProjectConfig(
				projectId,
				newConfigData,
				primaryDataSourceRoot,
			);
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: created project config`);

			if (projectData.anthropicApiKey !== undefined) {
				await configManager.setProjectConfigValue(
					projectId,
					'api.llmProviders.anthropic.apiKey',
					projectData.anthropicApiKey,
				);
			}

			if (projectData.useTls !== undefined) {
				await configManager.setProjectConfigValue(projectId, 'api.tls.useTls', projectData.useTls.toString());
			}
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: updated project config`);

			// Create ProjectPersistence instance
			let projectOperation = this.pendingProjectOperations.get(projectId);

			if (!projectOperation) {
				// Only create a new promise if one doesn't exist yet
				//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: Creating ProjectPersistence`);
				projectOperation = this.createProjectWithLock(projectId);
				this.pendingProjectOperations.set(projectId, projectOperation);
				// Since we created this promise, we're responsible for cleanup
				this.scheduleCleanup(projectId, projectOperation);
			}

			const projectPersistence = await projectOperation;
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: created project data instance`);
			if (!projectPersistence) {
				throw createError(
					ErrorType.ProjectHandling,
					`Failed to load new project`,
					{
						projectId: projectId,
					} as ProjectHandlingErrorOptions,
				);
			}

			// Save project data
			await projectPersistence.update(newProjectData);
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: updated project data instance`);

			for (const dsConnection of projectData.dsConnections) {
				if (dsConnection.providerType === 'filesystem' && dsConnection.config.dataSourceRoot) {
					const dataSourcePath = dsConnection.config.dataSourceRoot as string;
					// Create .bb dir and ignore file for filesystem data sources
					await createDataSourceBbDir(dataSourcePath);
					await createDataSourceBbIgnore(dataSourcePath);
					// Don't create git repo for projects created in unit tests
					if (!Deno.env.get('SKIP_PROJECT_GIT_REPO')) {
						await gitInitDataSource(dataSourcePath);
					}
				}
			}
			//logger.info(`ProjectPersistenceManager: createProject[${projectId}]: initialized data sources`, {project: projectPersistence.dsConnections});

			logger.info(`ProjectPersistenceManager: Created project ${projectId}`);

			return projectPersistence;
		} catch (error) {
			logger.error(
				`ProjectPersistenceManager: Failed to create project: ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create project: ${(error as Error).message}`,
				{
					filePath: 'project.json',
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async deleteProject(projectId: ProjectId): Promise<void> {
		const project = await this.getProject(projectId);
		if (project) project.delete();
	}

	/**
	 * Lists all projects
	 */
	async listProjects(): Promise<ProjectPersistence[]> {
		await this.ensureInitialized();
		try {
			const registryProjects = await this.registry.listProjects();

			const projectsData: ProjectPersistence[] = [];

			for (const registeredPproject of registryProjects) {
				const project = await this.getProject(registeredPproject.projectId);
				if (project) {
					projectsData.push(project);
				}
			}

			return projectsData;
		} catch (error) {
			logger.error(`ProjectPersistenceManager: Failed to list projects: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to list projects: ${(error as Error).message}`,
				{
					filePath: 'projects.json',
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Find a project by path
	 */
	async findProjectByPath(path: string): Promise<ProjectPersistence | undefined> {
		await this.ensureInitialized();

		try {
			const registryProject = await this.registry.findProjectByPath(path);
			if (!registryProject) return undefined;

			return await this.getProject(registryProject.projectId);
		} catch (error) {
			logger.error(
				`ProjectPersistenceManager: Failed to find project by path ${path}: ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to find project by path: ${(error as Error).message}`,
				{
					filePath: path,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Find projects with .bb directories in the specified search directory
	 */
	async findV1Projects(searchDir: string): Promise<string[]> {
		const projects: string[] = [];

		try {
			const excludeDirs = [
				'Library/**',
				'**/node_modules/**',
				'**/.git/**',
				'**/.svn/**',
				'**/.hg/**',
				'**/.cache/**',
				'**/tmp/**',
			];

			const fullSearchPath = resolve(searchDir);
			const excludePatterns = createExcludeRegexPatterns(excludeDirs, fullSearchPath);
			logger.info(
				`ProjectPersistenceManager: searching with excludePatterns: ${fullSearchPath}`,
				excludePatterns,
			);

			const walkEntries = walk(fullSearchPath, {
				includeDirs: true,
				followSymlinks: false,
				skip: excludePatterns,
			});

			for await (const entry of walkEntries) {
				try {
					if (entry.isDirectory && entry.name === '.bb') {
						const ignoreFilePath = join(entry.path, 'ignore');
						try {
							const ignoreFileStat = await Deno.stat(ignoreFilePath);
							if (ignoreFileStat.isFile) {
								// The project root is the parent directory of the .bb directory
								const projectPath = dirname(entry.path);
								const relativePath = relative(fullSearchPath, projectPath);

								// Skip if this is a hidden directory or common excluded directory
								if (
									!relativePath.split('/').some((part) =>
										part.startsWith('.') ||
										['node_modules', 'Library', 'tmp', 'cache'].includes(part)
									)
								) {
									projects.push(projectPath);
								}
							}
						} catch (ignoreFileError) {
							// Not a valid project directory or can't access ignoreFile file, continue searching
							if (ignoreFileError instanceof Deno.errors.PermissionDenied) {
								logger.warn(
									`ProjectPersistenceManager: Permission denied accessing ignoreFile file: ${ignoreFilePath}`,
								);
							}
						}
					}
				} catch (entryError) {
					// Handle permission errors for individual entries
					if (entryError instanceof Deno.errors.PermissionDenied) {
						logger.warn(`ProjectPersistenceManager: Permission denied accessing directory: ${entry.path}`);
						continue;
					}
					// For other errors, log and continue
					logger.warn(
						`ProjectPersistenceManager: Error processing entry ${entry.path}: ${
							(entryError as Error).message
						}`,
					);
				}
			}

			return projects;
		} catch (error) {
			// Handle errors that occur outside the walk loop
			if (error instanceof Deno.errors.PermissionDenied) {
				logger.warn(`ProjectPersistenceManager: Permission denied accessing search directory: ${searchDir}`);
				return projects; // Return any projects found before the error
			}

			logger.error(`ProjectPersistenceManager: Failed to find v1 projects: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to find v1 projects: ${(error as Error).message}`,
				{
					filePath: searchDir,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Generate a unique project ID
	 */
	private async generateProjectId(): Promise<string> {
		return generateId();
	}

	/**
	 * Clears a project from the cache
	 */
	releaseProject(projectId: ProjectId): void {
		this.projectCache.delete(projectId);
	}
}

export default ProjectPersistenceManager;

/**
 * Gets the global projectPeristenceManager instance
 */
export async function getProjectPersistenceManager(): Promise<ProjectPersistenceManager> {
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_PROJECT_PERSISTENCE_MANAGER'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return ProjectPersistenceManager.getOneUseInstance();
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return ProjectPersistenceManager.getTestInstance(testId);
	return ProjectPersistenceManager.getInstance();
}
