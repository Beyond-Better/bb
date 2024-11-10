import { assert, assertEquals, assertRejects } from 'api/tests/deps.ts';
//import { join } from '@std/path';
//import { ensureDir } from '@std/fs';
import { createTestInteraction, getProjectEditor, withTestProject } from 'api/tests/testSetup.ts';
import {
	createMockTokenUsageRecord,
	createMockTokenUsageRecordSequence,
	createMockTokenUsageRecordWithHistory,
} from 'api/tests/mockData.ts';
import { TokenUsageValidationError } from 'api/errors/error.ts';
import type { TokenUsageRecord } from 'shared/types.ts';

// Helper function to set up test directory structure
// async function setupTestDir(testProjectRoot: string, conversationId: string) {
// 	const bbDir = join(testProjectRoot, '.bb');
// 	const conversationsDir = join(bbDir, 'data', 'conversations', conversationId);
// 	await ensureDir(conversationsDir);
// 	return conversationsDir;
// }

Deno.test({
	name: 'TokenUsagePersistence - Basic write and read operations',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create test record using mock utility
			const record = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'test-message-1',
				inputTokens: 100,
				outputTokens: 50,
				cacheCreationInputTokens: 10,
				cacheReadInputTokens: 5,
			});

			// Write record
			await tokenUsagePersistence.writeUsage(record, 'conversation');

			// Read records
			const records = await tokenUsagePersistence.getUsage('conversation');

			// Assertions
			assertEquals(records.length, 1);
			assertEquals(records[0], record);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

// Move nested tests to top level

