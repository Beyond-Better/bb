import {
	//assert,
	assertEquals,
	assertObjectMatch,
} from 'api/tests/deps.ts';
import InteractionPersistence from 'api/storage/interactionPersistence.ts';
import type {
	ResourceMetrics,
	//InteractionMetrics,
} from 'shared/types.ts';

Deno.test('InteractionPersistence.defaultTokenUsage returns correct structure', () => {
	const tokenUsage = InteractionPersistence.defaultTokenUsage();

	assertObjectMatch(tokenUsage, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
	});
});

Deno.test('InteractionPersistence.defaultInteractionStats returns correct structure', () => {
	const stats = InteractionPersistence.defaultInteractionStats();

	assertObjectMatch(stats, {
		statementCount: 0,
		statementTurnCount: 0,
		interactionTurnCount: 0,
	});
});

Deno.test('InteractionPersistence.defaultInteractionMetrics returns correct structure', () => {
	const metrics = InteractionPersistence.defaultInteractionMetrics();

	assertObjectMatch(metrics, {
		statementCount: 0,
		statementTurnCount: 0,
		interactionTurnCount: 0,
		objectives: { collaboration: '', statement: [], timestamp: '' },
		resources: { accessed: new Set(), modified: new Set(), active: new Set() },
		toolUsage: {
			currentToolSet: '',
			toolStats: new Map(),
		},
	});
});

Deno.test('InteractionPersistence.defaultMetadata returns correct structure', () => {
	const metadata = InteractionPersistence.defaultMetadata();

	// Check version defaults to 1
	assertEquals(metadata.version, 4, 'Default version should be 4');

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

	assertEquals(metadata.tokenUsageStats.tokenUsageInteraction, {
		inputTokens: 0,
		outputTokens: 0,
		totalTokens: 0,
		thoughtTokens: 0,
		totalAllTokens: 0,
	}, 'tokenUsageInteraction should have correct structure and defaults');

	// Check conversation stats
	assertEquals(metadata.interactionStats, {
		statementCount: 0,
		statementTurnCount: 0,
		interactionTurnCount: 0,
	}, 'interactionStats should have correct structure and defaults');

	// Check conversation metrics
	assertObjectMatch(metadata.interactionMetrics, {
		statementCount: 0,
		statementTurnCount: 0,
		interactionTurnCount: 0,
		objectives: { collaboration: '', statement: [], timestamp: '' },
		resources: { accessed: new Set(), modified: new Set(), active: new Set() } as ResourceMetrics,
		toolUsage: {
			currentToolSet: '',
			toolStats: new Map(),
		},
	}, 'interactionMetrics should have correct structure and defaults');

	// Check numeric fields
	assertEquals(metadata.temperature, 0, 'temperature should default to 0');
	assertEquals(metadata.maxTokens, 4096, 'maxTokens should default to 4096');
	assertEquals(metadata.totalProviderRequests, 0, 'totalProviderRequests should default to 0');
});
