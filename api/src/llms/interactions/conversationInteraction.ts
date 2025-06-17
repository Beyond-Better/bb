import { encodeBase64 } from '@std/encoding';

import type { LLMCallbacks, LLMSpeakWithOptions, LLMSpeakWithResponse } from 'api/types.ts';
import type { ConversationId, ConversationStatementMetadata, TokenUsage } from 'shared/types.ts';
import { DefaultModelsConfigDefaults } from 'shared/types/models.ts';
import LLMInteraction from 'api/llms/baseInteraction.ts';
import { LLMCallbackType } from 'api/types.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentPartImageBlockSourceMediaType,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import { isResourceHandlingError } from 'api/errors/error.ts';
import { errorMessage } from 'shared/error.ts';

import LLMMessage from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { ToolUsageStats } from '../llmToolManager.ts';
import { logger } from 'shared/logger.ts';
//import { extractTextFromContent } from 'api/utils/llms.ts';
//import { readFileContent } from 'shared/dataDir.ts';
import { generateResourceRevisionKey } from 'shared/dataSource.ts';
import type ProjectPersistence from 'api/storage/projectPersistence.ts';
import type {
	ResourceForConversation,
	//ResourceManager,
	ResourceMetadata,
	ResourceRevisionMetadata,
	ResourcesForConversation,
} from 'shared/types/dataSourceResource.ts';
import type { ResourceType } from 'api/types.ts';
//import { GitUtils } from 'shared/git.ts';

export const BB_RESOURCE_METADATA_DELIMITER = '---bb-resource-metadata---';

export interface BBResourceMetadata {
	uri: string;
	type: ResourceType;
	contentType: 'text' | 'image';
	size?: number;
	last_modified?: string;
	revision: string;
	mime_type?: string;
}

export type { ResourceMetadata };
export interface ProjectInfo {
	//type: 'empty' | 'ctags' | 'file-listing';
	type: 'empty' | 'datasources' | 'metadata';
	content: string;
	//tier: number | null;
}

// const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];
// function isImageFile(resourceName: string): boolean {
// 	const ext = resourceName.toLowerCase().split('.').pop();
// 	return imageExtensions.includes(`.${ext}`);
// }

class LLMConversationInteraction extends LLMInteraction {
	private _resources: Map<string, ResourceRevisionMetadata> = new Map();

	// Track the last _maxHydratedMessagesPerResource messages for each resource
	private hydratedResources = new Map<
		string,
		Array<{
			turnIndex: number;
			messageId: string;
			// Limit to 2 entries per resource, with most recent first
			// [0] = most recent
			// [1] = previous (if exists)
		}>
	>();

	/**
	 * Maximum number of messages to keep per resource in the hydratedResources map.
	 * This controls how many previous versions of a resource's content are maintained.
	 * Default is 2 to keep current and one previous version.
	 */
	private _maxHydratedMessagesPerResource: number = 2;

	/**
	 * Gets the maximum number of messages to keep per resource in the hydratedResources map.
	 */
	get maxHydratedMessagesPerResource(): number {
		return this._maxHydratedMessagesPerResource;
	}

	/**
	 * Sets the maximum number of messages to keep per resource in the hydratedResources map.
	 * @param value - Must be a positive integer
	 * @throws Error if value is less than 1
	 */
	set maxHydratedMessagesPerResource(value: number) {
		if (!Number.isInteger(value) || value < 1) {
			throw new Error('maxHydratedMessagesPerResource must be a positive integer');
		}
		this._maxHydratedMessagesPerResource = value;
	}

	//private resourceManager!: ResourceManager;
	private projectData!: ProjectPersistence;
	private toolUsageStats: ToolUsageStats = {
		toolCounts: new Map(),
		toolResults: new Map(),
		lastToolUse: '',
		lastToolSuccess: false,
	};
	//private currentCommit: string | null = null;

	constructor(conversationId?: ConversationId) {
		super(conversationId);
		this._interactionType = 'conversation';
	}

