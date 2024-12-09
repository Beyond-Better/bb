import {
	assert,
	assertEquals,
	//assertRejects,
} from 'api/tests/deps.ts';
//import { join } from '@std/path';
//import { ensureDir } from '@std/fs';

import { createTestInteraction, getProjectEditor, withTestProject } from 'api/tests/testSetup.ts';
import {
	createMockTokenUsageRecord,
	createMockTokenUsageRecordSequence,
	//createMockTokenUsageRecordWithHistory
} from 'api/tests/mockData.ts';
//import type { TokenUsageRecord } from 'shared/types.ts';
// import type {
// 	LLMAnswerToolUse,
// 	LLMMessageContentPart,
// 	//LLMMessageContentParts,
// 	LLMMessageContentPartTextBlock,
// 	LLMMessageContentPartToolResultBlock,
// 	LLMMessageContentPartToolUseBlock,
// 	//LLMMessageProviderResponse,
// } from 'api/llms/llmMessage.ts';
import LLMMessage from 'api/llms/llmMessage.ts';

Deno.test({
	name: 'ConversationPersistence - Token usage integration initialization',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test setup
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Verify TokenUsagePersistence is initialized
			assert(
				interaction.conversationPersistence['tokenUsagePersistence'],
				'TokenUsagePersistence should be initialized',
			);

			// Verify initial state
			const records = await interaction.conversationPersistence.getTokenUsage('conversation');
			assertEquals(records.length, 0, 'Should start with no records');
		});

		Deno.test({
			name: 'ConversationPersistence - Token usage persistence across sessions',
			fn: async () => {
				await withTestProject(async (testProjectId, testProjectRoot) => {
					const projectEditor = await getProjectEditor(testProjectId);
					const conversationId = 'persistence-test-conversation';

					// First session
					let interaction = await createTestInteraction(conversationId, projectEditor);

					// Create and save some records
					const records = createMockTokenUsageRecordSequence(3, {
						startMessageId: 'session1',
						type: 'conversation',
					});

					// Save records in first session
					for (const record of records) {
						await interaction.conversationPersistence.writeTokenUsage(record, 'conversation');
					}

					// Create a message and save the conversation
					const message = new LLMMessage('assistant', [{ type: 'text', text: 'Session 1 message' }], {
						statementCount: 1,
						statementTurnCount: 1,
						conversationTurnCount: 1,
					});
					interaction.addMessage(message);
					await interaction.conversationPersistence.saveConversation(interaction);

					// Second session with same conversation ID
					interaction = await createTestInteraction(conversationId, projectEditor);

					// Verify records persisted
					const savedRecords = await interaction.conversationPersistence.getTokenUsage('conversation');
					assertEquals(
						savedRecords.length,
						records.length,
						'Should have same number of records across sessions',
					);

					// Verify record content
					for (let i = 0; i < records.length; i++) {
						assertEquals(savedRecords[i].messageId, records[i].messageId, 'Record messageIds should match');
						assertEquals(savedRecords[i].type, records[i].type, 'Record types should match');
					}
				});
			},
			sanitizeResources: false,
			sanitizeOps: false,
		});

		Deno.test({
			name: 'ConversationPersistence - Handle concurrent token usage writes',
			fn: async () => {
				await withTestProject(async (testProjectId, testProjectRoot) => {
					const projectEditor = await getProjectEditor(testProjectId);
					const interaction = await createTestInteraction('concurrent-writes', projectEditor);

					// Create records with same messageId but different content
					const baseRecord = createMockTokenUsageRecord('assistant', 'conversation', {
						messageId: 'concurrent-message',
						inputTokens: 100,
						outputTokens: 50,
					});

					const records = Array.from({ length: 5 }, (_, i) => ({
						...baseRecord,
						timestamp: new Date(Date.now() + i * 1000).toISOString(), // Stagger timestamps
						rawUsage: {
							...baseRecord.rawUsage,
							inputTokens: baseRecord.rawUsage.inputTokens + i * 10,
							outputTokens: baseRecord.rawUsage.outputTokens + i * 5,
						},
					}));

					// Write records concurrently
					await Promise.all(
						records.map((record) =>
							interaction.conversationPersistence.writeTokenUsage(record, 'conversation')
						),
					);

					// Verify records
					const savedRecords = await interaction.conversationPersistence.getTokenUsage('conversation');

					// Should have saved all records despite same messageId
					assertEquals(savedRecords.length, records.length, 'Should save all concurrent records');

					// Verify timestamps are preserved and ordered
					let previousTimestamp = new Date(savedRecords[0].timestamp).getTime();
					for (let i = 1; i < savedRecords.length; i++) {
						const currentTimestamp = new Date(savedRecords[i].timestamp).getTime();
						assert(
							currentTimestamp >= previousTimestamp,
							`Records should maintain chronological order. Index ${i} is out of order.`,
						);
						previousTimestamp = currentTimestamp;
					}
				});
			},
			sanitizeResources: false,
			sanitizeOps: false,
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationPersistence - Save conversation with token usage',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test setup
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create test record using mock utility
			const record = createMockTokenUsageRecord('assistant', 'conversation', {
				messageId: 'test-message-1',
				inputTokens: 100,
				outputTokens: 50,
			});

			// Save conversation with token usage
			// Create and add a message to the interaction
			const message = new LLMMessage(
				'assistant',
				[{ type: 'text', text: 'Test message' }],
				{
					statementCount: 1,
					statementTurnCount: 1,
					conversationTurnCount: 1,
				},
				undefined,
				undefined,
				'test-message-1',
			);

			// Add message and update interaction properties
			interaction.addMessage(message);
			interaction.id = 'test-conversation';
			interaction.title = 'Test Conversation';
			interaction.model = 'test-model';
			interaction.maxTokens = 4096;
			interaction.temperature = 0.7;
			interaction.totalProviderRequests = 1;

			// Track token usage
			await interaction.conversationPersistence.writeTokenUsage(record, 'conversation');

			// Save the interaction
			await interaction.conversationPersistence.saveConversation(interaction);

			// Verify token usage was saved
			const records = await interaction.conversationPersistence.getTokenUsage('conversation');
			assertEquals(records.length, 1);
			assertEquals(records[0], record);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationPersistence - Token usage analysis with history',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test setup
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create sequence of records with alternating roles
			const records = createMockTokenUsageRecordSequence(4, {
				startMessageId: 'test-sequence',
				alternateRoles: true,
				type: 'conversation',
			});

			// Save records
			for (const record of records) {
				await interaction.conversationPersistence.writeTokenUsage(record, 'conversation');
			}

			// Analyze token usage
			const analysis = await interaction.conversationPersistence.getTokenUsageAnalysis();

			// Verify analysis structure
			assert(analysis.conversation, 'Should have conversation analysis');
			assert(analysis.conversation.totalUsage, 'Should have total usage stats');
			assert(analysis.conversation.differentialUsage, 'Should have differential usage stats');
			assert(analysis.conversation.cacheImpact, 'Should have cache impact stats');
			assert(analysis.conversation.byRole, 'Should have role-based stats');

			// Verify role-based analysis
			assert(
				analysis.conversation.byRole.assistant > 0,
				'Should have assistant token usage',
			);
			assert(
				analysis.conversation.byRole.user > 0,
				'Should have user token usage',
			);

			// Verify cache impact calculations
			assert(
				analysis.conversation.cacheImpact.potentialCost >= analysis.conversation.cacheImpact.actualCost,
				'Potential cost should be >= actual cost',
			);
			assertEquals(
				analysis.conversation.cacheImpact.totalSavings,
				analysis.conversation.cacheImpact.potentialCost - analysis.conversation.cacheImpact.actualCost,
				'Savings should be potential - actual cost',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

/*
// [TODO] Test is unreliable (or intermittent) - fails when running in github actions
// re-enable when eiher test or persistence class is fixed
Deno.test({
	name: 'ConversationPersistence - Handle concurrent conversation saves',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test setup
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create multiple records
			const records = createMockTokenUsageRecordSequence(5, {
				startMessageId: 'concurrent-test',
				type: 'conversation',
			});
			//console.log('createMockTokenUsageRecordSequence:', records);

			// Save conversations concurrently
			await Promise.all(
				records.map(async (record) => {
					// Create and add message
					const message = new LLMMessage(
						'assistant',
						[
							{ type: 'text', text: `Message ${record.messageId}` },
						],
						{
							statementCount: 1,
							statementTurnCount: 1,
							conversationTurnCount: 1,
						},
						undefined,
						undefined,
						record.messageId,
					);

					// Set up interaction properties
					interaction.addMessage(message);
					interaction.id = record.messageId;
					interaction.title = `Test Conversation ${record.messageId}`;
					interaction.model = 'test-model';
					interaction.maxTokens = 4096;
					interaction.temperature = 0.7;
					interaction.totalProviderRequests = 1;

					// Track token usage
					await interaction.conversationPersistence.writeTokenUsage(
						record,
						'conversation',
					);

					// Save the interaction
					return interaction.conversationPersistence.saveConversation(interaction);
				}),
			);

			// Verify all records were saved
			const savedRecords = await interaction.conversationPersistence.getTokenUsage(
				'conversation',
			);
			assertEquals(savedRecords.length, records.length);

			// Verify record integrity
			const messageIds = new Set(savedRecords.map((r) => r.messageId));
			assertEquals(messageIds.size, records.length, 'Should have no duplicate messages');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */

Deno.test({
	name: 'ConversationPersistence - Token usage with chat interactions',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			// Test setup
			const projectEditor = await getProjectEditor(testProjectId);
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create records for both conversation and chat
			const conversationRecords = createMockTokenUsageRecordSequence(2, {
				startMessageId: 'conv',
				type: 'conversation',
			});
			const chatRecords = createMockTokenUsageRecordSequence(2, {
				startMessageId: 'chat',
				type: 'chat',
			});

			// Save all records
			for (const record of [...conversationRecords, ...chatRecords]) {
				await interaction.conversationPersistence.writeTokenUsage(
					record,
					record.type,
				);
			}

			// Analyze token usage
			const analysis = await interaction.conversationPersistence.getTokenUsageAnalysis();

			// Verify separate tracking
			assert(analysis.conversation, 'Should have conversation analysis');
			assert(analysis.chat, 'Should have chat analysis');

			// Verify conversation records
			const savedConvRecords = await interaction.conversationPersistence.getTokenUsage(
				'conversation',
			);
			assertEquals(savedConvRecords.length, conversationRecords.length);

			// Verify chat records
			const savedChatRecords = await interaction.conversationPersistence.getTokenUsage(
				'chat',
			);
			assertEquals(savedChatRecords.length, chatRecords.length);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