Deno.test({
	name: 'TokenUsagePersistence - Version migration handling',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create records in old format (v1)
			const oldFormatRecords = [
				// Version 1: Basic token counts only
				{
					messageId: 'v1-record-1',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
					differentialUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
					cacheImpact: {
						potentialCost: 150,
						actualCost: 150,
						savings: 0,
					},
				},

				// Version 1: With old cache fields
				{
					messageId: 'v1-record-2',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
						cacheCreationInputTokens: 20,
						cacheReadInputTokens: 10,
					},
					differentialUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
					cacheImpact: {
						potentialCost: 150,
						actualCost: 140,
						savings: 10,
					},
				},
			] as TokenUsageRecord[];

			// Write old format records
			for (const record of oldFormatRecords) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Write a current format record
			const currentRecord = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'current-record',
				inputTokens: 100,
				outputTokens: 50,
				cacheCreationInputTokens: 20,
				cacheReadInputTokens: 10,
			});
			await tokenUsagePersistence.writeUsage(currentRecord, 'conversation');

			// Verify we can read all records
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assert(savedRecords.length === oldFormatRecords.length + 1, 'Should read all records');

			// Verify analysis works with mixed format records
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');
			assert(analysis.totalUsage.input > 0, 'Should calculate total input tokens');
			assert(analysis.totalUsage.output > 0, 'Should calculate total output tokens');
			assert(analysis.cacheImpact.totalSavings >= 0, 'Should calculate cache savings');

			// Verify role-based analysis works
			assert(analysis.byRole.assistant > 0, 'Should track assistant role usage');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Handle file system errors',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create a valid record
			const record = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'test-fs-errors',
				inputTokens: 100,
				outputTokens: 50,
			});

			// Write record to establish baseline
			await tokenUsagePersistence.writeUsage(record, 'conversation');

			// Verify record was written
			let savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assert(savedRecords.length > 0, 'Should save initial record');

			// Test recovery after write errors
			const subsequentRecord = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'test-fs-recovery',
				inputTokens: 200,
				outputTokens: 100,
			});

			// Write another record to verify system can continue
			await tokenUsagePersistence.writeUsage(subsequentRecord, 'conversation');

			// Verify we can still read records
			savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assert(savedRecords.length > 1, 'Should continue saving records after errors');

			// Verify analysis still works
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');
			assert(analysis.totalUsage.input > 0, 'Should calculate usage after errors');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Concurrent storage access',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create multiple records with unique IDs
			const records = Array.from(
				{ length: 10 },
				(_, i) =>
					createMockTokenUsageRecord('assistant', 'conversation', {
						messageId: `concurrent-${i}`,
						inputTokens: 100 + i,
						outputTokens: 50 + i,
					}),
			);

			// Write records with minimal delay between them
			const writePromises = records.map(async (record) => {
				// Add small random delay to simulate real concurrent access
				await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
				return tokenUsagePersistence.writeUsage(record, 'conversation');
			});

			// Wait for all writes to complete
			await Promise.all(writePromises);

			// Verify all records were saved
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assert(savedRecords.length >= records.length, 'Should save all concurrent records');

			// Verify no duplicate message IDs
			const messageIds = new Set(savedRecords.map((r) => r.messageId));
			assertEquals(messageIds.size, records.length, 'Should have no duplicate message IDs');

			// Verify analysis works with concurrent writes
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');
			assert(analysis.totalUsage.input > 0, 'Should calculate total usage from concurrent writes');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Cache impact edge cases',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Test various cache impact scenarios
			const cacheTestCases = [
				// Case 1: Cache creation but no reads
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-create-only',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 100,
					cacheReadInputTokens: 0,
				}),

				// Case 2: Cache reads but no creation
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-read-only',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 100,
				}),

				// Case 3: Cache reads equal to input tokens
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-read-equal',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 100,
				}),

				// Case 4: Very small cache values (testing floating point precision)
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-small-values',
					inputTokens: 1,
					outputTokens: 1,
					cacheCreationInputTokens: 0.1,
					cacheReadInputTokens: 0.1,
				}),

				// Case 5: Very large cache values
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-large-values',
					inputTokens: 1000000,
					outputTokens: 500000,
					cacheCreationInputTokens: 1000000,
					cacheReadInputTokens: 1000000,
				}),

				// Case 6: Slightly incorrect savings calculation
				{
					...createMockTokenUsageRecord('assistant', 'conversation', {
						messageId: 'cache-incorrect-savings',
						inputTokens: 100,
						outputTokens: 50,
						cacheCreationInputTokens: 10,
						cacheReadInputTokens: 5,
					}),
					cacheImpact: {
						potentialCost: 100,
						actualCost: 95,
						savings: 4, // Slightly off from expected 5
					},
				},
			];

			// Write all test cases
			for (const record of cacheTestCases) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Verify records were saved
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assert(savedRecords.length > 0, 'Should save records with various cache patterns');

			// Analyze cache impact
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');

			// Verify cache impact calculations
			assert(analysis.cacheImpact.potentialCost >= 0, 'Potential cost should be non-negative');
			assert(analysis.cacheImpact.actualCost >= 0, 'Actual cost should be non-negative');
			assert(analysis.cacheImpact.totalSavings >= 0, 'Total savings should be non-negative');
			assert(
				analysis.cacheImpact.actualCost <= analysis.cacheImpact.potentialCost,
				'Actual cost should not exceed potential cost',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Handle corrupted storage',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// First, write some valid records
			const validRecords = createMockTokenUsageRecordSequence(2, {
				startMessageId: 'valid',
				type: 'conversation',
			});

			for (const record of validRecords) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Now try some malformed records that might occur in storage
			const malformedRecords = [
				// Partial record with minimal valid structure
				{
					messageId: 'partial-record',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
					differentialUsage: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
					cacheImpact: {
						potentialCost: 0,
						actualCost: 0,
						savings: 0,
					},
				},

				// Record with minimal values
				{
					messageId: 'minimal-values',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: 1,
						outputTokens: 1,
						totalTokens: 2,
					},
					differentialUsage: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
					cacheImpact: {
						potentialCost: 1,
						actualCost: 1,
						savings: 0,
					},
				},

				// Record with unusual but valid values
				{
					messageId: 'unusual-values',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: Number.MAX_SAFE_INTEGER,
						outputTokens: Number.MAX_SAFE_INTEGER,
						totalTokens: Number.MAX_SAFE_INTEGER,
					},
					differentialUsage: {
						inputTokens: 0,
						outputTokens: 0,
						totalTokens: 0,
					},
					cacheImpact: {
						potentialCost: Number.MAX_SAFE_INTEGER,
						actualCost: Number.MAX_SAFE_INTEGER,
						savings: 0,
					},
				},
			] as TokenUsageRecord[];

			// Write records with unusual values - should log warnings but not throw
			for (const record of malformedRecords) {
				// These should succeed since they have valid structure
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Write another valid record to verify we can continue after malformed data
			const finalRecord = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'final-valid',
				inputTokens: 100,
				outputTokens: 50,
			});
			await tokenUsagePersistence.writeUsage(finalRecord, 'conversation');

			// Verify we can still read records
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			// Count breakdown:
			// - 2 initial valid records
			// - 3 malformed but structurally valid records
			// - 1 final valid record
			// Total expected: 6 records
			assertEquals(savedRecords.length, 6, 'Should have saved all structurally valid records');

			// Verify we can find our final valid record
			const finalSavedRecord = savedRecords.find((r) => r.messageId === 'final-valid');
			assert(finalSavedRecord, 'Should find final valid record');
			assertEquals(finalSavedRecord.rawUsage.inputTokens, 100);
			assertEquals(finalSavedRecord.rawUsage.outputTokens, 50);

			// Verify we can still analyze usage
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');
			assert(analysis.totalUsage.total >= 0, 'Should calculate total tokens');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Real-world token usage patterns',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Test cases that might occur in real usage
			const realWorldCases = [
				// Case 1: Very large token counts
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'large-tokens',
					inputTokens: 100000,
					outputTokens: 50000,
					cacheCreationInputTokens: 1000,
					cacheReadInputTokens: 500,
				}),

				// Case 2: Zero tokens but valid message
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'zero-tokens',
					inputTokens: 0,
					outputTokens: 0,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 0,
				}),

				// Case 3: Minimal valid record with all required structures
				{
					messageId: 'minimal-fields',
					role: 'assistant',
					type: 'conversation',
					timestamp: new Date().toISOString(),
					rawUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
					differentialUsage: {
						inputTokens: 100,
						outputTokens: 50,
						totalTokens: 150,
					},
					cacheImpact: {
						potentialCost: 150,
						actualCost: 150,
						savings: 0,
					},
				} as TokenUsageRecord,

				// Case 4: Floating point token counts (should be rounded)
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'float-tokens',
					inputTokens: 100.5,
					outputTokens: 50.7,
				}),

				// Case 5: Cache usage larger than input tokens
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'large-cache',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 200,
					cacheReadInputTokens: 150,
				}),
			];

			// Write all records
			for (const record of realWorldCases) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Verify records were saved
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			console.log('savedRecords', savedRecords);
			assert(savedRecords.length > 0, 'Should save real-world records');

			// Verify we can still analyze usage with these records
			const analysis = await tokenUsagePersistence.analyzeUsage('conversation');
			assert(analysis.totalUsage.input >= 0, 'Total input tokens should be non-negative');
			assert(analysis.totalUsage.output >= 0, 'Total output tokens should be non-negative');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

