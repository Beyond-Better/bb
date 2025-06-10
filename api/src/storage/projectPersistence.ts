import { ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import type { DefaultModels, DefaultModelsPartial, RepoInfoConfigSchema } from 'shared/config/types.ts';
//import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import type { ClientProjectData, ProjectData, ProjectStatus, SerializedProjectData } from 'shared/types/project.ts';
import { getProjectRegistry, type ProjectRegistry } from 'shared/projectRegistry.ts';
import { getProjectAdminDataDir, getProjectAdminDir } from 'shared/projectPath.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getDataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
import type { DataSourceRegistry } from 'api/dataSources/dataSourceRegistry.ts';
//import { getDataSourceFactory } from 'api/dataSources/dataSourceFactory.ts';
//import type { DataSourceFactory } from 'api/dataSources/dataSourceFactory.ts';
import type {
	DataSourceConnectionSystemPrompt,
	DataSourceConnectionValues,
} from 'api/dataSources/interfaces/dataSourceConnection.ts';
import { DataSourceConnection } from 'api/dataSources/dataSourceConnection.ts';
import type { ResourceMetadata } from 'shared/types/dataSourceResource.ts';
import type { FileMetadata } from 'shared/types.ts';
//import type { DataSourceProvider } from 'api/dataSources/interfaces/dataSourceProvider.ts';

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
	//private _defaultModels: DefaultModelsPartial = DefaultModelsConfigDefaults;
	private _mcpServers: string[] = [];

	// Directory for storing project-level resources
	private projectResourcesDir: string = '';
	// Path to the resources metadata file
	private projectResourcesMetadataPath: string = '';
	private projectUploadsDir: string = '';

	// Single source of truth for data sources
	private _dsConnectionsMap: Map<string, DataSourceConnection> = new Map();
	private uploadsDsConnection: DataSourceConnection | null = null;

	// Component references
	private dataSourceRegistry!: DataSourceRegistry;
	//private dataSourceFactory!: DataSourceFactory;

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
		this.dataSourceRegistry = await getDataSourceRegistry();
		//this.dataSourceFactory = await getDataSourceFactory();
		//logger.info(`ProjectPersistence: Got dataSourceRegistry: ${this._projectId}`);

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

	/**
	 * Get the default models as a first-class property
	 */
	// public get defaultModels(): DefaultModelsPartial {
	// 	return this._defaultModels;
	// }
	// getDefaultModels(): DefaultModelsPartial {
	// 	return this._defaultModels;
	// }
	// async setDefaultModels(defaultModels: DefaultModelsPartial): Promise<void> {
	// 	await this.update({ defaultModels });
	// }

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
	get dsConnections(): DataSourceConnection[] {
		return this.getDsConnections();
	}
	getDsConnections(): DataSourceConnection[] {
		return Array.from(this._dsConnectionsMap.values());
	}

	/**
	 * Set all data sources
	 */
	async setDsConnections(dsConnections: DataSourceConnection[] | DataSourceConnectionValues[]): Promise<void> {
		await this.update({ dsConnections: dsConnections as DataSourceConnection[] });
	}

	/**
	 * Get a data source connection by ID
	 * @param id The ID of the data source
	 * @returns The data source connection or undefined if not found
	 */
	getDsConnection(id: string): DataSourceConnection | undefined {
		if (id === 'ds-uploads') return this.getUploadsDsConnection();
		return this._dsConnectionsMap.get(id);
	}

	/**
	 * Get the data source for a URI prefix
	 * @param uriPrefix The URI prefix to find the data source for
	 * @returns The data source or undefined if not found
	 */
	getDsConnectionForPrefix(uriPrefix: string): DataSourceConnection | undefined {
		if (uriPrefix === 'bb+filesystem+__uploads') return this.getUploadsDsConnection();
		//return this.dsConnectionsUriPrefixMap.get(uriPrefix);
		// This needs to be implemented efficiently - for now, iterate and check each prefix
		for (const dsConnection of this._dsConnectionsMap.values()) {
			// Use the prefix generation logic from the data source
			if (dsConnection.getUriPrefix() === uriPrefix) {
				return dsConnection;
			}
		}
		return undefined;
	}

	/**
	 * Get the primary data source as a first-class property
	 */
	public get primaryDsConnection(): DataSourceConnection | undefined {
		return this.getPrimaryDsConnection();
	}

	/**
	 * Get the primary data source
	 * @returns The primary data source or undefined if none is marked as primary
	 */
	getPrimaryDsConnection(): DataSourceConnection | undefined {
		const primary = Array.from(this._dsConnectionsMap.values())
			.find((dsConnection) => dsConnection.isPrimary && dsConnection.enabled);

		if (primary) return primary;

		// Fallback to first enabled dsConnection
		const enabled = Array.from(this._dsConnectionsMap.values())
			.filter((dsConnection) => dsConnection.enabled);

		return enabled.length > 0 ? enabled[0] : undefined;
	}

	getUploadsDsConnection(): DataSourceConnection {
		if (!this.uploadsDsConnection) {
			const provider = this.dataSourceRegistry.getProvider('filesystem', 'bb');
			if (!provider) throw new Error('Could not load provider');
			this.uploadsDsConnection = this.dataSourceRegistry.createConnection(
				provider,
				'__uploads',
				{ dataSourceRoot: this.projectUploadsDir },
				{ id: 'ds-uploads' },
			);
		}
		// this.uploadsDsConnection = DataSourceConnection.createFileSystem(
		// 	'__uploads',
		// 	this.projectUploadsDir,
		// 	{ id: 'ds-uploads' },
		// );
		return this.uploadsDsConnection;
	}

	/**
	 * Get all registered data sources
	 * @param typeFilter Optional filter by data source type
	 * @returns Array of data sources
	 */
	getAllDsConnections(typeFilter?: string): DataSourceConnection[] {
		const dsConnections = Array.from(this._dsConnectionsMap.values());

		if (typeFilter) {
			return dsConnections.filter((dsConnection) => dsConnection.providerType === typeFilter);
		}

		return dsConnections;
	}

	/**
	 * Get all data source connections for the supplied IDs - does not include custom data sources such as 'uploads'
	 * @param dsConnectionIds Array of data source connection IDs
	 * @returns Array of data source connections
	 */
	getDsConnectionsByIds(dsConnectionIds: string[]): DataSourceConnection[] {
		return dsConnectionIds.map((id) => this._dsConnectionsMap.get(id))
			.filter((dsConnection): dsConnection is DataSourceConnection => dsConnection !== undefined);
	}

	/**
	 * Get all enabled data source connections - does not include custom data source connections such as 'uploads'
	 * @returns Array of data source connections
	 */
	getAllEnabledDsConnections(): DataSourceConnection[] {
		return this.getDsConnectionsByPriority()
			.filter((dsConnection) => dsConnection.enabled);
	}

	/**
	 * Get all enabled data source connections in priority order - does not include custom data source connections such as 'uploads'
	 * @returns Array of data source connections sorted by priority (highest first)
	 */
	getDsConnectionsByPriority(): DataSourceConnection[] {
		return Array.from(this._dsConnectionsMap.values())
			.filter((dsConnection) => dsConnection.enabled)
			.sort((a, b) => {
				// Primary always comes first
				if (a.isPrimary && !b.isPrimary) return -1;
				if (!a.isPrimary && b.isPrimary) return 1;
				// Then sort by priority (higher values first)
				return b.priority - a.priority;
			});
	}

	/**
	 * Get all data source connections of a specified type in priority order - does not include custom data source connections such as 'uploads'
	 * @param type The data source connection type to filter by
	 * @returns Array of data source connections of the specified type sorted by priority
	 */
	getDsConnectionsByTypeAndPriority(type: string): DataSourceConnection[] {
		return this.getDsConnectionsByPriority()
			.filter((dsConnection) => dsConnection.providerType === type);
	}

	/**
	 * Get data source connection information for the system prompt - does not include custom data source connections such as 'uploads'
	 * Provides minimal metadata about available data source connections for the LLM
	 * @returns Array of data source connection info objects
	 */
	getDsConnectionsForSystemPrompt(): DataSourceConnectionSystemPrompt[] {
		return this.getDsConnectionsByPriority()
			.filter((dsConnection) => dsConnection.enabled)
			.map((dsConnection) => dsConnection.getForSystemPrompt());
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
					//this._defaultModels = serializedData.defaultModels || DefaultModelsConfigDefaults;
					this._mcpServers = serializedData.mcpServers || [];

					// Initialize data source connections from the loaded data
					await this.initializeDsConnections(serializedData.dsConnections || []);
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
	 * Returns a copy of the data with actual DataSourceConnection objects
	 * This is mainly for backward compatibility with code that expects ProjectData
	 */
	getData(): ProjectData {
		return {
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			dsConnections: this.getDsConnections(), // Returns actual DataSource connections
			primaryDsConnection: this.getPrimaryDsConnection(), // Include the actual primary data source connection
			repoInfo: this._repoInfo,
			//defaultModels: this._defaultModels,
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
		//project._defaultModels = serializedData.defaultModels;
		project._mcpServers = serializedData.mcpServers;

		// Initialize data source connections
		await project.initializeDsConnections(serializedData.dsConnections);

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

		// if (clientData.defaultModels !== this._defaultModels) {
		// 	this._defaultModels = clientData.defaultModels;
		// }

		if (
			clientData.mcpServers &&
			JSON.stringify([...clientData.mcpServers].sort()) !== JSON.stringify([...this._mcpServers].sort())
		) {
			this._mcpServers = clientData.mcpServers;
		}

		// Save changes
		await this.saveData();
	}

	/**
	 * Initialize the data connections map and connection map
	 * @param dsConnections Array of data source connections to initialize
	 */
	private async initializeDsConnections(
		dsConnections: Array<DataSourceConnection | DataSourceConnectionValues>,
	): Promise<void> {
		this._dsConnectionsMap.clear();

		const registry = this.dataSourceRegistry;

		if (dsConnections && Array.isArray(dsConnections)) {
			for (const dsConnectionObj of dsConnections) {
				// Handle DataSourceConnection instances
				if (dsConnectionObj instanceof DataSourceConnection) {
					// Convert DataSource to DataSourceConnection
					const dsConnection = dsConnectionObj;
					this._dsConnectionsMap.set(dsConnection.id, dsConnection);
				} else if (typeof dsConnectionObj === 'object' && dsConnectionObj !== null) {
					// Handle generic objects that might be serialized DataSourceConnection or DataSourceConnectionValues objects
					// Try to find a provider for this data source connection type
					const provider = registry.getProvider(dsConnectionObj.providerType, dsConnectionObj.accessMethod);
					if (provider) {
						// Create a connection from the data source connection values
						const dsConnection = registry.createConnection(
							provider,
							dsConnectionObj.name,
							dsConnectionObj.config,
							{
								id: dsConnectionObj.id,
								auth: dsConnectionObj.auth,
								enabled: dsConnectionObj.enabled,
								isPrimary: dsConnectionObj.isPrimary,
								priority: dsConnectionObj.priority,
							},
						);
						this._dsConnectionsMap.set(dsConnection.id, dsConnection);
					} else {
						logger.warn(
							`ProjectPersistence: initializeDsConnections for project ${this._projectId}: could not get provider for ${dsConnectionObj.accessMethod} : ${dsConnectionObj.providerType}`,
						);
					}
				}
			}
		}

		// Ensure we have a primary data source connection
		await this.ensurePrimaryDsConnection();
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

			// if (updates.defaultModels !== undefined) {
			// 	this._defaultModels = updates.defaultModels;
			// }

			if (updates.mcpServers !== undefined) {
				this._mcpServers = updates.mcpServers;
			}

			// Special handling for data sources if they were updated
			if (updates.dsConnections) {
				await this.updateDsConnections(updates.dsConnections);

				// Extract paths from new data sources
				const newPaths = [];
				for (const dsConnection of updates.dsConnections) {
					if (dsConnection.providerType === 'filesystem' && dsConnection.config.dataSourceRoot) {
						newPaths.push(dsConnection.config.dataSourceRoot as string);
					}
				}

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

			// Update name and status in registry if changed
			if (updates.name || updates.status) {
				const registryProject = await this._projectRegistry.getProject(this._projectId);
				if (registryProject) {
					const registryUpdates: { name?: string; status?: ProjectStatus } = {};
					if (updates.name && registryProject.name !== updates.name) registryUpdates.name = updates.name;
					if (updates.status && registryProject.status !== updates.status) {
						registryUpdates.status = updates.status;
					}
					await this._projectRegistry.saveProject({
						...registryProject,
						...registryUpdates,
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
	private async updateDsConnections(
		dsConnections: DataSourceConnection[] | DataSourceConnectionValues[],
	): Promise<void> {
		await this.initializeDsConnections(dsConnections);
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

			const projectAdminDir = await getProjectAdminDir(this._projectId);
			await Deno.remove(projectAdminDir, { recursive: true });

			// Reset properties
			this._name = '';
			this._status = 'draft';
			this._repoInfo = { tokenLimit: 1024 };
			//this._defaultModels = DefaultModelsConfigDefaults;
			this._mcpServers = [];
			this._dsConnectionsMap.clear();

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
	async saveDsConnections(): Promise<void> {
		// Save the entire project data with current data sources
		await this.saveData();

		// Update the registry paths
		// Extract paths from new data sources
		const paths = [];
		const dsConnections = Array.from(this._dsConnectionsMap.values());
		for (const dsConnection of dsConnections) {
			if (dsConnection.providerType === 'filesystem' && dsConnection.config.dataSourceRoot) {
				paths.push(dsConnection.config.dataSourceRoot as string);
			}
		}

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
			//defaultModels: this._defaultModels,
			mcpServers: this._mcpServers,
			dsConnections: Array.from(this._dsConnectionsMap.values()).map((ds) => ds.toJSON()),
		};
	}

	/**
	 * Convert to client-side project data format for BUI
	 * Returns plain objects rather than class instances
	 */
	toClientData(): ClientProjectData {
		const primaryDsConnection = this.getPrimaryDsConnection();
		const rootPath = Deno.env.get('HOME') || Deno.env.get('USERPROFILE') || '';

		const clientDsConnections = Array.from(this._dsConnectionsMap.values()).map((ds) => {
			const dsProvider = this.dataSourceRegistry.getProvider(ds.providerType, ds.accessMethod);
			const clientDsConnection = {
				id: ds.id,
				providerType: ds.providerType,
				accessMethod: ds.accessMethod,
				name: ds.name,
				enabled: ds.enabled,
				isPrimary: ds.isPrimary,
				priority: ds.priority,
				capabilities: dsProvider?.capabilities || [],
				description: dsProvider?.description || '',
				config: { ...ds.config }, // Create a copy to avoid modifying the original
			};

			// Strip rootPath (HOME) from dataSourceRoot for filesystem data sources
			if (
				ds.providerType === 'filesystem' &&
				typeof ds.config.dataSourceRoot === 'string' &&
				ds.config.dataSourceRoot.startsWith(rootPath)
			) {
				clientDsConnection.config.dataSourceRoot = ds.config.dataSourceRoot.substring(rootPath.length);
				// Ensure the path starts with a separator if it doesn't already
				if (!(clientDsConnection.config.dataSourceRoot as string).startsWith('/')) {
					clientDsConnection.config.dataSourceRoot = '/' + clientDsConnection.config.dataSourceRoot;
				}
			}

			return clientDsConnection;
		});
		// logger.info(
		// 	`ProjectPersistence: toClientData for ${this._projectId}: `,
		// 	{ clientDsConnections },
		// );

		// Find the primary in the client data sources
		const clientPrimaryDsConnection = primaryDsConnection
			? clientDsConnections.find((ds) => ds.id === primaryDsConnection.id)
			: undefined;

		return {
			projectId: this._projectId,
			name: this._name,
			status: this._status,
			repoInfo: this._repoInfo,
			//defaultModels: this._defaultModels,
			mcpServers: this._mcpServers,
			dsConnections: clientDsConnections,
			primaryDsConnection: clientPrimaryDsConnection,
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
		const dsConnections = [];

		const provider = this.dataSourceRegistry.getProvider('filesystem', 'bb');
		if (!provider) throw new Error('Could not load provider');
		for (let i = 0; i < registryProject.dataSourcePaths.length; i++) {
			const path = registryProject.dataSourcePaths[i];
			dsConnections.push(
				this.dataSourceRegistry.createConnection(
					provider,
					i === 0 ? 'local' : `local-${i}`, //name
					{ dataSourceRoot: path },
					{
						//id: i === 0 ? 'ds-local' : `ds-local-${i}`,
						isPrimary: i === 0,
						//capabilities: ['read', 'write', 'list', 'search'],
					},
				),
			);
		}

		// Set properties from config
		this._name = projectConfig.name || '';
		this._status = 'active';
		this._repoInfo = projectConfig.repoInfo || { tokenLimit: 1024 };
		//this._defaultModels = projectConfig.defaultModels || DefaultModelsConfigDefaults;
		this._mcpServers = [];

		// Initialize data sources
		await this.initializeDsConnections(dsConnections);

		// Save to file
		await this.saveData();

		logger.info(`ProjectPersistence: Migrated project ${this._projectId} data from config.yaml to project.json`);
	}

	/**
	 * Ensure there is a primary data source
	 * If none exists, sets the first filesystem source or first enabled source as primary
	 */
	private async ensurePrimaryDsConnection(): Promise<void> {
		// Check if we already have a primary source
		const primaryDsConnection = this.getPrimaryDsConnection();
		if (primaryDsConnection) return;

		// No primary source, try to find a filesystem source
		const filesystemSources = this.getAllDsConnections('filesystem')
			.filter((dsConnection) => dsConnection.enabled);

		if (filesystemSources.length > 0) {
			this.setPrimaryDsConnection(filesystemSources[0].id);
			logger.info(`ProjectPersistence: Set ${filesystemSources[0].id} as primary data source connection`);
			return;
		}

		// No filesystem source connection, use first enabled source connection
		const enabledDsConnections = this.getAllDsConnections()
			.filter((dsConnection) => dsConnection.enabled);

		if (enabledDsConnections.length > 0) {
			this.setPrimaryDsConnection(enabledDsConnections[0].id);
			logger.info(`ProjectPersistence: Set ${enabledDsConnections[0].id} as primary data source connection`);
		}
	}

	// ==========================================================================
	// Data Source Connection Management Methods
	// ==========================================================================

	/**
	 * Resolve a list of data source identifiers (IDs or names) to actual DataSourceConnection objects
	 * @param identifiers Array of data source IDs or names
	 * @returns Object containing resolved data sources and IDs that weren't found
	 */
	resolveDsConnections(identifiers: string[]): { dsConnections: DataSourceConnection[]; notFound: string[] } {
		const resolvedDsConnections: DataSourceConnection[] = [];
		const allDsConnections = this.getAllEnabledDsConnections();
		const notFoundIdentifiers: string[] = [];

		// Create a map of names to sources for efficient lookup
		const nameToDsConnectionMap = new Map<string, DataSourceConnection>();
		const typeNameToDsConnectionMap = new Map<string, DataSourceConnection>();
		for (const dsConnection of allDsConnections) {
			nameToDsConnectionMap.set(dsConnection.name.toLowerCase(), dsConnection);
			typeNameToDsConnectionMap.set(
				`${dsConnection.providerType.toLowerCase()}+${dsConnection.name.toLowerCase()}`,
				dsConnection,
			);
		}

		for (const identifier of identifiers) {
			// First try to find by exact ID
			let dsConnection = this.getDsConnection(identifier);

			// If not found by ID, try case-insensitive name match
			if (!dsConnection) {
				dsConnection = nameToDsConnectionMap.get(identifier.toLowerCase()) || undefined;
			}

			// If not found by name, try case-insensitive type-name match
			if (!dsConnection) {
				dsConnection = typeNameToDsConnectionMap.get(identifier.toLowerCase()) || undefined;
			}

			if (dsConnection) {
				// Only include enabled source connections
				if (dsConnection.enabled) {
					resolvedDsConnections.push(dsConnection);
				} else {
					notFoundIdentifiers.push(identifier);
					logger.warn(`ProjectPersistence: Ignoring disabled data source connection: ${identifier}`);
				}
			} else {
				notFoundIdentifiers.push(identifier);
			}
		}

		// Log warning for any identifiers that couldn't be resolved
		if (notFoundIdentifiers.length > 0) {
			logger.warn(`ProjectPersistence: Could not resolve data sources: ${notFoundIdentifiers.join(', ')}`);
		}

		return { dsConnections: resolvedDsConnections, notFound: notFoundIdentifiers };
	}

	/**
	 * Register a new data source
	 * @param source The data source to register
	 * @returns The ID of the registered data source
	 */
	async registerDsConnection(dsConnection: DataSourceConnection | DataSourceConnectionValues): Promise<string> {
		const registry = this.dataSourceRegistry;
		//const factory = this.dataSourceFactory;

		if (dsConnection instanceof DataSourceConnection) {
			// DataSourceConnection instance
			if (this._dsConnectionsMap.has(dsConnection.id)) {
				throw new Error(`Data source connection with ID ${dsConnection.id} already exists`);
			}

			// If this is marked as primary, clear any existing primary flag
			if (dsConnection.isPrimary) {
				this.clearPrimaryFlag();
			}

			// Add to data source connections map
			this._dsConnectionsMap.set(dsConnection.id, dsConnection);
		} else {
			// DataSourceConnectionValues object
			const dsConnectionValues = dsConnection as DataSourceConnectionValues;
			if (this._dsConnectionsMap.has(dsConnectionValues.id)) {
				throw new Error(`Data source connection with ID ${dsConnectionValues.id} already exists`);
			}

			// If this is marked as primary, clear any existing primary flag
			if (dsConnectionValues.isPrimary) {
				this.clearPrimaryFlag();
			}
			const provider = registry.getProvider(dsConnection.providerType, dsConnection.accessMethod);
			if (provider) {
				const connection = registry.createConnection(
					provider,
					dsConnection.name,
					dsConnection.config,
					{
						id: dsConnection.id,
						auth: dsConnection.auth,
						enabled: dsConnection.enabled,
						isPrimary: dsConnection.isPrimary,
						priority: dsConnection.priority,
					},
				);
				this._dsConnectionsMap.set(connection.id, connection);
			}
		}

		logger.info(`ProjectPersistence: Registered data source connection: ${dsConnection.id}`);

		// Explicitly save data source connections to disk
		await this.saveDsConnections();

		return dsConnection.id;
	}

	/**
	 * Register a new filesystem data source
	 * @param name Human-readable name for the data source
	 * @param root The filesystem root path
	 * @param isPrimary Whether this is the primary data source
	 * @returns The ID of the registered data source
	 */
	async registerFileSystemDsConnection(name: string, root: string, isPrimary?: boolean): Promise<string> {
		// Create the data source using the FilesystemProvider
		const registry = this.dataSourceRegistry;
		const filesystemProvider = registry.getProvider('filesystem', 'bb');

		if (!filesystemProvider) {
			throw new Error('Filesystem provider not registered');
		}

		// Create a connection using the provider
		const dsConnection = registry.createConnection(
			filesystemProvider,
			name,
			{ dataSourceRoot: root },
			{
				isPrimary: isPrimary || false,
				priority: isPrimary ? 100 : 0,
			},
		);

		return this.registerDsConnection(dsConnection);
	}

	/**
	 * Register a new primary filesystem data source connection
	 * @param name Human-readable name for the data source connection
	 * @param root The filesystem root path
	 * @returns The ID of the registered data source connection
	 */
	async registerPrimaryFileSystemDsConnection(name: string, root: string): Promise<string> {
		return this.registerFileSystemDsConnection(name, root, true);
	}

	/**
	 * Update an existing data source connection
	 * @param id The ID of the data source connection to update
	 * @param updates Updates to apply to the data source connection
	 */
	async updateDsConnection(id: string, updates: Partial<Omit<DataSourceConnectionValues, 'id'>>): Promise<void> {
		// Check if we have a DataSourceConnection with this ID
		const dsConnection = this.getDsConnection(id);
		if (!dsConnection) {
			throw new Error(`Data source connection with ID ${id} not found`);
		}

		// If setting as primary, clear any existing primary flag
		if (updates.isPrimary && !dsConnection.isPrimary) {
			this.clearPrimaryFlag();
		}

		// Apply updates to the legacy data source connection
		dsConnection.update(updates);

		// Explicitly save data source connections to disk
		await this.saveDsConnections();

		logger.info(`ProjectPersistence: Updated data source connection: ${id}`);
	}

	/**
	 * Remove a data source connection
	 * @param id The ID of the data source connection to remove
	 */
	async removeDsConnection(id: string): Promise<void> {
		const dsConnection = this.getDsConnection(id);
		if (!dsConnection) {
			throw new Error(`Data source connection with ID ${id} not found`);
		}

		const wasPrimary = dsConnection.isPrimary;

		// Remove from maps
		this._dsConnectionsMap.delete(id);

		// Explicitly save data source connections to disk
		await this.saveDsConnections();

		logger.info(`ProjectPersistence: Removed data source connection: ${id}`);

		// If this was the primary source connection, find a new primary
		if (wasPrimary) {
			await this.ensurePrimaryDsConnection();
		}
	}

	/**
	 * Set a data source connection as the primary source connection
	 * @param id The ID of the data source connection to set as primary
	 */
	async setPrimaryDsConnection(id: string): Promise<void> {
		const dsConnection = this.getDsConnection(id);
		if (!dsConnection) {
			throw new Error(`Data source connection with ID ${id} not found`);
		}

		// Clear any existing primary flag
		this.clearPrimaryFlag();

		// Set this source connection as primary with high priority
		dsConnection.isPrimary = true;
		dsConnection.priority = Math.min(dsConnection.priority, 1); // Ensure high priority

		// Explicitly save data source connections to disk
		await this.saveDsConnections();

		logger.info(`ProjectPersistence: Set ${id} as primary data source connection`);
	}

	/**
	 * Clear the isPrimary flag from all data source connections
	 */
	private clearPrimaryFlag(): void {
		// Clear primary flag from legacy DataSourceConnection objects
		for (const dsConnection of this._dsConnectionsMap.values()) {
			if (dsConnection.isPrimary) {
				dsConnection.isPrimary = false;
			}
		}
	}

	/**
	 * Enable a data source connection
	 * @param id The ID of the data source connection to enable
	 */
	async enableDsConnection(id: string): Promise<void> {
		const dsConnection = this.getDsConnection(id);
		if (!dsConnection) {
			throw new Error(`Data source connection with ID ${id} not found`);
		}

		if (dsConnection.enabled) return; // Already enabled

		dsConnection.enabled = true;

		// Update project data file
		await this.saveData();

		logger.info(`ProjectPersistence: Enabled data source connection: ${id}`);
	}

	/**
	 * Disable a data source connection
	 * @param id The ID of the data source connection to disable
	 */
	async disableDsConnection(id: string): Promise<void> {
		const dsConnection = this.getDsConnection(id);
		if (!dsConnection) {
			throw new Error(`Data source connection with ID ${id} not found`);
		}

		if (!dsConnection.enabled) return; // Already disabled

		// If this is the primary source connection, we need to find a new primary
		const wasPrimary = dsConnection.isPrimary;

		// Disable the legacy data source connection
		dsConnection.enabled = false;

		// Update project data file
		await this.saveData();

		logger.info(`ProjectPersistence: Disabled data source connection: ${id}`);

		if (wasPrimary) {
			await this.ensurePrimaryDsConnection();
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

			await this.storeProjectResourceMetadata(resourceUri, metadata);

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
			const metadata = await this.getProjectResourceMetadata(resourceUri);

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
	private async storeProjectResourceMetadata(resourceUri: string, metadata: ResourceMetadata): Promise<void> {
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
	private async getProjectResourceMetadata(resourceUri: string): Promise<ResourceMetadata | undefined> {
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