	public override async init(
		interactionModel: string,
		interactionCallbacks: LLMCallbacks,
		parentInteractionId?: ConversationId,
	): Promise<LLMConversationInteraction> {
		await super.init(interactionModel, interactionCallbacks, parentInteractionId);
		const projectEditor = await this.llm.invoke(LLMCallbackType.PROJECT_EDITOR);
		//this.resourceManager = projectEditor.resourceManager;
		this.projectData = projectEditor.projectData;
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

			// We're not currently adding resources to system prompt, only in messages
			//preparedSystemPrompt = await this.appendResourcesToSystem(preparedSystemPrompt);

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
				'ConversationPersistence not initialized',
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

	protected async createResourceContentBlocks(
		resourceUri: string,
		revisionId: string,
		_turnIndex: number,
	): Promise<LLMMessageContentParts | null> {
		try {
			logger.info(
				`ConversationInteraction: createResourceContentBlocks - resourceUri: ${resourceUri} [${revisionId}]`,
			);
			const resourceMetadata = this.getResourceRevisionMetadata(
				generateResourceRevisionKey(resourceUri, revisionId),
			);
			const content = await this.readResourceContent(resourceUri, revisionId);
			if (!resourceMetadata || !content) {
				throw new Error(`Resource has not been added to conversation: ${resourceUri}`);
			}

			// Create metadata block
			const metadata: BBResourceMetadata = {
				uri: resourceUri,
				type: resourceMetadata.type || 'text',
				contentType: 'text',
				size: resourceMetadata.size || 0,
				last_modified: (() => {
					try {
						return resourceMetadata.lastModified instanceof Date
							? resourceMetadata.lastModified.toISOString()
							: resourceMetadata.lastModified
							? new Date(resourceMetadata.lastModified).toISOString()
							: undefined;
					} catch (error) {
						logger.warn(
							`Failed to convert lastModified to ISO string for ${resourceUri}: ${errorMessage(error)}`,
						);
						return new Date().toISOString(); // Fallback to current date
					}
				})(),
				revision: revisionId,
				mime_type: resourceMetadata.mimeType,
			};

			const metadataBlock: LLMMessageContentPartTextBlock = {
				type: 'text',
				text: `${BB_RESOURCE_METADATA_DELIMITER}\n${JSON.stringify(metadata, null, 2)}`,
			};

			// For images, create image block and metadata block
			if (resourceMetadata.contentType === 'image') {
				const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
				const mimeType = resourceMetadata.mimeType || 'unknown';

				if (supportedImageTypes.includes(mimeType)) {
					const imageData = content as Uint8Array;
					const base64Data = encodeBase64(imageData);
					const imageBlock: LLMMessageContentPartImageBlock = {
						type: 'image',
						source: {
							type: 'base64',
							media_type: resourceMetadata.mimeType as LLMMessageContentPartImageBlockSourceMediaType,
							data: base64Data,
						},
					};
					return [metadataBlock, imageBlock];
				} else {
					// For unsupported image types, create warning block and metadata block
					const warningBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text: `Note: Image resource ${resourceUri} is in unsupported format (${
							mimeType === 'unknown' ? 'unknown type' : mimeType
						}). Only jpeg, png, gif, and webp formats are supported.`,
					};
					return [warningBlock, metadataBlock];
				}
			}

			// For text resources, create content block and metadata block
			const contentBlock: LLMMessageContentPartTextBlock = {
				type: 'text',
				text: content as string,
			};

			return [metadataBlock, contentBlock];
		} catch (error) {
			logger.error(
				`ConversationInteraction: Error creating content blocks for ${resourceUri}: ${errorMessage(error)}`,
			);
		}
		return null;
	}

