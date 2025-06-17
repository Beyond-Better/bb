import { assert, assertEquals } from 'api/tests/deps.ts';
import { stripAnsiCode } from '@std/fmt/colors';

import type LLMToolConversationMetrics from '../tool.ts';
import type { LLMToolConversationMetricsResultData } from '../types.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
//import LLMMessage from 'api/llms/llmMessage.ts';
//import type { LLMToolRunBbResponseData } from 'api/llms/llmTool.ts';
import { createTestInteraction, getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import { createMockMessageRecordSequence, createMockTokenUsageRecord } from 'api/tests/mockData.ts';

Deno.test({
	name: 'ConversationMetricsTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Create test interaction
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create message sequence
			const messages = createMockMessageRecordSequence(4, {
				startMessageId: 'test-message',
				alternateRoles: true,
			});
			//console.log('messages:', messages);

			// Create token usage records with specific values
			const tokenRecords = [
				// User messages (15 tokens each = 30 total)
				createMockTokenUsageRecord('user', 'conversation', {
					messageId: 'test-message-1',
					inputTokens: 10,
					outputTokens: 5,
				}),
				// Assistant messages (20 tokens each = 40 total)
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'test-message-2',
					inputTokens: 12,
					outputTokens: 8,
				}),
				createMockTokenUsageRecord('user', 'conversation', {
					messageId: 'test-message-3',
					inputTokens: 10,
					outputTokens: 5,
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'test-message-4',
					inputTokens: 12,
					outputTokens: 8,
				}),
			];

			// Add messages and token usage to interaction
			for (let i = 0; i < messages.length; i++) {
				interaction.addMessage(messages[i]);
				await interaction.interactionPersistence.writeTokenUsage(tokenRecords[i], 'conversation');
			}

			// Save the conversation state
			await interaction.interactionPersistence.saveConversation(interaction);

			const result = await tool.runTool(interaction, toolUse, projectEditor);
			// console.log('Basic functionality - bbResponse:', result.bbResponse);
			// console.log('Basic functionality - toolResponse:', result.toolResponse);
			// console.log('Basic functionality - toolResults:', result.toolResults);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsResultData;
				//console.log('metrics:', metrics);

				// Message counts
				assertEquals(metrics.summary.totalTurns, 4, 'Total turns should be 4');
				assertEquals(metrics.summary.messageTypes.user, 2, 'User messages should be 2');
				assertEquals(metrics.summary.messageTypes.assistant, 2, 'Assistant messages should be 2');

				// Token usage
				assertEquals(metrics.tokens.total, 70, 'Total token usage should be 70');
				assertEquals(metrics.tokens.byRole.user, 30, 'User token usage should be 30');
				assertEquals(metrics.tokens.byRole.assistant, 40, 'Assistant token usage should be 40');
			}
			assert(
				stripAnsiCode(result.toolResponse).includes('Analyzed 4 conversation turns with 0 unique tools used.'),
				'Tool response should indicate successful calculation',
			);
			//assert(stripAnsiCode(result.bbResponse).includes('BB has calculated the conversation metrics'), 'BB response should indicate metrics calculation');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationMetricsTool - Cache impact analysis',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Create test interaction
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create message sequence
			const messages = createMockMessageRecordSequence(3, {
				startMessageId: 'cache-test',
				alternateRoles: true,
			});

			// Create token usage records with varying cache usage
			const tokenRecords = [
				// First message - cache creation
				createMockTokenUsageRecord('user', 'conversation', {
					messageId: 'cache-test-1',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 100,
					cacheReadInputTokens: 0,
				}),
				// Second message - cache read
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'cache-test-2',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 0,
					cacheReadInputTokens: 80,
				}),
				// Third message - mixed cache usage
				createMockTokenUsageRecord('user', 'conversation', {
					messageId: 'cache-test-3',
					inputTokens: 100,
					outputTokens: 50,
					cacheCreationInputTokens: 20,
					cacheReadInputTokens: 40,
				}),
			];

			// Add messages and token usage to interaction
			for (let i = 0; i < messages.length; i++) {
				interaction.addMessage(messages[i]);
				await interaction.interactionPersistence.writeTokenUsage(tokenRecords[i], 'conversation');
			}

			// Save the conversation state
			await interaction.interactionPersistence.saveConversation(interaction);

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsResultData;

				// Message counts
				assertEquals(metrics.summary.totalTurns, 3, 'Total turns should be 3');
				assertEquals(metrics.summary.messageTypes.user, 2, 'User messages should be 2');
				assertEquals(metrics.summary.messageTypes.assistant, 1, 'Assistant messages should be 1');

				// Token usage
				assertEquals(metrics.tokens.total, 450, 'Total token usage should be 450');
				assertEquals(metrics.tokens.byRole.user, 300, 'User token usage should be 300');
				assertEquals(metrics.tokens.byRole.assistant, 150, 'Assistant token usage should be 150');

				// Cache impact
				assert(metrics.tokens.cacheImpact.savingsTotal > 0, 'Should have cache savings');
				assert(
					metrics.tokens.cacheImpact.actualCost < metrics.tokens.cacheImpact.potentialCost,
					'Actual cost should be less than potential cost',
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationMetricsTool - Empty conversation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Create empty interaction
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Save the empty conversation state
			await interaction.interactionPersistence.saveConversation(interaction);

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsResultData;

				// Message counts
				assertEquals(metrics.summary.totalTurns, 0, 'Total turns should be 0');
				assertEquals(metrics.summary.messageTypes.user, 0, 'User messages should be 0');
				assertEquals(metrics.summary.messageTypes.assistant, 0, 'Assistant messages should be 0');

				// Token usage
				assertEquals(metrics.tokens.total, 0, 'Total token usage should be 0');
				assertEquals(metrics.tokens.byRole.user, 0, 'User token usage should be 0');
				assertEquals(metrics.tokens.byRole.assistant, 0, 'Assistant token usage should be 0');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationMetricsTool - Single role conversation',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Create test interaction
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create message sequence (all assistant messages)
			const messages = createMockMessageRecordSequence(3, {
				startMessageId: 'single-role',
				alternateRoles: false, // All assistant messages
			});

			// Create token usage records
			const tokenRecords = [
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'single-role-1',
					inputTokens: 50,
					outputTokens: 25,
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'single-role-2',
					inputTokens: 50,
					outputTokens: 25,
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'single-role-3',
					inputTokens: 50,
					outputTokens: 25,
				}),
			];

			// Add messages and token usage to interaction
			for (let i = 0; i < messages.length; i++) {
				interaction.addMessage(messages[i]);
				await interaction.interactionPersistence.writeTokenUsage(tokenRecords[i], 'conversation');
			}

			// Save the conversation state
			await interaction.interactionPersistence.saveConversation(interaction);

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsResultData;

				// Message counts
				assertEquals(metrics.summary.totalTurns, 3, 'Total turns should be 3');
				assertEquals(metrics.summary.messageTypes.user, 0, 'User messages should be 0');
				assertEquals(metrics.summary.messageTypes.assistant, 3, 'Assistant messages should be 3');

				// Token usage
				assertEquals(metrics.tokens.total, 225, 'Total token usage should be 225');
				assertEquals(metrics.tokens.byRole.user, 0, 'User token usage should be 0');
				assertEquals(metrics.tokens.byRole.assistant, 225, 'Assistant token usage should be 225');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationMetricsTool - Large token counts',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Create test interaction
			const interaction = await createTestInteraction('test-conversation', projectEditor);

			// Create message sequence
			const messages = createMockMessageRecordSequence(2, {
				startMessageId: 'large-tokens',
				alternateRoles: true,
			});

			// Create token usage records with large numbers
			const tokenRecords = [
				createMockTokenUsageRecord('user', 'conversation', {
					messageId: 'large-tokens-1',
					inputTokens: 100000,
					outputTokens: 50000,
				}),
				createMockTokenUsageRecord('assistant', 'conversation', {
					messageId: 'large-tokens-2',
					inputTokens: 200000,
					outputTokens: 100000,
				}),
			];

			// Add messages and token usage to interaction
			for (let i = 0; i < messages.length; i++) {
				interaction.addMessage(messages[i]);
				await interaction.interactionPersistence.writeTokenUsage(tokenRecords[i], 'conversation');
			}

			// Save the conversation state
			await interaction.interactionPersistence.saveConversation(interaction);

			const result = await tool.runTool(interaction, toolUse, projectEditor);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsResultData;

				// Message counts
				assertEquals(metrics.summary.totalTurns, 2, 'Total turns should be 2');
				assertEquals(metrics.summary.messageTypes.user, 1, 'User messages should be 1');
				assertEquals(metrics.summary.messageTypes.assistant, 1, 'Assistant messages should be 1');

				// Token usage
				assertEquals(metrics.tokens.total, 450000, 'Total token usage should be 450000');
				assertEquals(metrics.tokens.byRole.user, 150000, 'User token usage should be 150000');
				assertEquals(metrics.tokens.byRole.assistant, 300000, 'Assistant token usage should be 300000');
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
