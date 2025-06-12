import { parse as parseYaml, stringify as stringifyYaml } from '@std/yaml';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';
import { GitUtils } from 'shared/git.ts';
import { deepMerge, DeepMergeOptions } from '@cross/deepmerge';

import {
	createDataSourceBbDir,
	createDataSourceBbIgnore,
	getBbDirFromWorkingRoot,
	getGlobalConfigDir,
} from 'shared/dataDir.ts';
import { ConversationMigration } from 'api/storage/conversationMigration.ts';
import type { MigrationResult as ConversationMigrationResult } from 'api/storage/conversationMigration.ts';
import {
	getProjectAdminConfigPath,
	getProjectAdminDataDir,
	getProjectAdminDir,
	isProjectMigrated,
	migrateProjectFiles,
} from 'shared/projectPath.ts';

interface MigrationReport {
	timestamp: string;
	projectId: string;
	projectConfig: {
		from: string;
		to: string;
		success: boolean;
		changes: Array<{ path: string[]; from: unknown; to: unknown }>;
		errors: Array<{ path: string[]; message: string }>;
	};
	conversations?: ConversationMigrationResult;
}
import type {
	ConfigVersion,
	GlobalConfig,
	GlobalConfigV2,
	IConfigManagerV2,
	MigrationResult,
	ProjectConfig,
	ProjectConfigV2,
	ProjectConfigV20,
	ProjectConfigV21,
	ProjectType,
	ValidationResult,
} from './types.ts';

