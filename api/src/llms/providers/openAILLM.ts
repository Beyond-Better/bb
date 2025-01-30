import { OpenAI } from 'openai';
import ms from 'ms';

import { LLMProvider, OpenAIModel } from 'api/types/llms.types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse } from 'api/types/llms.types.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
import { logger } from 'shared/logger.ts';

class OpenAILLM extends OpenAICompatLLM<OpenAI.CompletionUsage> {
    constructor(callbacks: LLMCallbacks) {
        super(callbacks);
        // OpenAI provider uses the default OpenAI API URL
        this.baseURL = undefined;
        this.initializeOpenAIClient();
    }

    protected get providerName(): LLMProvider {
        return LLMProvider.OPENAI;
    }

    protected override transformUsage(usage: OpenAI.CompletionUsage | undefined) {
        const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
        const totalPromptTokens = usage?.prompt_tokens ?? 0;

        return {
            // Tokens we had to process (total minus cached)
            inputTokens: Math.max(0, totalPromptTokens - cachedTokens),
            outputTokens: usage?.completion_tokens ?? 0,
            // We're reading from cache, not creating cache entries
            cacheCreationInputTokens: 0,
            // Tokens we got from cache
            cacheReadInputTokens: cachedTokens,
        };
    }

    protected override processResponseMetadata(
        response: OpenAI.Response<OpenAI.Chat.ChatCompletion>,
        messageResponse: LLMProviderMessageResponse
    ): void {
        const headers = response.headers;

        // Get rate limit information
        const requestsRemaining = Number(headers.get('x-ratelimit-remaining-requests'));
        const requestsLimit = Number(headers.get('x-ratelimit-limit-requests'));
        const requestsResetMs = ms(headers.get('x-ratelimit-reset-requests') || '0') as number;
        const requestsResetDate = new Date(Date.now() + requestsResetMs);

        const tokensRemaining = Number(headers.get('x-ratelimit-remaining-tokens'));
        const tokensLimit = Number(headers.get('x-ratelimit-limit-tokens'));
        const tokensResetMs = ms(headers.get('x-ratelimit-reset-tokens') || '0') as number;
        const tokensResetDate = new Date(Date.now() + tokensResetMs);

        // Only set rate limit information if we have at least some of the data
        if (requestsRemaining || tokensRemaining) {
            messageResponse.rateLimit = {
                requestsRemaining,
                requestsLimit,
                requestsResetDate,
                tokensRemaining,
                tokensLimit,
                tokensResetDate,
            };
        } else {
            logger.debug('No rate limit headers found in OpenAI response');
        }
    }

    protected override async initializeOpenAIClient() {
        const apiKey = this.projectConfig.settings.api?.llmKeys?.openai;
        if (!apiKey) {
            throw new Error('OpenAI API key is not set');
        }

        // Initialize with standard OpenAI configuration
        this.openai = new OpenAI({ 
            apiKey,
            baseURL: this.baseURL
        });

        // Verify the model exists
        try {
            const defaultModel = OpenAIModel.GPT_4o; // Use GPT-4 as default model
            logger.info(`Initializing OpenAI with default model: ${defaultModel}`);
            
            // Could add model verification here if needed:
            // const response = await this.openai.models.retrieve(defaultModel);
            // logger.info(`OpenAI model ${defaultModel} verified`);
        } catch (err) {
            throw createError(
                ErrorType.LLM,
                `Failed to initialize OpenAI client: ${(err as Error).message}`,
                { provider: this.providerName } as LLMErrorOptions
            );
        }
    }
}

export default OpenAILLM;