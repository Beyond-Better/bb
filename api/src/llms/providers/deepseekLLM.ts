import type OpenAI from 'openai';
import { DeepSeekModel, LLMProvider } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse, LLMRateLimit, LLMTokenUsage } from 'api/types.ts';
import type LLMMessage from 'api/llms/llmMessage.ts';
//import type {
//    LLMMessageContentPart,
//    LLMMessageContentParts,
//    LLMMessageContentPartTextBlock,
//    LLMMessageContentPartToolUseBlock,
//} from 'api/llms/llmMessage.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
// import { createError } from 'api/utils/error.ts';
// import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';
//import { ModelCapabilitiesManager } from 'api/llms/modelCapabilitiesManager.ts';

// Define DeepSeek-specific types
interface DeepSeekTokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	prompt_cache_hit_tokens: number;
	prompt_cache_miss_tokens: number;
}

class DeepSeekLLM extends OpenAICompatLLM<DeepSeekTokenUsage> {
	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.DEEPSEEK;

		this.defaultModel = DeepSeekModel.DEEPSEEK_CHAT;
		this.baseURL = this.projectConfig.settings.api?.llmProviders?.deepseek?.baseURL ||
			'https://api.deepseek.com/v1';
		this.apiKey = this.projectConfig.settings.api?.llmProviders?.deepseek?.apiKey;

		super.initializeOpenAIClient();
	}

	protected override asProviderMessageType(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
		logger.info(`llms-${this.llmProviderName}-asProviderMessageType-messages`, messages);
		const providerMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		messages.forEach((message) => {
			if (message.role === 'assistant') {
				const contentParts: string[] = [];
				const toolCalls: OpenAI.Chat.ChatCompletionMessageToolCall[] = [];

				message.content.forEach((part) => {
					if (part.type === 'tool_use') {
						toolCalls.push({
							id: part.id,
							type: 'function',
							function: {
								name: part.name,
								arguments: JSON.stringify(part.input),
							},
						});
					} else if (part.type === 'text') {
						contentParts.push(part.text);
					}
				});

				const assistantMessage = {
					role: 'assistant',
					content: contentParts.length > 0 ? contentParts.join('\n') : null,
				} as OpenAI.Chat.ChatCompletionAssistantMessageParam;

				if (toolCalls.length > 0) {
					assistantMessage.tool_calls = toolCalls;
				}

				providerMessages.push(assistantMessage);
			} else if (message.role === 'user') {
				const contentParts: string[] = [];

				message.content.forEach((part) => {
					if (part.type === 'tool_result') {
						const content = part.content?.map((p) => {
							if (p.type === 'text' && p.text) {
								return p.text;
							}
							return '';
						}).filter(Boolean).join('\n') ?? '';

						if (content) {
							providerMessages.push({
								role: 'tool',
								content,
								tool_call_id: part.tool_use_id,
							} as OpenAI.Chat.ChatCompletionToolMessageParam);
						}
					} else if (part.type === 'text') {
						contentParts.push(part.text);
					}
					// DeepSeek doesn't support image inputs
				});

				if (contentParts.length > 0) {
					providerMessages.push({
						role: 'user',
						content: contentParts.join('\n'),
					});
				}
			}
		});

		logger.info(`llms-${this.llmProviderName}-asProviderMessageType-providerMessages`, providerMessages);
		return providerMessages;
	}

	protected override transformUsage(usage: DeepSeekTokenUsage | undefined): LLMTokenUsage {
		const transformedUsage = {
			// Tokens we had to process (weren't in cache)
			inputTokens: usage?.prompt_cache_miss_tokens ?? 0,
			outputTokens: usage?.completion_tokens ?? 0,
			totalTokens: ((usage?.prompt_cache_miss_tokens ?? 0) + (usage?.completion_tokens ?? 0)),
			// We're reading from cache, not creating cache entries
			cacheCreationInputTokens: 0,
			// Tokens we got from cache
			cacheReadInputTokens: usage?.prompt_cache_hit_tokens ?? 0,
			totalAllTokens: ((usage?.prompt_cache_miss_tokens ?? 0) + (usage?.completion_tokens ?? 0) +
				(usage?.prompt_cache_hit_tokens ?? 0)),
		};
		transformedUsage.totalTokens = transformedUsage.inputTokens + transformedUsage.outputTokens +
			transformedUsage.cacheCreationInputTokens + transformedUsage.cacheReadInputTokens;
		return transformedUsage;
	}

	protected override transformRateLimit(_response: Response): LLMRateLimit {
		// DeepSeek doesn't provide rate limit headers
		logger.debug('No rate limit headers available in DeepSeek response');
		return {
			requestsRemaining: 0,
			requestsLimit: 0,
			requestsResetDate: new Date(),
			tokensRemaining: 0,
			tokensLimit: 0,
			tokensResetDate: new Date(),
		};
	}

	protected override processResponseMetadata(
		_response: Response,
		_messageResponse: LLMProviderMessageResponse,
	): void {}
}

export default DeepSeekLLM;
