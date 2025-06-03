import { OpenAI } from 'openai';
//import ms from 'ms';

import { LLMCallbackType, type LLMProvderClientConfig } from 'api/types.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from 'api/llms/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMRateLimit,
	LLMRequestParams,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
	LLMTokenUsage,
} from 'api/types.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

// Configuration interface for OpenAI-compatible providers
export interface OpenAICompatConfig extends LLMProvderClientConfig {
	apiKey?: string;
	baseURL?: string;
	defaultModel: string;
}

abstract class OpenAICompatLLM<TUsage = OpenAI.CompletionUsage> extends LLM {
	protected openai!: OpenAI;
	protected apiKey?: string;
	protected baseURL?: string;
	private _defaultModel?: string;

	// Override the getter from the base class
	protected override get defaultModel(): string | undefined {
		return this._defaultModel;
	}

	// Setter for defaultModel
	protected override set defaultModel(value: string | undefined) {
		this._defaultModel = value;
	}

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		//this.initializeOpenAIClient(); // called by child class
	}

	protected initializeOpenAIClient() {
		if (!this.apiKey) {
			throw createError(
				ErrorType.LLM,
				`${this.llmProviderName} API key is not set`,
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}
		this.openai = new OpenAI({
			apiKey: this.apiKey,
			baseURL: this.baseURL,
		});
	}

	protected asProviderMessageType(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
		logger.info(`llms-${this.llmProviderName}-asProviderMessageType-messages`, messages);
		const providerMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		messages.forEach((message, _index, _array) => {
			if (message.role === 'assistant') {
				const providerContentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
				const providerToolCallParts: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

				message.content.forEach((contentPart, _index, _array) => {
					if (contentPart.type === 'tool_use') {
						providerToolCallParts.push({
							id: contentPart.id,
							type: 'function',
							function: {
								name: contentPart.name,
								arguments: JSON.stringify(contentPart.input),
							},
						} as OpenAI.Chat.ChatCompletionMessageToolCall);
					} else if (contentPart.type === 'text') {
						providerContentParts.push({
							type: 'text',
							text: contentPart.text,
						} as OpenAI.Chat.ChatCompletionContentPartText);
					}
				});
				const assistantMessage = {
					role: 'assistant',
					content: providerContentParts,
				} as OpenAI.Chat.ChatCompletionAssistantMessageParam;
				if (providerToolCallParts.length > 0) assistantMessage.tool_calls = providerToolCallParts;

				providerMessages.push(assistantMessage);
			} else if (message.role === 'user') {
				const providerContentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];

				message.content.forEach((contentPart, _index, _array) => {
					if (contentPart.type === 'tool_result') {
						providerMessages.push({
							role: 'tool',
							content: contentPart.content?.map((p) => {
								if (p.type === 'text' && p.text) {
									return {
										type: 'text',
										text: p.text,
									};
								}
								if (p.type === 'image') {
									return {
										type: 'image_url',
										image_url: { url: p.source.data },
									};
								}
								return '';
							}) ?? [] as OpenAI.Chat.ChatCompletionContentPartText[],
							tool_call_id: contentPart.tool_use_id,
						} as OpenAI.Chat.ChatCompletionToolMessageParam);
					} else if (contentPart.type === 'text') {
						providerContentParts.push({
							type: 'text',
							text: contentPart.text,
						} as OpenAI.Chat.ChatCompletionContentPartText);
					} else if (contentPart.type === 'image') {
						providerContentParts.push({
							type: 'image_url',
							image_url: { url: contentPart.source.data },
						} as OpenAI.Chat.ChatCompletionContentPartImage);
					}
				});

				if (providerContentParts.length > 0) {
					providerMessages.push({
						role: 'user',
						content: providerContentParts,
					} as OpenAI.Chat.ChatCompletionMessageParam);
				}
			} else {
				throw new Error(`Unsupported role: ${message.role}`);
			}
		});

		logger.info(`llms-${this.llmProviderName}-asProviderMessageType-providerMessages`, providerMessages);
		return providerMessages;
	}

	protected asProviderToolType(tools: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] {
		return tools.map((tool) => ({
			'type': 'function',
			'function': {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		} as OpenAI.Chat.ChatCompletionTool));
	}

	protected asApiMessageContentPartsType(choices: OpenAI.Chat.ChatCompletion.Choice[]): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];
		const choice: OpenAI.Chat.ChatCompletion.Choice = choices[0];
		const message: OpenAI.Chat.ChatCompletionMessage = choice.message;
		if (message.content) {
			contentParts.push({
				type: 'text',
				text: message.content,
			} as LLMMessageContentPartTextBlock);
		}
		if (message.tool_calls) {
			contentParts.push({
				id: message.tool_calls[0].id,
				type: 'tool_use',
				name: message.tool_calls[0].function.name,
				input: JSON.parse(message.tool_calls[0].function.arguments),
			} as LLMMessageContentPartToolUseBlock);
		}
		return contentParts;
	}

	override async asProviderMessageRequest(
		messageRequest: LLMProviderMessageRequest,
		interaction?: LLMInteraction,
	): Promise<OpenAI.Chat.ChatCompletionCreateParams> {
		const messages = this.asProviderMessageType(messageRequest.messages);
		const tools = this.asProviderToolType(messageRequest.tools);
		const system = messageRequest.system;
		const model: string = messageRequest.model;

		// Resolve parameters using model capabilities if interaction is provided
		let maxTokens: number;
		let temperature: number;
		//let extendedThinking: boolean;

		if (interaction) {
			const resolved = await interaction.resolveModelParameters(
				model,
				{
					maxTokens: messageRequest.maxTokens,
					temperature: messageRequest.temperature,
					//extendedThinking: messageRequest.extendedThinking?.enabled,
				},
			);
			maxTokens = resolved.maxTokens;
			temperature = resolved.temperature;
			//extendedThinking = resolved.extendedThinking;
		} else {
			// Fallback if interaction is not provided
			const projectEditor = await this.invoke(LLMCallbackType.PROJECT_EDITOR);
			const capabilitiesManager = await ModelCapabilitiesManager.getInstance(projectEditor.projectConfig);

			maxTokens = capabilitiesManager.resolveMaxTokens(
				model,
				messageRequest.maxTokens,
			);

			// extendedThinking = capabilitiesManager.resolveExtendedThinking(
			// 	model,
			// 	messageRequest.extendedThinking?.enabled,
			// );

			temperature = capabilitiesManager.resolveTemperature(
				model,
				messageRequest.temperature,
			);
		}
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = { role: 'system', content: system };

		const providerMessageRequest: OpenAI.Chat.ChatCompletionCreateParams = {
			messages: [systemMessage, ...messages],
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		if (tools.length > 0) providerMessageRequest.tools = tools;

		return providerMessageRequest;
	}

	// Default empty implementation for providers that don't support rate limiting
	protected processResponseMetadata(
		_response: Response,
		_messageResponse: LLMProviderMessageResponse,
	): void {}

	protected abstract transformRateLimit(_response: Response): LLMRateLimit;
	protected abstract transformUsage(usage: TUsage | undefined): LLMTokenUsage;

	public override async speakWith(
		messageRequest: LLMProviderMessageRequest,
		interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.debug(
				`llms-${this.llmProviderName}-speakWith-messageRequest`,
				JSON.stringify(messageRequest, null, 2),
			);

			const providerMessageRequest: OpenAI.Chat.ChatCompletionCreateParams = await this.asProviderMessageRequest(
				messageRequest,
				interaction,
			);

			const { data: openaiMessageStream, response: openaiResponse } = await this.openai.chat.completions.create(
				providerMessageRequest,
			).withResponse();

			const openaiMessage = openaiMessageStream as OpenAI.Chat.ChatCompletion;
			logger.debug(`llms-${this.llmProviderName}-openaiMessage`, openaiMessage);

			const messageResponse: LLMProviderMessageResponse = {
				id: openaiMessage.id,
				type: openaiMessage.object === 'chat.completion' ? 'message' : 'error',
				role: openaiMessage.choices[0].message.role,
				model: openaiMessage.model,
				fromCache: false,
				timestamp: new Date().toISOString(),
				answerContent: this.asApiMessageContentPartsType(openaiMessage.choices),
				answer: extractTextFromContent(
					this.asApiMessageContentPartsType(openaiMessage.choices) as LLMMessageContentParts,
				),
				isTool: openaiMessage.choices[0].finish_reason === 'tool_calls',
				messageStop: {
					stopReason: openaiMessage.choices[0].finish_reason,
					stopSequence: '',
				},
				usage: this.transformUsage(openaiMessage.usage as TUsage),
				rateLimit: this.transformRateLimit(openaiResponse),
				extra: {
					system_fingerprint: openaiMessage.system_fingerprint,
					created: openaiMessage.created,
					logprobs: openaiMessage.choices[0].logprobs,
				},
				providerMessageResponseMeta: {
					statusCode: openaiResponse.status,
					statusText: openaiResponse.statusText,
				},
			};

			// Process provider-specific response metadata (like rate limits)
			this.processResponseMetadata(openaiResponse, messageResponse);

			logger.debug(`llms-${this.llmProviderName}-messageResponse`, messageResponse);

			// Include request parameters in messageMeta
			const requestParams: LLMRequestParams = {
				model: messageRequest.model,
				maxTokens: providerMessageRequest.max_tokens!,
				temperature: providerMessageRequest.temperature!,
				extendedThinking: messageRequest.extendedThinking,
			};

			return {
				messageResponse,
				messageMeta: {
					system: messageRequest.system,
					requestParams,
				},
			};
		} catch (err) {
			logger.error(`Error calling ${this.llmProviderName} API`, err);
			throw createError(
				ErrorType.LLM,
				`Could not get response from ${this.llmProviderName} API: ${(err as Error).message}`,
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
					`provider[${this.llmProviderName}]: modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
		} else if (validationFailedReason === 'Empty answer') {
			speakOptions.temperature = speakOptions.temperature ? Math.min(speakOptions.temperature + 0.1, 1) : 0.5;
		}
	}

	protected override checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		if (llmProviderMessageResponse.messageStop.stopReason) {
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'length':
					logger.warn(`provider[${this.llmProviderName}]: Response reached the maximum token limit`);
					break;
				case 'stop':
					logger.warn(`provider[${this.llmProviderName}]: Response reached its natural end`);
					break;
				case 'content_filter':
					logger.warn(
						`provider[${this.llmProviderName}]: Response content was omitted due to a flag from provider content filters`,
					);
					break;
				case 'tool_calls':
					logger.warn(`provider[${this.llmProviderName}]: Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}]: Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default OpenAICompatLLM;
