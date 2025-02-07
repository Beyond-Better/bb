import type { TokenUsageRecord } from 'shared/types.ts';

interface MockTokenUsageRecordOptions {
	messageId?: string;
	inputTokens?: number;
	outputTokens?: number;
	cacheCreationInputTokens?: number;
	cacheReadInputTokens?: number;
}

interface MockTokenUsageRecordSequenceOptions {
	startMessageId?: string;
	alternateRoles?: boolean;
	type?: 'conversation' | 'chat';
}

/**
 * Creates a mock TokenUsageRecord for testing
 */
export function createMockTokenUsageRecord(
	role: 'assistant' | 'user' | 'tool' | 'system',
	type: 'conversation' | 'chat',
	options: MockTokenUsageRecordOptions = {},
): TokenUsageRecord {
	const {
		messageId = 'test-message',
		inputTokens = 100,
		outputTokens = 50,
		cacheCreationInputTokens = 0,
		cacheReadInputTokens = 0,
	} = options;

	const totalTokens = inputTokens + outputTokens;
	const potentialCost = totalTokens;
	const actualCost = totalTokens - (cacheReadInputTokens || 0);
	const savingsTotal = potentialCost - actualCost;
	const savingsPercentage = (savingsTotal / potentialCost) * 100;

	return {
		messageId,
		role,
		type,
		statementCount: 1,
		statementTurnCount: 1,
		model: 'claude-sonnet',
		timestamp: new Date().toISOString(),
		rawUsage: {
			inputTokens,
			outputTokens,
			totalTokens,
			cacheCreationInputTokens,
			cacheReadInputTokens,
		},
		differentialUsage: {
			inputTokens,
			outputTokens,
			totalTokens,
		},
		cacheImpact: {
			potentialCost,
			actualCost,
			savingsTotal,
			savingsPercentage,
		},
	};
}

/**
 * Creates a sequence of mock TokenUsageRecords for testing
 */
export function createMockTokenUsageRecordSequence(
	count: number,
	options: MockTokenUsageRecordSequenceOptions = {},
): TokenUsageRecord[] {
	const {
		startMessageId = 'test-sequence',
		alternateRoles = false,
		type = 'conversation',
	} = options;

	return Array.from({ length: count }, (_, i) => {
		const role = alternateRoles ? (i % 2 === 0 ? 'assistant' : 'user') : 'assistant';
		return createMockTokenUsageRecord(role, type, {
			messageId: `${startMessageId}-${i + 1}`,
			inputTokens: 100 + i * 10,
			outputTokens: 50 + i * 5,
			cacheCreationInputTokens: i % 2 === 0 ? 10 : 0,
			cacheReadInputTokens: i % 2 === 1 ? 5 : 0,
		});
	});
}

/**
 * Creates a mock TokenUsageRecord with history based on a previous record
 */
export function createMockTokenUsageRecordWithHistory(
	current: {
		role: 'assistant' | 'user' | 'tool' | 'system';
		rawUsage: {
			inputTokens: number;
			outputTokens: number;
			totalTokens: number;
			cacheCreationInputTokens?: number;
			cacheReadInputTokens?: number;
		};
	},
	previous: TokenUsageRecord,
): TokenUsageRecord {
	const messageId = `${previous.messageId}-next`;
	const type = previous.type;

	// Calculate differential usage
	const differentialUsage = {
		inputTokens: current.rawUsage.inputTokens - previous.rawUsage.inputTokens,
		outputTokens: current.rawUsage.outputTokens - previous.rawUsage.outputTokens,
		totalTokens: current.rawUsage.totalTokens - previous.rawUsage.totalTokens,
	};

	// Calculate cache impact
	const potentialCost = current.rawUsage.totalTokens;
	const actualCost = potentialCost - (current.rawUsage.cacheReadInputTokens || 0);
	const savingsTotal = potentialCost - actualCost;
	const savingsPercentage = (savingsTotal / potentialCost) * 100;

	return {
		messageId,
		role: current.role,
		type,
		statementCount: 1,
		statementTurnCount: 1,
		model: 'claude-sonnet',
		timestamp: new Date().toISOString(),
		rawUsage: current.rawUsage,
		differentialUsage,
		cacheImpact: {
			potentialCost,
			actualCost,
			savingsTotal,
			savingsPercentage,
		},
	};
}
