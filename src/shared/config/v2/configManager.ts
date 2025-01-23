import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { deepMerge, DeepMergeOptions } from '@cross/deepmerge';

import { createBbDir, createBbIgnore, getBbDir, getGlobalConfigDir } from 'shared/dataDir.ts';
import type {
	ConfigVersion,
	GlobalConfig,
	IConfigManagerV2,
	MigrationResult,
	ProjectConfig,
	ProjectType,
	ValidationResult,
} from './types.ts';

import {
	ApiConfigDefaults,
	BuiConfigDefaults,
	CliConfigDefaults,
	CreateProjectData,
	DuiConfigDefaults,
	GlobalConfigDefaults,
	ProjectConfigDefaults,
} from './types.ts';
import { GlobalConfigSchema as GlobalConfigV1, ProjectConfigSchema as ProjectConfigV1 } from '../configSchema.ts';

//type ProjectConfigUpdate = Omit<ProjectConfig, 'version' | 'projectId' | 'name'>;
type ProjectConfigUpdate = ProjectConfig;
//type GlobalConfigUpdate = Omit<GlobalConfig, 'version' | 'bbExeName' | 'bbApiExeName'>;
type GlobalConfigUpdate = GlobalConfig;

/**
 * Configuration management system interface.
 * Provides access to global and project-specific configurations,
 * handles migrations, and manages configuration validation.
 *
 * Usage:
 * ```typescript
 * const config = await ConfigManagerV2.getInstance();
 *
 * // Get configurations
 * const globalConfig = await config.getGlobalConfig();
 * const projectConfig = await config.getProjectConfig('project-id');
 *
 * // Create new project
 * const projectId = await config.createProject('My Project', 'local');
 * ```
 */

/**
 * Implementation of the ConfigManagerV2 interface.
 * Uses a singleton pattern to ensure consistent configuration state.
 * Manages:
 * - Configuration loading and saving
 * - Project registry
 * - Configuration migration
 * - Validation
 * - Caching
 */
class ConfigManagerV2 implements IConfigManagerV2 {
	private static instance: ConfigManagerV2;
	private globalConfig?: GlobalConfig;
	private projectConfigs: Map<string, ProjectConfig> = new Map();
	private toolConfigs: Map<string, unknown> = new Map();
	private projectRoots: Map<string, string> = new Map();
	private projectIds: Map<string, string> = new Map();

	private constructor() {}

	/**
	 * Gets the singleton instance of the configuration manager.
	 * Creates a new instance if one doesn't exist.
	 *
	 * @returns The ConfigManagerV2 instance
	 */
	public static async getInstance(): Promise<ConfigManagerV2> {
		if (!ConfigManagerV2.instance) {
			ConfigManagerV2.instance = new ConfigManagerV2();
		}
		return ConfigManagerV2.instance;
	}

	/**
	 * Gets the global configuration.
	 * Loads from disk if not cached, otherwise returns cached version.
	 *
	 * @returns The global configuration
	 * @throws Error if configuration is invalid or cannot be loaded
	 */
	public async getGlobalConfig(): Promise<GlobalConfig> {
		if (!this.globalConfig) {
			this.globalConfig = await this.loadGlobalConfig();
		}
		return this.globalConfig;
	}

	/**
	 * Gets a project's configuration by its ID.
	 * Loads from disk if not cached, otherwise returns cached version.
	 *
	 * @param projectId - The unique identifier of the project
	 * @returns The project's configuration
	 * @throws Error if project not found or configuration is invalid
	 */
	public async getProjectConfig(projectId: string): Promise<ProjectConfig> {
		if (!this.projectConfigs.has(projectId)) {
			const config = mergeGlobalIntoProjectConfig(
				await this.loadProjectConfig(projectId),
				await this.getGlobalConfig(),
			);
			this.projectConfigs.set(projectId, config);
		}
		return this.projectConfigs.get(projectId)!;
	}

