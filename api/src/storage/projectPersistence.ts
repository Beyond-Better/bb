import { ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import type { RepoInfoConfigSchema } from 'shared/config/types.ts';
import type { ClientProjectData, ProjectData, ProjectStatus, SerializedProjectData } from 'shared/types/project.ts';
import { getProjectRegistry, type ProjectRegistry } from 'shared/projectRegistry.ts';
import { getProjectAdminDataDir, getProjectAdminDir } from 'shared/projectPath.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import {
	DataSource,
	//type DataSourceAuth,
	type DataSourceForSystemPrompt,
	type DataSourceType,
	type DataSourceValues,
} from 'api/resources/dataSource.ts';
import type { ResourceMetadata } from 'api/resources/resourceManager.ts';
//import { createDataSourceBbDir, createDataSourceBbIgnore } from 'shared/dataDir.ts';
import type { FileMetadata } from 'shared/types.ts';

/**
 * ProjectPersistence class for managing a single project's data
 * Each instance manages one project identified by its projectId
 * Implements ProjectData interface for direct use in API code
 */
class ProjectPersistence implements ProjectData {
	private initialized = false;
	private _projectId: string;
	private _projectRegistry!: ProjectRegistry;

	// Core project properties
	private _name: string = 'New Project';
	private _status: ProjectStatus = 'draft';
	private _repoInfo: RepoInfoConfigSchema = { tokenLimit: 1024 };
	private _mcpServers: string[] = [];

	// Directory for storing project-level resources
	private projectResourcesDir: string = '';
	// Path to the resources metadata file
	private projectResourcesMetadataPath: string = '';
	private projectUploadsDir: string = '';

	// Single source of truth for data sources
	private dataSourcesMap: Map<string, DataSource> = new Map();
	private dataSourcesUriPrefixMap: Map<string, DataSource> = new Map();
	private uploadsDataSource: DataSource | null = null;

	/**
	 * Create a new ProjectPersistence instance
	 * @param projectId The ID of the project to manage
	 */
	constructor(projectId: string) {
		this._projectId = projectId;
	}

