import type OpenAI from 'openai';
import ms from 'ms';

import { LLMProvider, OpenAIModel } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse, LLMRateLimit, LLMTokenUsage } from 'api/types.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
// import { createError } from 'api/utils/error.ts';
// import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
// import { logger } from 'shared/logger.ts';

type OpenAITokenUsage = OpenAI.CompletionUsage;

class OpenAILLM extends OpenAICompatLLM<OpenAITokenUsage> {
	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.OPENAI;

		this.defaultModel = OpenAIModel.GPT_4o; // Use GPT-4o as default model
		this.baseUrl = undefined; // OpenAI provider uses the default OpenAI API URL
		this.apiKey = this.projectConfig.api?.llmProviders?.openai?.apiKey;

		super.initializeOpenAIClient();
	}

	protected override transformUsage(usage: OpenAITokenUsage | undefined): LLMTokenUsage {
		const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
		const totalPromptTokens = usage?.prompt_tokens ?? 0;

		const transformedUsage = {
			// Tokens we had to process (total minus cached)
			inputTokens: Math.max(0, totalPromptTokens - cachedTokens),
			outputTokens: usage?.completion_tokens ?? 0,
			totalTokens: ((Math.max(0, totalPromptTokens - cachedTokens)) + (usage?.completion_tokens ?? 0)),
			// We're reading from cache, not creating cache entries
			cacheCreationInputTokens: 0,
			// Tokens we got from cache
			cacheReadInputTokens: cachedTokens,
			thoughtTokens: 0,
			totalAllTokens:
				((Math.max(0, totalPromptTokens - cachedTokens)) + (usage?.completion_tokens ?? 0) + cachedTokens),
		};
		transformedUsage.totalTokens = transformedUsage.inputTokens + transformedUsage.outputTokens +
			transformedUsage.cacheCreationInputTokens + transformedUsage.cacheReadInputTokens;
		return transformedUsage;
	}

	protected override transformRateLimit(response: Response): LLMRateLimit {
		const headers = response.headers;

		// Get rate limit information, defaulting to undefined if headers are missing
		const requestsRemaining = headers.has('x-ratelimit-remaining-requests')
			? Number(headers.get('x-ratelimit-remaining-requests'))
			: 0;
		const requestsLimit = headers.has('x-ratelimit-limit-requests')
			? Number(headers.get('x-ratelimit-limit-requests'))
			: 0;
		const requestsResetMs = headers.has('x-ratelimit-reset-requests')
			? ms(headers.get('x-ratelimit-reset-requests') || '0')
			: 0;
		const requestsResetDate = requestsResetMs !== undefined ? new Date(Date.now() + requestsResetMs) : new Date();

		const tokensRemaining = headers.has('x-ratelimit-remaining-tokens')
			? Number(headers.get('x-ratelimit-remaining-tokens'))
			: 0;
		const tokensLimit = headers.has('x-ratelimit-limit-tokens')
			? Number(headers.get('x-ratelimit-limit-tokens'))
			: 0;
		const tokensResetMs = headers.has('x-ratelimit-reset-tokens')
			? ms(headers.get('x-ratelimit-reset-tokens') || '0')
			: 0;
		const tokensResetDate = tokensResetMs !== undefined ? new Date(Date.now() + tokensResetMs) : new Date();

		return {
			requestsRemaining,
			requestsLimit,
			requestsResetDate,
			tokensRemaining,
			tokensLimit,
			tokensResetDate,
		};
	}

	protected override processResponseMetadata(
		_response: Response,
		_messageResponse: LLMProviderMessageResponse,
	): void {}
}

export default OpenAILLM;
