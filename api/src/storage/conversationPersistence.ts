import { copy, ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import {
	//migrateConversationResources,
	migrateConversationsFileIfNeeded,
} from 'shared/conversationMigration.ts';
import type { ConversationsFileV1 } from 'shared/conversationMigration.ts';
import {
	getProjectAdminDataDir,
	//getProjectAdminDir,
	isProjectMigrated,
	migrateProjectFiles,
} from 'shared/projectPath.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type {
	ConversationDetailedMetadata,
	ConversationId,
	ConversationMetadata,
	ConversationMetrics,
	ConversationStats,
	LLMRequestRecord,
	ObjectivesData,
	ResourceMetrics,
	TokenUsage,
	TokenUsageAnalysis,
	TokenUsageRecord,
	TokenUsageStats,
} from 'shared/types.ts';
import type { LLMCallbacks } from 'api/types.ts';
import type { LLMRequestParams } from 'api/types/llms.ts';
import type { ConversationResourcesMetadata } from 'shared/types/dataSourceResource.ts';
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
import { generateResourceRevisionKey } from 'shared/dataSource.ts';
import { stripIndents } from 'common-tags';
//import { encodeHex } from '@std/encoding';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: string };

class ConversationPersistence {
	private conversationDir!: string;
	private conversationParentDir: string | undefined;
	private metadataPath!: string;
	private messagesPath!: string;
	private changeLogPath!: string;
	private preparedSystemPath!: string;
	private preparedToolsPath!: string;
	private conversationsMetadataPath!: string;
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
		private conversationId: ConversationId,
		private projectEditor: ProjectEditor & { projectInfo: ExtendedProjectInfo },
		private parentInteractionId?: ConversationId,
	) {
		//this.ensureInitialized();
	}

	private async ensureInitialized(): Promise<void> {
		//logger.info(`ConversationPersistence: Ensuring Initialized`);
		if (!this.initialized) {
			await this.init();
			this.initialized = true;
		}
	}

	async init(): Promise<ConversationPersistence> {
		// Get BB data directory using project ID
		// Check if project has been migrated to new structure
		const projectId = this.projectEditor.projectId;

		const migrated = await isProjectMigrated(projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(projectId);
				logger.info(`ConversationPersistence: Successfully migrated project ${projectId} files`);
			} catch (migrationError) {
				logger.warn(
					`ConversationPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
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
		// Migrate conversations to new format
		await migrateConversationsFileIfNeeded(projectId);

		// Use new global project data directory
		const projectAdminDataDir = await getProjectAdminDataDir(projectId);
		if (!projectAdminDataDir) {
			logger.error(
				`ConversationPersistence: Failed to get data directory for projectId ${projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: projectId,
				} as ProjectHandlingErrorOptions,
			);
		}
		logger.debug(`ConversationPersistence: Using data dir for ${projectId}: ${projectAdminDataDir}`);
		const conversationsDir = join(projectAdminDataDir, 'conversations');
		this.conversationsMetadataPath = join(projectAdminDataDir, 'conversations.json');

		this.conversationDir = join(conversationsDir, this.conversationId);
		if (this.parentInteractionId) this.conversationParentDir = join(conversationsDir, this.parentInteractionId);

		this.metadataPath = join(this.conversationDir, 'metadata.json');

		this.messagesPath = join(this.conversationDir, 'messages.jsonl');
		this.changeLogPath = join(this.conversationDir, 'changes.jsonl');

		this.preparedSystemPath = join(this.conversationDir, 'prepared_system.json');
		this.preparedToolsPath = join(this.conversationDir, 'prepared_tools.json');

		this.resourcesMetadataPath = join(this.conversationDir, 'resources_metadata.json');
		this.resourceRevisionsDir = join(this.conversationDir, 'resource_revisions');
		// For backwards compatibility, ensure the resource_revisions directory exists
		await ensureDir(this.resourceRevisionsDir);

		this.projectInfoPath = join(this.conversationDir, 'project_info.json');

		this.objectivesPath = join(this.conversationDir, 'objectives.json');
		this.resourcesPath = join(this.conversationDir, 'resources.json');

		// [TODO] using conversationParentDir is good for chat interactions, but agent (child conversation) interations need to keep
		// tokenUsage with the child conversation persistence, not the parent
		// Do we need two types of parentID, one for chats and one for sub-agents??
		// Or maybe we need to record whether conversationPersistence is for orchestrator or agent?
		// Do we keep agent details in same conversation directory but separate messages, metadata, and tokenUsage files for each agent?
		this.tokenUsagePersistence = await new TokenUsagePersistence(this.conversationParentDir ?? this.conversationDir)
			.init();
		this.llmRequestPersistence = await new LLMRequestPersistence(this.conversationParentDir ?? this.conversationDir)
			.init();

		return this;
	}

	// export interface ProjectHandlingErrorOptions extends ErrorOptions {
	// 	project_id?: string;
	// 	project_root?: string;
	// 	project_type?: string;
	// }

	static async listConversations(options: {
		page: number;
		limit: number;
		startDate?: Date;
		endDate?: Date;
		llmProviderName?: string;
		projectId: string;
	}): Promise<{ conversations: ConversationMetadata[]; totalCount: number }> {
		//logger.info(`ConversationPersistence: listConversations called with projectId: ${options.projectId}`);
		// Check if project has been migrated to new structure
		const migrated = await isProjectMigrated(options.projectId);
		if (!migrated) {
			// Attempt migration for future calls
			try {
				await migrateProjectFiles(options.projectId);
				logger.info(
					`ConversationPersistence: listConversations - Successfully migrated project ${options.projectId} files`,
				);
			} catch (migrationError) {
				logger.warn(
					`ConversationPersistence: Migration attempted but failed: ${(migrationError as Error).message}`,
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
				`ConversationPersistence: Failed to get data directory for projectId ${options.projectId}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project data directory`,
				{
					projectId: options.projectId,
				} as ProjectHandlingErrorOptions,
			);
		}

		const conversationsMetadataPath = join(projectAdminDataDir, 'conversations.json');

		try {
			//logger.info(`ConversationPersistence: Ensuring directories exist: ${dirname(projectAdminDataDir)} and ${projectAdminDataDir}`);
			await ensureDir(dirname(projectAdminDataDir)); // Ensure parent directory exists
			await ensureDir(projectAdminDataDir);
		} catch (error) {
			logger.error(`ConversationPersistence: Failed to create required directories: ${errorMessage(error)}`);
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
			// Migrate conversations file to new format if needed
			await migrateConversationsFileIfNeeded(options.projectId);

			if (!await exists(conversationsMetadataPath)) {
				// logger.info(
				// 	`ConversationPersistence: Creating new conversations.json file at ${conversationsMetadataPath}`,
				// );
				await Deno.writeTextFile(
					conversationsMetadataPath,
					JSON.stringify({
						version: '1.0',
						conversations: [],
					}),
				);
				return { conversations: [], totalCount: 0 };
			}
		} catch (error) {
			logger.error(`ConversationPersistence: Failed to create conversations.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create conversations.json: ${errorMessage(error)}`,
				{
					filePath: conversationsMetadataPath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}

		let content: string;
		try {
			//logger.info(`ConversationPersistence: Reading conversations from ${conversationsMetadataPath}`);
			content = await Deno.readTextFile(conversationsMetadataPath);
		} catch (error) {
			logger.error(`ConversationPersistence: Failed to read conversations.json: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to read conversations.json: ${errorMessage(error)}`,
				{
					filePath: conversationsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		let conversationsData: ConversationsFileV1 | ConversationMetadata[];
		let conversations: ConversationMetadata[];
		try {
			conversationsData = JSON.parse(content);

			// Handle both old and new format
			if (Array.isArray(conversationsData)) {
				// Old format: direct array
				conversations = conversationsData;

				// Update the file to new format
				await migrateConversationsFileIfNeeded(options.projectId);
			} else if (conversationsData.version && Array.isArray(conversationsData.conversations)) {
				// New format: object with version and conversations array
				conversations = conversationsData.conversations;
			} else {
				// Unknown format
				throw new Error('Invalid conversations.json format');
			}
		} catch (error) {
			logger.error(
				`ConversationPersistence: Failed to parse conversations.json content: ${errorMessage(error)}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Invalid JSON in conversations.json: ${errorMessage(error)}`,
				{
					filePath: conversationsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		// Apply filters
		if (options.startDate) {
			conversations = conversations.filter((conv) => new Date(conv.createdAt) >= options.startDate!);
		}
		if (options.endDate) {
			conversations = conversations.filter((conv) => new Date(conv.createdAt) <= options.endDate!);
		}
		if (options.llmProviderName) {
			conversations = conversations.filter((conv) => conv.llmProviderName === options.llmProviderName);
		}

		// Get total count before pagination
		const totalCount = conversations.length;

		// Sort conversations by updatedAt in descending order
		conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

		// Apply pagination
		const startIndex = (options.page - 1) * options.limit;
		conversations = conversations.slice(startIndex, startIndex + options.limit);

		return {
			conversations: conversations.map((conv) => ({
				...conv,
				conversationStats: (conv as ConversationMetadata).conversationStats ||
					ConversationPersistence.defaultConversationStats(),
				requestParams: (conv as ConversationMetadata).requestParams ||
					ConversationPersistence.defaultRequestParams(),
				tokenUsageStats: {
					tokenUsageConversation: (conv as ConversationMetadata).tokenUsageStats?.tokenUsageConversation ||
						ConversationPersistence.defaultConversationTokenUsage(),
					tokenUsageStatement: (conv as ConversationMetadata).tokenUsageStats?.tokenUsageStatement ||
						ConversationPersistence.defaultTokenUsage(),
					tokenUsageTurn: (conv as ConversationMetadata).tokenUsageStats?.tokenUsageTurn ||
						ConversationPersistence.defaultTokenUsage(),
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

	async writeTokenUsage(record: TokenUsageRecord, type: 'conversation' | 'chat' | 'base'): Promise<void> {
		await this.ensureInitialized();
		try {
			await this.tokenUsagePersistence.writeUsage(record, type);
		} catch (error) {
			if (isTokenUsageValidationError(error)) {
				logger.error(
					`ConversationPersistence: TokenUsage validation failed: ${error.options.field} - ${error.options.constraint}`,
				);
			} else {
				logger.error(
					`ConversationPersistence: TokenUsage validation failed - Unknown error type: ${
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

	async writeLLMRequest(record: LLMRequestRecord): Promise<void> {
		await this.ensureInitialized();
		await this.llmRequestPersistence.writeLLMRequest(record);
	}

	async getLLMRequest(): Promise<LLMRequestRecord[]> {
		await this.ensureInitialized();
		return this.llmRequestPersistence.getLLMRequest();
	}

	async saveConversation(conversation: LLMConversationInteraction): Promise<void> {
		try {
			await this.ensureInitialized();
			logger.debug(`ConversationPersistence: Ensure directory for saveConversation: ${this.conversationDir}`);
			await this.ensureDirectory(this.conversationDir);

			const metadata: ConversationMetadata = {
				id: conversation.id,
				title: conversation.title,
				conversationStats: conversation.conversationStats,
				conversationMetrics: conversation.conversationMetrics,
				tokenUsageStats: conversation.tokenUsageStats,
				requestParams: conversation.requestParams,
				llmProviderName: conversation.llmProviderName,
				model: conversation.model,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			await this.updateConversationsMetadata(metadata);

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Create metadata with analyzed token usage
			const detailedMetadata: ConversationDetailedMetadata = {
				...metadata,
				parentInteractionId: this.parentInteractionId,

				//system: conversation.baseSystem,
				temperature: conversation.temperature,
				maxTokens: conversation.maxTokens,

				conversationStats: conversation.conversationStats,
				conversationMetrics: conversation.conversationMetrics,

				requestParams: conversation.requestParams,

				// Store analyzed token usage in metadata
				tokenUsageStats: {
					tokenUsageConversation: {
						inputTokens: tokenAnalysis.combined.totalUsage.input,
						outputTokens: tokenAnalysis.combined.totalUsage.output,
						totalTokens: tokenAnalysis.combined.totalUsage.total,
						cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
						cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
						totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
					},

					// Keep turn and statement level metrics
					tokenUsageTurn: conversation.tokenUsageStats.tokenUsageTurn,
					tokenUsageStatement: conversation.tokenUsageStats.tokenUsageStatement,
				},

				totalProviderRequests: conversation.totalProviderRequests,
				//tools: conversation.getAllTools().map((tool) => ({ name: tool.name, description: tool.description })),
			};

			await this.saveMetadata(detailedMetadata);

			// Save project info to JSON
			await this.saveProjectInfo(this.projectEditor.projectInfo);

			// Save messages
			//const statementCount = conversation.statementCount || 0; // Assuming this property exists
			const messages = conversation.getMessages();
			const messagesContent = messages.map((m, idx) => {
				if (m && typeof m === 'object') {
					return JSON.stringify({
						idx,
						conversationStats: m.conversationStats,
						role: m.role,
						content: m.content,
						id: m.id,
						providerResponse: m.providerResponse,
						timestamp: m.timestamp, // Assuming this property exists
					});
				} else {
					logger.warn(`ConversationPersistence: Invalid message encountered: ${JSON.stringify(m)}`);
					return null;
				}
			}).filter(Boolean).join('\n') + '\n';
			await Deno.writeTextFile(this.messagesPath, messagesContent);
			logger.debug(`ConversationPersistence: Saved messages for conversation: ${conversation.id}`);

			// Save resources metadata
			const resourcesMetadata: ConversationResourcesMetadata = {};
			for (const [key, value] of conversation.getResources()) {
				resourcesMetadata[key] = value;
			}
			await this.saveResourcesMetadata(resourcesMetadata);
			logger.debug(`ConversationPersistence: Saved resourcesMetadata for conversation: ${conversation.id}`);

			// Save objectives and resources
			const metrics = conversation.conversationMetrics;
			if (metrics.objectives) {
				await this.saveObjectives(metrics.objectives);
				logger.debug(`ConversationPersistence: Saved objectives for conversation: ${conversation.id}`);
			}
			if (metrics.resources) {
				await this.saveResources(metrics.resources);
				logger.debug(`ConversationPersistence: Saved resources for conversation: ${conversation.id}`);
			}
		} catch (error) {
			logger.error(`ConversationPersistence: Error saving conversation: ${errorMessage(error)}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadConversation(interactionCallbacks: LLMCallbacks): Promise<LLMConversationInteraction | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				//logger.warn(`ConversationPersistence: Conversation metadata file not found: ${this.metadataPath}`);
				return null;
			}

			const metadata: ConversationDetailedMetadata = await this.getMetadata();
			const conversation = new LLMConversationInteraction(this.conversationId);
			await conversation.init(metadata.model, interactionCallbacks);

			conversation.id = metadata.id;
			conversation.title = metadata.title;
			//conversation.baseSystem = metadata.system;
			//conversation.model = metadata.model; // set during init
			conversation.maxTokens = metadata.maxTokens;
			conversation.temperature = metadata.temperature;

			conversation.conversationStats = metadata.conversationStats;
			//conversation.conversationMetrics = metadata.conversationMetrics;

			conversation.requestParams = metadata.requestParams;

			conversation.totalProviderRequests = metadata.totalProviderRequests;

			// Get token usage analysis
			const tokenAnalysis = await this.getTokenUsageAnalysis();

			// Update conversation with analyzed values
			conversation.tokenUsageStats.tokenUsageConversation = {
				inputTokens: tokenAnalysis.combined.totalUsage.input,
				outputTokens: tokenAnalysis.combined.totalUsage.output,
				totalTokens: tokenAnalysis.combined.totalUsage.total,
				cacheCreationInputTokens: tokenAnalysis.combined.totalUsage.cacheCreationInput,
				cacheReadInputTokens: tokenAnalysis.combined.totalUsage.cacheReadInput,
				totalAllTokens: tokenAnalysis.combined.totalUsage.totalAll,
			};

			// Keep turn and statement usage from metadata for backward compatibility
			conversation.tokenUsageStats.tokenUsageTurn = metadata.tokenUsageStats?.tokenUsageTurn ||
				ConversationPersistence.defaultTokenUsage();
			conversation.tokenUsageStats.tokenUsageStatement = metadata.tokenUsageStats?.tokenUsageStatement ||
				ConversationPersistence.defaultTokenUsage();

			conversation.statementTurnCount = metadata.conversationMetrics?.statementTurnCount || 0;
			conversation.conversationTurnCount = metadata.conversationMetrics?.conversationTurnCount || 0;
			conversation.statementCount = metadata.conversationMetrics?.statementCount || 0;

			// Load objectives if they exist
			try {
				const objectives = await this.getObjectives();
				if (objectives) {
					conversation.setObjectives(objectives.conversation);
					for (const statement of objectives.statement) {
						conversation.setObjectives(undefined, statement);
					}
				}
			} catch (error) {
				logger.warn(`ConversationPersistence: Error loading objectives: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole conversation load
			}

			// Load resourceMetrics if they exist
			try {
				const resourceMetrics = await this.getResources();
				if (resourceMetrics) {
					resourceMetrics.accessed.forEach((r) => conversation.updateResourceAccess(r, false));
					resourceMetrics.modified.forEach((r) => conversation.updateResourceAccess(r, true));
				}
			} catch (error) {
				logger.warn(`ConversationPersistence: Error loading resourceMetrics: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole conversation load
			}

			// Load project info if it exists
			try {
				const projectInfo = await this.getProjectInfo();
				if (projectInfo) {
					// Store in conversation if needed
					// Currently just logging as project info is handled by projectEditor
					logger.debug('ConversationPersistence: Loaded project info from JSON');
				}
			} catch (error) {
				logger.warn(`ConversationPersistence: Error loading project info: ${errorMessage(error)}`);
				// Continue loading - don't fail the whole conversation load
			}

			if (await exists(this.messagesPath)) {
				const messagesContent = await Deno.readTextFile(this.messagesPath);
				const messageLines = messagesContent.trim().split('\n');

				for (const line of messageLines) {
					try {
						const messageData = JSON.parse(line);
						conversation.addMessage(messageData);
					} catch (error) {
						logger.error(`ConversationPersistence: Error parsing message: ${errorMessage(error)}`);
						// Continue to the next message if there's an error
					}
				}
			}

			// Load resourcesMetadata
			const resourcesMetadata = await this.getResourcesMetadata();
			for (const [resourceRevisionKey, resourceMetadata] of Object.entries(resourcesMetadata)) {
				//const { resourceUri, resourceRevision } = extractResourceKeyAndRevision(resourceRevisionKey);

				conversation.setResourceRevisionMetadata(resourceRevisionKey, resourceMetadata);

				// if (fileMetadata.inSystemPrompt) {
				// 	conversation.addResourceForSystemPrompt(filePath, fileMetadata);
				// }
			}

			return conversation;
		} catch (error) {
			logger.error(`ConversationPersistence: Error loading conversation: ${errorMessage(error)}`);
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when loading conversation: ${this.metadataPath}`,
				{
					filePath: this.metadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}
	}

	private async updateConversationsMetadata(
		conversation: ConversationMetadata & {
			conversationStats?: ConversationStats;
			conversationMetrics?: ConversationMetrics;
			tokenUsageStats?: TokenUsageStats;
		},
	): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`ConversationPersistence: Ensure directory for updateConversationsMetadata: ${this.conversationsMetadataPath}`,
		);
		await this.ensureDirectory(dirname(this.conversationsMetadataPath));
		let conversationsData: ConversationsFileV1 = {
			version: '1.0',
			conversations: [],
		};

		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const parsedData = JSON.parse(content);

			// Handle both old and new format
			if (Array.isArray(parsedData)) {
				// Old format: direct array
				conversationsData.conversations = parsedData;
			} else if (parsedData.version && Array.isArray(parsedData.conversations)) {
				// New format: object with version and conversations array
				conversationsData = parsedData;
			} else {
				// Unknown format, create new one
				conversationsData = {
					version: '1.0',
					conversations: [],
				};
			}
		}

		const index = conversationsData.conversations.findIndex((conv) => conv.id === conversation.id);
		if (index !== -1) {
			conversationsData.conversations[index] = {
				...conversationsData.conversations[index],
				...conversation,
				conversationStats: conversation.conversationStats ||
					ConversationPersistence.defaultConversationStats(),
				conversationMetrics: conversation.conversationMetrics ||
					ConversationPersistence.defaultConversationMetrics(),
				requestParams: conversation.requestParams ||
					ConversationPersistence.defaultRequestParams(),
				tokenUsageStats: {
					tokenUsageConversation: conversation.tokenUsageStats.tokenUsageConversation ||
						ConversationPersistence.defaultConversationTokenUsage(),
					tokenUsageStatement: conversation.tokenUsageStats.tokenUsageStatement ||
						ConversationPersistence.defaultTokenUsage(),
					tokenUsageTurn: conversation.tokenUsageStats.tokenUsageTurn ||
						ConversationPersistence.defaultTokenUsage(),
				},
			};
		} else {
			conversationsData.conversations.push({
				...conversation,
				conversationStats: conversation.conversationStats ||
					ConversationPersistence.defaultConversationStats(),
				conversationMetrics: conversation.conversationMetrics ||
					ConversationPersistence.defaultConversationMetrics(),
				requestParams: conversation.requestParams ||
					ConversationPersistence.defaultRequestParams(),
				tokenUsageStats: {
					tokenUsageConversation: conversation.tokenUsageStats.tokenUsageConversation ||
						ConversationPersistence.defaultConversationTokenUsage(),
					tokenUsageStatement: conversation.tokenUsageStats.tokenUsageStatement ||
						ConversationPersistence.defaultTokenUsage(),
					tokenUsageTurn: conversation.tokenUsageStats.tokenUsageTurn ||
						ConversationPersistence.defaultTokenUsage(),
				},
			});
		}

		await Deno.writeTextFile(
			this.conversationsMetadataPath,
			JSON.stringify(conversationsData, null, 2),
		);

		logger.debug(`ConversationPersistence: Saved metadata to project level for conversation: ${conversation.id}`);
	}

	async getConversationIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let conversations: ConversationMetadata[];
			if (Array.isArray(data)) {
				conversations = data;
			} else if (data.version && Array.isArray(data.conversations)) {
				conversations = data.conversations;
			} else {
				return null;
			}

			const conversation = conversations.find((conv) => conv.title === title);
			return conversation ? conversation.id : null;
		}
		return null;
	}

	async getConversationTitleById(id: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let conversations: ConversationMetadata[];
			if (Array.isArray(data)) {
				conversations = data;
			} else if (data.version && Array.isArray(data.conversations)) {
				conversations = data.conversations;
			} else {
				return null;
			}

			const conversation = conversations.find((conv) => conv.id === id);
			return conversation ? conversation.title : null;
		}
		return null;
	}

	async getAllConversations(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const data = JSON.parse(content);

			// Handle both old and new format
			let conversations: ConversationMetadata[];
			if (Array.isArray(data)) {
				conversations = data;
			} else if (data.version && Array.isArray(data.conversations)) {
				conversations = data.conversations;
			} else {
				return [];
			}

			return conversations.map(({ id, title }) => ({ id, title }));
		}
		return [];
	}

	async saveResourcesMetadata(resourcesMetadata: ConversationResourcesMetadata): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`ConversationPersistence: Ensure directory for saveResourcesMetadata: ${this.resourcesMetadataPath}`,
		);
		await this.ensureDirectory(dirname(this.resourcesMetadataPath));
		const existingResourcesMetadata = await this.getResourcesMetadata();
		const updatedResourcesMetadata = { ...existingResourcesMetadata, ...resourcesMetadata };
		await Deno.writeTextFile(this.resourcesMetadataPath, JSON.stringify(updatedResourcesMetadata, null, 2));
		logger.debug(`ConversationPersistence: Saved resourcesMetadata for conversation: ${this.conversationId}`);
	}
	async getResourcesMetadata(): Promise<ConversationResourcesMetadata> {
		await this.ensureInitialized();
		//logger.info(`ConversationPersistence: Reading resourcesMetadata for conversation: ${this.conversationId} from ${this.resourcesMetadataPath}`);
		if (await exists(this.resourcesMetadataPath)) {
			const resourcesMetadataContent = await Deno.readTextFile(this.resourcesMetadataPath);
			return JSON.parse(resourcesMetadataContent);
		}
		return {};
	}

	async getTokenUsageAnalysis(): Promise<{
		conversation: TokenUsageAnalysis;
		chat: TokenUsageAnalysis;
		combined: TokenUsageAnalysis;
	}> {
		await this.ensureInitialized();

		const analyzeUsageConversation = await this.tokenUsagePersistence.analyzeUsage('conversation');
		const analyzeUsageChat = await this.tokenUsagePersistence.analyzeUsage('chat');

		const totalUsageCombined = {
			input: analyzeUsageConversation.totalUsage.input + analyzeUsageChat.totalUsage.input,
			output: analyzeUsageConversation.totalUsage.output + analyzeUsageChat.totalUsage.output,
			total: analyzeUsageConversation.totalUsage.total + analyzeUsageChat.totalUsage.total,
			cacheCreationInput: analyzeUsageConversation.totalUsage.cacheCreationInput +
				analyzeUsageChat.totalUsage.cacheCreationInput,
			cacheReadInput: analyzeUsageConversation.totalUsage.cacheReadInput +
				analyzeUsageChat.totalUsage.cacheReadInput,
			totalAll: analyzeUsageConversation.totalUsage.totalAll + analyzeUsageChat.totalUsage.totalAll,
		};
		const differentialUsageCombined = {
			input: analyzeUsageConversation.differentialUsage.input + analyzeUsageChat.differentialUsage.input,
			output: analyzeUsageConversation.differentialUsage.output + analyzeUsageChat.differentialUsage.output,
			total: analyzeUsageConversation.differentialUsage.total + analyzeUsageChat.differentialUsage.total,
		};
		const cacheImpactCombined = {
			potentialCost: analyzeUsageConversation.cacheImpact.potentialCost +
				analyzeUsageChat.cacheImpact.potentialCost,
			actualCost: analyzeUsageConversation.cacheImpact.actualCost + analyzeUsageChat.cacheImpact.actualCost,
			savingsTotal: analyzeUsageConversation.cacheImpact.savingsTotal + analyzeUsageChat.cacheImpact.savingsTotal,
			savingsPercentage: ((analyzeUsageConversation.cacheImpact.savingsPercentage +
				analyzeUsageChat.cacheImpact.savingsPercentage) / 2),
		};
		const byRoleCombined = {
			user: analyzeUsageConversation.byRole.user + analyzeUsageChat.byRole.user,
			assistant: analyzeUsageConversation.byRole.assistant + analyzeUsageChat.byRole.assistant,
			system: analyzeUsageConversation.byRole.system + analyzeUsageChat.byRole.system,
			tool: analyzeUsageConversation.byRole.tool + analyzeUsageChat.byRole.tool,
		};

		return {
			conversation: analyzeUsageConversation,
			chat: analyzeUsageChat,
			combined: {
				totalUsage: totalUsageCombined,
				differentialUsage: differentialUsageCombined,
				cacheImpact: cacheImpactCombined,
				byRole: byRoleCombined,
			},
		};
	}

	async saveMetadata(metadata: Partial<ConversationDetailedMetadata>): Promise<void> {
		// Set version 2 for new token usage format
		metadata.version = 2;
		await this.ensureInitialized();
		logger.debug(`ConversationPersistence: Ensure directory for saveMetadata: ${this.metadataPath}`);
		await this.ensureDirectory(dirname(this.metadataPath));
		const existingMetadata = await this.getMetadata();
		const updatedMetadata = { ...existingMetadata, ...metadata };
		await Deno.writeTextFile(this.metadataPath, JSON.stringify(updatedMetadata, null, 2));
		logger.debug(`ConversationPersistence: Saved metadata for conversation: ${this.conversationId}`);

		// Update the conversations metadata file
		await this.updateConversationsMetadata(updatedMetadata);
	}

	async getMetadata(): Promise<ConversationDetailedMetadata> {
		await this.ensureInitialized();
		if (await exists(this.metadataPath)) {
			const metadataContent = await Deno.readTextFile(this.metadataPath);
			return JSON.parse(metadataContent);
		}
		return ConversationPersistence.defaultMetadata();
	}

	static defaultConversationStats(): ConversationStats {
		return {
			statementCount: 0,
			statementTurnCount: 0,
			conversationTurnCount: 0,
		};
	}
	static defaultConversationMetrics(): ConversationMetrics {
		return {
			statementCount: 0,
			statementTurnCount: 0,
			conversationTurnCount: 0,
			objectives: { conversation: '', statement: [], timestamp: '' },
			resources: { accessed: new Set(), modified: new Set(), active: new Set() },
			toolUsage: {
				currentToolSet: '',
				toolStats: new Map(),
			},
		};
	}
	static defaultConversationTokenUsage(): TokenUsage {
		return {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			totalAllTokens: 0,
		};
	}
	static defaultTokenUsage(): TokenUsage {
		return {
			inputTokens: 0,
			outputTokens: 0,
			totalTokens: 0,
			totalAllTokens: 0,
		};
	}
	static defaultRequestParams(): LLMRequestParams {
		return {
			model: '',
			temperature: 0,
			maxTokens: 0,
			extendedThinking: { enabled: false, budgetTokens: 0 },
			usePromptCaching: false,
		};
	}
	static defaultMetadata(): ConversationDetailedMetadata {
		const metadata = {
			version: 3, // default version for existing conversations
			//projectId: this.projectEditor.projectInfo.projectId,
			id: '',
			parentInteractionId: undefined,
			title: '',
			llmProviderName: '',
			model: '',
			createdAt: '',
			updatedAt: '',

			//system: '',
			temperature: 0,
			maxTokens: 4096,

			totalProviderRequests: 0,

			tokenUsageStats: {
				tokenUsageTurn: ConversationPersistence.defaultTokenUsage(),
				tokenUsageStatement: ConversationPersistence.defaultTokenUsage(),
				tokenUsageConversation: ConversationPersistence.defaultConversationTokenUsage(),
			},

			requestParams: ConversationPersistence.defaultRequestParams(),

			conversationStats: ConversationPersistence.defaultConversationStats(),
			conversationMetrics: ConversationPersistence.defaultConversationMetrics(),
			//tools: [],
		};
		return metadata;
	}

	async savePreparedSystemPrompt(systemPrompt: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(
			`ConversationPersistence: Ensure directory for savePreparedSystemPrompt: ${this.preparedSystemPath}`,
		);
		await this.ensureDirectory(dirname(this.preparedSystemPath));
		const promptData = { systemPrompt };
		await Deno.writeTextFile(this.preparedSystemPath, JSON.stringify(promptData, null, 2));
		logger.info(`ConversationPersistence: Prepared prompt saved for conversation: ${this.conversationId}`);
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
		logger.debug(`ConversationPersistence: Ensure directory for savePreparedTools: ${this.preparedToolsPath}`);
		await this.ensureDirectory(dirname(this.preparedToolsPath));
		//const toolsData = Array.from(tools.values()).map((tool) => ({
		const toolsData = tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			inputSchema: tool.inputSchema,
		}));
		await Deno.writeTextFile(this.preparedToolsPath, JSON.stringify(toolsData, null, 2));
		logger.info(`ConversationPersistence: Prepared tools saved for conversation: ${this.conversationId}`);
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
		logger.debug(`ConversationPersistence: Ensure directory for saveObjectives: ${this.objectivesPath}`);
		await this.ensureDirectory(dirname(this.objectivesPath));
		await Deno.writeTextFile(this.objectivesPath, JSON.stringify(objectives, null, 2));
		logger.debug(`ConversationPersistence: Saved objectives for conversation: ${this.conversationId}`);
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
		logger.debug(`ConversationPersistence: Ensure directory for saveResources: ${this.resourcesPath}`);
		await this.ensureDirectory(dirname(this.resourcesPath));
		// Convert Sets to arrays for storage
		const storageFormat = {
			accessed: Array.from(resourceMetrics.accessed),
			modified: Array.from(resourceMetrics.modified),
			active: Array.from(resourceMetrics.active),
			timestamp: new Date().toISOString(),
		};
		await Deno.writeTextFile(this.resourcesPath, JSON.stringify(storageFormat, null, 2));
		logger.debug(`ConversationPersistence: Saved resourceMetrics for conversation: ${this.conversationId}`);
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
		logger.debug(`ConversationPersistence: Ensure directory for saveProjectInfo: ${this.projectInfoPath}`);
		await this.ensureDirectory(dirname(this.projectInfoPath));
		try {
			await Deno.writeTextFile(this.projectInfoPath, JSON.stringify(projectInfo, null, 2));
			logger.debug(`ConversationPersistence: Saved project info JSON for conversation: ${this.conversationId}`);
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
		logger.debug(`ConversationPersistence: Ensure directory for dumpProjectInfo: ${this.conversationDir}`);
		await this.ensureDirectory(this.conversationDir);
		const projectInfoPath = join(this.conversationDir, 'dump_project_info.md');
		const content = stripIndents`---
			type: ${projectInfo.type}
			---
			${projectInfo.content}
		`;
		await Deno.writeTextFile(projectInfoPath, content);
		logger.info(`ConversationPersistence: Project info dumped for conversation: ${this.conversationId}`);
	}

	// this is a system prompt dump primarily used for debugging
	async dumpSystemPrompt(systemPrompt: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`ConversationPersistence: Ensure directory for dumpSystemPrompt: ${this.conversationDir}`);
		await this.ensureDirectory(this.conversationDir);
		const systemPromptPath = join(this.conversationDir, 'dump_system_prompt.md');
		await Deno.writeTextFile(systemPromptPath, systemPrompt);
		logger.info(`ConversationPersistence: System prompt dumped for conversation: ${this.conversationId}`);
	}

	private handleSaveError(error: unknown, filePath: string): never {
		if (error instanceof Deno.errors.PermissionDenied) {
			throw createError(
				ErrorType.FileHandling,
				`Permission denied when saving conversation: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else if (error instanceof Deno.errors.NotFound) {
			throw createError(
				ErrorType.FileHandling,
				`File or directory not found when saving conversation: ${filePath}`,
				{
					filePath,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		} else {
			logger.error(`ConversationPersistence: Error saving conversation: ${errorMessage(error)}`);
			throw createError(ErrorType.FileHandling, `Failed to save conversation: ${filePath}`, {
				filePath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}
	}

	async logChange(filePath: string, change: string): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`ConversationPersistence: Ensure directory for logChange: ${this.changeLogPath}`);
		await this.ensureDirectory(dirname(this.changeLogPath));

		const changeEntry = JSON.stringify({
			timestamp: new Date().toISOString(),
			filePath,
			change,
		}) + '\n';
		logger.info(`ConversationPersistence: Writing change file: ${this.changeLogPath}`);

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

	async deleteConversation(): Promise<void> {
		await this.ensureInitialized();

		try {
			// Remove from conversations metadata first
			if (await exists(this.conversationsMetadataPath)) {
				const content = await Deno.readTextFile(this.conversationsMetadataPath);
				const data = JSON.parse(content);

				// Handle both old and new format
				if (Array.isArray(data)) {
					// Old format
					const updatedConversations = data.filter((conv: ConversationMetadata) =>
						conv.id !== this.conversationId
					);
					await Deno.writeTextFile(
						this.conversationsMetadataPath,
						JSON.stringify(updatedConversations, null, 2),
					);
				} else if (data.version && Array.isArray(data.conversations)) {
					// New format
					data.conversations = data.conversations.filter((conv: ConversationMetadata) =>
						conv.id !== this.conversationId
					);
					await Deno.writeTextFile(this.conversationsMetadataPath, JSON.stringify(data, null, 2));
				}
			}

			// Delete the conversation directory and all its contents
			if (await exists(this.conversationDir)) {
				await Deno.remove(this.conversationDir, { recursive: true });
			}

			logger.info(`ConversationPersistence: Successfully deleted conversation: ${this.conversationId}`);
		} catch (error) {
			logger.error(`ConversationPersistence: Error deleting conversation: ${this.conversationId}`, error);
			throw createError(ErrorType.FileHandling, `Failed to delete conversation: ${errorMessage(error)}`, {
				filePath: this.conversationDir,
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

		logger.info(`ConversationPersistence: Writing revision resource: ${revisionResourcePath}`);

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
		// 	logger.warn(`ConversationPersistence: Could not store resource at project level: ${errorMessage(error)}`);
		// 	// Continue even if project-level storage fails
		// }
	}

	async getResourceRevision(resourceUri: string, revisionId: string): Promise<string | Uint8Array> {
		await this.ensureInitialized();
		const resourceKey = generateResourceRevisionKey(resourceUri, revisionId);
		const revisionResourcePath = join(this.resourceRevisionsDir, resourceKey);

		// // For backwards compatibility, also check the old file_revisions directory
		// const oldFileRevisionsDir = join(dirname(this.resourceRevisionsDir), 'file_revisions');
		// const oldRevisionPath = join(oldFileRevisionsDir, resourceKey);

		logger.info(`ConversationPersistence: Reading revision resource: ${revisionResourcePath}`);

		// First try the new location
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

		// // If not found in new location, try the old location
		// if (await exists(oldRevisionPath)) {
		// 	const resourceInfo = await Deno.stat(oldRevisionPath);
		// 	if (resourceInfo.isFile) {
		// 		if (resourceUri.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
		// 			return await Deno.readFile(oldRevisionPath);
		// 		} else {
		// 			return await Deno.readTextFile(oldRevisionPath);
		// 		}
		// 	}
		// }

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
		const backupDir = join(this.conversationDir, 'backups');
		logger.debug(`ConversationPersistence: Ensure directory for createBackups: ${backupDir}`);
		await this.ensureDirectory(backupDir);

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const filesToBackup = ['messages.jsonl', 'conversation.jsonl', 'conversation.log', 'metadata.json'];

		for (const file of filesToBackup) {
			const sourcePath = join(this.conversationDir, file);
			const backupPath = join(backupDir, `${file}.${timestamp}`);
			await copy(sourcePath, backupPath, { overwrite: true });
		}
	}
}

export default ConversationPersistence;
