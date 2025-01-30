import { OpenAI } from 'openai';
import { LLMProvider, DeepSeekModel } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse } from 'api/types.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

// Define DeepSeek-specific types
interface DeepSeekTokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    prompt_cache_hit_tokens: number;
    prompt_cache_miss_tokens: number;
}

class DeepSeekLLM extends OpenAICompatLLM<DeepSeekTokenUsage> {
    protected override asProviderMessageType(messages: LLMMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
        logger.info(`llms-${this.providerName}-asProviderMessageType-messages`, messages);
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

        logger.info(`llms-${this.providerName}-asProviderMessageType-providerMessages`, providerMessages);
        return providerMessages;
    }

    constructor(callbacks: LLMCallbacks) {
        super(callbacks);
        // DeepSeek uses their own API endpoint
        //this.baseURL = this.projectConfig.settings.api?.llmEndpoints?.deepseek || 'https://api.deepseek.com/v1';
        this.baseURL = 'https://api.deepseek.com/v1';
        this.initializeOpenAIClient();
    }

    protected get providerName(): LLMProvider {
        return LLMProvider.DEEPSEEK;
    }

    protected override transformUsage(usage: DeepSeekTokenUsage | undefined) {
        const transformedUsage = {
            // Tokens we had to process (weren't in cache)
            inputTokens: usage?.prompt_cache_miss_tokens ?? 0,
            outputTokens: usage?.completion_tokens ?? 0,
            // We're reading from cache, not creating cache entries
            cacheCreationInputTokens: 0,
            // Tokens we got from cache
            cacheReadInputTokens: usage?.prompt_cache_hit_tokens ?? 0,
            totalTokens: 0,
        };
        transformedUsage.totalTokens = transformedUsage.inputTokens + transformedUsage.outputTokens + transformedUsage.cacheCreationInputTokens + transformedUsage.cacheReadInputTokens;
        return transformedUsage;
    }

    protected override transformRateLimit(_response: Response) {
        // DeepSeek doesn't provide rate limit headers
        return {
            requestsRemaining: undefined,
            requestsLimit: undefined,
            requestsResetDate: undefined,
            tokensRemaining: undefined,
            tokensLimit: undefined,
            tokensResetDate: undefined,
        };
    }

    protected override processResponseMetadata(
        _response: Response,
        _messageResponse: LLMProviderMessageResponse,
    ): void {
        // DeepSeek doesn't provide rate limit information
        logger.debug('No rate limit headers available in DeepSeek response');
    }

    protected override async initializeOpenAIClient() {
        const apiKey = this.projectConfig.settings.api?.llmKeys?.deepseek;
        if (!apiKey) {
            throw createError(
                ErrorType.LLM,
                'DeepSeek API key is not set',
                { provider: this.providerName } as LLMErrorOptions
            );
        }

        // Initialize with DeepSeek configuration
        this.openai = new OpenAI({
            apiKey,
            baseURL: this.baseURL,
        });

        // Verify the model exists
        try {
            const defaultModel = DeepSeekModel.DEEPSEEK_CHAT;
            logger.info(`Initializing DeepSeek with default model: ${defaultModel}`);
        } catch (err) {
            throw createError(
                ErrorType.LLM,
                `Failed to initialize DeepSeek client: ${(err as Error).message}`,
                { provider: this.providerName } as LLMErrorOptions
            );
        }
    }
}

export default DeepSeekLLM;