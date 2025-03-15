import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMProvider } from 'api/types.ts';
import { BB_FILE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	//LLMExtendedThinkingOptions,
} from 'api/types.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

// Define a more specific type for Anthropic content blocks that includes our custom properties
type AnthropicContentBlock = Anthropic.Messages.ContentBlockParam & {
	cache_control?: { type: string };
};
type AnthropicBlockParamOrString =
	| string
	| Anthropic.Messages.ContentBlockParam;
type AnthropicBlockParamOrArray =
	| string
	| Anthropic.Messages.ContentBlockParam
	| Array<
		Anthropic.Messages.ContentBlockParam
	>;
class AnthropicLLM extends LLM {
	private anthropic!: Anthropic;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.ANTHROPIC;

		this.initializeAnthropicClient();
	}

	private initializeAnthropicClient() {
		const clientOptions: ClientOptions = {
			apiKey: this.projectConfig.settings.api?.llmProviders?.anthropic?.apiKey,
		};

		this.anthropic = new Anthropic(clientOptions);
	}

	// Helper function to check for file metadata blocks
	private hasFileMetadata(text: string): boolean {
		try {
			return text.includes(BB_FILE_METADATA_DELIMITER);
		} catch (_e) {
			return false;
		}
	}

	private logMessageDetails(messages: Anthropic.Messages.MessageParam[]): void {
		logger.info('AnthropicLLM: Message Details for LLM Request:');

		const messagesWithCache: number[] = [];
		const messagesWithFiles: number[] = [];

		messages.forEach((message, index) => {
			const contentParts: AnthropicBlockParamOrString[] = Array.isArray(message.content)
				? message.content
				: [message.content];
			const summary: string[] = [];

			const processContent = (part: AnthropicBlockParamOrString, depth: number = 0): void => {
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
					// Use a more specific type for the content parts
					const fileContentParts = part.content.filter((nestedPart) => {
						// Check if it's a text block
						if (nestedPart.type !== 'text') return false;

						// Safe access to text property using type guard
						const textBlock = nestedPart as Anthropic.Messages.TextBlockParam;
						if (typeof textBlock.text !== 'string') return false;

						// Check for file metadata or file note
						return this.hasFileMetadata(textBlock.text) ||
							(textBlock.text.startsWith('Note: File') && textBlock.text.includes('is up-to-date'));
					});

					if (fileContentParts.length > 0) {
						summary.push(`${indent}Files in this tool_result:`);
						fileContentParts.forEach((p) => {
							// Use a more specific type for the content part
							const textBlock = p as Anthropic.Messages.TextBlockParam;
							// We've already filtered for text blocks with string text
							if (textBlock.type === 'text' && typeof textBlock.text === 'string') {
								if (textBlock.text.startsWith('Note: File')) {
									const match = textBlock.text.match(
										/Note: File (.*?) \(revision: (\w+)\) content is up-to-date from turn (\d+) \(revision: (\w+)\)/,
									);
									if (match) {
										summary.push(
											`${indent}  - ${match[1]} with revision ${match[2]} (current from turn ${
												match[3]
											} with revision ${match[4]})`,
										);
									}
								} else if (this.hasFileMetadata(textBlock.text)) {
									try {
										const metadataText = textBlock.text.split(BB_FILE_METADATA_DELIMITER)[1].trim();
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
					part.content.forEach((nestedPart: AnthropicBlockParamOrString, nestedIndex: number) => {
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

				// Check for cache_control
				// Only certain content types support cache_control (not thinking blocks)
				if (part && typeof part === 'object' && part.type !== 'thinking' && part.type !== 'redacted_thinking') {
					const hasCache = 'cache_control' in part;
					if (hasCache) {
						// Use a more specific type assertion
						const cacheControl = (part as AnthropicContentBlock).cache_control;
						summary.push(`${indent}Has cache_control: yes (${cacheControl?.type})`);
						if (!messagesWithCache.includes(index + 1)) {
							messagesWithCache.push(index + 1);
						}
					} else {
						summary.push(`${indent}Has cache_control: no`);
					}
				} else {
					summary.push(`${indent}Has cache_control: no (not supported for this content type)`);
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
	): Anthropic.Messages.MessageParam[] {
		const usePromptCaching = this.projectConfig.settings.api?.usePromptCaching ?? true;

		// Find the last three user messages
		const userMessages = messages
			.map((m, index) => ({ message: m, index }))
			.filter(({ message }) => message.role === 'user');

		// Get the last three user messages
		const lastThreeUserMessages = userMessages.slice(-3);
		const lastThreeIndices = new Set(lastThreeUserMessages.map((m) => m.index));

		return messages.map((m, index) => {
			const prevContent: AnthropicBlockParamOrArray = m.content as AnthropicBlockParamOrArray;
			let content: AnthropicBlockParamOrArray;

			// Add cache_control to the last content part of the last three user messages
			if (m.role === 'user' && usePromptCaching && lastThreeIndices.has(index)) {
				if (Array.isArray(prevContent)) {
					content = [...prevContent];
					const lastBlock = content[content.length - 1];
					// Only add cache_control to supported content types (not thinking blocks)
					if (lastBlock.type !== 'thinking' && lastBlock.type !== 'redacted_thinking') {
						content[content.length - 1] = { ...lastBlock, cache_control: { type: 'ephemeral' } };
					}
				} else if (typeof prevContent === 'string') {
					// For string content, we don't have existing citations, so use empty array
					content = [{
						type: 'text',
						text: prevContent,
						cache_control: { type: 'ephemeral' },
						citations: [],
					}];
				} else {
					// Only add cache_control to supported content types (not thinking blocks)
					if (prevContent.type !== 'thinking' && prevContent.type !== 'redacted_thinking') {
						content = [{ ...prevContent, cache_control: { type: 'ephemeral' } }];
					} else {
						content = [{ ...prevContent }];
					}
				}
			} else {
				content =
					(Array.isArray(prevContent) ? prevContent : [prevContent]) as Anthropic.Messages.TextBlockParam[];
			}
			return {
				role: m.role,
				content: content,
			} as Anthropic.Messages.MessageParam;
		});
	}

	private asProviderToolType(tools: LLMTool[]): Anthropic.Messages.Tool[] {
		//logger.debug('AnthropicLLM: llms-anthropic-asProviderToolType', tools);
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.inputSchema,
		} as Anthropic.Tool));
	}

	//// deno-lint-ignore require-await
	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<Anthropic.Beta.Messages.MessageCreateParams> {
		//logger.debug('AnthropicLLM: llms-anthropic-asProviderMessageRequest-messageRequest.system', messageRequest.system);
		const usePromptCaching = this.projectConfig.settings.api?.usePromptCaching ?? true;
		const system = messageRequest.system
			? [
				{
					type: 'text',
					text: messageRequest.system,
					...(usePromptCaching ? { cache_control: { type: 'ephemeral' } } : {}),
				} as Anthropic.Messages.TextBlockParam,
			]
			: '';

		//logger.debug('AnthropicLLM: llms-anthropic-asProviderMessageRequest-tools', interaction.allTools());
		const tools = this.asProviderToolType(messageRequest.tools);
		// system cache_control also includes tools
		//if (tools.length > 0 && usePromptCaching) {
		//	tools[tools.length - 1].cache_control = { type: 'ephemeral' };
		//}

		const messages = this.asProviderMessageType(messageRequest.messages);
		// Log detailed message information
		if (this.projectConfig.settings.api?.logFileHydration ?? false) this.logMessageDetails(messages);

		const model: string = messageRequest.model || AnthropicModel.CLAUDE_3_5_SONNET;

		// Resolve parameters using model capabilities
		let temperature: number;
		let maxTokens: number;
		if (interaction) {
			const resolved = await interaction.resolveModelParameters(
				LLMProvider.ANTHROPIC,
				messageRequest.model || AnthropicModel.CLAUDE_3_7_SONNET,
				messageRequest.maxTokens,
				messageRequest.temperature,
			);
			//const maxTokens: number = 16384;
			maxTokens = resolved.maxTokens;
			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = messageRequest.extendedThinking?.enabled ? 1 : resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const capabilitiesManager = await ModelCapabilitiesManager.getInstance().initialize();

			maxTokens = capabilitiesManager.resolveMaxTokens(
				this.llmProviderName,
				model,
				messageRequest.maxTokens,
			);
			// Resolve temperature, but prioritize explicitly setting to 1 for extended thinking
			temperature = messageRequest.extendedThinking?.enabled ? 1 : capabilitiesManager.resolveTemperature(
				this.llmProviderName,
				model,
				messageRequest.temperature,
			);
		}

		const providerMessageRequest: Anthropic.Beta.Messages.MessageCreateParams = {
			messages,
			system,
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			betas: ['output-128k-2025-02-19','token-efficient-tools-2025-02-19'],
			stream: false,

			// Add extended thinking support if enabled in the request
			...(messageRequest.extendedThinking?.enabled
				? {
					thinking: {
						type: 'enabled',
						budget_tokens: messageRequest.extendedThinking.budgetTokens || 4000,
					},
				}
				: {}),
		};
		//logger.info('AnthropicLLM: llms-anthropic-asProviderMessageRequest', providerMessageRequest);
		//logger.dir(providerMessageRequest);

		return providerMessageRequest;
	}

	/**
	 * Run Anthropic service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.dir(messageRequest);

			const providerMessageRequest: Anthropic.Beta.Messages.MessageCreateParams = await this
				.asProviderMessageRequest(
					messageRequest,
					interaction,
				);

			// https://github.com/anthropics/anthropic-sdk-typescript/blob/6886b29e0a550d28aa082670381a4bb92101099c/src/resources/beta/prompt-caching/prompt-caching.ts
			//const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.beta.messages
				.create(
					providerMessageRequest,
					{
						headers: {
							'anthropic-beta':
								'output-128k-2025-02-19,token-efficient-tools-2025-02-19,prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15',
						},
					},
				).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Messages.Message;
			//logger.info('AnthropicLLM: llms-anthropic-anthropicMessage', anthropicMessage);
			//logger.info('AnthropicLLM: llms-anthropic-anthropicResponse', anthropicResponse);

			if (this.projectConfig.settings.api?.logLevel === 'debug1') {
				interaction.conversationPersistence.writeLLMRequest({
					messageId: anthropicMessage.id,
					requestBody: messageRequest,
					requestHeaders: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
					responseMessage: anthropicMessage,
					response: anthropicResponse,
				});
			}

			// Validate essential response properties
			if (!anthropicMessage || !anthropicMessage.content) {
				logger.error('AnthropicLLM: Invalid Anthropic response - missing message or content:', {
					anthropicMessage,
				});
				throw createError(
					ErrorType.LLM,
					'Invalid response from Anthropic API: missing required properties',
					{ provider: this.llmProviderName, model: messageRequest.model } as LLMErrorOptions,
				);
			}

			// Validate and normalize content to ensure it's a non-empty array
			if (!Array.isArray(anthropicMessage.content)) {
				logger.error('AnthropicLLM: !!!!! CRITICAL ERROR !!!!! Anthropic response content is not an array:', {
					content: anthropicMessage.content,
				});
				// Convert to array if possible, or create error message
				if (anthropicMessage.content && typeof anthropicMessage.content === 'object') {
					anthropicMessage.content = [anthropicMessage.content];
				} else if (typeof anthropicMessage.content === 'string') {
					// For string content from Anthropic, we don't have existing citations
					// String content doesn't have citations, so use empty array
					anthropicMessage.content = [{ type: 'text', text: anthropicMessage.content, citations: [] }];
				} else {
					anthropicMessage.content = [{
						type: 'text',
						text: 'Error: Invalid response format from LLM',
						citations: [],
					}];
				}
			}

			// Ensure content array is not empty
			if (anthropicMessage.content.length === 0) {
				logger.error('AnthropicLLM: !!!!! CRITICAL ERROR !!!!! Anthropic response content array is empty');
				anthropicMessage.content = [{ type: 'text', text: 'Error: Empty response from LLM', citations: [] }];
			}

			const headers = anthropicResponse?.headers;

			//const requestId = headers.get('request-id');

			const requestsRemaining = Number(headers.get('anthropic-ratelimit-requests-remaining'));
			const requestsLimit = Number(headers.get('anthropic-ratelimit-requests-limit'));
			const requestsResetDate = new Date(headers.get('anthropic-ratelimit-requests-reset') || '');

			const tokensRemaining = Number(headers.get('anthropic-ratelimit-tokens-remaining'));
			const tokensLimit = Number(headers.get('anthropic-ratelimit-tokens-limit'));
			const tokensResetDate = new Date(headers.get('anthropic-ratelimit-tokens-reset') || '');

			//logger.debug(`AnthropicLLM: provider[${this.llmProviderName}] Creating message response from Anthropic message:`, {
			//	messageType: anthropicMessage.type,
			//	role: anthropicMessage.role,
			//	contentLength: anthropicMessage.content.length,
			//});
			if (anthropicResponse.status !== 200) {
				logger.info(`AnthropicLLM: provider[${this.llmProviderName}] Non-200 response:`, { headers });
			}

			const messageResponse: LLMProviderMessageResponse = {
				id: anthropicMessage.id,
				type: anthropicMessage.type,
				role: anthropicMessage.role,
				model: anthropicMessage.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: anthropicMessage.content as LLMMessageContentParts,
				answer: extractTextFromContent(anthropicMessage.content as LLMMessageContentParts), // answer will get overridden in baseLLM - but this keeps type checking happy
				isTool: anthropicMessage.stop_reason === 'tool_use',
				messageStop: {
					stopReason: anthropicMessage.stop_reason,
					stopSequence: anthropicMessage.stop_sequence,
				},
				usage: {
					inputTokens: anthropicMessage.usage.input_tokens,
					outputTokens: anthropicMessage.usage.output_tokens,
					totalTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens),
					cacheCreationInputTokens: anthropicMessage.usage.cache_creation_input_tokens || 0,
					cacheReadInputTokens: anthropicMessage.usage.cache_read_input_tokens || 0,
					totalAllTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens +
						(anthropicMessage.usage.cache_creation_input_tokens || 0) +
						(anthropicMessage.usage.cache_read_input_tokens || 0)),
				},
				rateLimit: {
					requestsRemaining,
					requestsLimit,
					requestsResetDate,
					tokensRemaining,
					tokensLimit,
					tokensResetDate,
				},
				providerMessageResponseMeta: {
					statusCode: anthropicResponse.status,
					statusText: anthropicResponse.statusText,
				},
			};
			logger.debug(`AnthropicLLM: provider[${this.llmProviderName}] Created message response:`, {
				id: messageResponse.id,
				type: messageResponse.type,
				contentLength: messageResponse.answerContent.length,
			});
			//logger.debug("AnthropicLLM: llms-anthropic-messageResponse", messageResponse);

			// Include request parameters in messageMeta
			const requestParams: LLMRequestParams = {
				model: messageRequest.model,
				maxTokens: providerMessageRequest.max_tokens!,
				temperature: providerMessageRequest.temperature!,
				extendedThinking: messageRequest.extendedThinking,
				usePromptCaching: this.projectConfig.settings.api?.usePromptCaching ?? true
			};

			return { 
				messageResponse, 
				messageMeta: { 
					system: messageRequest.system,
					requestParams
				} 
			};
		} catch (err) {
			logger.error('AnthropicLLM: Error calling Anthropic API', err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from Anthropic API: ${(err as Error).message}`,
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
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					true,
				);
			} else {
				logger.warn(
					`AnthropicLLM: provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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
						`AnthropicLLM: provider[${this.llmProviderName}] Response reached the maximum token limit`,
					);

					break;
				case 'end_turn':
					logger.warn(`AnthropicLLM: provider[${this.llmProviderName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`AnthropicLLM: provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`AnthropicLLM: provider[${this.llmProviderName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`AnthropicLLM: provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;
