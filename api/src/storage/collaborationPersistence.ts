import { copy, ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import type { CollaborationsFileV4 } from 'api/storage/storageMigration.ts';
import { getProjectAdminDataDir, isProjectMigrated, migrateProjectFiles } from 'shared/projectPath.ts';
import type {
	CollaborationDetailedMetadata,
	CollaborationId,
	CollaborationMetadata,
	InteractionId,
	InteractionType,
	ProjectId,
	TokenUsage,
	TokenUsageAnalysis,
	TokenUsageRecord,
	//TokenUsageStatsForCollaboration,
} from 'shared/types.ts';
import { DEFAULT_TOKEN_USAGE } from 'shared/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type { CollaborationParams, CollaborationValues } from 'shared/types/collaboration.ts';
import { logger } from 'shared/logger.ts';
import TokenUsagePersistence from './tokenUsagePersistence.ts';
//import LLMRequestPersistence from './llmRequestPersistence.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { errorMessage } from 'shared/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import { isTokenUsageValidationError } from 'api/errors/error.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/llms/conversationInteraction.ts';
import { generateInteractionId, shortenInteractionId } from 'shared/generateIds.ts';
import InteractionPersistence from 'api/storage/interactionPersistence.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: ProjectId };

class CollaborationPersistence {
	private collaborationDir!: string;
	private metadataPath!: string;
	private collaborationsMetadataPath!: string;
	private resourcesMetadataPath!: string;
	private resourceRevisionsDir!: string;
	private objectivesPath!: string;
	private resourcesPath!: string;
	private projectInfoPath!: string;
	//private interactionsDir!: string;
	private initialized: boolean = false;
	private tokenUsagePersistence!: TokenUsagePersistence;
	//private llmRequestPersistence!: LLMRequestPersistence;
	private ensuredDirs: Set<string> = new Set();

	constructor(
		private collaborationId: CollaborationId,
		private projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo },
	) {
		//this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
	}

	async init(): Promise<CollaborationPersistence> {
		// Get BB data directory using project ID
		// Check if project has been migrated to new structure
		const projectId = this.projectEditor.projectId;

		const migrated = await isProjectMigrated(projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(projectId);
				logger.info(`CollaborationPersistence: Successfully migrated project ${projectId} files`);
			} catch (migrationError) {
				logger.warn(
					`CollaborationPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
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

		// Use new global project data directory
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		if (!projectAdminDataDir) {
			logger.error(
				`CollaborationPersistence: Failed to get data directory for projectId ${projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
		logger.debug(`CollaborationPersistence: Using data dir for ${projectId}: ${projectAdminDataDir}`);
		const collaborationsDir = join(projectAdminDataDir, 'collaborations');
		this.collaborationsMetadataPath = join(projectAdminDataDir, 'collaborations.json');

		this.collaborationDir = join(collaborationsDir, this.collaborationId);
		//this.interactionsDir = join(this.collaborationDir, 'interactions');

		this.metadataPath = join(this.collaborationDir, 'metadata.json');

		this.resourcesMetadataPath = join(this.collaborationDir, 'resources_metadata.json');
		this.resourceRevisionsDir = join(this.collaborationDir, 'resource_revisions');

		this.projectInfoPath = join(this.collaborationDir, 'project_info.json');

		this.objectivesPath = join(this.collaborationDir, 'objectives.json');
		this.resourcesPath = join(this.collaborationDir, 'resources.json');

		this.tokenUsagePersistence = await new TokenUsagePersistence(this.collaborationDir).init();
		//this.llmRequestPersistence = await new LLMRequestPersistence(this.collaborationDir).init();

		return this;
	}

	static async listCollaborations(options: {
		page: number;
		limit: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
		projectId: ProjectId;
	}): Promise<{ collaborations: CollaborationValues[]; totalCount: number }> {
		// Check if project has been migrated to new structure
		const migrated = await isProjectMigrated(options.projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(options.projectId);
				logger.info(
					`CollaborationPersistence: listCollaborations - Successfully migrated project ${options.projectId} files`,
				);
			} catch (migrationError) {
				logger.warn(
					`CollaborationPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
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
				`CollaborationPersistence: Failed to get data directory for projectId ${options.projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: options.projectId,
				} as ProjectHandlingErrorOptions,
			);
		}

		const collaborationsMetadataPath = join(projectAdminDataDir, 'collaborations.json');

		try {
			await ensureDir(dirname(projectAdminDataDir)); // Ensure parent directory exists
			await ensureDir(projectAdminDataDir);
		} catch (error) {
			logger.error(`CollaborationPersistence: Failed to create required directories: ${errorMessage(error)}`);
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
			if (!await exists(collaborationsMetadataPath)) {
				await Deno.writeTextFile(
					collaborationsMetadataPath,
					JSON.stringify({
						version: '4.0',
						collaborations: [],
					}),
				);
				return { collaborations: [], totalCount: 0 };
			}
		} catch (error) {
			logger.error(`CollaborationPersistence: Failed to create collaborations.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create collaborations.json: ${errorMessage(error)}`,
				{
					filePath: collaborationsMetadataPath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}

		let content: string;
		try {
			content = await Deno.readTextFile(collaborationsMetadataPath);
		} catch (error) {
			logger.error(`CollaborationPersistence: Failed to read collaborations.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to read collaborations.json: ${errorMessage(error)}`,
				{
					filePath: collaborationsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		let collaborationsData: CollaborationsFileV4;
		let collaborations: CollaborationValues[];
		try {
			collaborationsData = JSON.parse(content);

			if (collaborationsData.version && Array.isArray(collaborationsData.collaborations)) {
				// Version 4 format: object with version and collaborations array
				collaborations = collaborationsData.collaborations;
			} else {
				// Unknown format
				throw new Error('Invalid collaborations.json format');
			}
		} catch (error) {
			logger.error(
				`CollaborationPersistence: Failed to parse collaborations.json content: ${errorMessage(error)}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Invalid JSON in collaborations.json: ${errorMessage(error)}`,
				{
					filePath: collaborationsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		// Apply filters
		if (options.startDate) {
			collaborations = collaborations.filter((collab) => new Date(collab.createdAt) >= options.startDate!);
		}
		if (options.endDate) {
			collaborations = collaborations.filter((collab) => new Date(collab.createdAt) <= options.endDate!);
		}
		if (options.llmProviderName) {
			collaborations = collaborations.filter((collab) =>
				collab.lastInteractionMetadata?.llmProviderName === options.llmProviderName
			);
		}

		// Get total count before pagination
		const totalCount = collaborations.length;

		// Sort collaborations by updatedAt in descending order
		collaborations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

		// Apply pagination
		const startIndex = (options.page - 1) * options.limit;
		collaborations = collaborations.slice(startIndex, startIndex + options.limit);

		const defaultCollaborationParams = await CollaborationPersistence.defaultCollaborationParams(options.projectId);
		const defaultTokenUsage = CollaborationPersistence.defaultTokenUsage();
		return {
			collaborations: collaborations.map((collab) => ({
				...collab,
				collaborationParams: collab.collaborationParams || defaultCollaborationParams,
				tokenUsageCollaboration: collab.tokenUsageCollaboration || defaultTokenUsage,
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

	async saveCollaboration(
		collaborationValues: Partial<CollaborationValues>,
	): Promise<void> {
		try {
			await this.ensureInitialized();
			logger.debug(`CollaborationPersistence: Ensure directory for saveCollaboration: ${this.collaborationDir}`);
			await this.ensureDirectory(this.collaborationDir);

			const metadata: CollaborationMetadata = {
				id: this.collaborationId,
				version: 4,
				title: collaborationValues.title || 'New Collaboration',
				type: collaborationValues.type || 'project',
				collaborationParams: collaborationValues.collaborationParams ||
					await CollaborationPersistence.defaultCollaborationParams(this.projectEditor.projectId),
				createdAt: collaborationValues.createdAt || new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				projectId: this.projectEditor.projectId,
				tokenUsageCollaboration: collaborationValues.tokenUsageCollaboration ||
					CollaborationPersistence.defaultTokenUsage(),
				totalInteractions: collaborationValues.totalInteractions || 0,
				interactionIds: collaborationValues.interactionIds || [],
				lastInteractionId: collaborationValues.lastInteractionId,
				lastInteractionMetadata: collaborationValues.lastInteractionMetadata,
			};

			await this.updateCollaborationsMetadata(metadata);

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Create detailed metadata with analyzed token usage
			const detailedMetadata: CollaborationDetailedMetadata = {
				...metadata,
				// Store analyzed token usage in metadata
				tokenUsageCollaboration: {
					inputTokens: tokenAnalysis.combined.totalUsage.input,
					outputTokens: tokenAnalysis.combined.totalUsage.output,
					totalTokens: tokenAnalysis.combined.totalUsage.total,
					cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
					cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
					thoughtTokens: tokenAnalysis.combined.totalUsage.thoughtTokens,
					totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
				},
			};

			await this.saveMetadata(detailedMetadata);

			// Save project info to JSON
			await this.saveProjectInfo(this.projectEditor.projectInfo);
		} catch (error) {
			logger.error(`CollaborationPersistence: Error saving collaboration: ${errorMessage(error)}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadCollaboration(): Promise<CollaborationDetailedMetadata | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				return null;
			}

			const metadata: CollaborationDetailedMetadata = await this.getMetadata();

			metadata.id = this.collaborationId;

			// // Get token usage analysis
			// const tokenAnalysis = await this.getTokenUsageAnalysis();
			//
			// // Update metadata with analyzed values
			// metadata.tokenUsageCollaboration = {
			// 	inputTokens: tokenAnalysis.combined.totalUsage.input,
			// 	outputTokens: tokenAnalysis.combined.totalUsage.output,
			// 	totalTokens: tokenAnalysis.combined.totalUsage.total,
			// 	cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
			// 	cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
			// 	thoughtTokens: tokenAnalysis.combined.totalUsage.thoughtTokens,
			// 	totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
			// };

			return metadata;
		} catch (error) {
			logger.error(`CollaborationPersistence: Error loading collaboration: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading collaboration: ${this.metadataPath}`,
				{
					filePath: this.metadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	async createInteractionPersistence(
		parentInteractionId?: InteractionId,
		_interactionCallbacks?: LLMCallbacks, // only used for loadInteraction which creates a LLMConversationInteraction
	): Promise<InteractionPersistence> {
		await this.ensureInitialized();

		// Generate new interaction ID
		const interactionId = shortenInteractionId(generateInteractionId());

		// Create interaction persistence instance
		const interactionPersistence = new InteractionPersistence(
			this.collaborationId,
			interactionId,
			this.projectEditor,
			parentInteractionId,
		);

		await interactionPersistence.init();

		// Update collaboration metadata to include this interaction
		const metadata = await this.getMetadata();
		if (!metadata.interactionIds.includes(interactionId)) {
			metadata.interactionIds.push(interactionId);
			metadata.totalInteractions = metadata.interactionIds.length;
			metadata.lastInteractionId = interactionId;
			metadata.updatedAt = new Date().toISOString();

			await this.saveMetadata(metadata);
			await this.updateCollaborationsMetadata(metadata);
		}

		return interactionPersistence;
	}

	async getInteraction(interactionId: InteractionId): Promise<InteractionPersistence> {
		await this.ensureInitialized();

		const interactionPersistence = new InteractionPersistence(
			this.collaborationId,
			interactionId,
			this.projectEditor,
		);

		await interactionPersistence.init();
		return interactionPersistence;
	}

	async listInteractions(): Promise<InteractionId[]> {
		await this.ensureInitialized();

		const metadata = await this.getMetadata();
		return metadata.interactionIds || [];
	}

	private async updateCollaborationsMetadata(
		collaboration: CollaborationMetadata,
	): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`CollaborationPersistence: Ensure directory for updateCollaborationsMetadata: ${this.collaborationsMetadataPath}`,
		);
		await this.ensureDirectory(dirname(this.collaborationsMetadataPath));
		let collaborationsData: CollaborationsFileV4 = {
			version: '4.0',
			collaborations: [],
		};

		if (await exists(this.collaborationsMetadataPath)) {
			const content = await Deno.readTextFile(this.collaborationsMetadataPath);
			const parsedData = JSON.parse(content);

			if (parsedData.version && Array.isArray(parsedData.collaborations)) {
				// Version 4 format: object with version and collaborations array
				collaborationsData = parsedData;
			} else {
				// Unknown format, create new one
				collaborationsData = {
					version: '4.0',
					collaborations: [],
				};
			}
		}

		const index = collaborationsData.collaborations.findIndex((collab) => collab.id === collaboration.id);
		if (index !== -1) {
			collaborationsData.collaborations[index] = {
				...collaborationsData.collaborations[index],
				...collaboration,
				collaborationParams: collaboration.collaborationParams ||
					await CollaborationPersistence.defaultCollaborationParams(collaboration.projectId),
				tokenUsageCollaboration: collaboration.tokenUsageCollaboration ||
					CollaborationPersistence.defaultTokenUsage(),
			};
		} else {
			collaborationsData.collaborations.push({
				...collaboration,
				collaborationParams: collaboration.collaborationParams ||
					await CollaborationPersistence.defaultCollaborationParams(collaboration.projectId),
				tokenUsageCollaboration: collaboration.tokenUsageCollaboration ||
					CollaborationPersistence.defaultTokenUsage(),
			});
		}

		await Deno.writeTextFile(
			this.collaborationsMetadataPath,
			JSON.stringify(collaborationsData, null, 2),
		);

		logger.debug(
			`CollaborationPersistence: Saved metadata to project level for collaboration: ${collaboration.id}`,
		);
	}

	async getCollaborationIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.collaborationsMetadataPath)) {
			const content = await Deno.readTextFile(this.collaborationsMetadataPath);
			const data = JSON.parse(content);

			if (data.version && Array.isArray(data.collaborations)) {
				const collaboration = data.collaborations.find((collab: CollaborationMetadata) =>
					collab.title === title
				);
				return collaboration ? collaboration.id : null;
			}
		}
		return null;
	}

	async getCollaborationTitleById(id: string): Promise<string | null> {
		if (await exists(this.collaborationsMetadataPath)) {
			const content = await Deno.readTextFile(this.collaborationsMetadataPath);
			const data = JSON.parse(content);

			if (data.version && Array.isArray(data.collaborations)) {
				const collaboration = data.collaborations.find((collab: CollaborationMetadata) => collab.id === id);
				return collaboration ? collaboration.title : null;
			}
		}
		return null;
	}

	async getAllCollaborations(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.collaborationsMetadataPath)) {
			const content = await Deno.readTextFile(this.collaborationsMetadataPath);
			const data = JSON.parse(content);

			if (data.version && Array.isArray(data.collaborations)) {
				return data.collaborations.map(({ id, title }: CollaborationMetadata) => ({ id, title }));
			}
		}
		return [];
	}

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

	async writeTokenUsage(record: TokenUsageRecord, type: InteractionType): Promise<void> {
		await this.ensureInitialized();
		try {
			this.tokenUsagePersistence.writeUsage(record, type);
		} catch (error) {
			if (isTokenUsageValidationError(error)) {
				logger.error(
					`CollaborationPersistence: TokenUsage validation failed: ${error.options.field} - ${error.options.constraint}`,
				);
			} else {
				logger.error(
					`CollaborationPersistence: TokenUsage validation failed - Unknown error type: ${
						(error instanceof Error) ? error.message : error
					}`,
				);
				throw error;
			}
		}
	}

	async saveMetadata(metadata: Partial<CollaborationDetailedMetadata>): Promise<void> {
		// Set version 4 for new collaboration format
		metadata.version = 4;
		await this.ensureInitialized();
		logger.debug(`CollaborationPersistence: Ensure directory for saveMetadata: ${this.metadataPath}`);
		await this.ensureDirectory(dirname(this.metadataPath));
		const existingMetadata = await this.getMetadata();
		const updatedMetadata = { ...existingMetadata, ...metadata };
		await Deno.writeTextFile(this.metadataPath, JSON.stringify(updatedMetadata, null, 2));
		logger.debug(`CollaborationPersistence: Saved metadata for collaboration: ${this.collaborationId}`);

		// Update the stats in project-level collaborations metadata file
		await this.updateCollaborationsMetadata(updatedMetadata);
	}

	async getMetadata(): Promise<CollaborationDetailedMetadata> {
		await this.ensureInitialized();
		if (await exists(this.metadataPath)) {
			const metadataContent = await Deno.readTextFile(this.metadataPath);
			const metadata = JSON.parse(metadataContent);

			// Ensure version 4 format
			if (!metadata.version || metadata.version < 4) {
				metadata.version = 4;
			}

			return metadata;
		}
		return CollaborationPersistence.defaultMetadata();
	}

	static defaultTokenUsage(): TokenUsage {
		return DEFAULT_TOKEN_USAGE();
	}

	static async defaultCollaborationParams(projectId?: ProjectId): Promise<CollaborationParams> {
		if (!projectId) {
			return {
				rolesModelConfig: {
					orchestrator: null,
					agent: null,
					chat: null,
				},
			};
		}
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = await configManager.getProjectConfig(projectId);

		const defaultModels = projectConfig.defaultModels || globalConfig.defaultModels;

		const registryService = await ModelRegistryService.getInstance(projectConfig);

		const orchestratorConfig = registryService.getModelConfig(
			defaultModels.orchestrator || DefaultModelsConfigDefaults.orchestrator,
		);
		const agentConfig = registryService.getModelConfig(defaultModels.agent || DefaultModelsConfigDefaults.agent);
		const chatConfig = registryService.getModelConfig(defaultModels.chat || DefaultModelsConfigDefaults.chat);

		return {
			rolesModelConfig: {
				orchestrator: orchestratorConfig,
				agent: agentConfig,
				chat: chatConfig,
			},
		};
	}

	static defaultMetadata(): CollaborationDetailedMetadata {
		return {
			version: 4,
			id: '',
			title: '',
			projectId: '',
			type: 'project',
			collaborationParams: {
				rolesModelConfig: {
					orchestrator: null,
					agent: null,
					chat: null,
				},
			},
			tokenUsageCollaboration: CollaborationPersistence.defaultTokenUsage(),
			totalInteractions: 0,
			interactionIds: [],
			createdAt: '',
			updatedAt: '',
		};
	}

	async saveProjectInfo(projectInfo: ExtendedProjectInfo): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`CollaborationPersistence: Ensure directory for saveProjectInfo: ${this.projectInfoPath}`);
		await this.ensureDirectory(dirname(this.projectInfoPath));
		try {
			await Deno.writeTextFile(this.projectInfoPath, JSON.stringify(projectInfo, null, 2));
			logger.debug(
				`CollaborationPersistence: Saved project info JSON for collaboration: ${this.collaborationId}`,
			);
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

	private handleSaveError(error: unknown, filePath: string): never {
		if (error instanceof Deno.errors.PermissionDenied) {
			throw createError(
				ErrorType.FileHandling,
				`Permission denied when saving collaboration: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else if (error instanceof Deno.errors.NotFound) {
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when saving collaboration: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else {
			logger.error(`CollaborationPersistence: Error saving collaboration: ${errorMessage(error)}`);
			throw createError(ErrorType.FileHandling, `Failed to save collaboration: ${filePath}`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	async deleteCollaboration(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Remove from collaborations metadata first
			if (await exists(this.collaborationsMetadataPath)) {
				const content = await Deno.readTextFile(this.collaborationsMetadataPath);
				const data = JSON.parse(content);

				if (data.version && Array.isArray(data.collaborations)) {
					data.collaborations = data.collaborations.filter((collab: CollaborationMetadata) =>
						collab.id !== this.collaborationId
					);
					await Deno.writeTextFile(this.collaborationsMetadataPath, JSON.stringify(data, null, 2));
				}
			}

			// Delete the collaboration directory and all its contents
			if (await exists(this.collaborationDir)) {
				await Deno.remove(this.collaborationDir, { recursive: true });
			}

			logger.info(`CollaborationPersistence: Successfully deleted collaboration: ${this.collaborationId}`);
		} catch (error) {
			logger.error(`CollaborationPersistence: Error deleting collaboration: ${this.collaborationId}`, error);
			throw createError(ErrorType.FileHandling, `Failed to delete collaboration: ${errorMessage(error)}`, {
				filePath: this.collaborationDir,
				operation: 'delete',
			} as FileHandlingErrorOptions);
		}
	}

	async createBackups(): Promise<void> {
		await this.ensureInitialized();
		const backupDir = join(this.collaborationDir, 'backups');
		logger.debug(`CollaborationPersistence: Ensure directory for createBackups: ${backupDir}`);
		await this.ensureDirectory(backupDir);

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filesToBackup = ['metadata.json', 'objectives.json', 'resources.json'];

		for (const file of filesToBackup) {
			const sourcePath = join(this.collaborationDir, file);
			if (await exists(sourcePath)) {
				const backupPath = join(backupDir, `${file}.${timestamp}`);
				await copy(sourcePath, backupPath, { overwrite: true });
			}
		}
	}
}

export default CollaborationPersistence;
