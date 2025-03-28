//import { join } from '@std/path';
import { encodeBase64 } from '@std/encoding';

import type { LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type {
	ConversationId,
	ConversationStatementMetadata,
	FileMetadata,
	FilesForConversation,
	TokenUsage,
} from 'shared/types.ts';
import LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLM from '../providers/baseLLM.ts';
import { LLMCallbackType } from 'api/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentPartImageBlockSourceMediaType,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import { isFileHandlingError } from 'api/errors/error.ts';

import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { ToolUsageStats } from '../llmToolManager.ts';
import { logger } from 'shared/logger.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';
//import { readFileContent } from 'shared/dataDir.ts';
import { ResourceManager } from 'api/llms/resourceManager.ts';
//import { GitUtils } from 'shared/git.ts';

export const BB_FILE_METADATA_DELIMITER = '---bb-file-metadata---';

export interface BBFileMetadata {
	path: string;
	type: 'text' | 'image';
	size: number;
	last_modified: string;
	revision: string;
	mime_type?: string;
}

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

	// Track the last _maxHydratedMessagesPerFile messages for each file
	private hydratedFiles = new Map<
		string,
		Array<{
			turnIndex: number;
			messageId: string;
			// Limit to 2 entries per file, with most recent first
			// [0] = most recent
			// [1] = previous (if exists)
		}>
	>();

	/**
	 * Maximum number of messages to keep per file in the hydratedFiles map.
	 * This controls how many previous versions of a file's content are maintained.
	 * Default is 2 to keep current and one previous version.
	 */
	private _maxHydratedMessagesPerFile: number = 2;

	/**
	 * Gets the maximum number of messages to keep per file in the hydratedFiles map.
	 */
	get maxHydratedMessagesPerFile(): number {
		return this._maxHydratedMessagesPerFile;
	}

	/**
	 * Sets the maximum number of messages to keep per file in the hydratedFiles map.
	 * @param value - Must be a positive integer
	 * @throws Error if value is less than 1
	 */
	set maxHydratedMessagesPerFile(value: number) {
		if (!Number.isInteger(value) || value < 1) {
			throw new Error('maxHydratedMessagesPerFile must be a positive integer');
		}
		this._maxHydratedMessagesPerFile = value;
	}

	private resourceManager!: ResourceManager;
	private toolUsageStats: ToolUsageStats = {
		toolCounts: new Map(),
		toolResults: new Map(),
		lastToolUse: '',
		lastToolSuccess: false,
	};
	private systemPromptFiles: string[] = [];
	//private currentCommit: string | null = null;

	constructor(llm: LLM, conversationId?: ConversationId) {
		super(llm, conversationId);
		this._interactionType = 'conversation';
	}

	public override async init(parentInteractionId?: ConversationId): Promise<LLMConversationInteraction> {
		await super.init(parentInteractionId);
		const projectEditor = await this.llm.invoke(LLMCallbackType.PROJECT_EDITOR);
		this.resourceManager = new ResourceManager(projectEditor);
		return this;
	}

	// these methods are really just convenience aliases for tokenUsageInteraction
	public get tokenUsageConversation(): TokenUsage {
		return this.tokenUsageInteraction;
	}
	public set tokenUsageConversation(tokenUsage: TokenUsage) {
		this.tokenUsageInteraction = tokenUsage;
	}

	public override async prepareSytemPrompt(baseSystem: string): Promise<string> {
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

	public override async prepareTools(tools: Map<string, LLMTool>): Promise<LLMTool[]> {
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

	public override async prepareMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		return await this.hydrateMessages(messages);
	}

	protected async createFileContentBlocks(
		filePath: string,
		revisionId: string,
		_turnIndex: number,
	): Promise<LLMMessageContentParts | null> {
		try {
			logger.info(
				'ConversationInteraction: createFileContentBlocks - filePath',
				filePath,
			);
			const content = await this.readProjectFileContent(filePath, revisionId);
			const fileMetadata = this.getFileMetadata(filePath, revisionId);
			if (!fileMetadata) {
				throw new Error(`File has not been added to conversation: ${filePath}`);
			}

			// Create metadata block
			const metadata: BBFileMetadata = {
				path: filePath,
				type: fileMetadata.type || 'text',
				size: fileMetadata.size,
				last_modified: (() => {
					try {
						return fileMetadata.lastModified instanceof Date
							? fileMetadata.lastModified.toISOString()
							: new Date(fileMetadata.lastModified).toISOString();
					} catch (error) {
						logger.warn(
							`Failed to convert lastModified to ISO string for ${filePath}: ${(error as Error).message}`,
						);
						return new Date().toISOString(); // Fallback to current date
					}
				})(),
				revision: revisionId,
				mime_type: fileMetadata.mimeType,
			};

			const metadataBlock: LLMMessageContentPartTextBlock = {
				type: 'text',
				text: `${BB_FILE_METADATA_DELIMITER}\n${JSON.stringify(metadata, null, 2)}`,
			};

			// For images, create image block and metadata block
			if (fileMetadata.type === 'image') {
				const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
				const mimeType = fileMetadata.mimeType || 'unknown';

				if (supportedImageTypes.includes(mimeType)) {
					const imageData = content as Uint8Array;
					const base64Data = encodeBase64(imageData);
					const imageBlock: LLMMessageContentPartImageBlock = {
						type: 'image',
						source: {
							type: 'base64',
							media_type: fileMetadata.mimeType as LLMMessageContentPartImageBlockSourceMediaType,
							data: base64Data,
						},
					};
					return [metadataBlock, imageBlock];
				} else {
					// For unsupported image types, create warning block and metadata block
					const warningBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text: `Note: Image file ${filePath} is in unsupported format (${
							mimeType === 'unknown' ? 'unknown type' : mimeType
						}). Only jpeg, png, gif, and webp formats are supported.`,
					};
					return [warningBlock, metadataBlock];
				}
			}

			// For text files, create content block and metadata block
			const contentBlock: LLMMessageContentPartTextBlock = {
				type: 'text',
				text: content as string,
			};

			return [metadataBlock, contentBlock];
		} catch (error) {
			logger.error(
				`ConversationInteraction: Error creating content blocks for ${filePath}: ${(error as Error).message}`,
			);
		}
		return null;
	}

	public async readProjectFileContent(
		filePath: string,
		revisionId: string,
	): Promise<string | Uint8Array> {
		try {
			//logger.info(`ConversationInteraction: Reading file revision from project: ${filePath}`);
			const content = await this.getFileRevision(filePath, revisionId);
			if (content === null) {
				logger.info(`ConversationInteraction: Reading contents of File ${filePath}`);
				const resource = await this.resourceManager.loadResource({
					type: 'file',
					location: filePath,
				});
				await this.storeFileRevision(filePath, revisionId, resource.content);
				return resource.content;
			}
			logger.info(`ConversationInteraction: Returning contents of File Revision ${filePath} (${revisionId})`);
			return content;
		} catch (error) {
			//logger.info(`ConversationInteraction: Error getting File from project ${filePath} (${revisionId}`, error);
			if (error instanceof Deno.errors.NotFound) {
				logger.info(
					`ConversationInteraction: File not found: ${filePath} (${revisionId}) - ${
						(error as Error).message
					}`,
				);
				return '';
			} else if (error instanceof Deno.errors.PermissionDenied) {
				logger.info(
					`ConversationInteraction: Permission denied: ${filePath} (${revisionId}) - ${
						(error as Error).message
					}`,
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
					`ConversationInteraction: getFileRevision - File not found: ${filePath} (${revisionId}) - ${
						(error as Error).message
					}`,
				);
				return null;
				// } else if (error instanceof Deno.errors.PermissionDenied) {
				// 	logger.info(
				// 		`ConversationInteraction: getFileRevision - Permission denied: ${filePath} (${revisionId}) - ${(error as Error).message}`,
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
			const lastModifiedISOString = (() => {
				try {
					return fileMetadata.lastModified instanceof Date
						? fileMetadata.lastModified.toISOString()
						: new Date(fileMetadata.lastModified).toISOString();
				} catch (error) {
					logger.warn(
						`Failed to convert lastModified to ISO string for ${filePath}: ${(error as Error).message}`,
					);
					return new Date().toISOString(); // Fallback to current date
				}
			})();
			return `<bbFile path="${filePath}" size="${fileMetadata.size}" last_modified="${lastModifiedISOString}">\n${content}\n</bbFile>`;
		} catch (error) {
			logger.error(
				`ConversationInteraction: Error creating XML string for ${filePath}: ${(error as Error).message}`,
			);
			//throw createError(ErrorType.FileHandling, `Failed to create xmlString for ${filePath}`, {
			//	filePath,
			//	operation: 'write',
			//} as FileHandlingErrorOptions);
		}
		return null;
	}

	/**
	 * Adds or updates an entry in the hydratedFiles map.
	 * @param filePath - The path of the file being hydrated
	 * @param turnIndex - The current turn number
	 * @param messageId - The message ID (revision) for this version
	 * @param maxEntries - Optional override for maxHydratedMessagesPerFile
	 */
	private addHydratedFileEntry(filePath: string, turnIndex: number, messageId: string, maxEntries?: number): void {
		logger.debug(`Adding hydrated file entry for ${filePath} - Turn: ${turnIndex}, MessageId: ${messageId}`);
		const entriesToKeep = maxEntries ?? this._maxHydratedMessagesPerFile;
		// Validate maxEntries if provided
		if (maxEntries !== undefined && (!Number.isInteger(maxEntries) || maxEntries < 1)) {
			throw new Error('maxEntries must be a positive integer');
		}
		const existingEntries = this.hydratedFiles.get(filePath) || [];
		const newEntries = [{
			turnIndex,
			messageId,
		}];

		// Add existing entries up to maxEntries - 1 (since we already added one)
		if (existingEntries.length > 0) {
			newEntries.push(...existingEntries.slice(0, entriesToKeep - 1));
		}

		this.hydratedFiles.set(filePath, newEntries);
		logger.debug(`Updated hydrated entries for ${filePath} - Total entries: ${newEntries.length}`, newEntries);
	}

	async hydrateMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		// Log the state before clearing
		logger.debug(`Starting new hydration run. Current hydrated files count: ${this.hydratedFiles.size}`);

		// Reset hydratedFiles at the start of each hydration run
		// This ensures we don't maintain state between different hydration calls
		this.hydratedFiles.clear();
		logger.debug('Cleared hydratedFiles map for new hydration run');
		// Log the state before clearing
		logger.debug(`Starting new hydration run. Current hydrated files count: ${this.hydratedFiles.size}`);

		// Reset hydratedFiles at the start of each hydration run
		// This ensures we don't maintain state between different hydration calls
		this.hydratedFiles.clear();
		logger.debug('Cleared hydratedFiles map for new hydration run');
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
				logger.debug(
					`ConversationInteraction: Hydrating content part for turn ${turnIndex}: ${
						JSON.stringify(contentPart)
					}`,
				);

				const existingEntries = this.hydratedFiles.get(filePath) || [];
				if (existingEntries.length < this._maxHydratedMessagesPerFile) {
					logger.info(
						`ConversationInteraction: Hydrating message for file: ${filePath} - Revision:(${messageId}) - Turn: ${turnIndex} - Metadata: ${
							JSON.stringify(fileMetadata)
						}`,
					);

					// Create file content blocks using the new format
					const contentBlocks = await this.createFileContentBlocks(filePath, messageId, turnIndex);
					if (!contentBlocks) {
						logger.error(
							`ConversationInteraction: Failed to create content blocks for ${filePath}`,
						);
						return contentPart;
					}

					this.addHydratedFileEntry(filePath, turnIndex, messageId);
					return contentBlocks;
				} else {
					const lastEntry = existingEntries[0]; // Most recent entry
					logger.info(
						`ConversationInteraction: Skipping hydration for file: ${filePath} (revision: ${lastEntry.messageId}) - Current Turn: ${turnIndex}, Last Hydrated Turn: ${lastEntry.turnIndex}`,
					);

					// Create metadata block for up-to-date message
					const metadata: BBFileMetadata = {
						path: filePath,
						type: fileMetadata.type || 'text',
						size: fileMetadata.size,
						last_modified: (() => {
							try {
								return fileMetadata.lastModified instanceof Date
									? fileMetadata.lastModified.toISOString()
									: new Date(fileMetadata.lastModified).toISOString();
							} catch (error) {
								logger.warn(
									`Failed to convert lastModified to ISO string for ${filePath}: ${
										(error as Error).message
									}`,
								);
								return new Date().toISOString(); // Fallback to current date
							}
						})(),
						revision: lastEntry.messageId,
						mime_type: fileMetadata.mimeType,
					};

					const metadataBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text: `${BB_FILE_METADATA_DELIMITER}\n${JSON.stringify(metadata, null, 2)}`,
					};

					const noteBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text:
							`Note: File ${filePath} (revision: ${messageId}) content is up-to-date from turn ${lastEntry.turnIndex} (revision: ${lastEntry.messageId}).`,
					};

					return [noteBlock, metadataBlock];
				}
			}
			if (
				contentPart.type === 'tool_result' && Array.isArray(contentPart.content)
			) {
				// Process each content part in the tool result
				const processedParts = await Promise.all(
					contentPart.content.map((part) => processContentPart(part, messageId, turnIndex)),
				);

				// Flatten the array and handle any nested arrays from file content blocks
				const updatedContent = processedParts.reduce((acc: LLMMessageContentPart[], part) => {
					if (Array.isArray(part)) {
						acc.push(...part);
					} else {
						acc.push(part);
					}
					return acc;
				}, []);

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
				//logger.error(`ConversationInteraction: Processing message: ${JSON.stringify(message)}`);
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
					message.conversationStats,
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
			// Convert from reversed array index to original message index
			// Example: with 10 messages (1-10):
			// i=0 (last message) → originalIndex=10 (correct turn number)
			// i=9 (first message) → originalIndex=1 (correct turn number)
			const originalIndex = reversedMessages.length - i;
			const processedMessage = await processMessage(reversedMessages[i], originalIndex);
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

	public getToolUsageStats(): ToolUsageStats {
		return this.toolUsageStats;
	}

	public override updateToolStats(toolName: string, success: boolean): void {
		// Update tool counts
		const currentCount = this.toolUsageStats.toolCounts.get(toolName) || 0;
		this.toolUsageStats.toolCounts.set(toolName, currentCount + 1);

		// Update success/failure counts
		const results = this.toolUsageStats.toolResults.get(toolName) || { success: 0, failure: 0 };
		if (success) {
			results.success++;
		} else {
			results.failure++;
		}
		this.toolUsageStats.toolResults.set(toolName, results);

		// Update last tool use
		this.toolUsageStats.lastToolUse = toolName;
		this.toolUsageStats.lastToolSuccess = success;
	}

	clearSystemPromptFiles(): void {
		this.systemPromptFiles = [];
	}

	// relayToolResult is a lower-level call, to handle tool use/results loop
	// the caller is responsible for adding to conversationLogger
	async relayToolResult(
		prompt: string,
		metadata: ConversationStatementMetadata,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMSpeakWithResponse> {
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		const contentParts: LLMMessageContentParts = [
			{
				type: 'text',
				text: `__TOOL_RESULT_METADATA__\n${JSON.stringify({ __metadata: metadata })}`,
			},
			{ type: 'text', text: prompt },
		];
		this.addMessageForUserRole(contentParts);

		//speakOptions = { model: this.projectConfig.defaultModels!.agent, ...speakOptions };
		if (!this.model) this.model = this.projectConfig.defaultModels!.agent;
		logger.debug(`BaseInteraction: relayToolResult - calling llm.speakWithRetry`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		// // these are set in updateTotals
		// this.statementTurnCount++;
		// this.conversationTurnCount++;

		// logToolUse and logToolResult are in orchestratorController

		return response;
	}

	// converse is called for first turn in a statement; subsequent turns call relayToolResult
	public async converse(
		prompt: string,
		//promptFrom: 'user' | 'orchestrator',
		parentMessageId: string|null,
		metadata: ConversationStatementMetadata,
		speakOptions?: LLMSpeakWithOptions,
		attachedFiles?: FilesForConversation,
	): Promise<LLMSpeakWithResponse> {
		// Statement count is now incremented at the beginning of the method
		if (!speakOptions) {
			speakOptions = {} as LLMSpeakWithOptions;
		}

		/*
		if (this._statementCount === 0) {
			// This is the first statement in the conversation
			this.currentCommit = await this.getCurrentGitCommit();
			if (this.currentCommit) {
				prompt = `Current Git commit: ${this.currentCommit}\n\n${prompt}`;
			}
		}
		 */

		// Check if the last message has a 'tool_use' content part
		// it means the tool use/results loop was interrupted
		const lastMessage = this.getLastMessage();
		if (
			lastMessage && lastMessage.role === 'assistant' &&
			lastMessage.content.some((part: { type: string }) => part.type === 'tool_use')
		) {
			const toolUsePart = lastMessage.content.filter((part: { type: string }) =>
				part.type === 'tool_use'
			)[0] as LLMMessageContentPartToolUseBlock;
			// Add a new message with a 'tool_result' content part
			this.addMessageForToolResult(
				toolUsePart.id,
				'Tool use was interrupted, results could not be generated. You may try again now.',
				true,
			);
			logger.warn(
				'ConversationInteraction: converse - Added generated tool_result message due to interrupted tool use',
			);
		}

		const filesToAdd = attachedFiles
			? attachedFiles.map((fileToAdd) => {
				return {
					'type': 'text',
					'text': `File added: ${fileToAdd.fileName}`,
				} as LLMMessageContentPartTextBlock;
			})
			: [];
		//logger.debug(`ConversationInteraction: converse - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const contentParts: LLMMessageContentParts = [
			{
				type: 'text',
				text: `__STATEMENT_METADATA__\n${JSON.stringify({ __metadata: metadata })}`,
			},
			...filesToAdd,
			{ type: 'text', text: prompt },
		];
		const messageId = this.addMessageForUserRole(contentParts);

		//if (promptFrom === 'orchestrator') {
		if (parentMessageId) {
			this.conversationLogger.logOrchestratorMessage(
				messageId,
				parentMessageId,
				this.id,
				prompt,
				this.conversationStats,
			);
		} else {
			this.conversationLogger.logUserMessage(
				messageId,
				prompt,
				this.conversationStats,
			);
		}

		// Add files to conversation if preparation succeeded
		if (attachedFiles && attachedFiles.length > 0) {
			this.addFilesForMessage(
				attachedFiles,
				messageId,
			);
		}

		//speakOptions = { model: this.projectConfig.defaultModels!.agent, ...speakOptions };
		if (!this.model) this.model = this.projectConfig.defaultModels!.agent;
		logger.debug(`ConversationInteraction: converse - calling llm.speakWithRetry`);
		const response = await this.llm.speakWithRetry(this, speakOptions);

		this.statementCount++;
		this.statementTurnCount = 0;
		// // these are set in updateTotals
		// this.statementTurnCount++;
		// this.conversationTurnCount++;

		// logAssistantMessage is in orchestratorController

		this._statementCount++;

		return response;
	}
}

export default LLMConversationInteraction;
