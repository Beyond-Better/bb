import { copy, ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import {
	migrateConversationsFileIfNeeded,
} from './conversationMigration.ts';
import type { ConversationsFileV1, InteractionsFileV2 } from 'shared/conversationMigration.ts';
import {
	getProjectAdminDataDir,
	isProjectMigrated,
	migrateProjectFiles,
} from 'shared/projectPath.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type {
	InteractionDetailedMetadata,
	InteractionId,
	InteractionMetadata,
	InteractionMetrics,
	InteractionStats,
	LLMRequestRecord,
	ObjectivesData,
	ResourceMetrics,
	TokenUsage,
	TokenUsageAnalysis,
	TokenUsageRecord,
	TokenUsageStats,
} from 'shared/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type { LLMModelConfig, LLMRolesModelConfig } from 'api/types/llms.ts';
import type { CollaborationParams, Collaboration } from 'shared/types/collaboration.ts';
import type { InteractionResourcesMetadata } from 'shared/types/dataSourceResource.ts';
import { logger } from 'shared/logger.ts';
import { TokenUsagePersistence } from './tokenUsagePersistence.ts';
import { LLMRequestPersistence } from './llmRequestPersistence.ts';
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
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import { generateResourceRevisionKey } from 'shared/dataSource.ts';
import { getConfigManager } from 'shared/config/configManager.ts';
import { stripIndents } from 'common-tags';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: string };

// Collaboration storage interfaces
export interface CollaborationMetadata {
	id: string;
	version: number;
	title: string;
	type: 'project' | 'workflow' | 'research';
	collaborationParams: CollaborationParams;
	createdAt: string;
	updatedAt: string;
	projectId: string;
	// Aggregated stats from all child interactions
	totalInteractions: number;
	totalTokenUsage: TokenUsage;
	lastInteractionId?: string;
}

export interface CollaborationsFileV4 {
	version: '4.0';
	collaborations: CollaborationMetadata[];
}

export interface CollaborationDetailedMetadata extends CollaborationMetadata {
	// Additional detailed metadata for individual collaboration files
	interactions: string[]; // Array of interaction IDs
	parentCollaborationId?: string; // For nested collaborations
}

class CollaborationPersistence {
	private collaborationDir!: string;
	private collaborationsMetadataPath!: string;
	private metadataPath!: string;
	private interactionsDir!: string;
	private resourcesMetadataPath!: string;
	private resourceRevisionsDir!: string;
	private objectivesPath!: string;
	private resourcesPath!: string;
	private projectInfoPath!: string;
	private initialized: boolean = false;
	private tokenUsagePersistence!: TokenUsagePersistence;
	private llmRequestPersistence!: LLMRequestPersistence;
	private ensuredDirs: Set<string> = new Set();

