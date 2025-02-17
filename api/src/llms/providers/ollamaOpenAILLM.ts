//import type OpenAI from 'openai';
import { LLMProvider, OllamaModel } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse, LLMRateLimit, LLMTokenUsage } from 'api/types.ts';
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
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}

		this.defaultModel = OllamaModel.SMOLLM2_1_7B;
		this.baseURL = ollamaBaseURL;
		this.apiKey = 'ollama';

		super.initializeOpenAIClient();
	}

	protected override transformUsage(usage: OllamaTokenUsage | undefined): LLMTokenUsage {
		return {
			// Ollama doesn't support caching yet
			inputTokens: usage?.prompt_tokens ?? 0,
			outputTokens: usage?.completion_tokens ?? 0,
			totalTokens: 0,
			//cacheCreationInputTokens: 0,
			//cacheReadInputTokens: 0,
		};
	}

	protected override transformRateLimit(response: Response): LLMRateLimit {
		// Ollama doesn't provide rate limit headers, but we'll log if we find any
		const headers = response.headers;
		if (headers.has('x-ratelimit-limit') || headers.has('x-ratelimit-remaining')) {
			logger.info('Unexpected rate limit headers found in Ollama response', {
				limit: headers.get('x-ratelimit-limit'),
				remaining: headers.get('x-ratelimit-remaining'),
			});
		}

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

export default OllamaLLM;