	/**
	 * Updates the global configuration.
	 * Validates the updated configuration before saving.
	 *
	 * @param updates - Partial configuration updates to apply
	 * @throws Error if resulting configuration would be invalid
	 *
	 * Example:
	 * ```typescript
	 * await config.updateGlobalConfig({
	 *   api: { port: 3001 }
	 * });
	 * ```
	 */
	public async updateGlobalConfig(updates: Partial<GlobalConfig>): Promise<void> {
		const current = await this.getGlobalConfig();
		const updated = { ...current, ...updates };

		// Validate before saving
		const validation = await this.validateConfig(updated);
		if (!validation.isValid) {
			throw new Error(`Invalid configuration: ${validation.errors[0]?.message}`);
		}

		// Save to disk
		const configDir = await getGlobalConfigDir();
		const configPath = join(configDir, 'config.yaml');
		await ensureDir(configDir);
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(updated)));

		// Update cache
		this.globalConfig = updated;
	}

	/**
	 * Updates a project's configuration.
	 * Validates the updated configuration before saving.
	 *
	 * @param projectId - The unique identifier of the project
	 * @param updates - Partial configuration updates to apply
	 * @throws Error if project not found or resulting configuration would be invalid
	 *
	 * Example:
	 * ```typescript
	 * await config.updateProjectConfig('project-id', {
	 *   settings: { api: { port: 3001 } }
	 * });
	 * ```
	 */
	public async updateProjectConfig(projectId: string, updates: Partial<ProjectConfig>): Promise<void> {
		const current = await this.getProjectConfig(projectId);
		const updated = { ...current, ...updates };

		// Validate before saving
		const validation = await this.validateConfig(updated);
		if (!validation.isValid) {
			throw new Error(`Invalid configuration: ${validation.errors[0]?.message}`);
		}

		// Save to disk
		const projectRoot = await this.getProjectRoot(projectId);
		const configPath = join(projectRoot, '.bb', 'config.yaml');
		await ensureDir(join(projectRoot, '.bb'));
		await Deno.writeTextFile(configPath, stringifyYaml(updated));

		const mergedConfig = mergeGlobalIntoProjectConfig(
			await updated,
			await this.getGlobalConfig(),
		);

		// Update cache
		this.projectConfigs.set(projectId, mergedConfig);
	}

	public async setProjectConfigValue(projectId: string, key: string, value: string | null): Promise<void> {
		const projectRoot = await this.getProjectRoot(projectId);
		const configPath = join(projectRoot, '.bb', 'config.yaml');

		let current: ProjectConfig & { [key: string]: unknown };

		try {
			const content = await Deno.readTextFile(configPath);
			current = parseYaml(content) as ProjectConfig & { [key: string]: unknown };
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				current = ProjectConfigDefaults;
			} else {
				throw error;
			}
		}

		if (value === null) {
			// Remove the key when value is null (resetting to global default)
			delete current[key];
		} else {
			// Update the value
			this.updateNestedValue(current, key, value);
		}

		//if (!this.validateProjectConfig(current)) {
		//	throw new Error('Invalid project configuration after setting value');
		//}

		// Ensure .bb directory exists
		await ensureDir(join(projectRoot, '.bb'));

		// Write the updated config
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(current)));

		const mergedConfig = mergeGlobalIntoProjectConfig(
			await current,
			await this.getGlobalConfig(),
		);

		// Update cache
		this.projectConfigs.set(projectId, mergedConfig);
	}

	public async setGlobalConfigValue(key: string, value: string | null): Promise<void> {
		const globalConfigPath = join(await getGlobalConfigDir(), 'config.yaml');
		let current: GlobalConfig & { [key: string]: unknown };

		try {
			const content = await Deno.readTextFile(globalConfigPath);
			current = parseYaml(content) as GlobalConfig & { [key: string]: unknown };
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				current = GlobalConfigDefaults;
			} else {
				throw error;
			}
		}

		if (value === null) {
			// Remove the key when value is null (resetting to global default)
			delete current[key];
		} else {
			// Update the value
			this.updateNestedValue(current, key, value);
		}

		//if (!this.validateGlobalConfig({ ...current, version: VERSION })) {
		//	console.error(current);
		//	throw new Error('Invalid global configuration after setting value');
		//}

		// Ensure config directory exists
		await ensureDir(await getGlobalConfigDir());

		// Write the updated config
		await Deno.writeTextFile(globalConfigPath, stringifyYaml(current));

		// Update cache
		this.globalConfig = current;
	}

	public async ensureGlobalConfig(): Promise<void> {
		const globalConfigDir = await getGlobalConfigDir();
		const globalConfigPath = join(globalConfigDir, 'config.yaml');

		try {
			await Deno.stat(globalConfigPath);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				await this.createGlobalConfig();
			} else {
				throw error;
			}
		}
	}

	private async createGlobalConfig(): Promise<void> {
		// Create and validate default config
		const defaultConfig: GlobalConfig = {
			version: '2.0.0',
			myPersonsName: GlobalConfigDefaults.myPersonsName,
			myAssistantsName: GlobalConfigDefaults.myAssistantsName,
			defaultModels: GlobalConfigDefaults.defaultModels,
			noBrowser: GlobalConfigDefaults.noBrowser,
			bbExeName: Deno.build.os === 'windows' ? 'bb.exe' : 'bb',
			bbApiExeName: Deno.build.os === 'windows' ? 'bb-api.exe' : 'bb-api',
			api: {
				...ApiConfigDefaults,
				llmKeys: {},
			},
			bui: BuiConfigDefaults,
			cli: CliConfigDefaults,
			dui: DuiConfigDefaults,
		};

		// Save to disk
		const configDir = await getGlobalConfigDir();
		const configPath = join(configDir, 'config.yaml');
		await ensureDir(configDir);
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(defaultConfig)));

		this.globalConfig = defaultConfig;
	}

	/**
	 * Gets the configuration for a specific tool.
	 * Tools can have custom configuration structures.
	 *
	 * @param toolName - The name of the tool
	 * @returns The tool's configuration
	 */
	public async getToolConfig(toolName: string): Promise<unknown> {
		if (!this.toolConfigs.has(toolName)) {
			const globalConfig = await this.getGlobalConfig();
			this.toolConfigs.set(toolName, globalConfig.api.toolConfigs[toolName] || {});
		}
		return this.toolConfigs.get(toolName);
	}

	/**
	 * Updates a tool's configuration.
	 * Saves in the global configuration's toolConfigs section.
	 *
	 * @param toolName - The name of the tool
	 * @param config - The new tool configuration
	 */
	public async updateToolConfig(toolName: string, config: unknown): Promise<void> {
		const globalConfig = await this.getGlobalConfig();
		globalConfig.api.toolConfigs[toolName] = config;
		await this.updateGlobalConfig(globalConfig);
		this.toolConfigs.set(toolName, config);
	}

	/**
	 * Creates a new project configuration.
	 * Generates a unique project ID and initializes the configuration.
	 *
	 * @param name - The name of the project
	 * @param type - The type of project ('local' or 'git')
	 * @param path - Optional path to the project directory (defaults to current directory)
	 * @returns The generated project ID
	 * @throws Error if project path is invalid or configuration creation fails
	 *
	 * Example:
	 * ```typescript
	 * const projectId = await config.createProject(
	 *   'My Project',
	 *   'local',
	 *   '/path/to/project'
	 * );
	 * ```
	 */
	//public async createProject(name: string, type: ProjectType, path?: string): Promise<string> {
	public async createProject(createProjectData: CreateProjectData): Promise<string> {
		const { name, type, path } = createProjectData;
		const projectId = await this.generateProjectId();
		const projectPath = path; // || Deno.cwd();
		//console.log('createProject', { name, type, projectId, projectPath });
		// Verify project path
		try {
			const stat = await Deno.stat(projectPath);
			if (!stat.isDirectory) {
				throw new Error(`Project path ${projectPath} is not a directory`);
			}
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				throw new Error(`Project path ${projectPath} does not exist`);
			}
			throw error;
		}

		const globalConfig = await this.getGlobalConfig();
		const config: ProjectConfig = {
			projectId,
			version: '2.0.0',
			name,
			type,
			repoInfo: { tokenLimit: 1024 },
			settings: {},
		};
		if (createProjectData.useTls !== undefined && createProjectData.useTls !== globalConfig.api.tls.useTls) {
			config.settings = {
				...config.settings,
				api: {
					...config.settings?.api,
					tls: {
						...config.settings?.api?.tls,
						useTls: createProjectData.useTls,
					},
				},
			};
		}
		if (createProjectData.anthropicApiKey) {
			config.settings = {
				...config.settings,
				api: {
					...config.settings?.api,
					llmKeys: {
						...config.settings?.api?.llmKeys,
						anthropic: createProjectData.anthropicApiKey,
					},
				},
			};
		}

		//console.log('createProject', { config });

		// Update project registry
		await this.updateProjectRegistry(projectId, name, projectPath, type);

		// Save project config
		await createBbDir(projectPath);
		const configPath = join(projectPath, '.bb', 'config.yaml');
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(config)));

		// Create .bb/ignore file
		await createBbIgnore(projectPath);

		if (
			(createProjectData.myPersonsName && createProjectData.myPersonsName !== globalConfig.myPersonsName) ||
			(createProjectData.myAssistantsName && createProjectData.myAssistantsName !== globalConfig.myAssistantsName)
		) {
			await this.updateGlobalConfig({
				...globalConfig,
				...(createProjectData.myPersonsName ? { myPersonsName: createProjectData.myPersonsName } : {}),
				...(createProjectData.myAssistantsName ? { myAssistantsName: createProjectData.myAssistantsName } : {}),
			});
		}

		const mergedConfig = mergeGlobalIntoProjectConfig(
			config,
			await this.getGlobalConfig(),
		);

		// Update caches
		this.projectConfigs.set(projectId, mergedConfig);
		this.projectRoots.set(projectId, projectPath);
		this.projectIds.set(projectPath, projectId);

		return projectId;
	}

	public async deleteProject(projectId: string): Promise<void> {
		const projectPath = this.projectRoots.get(projectId);
		if (!projectPath) {
			throw new Error(`Project ${projectId} not found`);
		}

		try {
			await Deno.remove(join(projectPath, '.bb'), { recursive: true });
			await this.removeFromProjectRegistry(projectId);

			this.projectConfigs.delete(projectId);
			this.projectRoots.delete(projectId);
			this.projectIds.delete(projectPath);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
		}
	}

	public async addProjectConfig(config: ProjectConfig, projectPath: string): Promise<void> {
		// Update caches
		this.projectConfigs.set(config.projectId, config);
		this.projectRoots.set(config.projectId, projectPath);
		this.projectIds.set(projectPath, config.projectId);

		// Save project config
		const configPath = join(projectPath, '.bb', 'config.yaml');
		await ensureDir(join(projectPath, '.bb'));
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(config)));

		await this.updateProjectRegistry(config.projectId, config.name, projectPath, config.type);
	}

	/**
	 * Updates the global project registry with a new project.
	 * Creates the registry if it doesn't exist.
	 *
	 * @param projectId - The project's unique identifier
	 * @param path - The absolute path to the project root
	 * @throws Error if registry update fails
	 * @internal
	 */
	private async updateProjectRegistry(projectId: string, name: string, path: string, type: string): Promise<void> {
		const registryPath = join(await getGlobalConfigDir(), 'projects.json');
		let registry: Record<string, { name: string; path: string; type: string }> = {};

		try {
			const content = await Deno.readTextFile(registryPath);
			registry = JSON.parse(content) as Record<string, { name: string; path: string; type: string }>;
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				const e = error as Error;
				throw new Error(`Failed to load projects registry: ${e.message}`);
			}
			// Registry doesn't exist yet, using empty object
		}
		//console.log('updateProjectRegistry', { registry, projectId, path });

		registry[projectId] = { name, path, type };
		await Deno.writeTextFile(registryPath, JSON.stringify(registry));
	}

	private async removeFromProjectRegistry(projectId: string): Promise<void> {
		const registryPath = join(await getGlobalConfigDir(), 'projects.json');

		try {
			const content = await Deno.readTextFile(registryPath);
			const registry = JSON.parse(content) as Record<string, { name: string; path: string }>;

			delete registry[projectId];
			await Deno.writeTextFile(registryPath, JSON.stringify(registry));
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw new Error(`Failed to update projects registry: ${(error as Error).message}`);
			}
		}
	}

	public async listProjects(): Promise<Array<{ id: string; name: string; type: ProjectType }>> {
		const projects: Array<{ id: string; name: string; type: ProjectType }> = [];
		for (const [id, config] of this.projectConfigs) {
			projects.push({
				id,
				name: config.name,
				type: config.type,
			});
		}
		return projects;
	}

	public async archiveProject(projectId: string): Promise<void> {
		// For now, just remove from cache
		this.projectConfigs.delete(projectId);
	}

	/**
	 * Migrates a configuration from v1 to v2 format.
	 * Creates a backup before migration and tracks all changes.
	 *
	 * @param config - The configuration to migrate
	 * @returns Migration result including changes and backup information
	 * @throws Error if migration fails
	 *
	 * Example:
	 * ```typescript
	 * const result = await config.migrateConfig(oldConfig);
	 * console.log(`Backup created at: ${result.backupPath}`);
	 * ```
	 */
	public async migrateConfig(
		config: GlobalConfigV1 | ProjectConfigV1 | GlobalConfig | ProjectConfig,
	): Promise<MigrationResult> {
		// Always start with success = true and only set to false on error
		// This matches the test expectations where a successful migration should return success = true
		console.log('ConfigManager: migrateConfig: ', config);
		const result: MigrationResult = {
			success: true, // Start with true, only set to false on error
			version: {
				from: this.determineConfigVersion(config),
				to: '2.0.0',
			},
			changes: [],
			errors: [],
			//config: {},
		};

		//console.log('ConfigManager: migrateConfig: ', result);
		if (result.version.from === '2.0.0') {
			result.config = config as GlobalConfig;
			return result;
		}

		try {
			// Determine config type
			const configType = this.determineConfigType(config);

			// Create backup
			const backupPath = await this.createBackup(config, configType);
			result.backupPath = backupPath;

			// Perform migration
			const migrated = await this.performMigration(config, configType);
			//console.log('ConfigManager: migrateConfig migrated: ', migrated);

			// Record changes
			//result.changes = this.calculateChanges(config, migrated);

			// Validate migrated config
			const validation = await this.validateConfig(migrated);
			if (!validation.isValid) {
				result.errors.push(...validation.errors);
				result.success = false;
				return result;
			}

			result.config = migrated;

			// Return migrated config and changes
			return result;
		} catch (error) {
			result.errors.push({
				path: [],
				message: (error as Error).message,
			});
			result.success = false;
			return result;
		}
	}

	public async validateConfig(config: unknown): Promise<ValidationResult> {
		const result: ValidationResult = {
			isValid: true,
			errors: [],
		};

		// Basic type validation
		if (!config || typeof config !== 'object') {
			result.isValid = false;
			result.errors.push({
				path: [],
				message: 'Configuration must be an object',
				value: config,
			});
			return result;
		}

		// Validate based on config type
		if (this.isGlobalConfig(config)) {
			return this.validateGlobalConfig(config as GlobalConfig);
		} else if (this.isProjectConfig(config)) {
			return this.validateProjectConfig(config as ProjectConfig);
		}

		result.isValid = false;
		result.errors.push({
			path: [],
			message: 'Unknown configuration type',
			value: config,
		});
		return result;
	}

	/**
	 * Loads the global configuration from disk.
	 * Falls back to default configuration if no file exists.
	 *
	 * @returns The loaded global configuration
	 * @throws Error if configuration file is invalid
	 * @internal
	 */
	private async loadGlobalConfig(): Promise<GlobalConfig> {
		const configDir = await getGlobalConfigDir();
		const configPath = join(configDir, 'config.yaml');

		try {
			const content = await Deno.readTextFile(configPath);
			const config = parseYaml(content) as GlobalConfig;

			// Validate loaded config
			const validation = await this.validateConfig(config);
			if (!validation.isValid) {
				// If validation fails, return default config
				//console.log('Error: globalConfig is not valid; using default config: ', validation.errors);
				return {
					version: '2.0.0',
					myPersonsName: GlobalConfigDefaults.myPersonsName,
					myAssistantsName: GlobalConfigDefaults.myAssistantsName,
					defaultModels: GlobalConfigDefaults.defaultModels,
					noBrowser: GlobalConfigDefaults.noBrowser,
					bbExeName: Deno.build.os === 'windows' ? 'bb.exe' : 'bb',
					bbApiExeName: Deno.build.os === 'windows' ? 'bb-api.exe' : 'bb-api',
					api: {
						...ApiConfigDefaults,
						llmKeys: {},
					},
					bui: BuiConfigDefaults,
					cli: CliConfigDefaults,
					dui: DuiConfigDefaults,
				};
			}
			return config;
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				// Create and validate default config
				await this.ensureGlobalConfig();
				//console.log('created globalConfig', this.globalConfig);
				return this.globalConfig!;
			} else {
				throw error;
			}
		}
	}

	/**
	 * Loads a project's configuration from disk.
	 *
	 * @param projectId - The unique identifier of the project
	 * @returns The loaded project configuration
	 * @throws Error if project not found or configuration is invalid
	 * @internal
	 */
	public async loadProjectConfig(projectId: string): Promise<ProjectConfig> {
		//console.log(`ConfigManager: loadProjectConfig for ${projectId}`);
		const projectRoot = await this.getProjectRoot(projectId);
		const configPath = join(projectRoot, '.bb', 'config.yaml');

		try {
			const content = await Deno.readTextFile(configPath);
			const config = parseYaml(content) as ProjectConfig;

			// Validate loaded config
			const validation = await this.validateConfig(config);
			if (!validation.isValid) {
				throw new Error(`Invalid configuration: ${validation.errors[0]?.message}`);
			}

			return config;
		} catch (error) {
			const e = error as Error;
			throw new Error(`Failed to load project config: ${e.message}`);
		}
	}

	public async loadProjectConfigFromProjectRoot(projectRoot: string): Promise<ProjectConfig | null> {
		const configPath = join(projectRoot, '.bb', 'config.yaml');

		try {
			const content = await Deno.readTextFile(configPath);
			const config = parseYaml(content) as ProjectConfig;

			// Validate loaded config
			const validation = await this.validateConfig(config);
			if (!validation.isValid) {
				throw new Error(`Invalid configuration: ${validation.errors[0]?.message}`);
			}

			return config;
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				console.log(`ConfigManager: No project found for ${projectRoot}:  ${(error as Error).message}`);
			}
			return null;
		}
	}

	/**
	 * Resolves a project's root directory from its ID.
	 * Uses the projects registry to map IDs to paths.
	 *
	 * @param projectId - The unique identifier of the project
	 * @returns The absolute path to the project root
	 * @throws Error if project not found in registry
	 * @internal
	 */
	public async getProjectRoot(projectId: string): Promise<string> {
		// Check cache first
		if (this.projectRoots.has(projectId)) {
			return this.projectRoots.get(projectId)!;
		}

		// Load project config from global registry
		const globalConfig = await this.getGlobalConfig();
		const registryPath = join(await getGlobalConfigDir(), 'projects.json');

		try {
			// Load projects registry
			const content = await Deno.readTextFile(registryPath);
			const registry = JSON.parse(content) as Record<string, { name: string; path: string }>;

			if (projectId in registry) {
				const projectRoot = registry[projectId].path;
				// Verify project root exists
				const stat = await Deno.stat(projectRoot);
				if (!stat.isDirectory) {
					throw new Error(`Project root ${projectRoot} is not a directory`);
				}
				// Cache and return
				this.projectRoots.set(projectId, projectRoot);
				this.projectIds.set(projectRoot, projectId);
				return projectRoot;
			}
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				const e = error as Error;
				throw new Error(`Failed to load projects registry: ${e.message}`);
			}
			// Registry doesn't exist yet, will be created when saving
		}

		throw new Error(`Project Id ${projectId} not found in registry`);
	}

	/**
	 * Resolves a project's ID directory from its root directory.
	 * Uses the projects registry to map paths to IDs.
	 *
	 * @param projectRoot - The unique directory of the project
	 * @returns The ID for the project
	 * @throws Error if project not found in registry
	 * @internal
	 */
	public async getProjectId(projectRoot: string): Promise<string> {
		// Check cache first
		if (this.projectIds.has(projectRoot)) {
			return this.projectIds.get(projectRoot)!;
		}

		// Load project config from global registry
		const globalConfig = await this.getGlobalConfig();
		const registryPath = join(await getGlobalConfigDir(), 'projects.json');

		try {
			// Load projects registry
			const content = await Deno.readTextFile(registryPath);
			const registry = JSON.parse(content) as Record<string, { name: string; path: string }>;

			const projectId = Object.entries(registry).find(([_, { path }]) => path === projectRoot)?.[0];

			if (projectId) {
				// Verify project root exists
				const stat = await Deno.stat(projectRoot);
				if (!stat.isDirectory) {
					throw new Error(`Project root ${projectRoot} is not a directory`);
				}
				// Cache and return
				this.projectRoots.set(projectId, projectRoot);
				this.projectIds.set(projectRoot, projectId);
				return projectId;
			}
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				const e = error as Error;
				throw new Error(`Failed to load projects registry: ${e.message}`);
			}
			// Registry doesn't exist yet, will be created when saving
		}

		// Project not found in registry, check for .bb directory
		const bbDirPath = join(projectRoot, '.bb');
		try {
			const bbDirStat = await Deno.stat(bbDirPath);
			if (bbDirStat.isDirectory) {
				// Found .bb directory, attempt to load and migrate config
				const configPath = join(bbDirPath, 'config.yaml');
				try {
					const configContent = await Deno.readTextFile(configPath);
					const oldConfig = parseYaml(configContent) as ProjectConfigV1; // Type assertion for migration

					// Migrate the config
					const migrationResult = await this.migrateConfig(oldConfig);
					if (!migrationResult.success) {
						throw new Error(`Migration failed: ${migrationResult.errors[0]?.message}`);
					}
					const migratedConfig = migrationResult.config as ProjectConfig;
					//console.log('ConfigManager: migrated config: ', migratedConfig);

					// Generate new project ID and create project
					const projectId = migratedConfig.projectId;
					const projectName = migratedConfig.name;
					const projectType = migratedConfig.name;
					// const projectId = await this.generateProjectId();
					// const projectName = oldConfig.project?.name || 'Migrated Project';
					// const projectType = oldConfig.project?.type || 'local';

					// Save config and update registry
					await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(migratedConfig)));
					await this.updateProjectRegistry(projectId, projectName, projectRoot, projectType);

					// Update caches
					this.projectConfigs.set(projectId, migratedConfig);
					this.projectRoots.set(projectId, projectRoot);
					this.projectIds.set(projectRoot, projectId);

					return projectId;
				} catch (error) {
					//if (error instanceof Deno.errors.NotFound) {
					//	throw new Error(`Found .bb directory but no config.yaml in ${projectRoot}`);
					//}
					//console.log(`ConfigManager: getProjectId - Found .bb directory but no config.yaml in ${projectRoot}: ${(error as Error).message}`);
					throw error;
				}
			}
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				console.error(
					`ConfigManager: getProjectId - Error locating .bb directory in ${projectRoot}: ${
						(error as Error).message
					}`,
				);
				throw error;
			}
			//console.warn(`ConfigManager: getProjectId - No .bb directory in ${projectRoot}: ${(error as Error).message}`);
		}

		//console.error(`ConfigManager: getProjectId - Could not get projectId for ${projectRoot}`);
		throw new Error(`Project Root ${projectRoot} not found in registry and no .bb directory found`);
	}

	/**
	 * Generates a unique project identifier.
	 * Creates a 12-character hexadecimal ID.
	 *
	 * @returns The generated project ID
	 * @internal
	 */
	private async generateProjectId(): Promise<string> {
		// Generate a unique 12-character hex ID
		const bytes = new Uint8Array(6);
		crypto.getRandomValues(bytes);
		return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
	}

	/**
	 * Determines whether a configuration is global or project-specific.
	 * Uses presence of projectId to differentiate.
	 *
	 * @param config - The configuration to check
	 * @returns The configuration type ('global' or 'project')
	 * @throws Error if type cannot be determined
	 * @internal
	 */
	private determineConfigType(config: unknown): 'global' | 'project' {
		if (this.isGlobalConfig(config)) return 'global';
		if (this.isProjectConfig(config)) return 'project';
		throw new Error('Unable to determine configuration type');
	}

	/**
	 * Determines the version of a configuration.
	 * Defaults to '1.0.0' if no version specified.
	 *
	 * @param config - The configuration to check
	 * @returns The configuration version
	 * @internal
	 */
	private determineConfigVersion(
		config: GlobalConfigV1 | ProjectConfigV1 | GlobalConfig | ProjectConfig,
	): ConfigVersion {
		// For v2 configs, validate version is supported
		if (typeof config === 'object' && config !== null) {
			//const c = config as Record<string, unknown>;
			if ('version' in config && typeof config.version === 'string') {
				const version = config.version;
				if (version === '1.0.0' || version === '2.0.0') {
					return version;
				}
			}
		}
		// Default to v1 for unversioned configs
		return '1.0.0';
	}

	/**
	 * Creates a backup of a configuration before migration.
	 * Stores backups in component-specific backup directories.
	 *
	 * @param config - The configuration to backup
	 * @param type - The type of configuration
	 * @returns The path to the backup file
	 * @internal
	 */
	private async createBackup(config: unknown, type: 'global' | 'project'): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupDir = type === 'global'
			? join(await getGlobalConfigDir(), 'backups')
			: join(Deno.cwd(), '.bb', 'backups');

		await ensureDir(backupDir);
		const backupPath = join(backupDir, `config-${timestamp}.yaml`);
		await Deno.writeTextFile(backupPath, stringifyYaml(config));

		return backupPath;
	}

	/**
	 * Performs the actual migration of a configuration.
	 * Handles both global and project-specific configurations.
	 *
	 * @param config - The configuration to migrate
	 * @param type - The type of configuration
	 * @returns The migrated configuration
	 * @throws Error if migration fails
	 * @internal
	 */
	private async performMigration(
		config: GlobalConfigV1 | ProjectConfigV1 | GlobalConfig | ProjectConfig,
		type: 'global' | 'project',
	): Promise<GlobalConfig | ProjectConfig> {
		const version = this.determineConfigVersion(config);
		//console.log('ConfigManager: performMigration: ', { type, version });

		if (version === '2.0.0') {
			return config as GlobalConfig | ProjectConfig; // Already at target version
		}

		if (version === '1.0.0') {
			return type === 'global'
				? this.migrateGlobalConfigV1toV2(config as GlobalConfigV1)
				: this.migrateProjectConfigV1toV2(config as ProjectConfigV1);
		}

		throw new Error(`Unsupported config version: ${version}`);
	}

	/**
	 * Migrates a v1 global configuration to v2 format.
	 * Handles:
	 * - Component restructuring
	 * - New field defaults
	 * - Type changes
	 *
	 * @param config - The v1 configuration to migrate
	 * @returns The migrated v2 configuration
	 * @internal
	 */
	private migrateGlobalConfigV1toV2(config: GlobalConfigV1): GlobalConfig {
		const v1Config = config as GlobalConfigV1; // Type assertion for migration

		return {
			version: '2.0.0',
			myPersonsName: v1Config.myPersonsName || GlobalConfigDefaults.myPersonsName,
			myAssistantsName: v1Config.myAssistantsName || GlobalConfigDefaults.myAssistantsName,
			defaultModels: GlobalConfigDefaults.defaultModels,
			noBrowser: v1Config.noBrowser ?? GlobalConfigDefaults.noBrowser,
			bbExeName: v1Config.bbExeName || 'bb',
			bbApiExeName: v1Config.bbApiExeName || 'bb-api',

			// Migrate API config
			api: {
				...ApiConfigDefaults,
				hostname: v1Config.api?.apiHostname || ApiConfigDefaults.hostname,
				port: v1Config.api?.apiPort || ApiConfigDefaults.port,
				tls: {
					useTls: v1Config.api?.apiUseTls ?? ApiConfigDefaults.tls.useTls,
					keyFile: v1Config.api?.tlsKeyFile,
					certFile: v1Config.api?.tlsCertFile,
					rootCaFile: v1Config.api?.tlsRootCaFile,
					keyPem: v1Config.api?.tlsKeyPem,
					certPem: v1Config.api?.tlsCertPem,
					rootCaPem: v1Config.api?.tlsRootCaPem,
				},
				maxTurns: v1Config.api?.maxTurns || ApiConfigDefaults.maxTurns,
				logLevel: v1Config.api?.logLevel || ApiConfigDefaults.logLevel,
				logFile: v1Config.api?.logFile,
				logFileHydration: v1Config.api?.logFileHydration ?? ApiConfigDefaults.logFileHydration,
				ignoreLLMRequestCache: v1Config.api?.ignoreLLMRequestCache ?? ApiConfigDefaults.ignoreLLMRequestCache,
				usePromptCaching: v1Config.api?.usePromptCaching ?? ApiConfigDefaults.usePromptCaching,
				userToolDirectories: v1Config.api?.userToolDirectories || ApiConfigDefaults.userToolDirectories,
				toolConfigs: v1Config.api?.toolConfigs || ApiConfigDefaults.toolConfigs,
				llmKeys: {
					anthropic: v1Config.api?.anthropicApiKey,
					openai: v1Config.api?.openaiApiKey,
					voyageai: v1Config.api?.voyageaiApiKey,
				},
			},

			// Migrate BUI config
			bui: {
				...BuiConfigDefaults,
				hostname: v1Config.bui?.buiHostname || BuiConfigDefaults.hostname,
				port: v1Config.bui?.buiPort || BuiConfigDefaults.port,
				tls: {
					useTls: v1Config.bui?.buiUseTls ?? BuiConfigDefaults.tls.useTls,
					keyFile: v1Config.bui?.tlsKeyFile,
					certFile: v1Config.bui?.tlsCertFile,
					rootCaFile: v1Config.bui?.tlsRootCaFile,
					keyPem: v1Config.bui?.tlsKeyPem,
					certPem: v1Config.bui?.tlsCertPem,
					rootCaPem: v1Config.bui?.tlsRootCaPem,
				},
			},

			// Migrate CLI config
			cli: {
				...CliConfigDefaults,
				...v1Config.cli,
			},

			// Add new DUI config
			dui: DuiConfigDefaults,
		};
	}

	/**
	 * Migrates a v1 project configuration to v2 format.
	 * Handles:
	 * - Settings restructuring
	 * - Component-specific overrides
	 * - New field defaults
	 *
	 * @param config - The v1 configuration to migrate
	 * @returns The migrated v2 configuration
	 * @internal
	 */
	private migrateProjectConfigV1toV2(config: ProjectConfigV1): ProjectConfig {
		// Generate a new project ID if one doesn't exist
		const projectId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
		const v1Config = config as ProjectConfigV1; // Type assertion for migration
		console.log('ConfigManager: migrateProjectConfigV1toV2: ', { projectId });

		return {
			projectId,
			version: '2.0.0',
			name: v1Config.project?.name || 'Unnamed Project',
			type: v1Config.project?.type || 'local',
			llmGuidelinesFile: v1Config.project?.llmGuidelinesFile,
			repoInfo: {
				...v1Config.repoInfo,
				tokenLimit: v1Config.repoInfo?.tokenLimit ?? 1024,
			},
			settings: {
				api: v1Config.api
					? {
						// Map old API fields to new structure
						maxTurns: v1Config.api.maxTurns || ApiConfigDefaults.maxTurns,
						logLevel: v1Config.api.logLevel || ApiConfigDefaults.logLevel,
						logFileHydration: v1Config.api.logFileHydration ?? ApiConfigDefaults.logFileHydration,
						ignoreLLMRequestCache: v1Config.api.ignoreLLMRequestCache ??
							ApiConfigDefaults.ignoreLLMRequestCache,
						usePromptCaching: v1Config.api.usePromptCaching ?? ApiConfigDefaults.usePromptCaching,
						userToolDirectories: v1Config.api.userToolDirectories || ApiConfigDefaults.userToolDirectories,
						toolConfigs: v1Config.api.toolConfigs || ApiConfigDefaults.toolConfigs,
						hostname: v1Config.api.apiHostname || ApiConfigDefaults.hostname,
						port: v1Config.api.apiPort || ApiConfigDefaults.port,
						tls: {
							useTls: v1Config.api.apiUseTls ?? ApiConfigDefaults.tls.useTls,
							keyFile: v1Config.api.tlsKeyFile,
							certFile: v1Config.api.tlsCertFile,
							rootCaFile: v1Config.api.tlsRootCaFile,
							keyPem: v1Config.api.tlsKeyPem,
							certPem: v1Config.api.tlsCertPem,
							rootCaPem: v1Config.api.tlsRootCaPem,
						},
						llmKeys: {
							anthropic: v1Config.api.anthropicApiKey,
							openai: v1Config.api.openaiApiKey,
							voyageai: v1Config.api.voyageaiApiKey,
						},
					}
					: undefined,
				bui: v1Config.bui
					? {
						hostname: v1Config.bui.buiHostname || BuiConfigDefaults.hostname,
						port: v1Config.bui.buiPort || BuiConfigDefaults.port,
						tls: {
							useTls: v1Config.bui.buiUseTls ?? BuiConfigDefaults.tls.useTls,
							keyFile: v1Config.bui.tlsKeyFile,
							certFile: v1Config.bui.tlsCertFile,
							rootCaFile: v1Config.bui.tlsRootCaFile,
							keyPem: v1Config.bui.tlsKeyPem,
							certPem: v1Config.bui.tlsCertPem,
							rootCaPem: v1Config.bui.tlsRootCaPem,
						},
					}
					: undefined,
				cli: v1Config.cli ? { ...v1Config.cli } : undefined,
				dui: undefined, // No DUI settings in v1
			},
		};
	}

	/**
	 * Calculates the differences between two configurations.
	 * Performs deep comparison and tracks all changes.
	 *
	 * @param oldConfig - The original configuration
	 * @param newConfig - The new configuration
	 * @returns Array of changes with paths and values
	 * @internal
	 */
	// 	private calculateChanges(
	// 		oldConfig: GlobalConfigV1 | ProjectConfigV1,
	// 		newConfig: GlobalConfig | ProjectConfig,
	// 	): Array<{ path: string[]; from: unknown; to: unknown }> {
	// 		const changes: Array<{ path: string[]; from: unknown; to: unknown }> = [];
	//
	// 		// Track version changes
	// 		const oldVersion = this.determineConfigVersion(oldConfig);
	// 		const newVersion = this.determineConfigVersion(newConfig);
	// 		if (oldVersion !== newVersion) {
	// 			changes.push({
	// 				path: ['version'],
	// 				from: oldVersion,
	// 				to: newVersion,
	// 			});
	// 		}
	//
	// 		const oldC = oldConfig as GlobalConfigV1 | ProjectConfigV1; //Record<string, unknown>;
	// 		const newC = newConfig as GlobalConfig | ProjectConfig; //Record<string, unknown>;
	//
	// 		// Special handling for v1 to v2 migrations
	// 		if (oldVersion === '1.0.0' && newVersion === '2.0.0') {
	// 			// Track API changes
	// 			if (oldC.api && typeof oldC.api === 'object') {
	// 				const oldApi = oldC.api as Record<string, unknown>;
	// 				const isProject = this.isProjectConfig(newConfig);
	// 				const basePath = isProject ? ['settings', 'api'] : ['api'];
	//
	// 				// Track port changes
	// 				if ('apiPort' in oldApi) {
	// 					changes.push({
	// 						path: [...basePath, 'port'],
	// 						from: oldApi.apiPort,
	// 						to: isProject
	// 							? ((newC.settings as Record<string, unknown>)?.api as Record<string, unknown>)?.port
	// 							: (newC.api as Record<string, unknown>)?.port,
	// 					});
	// 				}
	//
	// 				// Track hostname changes
	// 				if ('apiHostname' in oldApi) {
	// 					changes.push({
	// 						path: [...basePath, 'hostname'],
	// 						from: oldApi.apiHostname,
	// 						to: isProject
	// 							? ((newC.settings as Record<string, unknown>)?.api as Record<string, unknown>)?.hostname
	// 							: (newC.api as Record<string, unknown>)?.hostname,
	// 					});
	// 				}
	// 			}
	// 		}
	//
	// 		// Compare remaining object structures
	// 		function compareObjects(oldObj: any, newObj: any, path: string[] = []): void {
	// 			// Handle null/undefined
	// 			if (oldObj === newObj) return;
	// 			if (oldObj === null || oldObj === undefined || newObj === null || newObj === undefined) {
	// 				changes.push({ path, from: oldObj, to: newObj });
	// 				return;
	// 			}
	//
	// 			// Handle different types
	// 			if (typeof oldObj !== typeof newObj) {
	// 				changes.push({ path, from: oldObj, to: newObj });
	// 				return;
	// 			}
	//
	// 			// Handle arrays
	// 			if (Array.isArray(oldObj) && Array.isArray(newObj)) {
	// 				// Skip array comparison if lengths match and values are primitive
	// 				if (
	// 					oldObj.length === newObj.length &&
	// 					oldObj.every((v) => typeof v !== 'object') &&
	// 					newObj.every((v) => typeof v !== 'object')
	// 				) {
	// 					if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
	// 						changes.push({ path, from: oldObj, to: newObj });
	// 					}
	// 					return;
	// 				}
	// 				if (oldObj.length !== newObj.length) {
	// 					changes.push({ path, from: oldObj, to: newObj });
	// 					return;
	// 				}
	// 				for (let i = 0; i < oldObj.length; i++) {
	// 					compareObjects(oldObj[i], newObj[i], [...path, i.toString()]);
	// 				}
	// 				return;
	// 			}
	//
	// 			// Handle objects
	// 			if (typeof oldObj === 'object' && typeof newObj === 'object') {
	// 				const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
	// 				for (const key of allKeys) {
	// 					if (!(key in oldObj)) {
	// 						changes.push({ path: [...path, key], from: undefined, to: newObj[key] });
	// 					} else if (!(key in newObj)) {
	// 						changes.push({ path: [...path, key], from: oldObj[key], to: undefined });
	// 					} else {
	// 						compareObjects(oldObj[key], newObj[key], [...path, key]);
	// 					}
	// 				}
	// 				return;
	// 			}
	//
	// 			// Handle primitives
	// 			if (
	// 				oldObj !== newObj &&
	// 				(typeof oldObj !== 'object' || typeof newObj !== 'object')
	// 			) {
	// 				changes.push({ path, from: oldObj, to: newObj });
	// 			}
	// 		}
	//
	// 		// Compare remaining object structures
	// 		compareObjects(oldConfig, newConfig);
	// 		return changes;
	// 	}

	private isGlobalConfig(config: unknown): boolean {
		if (typeof config !== 'object' || config === null) return false;
		const c = config as Record<string, unknown>;
		// For v1 configs, check for API or BUI settings
		//if (c.version === '1.0.0') {
		if (
			!('projectId' in c) && !('project' in c) &&
			(('api' in c) || ('bui' in c) || ('cli' in c))
		) return true;

		// For v2 configs, check for required components
		return c.version === '2.0.0' &&
			!('projectId' in c) &&
			('api' in c || 'bui' in c || 'cli' in c || 'dui' in c);
	}

	private isProjectConfig(config: unknown): boolean {
		if (typeof config !== 'object' || config === null) return false;
		const c = config as Record<string, unknown>;
		// For v1 configs, check for project section
		//if (c.version === '1.0.0') {
		if ('project' in c && typeof c.project === 'object' && c.project !== null) return true;

		// For v2 configs, check for required fields
		return c.version === '2.0.0' &&
			'projectId' in c &&
			'name' in c &&
			'type' in c &&
			'settings' in c;
	}

	/**
	 * Validates a global configuration.
	 * Checks:
	 * - Required fields
	 * - Type correctness
	 * - Component configurations
	 *
	 * @param config - The configuration to validate
	 * @returns Validation result with any errors
	 * @internal
	 */
	private validateGlobalConfig(config: GlobalConfig): ValidationResult {
		const result: ValidationResult = { isValid: true, errors: [] };

		// Check required fields
		if (!config.version) {
			result.errors.push({
				path: ['version'],
				message: 'Version is required',
				value: config.version,
			});
		}

		// Validate defaultModels config
		if (!config.defaultModels) {
			result.errors.push({
				path: ['api'],
				message: 'Default Models configuration is required',
				value: undefined,
			});
		}

		// Validate API config
		if (!config.api) {
			result.errors.push({
				path: ['api'],
				message: 'API configuration is required',
				value: undefined,
			});
		} else {
			// Validate API server settings
			if (typeof config.api.hostname !== 'string') {
				result.errors.push({
					path: ['api', 'hostname'],
					message: 'API hostname must be a string',
					value: config.api.hostname,
				});
			}
			if (typeof config.api.port !== 'number') {
				result.errors.push({
					path: ['api', 'port'],
					message: 'API port must be a number',
					value: config.api.port,
				});
			}
			if (typeof config.api.tls?.useTls !== 'boolean') {
				result.errors.push({
					path: ['api', 'tls', 'useTls'],
					message: 'API TLS usage must be a boolean',
					value: config.api.tls?.useTls,
				});
			}

			// Validate API features
			if (typeof config.api.maxTurns !== 'number') {
				result.errors.push({
					path: ['api', 'maxTurns'],
					message: 'API maxTurns must be a number',
					value: config.api.maxTurns,
				});
			}
			if (!['debug', 'info', 'warn', 'error'].includes(config.api.logLevel)) {
				result.errors.push({
					path: ['api', 'logLevel'],
					message: 'Invalid log level',
					value: config.api.logLevel,
				});
			}
		}

		// Validate BUI config
		if (!config.bui) {
			result.errors.push({
				path: ['bui'],
				message: 'BUI configuration is required',
				value: undefined,
			});
		} else {
			if (typeof config.bui.hostname !== 'string') {
				result.errors.push({
					path: ['bui', 'hostname'],
					message: 'BUI hostname must be a string',
					value: config.bui.hostname,
				});
			}
			if (typeof config.bui.port !== 'number') {
				result.errors.push({
					path: ['bui', 'port'],
					message: 'BUI port must be a number',
					value: config.bui.port,
				});
			}
		}

		// Validate CLI config
		if (!config.cli) {
			result.errors.push({
				path: ['cli'],
				message: 'CLI configuration is required',
				value: undefined,
			});
		}

		// Validate DUI config
		if (!config.dui) {
			result.errors.push({
				path: ['dui'],
				message: 'DUI configuration is required',
				value: undefined,
			});
		} else {
			if (typeof config.dui.projectsDirectory !== 'string') {
				result.errors.push({
					path: ['dui', 'projectsDirectory'],
					message: 'Projects directory must be a string',
					value: config.dui.projectsDirectory,
				});
			}
			if (typeof config.dui.recentProjects !== 'number') {
				result.errors.push({
					path: ['dui', 'recentProjects'],
					message: 'Recent projects count must be a number',
					value: config.dui.recentProjects,
				});
			}
		}

		result.isValid = result.errors.length === 0;
		return result;
	}

	/**
	 * Validates a project configuration.
	 * Checks:
	 * - Required fields
	 * - Project ID format
	 * - Settings structure
	 * - Component overrides
	 *
	 * @param config - The configuration to validate
	 * @returns Validation result with any errors
	 * @internal
	 */
	private validateProjectConfig(config: ProjectConfig): ValidationResult {
		const result: ValidationResult = { isValid: true, errors: [] };

		// Check required fields
		if (!config.projectId) {
			result.errors.push({
				path: ['projectId'],
				message: 'Project ID is required',
				value: config.projectId,
			});
		} else if (!/^[a-f0-9]{12}$/.test(config.projectId)) {
			result.errors.push({
				path: ['projectId'],
				message: 'Invalid project ID format',
				value: config.projectId,
			});
		}

		if (!config.version) {
			result.errors.push({
				path: ['version'],
				message: 'Version is required',
				value: config.version,
			});
		}

		if (!config.name) {
			result.errors.push({
				path: ['name'],
				message: 'Project name is required',
				value: config.name,
			});
		}

		if (!config.type || !['local', 'git'].includes(config.type)) {
			result.errors.push({
				path: ['type'],
				message: 'Invalid project type',
				value: config.type,
			});
		}

		// Validate settings structure if present
		if (config.settings) {
			// Validate API settings if present
			if (config.settings.api) {
				const api = config.settings.api;
				if (api.hostname && typeof api.hostname !== 'string') {
					result.errors.push({
						path: ['settings', 'api', 'hostname'],
						message: 'API hostname must be a string',
						value: api.hostname,
					});
				}
				if (api.port && typeof api.port !== 'number') {
					result.errors.push({
						path: ['settings', 'api', 'port'],
						message: 'API port must be a number',
						value: api.port,
					});
				}
				if (api.tls?.useTls !== undefined && typeof api.tls.useTls !== 'boolean') {
					result.errors.push({
						path: ['settings', 'api', 'tls', 'useTls'],
						message: 'API TLS usage must be a boolean',
						value: api.tls.useTls,
					});
				}
			}

			// Validate BUI settings if present
			if (config.settings.bui) {
				const bui = config.settings.bui;
				if (bui.hostname && typeof bui.hostname !== 'string') {
					result.errors.push({
						path: ['settings', 'bui', 'hostname'],
						message: 'BUI hostname must be a string',
						value: bui.hostname,
					});
				}
				if (bui.port && typeof bui.port !== 'number') {
					result.errors.push({
						path: ['settings', 'bui', 'port'],
						message: 'BUI port must be a number',
						value: bui.port,
					});
				}
			}

			// Validate CLI settings if present
			if (config.settings.cli) {
				const cli = config.settings.cli;
				if (cli.defaultEditor && typeof cli.defaultEditor !== 'string') {
					result.errors.push({
						path: ['settings', 'cli', 'defaultEditor'],
						message: 'CLI default editor must be a string',
						value: cli.defaultEditor,
					});
				}
				if (cli.historySize && typeof cli.historySize !== 'number') {
					result.errors.push({
						path: ['settings', 'cli', 'historySize'],
						message: 'CLI history size must be a number',
						value: cli.historySize,
					});
				}
			}

			// Validate DUI settings if present
			if (config.settings.dui) {
				const dui = config.settings.dui;
				if (dui.projectsDirectory && typeof dui.projectsDirectory !== 'string') {
					result.errors.push({
						path: ['settings', 'dui', 'projectsDirectory'],
						message: 'DUI projects directory must be a string',
						value: dui.projectsDirectory,
					});
				}
				if (dui.recentProjects && typeof dui.recentProjects !== 'number') {
					result.errors.push({
						path: ['settings', 'dui', 'recentProjects'],
						message: 'DUI recent projects count must be a number',
						value: dui.recentProjects,
					});
				}
			}
		}

		result.isValid = result.errors.length === 0;
		return result;
	}

	public async getRedactedGlobalConfig(): Promise<GlobalConfig> {
		const globalConfig = await this.getGlobalConfig();
		const redactedConfig = this.redactSensitiveInfo(globalConfig);
		return redactedConfig as GlobalConfig;
	}

	public async getRedactedProjectConfig(projectId: string): Promise<ProjectConfig> {
		const projectConfig = await this.getProjectConfig(projectId);
		const redactedConfig = this.redactSensitiveInfo(projectConfig);
		return redactedConfig as ProjectConfig;
	}

	/*
	private redactSensitiveInfo(obj: Record<string, any>): Record<string, any> {
		const redactedObj: Record<string, any> = {};

		for (const [key, value] of Object.entries(obj)) {
			if (typeof value === 'object' && value !== null) {
				redactedObj[key] = this.redactSensitiveInfo(value as Record<string, unknown>);
			} else if (typeof value === 'string' && this.isSensitiveKey(key)) {
				redactedObj[key] = '[REDACTED]';
			} else {
				redactedObj[key] = value;
			}
		}

		return redactedObj;
	}
	 */

	private redactSensitiveInfo(obj: Record<string, any>, parentKey = ''): Record<string, any> {
		const redactedObj: Record<string, any> = {};

		for (const [key, value] of Object.entries(obj)) {
			const isCurrentKeySensitive = this.isSensitiveKey(key);
			const isParentKeySensitive = this.isSensitiveKey(parentKey);

			if (isCurrentKeySensitive && typeof value === 'object' && value !== null) {
				// Preserve structure of sensitive objects (e.g., llmKeys), but redact their values
				redactedObj[key] = Object.fromEntries(
					Object.keys(value).map((k) => [k, '[REDACTED]']),
				);
			} else if (isCurrentKeySensitive) {
				// Direct redaction for sensitive primitive values
				redactedObj[key] = '[REDACTED]';
			} else if (typeof value === 'object' && value !== null) {
				// Handle nested objects
				redactedObj[key] = isParentKeySensitive ? '[REDACTED]' : this.redactSensitiveInfo(value, key);
			} else {
				// Handle primitive values
				redactedObj[key] = isParentKeySensitive ? '[REDACTED]' : value;
			}
		}

		//console.log('ConfigManager: redactSensitiveInfo: ', redactedObj);
		return redactedObj;
	}

	private isSensitiveKey(key: string): boolean {
		const sensitivePatterns = [
			/llmKeys/i,
			/supabase\w+key/i,
			/api[_-]?key/i,
			/secret/i,
			/password/i,
			/token/i,
			/credential/i,
		];
		return sensitivePatterns.some((pattern) => pattern.test(key));
	}

	/**
	 * Updates a nested value in a configuration object using a dot-notation path.
	 * @param obj The configuration object to update
	 * @param key The dot-notation path to the value (e.g., 'api.logLevel')
	 * @param value The string value to set, will be parsed appropriately
	 * @throws Error if the path is invalid or if intermediate values are not objects
	 */
	private updateNestedValue<T extends GlobalConfigUpdate | ProjectConfigUpdate>(
		obj: T,
		key: string,
		value: string,
	): void {
		const keys = key.split('.');
		// Safe conversion: first to unknown, then to Record
		let target = (obj as unknown) as Record<string, unknown>;

		// Navigate to the nested location, creating objects as needed
		for (let i = 0; i < keys.length - 1; i++) {
			if (!target[keys[i]] || typeof target[keys[i]] !== 'object') {
				target[keys[i]] = {};
			}
			target = target[keys[i]] as Record<string, unknown>;
			if (!target) {
				throw new Error(`Invalid configuration path: ${key}`);
			}
		}

		// Set the value at the final key
		target[keys[keys.length - 1]] = this.parseConfigValue(value);
	}

	private parseConfigValue(value: unknown): unknown {
		// Log the value and its type
		//console.info('ConfigManager: parseConfigValue:', { value, type: typeof value });

		// Handle non-string values
		if (typeof value !== 'string') {
			return value;
		}

		// Try to parse as JSON if it looks like a complex value
		if (
			value.startsWith('{') || value.startsWith('[') ||
			value === 'true' || value === 'false' ||
			value === 'null' || !isNaN(Number(value))
		) {
			try {
				return JSON.parse(value);
			} catch {
				// If parsing fails, return as string
				return value;
			}
		}
		return value;
	}

	/**
	 * Recursively removes undefined values from an object
	 * @param obj The object to clean
	 * @returns A new object with all undefined values removed
	 */
	private removeUndefined<T>(obj: T): T {
		if (obj === null || typeof obj !== 'object') {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.removeUndefined(item)) as T;
		}

		const result: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				result[key] = this.removeUndefined(value);
			}
		}

		return result as T;
	}
}

