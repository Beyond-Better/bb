import { join } from '@std/path';

import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ProjectInfo as BaseProjectInfo } from 'api/llms/conversationInteraction.ts';
//import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';
import OrchestratorController from 'api/controllers/orchestratorController.ts';
import type { SessionManager } from 'api/auth/session.ts';
import { logger } from 'shared/logger.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import type { ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { getMCPManager } from 'api/mcp/mcpManager.ts';
import type { MCPManager } from 'api/mcp/mcpManager.ts';
import { getProjectPersistenceManager } from 'api/storage/projectPersistenceManager.ts';
import type ProjectPersistence from 'api/storage/projectPersistence.ts';
import type {
	DataSourceConnection,
	DataSourceConnectionSystemPrompt,
} from 'api/dataSources/interfaces/dataSourceConnection.ts';
import { ResourceManager } from 'api/resources/resourceManager.ts';
import type {
	ResourceForInteraction,
	ResourceRevisionMetadata,
	//ResourceMetadata,
	ResourcesForInteraction,
} from 'shared/types/dataSourceResource.ts';
import type { ProjectConfig } from 'shared/config/types.ts';
import type { StatementParams } from 'shared/types/collaboration.ts';
import type { InteractionId, CollaborationResponse } from 'shared/types.ts';
import type { LLMRequestParams } from 'api/types/llms.ts';
import type { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
import { getBbDir, resolveDataSourceFilePath } from 'shared/dataDir.ts';
import {
	getProjectAdminDataDir,
	getProjectAdminDir,
	isProjectMigrated,
	migrateProjectFiles,
} from 'shared/projectPath.ts';
import EventManager from 'shared/eventManager.ts';

// Extend ProjectInfo to include projectId
export interface ProjectInfo extends BaseProjectInfo {
	projectId: string;
}

class ProjectEditor {
	//private fileRevisions: Map<string, string[]> = new Map();
	public orchestratorController!: OrchestratorController;
	public projectConfig!: ProjectConfig;
	public projectData!: ProjectPersistence;
	public eventManager!: EventManager;
	public mcpManager!: MCPManager;
	public resourceManager!: ResourceManager;
	public sessionManager: SessionManager;
	public projectId: string;
	public toolSet: LLMToolManagerToolSetType = 'coding';

	public changedResources: Set<string> = new Set();
	public changeContents: Map<string, string> = new Map();
	private _projectInfo: ProjectInfo = {
		projectId: '',
		type: 'empty',
		content: '',
		//tier: null,
	};

	constructor(projectId: string, sessionManager: SessionManager) {
		this.projectId = projectId;
		this._projectInfo.projectId = projectId;
		this.sessionManager = sessionManager;
		//logger.info('ProjectEditor: sessionManager', sessionManager);
	}

	public async init(): Promise<ProjectEditor> {
		try {
			const migrated = await isProjectMigrated(this.projectId);
			if (!migrated) {
				try {
					await migrateProjectFiles(this.projectId);
					logger.info(`ProjectEditor: Successfully migrated project ${this.projectId} files`);
				} catch (migrationError) {
					logger.warn(
						`ProjectEditor: Migration attempted but failed: ${(migrationError as Error).message}`,
					);
					throw createError(
						ErrorType.ProjectHandling,
						`Could not migrate project .bb directory for ${this.projectId}: ${
							(migrationError as Error).message
						}`,
						{
							projectId: this.projectId,
						} as ProjectHandlingErrorOptions,
					);
				}
			}

			const configManager = await getConfigManager();
			await configManager.ensureLatestProjectConfig(this.projectId);
			this.projectConfig = await configManager.getProjectConfig(this.projectId);
			logger.info(
				`ProjectEditor: Using config for: ${this.projectId} - ${this.projectConfig.api?.hostname}:${this.projectConfig.api?.port}`,
				// this.projectConfig,
			);
			const projectPersistenceManager = await getProjectPersistenceManager();
			const projectData = await projectPersistenceManager.getProject(this.projectId);
			if (!projectData) {
				throw createError(
					ErrorType.ProjectHandling,
					`Could not get project for ${this.projectId}`,
					{
						projectId: this.projectId,
					} as ProjectHandlingErrorOptions,
				);
			}
			this.projectData = projectData;

			this.mcpManager = await getMCPManager();

			this.eventManager = EventManager.getInstance();

			this.resourceManager = await new ResourceManager(this).init();

			this.orchestratorController = await new OrchestratorController(this).init();

			logger.info(`ProjectEditor: initialized for ${this.projectId}`);
		} catch (error) {
			logger.error(
				`Failed to initialize ProjectEditor in ${this.projectId}:`,
				error,
			);
			throw error;
		}

		return this;
	}

	public dsConnection(id: string): DataSourceConnection | undefined {
		return this.projectData.getDsConnection(id);
	}
	get dsConnections(): Array<DataSourceConnection> {
		return this.projectData.getAllDsConnections();
	}
	get dsConnectionsForSystemPrompt(): Array<DataSourceConnectionSystemPrompt> {
		return this.projectData.getDsConnectionsForSystemPrompt();
	}

	// [TODO] this needs to be all tools for mcp servers enabled for the project, not ALL mcp servers
	public async getMCPToolsForSystemPrompt(): Promise<Array<{ name: string; description: string; server: string }>> {
		return await this.mcpManager.getAllTools();
	}

	public getDsConnectionForPrefix(uriPrefix: string): DataSourceConnection | undefined {
		return this.projectData.getDsConnectionForPrefix(uriPrefix);
	}

	get primaryDsConnection(): DataSourceConnection | undefined {
		return this.projectData.getPrimaryDsConnection();
	}
	get primaryDsConnectionRoot(): string | undefined {
		return this.projectData.getPrimaryDsConnection()?.getDataSourceRoot();
	}

	public async isResourceWithinDataSource(resourceUri: string): Promise<boolean> {
		logger.info(`ProjectEditor: isResourceWithinDataSource for ${resourceUri}`);
		return !!(await this.primaryDsConnection?.isResourceWithinDataSource(resourceUri));
	}

	public async resolveDsConnectionFilePath(filePath: string): Promise<string | undefined> {
		//logger.info(`ProjectEditor: resolveDsConnectionFilePath for ${this.projectId} - ${filePath}`);
		if (!this.primaryDsConnectionRoot) {
			throw new Error(`Resolve DsConnection Path Failed: No primary data source found`);
		}
		const resolvedPath = this.primaryDsConnection?.id
			? await resolveDataSourceFilePath(this.primaryDsConnectionRoot, filePath)
			: undefined;
		//logger.info(`ProjectEditor: resolveDsConnectionFilePath resolvedPath: ${resolvedPath}`);
		return resolvedPath;
	}

	public async getProjectAdminDir(): Promise<string> {
		// logger.info(`ProjectEditor: getProjectAdminDir for ${this.projectId}`);
		return await getProjectAdminDir(this.projectId);
	}

	public async getBbDir(): Promise<string> {
		return await getBbDir(this.projectId);
	}

	// [TODO] This should be getProjectAdminDataDir
	public async getBbDataDir(): Promise<string> {
		return await getProjectAdminDataDir(this.projectId);
	}

	// [TODO] This should be writeToGlobalProjectDataDir
	public async writeToBbDir(
		filename: string,
		content: string,
	): Promise<void> {
		// Write to the global project directory
		const projectAdminDataDir = await getProjectAdminDataDir(this.projectId);
		const filePath = join(projectAdminDataDir, filename);
		await Deno.writeTextFile(filePath, content);
		return;
	}

	// [TODO] This should be readFromGlobalProjectDataDir
	public async readFromBbDir(filename: string): Promise<string | null> {
		// Read from the global project directory
		const projectAdminDataDir = await getProjectAdminDataDir(this.projectId);
		const filePath = join(projectAdminDataDir, filename);

		try {
			return await Deno.readTextFile(filePath);
		} catch (error) {
			if (error instanceof Deno.errors.NotFound) {
				return null;
			}
			throw error;
		}
	}

	// [TODO] This should be removeFromGlobalProjectDataDir
	public async removeFromBbDir(filename: string): Promise<void> {
		// Remove from the global project directory
		const projectAdminDataDir = await getProjectAdminDataDir(this.projectId);
		const filePath = join(projectAdminDataDir, filename);

		try {
			await Deno.remove(filePath);
		} catch (error) {
			if (!(error instanceof Deno.errors.NotFound)) {
				throw error;
			}
		}
	}

	get projectInfo(): ProjectInfo {
		return this._projectInfo;
	}

	set projectInfo(projectInfo: ProjectInfo) {
		projectInfo.projectId = this.projectId;
		this._projectInfo = projectInfo;
	}

	public async updateProjectInfo(): Promise<void> {
		// If we've already generated the metadata, skip regeneration
		if (this.projectInfo.type === 'metadata') {
			return;
		}
		// If prompt caching is enabled and we've already generated the datasource listing, skip regeneration
		if ((this.projectConfig.api?.usePromptCaching ?? true) && this.projectInfo.type === 'datasources') {
			return;
		}

		const projectInfo: ProjectInfo = {
			projectId: this.projectId,
			type: 'empty',
			content: '',
			//tier: null,
		};

		// [TODO] data sources are already included in system prompt
		// don't need to include them twice - but maybe they should be removed from system prompt and added via <project-info>
		/*
		if (!this.dsConnections || this.dsConnections.length === 0) {
			throw new Error(`Updating Project Info Failed: No data sources found`);
		}
		const formattedSources = this.dsConnections.map((source, idx) => {
			const id = source.id,
				name = source.name,
				type = source.type,
				//enabled = source.enabled,
				capabilities = source.capabilities || [],
				//accessMethod = source.accessMethod,
				uriPrefix = source.uriPrefix || `${type}-${name}://`;

			let details = `${idx + 1}. Data Source ID: ${id}\n`;
			details += `  - Name: ${name}\n`;
			details += `  - Type: ${type}\n`;
			//details += `  - Status: ${enabled ? 'Enabled' : 'Disabled'}\n`;
			//details += `  - Access: ${accessMethod}\n`;
			details += `  - URI Format: ${uriPrefix}...\n`;
			details += `  - Capabilities: ${capabilities.join(', ')}\n`;

			// Add MCP-specific details if applicable
			if (source.mcpConfig) {
				details += `  - MCP Server: ${source.mcpConfig.serverId}\n`;
				if (source.mcpConfig.description) {
					details += `  - Description: ${source.mcpConfig.description}\n`;
				}
			}

			// Add config details if it contains a dataSourceRoot for filesystem sources
			if (type === 'filesystem' && source.config && typeof source.config.dataSourceRoot === 'string') {
				details += `  - Root: ${source.config.dataSourceRoot}\n`;
			}

			return details;
		}).join('\n');

		if (formattedSources) {
			projectInfo.type = 'datasources';
			projectInfo.content = formattedSources;
			logger.info(
				`ProjectEditor: Updated projectInfo for: ${this.projectId}`,
			);
		}
		  */

		const projectMetadata = {
			projectId: this.projectId,
			projectName: this.projectConfig.name,
			dataSourceCount: this.dsConnections.length,
			// [TODO] toolsCount is showing as 0 - maybe we're getting length before tools get loaded for the first time
			//toolsCount: this.orchestratorController.toolManager.getLoadedToolNames.length,
		};
		projectInfo.type = 'metadata';
		projectInfo.content = JSON.stringify(projectMetadata);
		this.projectInfo = projectInfo;
	}

	public async initCollaboration(
		conversationId: InteractionId,
	): Promise<LLMConversationInteraction> {
		logger.info(
			`ProjectEditor: Initializing a conversation with ID: ${conversationId}`,
		);
		return await this.orchestratorController.initializeInteraction(
			conversationId,
		);
	}

	async handleStatement(
		statement: string,
		conversationId: InteractionId,
		options?: { maxTurns?: number },
		statementParams?: StatementParams,
		filesToAttach?: string[],
		dsConnectionIdForAttach?: string,
	): Promise<CollaborationResponse> {
		await this.initCollaboration(conversationId);
		logger.info(
			`ProjectEditor: Initialized conversation with ID: ${conversationId}, handling statement`,
			//{options, statementParams}
		);
		const statementAnswer = await this.orchestratorController.handleStatement(
			statement,
			conversationId,
			options,
			statementParams,
			filesToAttach,
			dsConnectionIdForAttach,
		);
		return statementAnswer;
	}

	// prepareResourcesForInteraction is called by load_resources tool
	// only existing resources can be prepared and added, otherwise call write_resource tools with createIfMissing:true
	async prepareResourcesForInteraction(
		resourceUris: string[],
	): Promise<ResourcesForInteraction> {
		const resourcesAdded: Array<ResourceForInteraction> = [];

		for (const resourceUri of resourceUris) {
			try {
				// Always load from original source to ensure we have the latest version
				logger.info(`ProjectEditor: Get resource for: ${resourceUri}`);
				const resource = await this.resourceManager.loadResource(resourceUri);

				// Store at project level for future reference
				await this.projectData.storeProjectResource(resourceUri, resource.content, resource.metadata);

				// Extract resource name from metadata or use URI as fallback
				const resourceName = resource.metadata?.name || resourceUri;

				// Create proper revision metadata with all required fields for hydration
				const revisionMetadata: ResourceRevisionMetadata = {
					// Copy existing metadata fields if available
					accessMethod: resource.metadata.accessMethod,
					type: resource.metadata.type || 'file',
					contentType: resource.metadata.contentType ||
						(resource.metadata.mimeType?.startsWith('image/') ? 'image' : 'text'),
					mimeType: resource.metadata.mimeType,
					name: resource.metadata.name || resourceName,
					uri: resource.metadata.uri,
					//path: resource.metadata?.path,

					// Essential fields for resource hydration
					size: resource.metadata?.size ||
						(typeof resource.content === 'string' ? resource.content.length : resource.content.byteLength),
					lastModified: resource.metadata?.lastModified || new Date(),
					error: null,
				};
				//logger.info(`ProjectEditor: Using metadata for resource ${resourceName}`, { resourceMetadata: resource.metadata, revisionMetadata });

				// Add to resources for conversation
				resourcesAdded.push({
					resourceName,
					resourceUri,
					metadata: revisionMetadata,
				});

				logger.info(`ProjectEditor: Prepared resource: ${resourceName}`);
			} catch (error) {
				logger.error(`ProjectEditor: Error adding resource ${resourceUri}: ${(error as Error).message}`);
				const errorMessage = (error as Error).message;

				// Create error metadata with required fields
				const errorMetadata: ResourceRevisionMetadata = {
					accessMethod: 'bb',
					type: 'file',
					contentType: 'text',
					mimeType: 'text/plain',
					name: resourceUri,
					uri: resourceUri,
					lastModified: new Date(),
					size: 0,
					error: errorMessage,
				};

				resourcesAdded.push({
					resourceName: resourceUri,
					resourceUri,
					metadata: errorMetadata,
				});
			}
		}

		return resourcesAdded;
	}
}

export default ProjectEditor;
