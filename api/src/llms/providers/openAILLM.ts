import OpenAI from 'openai';
import ms from 'ms';

import { LLMProvider, OpenAIModel } from 'api/types.ts';
import type { LLMCallbacks, LLMProviderMessageResponse } from 'api/types.ts';
import OpenAICompatLLM from './openAICompatLLM.ts';
import { createError } from 'api/utils/error.ts';
import { ErrorType, type LLMErrorOptions } from 'api/errors/error.ts';
import { logger } from 'shared/logger.ts';

type OpenAITokenUsage = OpenAI.CompletionUsage;

class OpenAILLM extends OpenAICompatLLM<OpenAITokenUsage> {
	constructor(callbacks: LLMCallbacks) {
		super(callbacks);
		this.llmProviderName = LLMProvider.OPENAI;
		// OpenAI provider uses the default OpenAI API URL
		this.baseURL = undefined;
		this.initializeOpenAIClient();
	}

	protected override transformUsage(usage: OpenAITokenUsage | undefined) {
		const cachedTokens = usage?.prompt_tokens_details?.cached_tokens ?? 0;
		const totalPromptTokens = usage?.prompt_tokens ?? 0;

		const transformedUsage = {
			// Tokens we had to process (total minus cached)
			inputTokens: Math.max(0, totalPromptTokens - cachedTokens),
			outputTokens: usage?.completion_tokens ?? 0,
			// We're reading from cache, not creating cache entries
			cacheCreationInputTokens: 0,
			// Tokens we got from cache
			cacheReadInputTokens: cachedTokens,
			totalTokens: 0,
		};
		transformedUsage.totalTokens = transformedUsage.inputTokens + transformedUsage.outputTokens + transformedUsage.cacheCreationInputTokens + transformedUsage.cacheReadInputTokens;
		return transformedUsage;
	}

	protected override transformRateLimit(response: Response) {
		const headers = response.headers;

		// Get rate limit information, defaulting to undefined if headers are missing
		const requestsRemaining = headers.has('x-ratelimit-remaining-requests')
			? Number(headers.get('x-ratelimit-remaining-requests'))
			: undefined;
		const requestsLimit = headers.has('x-ratelimit-limit-requests')
			? Number(headers.get('x-ratelimit-limit-requests'))
			: undefined;
		const requestsResetMs = headers.has('x-ratelimit-reset-requests')
			? ms(headers.get('x-ratelimit-reset-requests') || '0')
			: undefined;
		const requestsResetDate = requestsResetMs !== undefined ? new Date(Date.now() + requestsResetMs) : undefined;

		const tokensRemaining = headers.has('x-ratelimit-remaining-tokens')
			? Number(headers.get('x-ratelimit-remaining-tokens'))
			: undefined;
		const tokensLimit = headers.has('x-ratelimit-limit-tokens')
			? Number(headers.get('x-ratelimit-limit-tokens'))
			: undefined;
		const tokensResetMs = headers.has('x-ratelimit-reset-tokens')
			? ms(headers.get('x-ratelimit-reset-tokens') || '0')
			: undefined;
		const tokensResetDate = tokensResetMs !== undefined ? new Date(Date.now() + tokensResetMs) : undefined;

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
	): void {
		//         // Only set rate limit information if we have at least some of the data
		//         if (requestsRemaining !== undefined || tokensRemaining !== undefined) {
		//             messageResponse.rateLimit = {
		//                 requestsRemaining,
		//                 requestsLimit,
		//                 requestsResetDate,
		//                 tokensRemaining,
		//                 tokensLimit,
		//                 tokensResetDate,
		//             };
		//         } else {
		//             logger.debug('No rate limit headers found in OpenAI response');
		//         }
	}

	protected override async initializeOpenAIClient() {
		const apiKey = this.projectConfig.settings.api?.llmKeys?.openai;
		if (!apiKey) {
			throw new Error('OpenAI API key is not set');
		}

		// Initialize with standard OpenAI configuration
		this.openai = new OpenAI({
			apiKey,
			baseURL: this.baseURL,
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
				{ provider: this.llmProviderName } as LLMErrorOptions,
			);
		}
	}
}

export default OpenAILLM;