export function mergeGlobalIntoProjectConfig(
	projectConfig: ProjectConfig,
	globalConfig: GlobalConfig,
	//envConfig: Partial<GlobalConfig>,
): ProjectConfig {
	const options: DeepMergeOptions = {
		arrayMergeStrategy: 'unique',
		setMergeStrategy: 'combine',
		mapMergeStrategy: 'combine',
	};

	projectConfig.settings.api = deepMerge.withOptions(options, globalConfig.api, projectConfig.settings.api);
	projectConfig.settings.bui = deepMerge.withOptions(options, globalConfig.bui, projectConfig.settings.bui);
	projectConfig.settings.cli = deepMerge.withOptions(options, globalConfig.cli, projectConfig.settings.cli);
	projectConfig.settings.dui = deepMerge.withOptions(options, globalConfig.dui, projectConfig.settings.dui);

	if (!projectConfig.myPersonsName?.trim()) {
		projectConfig.myPersonsName = globalConfig.myPersonsName;
	}
	if (!projectConfig.myAssistantsName?.trim()) {
		projectConfig.myAssistantsName = globalConfig.myAssistantsName;
	}
	if (!projectConfig.defaultModels) {
		projectConfig.defaultModels = globalConfig.defaultModels;
	} else if (
		!projectConfig.defaultModels.orchestrator ||
		!projectConfig.defaultModels.agent ||
		!projectConfig.defaultModels.chat
	) {
		projectConfig.defaultModels = { ...globalConfig.defaultModels, ...projectConfig.defaultModels };
	}

	//console.log('ConfigManager: Final mergeGlobalIntoProjectConfig', JSON.stringify(projectConfig, null, 2));
	return projectConfig;
}

export { ConfigManagerV2 };
