import { join } from '@std/path';
import { encodeBase64 } from '@std/encoding';

import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type {
	ConversationId,
	ConversationMetrics,
	ConversationTokenUsage,
	FileMetadata,
	TokenUsage,
} from 'shared/types.ts';
import LLMInteraction from './baseInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentPartImageBlockSourceMediaType,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import { isFileHandlingError } from 'api/errors/error.ts';

import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { logger } from 'shared/logger.ts';
//import { readFileContent } from 'shared/dataDir.ts';
import { ResourceManager } from '../resourceManager.ts';
//import { GitUtils } from 'shared/git.ts';

export type { FileMetadata };
export interface ProjectInfo {
	type: 'empty' | 'ctags' | 'file-listing';
	content: string;
	tier: number | null;
}

// const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
// function isImageFile(fileName: string): boolean {
// 	const ext = fileName.toLowerCase().split('.').pop();
// 	return imageExtensions.includes(`.${ext}`);
// }

class LLMConversationInteraction extends LLMInteraction {
	private _files: Map<string, FileMetadata> = new Map();
	private resourceManager: ResourceManager;
	private systemPromptFiles: string[] = [];
	//private currentCommit: string | null = null;

	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
		this.resourceManager = new ResourceManager();
	}

	// these methods are really just convenience aliases for tokenUsageInteraction
	public get tokenUsageConversation(): ConversationTokenUsage {
		return this._tokenUsageInteraction;
	}
	public set tokenUsageConversation(tokenUsage: ConversationTokenUsage) {
		this._tokenUsageInteraction = tokenUsage;
	}

	public async prepareSytemPrompt(baseSystem: string): Promise<string> {
		//logger.info('ConversationInteraction: Preparing system prompt', baseSystem);
		if (!this.conversationPersistence) {
			throw new Error('ConversationPersistence not initialized');
		}
		// First, try to get the system prompt from storage
		let preparedSystemPrompt = await this.conversationPersistence
			.getPreparedSystemPrompt();

		if (!preparedSystemPrompt) {
			// If not found in storage, generate a new system prompt
			const projectInfo = await this.llm.invoke(LLMCallbackType.PROJECT_INFO);
			preparedSystemPrompt = this.appendProjectInfoToSystem(
				baseSystem,
				projectInfo,
			);

			// We're not currently adding files to system prompt, only in messages
			//preparedSystemPrompt = await this.appendFilesToSystem(preparedSystemPrompt);

			// Save the generated system prompt
			await this.conversationPersistence.savePreparedSystemPrompt(
				preparedSystemPrompt,
			);
			//logger.info('ConversationInteraction: Created system prompt', preparedSystemPrompt);
		}

		//logger.info('ConversationInteraction: Using prepared system prompt', preparedSystem);
		return preparedSystemPrompt;
	}

	public async prepareTools(tools: Map<string, LLMTool>): Promise<LLMTool[]> {
		if (!this.conversationPersistence) {
			throw new Error(
				'ConversationInteraction: ConversationPersistence not initialized',
			);
		}

		// First, try to get the prepared tools from storage
		let preparedTools = await this.conversationPersistence.getPreparedTools();

		if (!preparedTools) {
			// If not found in storage, prepare the tools

			preparedTools = Array.from(tools.values()).map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
			} as LLMTool));

			// Save the prepared tools
			await this.conversationPersistence.savePreparedTools(preparedTools || []);
		}
		//logger.info('ConversationInteraction: preparedTools', preparedTools);

		return preparedTools || [];
	}

	public async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return await this.hydrateMessages(messages);
	}

	protected async createFileXmlString(
		filePath: string,
		revisionId: string,
	): Promise<string | null> {
		try {
			logger.info(
				'ConversationInteraction: createFileXmlString - filePath',
				filePath,
			);
			const content = await this.readProjectFileContent(filePath, revisionId);
			const fileMetadata = this.getFileMetadata(filePath, revisionId);
			if (!fileMetadata) {
				throw new Error(`File has not been added to conversation: ${filePath}`);
			}
			return `<file path="${filePath}" size="${fileMetadata.size}" last_modified="${fileMetadata.lastModified}">\n${content}\n</file>`;
		} catch (error) {
			logger.error(
				`ConversationInteraction: Error creating XML string for ${filePath}: ${error.message}`,
			);
			//throw createError(ErrorType.FileHandling, `Failed to create xmlString for ${filePath}`, {
			//	filePath,
			//	operation: 'write',
			//} as FileHandlingErrorOptions);
		}
		return null;
	}

	// 	public async readProjectFileContent(
	// 		filePath: string,
	// 		revisionId: string,
	// 	): Promise<string | Uint8Array | undefined> {
	// 		const content = this.getFileRevision(filePath, revisionId);
	// 		if (content) {
	// 			logger.info(`ConversationInteraction: Returning contents of File Revision ${filePath} (${revisionId})`);
	// 			return content;
	// 		} else {
	// 			const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
	// 			const fullFilePath = join(projectRoot, filePath);
	// 			logger.info(`ConversationInteraction: Reading contents of File ${fullFilePath}`);
	// 			try {
	// 				const content = await this.resourceManager.loadResource({
	// 					type: 'file',
	// 					location: fullFilePath,
	// 				});
	// 				this.storeFileRevision(filePath, revisionId, content);
	// 				return content;
	// 			} catch (error) {
	// 				throw new Error(`Failed to read file: ${fullFilePath}`);
	// 			}
	// 		}
	// 	}

	public async readProjectFileContent(
		filePath: string,
		revisionId: string,
	): Promise<string | Uint8Array> {
		try {
			//logger.info(`ConversationInteraction: Reading file revision from project: ${filePath}`);
			const content = await this.getFileRevision(filePath, revisionId);
			if (content === null) {
				const projectRoot = await this.llm.invoke(LLMCallbackType.PROJECT_ROOT);
				const fullFilePath = join(projectRoot, filePath);
				logger.info(`ConversationInteraction: Reading contents of File ${fullFilePath}`);
				const content = await this.resourceManager.loadResource({
					type: 'file',
					location: fullFilePath,
				});
				await this.storeFileRevision(filePath, revisionId, content);
				return content;
			}
			logger.info(`ConversationInteraction: Returning contents of File Revision ${filePath} (${revisionId})`);
			return content;
		} catch (error) {
			//logger.info(`ConversationInteraction: Error getting File from project ${filePath} (${revisionId}`, error);
			if (error instanceof Deno.errors.NotFound) {
				logger.info(
					`ConversationInteraction: File not found: ${filePath} (${revisionId}) - ${error.message}`,
				);
				return '';
			} else if (error instanceof Deno.errors.PermissionDenied) {
				logger.info(
					`ConversationInteraction: Permission denied: ${filePath} (${revisionId}) - ${error.message}`,
				);
				return '';
			} else {
				throw new Error(`Failed to read file: ${filePath} (${revisionId}) - Error: ${error}`);
			}
		}
	}

	async storeFileRevision(filePath: string, revisionId: string, content: string | Uint8Array): Promise<void> {
		logger.info(`ConversationInteraction: Storing file revision: ${filePath} Revision: (${revisionId})`);
		await this.conversationPersistence.storeFileRevision(filePath, revisionId, content);
	}

	async getFileRevision(filePath: string, revisionId: string): Promise<string | Uint8Array | null> {
		logger.info(`ConversationInteraction: Getting file revision: ${filePath} Revision: (${revisionId})`);
		try {
			const content = await this.conversationPersistence.getFileRevision(filePath, revisionId);
			return content;
		} catch (error) {
			if (error instanceof Deno.errors.NotFound || isFileHandlingError(error)) {
				logger.info(
					`ConversationInteraction: getFileRevision - File not found: ${filePath} (${revisionId}) - ${error.message}`,
				);
				return null;
				// } else if (error instanceof Deno.errors.PermissionDenied) {
				// 	logger.info(
				// 		`ConversationInteraction: getFileRevision - Permission denied: ${filePath} (${revisionId}) - ${error.message}`,
				// 	);
				// 	return null;
			} else {
				throw new Error(`Failed to read file revision: ${filePath} (${revisionId}) - Error: ${error}`);
			}
		}
	}
	// async getFileRevisionSimple(filePath: string, revisionId: string): Promise<string | Uint8Array> {
	// 	logger.info(`ConversationInteraction: Getting file revision: ${filePath} Revision: (${revisionId})`);
	// 	return await this.conversationPersistence.getFileRevision(filePath, revisionId);
	// }

	protected appendProjectInfoToSystem(
		system: string,
		projectInfo: ProjectInfo,
	): string {
		if (projectInfo.type === 'ctags') {
			system += `\n\n<project-details>\n<ctags>\n${projectInfo.content}\n</ctags>\n</project-details>`;
		} else if (projectInfo.type === 'file-listing') {
			system +=
				`\n\n<project-details>\n<file-listing>\n${projectInfo.content}\n</file-listing>\n</project-details>`;
		}
		return system;
	}

	protected async appendFilesToSystem(system: string): Promise<string> {
		for (const filePath of this.getSystemPromptFiles()) {
			const fileXml = await this.createFileXmlString(filePath, '');
			if (fileXml) {
				system += `\n\n${fileXml}`;
			}
		}
		return system;
	}

	async hydrateMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		const hydratedFiles = new Map<string, number>();

		const processContentPart = async (
			contentPart: LLMMessageContentPart,
			messageId: string,
			turnIndex: number,
		): Promise<LLMMessageContentPart | LLMMessageContentParts> => {
			if (
				contentPart.type === 'text' &&
				contentPart.text.startsWith('File added:')
			) {
				const filePath = contentPart.text.split(': ')[1].trim();
				const fileMetadata = this.getFileMetadata(filePath, messageId);
				if (!fileMetadata) {
					logger.warn(
						`ConversationInteraction: File metadata not found for ${filePath} Revision:(${messageId})`,
					);
					return contentPart;
				}

				// if prompt caching is enabled then add file for each message
				// if prompt caching is NOT enabled then only add file once (to last message)
				if (this.fullConfig.api.usePromptCaching || !hydratedFiles.has(filePath)) {
					logger.info(
						`ConversationInteraction: Hydrating message for file: ${filePath} - Revision:(${messageId}) - Turn: ${turnIndex} - Metadata:  ${
							JSON.stringify(fileMetadata)
						}`,
					);

					if (fileMetadata.type === 'image') {
						// For image files, we'll create both an LLMMessageContentPartImageBlock and a text block
						const imageData = await this.readProjectFileContent(filePath, messageId) as Uint8Array;
						const base64Data = encodeBase64(imageData);
						const imageBlock: LLMMessageContentPartImageBlock = {
							type: 'image',
							source: {
								type: 'base64',
								media_type: fileMetadata.mimeType as LLMMessageContentPartImageBlockSourceMediaType,
								data: base64Data,
							},
						};
						const textBlock: LLMMessageContentPartTextBlock = {
							type: 'text',
							text:
								`<bbFile path="${filePath}" type="image" size="${fileMetadata.size}" last_modified="${fileMetadata.lastModified}" mime_type="${fileMetadata.mimeType}" revision="${messageId}"></bbFile>`,
						};
						hydratedFiles.set(filePath, turnIndex);
						return [imageBlock, textBlock] as LLMMessageContentParts;
					} else {
						//logger.info(`ConversationInteraction: Hydrating - preparing file: ${filePath}`);
						const fileContent = await this.readProjectFileContent(filePath, messageId);
						const fileXml =
							`<bbFile path="${filePath}" size="${fileMetadata.size}" last_modified="${fileMetadata.lastModified}" revision="${messageId}">
${fileContent}
</bbFile>`;
						hydratedFiles.set(filePath, turnIndex);
						return { ...contentPart, text: fileXml };
					}
				} else {
					const lastHydratedTurn = hydratedFiles.get(filePath)!;
					logger.info(
						`ConversationInteraction: Skipping hydration for file: ${filePath} - Current Turn: ${turnIndex}, Last Hydrated Turn: ${lastHydratedTurn}`,
					);
					return {
						...contentPart,
						text: `Note: File ${filePath} content is up-to-date as of turn ${lastHydratedTurn}.`,
					};
				}
			}
			if (
				contentPart.type === 'tool_result' && Array.isArray(contentPart.content)
			) {
				// processContentPart can return an array or an object, which can result in nested arrays
				// use `flat()` to un-nest the array
				const updatedContent = (await Promise.all(
					contentPart.content.map((part) => processContentPart(part, messageId, turnIndex)),
				)).flat();
				return {
					...contentPart,
					content: updatedContent,
				} as LLMMessageContentPart;
			}
			return contentPart;
		};

		const processMessage = async (
			message: LLMMessage,
			index: number,
		): Promise<LLMMessage> => {
			if (!message || typeof message !== 'object') {
				logger.error(`ConversationInteraction: Invalid message encountered: ${JSON.stringify(message)}`);
				return message;
			}
			if (message.role === 'user') {
				logger.error(`ConversationInteraction: Hydrating message: ${JSON.stringify(message)}`);
				const updatedContent: LLMMessageContentPart[] = [];
				for (const part of message.content) {
					const processedPart = await processContentPart(
						part,
						message.id || '',
						index,
					);
					if (Array.isArray(processedPart)) {
						updatedContent.push(...processedPart);
					} else {
						updatedContent.push(processedPart);
					}
				}
				const updatedMessage = new LLMMessage(
					message.role,
					updatedContent,
					message.tool_call_id,
					message.providerResponse,
					message.id,
				);
				return updatedMessage;
			}
			return message;
		};

		const reversedMessages = [...messages].reverse();
		const processedMessages = [];
		for (let i = 0; i < reversedMessages.length; i++) {
			const processedMessage = await processMessage(reversedMessages[i], i);
			processedMessages.push(processedMessage);
		}
		return processedMessages.reverse();
	}

	addFileForMessage(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
		messageId: string,
		toolUseId?: string,
	): { filePath: string; fileMetadata: FileMetadata } {
		const fileMetadata: FileMetadata = {
			...metadata,
			messageId,
			path: filePath,
			inSystemPrompt: false,
			toolUseId,
		};

		if (!fileMetadata.error) {
			this.setFileMetadata(filePath, messageId, fileMetadata);
		}
		return { filePath, fileMetadata };
	}

	addFilesForMessage(
		filesToAdd: Array<
			{
				fileName: string;
				metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>;
			}
		>,
		messageId: string,
		toolUseId?: string,
	): Array<{ filePath: string; fileMetadata: FileMetadata }> {
		const conversationFiles = [];

		for (const fileToAdd of filesToAdd) {
			const filePath = fileToAdd.fileName;
			const fileMetadata: FileMetadata = {
				...fileToAdd.metadata,
				messageId,
				path: filePath,
				inSystemPrompt: false,
				toolUseId,
			};
			conversationFiles.push({
				filePath,
				fileMetadata,
			});
		}

		for (const fileToAdd of conversationFiles) {
			if (!fileToAdd.fileMetadata.error) {
				this.setFileMetadata(fileToAdd.filePath, messageId, fileToAdd.fileMetadata);
			}
		}
		return conversationFiles;
	}

	addFileForSystemPrompt(
		filePath: string,
		metadata: Omit<FileMetadata, 'path' | 'inSystemPrompt'>,
	): void {
		const fileMetadata: FileMetadata = {
			...metadata,
			path: filePath,
			inSystemPrompt: true,
		};
		this.setFileMetadata(filePath, '', fileMetadata);
		this.systemPromptFiles.push(filePath);
	}

	removeFile(filePath: string, revisionId: string): boolean {
		const fileMetadata = this.getFileMetadata(filePath, revisionId);
		if (fileMetadata) {
			if (!fileMetadata.inSystemPrompt && fileMetadata.messageId) {
				this.messages = this.messages.filter((message) => message.id !== fileMetadata.messageId);
			}
			if (fileMetadata.inSystemPrompt) {
				this.systemPromptFiles = this.systemPromptFiles.filter((path) => path !== filePath);
			}
			const fileKey = `${filePath}_rev_${revisionId}`;
			return this._files.delete(fileKey);
		}
		return false;
	}
	getFileMetadata(filePath: string, revisionId: string): FileMetadata | undefined {
		const fileKey = `${filePath}_rev_${revisionId}`;
		return this._files.get(fileKey);
	}
	setFileMetadata(filePath: string, revisionId: string, fileMetadata: FileMetadata): void {
		const fileKey = `${filePath}_rev_${revisionId}`;
		this._files.set(fileKey, fileMetadata);
	}

	getFiles(): Map<string, FileMetadata> {
		return this._files;
	}

	listFiles(): string[] {
		return Array.from(this._files.keys());
	}

	// Getters and setters
	get conversationId(): ConversationId {
		return this.id;
	}

	set conversationId(value: ConversationId) {
		this.id = value;
	}

	getSystemPromptFiles(): string[] {
		return this.systemPromptFiles;
	}

	getLastSystemPromptFile(): string {
		return this.systemPromptFiles.slice(-1)[0];
	}

	clearSystemPromptFiles(): void {
		this.systemPromptFiles = [];
	}

	// converse is called for first turn in a statement; subsequent turns call speakWithLLM
	public async converse(
		prompt: string,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		// Statement count is now incremented at the beginning of the method
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		if (this._statementCount === 0) {
			// This is the first statement in the conversation
			/*
			this.currentCommit = await this.getCurrentGitCommit();
			if (this.currentCommit) {
				prompt = `Current Git commit: ${this.currentCommit}\n\n${prompt}`;
			}
			 */
		}
		this._statementTurnCount++;

		//logger.debug(`ConversationInteraction: converse - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const messageId = this.addMessageForUserRole({ type: 'text', text: prompt });
		this.conversationLogger.logUserMessage(
			messageId,
			prompt,
			this.getConversationStats(),
		);

		logger.debug(`ConversationInteraction: converse - calling llm.speakWithRetry`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		// Update totals once per turn
		//this.updateTotals(response.messageResponse.usage, 1); // Assuming 1 provider request per converse call
		this.updateTotals(response.messageResponse.usage); // Assuming 1 provider request per converse call

		const contentPart: LLMMessageContentPart = response.messageResponse
			.answerContent[0] as LLMMessageContentPartTextBlock;

		const msg = contentPart.text;
		const conversationStats: ConversationMetrics = this.getConversationStats();
		const tokenUsageMessage: TokenUsage = response.messageResponse.usage;

		this.conversationLogger.logAssistantMessage(
			this.getLastMessageId(),
			msg,
			conversationStats,
			tokenUsageMessage,
			this._tokenUsageStatement,
			this._tokenUsageInteraction,
		);
		this._statementCount++;

		return response;
	}
}

export default LLMConversationInteraction;
