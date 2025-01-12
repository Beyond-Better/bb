import { OpenAI } from 'openai';
import ms from 'ms';

import { LLMCallbackType, LLMProvider, OpenAIModel } from 'api/types.ts';
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
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from 'api/types.ts';
import { extractTextFromContent } from 'api/utils/llms.ts';

class OpenAILLM extends LLM {
	private openai!: OpenAI;

	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.OPENAI;

		this.initializeOpenAIClient();
	}

	private async initializeOpenAIClient() {
		const apiKey = this.projectConfig.settings.api?.llmKeys?.openai;
		if (!apiKey) {
			throw new Error('OpenAI API key is not set');
		}
		this.openai = new OpenAI({ apiKey });
	}

	private asProviderMessageType(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
		logger.info('llms-openai-asProviderMessageType-messages', messages);
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

		logger.info('llms-openai-asProviderMessageType-providerMessages', providerMessages);
		return providerMessages;
	}

	private asProviderToolType(tools: LLMTool[]): OpenAI.Chat.ChatCompletionTool[] {
		//logger.info('llms-openai-asProviderToolType', tools);
		return tools.map((tool) => ({
			'type': 'function',
			'function': {
				name: tool.name,
				description: tool.description,
				parameters: tool.inputSchema,
			},
		} as OpenAI.Chat.ChatCompletionTool));
	}

	private asApiMessageContentPartsType(choices: OpenAI.Chat.ChatCompletion.Choice[]): LLMMessageContentPart[] {
		const contentParts: LLMMessageContentParts = [];
		// CNG - we really just want the first choice, not any of the alternatives, so let's refactor... just use the first element, don't loop
		// But leaving old code here to show we **could** look for alternate choices provided by OpenAI - eg loop through and "choose" our fave choice.
		//choices.forEach( (choice: OpenAI.Chat.ChatCompletion.Choice): void => {
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
		//});
		return contentParts;
	}

	override async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<OpenAI.Chat.ChatCompletionCreateParams> {
		const messages = this.asProviderMessageType(speakOptions?.messages || interaction.getMessages());
		const tools = this.asProviderToolType(
			await this.invoke(
				LLMCallbackType.PREPARE_TOOLS,
				speakOptions?.tools || interaction.allTools(),
				interaction.id,
			),
		);
		//logger.info('llms-openai-prepareMessageParams-tools', { tools });
		const system = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
			interaction.id,
		);
		const model: string = speakOptions?.model || interaction.model || OpenAIModel.GPT_4o;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens;
		const temperature: number = speakOptions?.temperature || interaction.temperature;
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = { role: 'system', content: system };

		const messageParams: OpenAI.Chat.ChatCompletionCreateParams = {
			messages: [systemMessage, ...messages],
			//tools,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		if (tools.length > 0) messageParams.tools = tools;
		//logger.info('llms-openai-prepareMessageParams', messageParams);

		return messageParams;
	}

	/**
	 * Run OpenAI service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from OpenAI or an error
	 */
	public override async speakWith(
		messageParams: LLMProviderMessageRequest,
		_interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.debug('llms-openai-speakWith-messageParams', JSON.stringify(messageParams, null, 2));

			const { data: openaiMessageStream, response: openaiResponse } = await this.openai.chat.completions.create(
				messageParams as OpenAI.Chat.ChatCompletionCreateParams,
			).withResponse();

			const openaiMessage = openaiMessageStream as OpenAI.Chat.ChatCompletion;
			//logger.debug('llms-openai-openaiMessage', JSON.stringify(openaiMessage, null, 2));
			logger.debug('llms-openai-openaiMessage', openaiMessage);

			const headers = openaiResponse?.headers;

			const requestsRemaining = Number(headers.get('x-ratelimit-remaining-requests'));
			const requestsLimit = Number(headers.get('x-ratelimit-limit-requests'));
			const requestsResetMs = ms(headers.get('x-ratelimit-reset-requests') || '0') as number;
			const requestsResetDate = new Date(Date.now() + requestsResetMs);

			const tokensRemaining = Number(headers.get('x-ratelimit-remaining-tokens'));
			const tokensLimit = Number(headers.get('x-ratelimit-limit-tokens'));
			const tokensResetMs = ms(headers.get('x-ratelimit-reset-tokens') || '0') as number;
			const tokensResetDate = new Date(Date.now() + tokensResetMs);

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
				), // answer will get overridden in baseLLM - but this keeps type checking happy
				isTool: openaiMessage.choices[0].finish_reason === 'tool_calls',
				messageStop: {
					stopReason: openaiMessage.choices[0].finish_reason,
					stopSequence: '', //openaiMessage.stop_sequence,
				},
				usage: {
					inputTokens: openaiMessage.usage?.prompt_tokens ?? 0,
					outputTokens: openaiMessage.usage?.completion_tokens ?? 0,
					totalTokens: openaiMessage.usage?.total_tokens ?? 0,
					cacheCreationInputTokens: openaiMessage.usage?.prompt_tokens_details?.cached_tokens ?? 0,
					//cacheReadInputTokens: 0,
				},
				extra: {
					system_fingerprint: openaiMessage.system_fingerprint,
					created: openaiMessage.created,
					logprobs: openaiMessage.choices[0].logprobs,
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
					statusCode: openaiResponse.status,
					statusText: openaiResponse.statusText,
				},
			};
			logger.debug('llms-openai-messageResponse', messageResponse);

			return { messageResponse, messageMeta: { system: messageParams.system } };
		} catch (err) {
			logger.error('Error calling OpenAI API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from OpenAI API.',
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
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
				interaction.addMessageForToolResult(
					prevMessage.providerResponse.toolsUsed![0].toolUseId,
					"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					true,
					//{
					//	role: 'tool',
					//	tool_call_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
					//	content: [
					//		{
					//			'type': 'text',
					//			'text':
					//				"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
					//		} as LLMMessageContentPartTextBlock,
					//	],
					//},
				);
			} else {
				logger.warn(
					`provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
				);
			}
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
				case 'length':
					logger.warn(`provider[${this.llmProviderName}] Response reached the maximum token limit`);
					break;
				case 'stop':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'content_filter':
					logger.warn(
						`provider[${this.llmProviderName}] Response content was omitted due to a flag from provider content filters`,
					);
					break;
				case 'tool_calls':
					logger.warn(`provider[${this.llmProviderName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.llmProviderName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default OpenAILLM;
