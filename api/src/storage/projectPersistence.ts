import { ensureDir, exists, walk } from '@std/fs';
import { dirname, join, relative, resolve } from '@std/path';
import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';

import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { FileHandlingErrorOptions } from 'api/errors/error.ts';
import { createExcludeRegexPatterns, getExcludeOptions } from 'api/utils/fileHandling.ts';
import type { ProjectConfig, ProjectType } from 'shared/config/v2/types.ts';
import { getGlobalConfigDir } from 'shared/dataDir.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';

interface StoredProject {
	name: string;
	path: string;
	type: ProjectType;
	projectId: string;
}

class ProjectPersistence {
	private projectsPath!: string;
	private initialized = false;
	private ensuredDirs: Set<string> = new Set();

	constructor() {
	}

	async init(): Promise<ProjectPersistence> {
		const configDir = await getGlobalConfigDir();
		this.projectsPath = join(configDir, 'projects.json');
		await this.ensureDirectory(dirname(this.projectsPath));
		return this;
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
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

	async listProjects(): Promise<StoredProject[]> {
		await this.ensureInitialized();
		try {
			if (!await exists(this.projectsPath)) {
				await Deno.writeTextFile(this.projectsPath, JSON.stringify({}));
				return [];
			}

			const content = await Deno.readTextFile(this.projectsPath);
			const projects = JSON.parse(content);
			return Object.entries(projects).map(([id, project]) => ({
				projectId: id,
				...(project as Omit<StoredProject, 'projectId'>),
			}));
		} catch (error) {
			logger.error(`ProjectPersistence: Failed to list projects: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to list projects: ${(error as Error).message}`,
				{
					filePath: this.projectsPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async getProject(projectId: string): Promise<StoredProject | null> {
		await this.ensureInitialized();
		try {
			if (!await exists(this.projectsPath)) {
				return null;
			}

			const content = await Deno.readTextFile(this.projectsPath);
			const projects = JSON.parse(content);
			const project = projects[projectId];

			return project ? { projectId, ...project } : null;
		} catch (error) {
			logger.error(`ProjectPersistence: Failed to get project ${projectId}: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to get project: ${(error as Error).message}`,
				{
					filePath: this.projectsPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async saveProject(project: StoredProject): Promise<void> {
		await this.ensureInitialized();
		try {
			let projects = {};
			if (await exists(this.projectsPath)) {
				const content = await Deno.readTextFile(this.projectsPath);
				projects = JSON.parse(content);
			}

			const { projectId, ...projectData } = project;
			projects = {
				...projects,
				[projectId]: projectData,
			};

			await Deno.writeTextFile(this.projectsPath, JSON.stringify(projects, null, '\t'));
			logger.info(`ProjectPersistence: Saved project ${projectId}`);
		} catch (error) {
			logger.error(
				`ProjectPersistence: Failed to save project ${project.projectId}: ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to save project: ${(error as Error).message}`,
				{
					filePath: this.projectsPath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async deleteProject(projectId: string): Promise<void> {
		await this.ensureInitialized();
		try {
			if (!await exists(this.projectsPath)) {
				return;
			}

			const content = await Deno.readTextFile(this.projectsPath);
			const projects = JSON.parse(content);

			if (projectId in projects) {
				delete projects[projectId];
				await Deno.writeTextFile(this.projectsPath, JSON.stringify(projects, null, '\t'));
				logger.info(`ProjectPersistence: Deleted project ${projectId}`);
			}
		} catch (error) {
			logger.error(`ProjectPersistence: Failed to delete project ${projectId}: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to delete project: ${(error as Error).message}`,
				{
					filePath: this.projectsPath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}
	}

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
			logger.info(`ProjectPersistence: searching with excludePatterns: ${fullSearchPath}`, excludePatterns);

			const walkEntries = walk(fullSearchPath, {
				includeDirs: true,
				followSymlinks: false,
				skip: excludePatterns,
			});

			for await (const entry of walkEntries) {
				try {
					if (entry.isDirectory && entry.name === '.bb') {
						const configPath = join(entry.path, 'config.yaml');
						try {
							const configStat = await Deno.stat(configPath);
							if (configStat.isFile) {
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
						} catch (configError) {
							// Not a valid project directory or can't access config file, continue searching
							if (configError instanceof Deno.errors.PermissionDenied) {
								logger.warn(
									`ProjectPersistence: Permission denied accessing config file: ${configPath}`,
								);
							}
						}
					}
				} catch (entryError) {
					// Handle permission errors for individual entries
					if (entryError instanceof Deno.errors.PermissionDenied) {
						logger.warn(`ProjectPersistence: Permission denied accessing directory: ${entry.path}`);
						continue;
					}
					// For other errors, log and continue
					logger.warn(`ProjectPersistence: Error processing entry ${entry.path}: ${entryError.message}`);
				}
			}

			return projects;
		} catch (error) {
			// Handle errors that occur outside the walk loop
			if (error instanceof Deno.errors.PermissionDenied) {
				logger.warn(`ProjectPersistence: Permission denied accessing search directory: ${searchDir}`);
				return projects; // Return any projects found before the error
			}

			logger.error(`ProjectPersistence: Failed to find v1 projects: ${(error as Error).message}`);
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

	async migrateV1Project(projectPath: string): Promise<StoredProject> {
		try {
			// Read the v1 config
			const configPath = join(projectPath, '.bb', 'config.yaml');
			const v1ConfigContent = await Deno.readTextFile(configPath);
			const v1Config = parseYaml(v1ConfigContent);

			// Use ConfigManager to migrate the config
			const configManager = await ConfigManagerV2.getInstance();
			logger.error(`ProjectPersistence: Migrating project for: ${projectPath}`);
			const migrationResult = await configManager.migrateConfig(v1Config);
			if (!migrationResult.success) {
				throw new Error(`Migration failed: ${migrationResult.errors.map((e: Error) => e.message).join(', ')}`);
			}

			const config = migrationResult.config as ProjectConfig;

			// Update caches
			configManager.projectConfigs.set(config.projectId, config);
			configManager.projectRoots.set(config.projectId, projectPath);
			configManager.projectIds.set(projectPath, config.projectId);

			// Save project config
			await Deno.writeTextFile(configPath, stringifyYaml(configManager.removeUndefined(config)));

			// Create a new stored project
			const project: StoredProject = {
				projectId: config.projectId,
				name: config.name,
				path: projectPath,
				type: config.type,
			};

			// Save the project
			await this.saveProject(project);

			return project;
		} catch (error) {
			logger.error(
				`ProjectPersistence: Failed to migrate v1 project at ${projectPath}: ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to migrate v1 project: ${(error as Error).message}`,
				{
					filePath: projectPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}
}

export default ProjectPersistence;
