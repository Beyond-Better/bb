import { copy, ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import type { InteractionsFileV4 } from 'api/storage/storageMigration.ts';
import {
	getProjectAdminDataDir,
	//getProjectAdminDir,
	isProjectMigrated,
	migrateProjectFiles,
} from 'shared/projectPath.ts';
import LLMInteraction from 'api/llms/baseInteraction.ts';
import LLMChatInteraction from 'api/llms/chatInteraction.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type Collaboration from 'api/collaborations/collaboration.ts';
import type {
	CollaborationId,
	InteractionDetailedMetadata,
	InteractionId,
	InteractionMetadata,
	InteractionMetrics,
	InteractionStats,
	InteractionType,
	LLMRequestRecord,
	ObjectivesData,
	ProjectId,
	ResourceMetrics,
	TokenUsage,
	TokenUsageAnalysis,
	TokenUsageRecord,
	TokenUsageStatsForInteraction,
} from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type {
	LLMModelConfig,
	//LLMRolesModelConfig
} from 'api/types/llms.ts';
import type { CollaborationParams } from 'shared/types/collaboration.ts';
import type { InteractionResourcesMetadata } from 'shared/types/dataSourceResource.ts';
import { logger } from 'shared/logger.ts';
import TokenUsagePersistence from './tokenUsagePersistence.ts';
import LLMRequestPersistence from './llmRequestPersistence.ts';
import CollaborationPersistence from './collaborationPersistence.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isTokenUsageValidationError } from 'api/errors/error.ts';
import { errorMessage } from 'shared/error.ts';
import type {
	FileHandlingErrorOptions,
	ProjectHandlingErrorOptions,
	ResourceHandlingErrorOptions,
} from 'api/errors/error.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/llms/conversationInteraction.ts';
import type LLMTool from 'api/llms/llmTool.ts';
//import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
//import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import { generateResourceRevisionKey } from 'shared/dataSource.ts';
//import { getConfigManager } from 'shared/config/configManager.ts';
import { stripIndents } from 'common-tags';
//import type { ProjectConfig } from 'shared/config/types.ts';
//import { encodeHex } from '@std/encoding';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: ProjectId };

class InteractionPersistence {
	private interactionDir!: string;
	private interactionParentDir: string | undefined;
	private metadataPath!: string;
	private messagesPath!: string;
	private changeLogPath!: string;
	private preparedSystemPath!: string;
	private preparedToolsPath!: string;
	private interactionsMetadataPath!: string;
	private resourcesMetadataPath!: string;
	private resourceRevisionsDir!: string;
	private objectivesPath!: string;
	private resourcesPath!: string;
	private projectInfoPath!: string;
	private initialized: boolean = false;
	private tokenUsagePersistence!: TokenUsagePersistence;
	private llmRequestPersistence!: LLMRequestPersistence;
	private collaborationPersistence!: CollaborationPersistence;
	private ensuredDirs: Set<string> = new Set();

	constructor(
		private _collaborationId: CollaborationId,
		private _interactionId: InteractionId,
		private projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo },
		private parentInteractionId?: InteractionId,
	) {
		//this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		//logger.info(`InteractionPersistence: Ensuring Initialized`);
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
	}

	async init(): Promise<InteractionPersistence> {
		// Get BB data directory using project ID
		// Check if project has been migrated to new structure
		const projectId = this.projectEditor.projectId;

		const migrated = await isProjectMigrated(projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(projectId);
				logger.info(`InteractionPersistence: Successfully migrated project ${projectId} files`);
			} catch (migrationError) {
				logger.warn(
					`InteractionPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
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
		// Migration now handled at startup - see api/src/storage/storageMigration.ts

		// Use new global project data directory
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		if (!projectAdminDataDir) {
			logger.error(
				`InteractionPersistence: Failed to get data directory for projectId ${projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
		logger.debug(`InteractionPersistence: Using data dir for ${projectId}: ${projectAdminDataDir}`);

		// Use collaborations structure
		const collaborationsDir = join(projectAdminDataDir, 'collaborations');

		const collaborationDir = join(collaborationsDir, this._collaborationId);
		const interactionsDir = join(collaborationDir, 'interactions');
		//logger.info(`InteractionPersistence: Using collaborationDir for ${this._collaborationId}: ${collaborationDir}`);
		//logger.info(`InteractionPersistence: Using interactionsDir for ${this._collaborationId}: ${interactionsDir}`);

		this.interactionsMetadataPath = join(collaborationDir, 'interactions.json');

		this.interactionDir = join(interactionsDir, this._interactionId);
		if (this.parentInteractionId) {
			this.interactionParentDir = join(interactionsDir, this.parentInteractionId);
		}

		this.metadataPath = join(this.interactionDir, 'metadata.json');

		this.messagesPath = join(this.interactionDir, 'messages.jsonl');
		this.changeLogPath = join(this.interactionDir, 'changes.jsonl');

		this.preparedSystemPath = join(this.interactionDir, 'prepared_system.json');
		this.preparedToolsPath = join(this.interactionDir, 'prepared_tools.json');

		this.resourcesMetadataPath = join(this.interactionDir, 'resources_metadata.json');
		this.resourceRevisionsDir = join(this.interactionDir, 'resource_revisions');

		this.projectInfoPath = join(this.interactionDir, 'project_info.json');

		this.objectivesPath = join(this.interactionDir, 'objectives.json');
		this.resourcesPath = join(this.interactionDir, 'resources.json');

		// [TODO] using interactionParentDir is good for chat interactions, but agent (child interaction) interactions need to keep
		// tokenUsage with the child interaction persistence, not the parent
		// Do we need two types of parentID, one for chats and one for sub-agents??
		// Or maybe we need to record whether interactionPersistence is for orchestrator or agent?
		// Do we keep agent details in same interaction directory but separate messages, metadata, and tokenUsage files for each agent?
		this.tokenUsagePersistence = await new TokenUsagePersistence(this.interactionParentDir ?? this.interactionDir)
			.init();
		this.llmRequestPersistence = await new LLMRequestPersistence(this.interactionParentDir ?? this.interactionDir)
			.init();
		this.collaborationPersistence = await new CollaborationPersistence(this._collaborationId, this.projectEditor)
			.init();

		return this;
	}

	public get interactionId(): InteractionId {
		return this._interactionId;
	}

	// export interface ProjectHandlingErrorOptions extends ErrorOptions {
	// 	project_id?: string;
	// 	project_root?: string;
	// 	project_type?: string;
	// }

	static async listInteractions(collaboration: Collaboration, options: {
		page: number;
		limit: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
		projectId: ProjectId;
	}): Promise<{ interactions: InteractionMetadata[]; totalCount: number }> {
		//logger.info(`InteractionPersistence: listInteractions called with projectId: ${options.projectId}`);
		// Check if project has been migrated to new structure
		const migrated = await isProjectMigrated(options.projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(options.projectId);
				logger.info(
					`InteractionPersistence: listInteractions - Successfully migrated project ${options.projectId} files`,
				);
			} catch (migrationError) {
				logger.warn(
					`InteractionPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
				);
				throw createError(
					ErrorType.ProjectHandling,
					`Could not migrate project .bb directory for ${options.projectId}: ${
						(migrationError as Error).message
					}`,
					{
						projectId: options.projectId,
					} as ProjectHandlingErrorOptions,
				);
			}
		}

		const projectAdminDataDir = await getProjectAdminDataDir(options.projectId);
		if (!projectAdminDataDir) {
			logger.error(
				`InteractionPersistence: Failed to get data directory for projectId ${options.projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: options.projectId,
				} as ProjectHandlingErrorOptions,
			);
		}

		const collaborationDir = join(projectAdminDataDir, 'collaborations', collaboration.id);
		const interactionsMetadataPath = join(collaborationDir, 'interactions.json');

		try {
			//logger.info(`InteractionPersistence: Ensuring directories exist: ${dirname(projectAdminDataDir)} and ${projectAdminDataDir}`);
			await ensureDir(dirname(projectAdminDataDir)); // Ensure parent directory exists
			await ensureDir(projectAdminDataDir);
			await ensureDir(collaborationDir);
		} catch (error) {
			logger.error(`InteractionPersistence: Failed to create required directories: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create required directories: ${errorMessage(error)}`,
				{
					filePath: projectAdminDataDir,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}

		try {
			// Migration now handled at startup - see api/src/storage/storageMigration.ts

			if (!await exists(interactionsMetadataPath)) {
				// logger.info(
				// 	`InteractionPersistence: Creating new interactions.json file at ${interactionsMetadataPath}`,
				// );
				await Deno.writeTextFile(
					interactionsMetadataPath,
					JSON.stringify({
						version: '4.0',
						interactions: [],
					}),
				);
				return { interactions: [], totalCount: 0 };
			}
		} catch (error) {
			logger.error(`InteractionPersistence: Failed to create collaborations.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create interactions.json: ${errorMessage(error)}`,
				{
					filePath: interactionsMetadataPath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}

		let interactionsData: InteractionsFileV4;
		try {
			const content = await Deno.readTextFile(interactionsMetadataPath);
			interactionsData = JSON.parse(content);
		} catch (error) {
			logger.error(`InteractionPersistence: Failed to read interactions.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to read interactions.json: ${errorMessage(error)}`,
				{
					filePath: interactionsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		let interactions: InteractionMetadata[] = interactionsData.interactions;

		// TODO: Extract interactions from collaborations if needed
		// This is a temporary implementation during the transition period

		// Apply filters
		if (options.startDate) {
			interactions = interactions.filter((conv) => new Date(conv.createdAt) >= options.startDate!);
		}
		if (options.endDate) {
			interactions = interactions.filter((conv) => new Date(conv.createdAt) <= options.endDate!);
		}
		if (options.llmProviderName) {
			interactions = interactions.filter((conv) => conv.llmProviderName === options.llmProviderName);
		}

		// Get total count before pagination
		const totalCount = interactions.length;

		// Sort interactions by updatedAt in descending order
		interactions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

		// Apply pagination
		const startIndex = (options.page - 1) * options.limit;
		interactions = interactions.slice(startIndex, startIndex + options.limit);

		return {
			interactions: interactions.map((conv) => ({
				...conv,
				interactionStats: (conv as InteractionMetadata).interactionStats ||
					InteractionPersistence.defaultInteractionStats(),
				modelConfig: (conv as InteractionMetadata).modelConfig ||
					InteractionPersistence.defaultModelConfig(),
				tokenUsageStatsForInteraction: {
					tokenUsageInteraction:
						(conv as InteractionMetadata).tokenUsageStatsForInteraction?.tokenUsageInteraction ||
						InteractionPersistence.defaultInteractionTokenUsage(),
					tokenUsageStatement:
						(conv as InteractionMetadata).tokenUsageStatsForInteraction?.tokenUsageStatement ||
						InteractionPersistence.defaultTokenUsage(),
					tokenUsageTurn: (conv as InteractionMetadata).tokenUsageStatsForInteraction?.tokenUsageTurn ||
						InteractionPersistence.defaultTokenUsage(),
				},
			})),
			totalCount,
		};
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

	async writeTokenUsage(record: TokenUsageRecord, type: InteractionType): Promise<void> {
		await this.ensureInitialized();
		try {
			await Promise.all([
				this.collaborationPersistence.writeTokenUsage(record, type),
				this.tokenUsagePersistence.writeUsage(record, type),
			]);
		} catch (error) {
			if (isTokenUsageValidationError(error)) {
				logger.error(
					`InteractionPersistence: TokenUsage validation failed: ${error.options.field} - ${error.options.constraint}`,
				);
			} else {
				logger.error(
					`InteractionPersistence: TokenUsage validation failed - Unknown error type: ${
						(error instanceof Error) ? error.message : error
					}`,
				);
				throw error;
			}
		}
	}

	async getTokenUsage(type: InteractionType): Promise<TokenUsageRecord[]> {
		await this.ensureInitialized();
		return this.tokenUsagePersistence.getUsage(type);
	}

	async writeLLMRequest(record: LLMRequestRecord): Promise<void> {
		await this.ensureInitialized();
		await this.llmRequestPersistence.writeLLMRequest(record);
	}

	async getLLMRequest(): Promise<LLMRequestRecord[]> {
		await this.ensureInitialized();
		return this.llmRequestPersistence.getLLMRequest();
	}

	async saveInteraction(interaction: LLMInteraction): Promise<void> {
		try {
			await this.ensureInitialized();
			logger.debug(`InteractionPersistence: Ensure directory for saveInteraction: ${this.interactionDir}`);
			await this.ensureDirectory(this.interactionDir);

			const metadata: InteractionMetadata = {
				id: interaction.id,
				interactionType: interaction.interactionType,
				title: interaction.title,
				interactionStats: interaction.interactionStats,
				interactionMetrics: interaction.interactionMetrics,
				tokenUsageStatsForInteraction: interaction.tokenUsageStatsForInteraction,
				modelConfig: interaction.modelConfig,
				llmProviderName: interaction.llmProviderName,
				model: interaction.model,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			// Note: Interaction metadata is now managed at the collaboration level
			// Individual interactions are tracked within their parent collaboration
			// await this.updateInteractionsMetadata(metadata);

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Create metadata with analyzed token usage
			const detailedMetadata: InteractionDetailedMetadata = {
				...metadata,
				parentInteractionId: interaction.parentInteractionId,

				//system: interaction.baseSystem,
				temperature: interaction.temperature,
				maxTokens: interaction.maxTokens,

				interactionStats: interaction.interactionStats,
				interactionMetrics: interaction.interactionMetrics,

				modelConfig: interaction.modelConfig,

				// Store analyzed token usage in metadata
				tokenUsageStatsForInteraction: {
					tokenUsageInteraction: {
						inputTokens: tokenAnalysis.combined.totalUsage.input,
						outputTokens: tokenAnalysis.combined.totalUsage.output,
						totalTokens: tokenAnalysis.combined.totalUsage.total,
						cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
						cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
						thoughtTokens: tokenAnalysis.combined.totalUsage.thoughtTokens,
						totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
					},

					// Keep turn and statement level metrics
					tokenUsageTurn: interaction.tokenUsageStatsForInteraction.tokenUsageTurn,
					tokenUsageStatement: interaction.tokenUsageStatsForInteraction.tokenUsageStatement,
				},

				totalProviderRequests: interaction.totalProviderRequests,
				//tools: interaction.getAllTools().map((tool) => ({ name: tool.name, description: tool.description })),
			};

			await this.saveMetadata(detailedMetadata);

			// Save project info to JSON
			await this.saveProjectInfo(this.projectEditor.projectInfo);

			// Save messages
			//const statementCount = interaction.statementCount || 0; // Assuming this property exists
			const messages = interaction.getMessages();
			const messagesContent = messages.map((m, idx) => {
				if (m && typeof m === 'object') {
					return JSON.stringify({
						idx,
						interactionStats: m.interactionStats,
						role: m.role,
						content: m.content,
						id: m.id,
						providerResponse: m.providerResponse,
						timestamp: m.timestamp, // Assuming this property exists
					});
				} else {
					logger.warn(`InteractionPersistence: Invalid message encountered: ${JSON.stringify(m)}`);
					return null;
				}
			}).filter(Boolean).join('\n') + '\n';
			await Deno.writeTextFile(this.messagesPath, messagesContent);
			logger.debug(`InteractionPersistence: Saved messages for interaction: ${interaction.id}`);

			if (interaction.interactionType === 'conversation') {
				const interactionConversation = interaction as LLMConversationInteraction;
				// Save resources metadata
				const resourcesMetadata: InteractionResourcesMetadata = {};
				for (const [key, value] of interactionConversation.getResources()) {
					resourcesMetadata[key] = value;
				}
				await this.saveResourcesMetadata(resourcesMetadata);
				logger.debug(
					`InteractionPersistence: Saved resourcesMetadata for interaction: ${interactionConversation.id}`,
				);

				// Save objectives and resources
				const metrics = interactionConversation.interactionMetrics;
				if (metrics.objectives) {
					await this.saveObjectives(metrics.objectives);
					logger.debug(
						`InteractionPersistence: Saved objectives for interaction: ${interactionConversation.id}`,
					);
				}
				if (metrics.resources) {
					await this.saveResources(metrics.resources);
					logger.debug(
						`InteractionPersistence: Saved resources for interaction: ${interactionConversation.id}`,
					);
				}
			}
		} catch (error) {
			logger.error(`InteractionPersistence: Error saving interaction: ${errorMessage(error)}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadInteraction(
		collaboration: Collaboration,
		interactionCallbacks: LLMCallbacks,
	): Promise<LLMChatInteraction | LLMConversationInteraction | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				//logger.warn(`InteractionPersistence: Interaction metadata file not found: ${this.metadataPath}`);
				return null;
			}

			const metadata: InteractionDetailedMetadata = await this.getMetadata();
			const interaction = new LLMConversationInteraction(collaboration, this._interactionId);
			// the following syntax triggers error:
			// error: Uncaught (in promise) ReferenceError: Cannot access 'LLMInteraction' before initialization
			// class LLMChatInteraction extends LLMInteraction {
			//     at file:///Users/cng/working/bb/api/src/llms/interactions/chatInteraction.ts:14:34
			//const interaction = metadata.interactionType === 'chat'
			//	? new LLMChatInteraction(collaboration, this._interactionId)
			//	: new LLMConversationInteraction(collaboration, this._interactionId);
			await interaction.init(metadata.model, interactionCallbacks, metadata.parentInteractionId);

			interaction.id = metadata.id;
			interaction.title = metadata.title || null;
			//interaction.baseSystem = metadata.system;
			//interaction.model = metadata.model; // set during init
			interaction.maxTokens = metadata.maxTokens;
			interaction.temperature = metadata.temperature;

			interaction.interactionStats = metadata.interactionStats;
			//interaction.interactionMetrics = metadata.interactionMetrics;

			// for interaction storage
			interaction.modelConfig = metadata.modelConfig;
			// // for collaboration storage
			// interaction.collaboration = {
			// 	id: '',
			// 	type: 'project',
			// 	collaborationParams: metadata.collaborationParams ||
			// 		await this.getCollaborationParams(interaction), //await CollaborationPersistence.defaultCollaborationParams(this.projectId),
			// };

			interaction.totalProviderRequests = metadata.totalProviderRequests;

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Update interaction with analyzed values
			interaction.tokenUsageStatsForInteraction.tokenUsageInteraction = {
				inputTokens: tokenAnalysis.combined.totalUsage.input,
				outputTokens: tokenAnalysis.combined.totalUsage.output,
				totalTokens: tokenAnalysis.combined.totalUsage.total,
				cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
				cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
				thoughtTokens: tokenAnalysis.combined.totalUsage.thoughtTokens,
				totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
			};

			// Keep turn and statement usage from metadata for backward compatibility
			interaction.tokenUsageStatsForInteraction.tokenUsageTurn =
				metadata.tokenUsageStatsForInteraction?.tokenUsageTurn ||
				InteractionPersistence.defaultTokenUsage();
			interaction.tokenUsageStatsForInteraction.tokenUsageStatement =
				metadata.tokenUsageStatsForInteraction?.tokenUsageStatement ||
				InteractionPersistence.defaultTokenUsage();

			interaction.statementTurnCount = metadata.interactionMetrics?.statementTurnCount || 0;
			interaction.interactionTurnCount = metadata.interactionMetrics?.interactionTurnCount || 0;
			interaction.statementCount = metadata.interactionMetrics?.statementCount || 0;

			// Load objectives if they exist
			try {
				const objectives = await this.getObjectives();
				if (objectives) {
					interaction.setObjectives(objectives.collaboration);
					for (const statement of objectives.statement) {
						interaction.setObjectives(undefined, statement);
					}
				}
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading objectives: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			// Load resourceMetrics if they exist
			try {
				const resourceMetrics = await this.getResources();
				if (resourceMetrics) {
					resourceMetrics.accessed.forEach((r) => interaction.updateResourceAccess(r, false));
					resourceMetrics.modified.forEach((r) => interaction.updateResourceAccess(r, true));
				}
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading resourceMetrics: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			// Load project info if it exists
			try {
				const projectInfo = await this.getProjectInfo();
				if (projectInfo) {
					// Store in interaction if needed
					// Currently just logging as project info is handled by projectEditor
					logger.debug('InteractionPersistence: Loaded project info from JSON');
				}
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading project info: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			if (await exists(this.messagesPath)) {
				const messagesContent = await Deno.readTextFile(this.messagesPath);
				logger.debug('InteractionPersistence: Loaded project messages from JSON', { messagesContent });
				const messageLines = messagesContent.trim().split('\n');

				for (const line of messageLines) {
					try {
						const messageData = JSON.parse(line);
						interaction.addMessage(messageData);
					} catch (error) {
						logger.error(`InteractionPersistence: Error parsing message: ${errorMessage(error)}`);
						// Continue to the next message if there's an error
					}
				}
			}

			if (metadata.interactionType === 'conversation') {
				// Load resourcesMetadata
				const resourcesMetadata = await this.getResourcesMetadata();
				for (const [resourceRevisionKey, resourceMetadata] of Object.entries(resourcesMetadata)) {
					//const { resourceUri, resourceRevision } = extractResourceKeyAndRevision(resourceRevisionKey);

					(interaction as LLMConversationInteraction).setResourceRevisionMetadata(
						resourceRevisionKey,
						resourceMetadata,
					);

					// if (fileMetadata.inSystemPrompt) {
					// 	interaction.addResourceForSystemPrompt(filePath, fileMetadata);
					// }
				}
			}

			return interaction;
		} catch (error) {
			logger.error(`InteractionPersistence: Error loading interaction: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading interaction: ${this.metadataPath}`,
				{
					filePath: this.metadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async getInteractionData(): Promise<InteractionDetailedMetadata | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				//logger.warn(`InteractionPersistence: Interaction metadata file not found: ${this.metadataPath}`);
				return null;
			}

			const interaction: InteractionDetailedMetadata = await this.getMetadata();

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Update interaction with analyzed values
			interaction.tokenUsageStatsForInteraction.tokenUsageInteraction = {
				inputTokens: tokenAnalysis.combined.totalUsage.input,
				outputTokens: tokenAnalysis.combined.totalUsage.output,
				totalTokens: tokenAnalysis.combined.totalUsage.total,
				cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
				cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
				thoughtTokens: tokenAnalysis.combined.totalUsage.thoughtTokens,
				totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
			};

			// interaction.statementTurnCount = metadata.interactionMetrics?.statementTurnCount || 0;
			// interaction.interactionTurnCount = metadata.interactionMetrics?.interactionTurnCount || 0;
			// interaction.statementCount = metadata.interactionMetrics?.statementCount || 0;

			/*
			// Load objectives if they exist
			try {
				interaction.objectives = await this.getObjectives();
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading objectives: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			// Load resourceMetrics if they exist
			try {
				interaction.resourceMetrics = await this.getResources();
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading resourceMetrics: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			// Load project info if it exists
			try {
				interaction.projectInfo = await this.getProjectInfo();
			} catch (error) {
				logger.warn(`InteractionPersistence: Error loading project info: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole interaction load
			}

			// Load resourcesMetadata
			interaction.resourcesMetadata = await this.getResourcesMetadata();
 */

			return interaction;
		} catch (error) {
			logger.error(`InteractionPersistence: Error loading interaction: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading interaction: ${this.metadataPath}`,
				{
					filePath: this.metadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	private async updateInteractionsMetadata(
		interaction: InteractionMetadata & {
			interactionStats?: InteractionStats;
			interactionMetrics?: InteractionMetrics;
			tokenUsageStatsForInteraction?: TokenUsageStatsForInteraction;
		},
	): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`InteractionPersistence: Ensure directory for updateInteractionsMetadata: ${this.interactionsMetadataPath}`,
		);
		await this.ensureDirectory(dirname(this.interactionsMetadataPath));
		let interactionsData: InteractionsFileV4 = {
			version: '4.0',
			interactions: [],
		};

		if (await exists(this.interactionsMetadataPath)) {
			const content = await Deno.readTextFile(this.interactionsMetadataPath);
			const parsedData = JSON.parse(content);

			// Handle both old and new format
			if (Array.isArray(parsedData)) {
				// Old format: direct array
				interactionsData.interactions = parsedData;
			} else if (parsedData.version && Array.isArray(parsedData.interactions)) {
				// New format: object with version and interactions array
				interactionsData = parsedData;
			} else {
				// Unknown format, create new one
				interactionsData = {
					version: '4.0',
					interactions: [],
				};
			}
		}

		const index = interactionsData.interactions.findIndex((conv) => conv.id === interaction.id);
		if (index !== -1) {
			interactionsData.interactions[index] = {
				...interactionsData.interactions[index],
				...interaction,
				interactionStats: interaction.interactionStats ||
					InteractionPersistence.defaultInteractionStats(),
				interactionMetrics: interaction.interactionMetrics ||
					InteractionPersistence.defaultInteractionMetrics(),
				modelConfig: interaction.modelConfig ||
					InteractionPersistence.defaultModelConfig(),
				tokenUsageStatsForInteraction: {
					tokenUsageInteraction: interaction.tokenUsageStatsForInteraction.tokenUsageInteraction ||
						InteractionPersistence.defaultInteractionTokenUsage(),
					tokenUsageStatement: interaction.tokenUsageStatsForInteraction.tokenUsageStatement ||
						InteractionPersistence.defaultTokenUsage(),
					tokenUsageTurn: interaction.tokenUsageStatsForInteraction.tokenUsageTurn ||
						InteractionPersistence.defaultTokenUsage(),
				},
			};
		} else {
			interactionsData.interactions.push({
				...interaction,
				interactionStats: interaction.interactionStats ||
					InteractionPersistence.defaultInteractionStats(),
				interactionMetrics: interaction.interactionMetrics ||
					InteractionPersistence.defaultInteractionMetrics(),
				modelConfig: interaction.modelConfig ||
					InteractionPersistence.defaultModelConfig(),
				tokenUsageStatsForInteraction: {
					tokenUsageInteraction: interaction.tokenUsageStatsForInteraction.tokenUsageInteraction ||
						InteractionPersistence.defaultInteractionTokenUsage(),
					tokenUsageStatement: interaction.tokenUsageStatsForInteraction.tokenUsageStatement ||
						InteractionPersistence.defaultTokenUsage(),
					tokenUsageTurn: interaction.tokenUsageStatsForInteraction.tokenUsageTurn ||
						InteractionPersistence.defaultTokenUsage(),
				},
			});
		}

		await Deno.writeTextFile(
			this.interactionsMetadataPath,
			JSON.stringify(interactionsData, null, 2),
		);

		logger.debug(`InteractionPersistence: Saved metadata to project level for interaction: ${interaction.id}`);
	}

	async getInteractionIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.interactionsMetadataPath)) {
			const content = await Deno.readTextFile(this.interactionsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let interactions: InteractionMetadata[];
			if (Array.isArray(data)) {
				interactions = data;
			} else if (data.version && Array.isArray(data.interactions)) {
				interactions = data.interactions;
			} else {
				return null;
			}

			const interaction = interactions.find((conv) => conv.title === title);
			return interaction ? interaction.id : null;
		}
		return null;
	}

	async getInteractionTitleById(id: string): Promise<string | null> {
		if (await exists(this.interactionsMetadataPath)) {
			const content = await Deno.readTextFile(this.interactionsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let interactions: InteractionMetadata[];
			if (Array.isArray(data)) {
				interactions = data;
			} else if (data.version && Array.isArray(data.interactions)) {
				interactions = data.interactions;
			} else {
				return null;
			}

			const interaction = interactions.find((conv) => conv.id === id);
			return interaction ? interaction.title : null;
		}
		return null;
	}

	async getAllInteractions(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.interactionsMetadataPath)) {
			const content = await Deno.readTextFile(this.interactionsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let interactions: InteractionMetadata[];
			if (Array.isArray(data)) {
				interactions = data;
			} else if (data.version && Array.isArray(data.interactions)) {
				interactions = data.interactions;
			} else {
				return [];
			}

			return interactions.map(({ id, title }) => ({ id, title: title || 'untitled' }));
		}
		return [];
	}

	async saveResourcesMetadata(resourcesMetadata: InteractionResourcesMetadata): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`InteractionPersistence: Ensure directory for saveResourcesMetadata: ${this.resourcesMetadataPath}`,
		);
		await this.ensureDirectory(dirname(this.resourcesMetadataPath));
		const existingResourcesMetadata = await this.getResourcesMetadata();
		const updatedResourcesMetadata = { ...existingResourcesMetadata, ...resourcesMetadata };
		await Deno.writeTextFile(this.resourcesMetadataPath, JSON.stringify(updatedResourcesMetadata, null, 2));
		logger.debug(`InteractionPersistence: Saved resourcesMetadata for interaction: ${this._interactionId}`);
	}
	async getResourcesMetadata(): Promise<InteractionResourcesMetadata> {
		await this.ensureInitialized();
		//logger.info(`InteractionPersistence: Reading resourcesMetadata for interaction: ${this._interactionId} from ${this.resourcesMetadataPath}`);
		if (await exists(this.resourcesMetadataPath)) {
			const resourcesMetadataContent = await Deno.readTextFile(this.resourcesMetadataPath);
			return JSON.parse(resourcesMetadataContent);
		}
		return {};
	}

	/*
	async getCollaborationParams(
		interaction: LLMConversationInteraction,
	): Promise<CollaborationParams> {
		if (
			interaction.collaboration?.collaborationParams &&
			interaction.collaboration?.collaborationParams.rolesModelConfig &&
			interaction.collaboration?.collaborationParams.rolesModelConfig.orchestrator &&
			interaction.collaboration?.collaborationParams.rolesModelConfig.agent &&
			interaction.collaboration?.collaborationParams.rolesModelConfig.chat
		) return interaction.collaboration?.collaborationParams;

		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		//const projectConfig = await configManager.getProjectConfig(projectId);
		const projectConfig = this.projectEditor.projectConfig;

		// Use project defaults first, then global defaults
		const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;

		const registryService = await ModelRegistryService.getInstance(projectConfig);
		const orchestratorConfig = registryService.getModelConfig(defaultModels.orchestrator || DefaultModelsConfigDefaults.orchestrator);
		const agentConfig = registryService.getModelConfig(defaultModels.agent || DefaultModelsConfigDefaults.agent);
		const chatConfig = registryService.getModelConfig(defaultModels.chat || DefaultModelsConfigDefaults.chat);

		return {
			rolesModelConfig: {
				orchestrator: orchestratorConfig,
				agent: agentConfig,
				chat: chatConfig,
			} as LLMRolesModelConfig,
		};
	}
 */

	async getTokenUsageAnalysis(): Promise<{
		conversation: TokenUsageAnalysis;
		chat: TokenUsageAnalysis;
		combined: TokenUsageAnalysis;
	}> {
		await this.ensureInitialized();

		const analyzeUsageInteraction = await this.tokenUsagePersistence.analyzeUsage('conversation');
		const analyzeUsageChat = await this.tokenUsagePersistence.analyzeUsage('chat');

		const totalUsageCombined = {
			input: analyzeUsageInteraction.totalUsage.input + analyzeUsageChat.totalUsage.input,
			output: analyzeUsageInteraction.totalUsage.output + analyzeUsageChat.totalUsage.output,
			total: analyzeUsageInteraction.totalUsage.total + analyzeUsageChat.totalUsage.total,
			cacheCreationInput: analyzeUsageInteraction.totalUsage.cacheCreationInput +
				analyzeUsageChat.totalUsage.cacheCreationInput,
			cacheReadInput: analyzeUsageInteraction.totalUsage.cacheReadInput +
				analyzeUsageChat.totalUsage.cacheReadInput,
			thoughtTokens: analyzeUsageInteraction.totalUsage.thoughtTokens,
			totalAll: analyzeUsageInteraction.totalUsage.totalAll + analyzeUsageChat.totalUsage.totalAll,
		};
		const differentialUsageCombined = {
			input: analyzeUsageInteraction.differentialUsage.input + analyzeUsageChat.differentialUsage.input,
			output: analyzeUsageInteraction.differentialUsage.output + analyzeUsageChat.differentialUsage.output,
			total: analyzeUsageInteraction.differentialUsage.total + analyzeUsageChat.differentialUsage.total,
		};
		const cacheImpactCombined = {
			potentialCost: analyzeUsageInteraction.cacheImpact.potentialCost +
				analyzeUsageChat.cacheImpact.potentialCost,
			actualCost: analyzeUsageInteraction.cacheImpact.actualCost + analyzeUsageChat.cacheImpact.actualCost,
			savingsTotal: analyzeUsageInteraction.cacheImpact.savingsTotal + analyzeUsageChat.cacheImpact.savingsTotal,
			savingsPercentage: ((analyzeUsageInteraction.cacheImpact.savingsPercentage +
				analyzeUsageChat.cacheImpact.savingsPercentage) / 2),
		};
		const byRoleCombined = {
			user: analyzeUsageInteraction.byRole.user + analyzeUsageChat.byRole.user,
			assistant: analyzeUsageInteraction.byRole.assistant + analyzeUsageChat.byRole.assistant,
			system: analyzeUsageInteraction.byRole.system + analyzeUsageChat.byRole.system,
			tool: analyzeUsageInteraction.byRole.tool + analyzeUsageChat.byRole.tool,
		};

		return {
			conversation: analyzeUsageInteraction,
			chat: analyzeUsageChat,
			combined: {
				totalUsage: totalUsageCombined,
				differentialUsage: differentialUsageCombined,
				cacheImpact: cacheImpactCombined,
				byRole: byRoleCombined,
			},
		};
	}

	async saveMetadata(metadata: Partial<InteractionDetailedMetadata>): Promise<void> {
		// Set version 4 for new modelConfig format
		metadata.version = 4;
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for saveMetadata: ${this.metadataPath}`);
		await this.ensureDirectory(dirname(this.metadataPath));
		const existingMetadata = await this.getMetadata();
		const updatedMetadata = { ...existingMetadata, ...metadata };
		await Deno.writeTextFile(this.metadataPath, JSON.stringify(updatedMetadata, null, 2));
		logger.debug(`InteractionPersistence: Saved metadata for interaction: ${this._interactionId}`);

		// Update the stats in project-level interactions metadata file
		await this.updateInteractionsMetadata(updatedMetadata);
	}

	async getMetadata(): Promise<InteractionDetailedMetadata> {
		await this.ensureInitialized();
		if (await exists(this.metadataPath)) {
			const metadataContent = await Deno.readTextFile(this.metadataPath);
			const metadata = JSON.parse(metadataContent);

			// Migration logic for older versions
			if (!metadata.version || metadata.version < 4) {
				// Migrate from version 3 or lower to version 4
				if (metadata.requestParams && !metadata.modelConfig) {
					// Move existing requestParams to rolesModelConfig.orchestrator
					const legacyParams: LLMModelConfig = metadata.requestParams;
					metadata.modelConfig = {
						model: legacyParams.model || '',
						temperature: legacyParams.temperature || 0.7,
						maxTokens: legacyParams.maxTokens || 4000,
						extendedThinking: legacyParams.extendedThinking,
						usePromptCaching: legacyParams.usePromptCaching,
					};

					logger.info(
						`InteractionPersistence: Migrated requestParams from version ${
							metadata.version || 'unknown'
						} to version 4 for interaction: ${this._interactionId}`,
					);
				}
				metadata.version = 4;

				// Save the migrated metadata back to disk to avoid re-migration on future reads
				try {
					await Deno.writeTextFile(this.metadataPath, JSON.stringify(metadata, null, 2));
					logger.debug(
						`InteractionPersistence: Persisted migrated metadata for interaction: ${this._interactionId}`,
					);
				} catch (error) {
					logger.warn(`InteractionPersistence: Failed to persist migrated metadata: ${errorMessage(error)}`);
					// Continue even if save fails - the migration is still applied in memory
				}
			}

			return metadata;
		}
		return InteractionPersistence.defaultMetadata();
	}

	static defaultInteractionStats(): InteractionStats {
		return {
			statementCount: 0,
			statementTurnCount: 0,
			interactionTurnCount: 0,
		};
	}
	static defaultInteractionMetrics(): InteractionMetrics {
		return {
			statementCount: 0,
			statementTurnCount: 0,
			interactionTurnCount: 0,
			objectives: { collaboration: '', statement: [], timestamp: '' },
			resources: { accessed: new Set(), modified: new Set(), active: new Set() },
			toolUsage: {
				currentToolSet: '',
				toolStats: new Map(),
			},
		};
	}
	static defaultInteractionTokenUsage(): TokenUsage {
		return DEFAULT_TOKEN_USAGE();
	}
	static defaultTokenUsage(): TokenUsage {
		return DEFAULT_TOKEN_USAGE();
	}
	static defaultModelConfig(): LLMModelConfig {
		return {
			model: '',
			temperature: 0,
			maxTokens: 0,
			extendedThinking: { enabled: false, budgetTokens: 0 },
			usePromptCaching: false,
		};
	}

	static defaultMetadata(): InteractionDetailedMetadata {
		const metadata = {
			version: 4, // default version for new interactions with rolesModelConfig
			//projectId: this.projectEditor.projectInfo.projectId,
			id: '',
			parentInteractionId: undefined,
			interactionType: 'conversation' as InteractionType,
			title: '',
			llmProviderName: '',
			model: '',
			createdAt: '',
			updatedAt: '',

			//system: '',
			temperature: 0,
			maxTokens: 4096,

			totalProviderRequests: 0,

			tokenUsageStatsForInteraction: {
				tokenUsageTurn: InteractionPersistence.defaultTokenUsage(),
				tokenUsageStatement: InteractionPersistence.defaultTokenUsage(),
				tokenUsageInteraction: InteractionPersistence.defaultInteractionTokenUsage(),
			},

			modelConfig: InteractionPersistence.defaultModelConfig(),

			interactionStats: InteractionPersistence.defaultInteractionStats(),
			interactionMetrics: InteractionPersistence.defaultInteractionMetrics(),
			//tools: [],
		};
		return metadata;
	}

	async savePreparedSystemPrompt(systemPrompt: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`InteractionPersistence: Ensure directory for savePreparedSystemPrompt: ${this.preparedSystemPath}`,
		);
		await this.ensureDirectory(dirname(this.preparedSystemPath));
		const promptData = { systemPrompt };
		await Deno.writeTextFile(this.preparedSystemPath, JSON.stringify(promptData, null, 2));
		logger.info(`InteractionPersistence: Prepared prompt saved for interaction: ${this._interactionId}`);
	}

	async getPreparedSystemPrompt(): Promise<string | null> {
		await this.ensureInitialized();
		if (await exists(this.preparedSystemPath)) {
			const content = await Deno.readTextFile(this.preparedSystemPath);
			const promptData = JSON.parse(content);
			return promptData.systemPrompt;
		}
		return null;
	}

	async savePreparedTools(tools: LLMTool[]): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for savePreparedTools: ${this.preparedToolsPath}`);
		await this.ensureDirectory(dirname(this.preparedToolsPath));
		//const toolsData = Array.from(tools.values()).map((tool) => ({
		const toolsData = tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
		await Deno.writeTextFile(this.preparedToolsPath, JSON.stringify(toolsData, null, 2));
		logger.info(`InteractionPersistence: Prepared tools saved for interaction: ${this._interactionId}`);
	}

	async getPreparedTools(): Promise<LLMTool[] | null> {
		await this.ensureInitialized();
		if (await exists(this.preparedToolsPath)) {
			const content = await Deno.readTextFile(this.preparedToolsPath);
			const toolsData = JSON.parse(content);
			return toolsData;
		}
		return null;
	}

	async saveObjectives(objectives: ObjectivesData): Promise<void> {
		if (!objectives.statement || !Array.isArray(objectives.statement)) {
			throw createError(ErrorType.FileHandling, 'Invalid objectives format', {
				filePath: this.objectivesPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for saveObjectives: ${this.objectivesPath}`);
		await this.ensureDirectory(dirname(this.objectivesPath));
		await Deno.writeTextFile(this.objectivesPath, JSON.stringify(objectives, null, 2));
		logger.debug(`InteractionPersistence: Saved objectives for interaction: ${this._interactionId}`);
	}

	async getObjectives(): Promise<ObjectivesData | null> {
		await this.ensureInitialized();
		if (await exists(this.objectivesPath)) {
			const content = await Deno.readTextFile(this.objectivesPath);
			return JSON.parse(content);
		}
		return null;
	}

	async saveResources(resourceMetrics: ResourceMetrics): Promise<void> {
		if (!resourceMetrics.accessed || !resourceMetrics.modified || !resourceMetrics.active) {
			throw createError(ErrorType.FileHandling, 'Invalid resourceMetrics format', {
				filePath: this.resourcesPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for saveResources: ${this.resourcesPath}`);
		await this.ensureDirectory(dirname(this.resourcesPath));
		// Convert Sets to arrays for storage
		const storageFormat = {
			accessed: Array.from(resourceMetrics.accessed),
			modified: Array.from(resourceMetrics.modified),
			active: Array.from(resourceMetrics.active),
			timestamp: new Date().toISOString(),
		};
		await Deno.writeTextFile(this.resourcesPath, JSON.stringify(storageFormat, null, 2));
		logger.debug(`InteractionPersistence: Saved resourceMetrics for interaction: ${this._interactionId}`);
	}

	async getResources(): Promise<ResourceMetrics | null> {
		await this.ensureInitialized();
		if (await exists(this.resourcesPath)) {
			const content = await Deno.readTextFile(this.resourcesPath);
			const stored = JSON.parse(content);
			// Convert arrays back to Sets
			return {
				accessed: new Set(stored.accessed),
				modified: new Set(stored.modified),
				active: new Set(stored.active),
			};
		}
		return null;
	}

	async saveProjectInfo(projectInfo: ExtendedProjectInfo): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for saveProjectInfo: ${this.projectInfoPath}`);
		await this.ensureDirectory(dirname(this.projectInfoPath));
		try {
			await Deno.writeTextFile(this.projectInfoPath, JSON.stringify(projectInfo, null, 2));
			logger.debug(`InteractionPersistence: Saved project info JSON for interaction: ${this._interactionId}`);
		} catch (error) {
			throw createError(ErrorType.FileHandling, `Failed to save project info JSON: ${errorMessage(error)}`, {
				filePath: this.projectInfoPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	async getProjectInfo(): Promise<ExtendedProjectInfo | null> {
		await this.ensureInitialized();
		try {
			if (await exists(this.projectInfoPath)) {
				const content = await Deno.readTextFile(this.projectInfoPath);
				return JSON.parse(content);
			}
			return null;
		} catch (error) {
			throw createError(ErrorType.FileHandling, `Failed to load project info JSON: ${errorMessage(error)}`, {
				filePath: this.projectInfoPath,
				operation: 'read',
			} as FileHandlingErrorOptions);
		}
	}

	// This method saves project info as markdown for debugging in localdev environment
	async dumpProjectInfo(projectInfo: ProjectInfo): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for dumpProjectInfo: ${this.interactionDir}`);
		await this.ensureDirectory(this.interactionDir);
		const projectInfoPath = join(this.interactionDir, 'dump_project_info.md');
		const content = stripIndents`---
			type: ${projectInfo.type}
			---
			${projectInfo.content}
		`;
		await Deno.writeTextFile(projectInfoPath, content);
		logger.info(`InteractionPersistence: Project info dumped for interaction: ${this._interactionId}`);
	}

	// this is a system prompt dump primarily used for debugging
	async dumpSystemPrompt(systemPrompt: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for dumpSystemPrompt: ${this.interactionDir}`);
		await this.ensureDirectory(this.interactionDir);
		const systemPromptPath = join(this.interactionDir, 'dump_system_prompt.md');
		await Deno.writeTextFile(systemPromptPath, systemPrompt);
		logger.info(`InteractionPersistence: System prompt dumped for interaction: ${this._interactionId}`);
	}

	private handleSaveError(error: unknown, filePath: string): never {
		if (error instanceof Deno.errors.PermissionDenied) {
			throw createError(
				ErrorType.FileHandling,
				`Permission denied when saving interaction: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else if (error instanceof Deno.errors.NotFound) {
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when saving interaction: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else {
			logger.error(`InteractionPersistence: Error saving interaction: ${errorMessage(error)}`);
			throw createError(ErrorType.FileHandling, `Failed to save interaction: ${filePath}`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	async logChange(filePath: string, change: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`InteractionPersistence: Ensure directory for logChange: ${this.changeLogPath}`);
		await this.ensureDirectory(dirname(this.changeLogPath));

		const changeEntry = JSON.stringify({
			timestamp: new Date().toISOString(),
			filePath,
			change,
		}) + '\n';
		logger.info(`InteractionPersistence: Writing change file: ${this.changeLogPath}`);

		await Deno.writeTextFile(this.changeLogPath, changeEntry, { append: true });
	}

	async getChangeLog(): Promise<Array<{ timestamp: string; filePath: string; change: string }>> {
		await this.ensureInitialized();

		if (!await exists(this.changeLogPath)) {
			return [];
		}

		const content = await Deno.readTextFile(this.changeLogPath);
		const lines = content.trim().split('\n');

		return lines.map((line) => JSON.parse(line));
	}

	async deleteInteraction(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Remove from interactions metadata first
			if (await exists(this.interactionsMetadataPath)) {
				const content = await Deno.readTextFile(this.interactionsMetadataPath);
				const data = JSON.parse(content);

				// Handle both old and new format
				if (Array.isArray(data)) {
					// Old format
					const updatedInteractions = data.filter((conv: InteractionMetadata) =>
						conv.id !== this._interactionId
					);
					await Deno.writeTextFile(
						this.interactionsMetadataPath,
						JSON.stringify(updatedInteractions, null, 2),
					);
				} else if (data.version && Array.isArray(data.interactions)) {
					// New format
					data.interactions = data.interactions.filter((conv: InteractionMetadata) =>
						conv.id !== this._interactionId
					);
					await Deno.writeTextFile(this.interactionsMetadataPath, JSON.stringify(data, null, 2));
				}
			}

			// Delete the interaction directory and all its contents
			if (await exists(this.interactionDir)) {
				await Deno.remove(this.interactionDir, { recursive: true });
			}

			logger.info(`InteractionPersistence: Successfully deleted interaction: ${this._interactionId}`);
		} catch (error) {
			logger.error(`InteractionPersistence: Error deleting interaction: ${this._interactionId}`, error);
			throw createError(ErrorType.FileHandling, `Failed to delete interaction: ${errorMessage(error)}`, {
				filePath: this.interactionDir,
				operation: 'delete',
			} as FileHandlingErrorOptions);
		}
	}

	async removeLastChange(): Promise<void> {
		await this.ensureInitialized();

		if (!await exists(this.changeLogPath)) {
			return;
		}

		const content = await Deno.readTextFile(this.changeLogPath);
		const lines = content.trim().split('\n');

		if (lines.length > 0) {
			lines.pop(); // Remove the last line
			await Deno.writeTextFile(this.changeLogPath, lines.join('\n') + '\n');
		}
	}

	async storeResourceRevision(resourceUri: string, revisionId: string, content: string | Uint8Array): Promise<void> {
		await this.ensureInitialized();
		const resourceKey = generateResourceRevisionKey(resourceUri, revisionId);
		const revisionResourcePath = join(this.resourceRevisionsDir, resourceKey);
		await this.ensureDirectory(this.resourceRevisionsDir);

		logger.info(`InteractionPersistence: Writing revision resource: ${revisionResourcePath}`);

		if (typeof content === 'string') {
			await Deno.writeTextFile(revisionResourcePath, content);
		} else {
			await Deno.writeFile(revisionResourcePath, content);
		}

		// // Also store at the project level for future access
		// try {
		// 	const resourceMetadata = {
		// 		type: 'file',
		// 		contentType: resourceUri.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/) ? 'image' : 'text',
		// 		name: resourceUri,
		// 		uri: resourceUri,
		// 		mimeType: 'text/plain', // This is just a placeholder - would be better to detect properly
		// 		size: typeof content === 'string' ? content.length : content.byteLength,
		// 		lastModified: new Date()
		// 	};
		// 	await this.projectEditor.projectData.storeProjectResource(resourceUri, content, resourceMetadata);
		// } catch (error) {
		// 	logger.warn(`InteractionPersistence: Could not store resource at project level: ${errorMessage(error)}`);
		// 	// Continue even if project-level storage fails
		// }
	}

	async getResourceRevision(resourceUri: string, revisionId: string): Promise<string | Uint8Array> {
		await this.ensureInitialized();
		const resourceKey = generateResourceRevisionKey(resourceUri, revisionId);
		const revisionResourcePath = join(this.resourceRevisionsDir, resourceKey);

		logger.info(`InteractionPersistence: Reading revision resource: ${revisionResourcePath}`);

		if (await exists(revisionResourcePath)) {
			const resourceInfo = await Deno.stat(revisionResourcePath);
			if (resourceInfo.isFile) {
				if (resourceUri.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
					return await Deno.readFile(revisionResourcePath);
				} else {
					return await Deno.readTextFile(revisionResourcePath);
				}
			}
		}

		throw createError(
			ErrorType.ResourceHandling,
			`Could not read resource contents for resource revision ${revisionResourcePath}`,
			//`Could not read resource contents for resource revision in either ${revisionResourcePath} or ${oldRevisionPath}`,
			{
				filePath: revisionResourcePath,
				operation: 'read',
			} as ResourceHandlingErrorOptions,
		);
	}

	async createBackups(): Promise<void> {
		await this.ensureInitialized();
		const backupDir = join(this.interactionDir, 'backups');
		logger.debug(`InteractionPersistence: Ensure directory for createBackups: ${backupDir}`);
		await this.ensureDirectory(backupDir);

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filesToBackup = [
			'messages.jsonl',
			'conversation.jsonl',
			'conversation.log',
			'interaction.jsonl',
			'interaction.log',
			'metadata.json',
		];

		for (const file of filesToBackup) {
			const sourcePath = join(this.interactionDir, file);
			const backupPath = join(backupDir, `${file}.${timestamp}`);
			try {
				await copy(sourcePath, backupPath, { overwrite: true });
			} catch (error) {
				if (error instanceof Deno.errors.NotFound) continue;
				throw error;
			}
		}
	}
}

export default InteractionPersistence;
