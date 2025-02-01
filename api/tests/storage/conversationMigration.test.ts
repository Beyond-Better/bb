import {
	//assert,
	assertEquals,
	assertRejects,
} from 'api/tests/deps.ts';
import { ConversationMigration } from 'api/storage/conversationMigration.ts';
import type {
	//ConversationDetailedMetadata,
	ConversationMetadata,
	//ConversationMetrics,
} from 'shared/types.ts';
import { ensureDir } from '@std/fs';
import { join } from '@std/path';

const TEST_DATA_DIR = './test_data';

async function setupTestDir() {
	await ensureDir(TEST_DATA_DIR);
	return TEST_DATA_DIR;
}

async function cleanup() {
	try {
		await Deno.remove(TEST_DATA_DIR, { recursive: true });
	} catch {
		// Ignore cleanup errors
	}
}

Deno.test('ConversationMigration.readMetadata', async (t) => {
	const testDir = await setupTestDir();

	await t.step('returns defaultMetadata when file does not exist', async () => {
		await assertRejects(
			() => ConversationMigration['readMetadata'](join(testDir, 'nonexistent.json')),
			Error,
			'Legacy conversation: metadata.json not found',
		);
	});

	await t.step('throws on malformed JSON', async () => {
		const metadataPath = join(testDir, 'malformed.json');
		await Deno.writeTextFile(metadataPath, '{ bad json }');

		await assertRejects(
			() => ConversationMigration['readMetadata'](metadataPath),
			Error,
			'Invalid JSON',
		);
	});

	await t.step('returns correct data for valid file', async () => {
		const metadataPath = join(testDir, 'valid.json');
		const testData = {
			version: 1,
			id: 'test',
			title: 'Test Conversation',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			llmProviderName: 'test',
			model: 'test',
			tokenUsageConversation: {
				inputTokens: 0,
				outputTokens: 0,
				totalTokens: 0,
			},
		} as ConversationMetadata;
		await Deno.writeTextFile(metadataPath, JSON.stringify(testData));

		const metadata = await ConversationMigration['readMetadata'](metadataPath);
		assertEquals(metadata, testData, 'Should return exact data from file');
	});

	await cleanup();
});

Deno.test('ConversationMigration.migrateV1toV2', async (t) => {
	const testDir = await setupTestDir();
	const conversationDir = join(testDir, 'test_conversation');
	await ensureDir(conversationDir);

	await t.step('migrates v1 to v2', async () => {
		// Create v1 metadata
		const metadataPath = join(conversationDir, 'metadata.json');
		const v1Metadata = {
			id: 'test',
			title: 'Test Conversation',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			llmProviderName: 'test',
			model: 'test',
			tokenUsageConversation: {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
			},
		};
		await Deno.writeTextFile(metadataPath, JSON.stringify(v1Metadata));

		// Run migration
		const result = await ConversationMigration['migrateV1toV2'](conversationDir);
		console.log('Migrate v1 to v2:', result);

		// Verify results
		assertEquals(result.success, true, 'Migration should succeed');
		assertEquals(result.version, { from: 1, to: 2 }, 'Version should be updated');
		assertEquals(result.changes.length, 1, 'Should have one changes (metadata)');

		// Verify metadata was updated
		const updatedMetadata = await ConversationMigration['readMetadata'](metadataPath);
		console.log('updatedMetadata:', updatedMetadata);
		assertEquals(updatedMetadata.version, 2, 'Metadata version should be 2');
	});

	await cleanup();
});

Deno.test('ConversationMigration.migrateV1toV2', async (t) => {
	const testDir = await setupTestDir();
	const conversationDir = join(testDir, 'test_conversation');
	await ensureDir(conversationDir);

	await t.step('migrates v1 to v2', async () => {
		// Create v1 metadata
		const metadataPath = join(conversationDir, 'metadata.json');
		const v1Metadata = {
			version: 2,
			id: 'test',
			title: 'Test Conversation',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			llmProviderName: 'test',
			model: 'test',
			tokenUsageConversation: {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
			},
		};
		await Deno.writeTextFile(metadataPath, JSON.stringify(v1Metadata));

		// Create token usage records
		const tokenUsageDir = join(conversationDir, 'tokenUsage');
		await ensureDir(tokenUsageDir);
		const record = {
			messageId: 'test',
			timestamp: new Date().toISOString(),
			role: 'assistant',
			type: 'conversation',
			rawUsage: {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
				cacheCreationInputTokens: 50,
				cacheReadInputTokens: 25,
			},
			differentialUsage: {
				inputTokens: 100,
				outputTokens: 200,
				totalTokens: 300,
			},
			cacheImpact: {
				potentialCost: 300,
				actualCost: 225,
				savings: 75,
			},
		};
		await Deno.writeTextFile(
			join(tokenUsageDir, 'conversation.jsonl'),
			JSON.stringify(record) + '\n',
		);

		// Run migration
		const result = await ConversationMigration['migrateV2toV3'](conversationDir);
		console.log('Migrate v2 to v3:', result);

		// Verify results
		assertEquals(result.success, true, 'Migration should succeed');
		assertEquals(result.version, { from: 2, to: 3 }, 'Version should be updated');
		assertEquals(result.changes.length, 2, 'Should have two changes (token usage and metadata)');

		// Verify metadata was updated
		const updatedMetadata = await ConversationMigration['readMetadata'](metadataPath);
		assertEquals(updatedMetadata.version, 3, 'Metadata version should be 3');
		assertEquals(
			updatedMetadata.tokenUsageConversation?.totalAllTokens,
			375, // 300 + 50 + 25
			'totalAllTokens should be sum of totalTokens + cache tokens',
		);
	});

	await cleanup();
});
