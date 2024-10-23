import { assert, assertEquals } from 'api/tests/deps.ts';
import { stripAnsiCode } from '@std/fmt/colors';

import LLMToolConversationMetrics from '../tool.ts';
import type { LLMToolConversationMetricsData } from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import type { LLMToolRunBbResponseData } from 'api/llms/llmTool.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';

Deno.test({
	name: 'ConversationMetricsTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_metrics') as LLMToolConversationMetrics;
			assert(tool, 'Failed to get ConversationMetricsTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_metrics',
				toolInput: {},
			};

			// Mock conversation messages
			const mockMessages = [
				{
					role: 'user',
					content: 'Hello',
					providerResponse: {
						usage: {
							totalTokens: 10,
						},
					},
				},
				{
					role: 'assistant',
					content: 'Hi there!',
					providerResponse: {
						usage: {
							totalTokens: 15,
						},
					},
				},
				{
					role: 'user',
					content: 'How are you?',
					providerResponse: {
						usage: {
							totalTokens: 20,
						},
					},
				},
				{
					role: 'assistant',
					content: "I'm doing well, thank you!",
					providerResponse: {
						usage: {
							totalTokens: 25,
						},
					},
				},
				{
					role: 'tool',
					content: 'Some tool usage',
					providerResponse: {
						usage: {
							totalTokens: 30,
						},
					},
				},
			];

			const mockConversation = {
				getMessages: () => mockMessages,
			};

			const result = await tool.runTool(mockConversation as any, toolUse, projectEditor);
			// console.log('Basic functionality - bbResponse:', result.bbResponse);
			// console.log('Basic functionality - toolResponse:', result.toolResponse);
			// console.log('Basic functionality - toolResults:', result.toolResults);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			//const metrics = JSON.parse(result.bbResponse as string);
			if (typeof result.bbResponse === 'object' && 'data' in result.bbResponse) {
				const metrics = result.bbResponse.data as LLMToolConversationMetricsData;
				console.log('metrics:', metrics);

				assertEquals(metrics.summary.totalTurns, 5, 'Total turns should be 5');
				assertEquals(metrics.summary.messageTypes.user, 2, 'User messages should be 2');
				assertEquals(metrics.summary.messageTypes.assistant, 2, 'Assistant messages should be 2');
				assertEquals(metrics.summary.messageTypes.tool, 1, 'Tool messages should be 1');
				assertEquals(metrics.tokens.total, 100, 'Total token usage should be 100');
				assertEquals(metrics.tokens.byRole.user, 30, 'User token usage should be 30');
				assertEquals(metrics.tokens.byRole.assistant, 40, 'Assistant token usage should be 40');
				assertEquals(metrics.tokens.byRole.tool, 30, 'Tool token usage should be 30');
			}
			assert(
				stripAnsiCode(result.toolResponse).includes('Analyzed 5 conversation turns with 0 unique tools used.'),
				'Tool response should indicate successful calculation',
			);
			//assert(stripAnsiCode(result.bbResponse).includes('BB has calculated the conversation metrics'), 'BB response should indicate metrics calculation');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
