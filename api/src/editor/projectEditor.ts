import { join } from '@std/path';
import { getContentType } from 'api/utils/contentTypes.ts';

import { existsWithinProject, isPathWithinProject } from 'api/utils/fileHandling.ts';
import { generateFileListing } from 'api/utils/projectListing.ts';
import type LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import type { ProjectInfo as BaseProjectInfo } from 'api/llms/conversationInteraction.ts';
import type { FileMetadata } from 'shared/types.ts';
import type { LLMMessageContentPartImageBlockSourceMediaType } from 'api/llms/llmMessage.ts';

// Extend ProjectInfo to include projectId
export interface ProjectInfo extends BaseProjectInfo {
	projectId: string;
}
import OrchestratorController from '../controllers/orchestratorController.ts';
import type { SessionManager } from '../auth/session.ts';
import { logger } from 'shared/logger.ts';
import { ConfigManagerV2 } from 'shared/config/v2/configManager.ts';
import type { ProjectConfig } from 'shared/config/v2/types.ts';
import type { ConversationId, ConversationResponse } from 'shared/types.ts';
import type { LLMToolManagerToolSetType } from '../llms/llmToolManager.ts';
import {
	getBbDataDir,
	getBbDir,
	getProjectRoot,
	readFromBbDir,
	removeFromBbDir,
	resolveProjectFilePath,
	writeToBbDir,
} from 'shared/dataDir.ts';
import EventManager from 'shared/eventManager.ts';

class ProjectEditor {
	//private fileRevisions: Map<string, string[]> = new Map();
	public orchestratorController!: OrchestratorController;
	public projectConfig!: ProjectConfig;
	public eventManager!: EventManager;
	public sessionManager: SessionManager;
	public projectId: string;
	public projectRoot: string;
	public toolSet: LLMToolManagerToolSetType = 'coding';

	public changedFiles: Set<string> = new Set();
	public changeContents: Map<string, string> = new Map();
	private _projectInfo: ProjectInfo = {
		projectId: '',
		type: 'empty',
		content: '',
		tier: null,
	};

	constructor(projectId: string, sessionManager: SessionManager) {
		this.projectRoot = '.'; // init() will overwrite this
		this.projectId = projectId;
		this._projectInfo.projectId = projectId;
		this.sessionManager = sessionManager;
		//logger.info('ProjectEditor: sessionManager', sessionManager);
	}

	public async init(): Promise<ProjectEditor> {
		try {
			this.projectRoot = await this.getProjectRoot();
			const configManager = await ConfigManagerV2.getInstance();
			this.projectConfig = await configManager.getProjectConfig(this.projectId);
			logger.info(
				`ProjectEditor config for ${this.projectConfig.settings.api?.hostname}:${this.projectConfig.settings.api?.port}`,
			);
			this.eventManager = EventManager.getInstance();
			this.orchestratorController = await new OrchestratorController(this).init();

			logger.info(`ProjectEditor initialized for ${this.projectId}`);
		} catch (error) {
			logger.error(
				`Failed to initialize ProjectEditor in ${this.projectId}:`,
				error,
			);
			throw error;
		}
		return this;
	}

	public async isPathWithinProject(filePath: string): Promise<boolean> {
		logger.info(`ProjectEditor isPathWithinProject for ${this.projectRoot} - ${filePath}`);
		return await isPathWithinProject(this.projectRoot, filePath);
	}

	public async resolveProjectFilePath(filePath: string): Promise<string> {
		logger.info(`ProjectEditor resolveProjectFilePath for ${this.projectId} - ${filePath}`);
		const resolvedPath = await resolveProjectFilePath(this.projectId, filePath);
		logger.info(`ProjectEditor resolveProjectFilePath resolvedPath: ${resolvedPath}`);
		return resolvedPath;
	}

	public async getProjectRoot(): Promise<string> {
		// logger.info(`ProjectEditor getProjectRoot for ${this.projectId}`);
		return await getProjectRoot(this.projectId);
	}

	public async getBbDir(): Promise<string> {
		return await getBbDir(this.projectId);
	}