	public async readResourceContent(
		resourceUri: string,
		revisionId: string,
		//_resourceMetadata: ResourceRevisionMetadata,
	): Promise<string | Uint8Array> {
		try {
			//logger.info(`ConversationInteraction: Reading resource revision from project: ${resourceUri}`);
			const content = await this.getResourceRevision(resourceUri, revisionId);
			if (content === null) {
				logger.info(`ConversationInteraction: Reading contents of Resource ${resourceUri}`);
				const resource = await this.projectData.getProjectResource(resourceUri);
				if (!resource) {
					throw new Error(`Resource could not be loaded for: ${resourceUri}`);
				}
				await this.storeResourceRevision(resourceUri, revisionId, resource.content);
				return resource.content;
			}
			logger.info(
				`ConversationInteraction: Returning contents of Resource Revision ${resourceUri} (${revisionId})`,
			);
			return content;
		} catch (error) {
			//logger.info(`ConversationInteraction: Error getting Resource from project ${resourceUri} (${revisionId}`, error);
			if (error instanceof Deno.errors.NotFound) {
				logger.info(
					`ConversationInteraction: Resource not found: ${resourceUri} (${revisionId}) - ${
						errorMessage(error)
					}`,
				);
				return '';
			} else if (error instanceof Deno.errors.PermissionDenied) {
				logger.info(
					`ConversationInteraction: Permission denied: ${resourceUri} (${revisionId}) - ${
						errorMessage(error)
					}`,
				);
				return '';
			} else {
				throw new Error(`Failed to read resource: ${resourceUri} (${revisionId}) - Error: ${error}`);
			}
		}
	}

	async storeResourceRevision(resourceUri: string, revisionId: string, content: string | Uint8Array): Promise<void> {
		logger.info(`ConversationInteraction: Storing resource revision: ${resourceUri} Revision: (${revisionId})`);
		await this.conversationPersistence.storeResourceRevision(resourceUri, revisionId, content);
	}

	async getResourceRevision(resourceUri: string, revisionId: string): Promise<string | Uint8Array | null> {
		logger.info(`ConversationInteraction: Getting resource revision: ${resourceUri} Revision: (${revisionId})`);
		try {
			const content = await this.conversationPersistence.getResourceRevision(resourceUri, revisionId);
			return content;
		} catch (error) {
			logger.info(
				`ConversationInteraction: getResourceRevision - Resource not found: ${resourceUri} (${revisionId}) - ${
					errorMessage(error)
				}`,
			);
			if (error instanceof Deno.errors.NotFound || isResourceHandlingError(error)) {
				return null;
				// } else if (error instanceof Deno.errors.PermissionDenied) {
				// 	logger.info(
				// 		`ConversationInteraction: getResourceRevision - Permission denied: ${resourceUri} (${revisionId}) - ${errorMessage(error)}`,
				// 	);
				// 	return null;
			} else {
				throw new Error(`Failed to read resource revision: ${resourceUri} (${revisionId}) - Error: ${error}`);
			}
		}
	}

	protected appendProjectInfoToSystem(
		system: string,
		projectInfo: ProjectInfo,
	): string {
		system += `\n\n<project-details>\n${projectInfo.content}\n</project-details>`;
		return system;
	}

	protected async createResourceXmlString(
		resourceUri: string,
		revisionId: string,
	): Promise<string | null> {
		try {
			logger.info(
				'ConversationInteraction: createResourceXmlString - resourceUri',
				resourceUri,
			);
			const resourceMetadata = this.getResourceRevisionMetadata(
				generateResourceRevisionKey(resourceUri, revisionId),
			);
			const content = await this.readResourceContent(resourceUri, revisionId);
			if (!resourceMetadata || !content) {
				throw new Error(`Resource has not been added to conversation: ${resourceUri}`);
			}
			const lastModifiedISOString = (() => {
				try {
					return resourceMetadata.lastModified instanceof Date
						? resourceMetadata.lastModified.toISOString()
						: new Date(resourceMetadata.lastModified).toISOString();
				} catch (error) {
					logger.warn(
						`Failed to convert lastModified to ISO string for ${resourceUri}: ${errorMessage(error)}`,
					);
					return new Date().toISOString(); // Fallback to current date
				}
			})();
			return `<bbResource uri="${resourceUri}" size="${resourceMetadata.size}" last_modified="${lastModifiedISOString}">\n${content}\n</bbResource>`;
		} catch (error) {
			logger.error(
				`ConversationInteraction: Error creating XML string for ${resourceUri}: ${errorMessage(error)}`,
			);
			//throw createError(ErrorType.ResourceHandling, `Failed to create xmlString for ${resourceUri}`, {
			//	resourceUri,
			//	operation: 'write',
			//} as ResourceHandlingErrorOptions);
		}
		return null;
	}

