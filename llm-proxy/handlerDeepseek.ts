import type { PerformanceMonitor } from '../_shared/performanceMonitor.ts';
import type { BBLLMRequest, BBLLMTokenUsage, BBLLMRequestMessage } from '../_shared/types.ts';
import { type OpenAICompatConfig, OpenAICompatHandler } from './handlerOpenAICompat.ts';
import type OpenAI from 'openai';

export type Model = // | (string & {})
	'deepseek-chat';
// | 'deepseek-chat-instruct'
// | 'deepseek-coder'
// | 'deepseek-coder-instruct';

interface DeepseekHandlerConfig extends OpenAICompatConfig {
	model: Model;
}

interface DeepseekTokenUsage {
	prompt_tokens: number;
	completion_tokens: number;
	prompt_cache_hit_tokens: number;
	prompt_cache_miss_tokens: number;
}

// OpenAI provider handler
export class DeepseekHandler extends OpenAICompatHandler<DeepseekTokenUsage> {
	constructor(config: DeepseekHandlerConfig, monitor: PerformanceMonitor) {
		super({
			...config,
			baseURL: 'https://api.deepseek.com/v1',
		}, monitor);
	}

	protected override getProviderName(): string {
		return 'deepseek';
	}

	protected override transformUsage(usage: DeepseekTokenUsage | undefined): BBLLMTokenUsage {
		return {
			// Tokens we had to process (weren't in cache)
			inputTokens: usage?.prompt_cache_miss_tokens ?? 0,
			outputTokens: usage?.completion_tokens ?? 0,
			// We're reading from cache, not creating cache entries
			cacheCreationInputTokens: 0,
			// Tokens we got from cache
			cacheReadInputTokens: usage?.prompt_cache_hit_tokens ?? 0,
		};

		/*
		 * https://api-docs.deepseek.com/api/create-chat-completion
		 * Usage statistics for the completion request.
		 *
		 * completion_tokens
		 * Number of tokens in the generated completion.
		 *
		 * prompt_tokens
		 * Number of tokens in the prompt. It equals prompt_cache_hit_tokens + prompt_cache_miss_tokens.
		 *
		 * prompt_cache_hit_tokens
		 * Number of tokens in the prompt that hits the context cache.
		 *
		 * prompt_cache_miss_tokens
		 * Number of tokens in the prompt that misses the context cache.
		 *
		 * total_tokens
		 * Total number of tokens used in the request (prompt + completion).
		 */
	}

	protected override transformMessages(bbRequest: BBLLMRequest): OpenAI.Chat.ChatCompletionMessageParam[] {
		console.debug(`[OPENAI-COMPAT-HANDLER][${this.getProviderName()}] Transforming messages`);
		this.monitor.startTimer('provider_transform');

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

		// Add system message if present
		if (bbRequest.system) {
			messages.push({
				role: 'system',
				content: bbRequest.system,
			});
		}

		// Transform conversation messages
		bbRequest.messages.forEach((message: BBLLMRequestMessage) => {
			if (message.role === 'assistant') {
				//const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
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
					content: contentParts.length > 0 ? contentParts.join("\n") : null,
				} as OpenAI.Chat.ChatCompletionAssistantMessageParam;

				if (toolCalls.length > 0) {
					assistantMessage.tool_calls = toolCalls;
				}

				messages.push(assistantMessage);
			} else if (message.role === 'user') {
				//const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
				const contentParts: string[] = [];

				message.content.forEach((part) => {
					if (part.type === 'tool_result') {
						const contentParts = part.content?.map((p) => {
							if (p.type === 'text' && p.text) {
								return p.text;
							}
							//if (p.type === 'image') {
							//	return {
							//		type: 'image_url',
							//		image_url: { url: p.source.data },
							//	}; //as OpenAI.Chat.ChatCompletionContentPartImage;
							//}
							return '';
						}) ?? [] as OpenAI.Chat.ChatCompletionContentPartText[];

						messages.push({
							role: 'tool',
							content: contentParts.join("\n"), //as OpenAI.Chat.ChatCompletionContentPartText[],
							tool_call_id: part.tool_use_id,
						} as OpenAI.Chat.ChatCompletionToolMessageParam);
					} else if (part.type === 'text') {
						contentParts.push(part.text);
						// } else if (part.type === 'image') {
						// 	contentParts.push({
						// 		type: 'image_url',
						// 		image_url: { url: part.source.data },
						// 	});
					}
				});

				if (contentParts.length > 0) {
					messages.push({
						role: 'user',
						content: contentParts.join("\n"),
					} as OpenAI.Chat.ChatCompletionMessageParam);
				}
			}
		});

		this.monitor.stopTimer('provider_transform');
		return messages;
	}
}
