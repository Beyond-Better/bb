import type { TokenUsageRecord } from 'shared/types.ts';
import LLMMessage from 'api/llms/llmMessage.ts';

export function createMockTokenUsageRecord(
	role: 'user' | 'assistant' | 'system' | 'tool' = 'assistant',
	type: 'conversation' | 'chat' | 'base' = 'conversation',
	options: {
		messageId?: string;
		statementCount?: number;
		statementTurnCount?: number;
		inputTokens?: number;
		outputTokens?: number;
		cacheCreationInputTokens?: number;
		cacheReadInputTokens?: number;
		thoughtTokens?: number;
		timestamp?: string;
	} = {},
): TokenUsageRecord {
	const inputTokens = options.inputTokens ?? Math.floor(Math.random() * 1000);
	const outputTokens = options.outputTokens ?? Math.floor(Math.random() * 1000);
	const cacheCreationInputTokens = options.cacheCreationInputTokens ?? Math.floor(Math.random() * 100);
	const cacheReadInputTokens = options.cacheReadInputTokens ?? Math.floor(Math.random() * 100);
	const thoughtTokens = options.thoughtTokens ?? Math.floor(Math.random() * 100);
	const totalTokens = inputTokens + outputTokens;
	const totalAllTokens = totalTokens + cacheCreationInputTokens + cacheReadInputTokens;
	const potentialCost = totalTokens * 1.5; // Example cost calculation
	const actualCost = potentialCost - (cacheReadInputTokens * 0.5); // Example savings calculation
	const savingsTotal = potentialCost - actualCost;
	const savingsPercentage = (savingsTotal / potentialCost) * 100;

	return {
		messageId: options.messageId ?? crypto.randomUUID(),
		timestamp: options.timestamp ?? new Date().toISOString(),
		statementCount: options.statementCount ?? 1,
		statementTurnCount: options.statementTurnCount ?? 1,
		model: 'cluade',
		role,
		type,
		rawUsage: {
			inputTokens,
			outputTokens,
			totalTokens,
			cacheCreationInputTokens,
			cacheReadInputTokens,
			thoughtTokens,
			totalAllTokens,
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

export function createMockTokenUsageRecordSequence(
	count: number,
	options: {
		startMessageId?: string;
		baseTimestamp?: string;
		type?: 'conversation' | 'chat';
		alternateRoles?: boolean;
	} = {},
): TokenUsageRecord[] {
	const records: TokenUsageRecord[] = [];
	const baseTime = options.baseTimestamp ? new Date(options.baseTimestamp) : new Date();

	let statementTurnCount = 0;
	for (let i = 0; i < count; i++) {
		const messageId = options.startMessageId ? `${options.startMessageId}-${i + 1}` : crypto.randomUUID();
		const timestamp = new Date(baseTime.getTime() + (i * 1000)).toISOString();
		const role = options.alternateRoles ? (i % 2 === 0 ? 'assistant' : 'user') : 'assistant';
		statementTurnCount++;

		records.push(createMockTokenUsageRecord(
			role,
			options.type ?? 'conversation',
			{ messageId, timestamp, statementTurnCount },
		));
	}

	return records;
}

export function createMockMessageRecordSequence(
	count: number,
	options: {
		startMessageId?: string;
		baseTimestamp?: string;
		alternateRoles?: boolean;
		//includeToolMessages?: boolean;
	} = {},
): LLMMessage[] {
	const messages: LLMMessage[] = [];
	//const baseTime = options.baseTimestamp ? new Date(options.baseTimestamp) : new Date();

	for (let i = 0; i < count; i++) {
		const messageId = options.startMessageId ? `${options.startMessageId}-${i + 1}` : crypto.randomUUID();

		//const timestamp = new Date(baseTime.getTime() + (i * 1000)).toISOString();

		let role: 'user' | 'assistant'; // | 'tool';
		// 		if (options.includeToolMessages && i % 3 === 2) {
		// 			role = 'tool';
		// 		} else
		if (options.alternateRoles) {
			role = i % 2 === 0 ? 'user' : 'assistant';
		} else {
			role = 'assistant';
		}

		const message = new LLMMessage(
			role,
			[{ type: 'text', text: `Test message ${i + 1}` }],
			{
				statementCount: Math.floor(i / 2) + 1,
				statementTurnCount: (i % 2) + 1,
				interactionTurnCount: i + 1,
			},
			undefined,
			undefined,
			messageId,
		);

		messages.push(message);
	}

	return messages;
}

export function createMockTokenUsageRecordWithHistory(
	currentRecord: Partial<TokenUsageRecord>,
	previousRecord?: TokenUsageRecord,
): TokenUsageRecord {
	const baseRecord = createMockTokenUsageRecord(
		currentRecord.role ?? 'assistant',
		currentRecord.type ?? 'conversation',
		{
			messageId: currentRecord.messageId,
			timestamp: currentRecord.timestamp,
			inputTokens: currentRecord.rawUsage?.inputTokens,
			outputTokens: currentRecord.rawUsage?.outputTokens,
			cacheCreationInputTokens: currentRecord.rawUsage?.cacheCreationInputTokens,
			cacheReadInputTokens: currentRecord.rawUsage?.cacheReadInputTokens,
		},
	);

	if (previousRecord) {
		// Calculate differential usage based on previous record
		baseRecord.differentialUsage = {
			inputTokens: baseRecord.rawUsage.inputTokens - previousRecord.rawUsage.inputTokens,
			outputTokens: baseRecord.rawUsage.outputTokens - previousRecord.rawUsage.outputTokens,
			totalTokens: (
				baseRecord.rawUsage.inputTokens +
				baseRecord.rawUsage.outputTokens -
				previousRecord.rawUsage.inputTokens -
				previousRecord.rawUsage.outputTokens
			),
		};
	}

	return baseRecord;
}