	/**
	 * Adds or updates an entry in the hydratedResources map.
	 * @param resourceUri - The uri of the resource being hydrated
	 * @param turnIndex - The current turn number
	 * @param messageId - The message ID (revision) for this version
	 * @param maxEntries - Optional override for maxHydratedMessagesPerResource
	 */
	private addHydratedResourceEntry(
		resourceUri: string,
		turnIndex: number,
		messageId: string,
		maxEntries?: number,
	): void {
		logger.debug(
			`Adding hydrated resource entry for ${resourceUri} - Turn: ${turnIndex}, MessageId: ${messageId}`,
		);
		const entriesToKeep = maxEntries ?? this._maxHydratedMessagesPerResource;
		// Validate maxEntries if provided
		if (maxEntries !== undefined && (!Number.isInteger(maxEntries) || maxEntries < 1)) {
			throw new Error('maxEntries must be a positive integer');
		}
		const existingEntries = this.hydratedResources.get(resourceUri) || [];
		const newEntries = [{
			turnIndex,
			messageId,
		}];

		// Add existing entries up to maxEntries - 1 (since we already added one)
		if (existingEntries.length > 0) {
			newEntries.push(...existingEntries.slice(0, entriesToKeep - 1));
		}

		this.hydratedResources.set(resourceUri, newEntries);
		logger.debug(`Updated hydrated entries for ${resourceUri} - Total entries: ${newEntries.length}`, newEntries);
	}