	public async getBbDataDir(): Promise<string> {
		return await getBbDataDir(this.projectId);
	}

	public async writeToBbDir(
		filename: string,
		content: string,
	): Promise<void> {
		return await writeToBbDir(this.projectId, filename, content);
	}

	public async readFromBbDir(filename: string): Promise<string | null> {
		return await readFromBbDir(this.projectId, filename);
	}

	public async removeFromBbDir(filename: string): Promise<void> {
		return await removeFromBbDir(this.projectId, filename);
	}

	get projectInfo(): ProjectInfo {
		return this._projectInfo;
	}

	set projectInfo(projectInfo: ProjectInfo) {
		projectInfo.projectId = this.projectId;
		this._projectInfo = projectInfo;
	}

	public async updateProjectInfo(): Promise<void> {
		// If prompt caching is enabled and we've already generated the file listing, skip regeneration
		if ((this.projectConfig.settings.api?.usePromptCaching ?? true) && this.projectInfo.type === 'file-listing') {
			return;
		}

		const projectInfo: ProjectInfo = {
			projectId: this.projectId,
			type: 'empty',
			content: '',
			tier: null,
		};

		const projectRoot = await this.getProjectRoot();
		const fileListing = await generateFileListing(projectRoot);
		if (fileListing) {
			projectInfo.type = 'file-listing';
			projectInfo.content = fileListing.listing;
			projectInfo.tier = fileListing.tier;
			logger.info(
				`ProjectEditor: Updated projectInfo for: ${this.projectId} using tier ${projectInfo.tier}`,
			);
		}

		this.projectInfo = projectInfo;
	}

	public async initConversation(
		conversationId: ConversationId,
	): Promise<LLMConversationInteraction> {
		logger.info(
			`ProjectEditor: Initializing a conversation with ID: ${conversationId}`,
		);
		return await this.orchestratorController.initializePrimaryInteraction(
			conversationId,
		);
	}

	async handleStatement(
		statement: string,
		conversationId: ConversationId,
		options?: { maxTurns?: number; model?: string },
	): Promise<ConversationResponse> {
		await this.initConversation(conversationId);
		logger.info(
			`ProjectEditor: Initialized conversation with ID: ${conversationId}, handling statement`,
		);
		const statementAnswer = await this.orchestratorController.handleStatement(
			statement,
			conversationId,
			options,
		);
		return statementAnswer;
	}

	// prepareFilesForConversation is called by request_files tool and by add_file handler for user requests
	// only existing files can be prepared and added, otherwise call rewrite_file tools with createIfMissing:true
	async prepareFilesForConversation(
		fileNames: string[],
	): Promise<
		Array<
			{
				fileName: string;
				metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
			}
		>
	> {
		const filesAdded: Array<
			{
				fileName: string;
				metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
			}
		> = [];

		for (const fileName of fileNames) {
			try {
				if (!await isPathWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} is outside the project directory`);
				}
				if (!await existsWithinProject(this.projectRoot, fileName)) {
					throw new Error(`Access denied: ${fileName} does not exist in the project directory`);
				}

				const fullFilePath = join(this.projectRoot, fileName);

				//const fileExtension = extname(fileName);
				const mimeType = getContentType(fileName);
				const isImage = mimeType.startsWith('image/');
				const { size } = await Deno.stat(fullFilePath).catch((_) => ({ size: 0 }));

				const metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'> = {
					type: isImage ? 'image' : 'text',
					mimeType: mimeType as LLMMessageContentPartImageBlockSourceMediaType,
					lastModified: new Date(),
					size,
					error: null,
				};
				filesAdded.push({ fileName, metadata });

				logger.info(`ProjectEditor: Prepared file ${fileName}`);
			} catch (error) {
				logger.error(`ProjectEditor: Error adding file ${fileName}: ${(error as Error).message}`);
				const errorMessage = (error as Error).message;
				filesAdded.push({
					fileName,
					metadata: {
						type: 'text',
						lastModified: new Date(),
						size: 0,
						error: errorMessage,
					},
				});
			}
		}

		return filesAdded;
	}
}

export default ProjectEditor;
