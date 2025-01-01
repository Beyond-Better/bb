import { createClient, type SupabaseClient } from '@supabase/supabase-js';
//import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

import { AnthropicModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import { BB_FILE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
} from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import type { BBLLMResponse } from 'api/types/llms.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

type LLMMessageContentPartOrString =
	| string
	| LLMMessageContentPart;
// type LLMMessageContentPartOrArray =
// 	| string
// 	| LLMMessageContentPart
// 	| Array<
// 		| LLMMessageContentPart
// 	>;
class BbLLM extends LLM {
	private supabase!: SupabaseClient<any, 'public', any>;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);

		this.llmProviderName = LLMProvider.ANTHROPIC;

		this.initializeBBClient();
	}

	private initializeBBClient() {
		this.supabase = createClient(
			Deno.env.get('SUPABASE_URL') ?? '',
			Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
			// { global: { headers: { Authorization: authHeader } } },
			// { auth: { persistSession: false } }
		);
	}

	// Helper function to check for file metadata blocks
	private hasFileMetadata(text: string): boolean {
		try {
			return text.includes(BB_FILE_METADATA_DELIMITER);
		} catch (_e) {
			return false;
		}
	}

	private logMessageDetails(messages: LLMMessage[]): void {
		logger.info('BbLLM: Message Details for LLM Request:');

		const messagesWithCache: number[] = [];
		const messagesWithFiles: number[] = [];

		messages.forEach((message, index) => {
			const contentParts: LLMMessageContentPartOrString[] = Array.isArray(message.content)
				? message.content
				: [message.content];
			const summary: string[] = [];

			const processContent = (part: LLMMessageContentPartOrString, depth: number = 0): void => {
				const indent = '  '.repeat(depth);

				if (typeof part === 'string') {
					summary.push(`${indent}Content: plain text (no metadata or cache_control possible)`);
					return;
				}

				// Log the type of this part
				summary.push(`${indent}Type: ${part.type}`);

				// For tool_result, process its nested content
				if (part.type === 'tool_result' && Array.isArray(part.content)) {
					summary.push(`${indent}Tool Use ID: ${part.tool_use_id || 'none'}`);
					summary.push(`${indent}Is Error: ${part.is_error || false}`);

					// Check if any nested content has file content
					const fileContentParts = part.content.filter((nestedPart: LLMMessageContentPart) =>
						nestedPart.type === 'text' &&
						typeof nestedPart.text === 'string' &&
						(this.hasFileMetadata(nestedPart.text) ||
							(nestedPart.text.startsWith('Note: File') &&
								nestedPart.text.includes('is up-to-date')))
					);
					if (fileContentParts.length > 0) {
						summary.push(`${indent}Files in this tool_result:`);
						fileContentParts.forEach((p: LLMMessageContentPart) => {
							if (p.type === 'text' && typeof p.text === 'string') {
								if (p.text.startsWith('Note: File')) {
									const match = p.text.match(
										/Note: File (.*?) \(revision: (\w+)\) content is up-to-date from turn (\d+) \(revision: (\w+)\)/,
									);
									if (match) {
										summary.push(
											`${indent}  - ${match[1]} with revision ${match[2]} (current from turn ${
												match[3]
											} with revision ${match[4]})`,
										);
									}
								} else if (this.hasFileMetadata(p.text)) {
									try {
										const metadataText = p.text.split(BB_FILE_METADATA_DELIMITER)[1].trim();
										const metadata = JSON.parse(metadataText);
										summary.push(
											`${indent}  - ${metadata.path} (${metadata.type}) [revision: ${metadata.revision}]`,
										);
										summary.push(`${indent}    Size: ${metadata.size} bytes`);
										summary.push(`${indent}    Last Modified: ${metadata.last_modified}`);
										if (metadata.mime_type) {
											summary.push(`${indent}    MIME Type: ${metadata.mime_type}`);
										}
									} catch (e) {
										summary.push(
											`${indent}  - Error parsing file metadata: ${(e as Error).message}`,
										);
									}
								}
							} else {
								logger.error(`content part is not type text: ${p.type}`);
							}
						});
						messagesWithFiles.push(index + 1);
					}

					summary.push(`${indent}Nested Content:`);
					part.content.forEach((nestedPart: LLMMessageContentPartOrString, nestedIndex: number) => {
						summary.push(`${indent}  Content Part ${nestedIndex + 1}:`);
						processContent(nestedPart, depth + 2);
					});
					return;
				}

				// Process text content
				if ('text' in part && typeof part.text === 'string') {
					const hasFileContent = this.hasFileMetadata(part.text);
					const hasFileNote = part.text.startsWith('Note: File') &&
						part.text.includes('content is up-to-date from turn');

					if (hasFileContent) {
						try {
							const metadataText = part.text.split(BB_FILE_METADATA_DELIMITER)[1].trim();
							const metadata = JSON.parse(metadataText);
							summary.push(
								`${indent}File: ${metadata.path} (${metadata.type}) [revision: ${metadata.revision}]`,
							);
							summary.push(`${indent}Size: ${metadata.size} bytes`);
							summary.push(`${indent}Last Modified: ${metadata.last_modified}`);
							if (metadata.mime_type) {
								summary.push(`${indent}MIME Type: ${metadata.mime_type}`);
							}
						} catch (e) {
							summary.push(`${indent}Error parsing file metadata: ${(e as Error).message}`);
						}
					} else if (hasFileNote) {
						const match = part.text.match(
							/Note: File (.*?) \(revision: (\w+)\) content is up-to-date from turn (\d+) \(revision: (\w+)\)/,
						);
						if (match) {
							summary.push(
								`${indent}File: ${match[1]} with revision ${match[2]} (current from turn ${
									match[3]
								} with revision ${match[4]})`,
							);
						}
					} else {
						summary.push(`${indent}No file metadata found`);
					}
				}
			};

			summary.push(`\nMessage ${index + 1}:`);
			summary.push(`Role: ${message.role}`);
			summary.push(`Content Parts: ${contentParts.length}`);

			contentParts.forEach((part, partIndex) => {
				summary.push(`\n  Content Part ${partIndex + 1}:`);
				processContent(part, 1);
			});

			logger.info(summary.join('\n'));
		});

		logger.info(`\nMessages with files: ${messagesWithFiles.join(', ')}`);
		logger.info(`Messages with cache_control: ${messagesWithCache.join(', ')}`);
	}

	private asProviderMessageType(
		messages: LLMMessage[],
	): LLMMessage[] {
		return messages;
	}

	private asProviderToolType(tools: LLMTool[]): LLMTool[] {
		return tools;
	}

	override async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<LLMProviderMessageRequest> {
		//logger.debug('BbLLM: llms-anthropic-prepareMessageParams-systemPrompt', interaction.baseSystem);
		const systemPrompt = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
			interaction.id,
		);

		//logger.debug('BbLLM: llms-anthropic-prepareMessageParams-tools', interaction.allTools());
		const tools = this.asProviderToolType(
			await this.invoke(
				LLMCallbackType.PREPARE_TOOLS,
				speakOptions?.tools || interaction.allTools(),
				interaction.id,
			),
		);

		const messages = this.asProviderMessageType(
			await this.invoke(
				LLMCallbackType.PREPARE_MESSAGES,
				speakOptions?.messages || interaction.getMessages(),
				interaction.id,
			),
		);
		// Log detailed message information
		if (this.projectConfig.settings.api?.logFileHydration ?? false) this.logMessageDetails(messages);

		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
			logger.error('BbLLM: maxTokens missing from both speakOptions and interaction');
		}
		if (!speakOptions?.temperature && !interaction.temperature) {
			logger.error('BbLLM: temperature missing from both speakOptions and interaction');
		}

		const model: string = speakOptions?.model || interaction.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens || 8192;
		const temperature: number = speakOptions?.temperature || interaction.temperature || 0.2;
		const usePromptCaching = this.projectConfig.settings.api?.usePromptCaching ?? true;

		const messageParams: LLMProviderMessageRequest = {
			messages,
			system: systemPrompt,
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			usePromptCaching,
		};
		//logger.debug('BbLLM: llms-anthropic-prepareMessageParams', messageParams);
		//logger.dir(messageParams);

		return messageParams;
	}

	/**
	 * Run BB service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from BB or an error
	 */
	public override async speakWith(
		messageParams: LLMProviderMessageRequest,
		_interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.dir(messageParams);

			//const { data, error } : {data:BBLLMResponse ; error: FunctionsHttpError, FunctionsRelayError, FunctionsFetchError} = await this.supabase.functions.invoke('llm-proxy', {
			const { data, error } = await this.supabase.functions.invoke('llm-proxy', {
				body: messageParams,
			});
			logger.info('BbLLM: llms-bb-data', data);
			logger.info('BbLLM: llms-bb-error', error);
			const bbResponseMessage = data as BBLLMResponse;
			//if (this.projectConfig.settings.api?.logLevel === 'debug1') {
			//	interaction.conversationPersistence.writeLLMRequest({
			//		messageId: bbResponseMessage.metadata.requestId,
			//		requestBody: messageParams,
			//		requestHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
			//		responseMessage: bbResponseMessage,
			//	});
			//}

			const messageResponse: LLMProviderMessageResponse = {
				id: bbResponseMessage.metadata.requestId,
				type: bbResponseMessage.metadata.type,
				role: bbResponseMessage.metadata.role,
				model: bbResponseMessage.metadata.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: bbResponseMessage.content as LLMMessageContentParts,
				answer: extractTextFromContent(bbResponseMessage.content as LLMMessageContentParts), // answer will get overridden in baseLLM - but this keeps type checking happy
				isTool: bbResponseMessage.metadata.stopReason === 'tool_use',
				messageStop: {
					stopReason: bbResponseMessage.metadata.stopReason,
					stopSequence: bbResponseMessage.metadata.stopSequence,
				},
				usage: {
					inputTokens: bbResponseMessage.usage.inputTokens,
					outputTokens: bbResponseMessage.usage.outputTokens,
					totalTokens: (bbResponseMessage.usage.inputTokens + bbResponseMessage.usage.outputTokens),
					cacheCreationInputTokens: bbResponseMessage.usage.cacheCreationInputTokens || 0,
					cacheReadInputTokens: bbResponseMessage.usage.cacheReadInputTokens || 0,
				},
				rateLimit: bbResponseMessage.rateLimit,
				providerMessageResponseMeta: bbResponseMessage.responseStatus,
			};
			logger.debug(`BbLLM: provider[${this.llmProviderName}] Created message response:`, {
				id: messageResponse.id,
				type: messageResponse.type,
				contentLength: messageResponse.answerContent.length,
			});
			//logger.debug("BbLLM: llms-anthropic-messageResponse", messageResponse);

			return { messageResponse, messageMeta: { system: messageParams.system } };
		} catch (err) {
			logger.error('BbLLM: Error calling BB API', err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from BB API: ${(err as Error).message}`,
				{
					model: messageParams.model,
					provider: this.llmProviderName,
				} as LLMErrorOptions,
			);
		}
	}

	protected override modifySpeakWithInteractionOptions(
		interaction: LLMInteraction,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		// // [TODO] impelement keep speaking
		// // check stop reason, if it was max_tokens, then keep speaking
		// this.checkStopReason(prevMessage.providerResponse);

		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
				interaction.addMessageForToolResult(
					prevMessage.providerResponse.toolsUsed![0].toolUseId,
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					true,
				);
			} else {
				logger.warn(
					`BbLLM: provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
		} else if (validationFailedReason === 'Tool exceeded max tokens') {
			// Prompt the model to provide a smaller tool input
			interaction.addMessageForUserRole({
				'type': 'text',
				'text':
					'The previous tool input was too large. Please provide a smaller answer, and I will keep asking for more until I have all of it',
			} as LLMMessageContentPartTextBlock);
		} else if (validationFailedReason === 'Empty answer') {
			// Increase temperature or adjust other parameters to encourage more diverse responses
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected override checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		// Check if the response has a stop reason
		if (llmProviderMessageResponse.messageStop.stopReason) {
			// Perform special handling based on the stop reason
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'max_tokens':
					logger.warn(
						`BbLLM: provider[${this.llmProviderName}] Response reached the maximum token limit`,
					);

					break;
				case 'end_turn':
					logger.warn(`BbLLM: provider[${this.llmProviderName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`BbLLM: provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`BbLLM: provider[${this.llmProviderName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`BbLLM: provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default BbLLM;