	async hydrateMessages(messages: LLMMessage[]): Promise<LLMMessage[]> {
		// Log the state before clearing
		logger.debug(`Starting new hydration run. Current hydrated resources count: ${this.hydratedResources.size}`);

		// Reset hydratedResources at the start of each hydration run
		// This ensures we don't maintain state between different hydration calls
		this.hydratedResources.clear();
		logger.debug('Cleared hydratedResources map for new hydration run');
		// Log the state before clearing
		logger.debug(`Starting new hydration run. Current hydrated resources count: ${this.hydratedResources.size}`);

		// Reset hydratedResources at the start of each hydration run
		// This ensures we don't maintain state between different hydration calls
		this.hydratedResources.clear();
		logger.debug('Cleared hydratedResources map for new hydration run');
		const processContentPart = async (
			contentPart: LLMMessageContentPart,
			messageId: string,
			turnIndex: number,
		): Promise<LLMMessageContentPart | LLMMessageContentParts> => {
			if (
				contentPart.type === 'text' &&
				contentPart.text.startsWith('Resource added: ')
			) {
				const resourceUri = contentPart.text.split(': ')[1].trim().replace(/^<|>$/g, '');
				logger.warn(`ConversationInteraction: Hydrating content for ${resourceUri}`);
				const resourceMetadata = this.getResourceRevisionMetadata(
					generateResourceRevisionKey(resourceUri, messageId),
				);
				if (!resourceMetadata) {
					logger.warn(
						`ConversationInteraction: Resource metadata not found for ${resourceUri} Revision:(${messageId})`,
					);
					return contentPart;
				}
				logger.debug(
					`ConversationInteraction: Hydrating content part for turn ${turnIndex}: ${
						JSON.stringify(contentPart)
					}`,
				);

				const existingEntries = this.hydratedResources.get(resourceUri) || [];
				if (existingEntries.length < this._maxHydratedMessagesPerResource) {
					logger.info(
						`ConversationInteraction: Hydrating message for resource: ${resourceUri} - Revision:(${messageId}) - Turn: ${turnIndex} - Metadata: ${
							JSON.stringify(resourceMetadata)
						}`,
					);

					// Create resource content blocks using the new format
					const contentBlocks = await this.createResourceContentBlocks(resourceUri, messageId, turnIndex);
					if (!contentBlocks) {
						logger.error(
							`ConversationInteraction: Failed to create content blocks for ${resourceUri}`,
						);
						return contentPart;
					}

					this.addHydratedResourceEntry(resourceUri, turnIndex, messageId);
					return contentBlocks;
				} else {
					const lastEntry = existingEntries[0]; // Most recent entry
					logger.info(
						`ConversationInteraction: Skipping hydration for resource: ${resourceUri} (revision: ${lastEntry.messageId}) - Current Turn: ${turnIndex}, Last Hydrated Turn: ${lastEntry.turnIndex}`,
					);

					// Create metadata block for up-to-date message
					const metadata: BBResourceMetadata = {
						uri: resourceUri,
						type: resourceMetadata.type,
						contentType: resourceMetadata.mimeType?.startsWith('image/') ? 'image' : 'text',
						size: resourceMetadata.size,
						last_modified: (() => {
							try {
								return resourceMetadata.lastModified instanceof Date
									? resourceMetadata.lastModified.toISOString()
									: new Date(resourceMetadata.lastModified).toISOString();
							} catch (error) {
								logger.warn(
									`Failed to convert lastModified to ISO string for ${resourceUri}: ${
										errorMessage(error)
									}`,
								);
								return new Date().toISOString(); // Fallback to current date
							}
						})(),
						revision: lastEntry.messageId,
						mime_type: resourceMetadata.mimeType,
					};

					const metadataBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text: `${BB_RESOURCE_METADATA_DELIMITER}\n${JSON.stringify(metadata, null, 2)}`,
					};

					const noteBlock: LLMMessageContentPartTextBlock = {
						type: 'text',
						text:
							`Note: Resource ${resourceUri} (revision: ${messageId}) content is up-to-date from turn ${lastEntry.turnIndex} (revision: ${lastEntry.messageId}).`,
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

				// Flatten the array and handle any nested arrays from resource content blocks
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

	addResourceForMessage(
		resourceUri: string,
		metadata: Omit<ResourceRevisionMetadata, 'uri'>,
		messageId: string,
		toolUseId?: string,
	): { resourceUri: string; resourceMetadata: ResourceRevisionMetadata } {
		const resourceMetadata: ResourceRevisionMetadata = {
			...metadata,
			uri: resourceUri,
			messageId,
			toolUseId,
		} as ResourceRevisionMetadata;

		if (!resourceMetadata.error) {
			this.setResourceRevisionMetadata(generateResourceRevisionKey(resourceUri, messageId), resourceMetadata);
		}
		return { resourceUri, resourceMetadata };
	}

	addResourcesForMessage(
		resourcesToAdd: ResourcesForConversation,
		messageId: string,
		toolUseId?: string,
	): Array<{ resourceUri: string; resourceMetadata: ResourceRevisionMetadata }> {
		const conversationResources = [];

		for (const resourceToAdd of resourcesToAdd) {
			const resourceUri = resourceToAdd.resourceUri;
			const resourceMetadata: ResourceRevisionMetadata = {
				...resourceToAdd.metadata,
				uri: resourceUri,
				messageId,
				toolUseId,
			} as ResourceRevisionMetadata;
			conversationResources.push({
				resourceUri,
				resourceMetadata,
			});
		}

		// [CNG] why is this a separate loop - I suspect it's a Claude artefact - don't change it without testing just to be safe
		for (const resourceToAdd of conversationResources) {
			if (!resourceToAdd.resourceMetadata.error) {
				this.setResourceRevisionMetadata(
					generateResourceRevisionKey(resourceToAdd.resourceUri, messageId),
					resourceToAdd.resourceMetadata,
				);
			}
		}
		return conversationResources;
	}

	removeResource(resourceRevisionKey: string): boolean {
		const resourceMetadata = this.getResourceRevisionMetadata(resourceRevisionKey);
		if (resourceMetadata) {
			if (resourceMetadata.messageId) {
				this.messages = this.messages.filter((message) => message.id !== resourceMetadata.messageId);
			}

			return this._resources.delete(resourceRevisionKey);
		}
		return false;
	}
	getResourceRevisionMetadata(resourceRevisionKey: string): ResourceRevisionMetadata | undefined {
		return this._resources.get(resourceRevisionKey);
	}
	setResourceRevisionMetadata(resourceRevisionKey: string, resourceMetadata: ResourceRevisionMetadata): void {
		this._resources.set(resourceRevisionKey, resourceMetadata);
	}

	getResources(): Map<string, ResourceRevisionMetadata> {
		return this._resources;
	}

	listResources(): string[] {
		return Array.from(this._resources.keys());
	}

	// Getters and setters
	get conversationId(): ConversationId {
		return this.id;
	}

	set conversationId(value: ConversationId) {
		this.id = value;
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

	// relayToolResult is a lower-level call, to handle tool use/results loop
	// the caller is responsible for adding to collaborationLogger
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
		if (speakOptions.model) this.model = speakOptions.model;
		if (!this.model) this.model = this.projectConfig.defaultModels!.agent || DefaultModelsConfigDefaults.agent;
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
		parentMessageId: string | null,
		metadata: ConversationStatementMetadata,
		speakOptions?: LLMSpeakWithOptions,
		attachedResources?: ResourcesForConversation,
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

		// Safety limit: max 20 files per message
		const MAX_FILES_PER_MESSAGE = 20;
		const limitedAttachedResources = attachedResources?.slice(0, MAX_FILES_PER_MESSAGE);

		// Inject file references into the prompt for chat history
		let modifiedPrompt = prompt;
		if (limitedAttachedResources && limitedAttachedResources.length > 0) {
			let fileReferences = limitedAttachedResources.map((resourceToAdd: ResourceForConversation) => {
				// Extract resourceId from uploads URI
				const resourceUri = resourceToAdd.resourceUri;
				if (resourceUri.startsWith('bb+filesystem+__uploads+file:./')) {
					const resourceId = resourceUri.replace('bb+filesystem+__uploads+file:./', '');
					const metadata = resourceToAdd.metadata;

					if (metadata.mimeType?.startsWith('image/')) {
						// For images, use image markdown syntax
						return `![${metadata.name || 'Attached Image'}](bb+filesystem+uploads+file:./${resourceId})`;
					} else {
						// For other files, use link markdown syntax
						return `[${metadata.name || 'Attached File'}](bb+filesystem+uploads+file:./${resourceId})`;
					}
				}
				return `[${resourceToAdd.metadata.name || 'Attached File'}](${resourceUri})`;
			}).join('\n');

			if (attachedResources && attachedResources.length > MAX_FILES_PER_MESSAGE) {
				fileReferences += `\n\n*Note: Only the first ${MAX_FILES_PER_MESSAGE} files are shown above. ${
					attachedResources.length - MAX_FILES_PER_MESSAGE
				} additional files were attached but not displayed.*`;
			}

			modifiedPrompt = `${prompt}\n\n${fileReferences}`;
		}

		const resourcesToAdd = limitedAttachedResources
			? limitedAttachedResources.map((resourceToAdd: ResourceForConversation) => {
				return {
					'type': 'text',
					'text': `Resource added: <${resourceToAdd.resourceUri}>`,
				} as LLMMessageContentPartTextBlock;
			})
			: [];
		//logger.debug(`ConversationInteraction: converse - calling addMessageForUserRole for turn ${this._statementTurnCount}` );
		const contentParts: LLMMessageContentParts = [
			{
				type: 'text',
				text: `__STATEMENT_METADATA__\n${JSON.stringify({ __metadata: metadata })}`,
			},
			...resourcesToAdd,
			{ type: 'text', text: prompt },
		];
		const messageId = this.addMessageForUserRole(contentParts);

		//if (promptFrom === 'orchestrator') {
		if (parentMessageId) {
			this.collaborationLogger.logOrchestratorMessage(
				messageId,
				parentMessageId,
				this.id,
				modifiedPrompt,
				this.conversationStats,
			);
		} else {
			this.collaborationLogger.logUserMessage(
				messageId,
				modifiedPrompt,
				this.conversationStats,
			);
		}

		// Add resources to conversation if preparation succeeded
		if (attachedResources && attachedResources.length > 0) {
			this.addResourcesForMessage(
				attachedResources,
				messageId,
			);
		}

		//logger.info(`ConversationInteraction: converse - using model`, {thisModel: this.model, defaultModelsAgent: this.projectConfig.defaultModels!.agent});
		//speakOptions = { model: this.projectConfig.defaultModels!.agent, ...speakOptions };
		if (speakOptions.model) this.model = speakOptions.model;
		if (!this.model) this.model = this.projectConfig.defaultModels!.agent || DefaultModelsConfigDefaults.agent;
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
