import type { LLMProvider } from '../types.ts';
import kv from './kv.utils.ts';
import { logger } from 'shared/logger.ts';

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

	private getKey(provider: LLMProvider): string[] {
		return ['tokenUsage', provider];
	}

	public async getTokenUsage(provider: LLMProvider): Promise<TokenUsage | null> {
		const key = this.getKey(provider);
		const result = await kv.get<TokenUsage>(key);
		return result.value;
	}

	public async updateTokenUsage(provider: LLMProvider, usage: TokenUsage): Promise<void> {
		const key = this.getKey(provider);
		await kv.atomic()
			.set(key, usage)
			.commit();
		logger.info(`Updated token usage for ${provider}`);
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
			logger.warn(`Rate limit nearly exceeded for ${provider}. Waiting for ${waitTime}ms.`);
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
