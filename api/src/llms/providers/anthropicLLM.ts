import Anthropic from 'anthropic';
import type { ClientOptions } from 'anthropic';

import { AnthropicModel, LLMCallbackType, LLMProvider } from 'api/types.ts';
import LLM from './baseLLM.ts';
import type LLMInteraction from '../interactions/baseInteraction.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
import type { LLMMessageContentParts, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
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
} from '../../types.ts';

type AnthropicBlockParam =
	| string
	| Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaImageBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaToolUseBlockParam
	| Anthropic.Beta.PromptCaching.PromptCachingBetaToolResultBlockParam
	| Array<
		| Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaImageBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaToolUseBlockParam
		| Anthropic.Beta.PromptCaching.PromptCachingBetaToolResultBlockParam
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
			apiKey: this.fullConfig.api?.anthropicApiKey,
		};
		this.anthropic = new Anthropic(clientOptions);
	}

	//private asProviderMessageType(messages: LLMMessage[]): Anthropic.MessageParam[] {
	private asProviderMessageType(
		messages: LLMMessage[],
	): Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam[] {
		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
		const firstAssistantToolUseIndex = messages.findIndex((m) =>
			m.role === 'assistant' && Array.isArray(m.content) && m.content.some((block) => block.type === 'tool_use')
		);
		return messages.map((m, index) => {
			const prevContent: AnthropicBlockParam = m.content as AnthropicBlockParam;
			let content: AnthropicBlockParam;
			if (m.role === 'assistant' && usePromptCaching && index === firstAssistantToolUseIndex) {
				if (Array.isArray(prevContent)) {
					content = prevContent.map((block) => {
						if (block.type === 'tool_use') {
							return { ...block, cache_control: { type: 'ephemeral' } };
						}
						return block;
					});
				} else if (typeof prevContent === 'string') {
					content = [{ type: 'text', text: prevContent, cache_control: { type: 'ephemeral' } }];
				} else {
					content = [{ ...prevContent, cache_control: { type: 'ephemeral' } }];
				}
			} else {
				content = (Array.isArray(prevContent)
					? prevContent
					: [prevContent]) as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam[];
			}
			return {
				role: m.role,
				content: content,
			} as Anthropic.Beta.PromptCaching.PromptCachingBetaMessageParam;
		});
	}

	private asProviderToolType(tools: LLMTool[]): Anthropic.Beta.PromptCaching.PromptCachingBetaTool[] {
		//logger.debug('llms-anthropic-asProviderToolType', tools);
		return tools.map((tool) => ({
			name: tool.name,
			description: tool.description,
			input_schema: tool.inputSchema,
		} as Anthropic.Tool));
	}

	async prepareMessageParams(
		interaction: LLMInteraction,
		speakOptions?: LLMSpeakWithOptions,
	): Promise<Anthropic.MessageCreateParams> {
		//logger.debug('llms-anthropic-prepareMessageParams-systemPrompt', interaction.baseSystem);
		const usePromptCaching = this.fullConfig.api?.usePromptCaching ?? true;
		const systemPrompt = await this.invoke(
			LLMCallbackType.PREPARE_SYSTEM_PROMPT,
			speakOptions?.system || interaction.baseSystem,
			interaction.id,
		);
		const system = systemPrompt
			? [
				{
					type: 'text',
					text: systemPrompt,
					...(usePromptCaching ? { cache_control: { type: 'ephemeral' } } : {}),
				} as Anthropic.Beta.PromptCaching.PromptCachingBetaTextBlockParam,
			]
			: '';

		//logger.debug('llms-anthropic-prepareMessageParams-tools', interaction.allTools());
		const tools = this.asProviderToolType(
			await this.invoke(
				LLMCallbackType.PREPARE_TOOLS,
				speakOptions?.tools || interaction.allTools(),
				interaction.id,
			),
		);
		if (tools.length > 0 && usePromptCaching) {
			tools[tools.length - 1].cache_control = { type: 'ephemeral' };
		}

		const messages = this.asProviderMessageType(
			await this.invoke(
				LLMCallbackType.PREPARE_MESSAGES,
				speakOptions?.messages || interaction.getMessages(),
				interaction.id,
			),
		);

		if (!speakOptions?.maxTokens && !interaction.maxTokens) {
			logger.error('maxTokens missing from both speakOptions and interaction');
		}
		if (!speakOptions?.temperature && !interaction.temperature) {
			logger.error('temperature missing from both speakOptions and interaction');
		}

		const model: string = speakOptions?.model || interaction.model || AnthropicModel.CLAUDE_3_5_SONNET;
		const maxTokens: number = speakOptions?.maxTokens || interaction.maxTokens || 8192;
		const temperature: number = speakOptions?.temperature || interaction.temperature || 0.2;

		const messageParams: Anthropic.Beta.PromptCaching.MessageCreateParams = {
			messages,
			tools,
			system,
			model,
			max_tokens: maxTokens,
			temperature,
			stream: false,
		};
		//logger.debug('llms-anthropic-prepareMessageParams', messageParams);
		//logger.dir(messageParams);

		return messageParams;
	}

	/**
	 * Run Anthropic service
	 * @param interaction LLMInteraction
	 * @param speakOptions LLMSpeakWithOptions
	 * @returns Promise<LLMProviderMessageResponse> The response from Anthropic or an error
	 */
	public async speakWith(
		messageParams: LLMProviderMessageRequest,
	): Promise<LLMSpeakWithResponse> {
		try {
			logger.dir(messageParams);

			// https://github.com/anthropics/anthropic-sdk-typescript/blob/6886b29e0a550d28aa082670381a4bb92101099c/src/resources/beta/prompt-caching/prompt-caching.ts
			//const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.messages.create(
			const { data: anthropicMessageStream, response: anthropicResponse } = await this.anthropic.beta
				.promptCaching.messages.create(
					messageParams as Anthropic.MessageCreateParams,
					{
						headers: { 'anthropic-beta': 'prompt-caching-2024-07-31,max-tokens-3-5-sonnet-2024-07-15' },
					},
				).withResponse();

			const anthropicMessage = anthropicMessageStream as Anthropic.Beta.PromptCaching.PromptCachingBetaMessage;
			logger.info('llms-anthropic-anthropicMessage', anthropicMessage);
			//logger.info('llms-anthropic-anthropicResponse', anthropicResponse);

			const headers = anthropicResponse?.headers;

			//const requestId = headers.get('request-id');

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
				timestamp: new Date().toISOString(),
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
					cacheCreationInputTokens: anthropicMessage.usage.cache_creation_input_tokens || 0,
					cacheReadInputTokens: anthropicMessage.usage.cache_read_input_tokens || 0,
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

			return { messageResponse, messageMeta: { system: messageParams.system } };
		} catch (err) {
			logger.error('Error calling Anthropic API', err);
			throw createError(
				ErrorType.LLM,
				'Could not get response from Anthropic API.',
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
					`provider[${this.llmProviderName}] modifySpeakWithInteractionOptions - Tool input validation failed, but no tool response found`,
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

	protected checkStopReason(llmProviderMessageResponse: LLMProviderMessageResponse): void {
		// Check if the response has a stop reason
		if (llmProviderMessageResponse.messageStop.stopReason) {
			// Perform special handling based on the stop reason
			switch (llmProviderMessageResponse.messageStop.stopReason) {
				case 'max_tokens':
					logger.warn(`provider[${this.llmProviderName}] Response reached the maximum token limit`);

					break;
				case 'end_turn':
					logger.warn(`provider[${this.llmProviderName}] Response reached the end turn`);
					break;
				case 'stop_sequence':
					logger.warn(`provider[${this.llmProviderName}] Response reached its natural end`);
					break;
				case 'tool_use':
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

export default AnthropicLLM;