	/**
	 * Initialize the ProjectPersistence instance
	 */
	async init(): Promise<ProjectPersistence> {
		//logger.info(`ProjectPersistence: Initializing for: ${this._projectId}`);
		// Initialize the project resources directory path and metadata file path
		const projectDataDir = await getProjectAdminDataDir(this._projectId);
		this.projectResourcesDir = join(projectDataDir, 'resources');
		this.projectResourcesMetadataPath = join(projectDataDir, 'resources.json');

		const projectAdminDir = await getProjectAdminDir(this._projectId);
		this.projectUploadsDir = join(projectAdminDir, '.uploads');

		//logger.info(`ProjectPersistence: Getting project registry for: ${this._projectId}`);
		this._projectRegistry = await getProjectRegistry();

		this.initialized = true; // loadData checks whether we are initialized

		// Load project data and populate attributes
		logger.info(`ProjectPersistence: loading data for: ${this._projectId}`);
		await this.loadData();

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
	 * Gets the path to the project data JSON file
	 */
	private async getProjectDataPath(): Promise<string> {
		const projectDir = await getProjectAdminDir(this._projectId);
		return join(projectDir, 'project.json');
	}

	// ==========================================================================
	// Getters and Setters
	// ==========================================================================

	public get projectId(): string {
		return this._projectId;
	}

	/**
	 * Get the project name as a first-class property
	 */
	public get name(): string {
		return this._name;
	}
	getName(): string {
		return this._name;
	}
	async setName(name: string): Promise<void> {
		await this.update({ name });
	}

	/**
	 * Get the project status as a first-class property
	 */
	public get status(): ProjectStatus {
		return this._status;
	}
	public set status(status: ProjectStatus) {
		this._status = status;
	}
	getStatus(): ProjectStatus {
		return this._status;
	}
	async setStatus(status: ProjectStatus): Promise<void> {
		await this.update({ status });
	}

	/**
	 * Get the repository info as a first-class property
	 */
	public get repoInfo(): RepoInfoConfigSchema {
		return this._repoInfo;
	}
	getRepoInfo(): RepoInfoConfigSchema {
		return this._repoInfo;
	}
	async setRepoInfo(repoInfo: RepoInfoConfigSchema): Promise<void> {
		await this.update({ repoInfo });
	}

	get mcpServers(): string[] {
		return this._mcpServers;
	}
	//set mcpServers(mcpServers: string[])  {
	//	return this._mcpServers = mcpServers;
	//}
	getMCPServers(): string[] {
		return this._mcpServers;
	}
	/**
	 * Set MCP Servers
	 */
	async setMCPServers(mcpServers: string[]): Promise<void> {
		await this.update({ mcpServers });
	}

	/**
	 * Get all data sources as array - does not include custom data sources such as 'uploads'
	 */
	get dataSources(): DataSource[] {
		return this.getDataSources();
	}
	getDataSources(): DataSource[] {
		return Array.from(this.dataSourcesMap.values());
	}

	/**
	 * Set all data sources
	 */
	async setDataSources(dataSources: DataSource[] | DataSourceValues[]): Promise<void> {
		await this.update({ dataSources: dataSources as DataSource[] });
	}

	/**
	 * Get a data source by ID
	 * @param id The ID of the data source
	 * @returns The data source or undefined if not found
	 */
	getDataSource(id: string): DataSource | undefined {
		if (id === 'ds-uploads') return this.getUploadsDataSource();
		return this.dataSourcesMap.get(id);
	}

	/**
	 * Get the primary data source
	 * @returns The primary data source or undefined if none is marked as primary
	 */
	getDataSourceForPrefix(uriPrefix: string): DataSource | undefined {
		if (uriPrefix === 'bb-filesystem+__uploads') return this.getUploadsDataSource();
		return this.dataSourcesUriPrefixMap.get(uriPrefix);
	}

	/**
	 * Get the primary data source as a first-class property
	 */
	public get primaryDataSource(): DataSource | undefined {
		return this.getPrimaryDataSource();
	}

	/**
	 * Get the primary data source
	 * @returns The primary data source or undefined if none is marked as primary
	 */
	getPrimaryDataSource(): DataSource | undefined {
		const primary = Array.from(this.dataSourcesMap.values())
			.find((source) => source.isPrimary && source.enabled);

		if (primary) return primary;

		// Fallback to first enabled source
		const enabled = Array.from(this.dataSourcesMap.values())
			.filter((source) => source.enabled);

		return enabled.length > 0 ? enabled[0] : undefined;
	}

	getUploadsDataSource(): DataSource {
		if (!this.uploadsDataSource) {
			this.uploadsDataSource = DataSource.createFileSystem(
				'__uploads',
				this.projectUploadsDir,
				{ id: 'ds-uploads' },
			);
			//this.dataSourcesMap.set(this.uploadsDataSource.id, this.uploadsDataSource);
			//this.dataSourcesUriPrefixMap.set(this.uploadsDataSource.getUriPrefix(), this.uploadsDataSource);
		}
		return this.uploadsDataSource;
	}

	/**
	 * Get all registered data sources
	 * @param typeFilter Optional filter by data source type
	 * @returns Array of data sources
	 */
	getAllDataSources(typeFilter?: DataSourceType): DataSource[] {
		const sources = Array.from(this.dataSourcesMap.values());

		if (typeFilter) {
			return sources.filter((source) => source.type === typeFilter);
		}

		return sources;
	}

	/**
	 * Get all data sources for the supplied IDs - does not include custom data sources such as 'uploads'
	 * @param dataSourceIds Array of data source IDs
	 * @returns Array of data sources
	 */
	getDataSourcesByIds(dataSourceIds: string[]): DataSource[] {
		return dataSourceIds.map((id) => this.dataSourcesMap.get(id))
			.filter((source): source is DataSource => source !== undefined);
	}

	/**
	 * Get all enabled data sources - does not include custom data sources such as 'uploads'
	 * @returns Array of data sources
	 */
	getAllEnabledDataSources(): DataSource[] {
		return this.getDataSourcesByPriority()
			.filter((source) => source.enabled);
	}

	/**
	 * Get all enabled data sources in priority order - does not include custom data sources such as 'uploads'
	 * @returns Array of data sources sorted by priority (highest first)
	 */
	getDataSourcesByPriority(): DataSource[] {
		return Array.from(this.dataSourcesMap.values())
			.filter((source) => source.enabled)
			.sort((a, b) => {
				// Primary always comes first
				if (a.isPrimary && !b.isPrimary) return -1;
				if (!a.isPrimary && b.isPrimary) return 1;
				// Then sort by priority (higher values first)
				return b.priority - a.priority;
			});
	}

	/**
	 * Get all data sources of a specified type in priority order - does not include custom data sources such as 'uploads'
	 * @param type The data source type to filter by
	 * @returns Array of data sources of the specified type sorted by priority
	 */
	getDataSourcesByTypeAndPriority(type: DataSourceType): DataSource[] {
		return this.getDataSourcesByPriority()
			.filter((source) => source.type === type);
	}

	/**
	 * Get data source information for the system prompt - does not include custom data sources such as 'uploads'
	 * Provides minimal metadata about available data sources for the LLM
	 * @returns Array of data source info objects
	 */
	getDataSourcesForSystemPrompt(): DataSourceForSystemPrompt[] {
		return this.getDataSourcesByPriority()
			.filter((source) => source.enabled);
		//.map((source) => source.getForSystemPrompt());
	}

	/**
	 * Loads project data from disk and populates class properties
	 */
	async loadData(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Check if project exists in registry
			const registryProject = await this._projectRegistry.getProject(this._projectId);
			if (!registryProject) {
				throw createError(
					ErrorType.ProjectHandling,
					`Failed to load project registry`,
					{
						projectId: this._projectId,
					} as ProjectHandlingErrorOptions,
				);
			}

			// Try to load project data from file
			const projectDataPath = await this.getProjectDataPath();

			try {
				if (await exists(projectDataPath)) {
					// Load from project.json
					const content = await Deno.readTextFile(projectDataPath);
					const serializedData = JSON.parse(content) as SerializedProjectData;

					// Populate class properties from loaded data
					this._name = serializedData.name || '';
					this._status = serializedData.status || 'draft';
					this._repoInfo = serializedData.repoInfo || { tokenLimit: 1024 };
					this._mcpServers = serializedData.mcpServers || [];

					// Initialize data sources from the loaded data
					await this.initializeDataSources(serializedData.dataSources || []);
				} else {
					// Project.json doesn't exist yet, try to migrate from config.yaml
					await this.migrateDataFromConfig(registryProject);
				}
			} catch (error) {
				logger.error(
					`ProjectPersistence: Failed to read project data for ${this._projectId}: ${errorMessage(error)}`,
				);
				throw createError(
					ErrorType.FileHandling,
					`Failed to read project data: ${errorMessage(error)}`,
					{
						filePath: `projects/${this._projectId}/project.json`,
						operation: 'read',
					} as FileHandlingErrorOptions,
				);
			}
		} catch (error) {
			logger.error(`ProjectPersistence: Failed to get project ${this._projectId}: ${errorMessage(error)}`);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to get project: ${errorMessage(error)}`,
				{
					projectId: this._projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
	}

	/**
	 * Gets project data for in-memory use (not serialized)
	 * Returns a copy of the data with actual DataSource objects
	 * This is mainly for backward compatibility with code that expects ProjectData
	 */
	getData(): ProjectData {
		return {
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			dataSources: this.getDataSources(), // Returns actual DataSource objects
			primaryDataSource: this.getPrimaryDataSource(), // Include the actual primary data source
			repoInfo: this._repoInfo,
			mcpServers: this._mcpServers,
		};
	}

	/**
	 * Create a ProjectPersistence instance from serialized data
	 * @param serializedData The serialized project data
	 */
	static async fromSerialized(serializedData: SerializedProjectData): Promise<ProjectPersistence> {
		const project = new ProjectPersistence(serializedData.projectId);
		await project.init();

		// Set core properties
		project._name = serializedData.name;
		project._status = serializedData.status;
		project._repoInfo = serializedData.repoInfo;
		project._mcpServers = serializedData.mcpServers;

		// Initialize data sources
		await project.initializeDataSources(serializedData.dataSources);

		return project;
	}

	/**
	 * Apply client-side updates to this project
	 * Useful for updating project data based on changes from BUI
	 * @param clientData The client-side project data with updates
	 */
	async applyClientUpdates(clientData: ClientProjectData): Promise<void> {
		// Update basic properties
		if (clientData.name !== this._name) {
			this._name = clientData.name;
		}
		if (clientData.status !== this._status) {
			this._status = clientData.status;
		}

		if (clientData.repoInfo !== this._repoInfo) {
			this._repoInfo = clientData.repoInfo;
		}
		if (
			clientData.mcpServers &&
			JSON.stringify([...clientData.mcpServers].sort()) !== JSON.stringify([...this._mcpServers].sort())
		) {
			this._mcpServers = clientData.mcpServers;
		}

		// Update data sources (more complex logic would be needed here
		// to handle additions, removals, and changes properly)

		// Save changes
		await this.saveData();
	}

	/**
	 * Initialize the data sources map
	 * @param dataSources Array of data sources to initialize
	 */
	private async initializeDataSources(dataSources: Array<DataSource | DataSourceValues>): Promise<void> {
		this.dataSourcesMap.clear();
		this.dataSourcesUriPrefixMap.clear();

		if (dataSources && Array.isArray(dataSources)) {
			for (const sourceObj of dataSources) {
				// Convert plain object to DataSource class if needed
				const source = sourceObj instanceof DataSource ? sourceObj : DataSource.fromObject(sourceObj);

				this.dataSourcesMap.set(source.id, source);
				this.dataSourcesUriPrefixMap.set(source.getUriPrefix(), source);
			}
		}

		// Ensure we have a primary data source
		await this.ensurePrimaryDataSource();
	}

	/**
	 * Updates project data
	 */
	async update(updates: Partial<ProjectData>): Promise<void> {
		await this.ensureInitialized();

		try {
			// Apply updates to properties
			if (updates.name !== undefined) {
				this._name = updates.name;
			}
			if (updates.status !== undefined) {
				this._status = updates.status;
			}

			if (updates.repoInfo !== undefined) {
				this._repoInfo = updates.repoInfo;
			}

			if (updates.mcpServers !== undefined) {
				this._mcpServers = updates.mcpServers;
			}

			// Special handling for data sources if they were updated
			if (updates.dataSources) {
				await this.updateDataSources(updates.dataSources);

				// Extract paths from new data sources
				// Convert to DataSourceValues if needed before passing to getDataSourcePathsFromDataSources
				const dataSourceValues = updates.dataSources.map((ds) => ds instanceof DataSource ? ds.toJSON() : ds);
				const newPaths = DataSource.getDataSourcePathsFromDataSources(dataSourceValues);

				// Update registry paths
				await this._projectRegistry.saveProject({
					projectId: this._projectId,
					name: this._name,
					status: this._status,
					dataSourcePaths: newPaths,
				});
			}

			// Save updated project data
			await this.saveData();

			// Update name in registry if changed
			if (updates.name) {
				const registryProject = await this._projectRegistry.getProject(this._projectId);
				if (registryProject && registryProject.name !== updates.name) {
					await this._projectRegistry.saveProject({
						...registryProject,
						name: updates.name,
					});
				}
			}
			if (updates.status) {
				const registryProject = await this._projectRegistry.getProject(this._projectId);
				if (registryProject && registryProject.status !== updates.status) {
					await this._projectRegistry.saveProject({
						...registryProject,
						status: updates.status,
					});
				}
			}

			logger.info(`ProjectPersistence: Updated project ${this._projectId}`);
		} catch (error) {
			logger.error(
				`ProjectPersistence: Failed to update project ${this._projectId}: ${errorMessage(error)}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to update project: ${errorMessage(error)}`,
				{
					filePath: `projects/${this._projectId}/project.json`,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Update the data sources collection
	 */
	private async updateDataSources(dataSources: DataSource[] | DataSourceValues[]): Promise<void> {
		this.dataSourcesMap.clear();
		this.dataSourcesUriPrefixMap.clear();

		for (const source of dataSources) {
			const dataSource = source instanceof DataSource
				? source
				: DataSource.fromObject(source as DataSourceValues & { id: string });

			this.dataSourcesMap.set(dataSource.id, dataSource);
			this.dataSourcesUriPrefixMap.set(dataSource.getUriPrefix(), dataSource);
		}

		// Ensure we have a primary data source
		await this.ensurePrimaryDataSource();
	}

	/**
	 * Deletes the project
	 */
	async delete(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Remove from ConfigManager
			const configManager = await getConfigManager();
			await configManager.deleteProjectConfig(this._projectId);

			// Remove from registry
			await this._projectRegistry.deleteProject(this._projectId);

			// for (const dataSource of this.dataSources) {
			// 	if (dataSource.type === 'filesystem' && dataSource.config.dataSourceRoot) {
			// 		const dataSourcePath = dataSource.config.dataSourceRoot as string;
			// 		try {
			// 			await Deno.remove(join(dataSourcePath, '.bb'), { recursive: true });
			// 		} catch (error) {
			// 			logger.error(
			// 				`ProjectPersistence: Failed to delete .bb directory from ${dataSourcePath}: ${
			// 					errorMessage(error)
			// 				}`,
			// 			);
			// 		}
			// 	}
			// }

			const projectAdminDir = await getProjectAdminDir(this._projectId);
			await Deno.remove(projectAdminDir, { recursive: true });

			// Reset properties
			this._name = '';
			this._status = 'draft';
			this._repoInfo = { tokenLimit: 1024 };
			this._mcpServers = [];
			this.dataSourcesMap.clear();
			this.dataSourcesUriPrefixMap.clear();

			logger.info(`ProjectPersistence: Deleted project ${this._projectId}`);
		} catch (error) {
			logger.error(
				`ProjectPersistence: Failed to delete project ${this._projectId}: ${errorMessage(error)}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to delete project: ${errorMessage(error)}`,
				{
					projectId: this._projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
	}

	/**
	 * Lists all uploaded files in the project
	 */
	async listUploadedFiles(): Promise<Omit<FileMetadata, 'path'>[]> {
		try {
			const uploadsDir = this.projectUploadsDir;
			const indexPath = join(uploadsDir, '.metadata', 'index.json');

			// If uploads directory or index doesn't exist yet, return empty array
			if (!(await exists(uploadsDir)) || !(await exists(indexPath))) {
				return [];
			}

			// Read and parse the index file
			const content = await Deno.readTextFile(indexPath);
			const index = JSON.parse(content);

			// Return array of metadata objects (excluding full paths for security)
			return Object.values(index);
		} catch (error) {
			logger.error(`ProjectPersistence: Failed to list uploaded files: ${error}`);
			return [];
		}
	}

	/**
	 * Save project data to file
	 */
	private async saveData(): Promise<void> {
		const projectDir = await getProjectAdminDir(this._projectId);
		const projectDataPath = join(projectDir, 'project.json');

		// Create serialized version for storage
		const serializedData: SerializedProjectData = this.toJSON();

		await ensureDir(projectDir);
		await Deno.writeTextFile(projectDataPath, JSON.stringify(serializedData, null, 2));
	}

	/**
	 * Save data sources to disk and update registry paths
	 * This is a comprehensive method that handles both project.json and registry updates
	 */
	async saveDataSources(): Promise<void> {
		// Save the entire project data with current data sources
		await this.saveData();

		// Update the registry paths
		const dataSourceValues = Array.from(this.dataSourcesMap.values())
			.map((ds) => ds.toJSON());
		const paths = DataSource.getDataSourcePathsFromDataSources(dataSourceValues);

		await this._projectRegistry.saveProject({
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			dataSourcePaths: paths,
		});
	}

	/**
	 * Convert this project to a serializable object with serialized data sources
	 * Used for persistence and API responses
	 */
	toJSON(): SerializedProjectData {
		return {
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			repoInfo: this._repoInfo,
			mcpServers: this._mcpServers,
			dataSources: Array.from(this.dataSourcesMap.values()).map((ds) => ds.toJSON()),
		};
	}

	/**
	 * Convert to client-side project data format for BUI
	 * Returns plain objects rather than class instances
	 */
	toClientData(): ClientProjectData {
		const primarySource = this.getPrimaryDataSource();
		const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';
		const clientDataSources = Array.from(this.dataSourcesMap.values()).map((ds) => {
			const clientDataSource = {
				id: ds.id,
				type: ds.type,
				accessMethod: ds.accessMethod,
				name: ds.name,
				enabled: ds.enabled,
				isPrimary: ds.isPrimary,
				priority: ds.priority,
				capabilities: ds.capabilities,
				description: ds.description,
				config: { ...ds.config }, // Create a copy to avoid modifying the original
			};

			// Strip rootPath (HOME) from dataSourceRoot for filesystem data sources
			if (
				ds.type === 'filesystem' &&
				typeof ds.config.dataSourceRoot === 'string' &&
				ds.config.dataSourceRoot.startsWith(rootPath)
			) {
				clientDataSource.config.dataSourceRoot = ds.config.dataSourceRoot.substring(rootPath.length);
				// Ensure the path starts with a separator if it doesn't already
				if (!(clientDataSource.config.dataSourceRoot as string).startsWith('/')) {
					clientDataSource.config.dataSourceRoot = '/' + clientDataSource.config.dataSourceRoot;
				}
			}

			return clientDataSource;
		});

		// Find the primary in the client data sources
		const clientPrimarySource = primarySource
			? clientDataSources.find((ds) => ds.id === primarySource.id)
			: undefined;

		return {
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			repoInfo: this._repoInfo,
			mcpServers: this._mcpServers,
			dataSources: clientDataSources,
			primaryDataSource: clientPrimarySource,
		};
	}

	/**
	 * Migrate project data from config.yaml to project.json
	 */
	private async migrateDataFromConfig(
		registryProject: { projectId: string; name: string; dataSourcePaths: string[] },
	): Promise<void> {
		// Get config data from ConfigManager
		const configManager = await getConfigManager();
		const projectConfig = await configManager.getProjectConfig(this._projectId);

		// Create DataSource objects from paths
		const dataSources = DataSource.getDataSourcesFromPaths(registryProject.dataSourcePaths);

		// Set properties from config
		this._name = projectConfig.name || '';
		this._status = 'active';
		this._repoInfo = projectConfig.repoInfo || { tokenLimit: 1024 };
		this._mcpServers = [];

		// Initialize data sources
		await this.initializeDataSources(dataSources);

		// Save to file
		await this.saveData();

		logger.info(`ProjectPersistence: Migrated project ${this._projectId} data from config.yaml to project.json`);
	}

	/**
	 * Ensure there is a primary data source
	 * If none exists, sets the first filesystem source or first enabled source as primary
	 */
	private async ensurePrimaryDataSource(): Promise<void> {
		// Check if we already have a primary source
		const primarySource = this.getPrimaryDataSource();
		if (primarySource) return;

		// No primary source, try to find a filesystem source
		const filesystemSources = this.getAllDataSources('filesystem')
			.filter((source) => source.enabled);

		if (filesystemSources.length > 0) {
			filesystemSources[0].setPrimary(true);
			filesystemSources[0].setPriority(100);
			logger.info(`ProjectPersistence: Set ${filesystemSources[0].id} as primary data source`);
			// Save changes to disk
			await this.saveDataSources();
			return;
		}

		// No filesystem source, use first enabled source
		const enabledSources = this.getAllDataSources()
			.filter((source) => source.enabled);

		if (enabledSources.length > 0) {
			enabledSources[0].setPrimary(true);
			enabledSources[0].setPriority(100);
			logger.info(`ProjectPersistence: Set ${enabledSources[0].id} as primary data source`);
			// Save changes to disk
			await this.saveDataSources();
		}
	}

	/**
	 * Resolve a list of data source identifiers (IDs or names) to actual DataSource objects
	 * @param identifiers Array of data source IDs or names
	 * @returns Object containing resolved data sources and IDs that weren't found
	 */
	resolveDataSources(identifiers: string[]): { dataSources: DataSource[]; notFound: string[] } {
		const resolvedDataSources: DataSource[] = [];
		const allSources = this.getAllEnabledDataSources();
		const notFoundIdentifiers: string[] = [];

		// Create a map of names to sources for efficient lookup
		const nameToSourceMap = new Map<string, DataSource>();
		const typeNameToSourceMap = new Map<string, DataSource>();
		for (const source of allSources) {
			nameToSourceMap.set(source.name.toLowerCase(), source);
			typeNameToSourceMap.set(`${source.type.toLowerCase()}-${source.name.toLowerCase()}`, source);
		}

		for (const identifier of identifiers) {
			// First try to find by exact ID
			let source = this.getDataSource(identifier);

			// If not found by ID, try case-insensitive name match
			if (!source) {
				source = nameToSourceMap.get(identifier.toLowerCase()) || undefined;
			}

			// If not found by name, try case-insensitive type-name match
			if (!source) {
				source = typeNameToSourceMap.get(identifier.toLowerCase()) || undefined;
			}

			if (source) {
				// Only include enabled sources
				if (source.enabled) {
					resolvedDataSources.push(source);
				} else {
					logger.warn(`ProjectPersistence: Ignoring disabled data source: ${identifier}`);
				}
			} else {
				notFoundIdentifiers.push(identifier);
			}
		}

		// Log warning for any identifiers that couldn't be resolved
		if (notFoundIdentifiers.length > 0) {
			logger.warn(`ProjectPersistence: Could not resolve data sources: ${notFoundIdentifiers.join(', ')}`);
		}

		return { dataSources: resolvedDataSources, notFound: notFoundIdentifiers };
	}

	/**
	 * Register a new data source
	 * @param source The data source to register
	 * @returns The ID of the registered data source
	 */
	async registerDataSource(source: DataSource): Promise<string> {
		if (this.dataSourcesMap.has(source.id)) {
			throw new Error(`Data source with ID ${source.id} already exists`);
		}

		// If this is marked as primary, clear any existing primary flag
		if (source.isPrimary) {
			this.clearPrimaryFlag();
		}

		this.dataSourcesMap.set(source.id, source);
		this.dataSourcesUriPrefixMap.set(source.getUriPrefix(), source);
		logger.info(`ProjectPersistence: Registered data source: ${source.id} (${source.type})`);

		// Explicitly save data sources to disk
		await this.saveDataSources();

		return source.id;
	}

	/**
	 * Register a new filesystem data source
	 * @param id The ID of the data source
	 * @param root The filesystem root path
	 * @param name Optional name for the data source
	 * @param isPrimary Whether this is the primary data source
	 * @returns The ID of the registered data source
	 */
	async registerFileSystemDataSource(name: string, root: string, isPrimary?: boolean): Promise<string> {
		const source = DataSource.createFileSystem(name, root, {
			isPrimary: isPrimary || false,
			priority: isPrimary ? 100 : 0,
		});
		return this.registerDataSource(source);
	}

	/**
	 * Register a new primary filesystem data source
	 * @param id The ID of the data source
	 * @param root The filesystem root path
	 * @param name Optional name for the data source
	 * @returns The ID of the registered data source
	 */
	async registerPrimaryFileSystemDataSource(name: string, root: string): Promise<string> {
		const source = DataSource.createPrimaryFileSystem(name, root);
		return this.registerDataSource(source);
	}

	/**
	 * Update an existing data source
	 * @param id The ID of the data source to update
	 * @param updates Updates to apply to the data source
	 */
	async updateDataSource(id: string, updates: Partial<DataSourceValues>): Promise<void> {
		const source = this.getDataSource(id);
		if (!source) {
			throw new Error(`Data source with ID ${id} not found`);
		}

		// If setting as primary, clear any existing primary flag
		if (updates.isPrimary && !source.isPrimary) {
			this.clearPrimaryFlag();
		}

		//logger.info(`ProjectPersistence: Updating data source: ${id}`, {source, updates});
		// Apply the updates to the existing data source using the update method
		source.update(updates);

		// Explicitly save data sources to disk
		await this.saveDataSources();

		logger.info(`ProjectPersistence: Updated data source: ${id}`);
	}

	/**
	 * Remove a data source
	 * @param id The ID of the data source to remove
	 */
	async removeDataSource(id: string): Promise<void> {
		const source = this.getDataSource(id);
		if (!source) {
			throw new Error(`Data source with ID ${id} not found`);
		}

		const wasPrimary = source.isPrimary;
		this.dataSourcesMap.delete(id);
		this.dataSourcesUriPrefixMap.delete(id);

		// Explicitly save data sources to disk
		await this.saveDataSources();

		logger.info(`ProjectPersistence: Removed data source: ${id}`);

		// If this was the primary source, find a new primary
		if (wasPrimary) {
			await this.ensurePrimaryDataSource();
		}
	}

	/**
	 * Set a data source as the primary source
	 * @param id The ID of the data source to set as primary
	 */
	async setPrimaryDataSource(id: string): Promise<void> {
		const source = this.getDataSource(id);
		if (!source) {
			throw new Error(`Data source with ID ${id} not found`);
		}

		// Clear any existing primary flag
		this.clearPrimaryFlag();

		// Set this source as primary with high priority
		source.isPrimary = true;
		source.priority = Math.max(source.priority, 100); // Ensure high priority

		// Explicitly save data sources to disk
		await this.saveDataSources();

		logger.info(`ProjectPersistence: Set ${id} as primary data source`);
	}

	/**
	 * Clear the isPrimary flag from all data sources
	 */
	private clearPrimaryFlag(): void {
		for (const source of this.dataSourcesMap.values()) {
			if (source.isPrimary) {
				source.isPrimary = false;
			}
		}
	}

	/**
	 * Enable a data source
	 * @param id The ID of the data source to enable
	 */
	enableDataSource(id: string): void {
		const source = this.getDataSource(id);
		if (!source) {
			throw new Error(`Data source with ID ${id} not found`);
		}

		if (source.enabled) return; // Already enabled

		source.enabled = true;

		// Update project data file asynchronously
		this.saveData()
			.catch((error) => {
				logger.error(`ProjectPersistence: Failed to save project data after enabling data source: ${error}`);
			});

		logger.info(`ProjectPersistence: Enabled data source: ${id}`);
	}

	/**
	 * Disable a data source
	 * @param id The ID of the data source to disable
	 */
	disableDataSource(id: string): void {
		const source = this.getDataSource(id);
		if (!source) {
			throw new Error(`Data source with ID ${id} not found`);
		}

		if (!source.enabled) return; // Already disabled

		// If this is the primary source, we need to find a new primary
		const wasPrimary = source.isPrimary;

		source.enabled = false;

		// Update project data file asynchronously
		this.saveData()
			.catch((error) => {
				logger.error(`ProjectPersistence: Failed to save project data after disabling data source: ${error}`);
			});

		logger.info(`ProjectPersistence: Disabled data source: ${id}`);

		if (wasPrimary) {
			this.ensurePrimaryDataSource();
		}
	}

	/**
	 * Store a resource at the project level
	 * This replaces any existing version of the resource
	 * @param resourceUri The URI of the resource to store
	 * @param content The content of the resource (text or binary)
	 */
	async storeProjectResource(
		resourceUri: string,
		content: string | Uint8Array,
		metadata: ResourceMetadata,
	): Promise<void> {
		try {
			// Create a safe filename from the URI
			const safeFilename = resourceUri.replace(/[^a-zA-Z0-9]/g, '_');
			const resourcePath = join(this.projectResourcesDir, safeFilename);

			// Ensure the resources directory exists
			await ensureDir(dirname(resourcePath));

			// Write the content to the file
			if (typeof content === 'string') {
				await Deno.writeTextFile(resourcePath, content);
			} else {
				await Deno.writeFile(resourcePath, content);
			}

			await this.storeResourceMetadata(resourceUri, metadata);

			logger.debug(`ProjectPersistence: Stored project resource: ${resourceUri}`);
		} catch (error) {
			logger.error(
				`ProjectPersistence: Error storing project resource: ${resourceUri} - ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Failed to store project resource: ${(error as Error).message}`,
				{
					filePath: `${this._projectId}/resources/${resourceUri}`,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}
	}

	/**
	 * Retrieve a resource from the project level
	 * @param resourceUri The URI of the resource to retrieve
	 * @returns The content of the resource, or null if not found
	 */
	/**
	 * Retrieve a resource from the project level
	 * @param resourceUri The URI of the resource to retrieve
	 * @returns Object containing the content and metadata of the resource, or null if not found
	 */
	async getProjectResource(
		resourceUri: string,
	): Promise<{ content: string | Uint8Array; metadata?: ResourceMetadata } | null> {
		try {
			// Create a safe filename from the URI
			const safeFilename = resourceUri.replace(/[^a-zA-Z0-9]/g, '_');
			const resourcePath = join(this.projectResourcesDir, safeFilename);

			// Check if the file exists
			if (!(await exists(resourcePath))) {
				return null;
			}

			// Read the content based on file type
			let content: string | Uint8Array;
			if (resourceUri.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
				content = await Deno.readFile(resourcePath);
			} else {
				content = await Deno.readTextFile(resourcePath);
			}

			// Get metadata if available
			const metadata = await this.getResourceMetadata(resourceUri);

			return { content, metadata };
		} catch (error) {
			logger.error(
				`ProjectPersistence: Error retrieving project resource: ${resourceUri} - ${(error as Error).message}`,
			);
			return null;
		}
	}

	/**
	 * Check if a resource exists at the project level
	 * @param resourceUri The URI of the resource to check
	 * @returns True if the resource exists, false otherwise
	 */
	async hasProjectResource(resourceUri: string): Promise<boolean> {
		// Create a safe filename from the URI
		const safeFilename = resourceUri.replace(/[^a-zA-Z0-9]/g, '_');
		const resourcePath = join(this.projectResourcesDir, safeFilename);

		return await exists(resourcePath);
	}
	/**
	 * Store metadata for a resource in the resources.json file
	 * @param resourceUri The URI of the resource
	 * @param metadata The metadata to store
	 */
	private async storeResourceMetadata(resourceUri: string, metadata: ResourceMetadata): Promise<void> {
		try {
			// Read existing metadata or initialize empty object
			let resourcesMetadata: Record<string, ResourceMetadata> = {};
			if (await exists(this.projectResourcesMetadataPath)) {
				const content = await Deno.readTextFile(this.projectResourcesMetadataPath);
				try {
					resourcesMetadata = JSON.parse(content);
				} catch (parseError) {
					logger.warn(
						`ProjectPersistence: Error parsing resources metadata, reinitializing file: ${
							(parseError as Error).message
						}`,
					);
					// If parsing fails, we'll start with an empty object
				}
			}

			// Add/update metadata for this resource
			resourcesMetadata[resourceUri] = metadata;

			// Ensure the directory exists
			await ensureDir(dirname(this.projectResourcesMetadataPath));

			// Write updated metadata back to file
			await Deno.writeTextFile(
				this.projectResourcesMetadataPath,
				JSON.stringify(resourcesMetadata, null, 2),
			);

			logger.debug(`ProjectPersistence: Stored metadata for resource: ${resourceUri}`);
		} catch (error) {
			logger.error(
				`ProjectPersistence: Error storing resource metadata: ${resourceUri} - ${(error as Error).message}`,
			);
			// We don't throw here to avoid failing the whole resource storage operation
		}
	}

	/**
	 * Retrieve metadata for a resource from the resources.json file
	 * @param resourceUri The URI of the resource
	 * @returns The metadata for the resource, or undefined if not found
	 */
	private async getResourceMetadata(resourceUri: string): Promise<ResourceMetadata | undefined> {
		try {
			// Check if metadata file exists
			if (!(await exists(this.projectResourcesMetadataPath))) {
				return undefined;
			}

			// Read and parse metadata file
			const content = await Deno.readTextFile(this.projectResourcesMetadataPath);
			const resourcesMetadata = JSON.parse(content);

			// Return metadata for the specific resource if it exists
			return resourcesMetadata[resourceUri];
		} catch (error) {
			logger.error(
				`ProjectPersistence: Error retrieving resource metadata: ${resourceUri} - ${(error as Error).message}`,
			);
			return undefined;
		}
	}
}

export default ProjectPersistence;