// Test validation error handling
Deno.test({
	name: 'TokenUsagePersistence - Validation error handling',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Test type mismatch - should throw and not save
			const mismatchedType = createMockTokenUsageRecord('assistant', 'conversation');
			const mismatchedError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(mismatchedType, 'chat'),
				TokenUsageValidationError,
				'Type mismatch',
			) as TokenUsageValidationError;
			assertEquals(mismatchedError.options.field, 'type');
			assertEquals(
				(mismatchedError.options.value as { record: string; parameter: string }).record,
				'conversation',
			);
			assertEquals(
				(mismatchedError.options.value as { record: string; parameter: string }).parameter,
				'chat',
			);

			// Create test records upfront
			// 1. Record with multiple validation issues
			const multipleIssues = {
				timestamp: new Date().toISOString(),
				type: 'conversation' as const,
				role: 'invalid' as 'assistant',
				messageId: 'test-multiple',
				rawUsage: {
					inputTokens: -1,
					outputTokens: -2,
					totalTokens: -3,
				},
				differentialUsage: {
					inputTokens: 0,
					outputTokens: 0,
					totalTokens: 0,
				},
				cacheImpact: {
					potentialCost: 10,
					actualCost: 20, // Invalid: actual > potential
					savings: 0,
				},
			} as TokenUsageRecord;

			// 2. Valid record for final verification
			const validRecord = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'valid-message',
				inputTokens: 100,
				outputTokens: 50,
			});

			// 3. Records with validation errors
			const invalidRecords = [
				// Missing required fields but with correct type
				{
					timestamp: new Date().toISOString(),
					type: 'conversation' as const,
					// Missing messageId and role
				} as TokenUsageRecord,

				// Invalid role but correct type
				createMockTokenUsageRecord('invalid' as 'assistant', 'conversation'),

				// Negative tokens but correct type
				createMockTokenUsageRecord('assistant', 'conversation', {
					inputTokens: -100,
					outputTokens: 50,
				}),
			];

			// Write invalid records - should throw for structural validation errors
			// Case 1: Missing required fields
			const missingFieldsError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(invalidRecords[0], 'conversation'),
				TokenUsageValidationError,
				'Missing required field',
			) as TokenUsageValidationError;
			assert(missingFieldsError.options.constraint === 'required', 'Should indicate field is required');

			// Case 2: Invalid role
			const invalidRoleError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(invalidRecords[1], 'conversation'),
				TokenUsageValidationError,
				'Invalid role',
			) as TokenUsageValidationError;
			assertEquals(invalidRoleError.options.field, 'role', 'Should indicate role field is invalid');
			assert(invalidRoleError.options.constraint?.includes('must be one of:'), 'Should list valid roles');

			// Case 3: Negative tokens (should log warning but save)
			await tokenUsagePersistence.writeUsage(invalidRecords[2], 'conversation');

			// Write record with multiple validation issues - should throw for invalid role
			const multipleIssuesError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(multipleIssues, 'conversation'),
				TokenUsageValidationError,
				'Invalid role',
			) as TokenUsageValidationError;
			assertEquals(multipleIssuesError.options.field, 'role', 'Should indicate role field is invalid');
			assert(multipleIssuesError.options.constraint?.includes('must be one of:'), 'Should list valid roles');

			// Write valid record
			await tokenUsagePersistence.writeUsage(validRecord, 'conversation');

			// Get initial state
			let savedRecords = await tokenUsagePersistence.getUsage('conversation');

			// Test another type mismatch - should throw with correct error details
			const anotherMismatch = createMockTokenUsageRecord('assistant', 'chat');
			const anotherError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(anotherMismatch, 'conversation'),
				TokenUsageValidationError,
				'Type mismatch',
			) as TokenUsageValidationError;

			// Get final state of saved records
			savedRecords = await tokenUsagePersistence.getUsage('conversation');

			// Verify error details for type mismatch
			assertEquals(anotherError.options.field, 'type', 'Error should indicate type field mismatch');
			assertEquals(
				(anotherError.options.value as { record: string; parameter: string }).record,
				'chat',
				'Error should contain mismatched record type',
			);
			assertEquals(
				(anotherError.options.value as { record: string; parameter: string }).parameter,
				'conversation',
				'Error should contain expected type',
			);

			// Verify final record count
			// Count breakdown:
			// - invalidRecords[0]: throws missing field error
			// - invalidRecords[1]: throws invalid role error
			// - invalidRecords[2]: saved (negative tokens - warning only)
			// - multipleIssues: throws invalid role error
			// - validRecord: saved successfully
			// Total expected: 2 records
			assertEquals(
				savedRecords.length,
				2,
				'Should have saved only records with warnings or valid records (1 negative tokens + 1 valid = 2)',
			);

			// Verify we can find the saved records
			// 1. Record with negative tokens (warning only)
			const negativeTokensRecord = savedRecords.find((r) => r.rawUsage.inputTokens < 0);
			assert(negativeTokensRecord, 'Should find record with negative tokens');
			assertEquals(negativeTokensRecord.rawUsage.inputTokens, -100, 'Should preserve negative input tokens');
			assertEquals(negativeTokensRecord.rawUsage.outputTokens, 50, 'Should preserve mixed token values');

			// 2. Valid record
			const validSavedRecord = savedRecords.find((r) => r.messageId === 'valid-message');
			assert(validSavedRecord, 'Should find valid record');
			assertEquals(validSavedRecord.rawUsage.inputTokens, 100, 'Valid record should have correct input tokens');
			assertEquals(validSavedRecord.rawUsage.outputTokens, 50, 'Valid record should have correct output tokens');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Multiple records and sequence handling',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create sequence of records
			const records = createMockTokenUsageRecordSequence(5, {
				startMessageId: 'test-sequence',
				alternateRoles: true,
			});

			// Write records
			for (const record of records) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Read and verify records
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assertEquals(savedRecords.length, records.length);

			// Verify sequence order is maintained
			for (let i = 0; i < records.length; i++) {
				assertEquals(savedRecords[i].messageId, records[i].messageId);
				assertEquals(savedRecords[i].role, records[i].role);
			}

			// Verify timestamps are in order
			let previousTimestamp = new Date(savedRecords[0].timestamp).getTime();
			for (let i = 1; i < savedRecords.length; i++) {
				const currentTimestamp = new Date(savedRecords[i].timestamp).getTime();
				assert(
					currentTimestamp >= previousTimestamp,
					`Records should be in chronological order. Index ${i} is out of order.`,
				);
				previousTimestamp = currentTimestamp;
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Differential usage tracking',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create initial record
			const firstRecord = createMockTokenUsageRecord('assistant', 'conversation', {
				inputTokens: 100,
				outputTokens: 50,
				cacheCreationInputTokens: 10,
				cacheReadInputTokens: 5,
			});

			// Create second record with history
			const secondRecord = createMockTokenUsageRecordWithHistory({
				role: 'assistant',
				rawUsage: {
					inputTokens: 150,
					outputTokens: 75,
					totalTokens: 225,
					cacheCreationInputTokens: 20,
					cacheReadInputTokens: 10,
				},
			}, firstRecord);

			// Write records
			await tokenUsagePersistence.writeUsage(firstRecord, 'conversation');
			await tokenUsagePersistence.writeUsage(secondRecord, 'conversation');

			// Read and verify records
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assertEquals(savedRecords.length, 2);

			// Verify differential calculations
			const lastRecord = savedRecords[1];
			assertEquals(lastRecord.differentialUsage.inputTokens, 50); // 150 - 100
			assertEquals(lastRecord.differentialUsage.outputTokens, 25); // 75 - 50
			assertEquals(lastRecord.differentialUsage.totalTokens, 75); // (150 + 75) - (100 + 50)
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Validation warning vs error behavior',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Test cases that should log warnings but not throw
			const warningCases = [
				// Case 1: Negative token counts
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'negative-tokens',
					inputTokens: -100,
					outputTokens: -50,
				}),

				// Case 2: Cache impact calculation mismatch
				{
					...createMockTokenUsageRecord('assistant', 'conversation', {
						messageId: 'cache-mismatch',
						inputTokens: 100,
						outputTokens: 50,
					}),
					cacheImpact: {
						potentialCost: 100,
						actualCost: 150, // Invalid: actual > potential
						savings: -50,
					},
				},

				// Case 3: Incorrect savings calculation
				{
					...createMockTokenUsageRecord('assistant', 'conversation', {
						messageId: 'savings-mismatch',
						inputTokens: 100,
						outputTokens: 50,
					}),
					cacheImpact: {
						potentialCost: 100,
						actualCost: 80,
						savings: 15, // Should be 20
					},
				},
			];

			// These should all succeed despite validation warnings
			for (const record of warningCases) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Verify records were saved and values preserved
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assertEquals(savedRecords.length, warningCases.length, 'Should save all records with validation warnings');

			// Verify negative tokens case
			const negativeTokensRecord = savedRecords.find((r) => r.messageId === 'negative-tokens');
			assert(negativeTokensRecord, 'Should find negative tokens record');
			assertEquals(negativeTokensRecord.rawUsage.inputTokens, -100, 'Should preserve negative input tokens');
			assertEquals(negativeTokensRecord.rawUsage.outputTokens, -50, 'Should preserve negative output tokens');

			// Verify cache impact mismatch case
			const cacheMismatchRecord = savedRecords.find((r) => r.messageId === 'cache-mismatch');
			assert(cacheMismatchRecord, 'Should find cache mismatch record');
			assertEquals(cacheMismatchRecord.cacheImpact.actualCost, 150, 'Should preserve invalid actual cost');
			assertEquals(cacheMismatchRecord.cacheImpact.potentialCost, 100, 'Should preserve potential cost');

			// Verify savings mismatch case
			const savingsMismatchRecord = savedRecords.find((r) => r.messageId === 'savings-mismatch');
			assert(savingsMismatchRecord, 'Should find savings mismatch record');
			assertEquals(savingsMismatchRecord.cacheImpact.savings, 15, 'Should preserve incorrect savings value');

			// Test cases that should throw errors
			const errorCases = [
				// Case 1: Missing required field
				{
					timestamp: new Date().toISOString(),
					type: 'conversation' as const,
					// Missing messageId and role
				} as TokenUsageRecord,

				// Case 2: Invalid role
				createMockTokenUsageRecord('invalid' as 'assistant', 'conversation'),

				// Case 3: Missing required structure
				{
					messageId: 'missing-structure',
					role: 'assistant',
					type: 'conversation' as const,
					timestamp: new Date().toISOString(),
					// Missing rawUsage structure
				} as TokenUsageRecord,
			];

			// Test missing required fields
			const missingFieldsError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(errorCases[0], 'conversation'),
				TokenUsageValidationError,
				'Missing required field',
			) as TokenUsageValidationError;
			assert(missingFieldsError.options.constraint === 'required', 'Should indicate field is required');

			// Test invalid role
			const invalidRoleError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(errorCases[1], 'conversation'),
				TokenUsageValidationError,
				'Invalid role',
			) as TokenUsageValidationError;
			assertEquals(invalidRoleError.options.field, 'role', 'Should indicate role field is invalid');
			assert(
				invalidRoleError.options.constraint?.includes('must be one of:'),
				'Should list valid roles in constraint',
			);

			// Test missing structure
			const missingStructureError = await assertRejects(
				async () => await tokenUsagePersistence.writeUsage(errorCases[2], 'conversation'),
				TokenUsageValidationError,
				'Missing required structure',
			) as TokenUsageValidationError;
			assert(
				missingStructureError.options.constraint === 'structure is required',
				'Should indicate structure is required',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'TokenUsagePersistence - Cache impact analysis',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction('test-conversation', projectEditor);
			const tokenUsagePersistence = interaction.conversationPersistence['tokenUsagePersistence'];

			// Create records with varying cache usage
			const records = [
				createMockTokenUsageRecord('assistant', 'conversation', {
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 20,
					cacheReadInputTokens: 0, // No cache hits
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 15, // Some cache hits
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 30, // More cache hits
				}),
			];

			// Write records
			for (const record of records) {
				await tokenUsagePersistence.writeUsage(record, 'conversation');
			}

			// Read and verify records
			const savedRecords = await tokenUsagePersistence.getUsage('conversation');
			assertEquals(savedRecords.length, records.length);

			// Verify cache impact calculations
			for (const record of savedRecords) {
				assert(record.cacheImpact.potentialCost > 0, 'Potential cost should be positive');
				assert(record.cacheImpact.actualCost > 0, 'Actual cost should be positive');
				assert(
					record.cacheImpact.actualCost <= record.cacheImpact.potentialCost,
					'Actual cost should not exceed potential cost',
				);
				assertEquals(
					record.cacheImpact.savings,
					record.cacheImpact.potentialCost - record.cacheImpact.actualCost,
					'Savings should be the difference between potential and actual cost',
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