	constructor(
		private collaborationId: string,
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
		const projectId = this.projectEditor.projectId;

		const migrated = await isProjectMigrated(projectId);
		if (!migrated) {
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

		// Migrate conversations to collaborations structure
		await this.migrateConversationsToCollaborations(projectId);

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
		
		// New collaboration-based structure
		const collaborationsDir = join(projectAdminDataDir, 'collaborations');
		this.collaborationsMetadataPath = join(projectAdminDataDir, 'collaborations.json');
		
		this.collaborationDir = join(collaborationsDir, this.collaborationId);
		this.metadataPath = join(this.collaborationDir, 'metadata.json');
		this.interactionsDir = join(this.collaborationDir, 'interactions');
		
		this.resourcesMetadataPath = join(this.collaborationDir, 'resources_metadata.json');
		this.resourceRevisionsDir = join(this.collaborationDir, 'resource_revisions');
		this.projectInfoPath = join(this.collaborationDir, 'project_info.json');
		this.objectivesPath = join(this.collaborationDir, 'objectives.json');
		this.resourcesPath = join(this.collaborationDir, 'resources.json');

		// Ensure directories exist
		await ensureDir(this.resourceRevisionsDir);
		await ensureDir(this.interactionsDir);

		this.tokenUsagePersistence = await new TokenUsagePersistence(this.collaborationDir).init();
		this.llmRequestPersistence = await new LLMRequestPersistence(this.collaborationDir).init();

		return this;
	}

	/**
	 * Migrates the old conversations structure to the new collaborations structure
	 */
	private async migrateConversationsToCollaborations(projectId: string): Promise<void> {
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		if (!projectAdminDataDir) return;

		const oldConversationsDir = join(projectAdminDataDir, 'conversations');
		const oldConversationsMetadataPath = join(projectAdminDataDir, 'conversations.json');
		const newCollaborationsDir = join(projectAdminDataDir, 'collaborations');
		const newCollaborationsMetadataPath = join(projectAdminDataDir, 'collaborations.json');

		// Check if migration is needed
		if (!await exists(oldConversationsDir) || await exists(newCollaborationsMetadataPath)) {
			return; // Already migrated or no old data
		}

		logger.info(`CollaborationPersistence: Migrating conversations to collaborations structure for project ${projectId}`);

		try {
			// Ensure new collaborations directory exists
			await ensureDir(newCollaborationsDir);

			// Read old conversations metadata
			let oldInteractions: InteractionMetadata[] = [];
			if (await exists(oldConversationsMetadataPath)) {
				const content = await Deno.readTextFile(oldConversationsMetadataPath);
				const data = JSON.parse(content);
				
				if (Array.isArray(data)) {
					oldInteractions = data;
				} else if (data.version && Array.isArray(data.interactions)) {
					oldInteractions = data.interactions;
				}
			}

			// Create collaborations from conversations
			const collaborations: CollaborationMetadata[] = [];
			
			for (const interaction of oldInteractions) {
				// Each conversation becomes a collaboration
				const collaborationId = interaction.id;
				const collaborationDir = join(newCollaborationsDir, collaborationId);
				const oldInteractionDir = join(oldConversationsDir, interaction.id);

				// Create collaboration directory
				await ensureDir(collaborationDir);
				await ensureDir(join(collaborationDir, 'interactions'));

				// Move interaction data to collaboration/interactions/[interactionId]
				const interactionDir = join(collaborationDir, 'interactions', interaction.id);
				if (await exists(oldInteractionDir)) {
					await copy(oldInteractionDir, interactionDir, { overwrite: true });
				}

				// Create collaboration metadata
				const collaborationMetadata: CollaborationMetadata = {
					id: collaborationId,
					version: 4,
					title: interaction.title,
					type: 'project',
					collaborationParams: interaction.collaborationParams || CollaborationPersistence.defaultCollaborationParams(),
					createdAt: interaction.createdAt,
					updatedAt: interaction.updatedAt,
					projectId: projectId,
					totalInteractions: 1,
					totalTokenUsage: interaction.tokenUsageStats?.tokenUsageInteraction || CollaborationPersistence.defaultTokenUsage(),
					lastInteractionId: interaction.id,
				};

				// Create detailed collaboration metadata
				const detailedMetadata: CollaborationDetailedMetadata = {
					...collaborationMetadata,
					interactions: [interaction.id],
				};

				// Save collaboration metadata
				const collaborationMetadataPath = join(collaborationDir, 'metadata.json');
				await Deno.writeTextFile(collaborationMetadataPath, JSON.stringify(detailedMetadata, null, 2));

				collaborations.push(collaborationMetadata);
			}

			// Create new collaborations.json with version 4 format
			const collaborationsFile: CollaborationsFileV4 = {
				version: '4.0',
				collaborations: collaborations,
			};

			await Deno.writeTextFile(newCollaborationsMetadataPath, JSON.stringify(collaborationsFile, null, 2));

			// Update project.json with version number for future migrations
			await this.updateProjectVersion(projectId);

			logger.info(`CollaborationPersistence: Successfully migrated ${collaborations.length} conversations to collaborations`);

		} catch (error) {
			logger.error(`CollaborationPersistence: Failed to migrate conversations to collaborations: ${errorMessage(error)}`);
			throw error;
		}
	}

	/**
	 * Updates project.json with version number for future migrations
	 */
	private async updateProjectVersion(projectId: string): Promise<void> {
		try {
			const projectAdminDataDir = await getProjectAdminDataDir(projectId);
			if (!projectAdminDataDir) return;

			const projectJsonPath = join(projectAdminDataDir, 'project.json');
			let projectData: any = {};

			if (await exists(projectJsonPath)) {
				const content = await Deno.readTextFile(projectJsonPath);
				projectData = JSON.parse(content);
			}

			// Set version 4 for collaboration structure
			projectData.version = 4;
			projectData.lastMigration = new Date().toISOString();

			await Deno.writeTextFile(projectJsonPath, JSON.stringify(projectData, null, 2));
			logger.debug(`CollaborationPersistence: Updated project.json version to 4 for project ${projectId}`);
		} catch (error) {
			logger.warn(`CollaborationPersistence: Failed to update project.json version: ${errorMessage(error)}`);
			// Don't throw - this is not critical for functionality
		}
	}

	/**
	 * Lists all collaborations for a project
	 */
	static async listCollaborations(options: {
		page: number;
		limit: number;
		startDate?: Date;
		endDate?: Date;
		collaborationType?: 'project' | 'workflow' | 'research';
		projectId: string;
	}): Promise<{ collaborations: CollaborationMetadata[]; totalCount: number }> {
		const migrated = await isProjectMigrated(options.projectId);
		if (!migrated) {
			try {
				await migrateProjectFiles(options.projectId);
				logger.info(`CollaborationPersistence: Successfully migrated project ${options.projectId} files`);
			} catch (migrationError) {
				logger.warn(`CollaborationPersistence: Migration attempted but failed: ${(migrationError as Error).message}`);
				throw createError(
					ErrorType.ProjectHandling,
					`Could not migrate project .bb directory for ${options.projectId}: ${(migrationError as Error).message}`,
					{ projectId: options.projectId } as ProjectHandlingErrorOptions,
				);
			}
		}

		const projectAdminDataDir = await getProjectAdminDataDir(options.projectId);
		if (!projectAdminDataDir) {
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{ projectId: options.projectId } as ProjectHandlingErrorOptions,
			);
		}

		const collaborationsMetadataPath = join(projectAdminDataDir, 'collaborations.json');

		try {
			await ensureDir(dirname(projectAdminDataDir));
			await ensureDir(projectAdminDataDir);
		} catch (error) {
			throw createError(
				ErrorType.FileHandling,
				`Failed to create required directories: ${errorMessage(error)}`,
				{ filePath: projectAdminDataDir, operation: 'write' } as FileHandlingErrorOptions,
			);
		}

		try {
			if (!await exists(collaborationsMetadataPath)) {
				// Create new collaborations.json file
				const collaborationsFile: CollaborationsFileV4 = {
					version: '4.0',
					collaborations: [],
				};
				await Deno.writeTextFile(collaborationsMetadataPath, JSON.stringify(collaborationsFile, null, 2));
				return { collaborations: [], totalCount: 0 };
			}
		} catch (error) {
			throw createError(
				ErrorType.FileHandling,
				`Failed to create collaborations.json: ${errorMessage(error)}`,
				{ filePath: collaborationsMetadataPath, operation: 'write' } as FileHandlingErrorOptions,
			);
		}

		let content: string;
		try {
			content = await Deno.readTextFile(collaborationsMetadataPath);
		} catch (error) {
			throw createError(
				ErrorType.FileHandling,
				`Failed to read collaborations.json: ${errorMessage(error)}`,
				{ filePath: collaborationsMetadataPath, operation: 'read' } as FileHandlingErrorOptions,
			);
		}

		let collaborationsData: CollaborationsFileV4;
		let collaborations: CollaborationMetadata[];
		try {
			collaborationsData = JSON.parse(content);

			if (collaborationsData.version && Array.isArray(collaborationsData.collaborations)) {
				collaborations = collaborationsData.collaborations;
			} else {
				throw new Error('Invalid collaborations.json format');
			}
		} catch (error) {
			throw createError(
				ErrorType.FileHandling,
				`Invalid JSON in collaborations.json: ${errorMessage(error)}`,
				{ filePath: collaborationsMetadataPath, operation: 'read' } as FileHandlingErrorOptions,
			);
		}

		// Apply filters
		if (options.startDate) {
			collaborations = collaborations.filter((collab) => new Date(collab.createdAt) >= options.startDate!);
		}
		if (options.endDate) {
			collaborations = collaborations.filter((collab) => new Date(collab.createdAt) <= options.endDate!);
		}
		if (options.collaborationType) {
			collaborations = collaborations.filter((collab) => collab.type === options.collaborationType);
		}

		// Get total count before pagination
		const totalCount = collaborations.length;

		// Sort by updatedAt in descending order
		collaborations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

		// Apply pagination
		const startIndex = (options.page - 1) * options.limit;
		collaborations = collaborations.slice(startIndex, startIndex + options.limit);

		return { collaborations, totalCount };
	}

