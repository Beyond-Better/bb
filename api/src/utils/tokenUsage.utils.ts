import type { LLMProvider } from '../types.ts';
import { KVManager } from 'api/utils/kvManager.ts';
import { logger } from 'shared/logger.ts';

logger.info(`TokenUsageManager: Creating storage for tokenUsage`);
const storage = await new KVManager<TokenUsage>({ prefix: 'tokenUsage' }).init();
//logger.info(`TokenUsageManager: Created storage for tokenUsage`);

// [TODO] - see notes for updateTokenUsage in baseLLM
// This class is really for rate limits; not token usage
// Calling code needs to be updated to use it properly for rate limit delays

interface TokenUsage {
	requestsRemaining: number;
	requestsLimit: number;
	requestsResetDate: Date;
	tokensRemaining: number;
	tokensLimit: number;
	tokensResetDate: Date;
}

class TokenUsageManager {
	private static instance: TokenUsageManager;
	private constructor() {}

	public static getInstance(): TokenUsageManager {
		if (!TokenUsageManager.instance) {
			TokenUsageManager.instance = new TokenUsageManager();
		}
		return TokenUsageManager.instance;
	}

	public async getTokenUsage(provider: LLMProvider): Promise<TokenUsage | null> {
		return await storage.getItem(provider);
	}

	public async updateTokenUsage(provider: LLMProvider, usage: TokenUsage): Promise<void> {
		await storage.setItemAtomic(provider, usage);
		logger.info(`TokenUsageManager: Updated token usage for ${provider}`);
	}

	public async checkAndWaitForRateLimit(provider: LLMProvider): Promise<void> {
		const usage = await this.getTokenUsage(provider);
		if (!usage) return;

		const now = new Date();
		const requestsResetDate = new Date(usage.requestsResetDate);
		const tokensResetDate = new Date(usage.tokensResetDate);

		if (now > requestsResetDate && now > tokensResetDate) {
			return;
		}

		if (
			usage.requestsRemaining <= 0.05 * usage.requestsLimit ||
			usage.tokensRemaining <= 0.05 * usage.tokensLimit
		) {
			const waitTime = Math.max(
				requestsResetDate.getTime() - now.getTime(),
				tokensResetDate.getTime() - now.getTime(),
			);
			logger.warn(`TokenUsageManager: Rate limit nearly exceeded for ${provider}. Waiting for ${waitTime}ms.`);
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

export const tokenUsageManager = TokenUsageManager.getInstance();