import {
	ApiConfigDefaults,
	BuiConfigDefaults,
	CliConfigDefaults,
	DuiConfigDefaults,
	GlobalConfigDefaults,
	ProjectConfigDefaults,
} from './types.ts';
import { GlobalConfigSchema as GlobalConfigV1, ProjectConfigSchema as ProjectConfigV1 } from './configSchema.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

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
 * const config = await getConfigManager();
 *
 * // Get configurations
 * const globalConfig = await config.getGlobalConfig();
 * const projectConfig = await config.getProjectConfig('project-id');
 *
 * // Create new project config
 * await config.createProjectConfig('project-id' , {name: 'My Project'} , '/path/to/datasource');
 * ```
 */

/**
 * Implementation of the ConfigManagerV2 interface.
 * Uses a singleton pattern to ensure consistent configuration state.
 * Manages:
 * - Configuration loading and saving
 * - Configuration migration
 * - Validation
 * - Caching
 */
class ConfigManagerV2 implements IConfigManagerV2 {
	private static instance: ConfigManagerV2;
	private static testInstances = new Map<string, ConfigManagerV2>();
	private globalConfig?: GlobalConfig;
	private projectConfigs: Map<string, ProjectConfig> = new Map();
	private toolConfigs: Map<string, unknown> = new Map();
	private workingRoots: Map<string, string> = new Map();
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

	// used for testing - constructor is private so create instance here
	public static async getOneUseInstance(): Promise<ConfigManagerV2> {
		logger.warn(`ConfigManager: Creating a ONE-TIME instance of configManager - USE ONLY FOR TESTING`);
		return new ConfigManagerV2();
	}
	public static async getTestInstance(testId: string): Promise<ConfigManagerV2> {
		if (!ConfigManagerV2.testInstances.has(testId)) {
			logger.warn(`ConfigManager: Creating a TEST instance of configManager with ID: ${testId}`);
			ConfigManagerV2.testInstances.set(testId, new ConfigManagerV2());
		}
		return ConfigManagerV2.testInstances.get(testId)!;
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
		await this.ensureLatestGlobalConfig();
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
	 *   api: { port: 3001 }
	 * });
	 * ```
	 */
	public async updateProjectConfig(projectId: string, updates: Partial<ProjectConfig>): Promise<void> {
		await this.ensureLatestProjectConfig(projectId);
		const current = await this.getProjectConfig(projectId);
		const updated = { ...current, ...updates };

		// Validate before saving
		const validation = await this.validateConfig(updated);
		if (!validation.isValid) {
			throw new Error(`Invalid configuration: ${validation.errors[0]?.message}`);
		}

		// Save to disk
		const configPath = await getProjectAdminConfigPath(projectId);
		await Deno.writeTextFile(configPath, stringifyYaml(updated));

		const mergedConfig = mergeGlobalIntoProjectConfig(
			await updated,
			await this.getGlobalConfig(),
		);

		// Update cache
		this.projectConfigs.set(projectId, mergedConfig);
	}

	public async setProjectConfigValue(projectId: string, key: string, value: string | null): Promise<void> {
		await this.ensureLatestProjectConfig(projectId);
		const configPath = await getProjectAdminConfigPath(projectId);

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
		await this.ensureLatestGlobalConfig();
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
		//	logger.error('ConfigManager: ', {current});
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
			version: '2.2.0',
			myPersonsName: GlobalConfigDefaults.myPersonsName,
			myAssistantsName: GlobalConfigDefaults.myAssistantsName,
			defaultModels: GlobalConfigDefaults.defaultModels,
			noBrowser: GlobalConfigDefaults.noBrowser,
			bbExeName: Deno.build.os === 'windows' ? 'bb.exe' : 'bb',
			bbApiExeName: Deno.build.os === 'windows' ? 'bb-api.exe' : 'bb-api',
			api: {
				...ApiConfigDefaults,
				llmProviders: {},
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
	 * Creates app configuration for a new project
	 * Note: This should be called by ProjectPersistence after creating project data
	 * @param projectId - Project ID of the already created project
	 * @param appConfigData - Initial app configuration data
	 */
	public async createProjectConfig(
		projectId: string,
		appConfigData: Partial<ProjectConfig> = {},
		workingRoot?: string,
	): Promise<void> {
		const globalConfig = await this.getGlobalConfig();
		const config: ProjectConfig = {
			projectId,
			version: '2.2.0',
			name: appConfigData.name,
			myPersonsName: appConfigData.myPersonsName || globalConfig.myPersonsName,
			myAssistantsName: appConfigData.myAssistantsName || globalConfig.myAssistantsName,
			// defaultModels: appConfigData.defaultModels || globalConfig.defaultModels,
			// noBrowser: appConfigData.noBrowser !== undefined ? appConfigData.noBrowser : globalConfig.noBrowser,
			// llmGuidelinesFile: appConfigData.llmGuidelinesFile,
			// api: {
			// 	...ApiConfigDefaults,
			// 	...appConfigData.api,
			// 	llmProviders: appConfigData.api?.llmProviders || {},
			// },
			// bui: {
			// 	...BuiConfigDefaults,
			// 	...appConfigData.bui,
			// },
			// cli: {
			// 	...CliConfigDefaults,
			// 	...appConfigData.cli,
			// },
			// dui: {
			// 	...DuiConfigDefaults,
			// 	...appConfigData.dui,
			// },
		};

		// Save project config
		const projectAdminDir = await getProjectAdminDir(projectId);
		const configPath = join(projectAdminDir, 'config.yaml');
		await Deno.writeTextFile(configPath, stringifyYaml(this.removeUndefined(config)));

		const mergedConfig = mergeGlobalIntoProjectConfig(
			config,
			await this.getGlobalConfig(),
		);

		// Update cache
		this.projectConfigs.set(projectId, mergedConfig);
		if (workingRoot) {
			this.workingRoots.set(projectId, workingRoot);
			this.projectIds.set(workingRoot, projectId);
		}

		logger.info(`ConfigManager: Created app config for project ${projectId}`);
	}

	/**
	 * Gets just the project-specific configuration overrides without merging with global
	 */
	public async getProjectAppConfigOverrides(projectId: string): Promise<Partial<ProjectConfig>> {
		const configPath = await getProjectAdminConfigPath(projectId);

		try {
			const content = await Deno.readTextFile(configPath);
			return parseYaml(content) as ProjectConfig;
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				// Return empty overrides if config doesn't exist
				return {
					projectId,
					version: '2.2.0',
					name: '',
				};
			}
			throw error;
		}
	}

	public async deleteProjectConfig(projectId: string): Promise<void> {
		try {
			const workingRoot = this.workingRoots.get(projectId);
			if (workingRoot) {
				this.projectIds.delete(workingRoot);
			} else {
				logger.warn(`ConfigManager: deleteProject - Project ${projectId} not found`);
			}
			this.projectConfigs.delete(projectId);
			this.workingRoots.delete(projectId);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
		}
	}

	/**
	 * @deprecated Use ProjectPersistence.listProjects() instead
	 * This method only lists projects that have been loaded by the ConfigManager
	 * and does not provide complete project data.
	 */
	// 	public async listProjects(): Promise<Array<{ id: string; name: string }>> {
	// 		logger.warn('ConfigManager: listProjects is deprecated. Use ProjectPersistence.listProjects() instead');
	// 		const projects: Array<{ id: string; name: string }> = [];
	// 		for (const [id, config] of this.projectConfigs) {
	// 			projects.push({
	// 				id,
	// 				name: config.name || 'unknown project',
	// 			});
	// 		}
	// 		return projects;
	// 	}

	/**
	 * Removes project config from cache
	 * Note: This does not delete the project, just removes it from memory
	 */
	public async removeProjectFromCache(projectId: string): Promise<void> {
		this.projectConfigs.delete(projectId);
	}

	/**
	 * @deprecated Use ProjectPersistence.deleteProject() instead
	 */
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
	 * logger.info(`ConfigManager: Backup created at: ${result.backupPath}`);
	 * ```
	 */
	public async ensureLatestGlobalConfig(): Promise<void> {
		// Get current global config
		const config = await this.getGlobalConfig();

		// Attempt migration
		const migrationResult = await this.migrateConfig(config);
		if (!migrationResult.success) {
			throw new Error(`Global config migration failed: ${migrationResult.errors[0]?.message}`);
		}
		//logger.info('ConfigManager: ensureLatestGlobalConfig: migrationResult', migrationResult);

		// If version changed, save the migrated config
		if (migrationResult.version.from !== migrationResult.version.to) {
			const configDir = await getGlobalConfigDir();
			const configPath = join(configDir, 'config.yaml');

			// Ensure config directory exists
			await ensureDir(configDir);

			// Write updated config
			await Deno.writeTextFile(
				configPath,
				stringifyYaml(this.removeUndefined(migrationResult.config as GlobalConfig)),
			);

			// Update cache
			this.globalConfig = migrationResult.config as GlobalConfig;
		}
	}

	public async ensureLatestProjectConfig(projectId: string): Promise<void> {
		const configPath = await getProjectAdminConfigPath(projectId);
		const projectAdminDir = await getProjectAdminDir(projectId);

		try {
			// Read raw project config directly from disk
			const configContent = await Deno.readTextFile(configPath);
			const oldConfig = parseYaml(configContent) as ProjectConfig;

			// Attempt migration
			const migrationResult = await this.migrateConfig(oldConfig, projectAdminDir);
			if (!migrationResult.success) {
				throw new Error(`Project config migration failed: ${migrationResult.errors[0]?.message}`);
			}

			// If version changed, save the migrated config and migrate conversations
			if (migrationResult.version.from !== migrationResult.version.to) {
				// Prepare migration report
				const report: MigrationReport = {
					timestamp: new Date().toISOString(),
					projectId,
					projectConfig: {
						from: migrationResult.version.from,
						to: migrationResult.version.to,
						success: migrationResult.success,
						changes: migrationResult.changes || [],
						errors: migrationResult.errors || [],
					},
				};
				// Ensure .bb directory exists
				//await ensureDir(join(projectRoot, '.bb'));

				// Write the raw migrated config back to disk
				await Deno.writeTextFile(
					configPath,
					stringifyYaml(this.removeUndefined(migrationResult.config as ProjectConfig)),
				);

				// Update cache with merged config
				const mergedConfig = mergeGlobalIntoProjectConfig(
					migrationResult.config as ProjectConfig,
					await this.getGlobalConfig(),
				);
				this.projectConfigs.set(projectId, mergedConfig);

				// Migrate conversations if needed
				try {
					const projectAdminDataDir = await getProjectAdminDataDir(projectId);
					const conversationResult = await ConversationMigration.migrateProject(projectAdminDataDir);
					if (conversationResult.failed > 0) {
						logger.warn(
							`ConfigManager: Some conversations failed to migrate: ${conversationResult.failed} failures out of ${conversationResult.total} total`,
						);
					}

					// Add conversation results to report
					report.conversations = conversationResult;

					// Save migration report
					const reportPath = join(projectAdminDataDir, 'migrations.json');
					let reports: MigrationReport[] = [];
					try {
						const content = await Deno.readTextFile(reportPath);
						reports = JSON.parse(content);
					} catch {
						// No existing reports is fine
					}
					reports.push(report);
					await Deno.writeTextFile(reportPath, JSON.stringify(reports, null, 2));
				} catch (error) {
					logger.error(`ConfigManager: Failed to migrate conversations: ${(error as Error).message}`);
					// Add error to report
					report.conversations = {
						total: 0,
						migrated: 0,
						skipped: 0,
						failed: 0,
						results: [{
							conversationId: 'all',
							result: {
								success: false,
								version: { from: 1, to: 1 },
								changes: [],
								errors: [{ message: (error as Error).message }],
							},
						}],
					};
					// Don't throw - we want config migration to succeed even if conversation migration fails
					const projectAdminDataDir = await getProjectAdminDataDir(projectId);
					const reportPath = join(projectAdminDataDir, 'migrations.json');
					let reports: MigrationReport[] = [];
					try {
						const content = await Deno.readTextFile(reportPath);
						reports = JSON.parse(content);
					} catch {
						// No existing reports is fine
					}
					reports.push(report);
					await Deno.writeTextFile(reportPath, JSON.stringify(reports, null, 2));
				}
			} else {
				logger.info(`ConfigManager: Config is current version for: ${projectId}`);
			}
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
			// If config doesn't exist, that's fine - no migration needed
		}
	}

	public async migrateConfig(
		config: GlobalConfigV1 | ProjectConfigV1 | GlobalConfigV2 | ProjectConfigV2,
		projectAdminDir?: string,
	): Promise<MigrationResult> {
		// Always start with success = true and only set to false on error
		// This matches the test expectations where a successful migration should return success = true
		const result: MigrationResult = {
			success: true, // Start with true, only set to false on error
			version: {
				from: this.determineConfigVersion(config),
				to: '2.2.0',
			},
			changes: [],
			errors: [],
			//config: {},
		};

		//logger.info('ConfigManager: migrateConfig: ', result);
		if (result.version.from === '2.2.0') {
			result.config = config as GlobalConfig;
			return result;
		}

		//logger.info('ConfigManager: migrateConfig: ', config);
		try {
			// Determine config type
			const configType = this.determineConfigType(config);

			// Create backup
			const backupPath = await this.createBackup(config, configType, projectAdminDir);
			result.backupPath = backupPath;

			// Perform migration
			const migrated = await this.performMigration(config, configType);
			//logger.info('ConfigManager: migrateConfig migrated: ', migrated);

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

		//logger.info('ConfigManager: validateConfig failed: ', { config });
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
		// console.log('ConfigManager: configPath', configPath);

		try {
			const content = await Deno.readTextFile(configPath);
			const config = parseYaml(content) as GlobalConfig;

			// Validate loaded config
			const validation = await this.validateConfig(config);
			//logger.info('ConfigManager: validateConfig: ', validation);
			if (!validation.isValid) {
				// If validation fails, return default config
				//logger.info('ConfigManager: Error: globalConfig is not valid; using default config: ', validation.errors);
				return {
					version: '2.2.0',
					myPersonsName: GlobalConfigDefaults.myPersonsName,
					myAssistantsName: GlobalConfigDefaults.myAssistantsName,
					defaultModels: GlobalConfigDefaults.defaultModels,
					noBrowser: GlobalConfigDefaults.noBrowser,
					bbExeName: Deno.build.os === 'windows' ? 'bb.exe' : 'bb',
					bbApiExeName: Deno.build.os === 'windows' ? 'bb-api.exe' : 'bb-api',
					api: {
						...ApiConfigDefaults,
						llmProviders: {},
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
				//logger.info('ConfigManager: created globalConfig', this.globalConfig);
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
		//logger.info(`ConfigManager: loadProjectConfig for ${projectId}`);

		const migrated = await isProjectMigrated(projectId);
		if (!migrated) {
			try {
				await migrateProjectFiles(projectId);
				logger.info(`ConfigManager: Successfully migrated project ${projectId} files`);
			} catch (migrationError) {
				logger.warn(
					`ConfigManager: Migration attempted but failed: ${(migrationError as Error).message}`,
				);
				throw createError(
					ErrorType.ProjectHandling,
					`Could not migrate project .bb directory for ${projectId}: ${(migrationError as Error).message}`,
					{
						projectId: projectId,
					} as ProjectHandlingErrorOptions,
				);
			}
		}
		const configPath = await getProjectAdminConfigPath(projectId);

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
			if ('version' in config && typeof config.version === 'string') {
				const version = config.version;
				if (version === '1.0.0' || version === '2.0.0' || version === '2.1.0' || version === '2.2.0') {
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
	private async createBackup(
		config: unknown,
		type: 'global' | 'project',
		projectAdminDir?: string,
	): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const backupDir = type === 'project' && projectAdminDir
			? join(await projectAdminDir, 'backups')
			: join(await getGlobalConfigDir(), 'backups');

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

		if (version === '2.2.0') {
			return config as GlobalConfig | ProjectConfig; // Already at target version
		}

		if (version === '2.1.0') {
			return type === 'global'
				? this.migrateGlobalConfigV21toV22(config as GlobalConfig)
				: this.migrateProjectConfigV21toV22(config as ProjectConfig);
		}

		if (version === '2.0.0') {
			return type === 'global'
				? this.migrateGlobalConfigV20toV22(config as GlobalConfig)
				: this.migrateProjectConfigV20toV22(config as ProjectConfig);
		}

		if (version === '1.0.0') {
			return type === 'global'
				? this.migrateGlobalConfigV1toV22(config as GlobalConfigV1)
				: this.migrateProjectConfigV1toV22(config as ProjectConfigV1);
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
	private migrateGlobalConfigV1toV22(config: GlobalConfigV1): GlobalConfig {
		const v1Config = config as GlobalConfigV1;

		return {
			version: '2.2.0',
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
				llmProviders: {
					anthropic: v1Config.api?.anthropicApiKey ? { apiKey: v1Config.api.anthropicApiKey } : undefined,
					openai: v1Config.api?.openaiApiKey ? { apiKey: v1Config.api.openaiApiKey } : undefined,
					//voyageai: v1Config.api?.voyageaiApiKey ? { apiKey: v1Config.api.voyageaiApiKey } : undefined,
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

	private migrateGlobalConfigV20toV22(config: GlobalConfig): GlobalConfig {
		const v20Config = { ...config };

		// Convert old API keys to new provider structure
		v20Config.api.llmProviders = {};
		if (v20Config.api.llmKeys && 'anthropic' in v20Config.api.llmKeys && v20Config.api.llmKeys.anthropic) {
			v20Config.api.llmProviders.anthropic = { apiKey: v20Config.api.llmKeys.anthropic };
			delete v20Config.api.llmKeys.anthropic;
		}
		if (v20Config.api.llmKeys && 'openai' in v20Config.api.llmKeys && v20Config.api.llmKeys.openai) {
			v20Config.api.llmProviders.openai = { apiKey: v20Config.api.llmKeys.openai };
			delete v20Config.api.llmKeys.openai;
		}
		if (v20Config.api.llmKeys && 'deepseek' in v20Config.api.llmKeys && v20Config.api.llmKeys.deepseek) {
			v20Config.api.llmProviders.deepseek = { apiKey: v20Config.api.llmKeys.deepseek };
			delete v20Config.api.llmKeys.deepseek;
		}
		// if (v20Config.api.llmKeys.voyageai) {
		// 	v20Config.api.llmProviders.voyageai = { apiKey: v20Config.api.llmKeys.voyageai };
		// 	delete v20Config.api.llmKeys.voyageai;
		// }

		// Update version
		v20Config.version = '2.2.0';

		return v20Config;
	}

	private migrateGlobalConfigV21toV22(config: GlobalConfig): GlobalConfig {
		const v21Config = { ...config };

		// Update version
		v21Config.version = '2.2.0';

		return v21Config;
	}

	/**
	 * Migrates a v1 project configuration to v2.2 format.
	 * Handles:
	 * - Settings restructuring
	 * - Component-specific overrides
	 * - New field defaults
	 *
	 * @param config - The v1 configuration to migrate
	 * @returns The migrated v2 configuration
	 * @internal
	 */
	private migrateProjectConfigV1toV22(config: ProjectConfigV1): ProjectConfig {
		// Generate a new project ID if one doesn't exist
		const projectId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
		const v1Config = config as ProjectConfigV1;

		return {
			projectId,
			version: '2.2.0',
			name: v1Config.project?.name || 'Unnamed Project',
			//type: v1Config.project?.type || 'local',
			llmGuidelinesFile: v1Config.project?.llmGuidelinesFile,
			repoInfo: {
				...v1Config.repoInfo,
				tokenLimit: v1Config.repoInfo?.tokenLimit ?? 1024,
			},
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
					llmProviders: {
						anthropic: v1Config.api.anthropicApiKey ? { apiKey: v1Config.api.anthropicApiKey } : undefined,
						openai: v1Config.api.openaiApiKey ? { apiKey: v1Config.api.openaiApiKey } : undefined,
						//voyageai: v1Config.api.voyageaiApiKey ? { apiKey: v1Config.api.voyageaiApiKey } : undefined,
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
		};
	}

	private migrateProjectConfigV21toV22(config: ProjectConfig): ProjectConfig {
		// Assert the config as a v2.1 specific type that includes settings
		const v21Config = { ...config } as unknown as ProjectConfigV21;

		// Raise settings to top level
		if (v21Config.settings?.api) {
			v21Config.api = v21Config.settings.api;
			delete v21Config.settings.api;
		}
		if (v21Config.settings?.bui) {
			v21Config.bui = v21Config.settings.bui;
			delete v21Config.settings.bui;
		}
		if (v21Config.settings?.cli) {
			v21Config.cli = v21Config.settings.cli;
			delete v21Config.settings.cli;
		}
		if (v21Config.settings?.dui) {
			v21Config.dui = v21Config.settings.dui;
			delete v21Config.settings.dui;
		}
		delete v21Config.settings;

		// Update version
		v21Config.version = '2.2.0';

		return v21Config;
	}

	private migrateProjectConfigV20toV22(config: ProjectConfig): ProjectConfig {
		// Assert the config as a v2.1 specific type that includes settings
		const v20Config = { ...config } as unknown as ProjectConfigV20;

		// Convert old API keys to new provider structure if they exist in settings
		if (v20Config.settings?.api) {
			if (!v20Config.api) v20Config.api = {};
			v20Config.api.llmProviders = {};
			if (
				v20Config.settings.api.llmKeys && 'anthropic' in v20Config.settings.api.llmKeys &&
				v20Config.settings.api.llmKeys.anthropic
			) {
				v20Config.api.llmProviders.anthropic = { apiKey: v20Config.settings.api.llmKeys.anthropic };
				delete v20Config.settings.api.llmKeys.anthropic;
			}
			if (
				v20Config.settings.api.llmKeys && 'openai' in v20Config.settings.api.llmKeys &&
				v20Config.settings.api.llmKeys.openai
			) {
				v20Config.api.llmProviders.openai = { apiKey: v20Config.settings.api.llmKeys.openai };
				delete v20Config.settings.api.llmKeys.openai;
			}
			if (
				v20Config.settings.api.llmKeys && 'deepseek' in v20Config.settings.api.llmKeys &&
				v20Config.settings.api.llmKeys.deepseek
			) {
				v20Config.api.llmProviders.deepseek = { apiKey: v20Config.settings.api.llmKeys.deepseek };
				delete v20Config.settings.api.llmKeys.deepseek;
			}
			// if (v20Config.settings.api.llmKeys.voyageai) {
			// 	v20Config.settings.api.llmProviders.voyageai = { apiKey: v20Config.settings.api.llmKeys.voyageai };
			// 	delete v20Config.settings.api.llmKeys.voyageai;
			// }
		}
		delete v20Config.settings;

		// Update version
		v20Config.version = '2.2.0';

		return v20Config;
	}

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
		return (c.version === '2.0.0' || c.version === '2.1.0' || c.version === '2.2.0') &&
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
		return (c.version === '2.0.0' || c.version === '2.1.0' || c.version === '2.2.0') &&
			'projectId' in c &&
			'name' in c;
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
				path: ['defaultModels'],
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
			// Validate llmProviders if present
			if (config.api.llmProviders) {
				const validProviders = ['beyondbetter', 'anthropic', 'openai', 'deepseek', 'ollama', 'google', 'groq'];
				for (const [provider, providerConfig] of Object.entries(config.api.llmProviders)) {
					if (!validProviders.includes(provider)) {
						result.errors.push({
							path: ['api', 'llmProviders', provider],
							message: `Invalid LLM provider: ${provider}`,
							value: provider,
						});
					}
					if (providerConfig && (!providerConfig.apiKey || typeof providerConfig.apiKey !== 'string')) {
						result.errors.push({
							path: ['api', 'llmProviders', provider, 'apiKey'],
							message: 'API key must be a non-empty string',
							value: providerConfig?.apiKey,
						});
					}
				}
			}

			// Warn about deprecated API keys
			//if (config.api.anthropicApiKey || config.api.openaiApiKey || config.api.voyageaiApiKey) {
			//	logger.warn('ConfigManager: Warning: Direct API keys are deprecated. Use api.llmProviders instead.');
			//}
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

		// // [TODO] type 'git' is deprecated, but legacy projects can be type 'git'
		// if (!config.type || !['notion', 'gdrive', 'local', 'git'].includes(config.type)) {
		// 	result.errors.push({
		// 		path: ['type'],
		// 		message: 'Invalid project type',
		// 		value: config.type,
		// 	});
		// }

		// Validate settings structure if present
		// Validate API settings if present
		if (config.api) {
			// Validate llmProviders if present
			if (config.api.llmProviders) {
				const validProviders = ['beyondbetter', 'anthropic', 'openai', 'deepseek', 'ollama', 'google', 'groq'];
				for (const [provider, providerConfig] of Object.entries(config.api.llmProviders)) {
					if (!validProviders.includes(provider)) {
						result.errors.push({
							path: ['api', 'llmProviders', provider],
							message: `Invalid LLM provider: ${provider}`,
							value: provider,
						});
					}
					if (providerConfig && (!providerConfig.apiKey || typeof providerConfig.apiKey !== 'string')) {
						result.errors.push({
							path: ['api', 'llmProviders', provider, 'apiKey'],
							message: 'API key must be a non-empty string',
							value: providerConfig?.apiKey,
						});
					}
				}
			}

			// Warn about deprecated API keys
			// if (config.api.anthropicApiKey || config.api.openaiApiKey || config.api.voyageaiApiKey) {
			// 	logger.warn('ConfigManager: Warning: Direct API keys in project settings are deprecated. Use api.llmProviders instead.');
			// }
			const api = config.api;
			if (api.hostname && typeof api.hostname !== 'string') {
				result.errors.push({
					path: ['api', 'hostname'],
					message: 'API hostname must be a string',
					value: api.hostname,
				});
			}
			if (api.port && typeof api.port !== 'number') {
				result.errors.push({
					path: ['api', 'port'],
					message: 'API port must be a number',
					value: api.port,
				});
			}
			if (api.tls?.useTls !== undefined && typeof api.tls.useTls !== 'boolean') {
				result.errors.push({
					path: ['api', 'tls', 'useTls'],
					message: 'API TLS usage must be a boolean',
					value: api.tls.useTls,
				});
			}
		}

		// Validate BUI settings if present
		if (config.bui) {
			const bui = config.bui;
			if (bui.hostname && typeof bui.hostname !== 'string') {
				result.errors.push({
					path: ['bui', 'hostname'],
					message: 'BUI hostname must be a string',
					value: bui.hostname,
				});
			}
			if (bui.port && typeof bui.port !== 'number') {
				result.errors.push({
					path: ['bui', 'port'],
					message: 'BUI port must be a number',
					value: bui.port,
				});
			}
		}

		// Validate CLI settings if present
		if (config.cli) {
			const cli = config.cli;
			if (cli.defaultEditor && typeof cli.defaultEditor !== 'string') {
				result.errors.push({
					path: ['cli', 'defaultEditor'],
					message: 'CLI default editor must be a string',
					value: cli.defaultEditor,
				});
			}
			if (cli.historySize && typeof cli.historySize !== 'number') {
				result.errors.push({
					path: ['cli', 'historySize'],
					message: 'CLI history size must be a number',
					value: cli.historySize,
				});
			}
		}

		// Validate DUI settings if present
		if (config.dui) {
			const dui = config.dui;
			if (dui.projectsDirectory && typeof dui.projectsDirectory !== 'string') {
				result.errors.push({
					path: ['dui', 'projectsDirectory'],
					message: 'DUI projects directory must be a string',
					value: dui.projectsDirectory,
				});
			}
			if (dui.recentProjects && typeof dui.recentProjects !== 'number') {
				result.errors.push({
					path: ['dui', 'recentProjects'],
					message: 'DUI recent projects count must be a number',
					value: dui.recentProjects,
				});
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

		//logger.info('ConfigManager: redactSensitiveInfo: ', redactedObj);
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
		//logger.info('ConfigManager: parseConfigValue:', { value, type: typeof value });

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

	projectConfig.api = deepMerge.withOptions(options, globalConfig.api, projectConfig.api);
	projectConfig.bui = deepMerge.withOptions(options, globalConfig.bui, projectConfig.bui);
	projectConfig.cli = deepMerge.withOptions(options, globalConfig.cli, projectConfig.cli);
	projectConfig.dui = deepMerge.withOptions(options, globalConfig.dui, projectConfig.dui);

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

	//logger.info('ConfigManager: Final mergeGlobalIntoProjectConfig', JSON.stringify(projectConfig, null, 2));
	return projectConfig;
}

export { ConfigManagerV2 };

export async function getConfigManager(): Promise<ConfigManagerV2> {
	const testId = Deno.env.get('BB_TEST_INSTANCE_ID'); // used for testing - don't rely on it for other purposes
	if (testId) return ConfigManagerV2.getTestInstance(testId);
	const noSingleton = Deno.env.get('BB_NO_SINGLETON_CONFIG_MANGER'); // used for testing - don't rely on it for other purposes
	if (noSingleton) return ConfigManagerV2.getOneUseInstance();
	return ConfigManagerV2.getInstance();
}
