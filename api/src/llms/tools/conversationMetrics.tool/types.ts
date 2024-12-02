import type { TokenUsageAnalysis } from 'shared/types.ts';

export interface LLMToolConversationMetricsInput {
	includeTools?: boolean;
	includeFiles?: boolean;
	includeTokens?: boolean;
	includeTiming?: boolean;
	includeQuality?: boolean;
	startTurn?: number;
	endTurn?: number;
}

export interface LLMToolToolMetrics {
	name: string;
	uses: number;
	successes: number;
	failures: number;
	averageResponseTime: number;
}

export interface LLMToolFileMetrics {
	path: string;
	operations: {
		added: number;
		modified: number;
		removed: number;
	};
	lastOperation: string;
	currentStatus: string;
}

export interface TokenMetrics extends TokenUsageAnalysis {
	// Legacy metrics maintained for compatibility
	total: number;
	byTurn: Array<{
		turn: number;
		tokens: number;
		role: string;
	}>;
	averagePerTurn: number;
}

export interface TimeMetrics {
	totalDuration: number;
	averageResponseTime: number;
	byTurn: Array<{
		turn: number;
		duration: number;
	}>;
}

export interface LLMToolConversationMetricsResult {
	summary: {
		totalTurns: number;
		messageTypes: {
			user: number;
			assistant: number;
			tool: number;
			system: number;
		};
		activeFiles: number;
		uniqueToolsUsed: number;
		startTime: string;
		lastUpdateTime: string;
	};
	tokens: TokenMetrics;
	chatTokens?: TokenMetrics;
	timing: TimeMetrics;
	tools: {
		usage: LLMToolToolMetrics[];
		sequences: Array<{
			tools: string[];
			occurrences: number;
		}>;
	};
	files: {
		metrics: LLMToolFileMetrics[];
		mostAccessed: string[];
	};
	quality: {
		errorRate: number;
		retryCount: number;
		userCorrections: number;
		averageToolSuccess: number;
	};
}

export interface LLMToolConversationMetricsResponse {
	data: LLMToolConversationMetricsResult;
}
