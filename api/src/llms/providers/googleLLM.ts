import {
	FinishReason,
	FunctionCallingMode,
	GoogleGenerativeAI,
	//SchemaType
} from '@google/generative-ai';
import type {
	Content,
	FunctionCall,
	FunctionCallPart,
	FunctionDeclarationSchema,
	FunctionDeclarationsTool,
	GenerateContentCandidate,
	GenerateContentRequest,
	//GenerateContentResponse,
	//GenerateContentResult,
	//GenerativeContentBlob,
	//HarmCategory,
	//HarmProbability,
	InlineDataPart,
	//Part,
	SafetyRating,
	UsageMetadata,
} from '@google/generative-ai';
import { GoogleModel, LLMProvider } from 'api/types.ts';
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
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	LLMTokenUsage,
} from 'api/types/llms.ts';
import LLM from './baseLLM.ts';
import { logger } from 'shared/logger.ts';
import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';
import { BB_FILE_METADATA_DELIMITER } from 'api/llms/conversationInteraction.ts';

class GoogleLLM extends LLM {
	private google!: GoogleGenerativeAI;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.GOOGLE;
		this.initializeGoogleClient();
	}

	private initializeGoogleClient() {
		const apiKey = this.projectConfig.settings.api?.llmProviders?.google?.apiKey;
		if (!apiKey) {
			throw createError(
				ErrorType.LLM,
				'Google API key is not configured',
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}
		this.google = new GoogleGenerativeAI(apiKey);
	}

	private transformUsage(usageMetadata?: UsageMetadata): LLMTokenUsage {
		if (!usageMetadata) {
			return {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
				cacheCreationInputTokens: 0,
				cacheReadInputTokens: 0,
				totalAllTokens: 0,
			};
		}
		return {
			inputTokens: usageMetadata.promptTokenCount,
			outputTokens: usageMetadata.candidatesTokenCount,
			totalTokens: usageMetadata.totalTokenCount,
			cacheCreationInputTokens: 0, // Google doesn't use this
			cacheReadInputTokens: usageMetadata.cachedContentTokenCount || 0,
			totalAllTokens: usageMetadata.totalTokenCount,
		};
	}

	private asProviderMessageType(messages: LLMMessage[]): Content[] {
		//logger.info('llms-google-asProviderMessageType-messages', messages);

		const mapMessageToContent = (message: LLMMessage) => {
			// Log the message being processed
			logger.debug(`Processing message role=${message.role}, content parts=${message.content.length}`);

			return {
				role: message.role === 'assistant' ? 'model' : message.role,
				parts: message.content.map((part) => {
					if (part.type === 'text') {
						// Check if this is a metadata block
						if (part.text.includes(BB_FILE_METADATA_DELIMITER)) {
							logger.debug('Found file metadata block, preserving as-is');
							return { text: part.text };
						}
						// For regular text content
						logger.debug('Processing regular text content');
						return { text: part.text };
					} else if (part.type === 'image') {
						logger.debug('Processing image content');
						return {
							inlineData: {
								data: part.source.data,
								mimeType: part.source.media_type,
							},
						} as InlineDataPart;
					} else if (part.type === 'tool_use') {
						logger.debug('Processing tool_use content');
						return {
							functionCall: {
								name: part.name, //contentPart.id,
								args: part.input,
							} as FunctionCall,
						} as FunctionCallPart;
					} else if (part.type === 'tool_result') {
						logger.debug(`Processing tool result content, tool_use_id=${part.tool_use_id}`);
						// For tool results, we need to process each content part
						const processedContent = part.content?.map((p) => {
							if (p.type === 'text') {
								// Check if this is a metadata block
								if (p.text.includes(BB_FILE_METADATA_DELIMITER)) {
									logger.debug('Found file metadata in tool result, preserving as-is');
									return { text: p.text };
								}
								return { text: p.text };
							} else if (p.type === 'image') {
								logger.debug('Processing image in tool result');
								return {
									inlineData: {
										data: p.source.data,
										mimeType: p.source.media_type,
									},
								} as InlineDataPart;
							}
							logger.warn(`Unsupported content type in tool result: ${(p as { type: string }).type}`);
							return { text: '' };
						});

						// Convert processed content into a response object
						const responseText = processedContent?.map((p) => 'text' in p ? p.text : '').join('') || '';
						logger.debug(
							`Creating function response for tool ${part.tool_use_id}, response length: ${responseText.length}`,
						);
						return {
							functionResponse: {
								name: part.tool_use_id || '',
								response: { toolResults: responseText },
								//response: processedContent,
							},
						};
					}
					logger.warn(`Unsupported content part type: ${part.type}`);
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
			logger.warn('Found user message with multiple tool_use parts. Splitting messages.');
			const userMessageIndex = messages.indexOf(userMessageWithMultipleToolUse);
			const assistantMessage = messages[userMessageIndex + 1];

			if (!assistantMessage || assistantMessage.role !== 'assistant') {
				logger.error('Could not find corresponding assistant message. Aborting split.');
				return messages.map(mapMessageToContent);
			}

			const newUserMessages: LLMMessage[] = [];
			const toolUseParts = userMessageWithMultipleToolUse.content.filter((part) => part.type === 'tool_use');
			const toolResultParts = assistantMessage.content.filter((part) => part.type === 'tool_result');

			if (toolUseParts.length !== toolResultParts.length) {
				logger.error(
					'Number of tool_use parts does not match number of tool_result parts. Aborting split.',
				);
				return messages.map(mapMessageToContent);
			}

			for (let i = 0; i < toolUseParts.length; i++) {
				const newUserMessage = new LLMMessage(
					'user',
					[toolUseParts[i]],
					userMessageWithMultipleToolUse.conversationStats,
					userMessageWithMultipleToolUse.tool_call_id,
					userMessageWithMultipleToolUse.providerResponse,
					userMessageWithMultipleToolUse.id,
				);
				const newAssistantMessage = new LLMMessage(
					'assistant',
					[toolResultParts[i]],
					assistantMessage.conversationStats,
					assistantMessage.tool_call_id,
					assistantMessage.providerResponse,
					assistantMessage.id,
				);
				newUserMessages.push(newUserMessage);
				newUserMessages.push(newAssistantMessage);
			}

			// Replace the original messages with the new ones
			messages.splice(userMessageIndex, 2, ...newUserMessages);
			logger.info('Messages split successfully.');
		}

		const providerMessages = messages.map(mapMessageToContent);
		logger.info('llms-google-asProviderMessageType-providerMessages', JSON.stringify(providerMessages, null, 2));
		return providerMessages;
	}

	/**
	 * Clean and validate a schema object for Google's function calling API
	 * Ensures schema types are lowercase and removes unsupported fields
	 * @param schema The schema object to clean
	 * @returns Cleaned schema object conforming to Google's Schema format
	 */
	private cleanSchema(schema: LLMToolInputSchema): FunctionDeclarationSchema {
		// deno-lint-ignore no-explicit-any
		const clean = (obj: Record<string, any>): Record<string, any> => {
			if (!obj || typeof obj !== 'object') return obj;

			const cleaned = { ...obj };
			delete cleaned.default;

			return Object.entries(cleaned).reduce((acc, [key, value]) => ({
				...acc,
				[key]: Array.isArray(value)
					? value.map((item) => clean(item))
					: typeof value === 'object'
					? clean(value)
					: value,
			}), {});
		};

		return clean(schema) as FunctionDeclarationSchema;
	}

	/*
	private cleanSchema(schema: LLMToolInputSchema): FunctionDeclarationSchema {
		logger.debug('Cleaning schema:', schema);

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

	private asProviderToolType(tools: LLMTool[]): FunctionDeclarationsTool[] {
		return tools.map((tool) => {
			logger.debug(`Converting tool to Google format: ${tool.name}`);

			// Convert the input schema
			const cleanedSchema = this.cleanSchema(tool.inputSchema);
			logger.debug('Cleaned schema:', cleanedSchema);

			// Create function declaration
			const functionDeclaration = {
				name: tool.name,
				description: tool.description,
				parameters: cleanedSchema,
			};

			logger.debug('Created function declaration:', functionDeclaration);
			return {
				functionDeclarations: [functionDeclaration],
			};
		});
	}

	private asApiMessageContentPartsType(candidate: GenerateContentCandidate): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];

		candidate.content.parts?.forEach((part) => {
			if ('text' in part) {
				logger.debug('Processing text content from response');
				contentParts.push({
					type: 'text',
					text: part.text,
				} as LLMMessageContentPartTextBlock);
			} else if ('functionCall' in part && part.functionCall !== undefined) {
				// Google's FunctionCall provides args as an object, no need to parse
				logger.debug(`Processing function call: ${part.functionCall.name}`);
				contentParts.push({
					type: 'tool_use',
					id: part.functionCall.name,
					name: part.functionCall.name,
					input: part.functionCall.args,
				} as LLMMessageContentPartToolUseBlock);
			} else if ('inlineData' in part && part.inlineData !== undefined) {
				logger.debug('Processing image content from response');
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

	private hasFunctionCall(candidate: GenerateContentCandidate): boolean {
		return candidate.content.parts?.some((part) => 'functionCall' in part) || false;
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<GenerateContentRequest> {
		const contents = this.asProviderMessageType(messageRequest.messages);
		const model = messageRequest.model || GoogleModel.GOOGLE_GEMINI_2_0_FLASH;

		// System instruction needs to be wrapped in a Content object
		const systemContent: Content | undefined = messageRequest.system
			? {
				role: 'user',
				parts: [{ text: messageRequest.system }],
			}
			: undefined;

		// Resolve parameters using model capabilities
		let maxTokens: number;
		let temperature: number;
		//let extendedThinking: boolean;

		if (interaction) {
			// Use interaction to resolve parameters with proper priority
			const resolved = await interaction.resolveModelParameters(
				model,
				{
					maxTokens: messageRequest.maxTokens,
					temperature: messageRequest.temperature,
					//extendedThinking: messageRequest.extendedThinking?.enabled,
				},
				LLMProvider.GOOGLE,
			);
			maxTokens = resolved.maxTokens;
			//extendedThinking = resolved.extendedThinking;
			temperature = resolved.temperature;
		} else {
			// Fallback if interaction is not provided
			const capabilitiesManager = await ModelCapabilitiesManager.getInstance().initialize();

			maxTokens = capabilitiesManager.resolveMaxTokens(
				model,
				messageRequest.maxTokens,
			);
			temperature = capabilitiesManager.resolveTemperature(
				model,
				messageRequest.temperature,
			);
			//extendedThinking = capabilitiesManager.resolveExtendedThinking(
			//	model,
			//	messageRequest.extendedThinking?.enabled,
			//);
		}

		// Prepare the request with appropriate configuration
		const request: GenerateContentRequest = {
			//contents: systemContent ? [systemContent, ...contents] : contents,
			contents,
			systemInstruction: systemContent,
			generationConfig: {
				temperature: temperature,
				maxOutputTokens: maxTokens,
			},
			//stream: false
		};

		// Add tools and tool configuration if tools are present
		if (messageRequest.tools.length > 0) {
			logger.debug(`Adding tool configuration for ${messageRequest.tools.length} tools`);

			// Convert tools and log the result
			const convertedTools = this.asProviderToolType(messageRequest.tools);
			logger.debug('Converted tools:', JSON.stringify(convertedTools, null, 2));

			// Add tools to request
			request.tools = convertedTools;
			request.toolConfig = {
				functionCallingConfig: {
					mode: FunctionCallingMode.AUTO, // Default to AUTO mode
				},
			};

			// Log the complete request for debugging
			logger.debug('Complete request with tools:', JSON.stringify(request, null, 2));
		}

		return request;
	}

	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.debug('llms-google-speakWith-messageRequest', JSON.stringify(messageRequest, null, 2));

			const providerMessageRequest = await this.asProviderMessageRequest(messageRequest, interaction);
			const model = messageRequest.model || GoogleModel.GOOGLE_GEMINI_2_0_FLASH;

			const result = await this.google.getGenerativeModel({ model }).generateContent(providerMessageRequest);
			logger.info('llms-google-result', result);
			const response = result.response;
			logger.debug('llms-google-response', response);

			const candidate = response.candidates?.[0];
			if (!candidate) {
				throw new Error('No response candidate received');
			}

			// Check if response was blocked
			if (response.promptFeedback?.blockReason) {
				throw createError(
					ErrorType.LLM,
					`Response blocked: ${response.promptFeedback.blockReason}`,
					{
						model: model,
						provider: this.llmProviderName,
						args: { reason: response.promptFeedback.blockReason },
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
						logger.debug(`Mapping finish reason: ${candidate.finishReason}`);
						switch (candidate.finishReason) {
							case FinishReason.MAX_TOKENS:
								return 'max_tokens';
							case FinishReason.STOP:
								return 'stop';
							case FinishReason.SAFETY:
							case FinishReason.PROHIBITED_CONTENT:
							case FinishReason.BLOCKLIST:
								return 'content_filter';
							case FinishReason.MALFORMED_FUNCTION_CALL:
								logger.warn(`Function call was malformed: ${candidate.finishReason}`);
								return 'tool_calls';
							default:
								logger.info(`Unmapped finish reason: ${candidate.finishReason}`);
								return null;
						}
					})(),
					stopSequence: null,
				},
				usage: this.transformUsage(response.usageMetadata),
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
				logger.debug(`Processing ${candidate.safetyRatings.length} safety ratings`);

				// Log each safety rating
				candidate.safetyRatings.forEach((rating: SafetyRating) => {
					logger.debug(`Safety rating - Category: ${rating.category}, Probability: ${rating.probability}`);
				});

				// Store safety ratings in extra field
				messageResponse.extra = {
					safetyRatings: candidate.safetyRatings,
				};
			}

			logger.info('llms-google-messageResponse', messageResponse);
			return { messageResponse, messageMeta: { system: messageRequest.system } };
		} catch (err) {
			logger.error('Error calling Google API', err);
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
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					true,
				);
			} else {
				logger.warn(
					`provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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
					logger.warn(`provider[${this.llmProviderName}] Response is using a tool`);
					break;
				case 'stop':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default GoogleLLM;