	/**
	 * Creates a new interaction within this collaboration
	 */
	async createInteraction(interactionId: string): Promise<void> {
		await this.ensureInitialized();
		const interactionDir = join(this.interactionsDir, interactionId);
		await ensureDir(interactionDir);

		// Update collaboration metadata to include this interaction
		const metadata = await this.getMetadata();
		if (!metadata.interactions.includes(interactionId)) {
			metadata.interactions.push(interactionId);
			metadata.totalInteractions = metadata.interactions.length;
			metadata.lastInteractionId = interactionId;
			metadata.updatedAt = new Date().toISOString();
			await this.saveMetadata(metadata);
		}
	}

	/**
	 * Gets the path for a specific interaction within this collaboration
	 */
	getInteractionPath(interactionId: string): string {
		return join(this.interactionsDir, interactionId);
	}

	/**
	 * Lists all interactions within this collaboration
	 */
	async listInteractions(): Promise<string[]> {
		await this.ensureInitialized();
		const metadata = await this.getMetadata();
		return metadata.interactions || [];
	}

	/**
	 * Ensures a directory exists, tracking which directories have been created to avoid redundant calls
	 */
	private async ensureDirectory(dir: string): Promise<void> {
		if (!this.ensuredDirs.has(dir)) {
			await ensureDir(dirname(dir));
			await ensureDir(dir);
			this.ensuredDirs.add(dir);
		}
	}

