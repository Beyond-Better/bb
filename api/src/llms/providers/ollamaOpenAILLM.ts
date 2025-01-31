import { OpenAI } from 'openai';
import { LLMProvider, OllamaModel } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse } from 'api/types.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
import { logger } from 'shared/logger.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';

// Define Ollama-specific token usage type
interface OllamaTokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
}

class OllamaLLM extends OpenAICompatLLM<OllamaTokenUsage> {
    constructor(callbacks: LLMCallbacks) {
        super(callbacks);
		this.llmProviderName = LLMProvider.OLLAMA;
        
        // Get Ollama base URL from project config
        //const ollamaBaseURL = this.projectConfig.settings.api?.llmEndpoints?.ollama;
        const ollamaBaseURL = 'http://127.0.0.1:11434';
        if (!ollamaBaseURL) {
            throw createError(
                ErrorType.LLM,
                'Ollama API endpoint is not configured',
                { provider: this.llmProviderName } as LLMErrorOptions
            );
        }
        
        this.baseURL = ollamaBaseURL;
        this.initializeOpenAIClient();
    }

    protected override transformUsage(usage: OllamaTokenUsage | undefined) {
        return {
            // Ollama doesn't support caching yet
            inputTokens: usage?.prompt_tokens ?? 0,
            outputTokens: usage?.completion_tokens ?? 0,
            cacheCreationInputTokens: 0,
            cacheReadInputTokens: 0,
            totalTokens: 0,
        };
    }

	protected override transformRateLimit(response: Response) {
        // Ollama doesn't provide rate limit headers, but we'll log if we find any
        const headers = response.headers;
        if (headers.has('x-ratelimit-limit') || headers.has('x-ratelimit-remaining')) {
            logger.info('Unexpected rate limit headers found in Ollama response', {
                limit: headers.get('x-ratelimit-limit'),
                remaining: headers.get('x-ratelimit-remaining')
            });
        }

		return {};
	}

    protected override processResponseMetadata(
        _response: Response,
        _messageResponse: LLMProviderMessageResponse
    ): void {
    }

    protected override async initializeOpenAIClient() {
        // For Ollama, we need to use a different API key configuration
        // const apiKey = this.projectConfig.settings.api?.llmKeys?.ollama;
        // if (!apiKey) {
        //     throw createError(
        //         ErrorType.LLM,
        //         'Ollama API key is not set',
        //         { provider: this.llmProviderName } as LLMErrorOptions
        //     );
        // }

        // Initialize with Ollama-specific configuration
        this.openai = new OpenAI({ 
            apiKey: 'ollama',
            baseURL: this.baseURL
        });

        // Verify the model exists
        try {
            const defaultModel = OllamaModel.LLAMA3_3; // Use llama2 as default model
            logger.info(`Initializing Ollama with default model: ${defaultModel}`);
            
            // Could add model verification here if needed:
            // const response = await this.openai.models.retrieve(defaultModel);
            // logger.info(`Ollama model ${defaultModel} verified`);
        } catch (err) {
            throw createError(
                ErrorType.LLM,
                `Failed to initialize Ollama client: ${(err as Error).message}`,
                { provider: this.llmProviderName } as LLMErrorOptions
            );
        }
    }
}

export default OllamaLLM;