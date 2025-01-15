import type { LLMProvider } from '../types.ts';
import { KVManager } from 'api/utils/kvManager.ts';
import { logger } from 'shared/logger.ts';
import type { LLMRateLimit } from 'api/types.ts';

logger.info(`RateLimitManager: Creating storage for rateLimit`);
const storage = await new KVManager<LLMRateLimit>({ prefix: 'rateLimit' }).init();
//logger.info(`RateLimitManager: Created storage for rateLimit`);

// [TODO] - see notes for updateRateLimit in baseLLM
// This class is really for rate limits; not token usage
// Calling code needs to be updated to use it properly for rate limit delays

class RateLimitManager {
	private static instance: RateLimitManager;
	private constructor() {}

	public static getInstance(): RateLimitManager {
		if (!RateLimitManager.instance) {
			RateLimitManager.instance = new RateLimitManager();
		}
		return RateLimitManager.instance;
	}

	public async getRateLimit(provider: LLMProvider): Promise<LLMRateLimit | null> {
		return await storage.getItem(provider);
	}

	public async updateRateLimit(provider: LLMProvider, usage: LLMRateLimit): Promise<void> {
		await storage.setItemAtomic(provider, usage);
		logger.info(`RateLimitManager: Updated token usage for ${provider}`);
	}

	public async checkAndWaitForRateLimit(provider: LLMProvider): Promise<void> {
		const limits = await this.getRateLimit(provider);
		if (!limits) return;

		const now = new Date();
		const requestsResetDate = new Date(limits.requestsResetDate);
		const tokensResetDate = new Date(limits.tokensResetDate);

		if (now > requestsResetDate && now > tokensResetDate) {
			return;
		}

		if (
			limits.requestsRemaining <= 0.05 * limits.requestsLimit ||
			limits.tokensRemaining <= 0.05 * limits.tokensLimit
		) {
			const waitTime = Math.max(
				requestsResetDate.getTime() - now.getTime(),
				tokensResetDate.getTime() - now.getTime(),
			);
			logger.warn(`RateLimitManager: Rate limit nearly exceeded for ${provider}. Waiting for ${waitTime}ms.`);
			await new Promise((resolve) => setTimeout(resolve, waitTime));
			/*
			// [CNG] Not sure what the thinking was with throwing this error - I suspect it snuck in with boilerplate code -
			// leaving here as an example for now since consumers may have need to throw an error instead of waiting for waitTime
			throw createError(
				ErrorType.LLMRateLimit,
				'Rate limit exceeded. Waiting for rate limit to reset.',
				{
					llmProvider: this.llmProviderName,
					name: 'rate-limit',
					token_usage: 0,
					token_limit: 0,
					request_usage: 0,
					request_limit: 0,
				} as LLMRateLimitErrorOptions,
			); //model: conversation.model,
			 */
		}
	}
}

export const rateLimitManager = RateLimitManager.getInstance();