	async saveCollaboration(collaboration: Collaboration): Promise<void> {
		try {
			await this.ensureInitialized();
			await this.ensureDirectory(this.collaborationDir);

			const metadata: CollaborationMetadata = {
				id: collaboration.id,
				version: 4,
				title: collaboration.title || 'Untitled Collaboration',
				type: collaboration.type,
				collaborationParams: collaboration.collaborationParams,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				projectId: this.projectEditor.projectId,
				totalInteractions: 0,
				totalTokenUsage: CollaborationPersistence.defaultTokenUsage(),
			};

			await this.updateCollaborationsMetadata(metadata);

			const detailedMetadata: CollaborationDetailedMetadata = {
				...metadata,
				interactions: [],
			};

			await this.saveMetadata(detailedMetadata);
			await this.saveProjectInfo(this.projectEditor.projectInfo);

		} catch (error) {
			logger.error(`CollaborationPersistence: Error saving collaboration: ${errorMessage(error)}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadCollaboration(): Promise<Collaboration | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				return null;
			}

			const metadata: CollaborationDetailedMetadata = await this.getMetadata();
			
			const collaboration: Collaboration = {
				id: metadata.id,
				type: metadata.type,
				title: metadata.title,
				collaborationParams: metadata.collaborationParams,
			};

			return collaboration;
		} catch (error) {
			logger.error(`CollaborationPersistence: Error loading collaboration: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading collaboration: ${this.metadataPath}`,
				{ filePath: this.metadataPath, operation: 'read' } as FileHandlingErrorOptions,
			);
		}
	}

	private async updateCollaborationsMetadata(collaboration: CollaborationMetadata): Promise<void> {
		await this.ensureInitialized();
		await this.ensureDirectory(dirname(this.collaborationsMetadataPath));
		
		let collaborationsData: CollaborationsFileV4 = {
			version: '4.0',
			collaborations: [],
		};

		if (await exists(this.collaborationsMetadataPath)) {
			const content = await Deno.readTextFile(this.collaborationsMetadataPath);
			const parsedData = JSON.parse(content);

			if (parsedData.version && Array.isArray(parsedData.collaborations)) {
				collaborationsData = parsedData;
			}
		}

		const index = collaborationsData.collaborations.findIndex((collab) => collab.id === collaboration.id);
		if (index !== -1) {
			collaborationsData.collaborations[index] = {
				...collaborationsData.collaborations[index],
				...collaboration,
			};
		} else {
			collaborationsData.collaborations.push(collaboration);
		}

		await Deno.writeTextFile(this.collaborationsMetadataPath, JSON.stringify(collaborationsData, null, 2));
		logger.debug(`CollaborationPersistence: Saved metadata to project level for collaboration: ${collaboration.id}`);
	}

	async saveMetadata(metadata: Partial<CollaborationDetailedMetadata>): Promise<void> {
		metadata.version = 4;
		await this.ensureInitialized();
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
				if (!metadata.interactions) {
					metadata.interactions = [];
				}
			}

			return metadata;
		}
		return CollaborationPersistence.defaultDetailedMetadata();
	}

	async saveProjectInfo(projectInfo: ExtendedProjectInfo): Promise<void> {
		await this.ensureInitialized();
		await this.ensureDirectory(dirname(this.projectInfoPath));
		try {
			await Deno.writeTextFile(this.projectInfoPath, JSON.stringify(projectInfo, null, 2));
			logger.debug(`CollaborationPersistence: Saved project info JSON for collaboration: ${this.collaborationId}`);
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

	async deleteCollaboration(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Remove from collaborations metadata first
			if (await exists(this.collaborationsMetadataPath)) {
				const content = await Deno.readTextFile(this.collaborationsMetadataPath);
				const data: CollaborationsFileV4 = JSON.parse(content);

				data.collaborations = data.collaborations.filter((collab) => collab.id !== this.collaborationId);
				await Deno.writeTextFile(this.collaborationsMetadataPath, JSON.stringify(data, null, 2));
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

	// Token usage methods
	async writeTokenUsage(record: TokenUsageRecord, type: 'conversation' | 'chat' | 'base'): Promise<void> {
		await this.ensureInitialized();
		try {
			await this.tokenUsagePersistence.writeUsage(record, type);
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

	async getTokenUsage(type: 'conversation' | 'chat'): Promise<TokenUsageRecord[]> {
		await this.ensureInitialized();
		return this.tokenUsagePersistence.getUsage(type);
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

	// LLM Request methods
	async writeLLMRequest(record: LLMRequestRecord): Promise<void> {
		await this.ensureInitialized();
		await this.llmRequestPersistence.writeLLMRequest(record);
	}

	async getLLMRequest(): Promise<LLMRequestRecord[]> {
		await this.ensureInitialized();
		return this.llmRequestPersistence.getLLMRequest();
	}

	// Resource methods
	async saveResourcesMetadata(resourcesMetadata: InteractionResourcesMetadata): Promise<void> {
		await this.ensureInitialized();
		await this.ensureDirectory(dirname(this.resourcesMetadataPath));
		const existingResourcesMetadata = await this.getResourcesMetadata();
		const updatedResourcesMetadata = { ...existingResourcesMetadata, ...resourcesMetadata };
		await Deno.writeTextFile(this.resourcesMetadataPath, JSON.stringify(updatedResourcesMetadata, null, 2));
		logger.debug(`CollaborationPersistence: Saved resourcesMetadata for collaboration: ${this.collaborationId}`);
	}

	async getResourcesMetadata(): Promise<InteractionResourcesMetadata> {
		await this.ensureInitialized();
		if (await exists(this.resourcesMetadataPath)) {
			const resourcesMetadataContent = await Deno.readTextFile(this.resourcesMetadataPath);
			return JSON.parse(resourcesMetadataContent);
		}
		return {};
	}

	async storeResourceRevision(resourceUri: string, revisionId: string, content: string | Uint8Array): Promise<void> {
		await this.ensureInitialized();
		const resourceKey = generateResourceRevisionKey(resourceUri, revisionId);
		const revisionResourcePath = join(this.resourceRevisionsDir, resourceKey);
		await this.ensureDirectory(this.resourceRevisionsDir);

		logger.info(`CollaborationPersistence: Writing revision resource: ${revisionResourcePath}`);

		if (typeof content === 'string') {
			await Deno.writeTextFile(revisionResourcePath, content);
		} else {
			await Deno.writeFile(revisionResourcePath, content);
		}
	}

	async getResourceRevision(resourceUri: string, revisionId: string): Promise<string | Uint8Array> {
		await this.ensureInitialized();
		const resourceKey = generateResourceRevisionKey(resourceUri, revisionId);
		const revisionResourcePath = join(this.resourceRevisionsDir, resourceKey);

		logger.info(`CollaborationPersistence: Reading revision resource: ${revisionResourcePath}`);

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
			{ filePath: revisionResourcePath, operation: 'read' } as ResourceHandlingErrorOptions,
		);
	}

	// Objectives and resources methods
	async saveObjectives(objectives: ObjectivesData): Promise<void> {
		if (!objectives.statement || !Array.isArray(objectives.statement)) {
			throw createError(ErrorType.FileHandling, 'Invalid objectives format', {
				filePath: this.objectivesPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		await this.ensureInitialized();
		await this.ensureDirectory(dirname(this.objectivesPath));
		await Deno.writeTextFile(this.objectivesPath, JSON.stringify(objectives, null, 2));
		logger.debug(`CollaborationPersistence: Saved objectives for collaboration: ${this.collaborationId}`);
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
		await this.ensureDirectory(dirname(this.resourcesPath));
		const storageFormat = {
			accessed: Array.from(resourceMetrics.accessed),
			modified: Array.from(resourceMetrics.modified),
			active: Array.from(resourceMetrics.active),
			timestamp: new Date().toISOString(),
		};
		await Deno.writeTextFile(this.resourcesPath, JSON.stringify(storageFormat, null, 2));
		logger.debug(`CollaborationPersistence: Saved resourceMetrics for collaboration: ${this.collaborationId}`);
	}

	async getResources(): Promise<ResourceMetrics | null> {
		await this.ensureInitialized();
		if (await exists(this.resourcesPath)) {
			const content = await Deno.readTextFile(this.resourcesPath);
			const stored = JSON.parse(content);
			return {
				accessed: new Set(stored.accessed),
				modified: new Set(stored.modified),
				active: new Set(stored.active),
			};
		}
		return null;
	}

	// Utility methods
	async getCollaborationParams(interaction?: LLMConversationInteraction): Promise<CollaborationParams> {
		const configManager = await getConfigManager();
		const globalConfig = await configManager.getGlobalConfig();
		const projectConfig = this.projectEditor.projectConfig;

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

	private handleSaveError(error: unknown, filePath: string): never {
		if (error instanceof Deno.errors.PermissionDenied) {
			throw createError(
				ErrorType.FileHandling,
				`Permission denied when saving collaboration: ${filePath}`,
				{ filePath, operation: 'write' } as FileHandlingErrorOptions,
			);
		} else if (error instanceof Deno.errors.NotFound) {
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when saving collaboration: ${filePath}`,
				{ filePath, operation: 'write' } as FileHandlingErrorOptions,
			);
		} else {
			logger.error(`CollaborationPersistence: Error saving collaboration: ${errorMessage(error)}`);
			throw createError(ErrorType.FileHandling, `Failed to save collaboration: ${filePath}`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	// Default values
	static defaultTokenUsage(): TokenUsage {
		return {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			thoughtTokens: 0,
			totalAllTokens: 0,
		};
	}

	static defaultCollaborationParams(): CollaborationParams {
		return {
			rolesModelConfig: {
				orchestrator: null,
				agent: null,
				chat: null,
			},
		};
	}

	static defaultMetadata(): CollaborationMetadata {
		return {
			id: '',
			version: 4,
			title: '',
			type: 'project',
			collaborationParams: CollaborationPersistence.defaultCollaborationParams(),
			createdAt: '',
			updatedAt: '',
			projectId: '',
			totalInteractions: 0,
			totalTokenUsage: CollaborationPersistence.defaultTokenUsage(),
		};
	}

	static defaultDetailedMetadata(): CollaborationDetailedMetadata {
		return {
			...CollaborationPersistence.defaultMetadata(),
			interactions: [],
		};
	}
}

export default CollaborationPersistence;