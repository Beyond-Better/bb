import type { SupabaseClient } from '@supabase/supabase-js';
//import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";

import { AnthropicModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import { BB_RESOURCE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';
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
import { ErrorType, isLLMError, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import type { BBLLMResponse } from 'api/types/llms.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';

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
	private supabaseClient!: SupabaseClient;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);

		this.llmProviderName = LLMProvider.BB;

		const projectEditor = this.invokeSync(LLMCallbackType.PROJECT_EDITOR);
		this.supabaseClient = projectEditor.sessionManager.supabaseClient;
	}

	// Helper function to check for file metadata blocks
	private hasFileMetadata(text: string): boolean {
		try {
			return text.includes(BB_RESOURCE_METADATA_DELIMITER);
		} catch (_e) {
			return false;
		}
	}

	private logMessageDetails(messages: LLMMessage[]): void {
		logger.info(`BbLLM:provider[${this.llmProviderName}]: Message Details for LLM Request:`);

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
										const metadataText = p.text.split(BB_RESOURCE_METADATA_DELIMITER)[1].trim();
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
							const metadataText = part.text.split(BB_RESOURCE_METADATA_DELIMITER)[1].trim();
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

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<LLMProviderMessageRequest> {
		//logger.debug(`BbLLM:provider[${this.llmProviderName}]: asProviderMessageRequest-messageRequest.system`, messageRequest.system);

		//logger.debug(`BbLLM:provider[${this.llmProviderName}]: asProviderMessageRequest-interaction.allTools`, messageRequest.tools);
		const tools = this.asProviderToolType(messageRequest.tools);
		//logger.debug(`BbLLM:provider[${this.llmProviderName}]: asProviderMessageRequest-tools`, tools);

		const messages = this.asProviderMessageType(messageRequest.messages);
		// Log detailed message information
		if (this.projectConfig.api?.logFileHydration ?? false) this.logMessageDetails(messages);

		const model: string = messageRequest.model || AnthropicModel.CLAUDE_4_0_SONNET;
		const usePromptCaching = this.projectConfig.api?.usePromptCaching ?? true;

		// Resolve parameters using model capabilities
		let temperature: number;
		let maxTokens: number;
		let extendedThinking: boolean;
		if (interaction) {
			const resolved = await interaction.resolveModelParameters(
				model,
				{
					maxTokens: messageRequest.maxTokens,
					temperature: messageRequest.temperature,
					extendedThinking: messageRequest.extendedThinking?.enabled,
				},
			);

			maxTokens = resolved.maxTokens;
			extendedThinking = resolved.extendedThinking;
			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = extendedThinking ? 1 : resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const projectEditor = await this.invoke(LLMCallbackType.PROJECT_EDITOR);
			const registryService = await ModelRegistryService.getInstance(projectEditor.projectConfig);

			maxTokens = registryService.resolveMaxTokens(
				model,
				messageRequest.maxTokens,
			);

			extendedThinking = registryService.resolveExtendedThinking(
				model,
				messageRequest.extendedThinking?.enabled,
			);
			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = extendedThinking ? 1 : registryService.resolveTemperature(
				model,
				messageRequest.temperature,
			);
		}
		//if (model !== 'claude-3-haiku-20240307') maxTokens = 16384;
		const providerMessageRequest: LLMProviderMessageRequest = {
			messages,
			system: messageRequest.system,
			tools,
			model,
			maxTokens,
			temperature,
			usePromptCaching,
			extendedThinking: { enabled: extendedThinking, budgetTokens: 4000 },
		};
		//logger.debug(`BbLLM:provider[${this.llmProviderName}]: asProviderMessageRequest`, providerMessageRequest);
		//logger.dir(providerMessageRequest);

		return providerMessageRequest;
	}

	/**
	 * Determines whether to use direct fetch or Supabase edge function
	 */
	private shouldUseDirectFetch(): boolean {
		// Check if useFallback is configured for Supabase
		return Boolean(!this.projectConfig.api?.llmProviders?.beyondbetter?.config?.useFallback);
	}

	/**
	 * Get the base URL for direct fetch calls
	 */
	private getBaseUrl(): string {
		return this.projectConfig.api?.llmProviders?.beyondbetter?.baseUrl ||
			'https://api.beyondbetter.dev/api/v1/llm-proxy';
	}

	/**
	 * Make a direct fetch call to the LLM proxy endpoint
	 */
	private async makeDirectFetchCall(
		providerMessageRequest: LLMProviderMessageRequest,
	): Promise<{ data: BBLLMResponse | null; error: any }> {
		try {
			const baseUrl = this.getBaseUrl();

			// Get session manager to retrieve auth headers
			const projectEditor = this.invokeSync(LLMCallbackType.PROJECT_EDITOR);
			const sessionManager = projectEditor.sessionManager;

			// Get current session for authentication
			const session = await sessionManager.getSession();
			//logger.info(`BbLLM:provider[${this.llmProviderName}]: session`, session);

			// Prepare headers - same as what Supabase edge functions receive
			const headers: Record<string, string> = {
				'Content-Type': 'application/json',
			};

			// Add Authorization header if we have a session
			if (session?.access_token) {
				headers['Authorization'] = `Bearer ${session.access_token}`;
			}

			const response = await fetch(baseUrl, {
				method: 'POST',
				headers,
				body: JSON.stringify(providerMessageRequest),
			});

			if (!response.ok) {
				const errorText = await response.text();
				let errorBody;
				try {
					errorBody = JSON.parse(errorText);
				} catch {
					errorBody = { message: errorText };
				}

				return {
					data: null,
					error: {
						status: response.status,
						statusText: response.statusText,
						context: {
							json: () => Promise.resolve(errorBody),
						},
					},
				};
			}

			const data = await response.json() as BBLLMResponse;
			return { data, error: null };
		} catch (error) {
			return {
				data: null,
				error: {
					message: (error as Error).message,
					context: {
						json: () => Promise.resolve({ message: (error as Error).message }),
					},
				},
			};
		}
	}

	/**
	 * Run BB service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from BB or an error
	 */
	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.info(`BbLLM:provider[${this.llmProviderName}]: messageRequest`, messageRequest);

			const providerMessageRequest = await this.asProviderMessageRequest(
				messageRequest,
				interaction,
			);

			// Choose between direct fetch and Supabase edge function
			let data: BBLLMResponse | null;
			let error: any;

			if (this.shouldUseDirectFetch()) {
				logger.info(`BbLLM:provider[${this.llmProviderName}]: Using direct fetch to ${this.getBaseUrl()}`);
				const result = await this.makeDirectFetchCall(providerMessageRequest);
				data = result.data;
				error = result.error;
			} else {
				logger.info(`BbLLM:provider[${this.llmProviderName}]: Using Supabase edge function`);
				//const { data, error } : {data:BBLLMResponse ; error: FunctionsHttpError, FunctionsRelayError, FunctionsFetchError} = await this.supabaseClient.functions.invoke('llm-proxy', {
				const result = await this.supabaseClient.functions.invoke('llm-proxy', {
					body: providerMessageRequest,
				});
				data = result.data;
				error = result.error;
			}
			//logger.info(`BbLLM:provider[${this.llmProviderName}]: llms-bb-data`, data);
			//logger.info(`BbLLM:provider[${this.llmProviderName}]: llms-bb-error`, error);

			const bbResponseMessage = data as BBLLMResponse;
			//if (this.projectConfig.api?.logLevel === 'debug1') {
			//	interaction.interactionPersistence.writeLLMRequest({
			//		messageId: bbResponseMessage.metadata.requestId,
			//		requestBody: messageRequest,
			//		requestHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
			//		responseMessage: bbResponseMessage,
			//	});
			//}

			if (error) {
				//logger.error(`BbLLM:provider[${this.llmProviderName}]: Error calling BB API: `, {data, error});
				let errorBody = {};
				try {
					if (error?.context) {
						errorBody = await error.context.json();
						//logger.error(`BbLLM:provider[${this.llmProviderName}]: Error calling BB API: `, { error, errorBody });
					} else {
						logger.error(
							`BbLLM:provider[${this.llmProviderName}]: Error calling BB API: No error body available: `,
							{ error },
						);
					}
				} catch (e) {
					logger.error(
						`BbLLM:provider[${this.llmProviderName}]: Error calling BB API: Failed to parse error response: `,
						e,
					);
					logger.error(`BbLLM:provider[${this.llmProviderName}]: Error calling BB API: Original error: `, {
						error,
					});
				}

				throw createError(
					ErrorType.LLM,
					`Received an error from BB API: `,
					{
						model: messageRequest.model,
						provider: this.llmProviderName,
						...errorBody,
					} as LLMErrorOptions,
				);
			}
			if (bbResponseMessage.status.statusCode !== 200) {
				logger.error(
					`BbLLM:provider[${this.llmProviderName}]: Received a non-200 from BB API: `,
					bbResponseMessage,
				);
				throw createError(
					ErrorType.LLM,
					`Received a non-200 from BB API: `,
					{
						name: 'BB API Error',
						model: messageRequest.model,
						provider: this.llmProviderName,
						args: { bbResponse: bbResponseMessage },
						interactionId: interaction.id,
					} as LLMErrorOptions,
				);
			}

			const messageResponse: LLMProviderMessageResponse = {
				id: bbResponseMessage.metadata.requestId,
				type: bbResponseMessage.metadata.type,
				role: bbResponseMessage.metadata.role,
				model: bbResponseMessage.metadata.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: bbResponseMessage.content as LLMMessageContentParts,
				answer: extractTextFromContent(bbResponseMessage.content as LLMMessageContentParts), // answer will get overridden in baseLLM - but this keeps type checking happy
				isTool: bbResponseMessage.metadata.isTool,
				// isTool: bbResponseMessage.metadata.isToolCall !== undefined
				// 	? bbResponseMessage.metadata.isToolCall
				// 	: bbResponseMessage.metadata.stopReason === 'tool_use',
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
					thoughtTokens: bbResponseMessage.usage.thoughtTokens || 0,
					totalAllTokens: (bbResponseMessage.usage.inputTokens + bbResponseMessage.usage.outputTokens +
						(bbResponseMessage.usage.cacheCreationInputTokens || 0) +
						(bbResponseMessage.usage.cacheReadInputTokens || 0) +
						(bbResponseMessage.usage.thoughtTokens || 0)),
				},
				rateLimit: bbResponseMessage.rateLimit,
				providerMessageResponseMeta: bbResponseMessage.status,
			};
			// logger.debug(`BbLLM:provider[${this.llmProviderName}]: Created message response:`, {
			// 	id: messageResponse.id,
			// 	type: messageResponse.type,
			// 	contentLength: messageResponse.answerContent.length,
			// });
			//logger.debug(`BbLLM:provider[${this.llmProviderName}]: llms-anthropic-messageResponse`, messageResponse);

			// Include request parameters in messageMeta
			const llmRequestParams: LLMRequestParams = bbResponseMessage.metadata.llmRequestParams || {
				modelConfig: {
					model: messageRequest.model,
					maxTokens: providerMessageRequest.maxTokens,
					temperature: providerMessageRequest.temperature,
					extendedThinking: messageRequest.extendedThinking,
					usePromptCaching: providerMessageRequest.usePromptCaching,
				},
			};

			return {
				messageResponse,
				messageMeta: {
					system: messageRequest.system,
					llmRequestParams,
				},
			};
		} catch (err) {
			logger.error(`BbLLM:provider[${this.llmProviderName}]: Error calling BB API`, err);
			if (isLLMError(err)) throw err;
			throw createError(
				ErrorType.LLM,
				`Could not get response from BB API: ${(err as Error).message}`,
				{
					model: messageRequest.model,
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
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema. Ensure you are using arrays and objects instead of JSON strings.",
					true,
				);
			} else {
				logger.warn(
					`BbLLM:provider[${this.llmProviderName}]: modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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
						`BbLLM:provider[${this.llmProviderName}]: Response reached the maximum token limit`,
					);

					break;
				case 'end_turn':
					logger.warn(`BbLLM:provider[${this.llmProviderName}]: pResponse reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`BbLLM:provider[${this.llmProviderName}]: Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`BbLLM:provider[${this.llmProviderName}]: Response is using a tool`);
					break;
				case 'refusal':
					logger.warn(
						`BbLLM:provider[${this.llmProviderName}]: Response has refused to continue for safety reasons`,
					);
					break;
				default:
					logger.info(
						`BbLLM:provider[${this.llmProviderName}]: Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default BbLLM;
