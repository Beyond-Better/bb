import { OpenAI } from 'openai';
import { ms } from 'ms';

import { LLMProvider, OpenAIModel } from 'api/types.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from '../interactions/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type {
	LLMMessageContentPart,
	LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolUseBlock,
} from 'api/llms/llmMessage.ts';
import type LLMTool from 'api/llms/llmTool.ts';
import { createError } from '../../utils/error.utils.ts';
import { ErrorType, type LLMErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import type {
	LLMCallbacks,
	LLMProviderMessageRequest,
	LLMProviderMessageResponse,
	LLMSpeakWithOptions,
	LLMSpeakWithResponse,
} from '../../types.ts';

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
		return messages.map((message) => ((message.role === 'system' || message.role === 'user'
			? {
				role: message.role,
				content: message.content,
			}
			: message.role === 'assistant'
			? (message.content[0].type === 'tool_use'
				? {
					role: message.role,
					content: null,
					tool_calls: [{
						id: message.content[0].id,
						type: 'function',
						function: {
							name: message.content[0].name,
							arguments: JSON.stringify(message.content[0].input),
						},
					}],
				}
				: {
					role: message.role,
					content: message.content,
				})
			: message.role === 'tool'
			? {
				role: message.role,
				tool_call_id: message.tool_call_id,
				content: message.content,
			}
			: {
				role: message.role,
				content: message.content,
			}) as OpenAI.Chat.ChatCompletionMessageParam)
		);
	}

	private asProviderToolType(tools: Map<string, LLMTool>): OpenAI.Chat.ChatCompletionTool[] {
		return Array.from(tools.values()).map((tool) => ({
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

	public async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<OpenAI.Chat.ChatCompletionCreateParams> {
		const messages = this.asProviderMessageType(speakOptions?.messages || interaction.getMessages());
		const tools = this.asProviderToolType(speakOptions?.tools || interaction.allTools());
		const system: string = speakOptions?.system || interaction.baseSystem;
		const model: string = speakOptions?.model || interaction.model || OpenAIModel.GPT_4o;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens;
		const temperature: number = speakOptions?.temperature || interaction.temperature;
		const systemMessage: OpenAI.Chat.ChatCompletionSystemMessageParam = { role: 'system', content: system };

		const messageParams: OpenAI.Chat.ChatCompletionCreateParams = {
			messages: [systemMessage, ...messages],
			tools,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		//logger.debug('llms-openai-prepareMessageParams', messageParams);

		return messageParams;
	}

	/**
	 * Run OpenAI service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from OpenAI or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest,
		_interaction: LLMInteraction,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.debug('llms-openai-speakWith-messageParams', JSON.stringify(messageParams, null, 2));

			const { data: openaiMessageStream, response: openaiResponse } = await this.openai.chat.completions.create(
				messageParams as OpenAI.Chat.ChatCompletionCreateParams,
			).withResponse();

			const openaiMessage = openaiMessageStream as OpenAI.Chat.ChatCompletion;
			logger.debug('llms-openai-openaiMessage', JSON.stringify(openaiMessage, null, 2));

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
				isTool: openaiMessage.choices[0].finish_reason === 'tool_calls',
				messageStop: {
					stopReason: openaiMessage.choices[0].finish_reason,
					stopSequence: '', //openaiMessage.stop_sequence,
				},
				usage: {
					inputTokens: openaiMessage.usage?.prompt_tokens ?? 0,
					outputTokens: openaiMessage.usage?.completion_tokens ?? 0,
					totalTokens: openaiMessage.usage?.total_tokens ?? 0,
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
					status: openaiResponse.status,
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

	protected modifySpeakWithInteractionOptions(
		interaction: LLMInteraction,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = interaction.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				interaction.addMessage({
					//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
					role: 'tool',
					tool_call_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
					content: [
						{
							'type': 'text',
							'text':
								"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
						} as LLMMessageContentPartTextBlock,
					],
				});
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

	protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
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
