import { copy, ensureDir, exists } from '@std/fs';
import { dirname, join } from '@std/path';
import { getProjectRoot } from 'shared/dataDir.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type LLM from '../llms/providers/baseLLM.ts';
import type {
	ConversationDetailedMetadata,
	ConversationFilesMetadata,
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
import type { LLMRequestParams } from 'api/types/llms.ts';
import { logger } from 'shared/logger.ts';
import { TokenUsagePersistence } from './tokenUsagePersistence.ts';
import { LLMRequestPersistence } from './llmRequestPersistence.ts';
import { createError, ErrorType } from 'api/utils/error.ts';
import { isTokenUsageValidationError } from 'api/errors/error.ts';
import type { FileHandlingErrorOptions, ProjectHandlingErrorOptions } from 'api/errors/error.ts';
import type ProjectEditor from 'api/editor/projectEditor.ts';
import type { ProjectInfo } from 'api/llms/conversationInteraction.ts';
import type LLMTool from 'api/llms/llmTool.ts';

// Ensure ProjectInfo includes projectId
type ExtendedProjectInfo = ProjectInfo & { projectId: string };
import { stripIndents } from 'common-tags';
//import { encodeHex } from '@std/encoding';

class ConversationPersistence {
	private conversationDir!: string;
	private conversationParentDir: string | undefined;
	private metadataPath!: string;
	private messagesPath!: string;
	private changeLogPath!: string;
	private preparedSystemPath!: string;
	private preparedToolsPath!: string;
	private conversationsMetadataPath!: string;
	private filesMetadataPath!: string;
	private fileRevisionsDir!: string;
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
		const bbDataDir = await this.projectEditor.getBbDataDir();

		const conversationsDir = join(bbDataDir, 'conversations');
		this.conversationsMetadataPath = join(bbDataDir, 'conversations.json');

		this.conversationDir = join(conversationsDir, this.conversationId);
		if (this.parentInteractionId) this.conversationParentDir = join(conversationsDir, this.parentInteractionId);

		this.metadataPath = join(this.conversationDir, 'metadata.json');

		this.messagesPath = join(this.conversationDir, 'messages.jsonl');
		this.changeLogPath = join(this.conversationDir, 'changes.jsonl');

		this.preparedSystemPath = join(this.conversationDir, 'prepared_system.json');
		this.preparedToolsPath = join(this.conversationDir, 'prepared_tools.json');

		this.filesMetadataPath = join(this.conversationDir, 'files_metadata.json');
		this.fileRevisionsDir = join(this.conversationDir, 'file_revisions');

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
		let projectRoot;
		try {
			projectRoot = await getProjectRoot(options.projectId);
			//logger.info(`ConversationPersistence: Project root resolved to: ${projectRoot}`);
		} catch (error) {
			logger.error(
				`ConversationPersistence: Failed to get project root for projectId ${options.projectId}: ${
					(error as Error).message
				}`,
			);
			throw createError(
				ErrorType.ProjectHandling,
				`Failed to resolve project root: ${(error as Error).message}`,
				{
					projectId: options.projectId,
				} as ProjectHandlingErrorOptions,
			);
		}

		const bbDataDir = join(projectRoot, '.bb', 'data');
		const conversationsMetadataPath = join(bbDataDir, 'conversations.json');

		try {
			//logger.info(`ConversationPersistence: Ensuring directories exist: ${dirname(bbDataDir)} and ${bbDataDir}`);
			await ensureDir(dirname(bbDataDir)); // Ensure parent directory exists
			await ensureDir(bbDataDir);
		} catch (error) {
			logger.error(`ConversationPersistence: Failed to create required directories: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create required directories: ${(error as Error).message}`,
				{
					filePath: bbDataDir,
					operation: 'write',
				} as FileHandlingErrorOptions,
			);
		}

		try {
			if (!await exists(conversationsMetadataPath)) {
				// logger.info(
				// 	`ConversationPersistence: Creating new conversations.json file at ${conversationsMetadataPath}`,
				// );
				await Deno.writeTextFile(conversationsMetadataPath, JSON.stringify([]));
				return { conversations: [], totalCount: 0 };
			}
		} catch (error) {
			logger.error(`ConversationPersistence: Failed to create conversations.json: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to create conversations.json: ${(error as Error).message}`,
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
			logger.error(`ConversationPersistence: Failed to read conversations.json: ${(error as Error).message}`);
			throw createError(
				ErrorType.FileHandling,
				`Failed to read conversations.json: ${(error as Error).message}`,
				{
					filePath: conversationsMetadataPath,
					operation: 'read',
				} as FileHandlingErrorOptions,
			);
		}

		let conversations: ConversationMetadata[];
		try {
			conversations = JSON.parse(content);
		} catch (error) {
			logger.error(
				`ConversationPersistence: Failed to parse conversations.json content: ${(error as Error).message}`,
			);
			throw createError(
				ErrorType.FileHandling,
				`Invalid JSON in conversations.json: ${(error as Error).message}`,
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

			// Save files metadata
			const filesMetadata: ConversationFilesMetadata = {};
			for (const [key, value] of conversation.getFiles()) {
				filesMetadata[key] = value;
			}
			await this.saveFilesMetadata(filesMetadata);
			logger.debug(`ConversationPersistence: Saved filesMetadata for conversation: ${conversation.id}`);

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
			logger.error(`ConversationPersistence: Error saving conversation: ${(error as Error).message}`);
			this.handleSaveError(error, this.metadataPath);
		}
	}

	async loadConversation(llm: LLM): Promise<LLMConversationInteraction | null> {
		try {
			await this.ensureInitialized();

			if (!await exists(this.metadataPath)) {
				//logger.warn(`ConversationPersistence: Conversation metadata file not found: ${this.metadataPath}`);
				return null;
			}

			const metadata: ConversationDetailedMetadata = await this.getMetadata();
			const conversation = new LLMConversationInteraction(llm, this.conversationId);
			await conversation.init();

			conversation.id = metadata.id;
			conversation.title = metadata.title;
			//conversation.baseSystem = metadata.system;
			conversation.model = metadata.model;
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
				logger.warn(`ConversationPersistence: Error loading objectives: ${(error as Error).message}`);
				// Continue loading - don't fail the whole conversation load
			}

			// Load resources if they exist
			try {
				const resources = await this.getResources();
				if (resources) {
					resources.accessed.forEach((r) => conversation.updateResourceAccess(r, false));
					resources.modified.forEach((r) => conversation.updateResourceAccess(r, true));
				}
			} catch (error) {
				logger.warn(`ConversationPersistence: Error loading resources: ${(error as Error).message}`);
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
				logger.warn(`ConversationPersistence: Error loading project info: ${(error as Error).message}`);
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
						logger.error(`ConversationPersistence: Error parsing message: ${(error as Error).message}`);
						// Continue to the next message if there's an error
					}
				}
			}

			// Load filesMetadata
			const filesMetadata = await this.getFilesMetadata();
			for (const [filePathRevision, fileMetadata] of Object.entries(filesMetadata)) {
				const { filePath, fileRevision } = this.extractFilePathAndRevision(filePathRevision);

				conversation.setFileMetadata(filePath, fileRevision, fileMetadata);

				if (fileMetadata.inSystemPrompt) {
					conversation.addFileForSystemPrompt(filePath, fileMetadata);
				}
			}

			return conversation;
		} catch (error) {
			logger.error(`ConversationPersistence: Error loading conversation: ${(error as Error).message}`);
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
		let conversations: ConversationMetadata[] = [];

		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			conversations = JSON.parse(content);
		}

		const index = conversations.findIndex((conv) => conv.id === conversation.id);
		if (index !== -1) {
			conversations[index] = {
				...conversations[index],
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
			conversations.push({
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
			JSON.stringify(conversations, null, 2),
		);

		logger.debug(`ConversationPersistence: Saved metadata to project level for conversation: ${conversation.id}`);
	}

	extractFilePathAndRevision(fileName: string): { filePath: string; fileRevision: string } {
		const lastRevIndex = fileName.lastIndexOf('_rev_');
		const filePath = fileName.slice(0, lastRevIndex);
		const fileRevision = fileName.slice(lastRevIndex + 5);

		return { filePath, fileRevision };
	}

	async getConversationIdByTitle(title: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			const conversation = conversations.find((conv) => conv.title === title);
			return conversation ? conversation.id : null;
		}
		return null;
	}

	async getConversationTitleById(id: string): Promise<string | null> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			const conversation = conversations.find((conv) => conv.id === id);
			return conversation ? conversation.title : null;
		}
		return null;
	}

	async getAllConversations(): Promise<{ id: string; title: string }[]> {
		if (await exists(this.conversationsMetadataPath)) {
			const content = await Deno.readTextFile(this.conversationsMetadataPath);
			const conversations: ConversationMetadata[] = JSON.parse(content);
			return conversations.map(({ id, title }) => ({ id, title }));
		}
		return [];
	}

	async saveFilesMetadata(filesMetadata: ConversationFilesMetadata): Promise<void> {
		await this.ensureInitialized();
		logger.debug(`ConversationPersistence: Ensure directory for saveFilesMetadata: ${this.filesMetadataPath}`);
		await this.ensureDirectory(dirname(this.filesMetadataPath));
		const existingFilesMetadata = await this.getFilesMetadata();
		const updatedFilesMetadata = { ...existingFilesMetadata, ...filesMetadata };
		await Deno.writeTextFile(this.filesMetadataPath, JSON.stringify(updatedFilesMetadata, null, 2));
		logger.debug(`ConversationPersistence: Saved filesMetadata for conversation: ${this.conversationId}`);
	}
	async getFilesMetadata(): Promise<ConversationFilesMetadata> {
		await this.ensureInitialized();
		//logger.info(`ConversationPersistence: Reading filesMetadata for conversation: ${this.conversationId} from ${this.filesMetadataPath}`);
		if (await exists(this.filesMetadataPath)) {
			const filesMetadataContent = await Deno.readTextFile(this.filesMetadataPath);
			return JSON.parse(filesMetadataContent);
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

	async saveResources(resources: ResourceMetrics): Promise<void> {
		if (!resources.accessed || !resources.modified || !resources.active) {
			throw createError(ErrorType.FileHandling, 'Invalid resources format', {
				filePath: this.resourcesPath,
				operation: 'write',
			} as FileHandlingErrorOptions);
		}

		await this.ensureInitialized();
		logger.debug(`ConversationPersistence: Ensure directory for saveResources: ${this.resourcesPath}`);
		await this.ensureDirectory(dirname(this.resourcesPath));
		// Convert Sets to arrays for storage
		const storageFormat = {
			accessed: Array.from(resources.accessed),
			modified: Array.from(resources.modified),
			active: Array.from(resources.active),
			timestamp: new Date().toISOString(),
		};
		await Deno.writeTextFile(this.resourcesPath, JSON.stringify(storageFormat, null, 2));
		logger.debug(`ConversationPersistence: Saved resources for conversation: ${this.conversationId}`);
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
			throw createError(ErrorType.FileHandling, `Failed to save project info JSON: ${(error as Error).message}`, {
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
			throw createError(ErrorType.FileHandling, `Failed to load project info JSON: ${(error as Error).message}`, {
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
			tier: ${projectInfo.tier ?? 'null'}
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
			logger.error(`ConversationPersistence: Error saving conversation: ${(error as Error).message}`);
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
				let conversations: ConversationMetadata[] = JSON.parse(content);
				conversations = conversations.filter((conv) => conv.id !== this.conversationId);
				await Deno.writeTextFile(this.conversationsMetadataPath, JSON.stringify(conversations, null, 2));
			}

			// Delete the conversation directory and all its contents
			if (await exists(this.conversationDir)) {
				await Deno.remove(this.conversationDir, { recursive: true });
			}

			logger.info(`ConversationPersistence: Successfully deleted conversation: ${this.conversationId}`);
		} catch (error) {
			logger.error(`ConversationPersistence: Error deleting conversation: ${this.conversationId}`, error);
			throw createError(ErrorType.FileHandling, `Failed to delete conversation: ${(error as Error).message}`, {
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

	async storeFileRevision(fileName: string, revisionId: string, content: string | Uint8Array): Promise<void> {
		await this.ensureInitialized();
		const revisionFileName = `${fileName}_rev_${revisionId}`;
		const revisionFileDir = join(this.fileRevisionsDir, dirname(revisionFileName));
		const revisionFilePath = join(this.fileRevisionsDir, revisionFileName);
		logger.debug(`ConversationPersistence: Ensure directory for storeFileRevision: ${revisionFileDir}`);
		await this.ensureDirectory(revisionFileDir);
		logger.info(`ConversationPersistence: Writing revision file: ${revisionFilePath}`);
		if (typeof content === 'string') {
			await Deno.writeTextFile(revisionFilePath, content);
		} else {
			await Deno.writeFile(revisionFilePath, content);
		}
	}

	async getFileRevision(fileName: string, revisionId: string): Promise<string | Uint8Array> {
		await this.ensureInitialized();
		const revisionFileName = `${fileName}_rev_${revisionId}`;
		const revisionFilePath = join(this.fileRevisionsDir, revisionFileName);
		logger.info(`ConversationPersistence: Reading revision file: ${revisionFilePath}`);
		if (await exists(revisionFilePath)) {
			const fileInfo = await Deno.stat(revisionFilePath);
			if (fileInfo.isFile) {
				if (fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/)) {
					return await Deno.readFile(revisionFilePath);
				} else {
					return await Deno.readTextFile(revisionFilePath);
				}
			}
		}
		throw createError(
			ErrorType.FileHandling,
			`Could not read file contents for file revision ${revisionFilePath}`,
			{
				filePath: revisionFilePath,
				operation: 'read',
			} as FileHandlingErrorOptions,
		);
	}

	// 	private async generateRevisionId(content: string): Promise<string> {
	// 		const encoder = new TextEncoder();
	// 		const data = encoder.encode(content);
	// 		const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	// 		return encodeHex(new Uint8Array(hashBuffer));
	// 	}

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
