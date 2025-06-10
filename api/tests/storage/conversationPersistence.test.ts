import {
	//assert,
	assertEquals,
	assertObjectMatch,
} from 'api/tests/deps.ts';
import ConversationPersistence from 'api/storage/conversationPersistence.ts';
import type {
	ResourceMetrics,
	//ConversationMetrics,
} from 'shared/types.ts';

Deno.test('ConversationPersistence.defaultTokenUsage returns correct structure', () => {
	const tokenUsage = ConversationPersistence.defaultTokenUsage();

	assertObjectMatch(tokenUsage, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	});
});

Deno.test('ConversationPersistence.defaultConversationStats returns correct structure', () => {
	const stats = ConversationPersistence.defaultConversationStats();

	assertObjectMatch(stats, {
		statementCount: 0,
		statementTurnCount: 0,
		conversationTurnCount: 0,
	});
});

Deno.test('ConversationPersistence.defaultConversationMetrics returns correct structure', () => {
	const metrics = ConversationPersistence.defaultConversationMetrics();

	assertObjectMatch(metrics, {
		statementCount: 0,
		statementTurnCount: 0,
		conversationTurnCount: 0,
		objectives: { conversation: '', statement: [], timestamp: '' },
		resources: { accessed: new Set(), modified: new Set(), active: new Set() },
		toolUsage: {
			currentToolSet: '',
			toolStats: new Map(),
		},
	});
});

Deno.test('ConversationPersistence.defaultMetadata returns correct structure', () => {
	const metadata = ConversationPersistence.defaultMetadata();

	// Check version defaults to 1
	assertEquals(metadata.version, 3, 'Default version should be 3');

	// Check required fields exist with correct types
	assertEquals(typeof metadata.id, 'string', 'id should be string');
	assertEquals(typeof metadata.title, 'string', 'title should be string');
	assertEquals(typeof metadata.llmProviderName, 'string', 'llmProviderName should be string');
	assertEquals(typeof metadata.model, 'string', 'model should be string');
	assertEquals(typeof metadata.createdAt, 'string', 'createdAt should be string');
	assertEquals(typeof metadata.updatedAt, 'string', 'updatedAt should be string');

	// Check token usage structure
	assertEquals(metadata.tokenUsageStats.tokenUsageTurn, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		thoughtTokens: 0,
		totalAllTokens: 0,
	}, 'tokenUsageTurn should have correct structure and defaults');

	assertEquals(metadata.tokenUsageStats.tokenUsageStatement, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		thoughtTokens: 0,
		totalAllTokens: 0,
	}, 'tokenUsageStatement should have correct structure and defaults');

	assertEquals(metadata.tokenUsageStats.tokenUsageConversation, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		thoughtTokens: 0,
		totalAllTokens: 0,
	}, 'tokenUsageConversation should have correct structure and defaults');

	// Check conversation stats
	assertEquals(metadata.conversationStats, {
		statementCount: 0,
		statementTurnCount: 0,
		conversationTurnCount: 0,
	}, 'conversationStats should have correct structure and defaults');

	// Check conversation metrics
	assertObjectMatch(metadata.conversationMetrics, {
		statementCount: 0,
		statementTurnCount: 0,
		conversationTurnCount: 0,
		objectives: { conversation: '', statement: [], timestamp: '' },
		resources: { accessed: new Set(), modified: new Set(), active: new Set() } as ResourceMetrics,
		toolUsage: {
			currentToolSet: '',
			toolStats: new Map(),
		},
	}, 'conversationMetrics should have correct structure and defaults');

	// Check numeric fields
	assertEquals(metadata.temperature, 0, 'temperature should default to 0');
	assertEquals(metadata.maxTokens, 4096, 'maxTokens should default to 4096');
	assertEquals(metadata.totalProviderRequests, 0, 'totalProviderRequests should default to 0');
});
