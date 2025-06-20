import {
	FinishReason,
	GoogleGenAI,
	//SchemaType
} from '@google/genai';
import type {
	Candidate,
	Content,
	FunctionCall,
	FunctionDeclaration,
	GenerateContentConfig,
	GenerateContentParameters,
	Part,
	SafetyRating,
	Tool,
	UsageMetadata,
} from '@google/genai';
import { GoogleModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import type { LLMToolInputSchema } from 'api/llms/llmTool.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentPartImageBlock,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import type {
	LLMCallbacks,
	//LLMMessageStop,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	LLMTokenUsage,
} from 'api/types/llms.ts';
import LLM from './baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { ModelRegistryService } from 'api/llms/modelRegistryService.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
import { BB_RESOURCE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';

class GoogleLLM extends LLM {
	private google!: GoogleGenAI;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.GOOGLE;
		this.initializeGoogleClient();
	}

	private initializeGoogleClient() {
		const apiKey = this.projectConfig.api?.llmProviders?.google?.apiKey;
		if (!apiKey) {
			throw createError(
				ErrorType.LLM,
				'Google API key is not configured',
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}
		this.google = new GoogleGenAI({ apiKey });
	}

	private transformUsage(usageMetadata?: UsageMetadata): LLMTokenUsage {
		if (!usageMetadata) {
			return {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
				thoughtTokens: 0,
				totalAllTokens: 0,
			};
		}
		// The new SDK uses outputTokenCount and inputTokenCount
		const outputTokens = (usageMetadata as any).outputTokenCount || 0;
		const inputTokens = (usageMetadata as any).inputTokenCount || usageMetadata.promptTokenCount || 0;
		const totalTokens = (usageMetadata as any).totalTokenCount || (inputTokens + outputTokens);

		return {
			inputTokens: inputTokens,
			outputTokens: outputTokens,
			totalTokens: totalTokens,
			cacheCreationInputTokens: 0, // Google doesn't use this
			cacheReadInputTokens: usageMetadata.cachedContentTokenCount || 0,
			thoughtTokens: usageMetadata.thoughtsTokenCount || 0,
			totalAllTokens: totalTokens,
		};
	}

	private asProviderMessageType(messages: LLMMessage[]): Content[] {
		//logger.info(`LlmProvider[${this.llmProviderName}]: asProviderMessageType-messages`, messages);

		const mapMessageToContent = (message: LLMMessage) => {
			// Log the message being processed
			logger.debug(
				`LlmProvider[${this.llmProviderName}]: Processing message role=${message.role}, content parts=${message.content.length}`,
			);

			return {
				role: message.role === 'assistant' ? 'model' : message.role,
				parts: message.content.map((part) => {
					if (part.type === 'text') {
						// Check if this is a metadata block
						if (part.text.includes(BB_RESOURCE_METADATA_DELIMITER)) {
							logger.debug(
								`LlmProvider[${this.llmProviderName}]: Found file metadata block, preserving as-is`,
							);
							return { text: part.text };
						}
						// For regular text content
						logger.debug(`LlmProvider[${this.llmProviderName}]: Processing regular text content`);
						return { text: part.text };
					} else if (part.type === 'image') {
						logger.debug(`LlmProvider[${this.llmProviderName}]: Processing image content`);
						return {
							inlineData: {
								data: part.source.data,
								mimeType: part.source.media_type,
							},
						};
					} else if (part.type === 'tool_use') {
						logger.debug(`LlmProvider[${this.llmProviderName}]: Processing tool_use content`);
						return {
							functionCall: {
								name: part.name, //contentPart.id,
								args: part.input,
							} as FunctionCall,
						};
					} else if (part.type === 'tool_result') {
						logger.debug(
							`LlmProvider[${this.llmProviderName}]: Processing tool result content, tool_use_id=${part.tool_use_id}`,
						);
						// For tool results, we need to process each content part
						const processedContent = part.content?.map((p) => {
							if (p.type === 'text') {
								// Check if this is a metadata block
								if (p.text.includes(BB_RESOURCE_METADATA_DELIMITER)) {
									logger.debug(
										`LlmProvider[${this.llmProviderName}]: Found file metadata in tool result, preserving as-is`,
									);
									return { text: p.text };
								}
								return { text: p.text };
							} else if (p.type === 'image') {
								logger.debug(`LlmProvider[${this.llmProviderName}]: Processing image in tool result`);
								return {
									inlineData: {
										data: p.source.data,
										mimeType: p.source.media_type,
									},
								};
							}
							logger.warn(
								`LlmProvider[${this.llmProviderName}]: Unsupported content type in tool result: ${
									(p as { type: string }).type
								}`,
							);
							return { text: '' };
						});

						// Convert processed content into a response object
						const responseText = processedContent?.map((p) => 'text' in p ? p.text : '').join('') || '';
						logger.debug(
							`LlmProvider[${this.llmProviderName}]: Creating function response for tool ${part.tool_use_id}, response length: ${responseText.length}`,
						);
						return {
							functionResponse: {
								name: part.tool_use_id || '',
								response: { toolResults: responseText },
								//response: processedContent,
							},
						};
					}
					logger.warn(`LlmProvider[${this.llmProviderName}]: Unsupported content part type: ${part.type}`);
					return { text: '' }; // fallback
				}),
			};
		};

		// Check for user messages with multiple tool_use parts
		const userMessageWithMultipleToolUse = messages.find(
			(message) =>
				message.role === 'user' && message.content.filter((part) => part.type === 'tool_use').length > 1,
		);

		if (userMessageWithMultipleToolUse) {
			logger.warn(
				`LlmProvider[${this.llmProviderName}]: Found user message with multiple tool_use parts. Splitting messages.`,
			);
			const userMessageIndex = messages.indexOf(userMessageWithMultipleToolUse);
			const assistantMessage = messages[userMessageIndex + 1];

			if (!assistantMessage || assistantMessage.role !== 'assistant') {
				logger.error(
					`LlmProvider[${this.llmProviderName}]: Could not find corresponding assistant message. Aborting split.`,
				);
				return messages.map(mapMessageToContent);
			}

			const newUserMessages: LLMMessage[] = [];
			const toolUseParts = userMessageWithMultipleToolUse.content.filter((part) => part.type === 'tool_use');
			const toolResultParts = assistantMessage.content.filter((part) => part.type === 'tool_result');

			if (toolUseParts.length !== toolResultParts.length) {
				logger.error(
					`LlmProvider[${this.llmProviderName}]: Number of tool_use parts does not match number of tool_result parts. Aborting split.`,
				);
				return messages.map(mapMessageToContent);
			}

			for (let i = 0; i < toolUseParts.length; i++) {
				const newUserMessage = new LLMMessage(
					'user',
					[toolUseParts[i]],
					userMessageWithMultipleToolUse.interactionStats,
					userMessageWithMultipleToolUse.tool_call_id,
					userMessageWithMultipleToolUse.providerResponse,
					userMessageWithMultipleToolUse.id,
				);
				const newAssistantMessage = new LLMMessage(
					'assistant',
					[toolResultParts[i]],
					assistantMessage.interactionStats,
					assistantMessage.tool_call_id,
					assistantMessage.providerResponse,
					assistantMessage.id,
				);
				newUserMessages.push(newUserMessage);
				newUserMessages.push(newAssistantMessage);
			}

			// Replace the original messages with the new ones
			messages.splice(userMessageIndex, 2, ...newUserMessages);
			logger.info(`LlmProvider[${this.llmProviderName}]: Messages split successfully.`);
		}

		const providerMessages = messages.map(mapMessageToContent);
		//logger.info(`LlmProvider[${this.llmProviderName}]: asProviderMessageType-providerMessages`, JSON.stringify(providerMessages, null, 2));
		return providerMessages;
	}

	/**
	 * Clean and validate a schema object for Google's function calling API
	 * Ensures schema types are lowercase and removes unsupported fields
	 * @param schema The schema object to clean
	 * @returns Cleaned schema object conforming to Google's Schema format
	 */
	private cleanSchema(schema: LLMToolInputSchema): FunctionDeclaration {
		// deno-lint-ignore no-explicit-any
		const clean = (obj: Record<string, any>): Record<string, any> => {
			if (!obj || typeof obj !== 'object') return obj;

			const cleaned = { ...obj };
			delete cleaned.default;
			delete cleaned.additionalProperties;

			if (Array.isArray(cleaned.type)) {
				cleaned.type = cleaned.type[0];
			}

			return Object.entries(cleaned).reduce((acc, [key, value]) => ({
				...acc,
				[key]: Array.isArray(value)
					? value.map((item) => clean(item))
					: typeof value === 'object'
					? clean(value)
					: value,
			}), {});
		};

		return clean(schema) as FunctionDeclaration;
	}

	/*
	private cleanSchema(schema: LLMToolInputSchema): FunctionDeclarationSchema {
		logger.debug(`LlmProvider[${this.llmProviderName}]: Cleaning schema:`, schema);

		// Handle null/undefined
		if (schema === null || schema === undefined) {
			return {} as FunctionDeclarationSchema;
		}

		// Start with a clean object
		const cleaned: FunctionDeclarationSchema = {type: SchemaType.OBJECT, properties: {}};

		// Copy over properties we want to keep
		if (schema.type) {
			// Keep type values lowercase as per SchemaType enum
			cleaned.type = schema.type as SchemaType;
		}
		if (schema.description) {
			cleaned.description = schema.description;
		}
		if (Array.isArray(schema.required)) {
			cleaned.required = schema.required;
		}
		if (schema.enum) {
			// Convert enum values to strings
			cleaned.enum = schema.enum
				.filter((v) => v !== null && v !== undefined)
				.map((v) => String(v));
		}

		// Handle properties recursively
		if (schema.properties) {
			cleaned.properties = {};
			Object.entries(schema.properties).forEach(([key, value]) => {
				if (value && typeof value === 'object') {
					cleaned.properties[key] = this.cleanSchema(value);
				}
			});
		}

		// Handle array items recursively
		if (schema.items) {
			cleaned.items = this.cleanSchema(schema.items);
		}

		// Copy any additional valid properties
		if (typeof schema.minItems === 'number') {
			cleaned.minItems = schema.minItems;
		}
		if (typeof schema.maxItems === 'number') {
			cleaned.maxItems = schema.maxItems;
		}

		return cleaned;
	}
 */

	private asProviderToolType(tools: LLMTool[]): Tool[] {
		return [{
			functionDeclarations: tools.map((tool) => {
				logger.debug(`LlmProvider[${this.llmProviderName}]: Converting tool to Google format: ${tool.name}`);
				const cleanedSchema = this.cleanSchema(tool.inputSchema);
				logger.debug(`LlmProvider[${this.llmProviderName}]: Cleaned schema:`, cleanedSchema);
				return {
					name: tool.name,
					description: tool.description,
					parameters: cleanedSchema,
				};
			}),
		}];
	}

	private asApiMessageContentPartsType(candidate: Candidate): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];

		candidate.content?.parts?.forEach((part: Part) => {
			if ('text' in part) {
				logger.debug(`LlmProvider[${this.llmProviderName}]: Processing text content from response`);
				contentParts.push({
					type: 'text',
					text: part.text,
				} as LLMMessageContentPartTextBlock);
			} else if ('functionCall' in part && part.functionCall !== undefined) {
				// Google's FunctionCall provides args as an object, no need to parse
				logger.debug(
					`LlmProvider[${this.llmProviderName}]: Processing function call: ${part.functionCall.name}`,
				);
				contentParts.push({
					type: 'tool_use',
					id: part.functionCall.name,
					name: part.functionCall.name,
					input: part.functionCall.args,
				} as LLMMessageContentPartToolUseBlock);
			} else if ('inlineData' in part && part.inlineData !== undefined) {
				logger.debug(`LlmProvider[${this.llmProviderName}]: Processing image content from response`);
				contentParts.push({
					type: 'image',
					source: {
						type: 'base64',
						data: part.inlineData.data,
						media_type: part.inlineData.mimeType,
					},
				} as LLMMessageContentPartImageBlock);
			}
		});

		return contentParts;
	}

	private hasFunctionCall(candidate: Candidate): boolean {
		return candidate.content?.parts?.some((part: Part) => 'functionCall' in part) || false;
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<GenerateContentParameters> {
		const contents = this.asProviderMessageType(messageRequest.messages);
		const model = messageRequest.model || GoogleModel.GOOGLE_GEMINI_2_5_FLASH;

		// Resolve parameters using model capabilities
		let maxTokens: number;
		let temperature: number;

		if (interaction) {
			// Use interaction to resolve parameters with proper priority
			const resolved = await interaction.resolveModelParameters(
				model,
				{
					maxTokens: messageRequest.maxTokens,
					temperature: messageRequest.temperature,
				},
				LLMProvider.GOOGLE,
			);
			maxTokens = resolved.maxTokens;
			temperature = resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const projectEditor = await this.invoke(LLMCallbackType.PROJECT_EDITOR);
			const registryService = await ModelRegistryService.getInstance(projectEditor.projectConfig);

			maxTokens = registryService.resolveMaxTokens(
				model,
				messageRequest.maxTokens,
			);
			temperature = registryService.resolveTemperature(
				model,
				messageRequest.temperature,
			);
		}

		const config: GenerateContentConfig = {
			temperature: temperature,
			maxOutputTokens: maxTokens,
		};

		// System instruction needs to be wrapped in a Content object
		if (messageRequest.system) {
			config.systemInstruction = {
				role: 'user',
				parts: [{ text: messageRequest.system }],
			} as Content;
		}

		// Add tools if present
		if (messageRequest.tools.length > 0) {
			logger.debug(
				`LlmProvider[${this.llmProviderName}]: Adding tool configuration for ${messageRequest.tools.length} tools`,
			);
			config.tools = this.asProviderToolType(messageRequest.tools);
			logger.debug(
				`LlmProvider[${this.llmProviderName}]: Converted tools:`,
				JSON.stringify(config.tools, null, 2),
			);
		}

		// Prepare the request with the new structure
		const request: GenerateContentParameters = {
			model: model,
			contents: contents,
			config: config,
		};

		return request;
	}

	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			//logger.debug(`LlmProvider[${this.llmProviderName}]: speakWith-messageRequest`, JSON.stringify(messageRequest, null, 2));

			const providerMessageRequest = await this.asProviderMessageRequest(messageRequest, interaction);
			const model = providerMessageRequest.model;
			logger.info(`LlmProvider[${this.llmProviderName}]: Complete request with model:`, { model });

			const result = await this.google.models.generateContent(providerMessageRequest);
			//logger.info(`LlmProvider[${this.llmProviderName}]: `, result);
			logger.info(`LlmProvider[${this.llmProviderName}]: `, JSON.stringify({ result }, null, 2));

			// Check if response was blocked first
			if (result.promptFeedback?.blockReason) {
				throw createError(
					ErrorType.LLM,
					`Response blocked: ${result.promptFeedback.blockReason}`,
					{
						model: model,
						provider: this.llmProviderName,
						interactionId: interaction.id,
						name: 'GoogleLLMError',
						args: {
							reason: result.promptFeedback.blockReason,
							safetyRatings: result.promptFeedback.safetyRatings,
						},
					} as LLMErrorOptions,
				);
			}

			const candidate = result.candidates?.[0];
			if (!candidate) {
				throw createError(
					ErrorType.LLM,
					'No response candidate received from Google API and prompt was not blocked.',
					{
						model: model,
						provider: this.llmProviderName,
						interactionId: interaction.id,
						name: 'GoogleLLMError',
						args: { promptFeedback: result.promptFeedback, usageMetadata: result.usageMetadata },
					} as LLMErrorOptions,
				);
			}

			const messageResponse: LLMProviderMessageResponse = {
				id: crypto.randomUUID(),
				type: 'message',
				role: 'assistant',
				model: model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: this.asApiMessageContentPartsType(candidate),
				answer: extractTextFromContent(this.asApiMessageContentPartsType(candidate)),
				isTool: this.hasFunctionCall(candidate),
				messageStop: {
					// Map Google's finish reason to our stop reason format
					stopReason: (() => {
						logger.debug(
							`LlmProvider[${this.llmProviderName}]: Mapping finish reason: ${candidate.finishReason}`,
						);
						switch (candidate.finishReason) {
							case FinishReason.MAX_TOKENS:
								return 'max_tokens';
							case FinishReason.STOP:
								return 'stop';
							case FinishReason.SAFETY:
								return 'content_filter';
							case FinishReason.RECITATION:
								return 'content_filter';
							default:
								logger.info(
									`LlmProvider[${this.llmProviderName}]: Unmapped finish reason: ${candidate.finishReason}`,
								);
								return null;
						}
					})(),
					stopSequence: null,
				},
				usage: this.transformUsage(result.usageMetadata),
				rateLimit: {
					requestsRemaining: 1000, // Placeholder values
					requestsLimit: 1000,
					requestsResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
					tokensRemaining: 1000000,
					tokensLimit: 1000000,
					tokensResetDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
				},
				providerMessageResponseMeta: {
					statusCode: 200,
					statusText: 'OK',
				},
			};

			// Process safety ratings if present
			if (candidate.safetyRatings && candidate.safetyRatings.length > 0) {
				logger.debug(
					`LlmProvider[${this.llmProviderName}]: Processing ${candidate.safetyRatings.length} safety ratings`,
				);

				// Log each safety rating
				candidate.safetyRatings.forEach((rating: SafetyRating) => {
					logger.debug(
						`LlmProvider[${this.llmProviderName}]: Safety rating - Category: ${rating.category}, Probability: ${rating.probability}`,
					);
				});

				// Store safety ratings in extra field
				messageResponse.extra = {
					safetyRatings: candidate.safetyRatings,
				};
			}

			const llmRequestParams: LLMRequestParams = {
				modelConfig: {
					model: messageRequest.model,
					maxTokens: providerMessageRequest.config!.maxOutputTokens!,
					temperature: providerMessageRequest.config!.temperature!,
					extendedThinking: messageRequest.extendedThinking,
					usePromptCaching: this.projectConfig.api?.usePromptCaching ?? true,
				},
			};

			//logger.info(`LlmProvider[${this.llmProviderName}]: messageResponse`, messageResponse);
			return { messageResponse, messageMeta: { system: messageRequest.system, llmRequestParams } };
		} catch (err) {
			logger.error(`LlmProvider[${this.llmProviderName}]: Error calling Google API`, err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from Google API: ${(err as Error).message}`,
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
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				interaction.addMessageForToolResult(
					prevMessage.providerResponse.toolsUsed![0].toolUseId,
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema. Ensure you are using arrays and objects instead of JSON strings.",
					true,
				);
			} else {
				logger.warn(
					`LlmProvider[${this.llmProviderName}]: modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
		} else if (validationFailedReason === 'Empty answer') {
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected override checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		if (llmProviderMessageResponse.messageStop.stopReason) {
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'tool_calls':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response is using a tool`);
					break;
				case 'stop':
					logger.warn(`LlmProvider[${this.llmProviderName}]: Response reached its natural end`);
					break;
				default:
					logger.info(
						`LlmProvider[${this.llmProviderName}]: Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default GoogleLLM;
