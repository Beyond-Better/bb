import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMProvider } from 'shared/types.ts';
import LLM from './baseLLM.ts';
import LLMConversation from '../conversation.ts';
import LLMMessage, { LLMMessageContentParts } from '../message.ts';
import type { LLMMessageContentPartTextBlock, LLMMessageContentPartToolResultBlock } from '../message.ts';
import LLMTool from '../tool.ts';
import { createError } from '../../utils/error.utils.ts';
import { ErrorType, LLMErrorOptions } from '../../errors/error.ts';
import { logger } from 'shared/logger.ts';
import { config } from '../../config/config.ts';
import type { LLMProviderMessageRequest, LLMProviderMessageResponse, LLMSpeakWithOptions } from 'shared/types.ts';

class AnthropicLLM extends LLM {
	private anthropic: Anthropic;

	constructor() {
		super();
		this.providerName = LLMProvider.ANTHROPIC;

		const clientOptions: ClientOptions = {
			apiKey: config.anthropicApiKey,
		};
		this.anthropic = new Anthropic(clientOptions);
	}

	private asProviderMessageType(messages: LLMMessage[]): Anthropic.MessageParam[] {
		return messages.map((message) => ({
			role: message.role,
			content: message.content,
		} as Anthropic.MessageParam));
	}

	private asProviderToolType(tools: LLMTool[]): Anthropic.Tool[] {
		return tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
			input_schema: tool.input_schema,
		} as Anthropic.Tool));
	}

	public prepareMessageParams(
		conversation: LLMConversation,
		speakOptions?: LLMSpeakWithOptions,
	): Anthropic.MessageCreateParams {
		const messages = this.asProviderMessageType(speakOptions?.messages || conversation.getMessages());
		const tools = this.asProviderToolType(speakOptions?.tools || conversation.getTools());
		const system: string = speakOptions?.system || conversation.system;
		const model: string = speakOptions?.model || conversation.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || conversation.maxTokens;
		const temperature: number = speakOptions?.temperature || conversation.temperature;

		const messageParams: Anthropic.MessageCreateParams = {
			messages,
			tools,
			system,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		//logger.debug("llms-anthropic-prepareMessageParams", messageParams);

		return messageParams;
	}

	/**
	 * Run Anthropic service
	 * @param conversation LLMConversation
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest
	): Promise<LLMProviderMessageResponse> {
		try {
			logger.info('llms-anthropic-speakWith-messageParams', messageParams);

			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
				messageParams as Anthropic.MessageCreateParams,
			).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Message;
			logger.info('llms-anthropic-anthropicMessage', anthropicMessage);

			const headers = anthropicResponse?.headers;

			const requestsRemaining = Number(headers.get('anthropic-ratelimit-requests-remaining'));
			const requestsLimit = Number(headers.get('anthropic-ratelimit-requests-limit'));
			const requestsResetDate = new Date(headers.get('anthropic-ratelimit-requests-reset') || '');

			const tokensRemaining = Number(headers.get('anthropic-ratelimit-tokens-remaining'));
			const tokensLimit = Number(headers.get('anthropic-ratelimit-tokens-limit'));
			const tokensResetDate = new Date(headers.get('anthropic-ratelimit-tokens-reset') || '');

			const messageResponse: LLMProviderMessageResponse = {
				id: anthropicMessage.id,
				type: anthropicMessage.type,
				role: anthropicMessage.role,
				model: anthropicMessage.model,
				fromCache: false,
				answerContent: anthropicMessage.content as LLMMessageContentParts,
				isTool: anthropicMessage.stop_reason === 'tool_use',
				messageStop: {
					stopReason: anthropicMessage.stop_reason,
					stopSequence: anthropicMessage.stop_sequence,
				},
				usage: {
					inputTokens: anthropicMessage.usage.input_tokens,
					outputTokens: anthropicMessage.usage.output_tokens,
					totalTokens: (anthropicMessage.usage.input_tokens + anthropicMessage.usage.output_tokens),
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
					status: anthropicResponse.status,
					statusText: anthropicResponse.statusText,
				},
			};
			//logger.debug("llms-anthropic-messageResponse", messageResponse);

			return messageResponse;
		} catch (err) {
			logger.error('Error calling Anthropic API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from Anthropic API.',
				{
					model: messageParams.model,
					provider: this.providerName,
				} as LLMErrorOptions,
			);
		}
	}

	protected modifySpeakWithConversationOptions(
		conversation: LLMConversation,
		speakOptions: LLMSpeakWithOptions,
		validationFailedReason: string,
	): void {
		if (validationFailedReason.startsWith('Tool input validation failed')) {
			// Prompt the model to provide a valid tool input
			const prevMessage = conversation.getLastMessage();
			if (prevMessage && prevMessage.providerResponse && prevMessage.providerResponse.isTool) {
				conversation.addMessage({
					role: 'user',
					//[TODO] we're assuming a single tool is provided, and we're assuming only a single tool is used by LLM
					content: [
						{
							type: 'tool_result',
							is_error: true,
							tool_use_id: prevMessage.providerResponse.toolsUsed![0].toolUseId,
							content: [
								{
									'type': 'text',
									'text':
										"The previous tool input was invalid. Please provide a valid input according to the tool's schema",
								} as LLMMessageContentPartTextBlock,
							],
						} as LLMMessageContentPartToolResultBlock,
					],
				});
			} else {
				logger.warn(
					`provider[${this.providerName}] modifySpeakWithConversationOptions - Tool input validation failed, but no tool response found`,
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
				case 'max_tokens':
					logger.warn(`provider[${this.providerName}] Response reached the maximum token limit`);
					break;
				case 'end_turn':
					logger.warn(`provider[${this.providerName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`provider[${this.providerName}] Response reached its natural end`);
					break;
				case 'tool_use':
					logger.warn(`provider[${this.providerName}] Response is using a tool`);
					break;
				default:
					logger.info(
						`provider[${this.providerName}] Response stopped due to: ${llmProviderMessageResponse.messageStop.stopReason}`,
					);
			}
		}
	}
}

export default AnthropicLLM;