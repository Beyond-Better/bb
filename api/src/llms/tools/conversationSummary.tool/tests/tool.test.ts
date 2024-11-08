import { assert, assertEquals, assertRejects } from 'api/tests/deps.ts';
import { join } from '@std/path';
import { ensureDir } from '@std/fs';

import LLMToolConversationSummary from '../tool.ts';
import type { LLMToolConversationBbResponseData } from '../tool.ts';
import type {
	LLMAnswerToolUse,
	LLMMessageContentPart,
	//LLMMessageContentParts,
	LLMMessageContentPartTextBlock,
	LLMMessageContentPartToolResultBlock,
	LLMMessageContentPartToolUseBlock,
	//LLMMessageProviderResponse,
} from 'api/llms/llmMessage.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { ConversationMetrics } from 'shared/types.ts';

import { makeChatInteractionStub, makeOrchestratorControllerStub } from 'api/tests/stubs.ts';
import {
	createTestChatInteraction,
	createTestInteraction,
	getProjectEditor,
	getToolManager,
	incrementConversationStats,
	withTestProject,
} from 'api/tests/testSetup.ts';

// Helper function to set up conversation directory structure
async function setupConversationDir(testProjectRoot: string, conversationId: string) {
	const bbDir = join(testProjectRoot, '.bb');
	const conversationsDir = join(bbDir, 'data', 'conversations', conversationId);
	await ensureDir(conversationsDir);
	return conversationsDir;
}

// Helper function to create test messages
async function createTestMessages(
	conversationsDir: string,
	messages: LLMMessage[],
) {
	const messagesJsonl = messages.map((msg, idx) => ({
		idx,
		conversationStats: {
			statementCount: 1,
			statementTurnCount: idx + 1,
			conversationTurnCount: idx + 1,
		},
		role: msg.role,
		content: msg.content,
		id: `test-msg-${idx}`,
		timestamp: new Date().toISOString(),
		...(msg.providerResponse ? { providerResponse: msg.providerResponse } : {}),
	})).map((msg) => JSON.stringify(msg)).join('\n');

	await Deno.writeTextFile(join(conversationsDir, 'messages.jsonl'), messagesJsonl);
	await Deno.writeTextFile(join(conversationsDir, 'conversation.jsonl'), '');
	await Deno.writeTextFile(join(conversationsDir, 'conversation.log'), '');
	await Deno.writeTextFile(
		join(conversationsDir, 'metadata.json'),
		`{
  "id": "test-conversation",
  "title": "Test Conversation",
  "llmProviderName": "anthropic",
  "model": "",
  "createdAt": "2024-11-07T04:12:24.679Z",
  "updatedAt": "2024-11-07T04:12:24.679Z",
  "temperature": 0.2,
  "maxTokens": 8192,
  "totalProviderRequests": 0,
  "tokenUsageTurn": {
    "totalTokens": 0,
    "inputTokens": 0,
    "outputTokens": 0
  },
  "tokenUsageStatement": {
    "inputTokens": 50,
    "outputTokens": 40,
    "totalTokens": 10
  },
  "tokenUsageConversation": {
    "totalTokensTotal": 100,
    "inputTokensTotal": 10,
    "outputTokensTotal": 90
  },
  "conversationStats": {
    "statementTurnCount": 1,
    "conversationTurnCount": 1,
    "statementCount": 1
  }
}`,
	);
}

Deno.test({
	name: 'ConversationSummaryTool - Handle edge case - Empty Messages',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- No decisions made`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle edge cases - empty conversation - bbResponse:', result.bbResponse);
				// console.log('Handle edge cases - empty conversation - toolResponse:', result.toolResponse);
				// console.log('Handle edge cases - empty conversation - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.originalTokenCount === 0, 'Empty conversation should have 0 tokens');
				assert(data.originalMessageCount === 0, 'Empty conversation should have 0 messages');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle edge case - Very large token count',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First Large response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Second message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Second Large response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- No decisions made`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 128000, // Default max
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle edge cases - Very large token count - bbResponse:', result.bbResponse);
				// console.log('Handle edge cases - Very large token count - toolResponse:', result.toolResponse);
				// console.log('Handle edge cases - Very large token count - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.originalTokenCount === 200000, 'Should handle large token count');
				assert(data.newTokenCount <= 128000, 'Should truncate to maxTokensToKeep');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle edge case - Minimum allowed token count',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First Large response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Second message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Second Large response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- No decisions made`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1000, // Minimum allowed
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle edge cases - Minimum allowed token count - bbResponse:', result.bbResponse);
				// console.log('Handle edge cases - Minimum allowed token count - toolResponse:', result.toolResponse);
				// console.log('Handle edge cases - Minimum allowed token count - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.originalTokenCount === 1500, 'Should handle minimum token scenario');
				assert(data.newTokenCount <= 1000, 'Should truncate to minimum tokens');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle requestSource parameter - user',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
						requestSource: 'user',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle requestSource parameter - user - bbResponse:', result.bbResponse);
				// console.log('Handle requestSource parameter - user - toolResponse:', result.toolResponse);
				// console.log('Handle requestSource parameter - user - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.requestSource === 'user', 'bbResponse data should show user request source');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle requestSource parameter - tool',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
						requestSource: 'tool',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle requestSource parameter - tool - bbResponse:', result.bbResponse);
				// console.log('Handle requestSource parameter - tool - toolResponse:', result.toolResponse);
				// console.log('Handle requestSource parameter - tool - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.requestSource === 'tool', 'bbResponse data should show user request source');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle requestSource parameter - default',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id-1',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Handle requestSource parameter - default - bbResponse:', result.bbResponse);
				// console.log('Handle requestSource parameter - default - toolResponse:', result.toolResponse);
				// console.log('Handle requestSource parameter - default - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.requestSource === 'tool', 'bbResponse data should show user request source');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle invalid requestSource value',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
						requestSource: 'invalid' as 'user' | 'tool', // Type assertion to bypass TypeScript
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'requestSource must be allowed value (tool|user)',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Verify backup creation and truncation',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages that will trigger truncation
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Second message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Second response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Third message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Third response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Fourth message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Fourth response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 2000,
						summaryLength: 'short',
					},
				};

				// Set up backups directory path
				const backupsDir = join(conversationsDir, 'backups');

				// Clean up any existing backups
				try {
					await Deno.remove(backupsDir, { recursive: true });
				} catch (error) {
					if (!(error instanceof Deno.errors.NotFound)) {
						throw error;
					}
				}

				// Verify backups directory doesn't exist yet
				const backupsDirExists = await Deno.stat(backupsDir).catch(() => null);
				assert(!backupsDirExists, 'Backups directory should not exist before truncation');

				// Run tool to trigger backup creation
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Verify backup creation - bbResponse:', result.bbResponse);
				console.log('Verify backup creation - toolResponse:', result.toolResponse);
				console.log('Verify backup creation - toolResults:', result.toolResults);

				// console.log('Verifying conversation directory contents:');
				// for await (const entry of Deno.readDir(conversationsDir)) {
				// 	console.log(`- ${entry.name}`);
				// }

				// Verify backups directory was created
				const backupsDirInfo = await Deno.stat(backupsDir).catch(() => null);
				assert(backupsDirInfo?.isDirectory, 'Backups directory should be created');

				// List all files in backups directory
				console.log('\nFiles in backups directory:');
				for await (const entry of Deno.readDir(backupsDir)) {
					console.log(`- ${entry.name}`);
				}

				// Helper function to validate backup timestamp
				const validateBackupTimestamp = (filename: string) => {
					const timestampPattern =
						/\.(jsonl|json|log)\.(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
					const match = filename.match(timestampPattern);
					//console.log(`validateBackupTimestamp - match: ${filename}`, match);
					if (!match) return false;

					const timestamp = `${match[2]}-${match[3]}-${match[4]}T${match[5]}:${match[6]}:${match[7]}.${
						match[8]
					}Z`;
					//console.log(`validateBackupTimestamp - timestamp: ${timestamp}`);
					const date = new Date(timestamp);
					//console.log(`validateBackupTimestamp - date: ${date}`);
					return !isNaN(date.getTime());
				};

				// Check for backup files with timestamp pattern
				const backupFiles: string[] = [];
				for await (const entry of Deno.readDir(backupsDir)) {
					console.log(`Checking file: ${entry.name}`);
					if (validateBackupTimestamp(entry.name)) {
						//console.log(`Valid backup file found: ${entry.name}`);
						backupFiles.push(entry.name);
					} else {
						console.log(`Invalid backup filename format: ${entry.name}`);
					}
				}

				// Group and verify backup files
				console.log('\nFound backup files:', backupFiles);
				const backupsByType = {
					messages: backupFiles.filter((f) => f.startsWith('messages.jsonl.')),
					conversation: backupFiles.filter((f) => f.startsWith('conversation.jsonl.')),
					metadata: backupFiles.filter((f) => f.startsWith('metadata.json.')),
				};
				console.log('Grouped backup files:', backupsByType);

				// Verify required backup files exist
				Object.entries(backupsByType).forEach(([type, files]) => {
					assert(
						files.length > 0,
						`No backup found for ${type}. Found files: ${JSON.stringify(backupFiles)}`,
					);
				});

				// Get most recent backup of each type
				const getLatestBackup = (files: string[]) => {
					const sorted = files.sort((a, b) => b.localeCompare(a));
					//console.log(`Sorted backups: ${JSON.stringify(sorted)}`);
					return sorted[0];
				};

				const latestBackups = {
					messages: getLatestBackup(backupsByType.messages),
					conversation: getLatestBackup(backupsByType.conversation),
					metadata: getLatestBackup(backupsByType.metadata),
				};
				//console.log('Latest backups:', latestBackups);

				// Read and count lines in files
				const readAndCountLines = async (filename: string, backupPath: string) => {
					const currentPath = join(conversationsDir, filename);
					const backupFullPath = join(backupsDir, backupPath);
					//console.log(`Reading files:\n- Current: ${currentPath}\n- Backup: ${backupFullPath}`);

					const current = await Deno.readTextFile(currentPath);
					const backup = await Deno.readTextFile(backupFullPath);
					//console.log(`Content for ${filename}:\n- Current: \n${current}\n- Backup: \n${backup}`);

					const currentLines = current.trim().split('\n').length;
					const backupLines = backup.trim().split('\n').length;

					//console.log(`Line counts for ${filename}:\n- Current: ${currentLines}\n- Backup: ${backupLines}`);

					return { current, backup, currentLines, backupLines };
				};

				// Verify messages backup
				const messagesContent = await readAndCountLines('messages.jsonl', latestBackups.messages);
				// Backup should have all 8 original messages
				assert(
					messagesContent.backupLines === 8,
					`Backup should have 8 messages, got ${messagesContent.backupLines}`,
				);
				// Current should have 6 messages (2 setup + 4 kept)
				assert(
					messagesContent.currentLines === 6,
					`Current should have 6 messages after truncation, got ${messagesContent.currentLines}`,
				);
				// Content should be different
				assert(
					messagesContent.current !== messagesContent.backup,
					'Current messages.jsonl should be different from backup after truncation',
				);

				// Verify metadata backup
				const metadataContent = await readAndCountLines('metadata.json', latestBackups.metadata);
				// Metadata should be different after truncation
				assert(
					metadataContent.current !== metadataContent.backup,
					'Current metadata.json should be different from backup after truncation',
				);

				// [TODO] turn counts are not modified as part of conversation summary; they remain at previous values
				// It's undecided whether or not that is a good thing. We should probably have current and historical counts
				// // Parse and verify metadata changes
				// const currentMetadata = JSON.parse(metadataContent.current);
				// const backupMetadata = JSON.parse(metadataContent.backup);
				// assert(
				// 	currentMetadata.conversationStats.conversationTurnCount < backupMetadata.conversationStats.conversationTurnCount,
				// 	'Current metadata should show fewer conversation turns after truncation'
				// );

				// Verify backup timestamps are recent
				Object.values(latestBackups).forEach((filename) => {
					const timestampPattern =
						/\.(jsonl|json|log)\.(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
					const timestampMatch = filename.match(timestampPattern);
					//console.log(`latestBackups - match: ${filename}`, timestampMatch);

					assert(timestampMatch, `Backup filename ${filename} should contain timestamp`);

					const timestamp = new Date(
						`${timestampMatch[2]}-${timestampMatch[3]}-${timestampMatch[4]}T${timestampMatch[5]}:${
							timestampMatch[6]
						}:${timestampMatch[7]}.${timestampMatch[8]}Z`,
					);
					const now = new Date();
					const timeDiff = now.getTime() - timestamp.getTime();
					assert(
						timeDiff < 5000, // 5 seconds
						`Backup timestamp should be within 5 seconds of current time. File: ${filename}, Time diff: ${timeDiff}ms`,
					);
				});
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle file operations in summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with file operations
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Show me the config file' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using request_files to get config.ts' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 2050 } },
				},
				{
					role: 'user',
					content: [{
						type: 'tool_result',
						text: 'Added src/config.ts to the conversation',
					}, {
						type: 'text',
						text:
							'<bbFile path="src/config.ts" type="text" size="1000" last_modified="2024-01-01T00:00:00.000Z" revision="abc123">\nconst config = {\n  // Config file contents\n};\n</bbFile>',
					}],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using search_and_replace to modify config.ts' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1950 } },
				},
				{
					role: 'user',
					content: [{
						type: 'tool_result',
						text: 'Modified src/config.ts successfully',
					}, {
						type: 'text',
						text:
							'<bbFile path="src/config.ts" type="text" size="1100" last_modified="2024-01-01T00:00:01.000Z" revision="def456">\nconst config = {\n  // Updated config file contents\n};\n</bbFile>',
					}],
					conversationStats: incrementConversationStats(conversationStats),
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- src/config.ts (revisions: abc123, def456)
  * Retrieved file contents
  * Modified configuration settings

### Tools Used
- request_files: Retrieved config.ts
- search_and_replace: Modified config.ts

### Key Decisions
- Updated configuration settings`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				// Configure tool to force truncation
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1900, // With 4000 total tokens, this will force truncation
						summaryLength: 'short',
					},
				};

				// Run tool and verify truncation
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('Handle file operations in summary - bbResponse:', result.bbResponse);
				console.log('Handle file operations in summary - toolResponse:', result.toolResponse);
				console.log('Handle file operations in summary - toolResults:', result.toolResults);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				// Verify truncation occurred
				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assert(data.originalTokenCount === 4000, 'Original token count should be 4000');
				assert(data.newTokenCount <= 2000, 'New token count should be <= 2000');

				// Verify summary structure and content quality
				assert(
					data.summary.startsWith('## Removed Conversation Context'),
					'Summary should start with correct header',
				);
				assert(data.summary.includes('*From'), 'Summary should include date range');

				// Verify Files Referenced section
				const fileSection = data.summary.split('### Files Referenced')[1].split('###')[0];
				assert(fileSection.includes('src/config.ts'), 'Files section should list config.ts');
				assert(fileSection.includes('abc123'), 'Files section should include first revision');
				assert(fileSection.includes('def456'), 'Files section should include second revision');
				assert(fileSection.includes('Retrieved file contents'), 'Files section should describe read operation');
				assert(fileSection.includes('Modified'), 'Files section should describe modification');

				// Verify Tools Used section
				const toolSection = data.summary.split('### Tools Used')[1].split('###')[0];
				assert(toolSection.includes('request_files'), 'Tools section should list request_files');
				assert(toolSection.includes('search_and_replace'), 'Tools section should list search_and_replace');
				assert(toolSection.includes('Retrieved config.ts'), 'Tools section should describe file retrieval');
				assert(toolSection.includes('Modified config.ts'), 'Tools section should describe file modification');

				// Verify Key Decisions section
				const decisionSection = data.summary.split('### Key Decisions')[1].split('###')[0];
				assert(
					decisionSection.includes('Updated configuration'),
					'Decisions section should mention configuration update',
				);

				// Verify metadata
				const metadata = data.metadata;

				// Verify message range
				assert(metadata.messageRange.start.id, 'Metadata should include start message id');
				assert(metadata.messageRange.start.timestamp, 'Metadata should include start timestamp');
				assert(metadata.messageRange.end.id, 'Metadata should include end message id');
				assert(metadata.messageRange.end.timestamp, 'Metadata should include end timestamp');

				// Verify token counts
				assert(
					metadata.originalTokenCount === data.originalTokenCount,
					'Metadata token count should match data',
				);
				assert(metadata.summaryTokenCount > 0, 'Metadata should include summary token count');

				// Verify model information
				assert(metadata.model, 'Metadata should include model information');
				assert(!metadata.fallbackUsed, 'Fallback should not be used in normal operation');

				// Verify tool uses are captured
				assert(data.summary.includes('request_files'), 'Summary should mention request_files tool');
				assert(data.summary.includes('search_and_replace'), 'Summary should mention search_and_replace tool');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Verify summary length requirements - short summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [{
				role: 'user',
				content: [{ type: 'text', text: 'First message' }],
				conversationStats: incrementConversationStats(conversationStats),
			}, {
				role: 'assistant',
				content: [{ type: 'text', text: 'Response' }],
				conversationStats: incrementConversationStats(conversationStats),
				providerResponse: { usage: { totalTokens: 500 } },
			}] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Verify summary length requirements - short summary - bbResponse:', result.bbResponse);
				// console.log('Verify summary length requirements - short summary - toolResponse:', result.toolResponse);
				// console.log('Verify summary length requirements - short summary - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				// Verify summary content quality
				assert(data.summary.includes('### Files Referenced'), 'Short summary missing Files Referenced');
				// Verify summary formatting
				assert(
					data.summary.startsWith('## Removed Conversation Context'),
					'Summary should start with correct header',
				);
				assert(data.summary.includes('*From'), 'Summary should include date range');

				// Verify section content quality
				const fileSection = data.summary.split('### Files Referenced')[1].split('###')[0];
				assert(fileSection.includes('No files'), 'Files section should indicate no files when none used');

				const toolSection = data.summary.split('### Tools Used')[1].split('###')[0];
				assert(toolSection.includes('No tools'), 'Tools section should indicate no tools when none used');

				const decisionSection = data.summary.split('### Key Decisions')[1].split('###')[0];
				assert(decisionSection.includes('Initial'), 'Decisions section should mention initial conversation');
				assert(data.summary.includes('### Tools Used'), 'Short summary missing Tools Used');
				assert(data.summary.includes('### Key Decisions'), 'Short summary missing Key Decisions');
				assert(
					!data.summary.includes('### Requirements Established'),
					'Short summary should not have Requirements',
				);
				assert(!data.summary.includes('### Code Changes'), 'Short summary should not have Code Changes');
				assert(
					!data.summary.includes('### Project Context'),
					'Short summary should not have Project Context',
				);
				assert(
					!data.summary.includes('### External References'),
					'Short summary should not have External References',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Verify summary length requirements - medium summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [{
				role: 'user',
				content: [{ type: 'text', text: 'First message' }],
				conversationStats: incrementConversationStats(conversationStats),
			}, {
				role: 'assistant',
				content: [{ type: 'text', text: 'Response' }],
				conversationStats: incrementConversationStats(conversationStats),
				providerResponse: { usage: { totalTokens: 500 } },
			}] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established

### Requirements Established
- No requirements set

### Code Changes
- No code changes made

### Project Context
- Initial setup phase`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Verify summary length requirements - medium summary - bbResponse:', result.bbResponse);
				// console.log('Verify summary length requirements - medium summary - toolResponse:', result.toolResponse);
				// console.log('Verify summary length requirements - medium summary - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.summary.includes('### Files Referenced'), 'Medium summary missing Files Referenced');
				assert(data.summary.includes('### Tools Used'), 'Medium summary missing Tools Used');
				assert(data.summary.includes('### Key Decisions'), 'Medium summary missing Key Decisions');
				assert(
					data.summary.includes('### Requirements Established'),
					'Medium summary missing Requirements',
				);
				assert(data.summary.includes('### Code Changes'), 'Medium summary missing Code Changes');
				assert(data.summary.includes('### Project Context'), 'Medium summary missing Project Context');
				assert(
					!data.summary.includes('### External References'),
					'Medium summary should not have External References',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Verify summary length requirements - long summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [{
				role: 'user',
				content: [{ type: 'text', text: 'First message' }],
				conversationStats: incrementConversationStats(conversationStats),
			}, {
				role: 'assistant',
				content: [{ type: 'text', text: 'Response' }],
				conversationStats: incrementConversationStats(conversationStats),
				providerResponse: { usage: { totalTokens: 500 } },
			}] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established

### Requirements Established
- No requirements set

### Code Changes
- No code changes made

### Project Context
- Initial setup phase

### External References
- No external references`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				// Run tool and verify backup files are created
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Verify summary length requirements - long summary - bbResponse:', result.bbResponse);
				// console.log('Verify summary length requirements - long summary - toolResponse:', result.toolResponse);
				// console.log('Verify summary length requirements - long summary - toolResults:', result.toolResults);

				// Verify the response structure
				assert(
					result.bbResponse && typeof result.bbResponse === 'object',
					'bbResponse should be an object',
				);
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				assert(data.summary.includes('### Files Referenced'), 'Long summary missing Files Referenced');
				assert(data.summary.includes('### Tools Used'), 'Long summary missing Tools Used');
				assert(data.summary.includes('### Key Decisions'), 'Long summary missing Key Decisions');
				assert(data.summary.includes('### Requirements Established'), 'Long summary missing Requirements');
				assert(data.summary.includes('### Code Changes'), 'Long summary missing Code Changes');
				assert(data.summary.includes('### Project Context'), 'Long summary missing Project Context');
				assert(
					data.summary.includes('### External References'),
					'Long summary missing External References',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle interrupted tool sequence',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with an interrupted tool sequence
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{
						type: 'tool_use',
						id: 'tool-1',
						name: 'test_tool',
						input: { param: 'value' },
					}],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1500 } },
				},
				{
					role: 'user',
					content: [{
						type: 'tool_result',
						tool_use_id: 'tool-1',
						content: [{ type: 'text', text: 'Tool use was interrupted' }],
						is_error: true,
					}],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{
						type: 'tool_use',
						id: 'tool-2',
						name: 'test_tool',
						input: { param: 'value' },
					}],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- Tool 1 was interrupted
- Tool 2 was attempted

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1000,
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				//console.log('Handle interrupted tool sequence - bbResponse:', result.bbResponse);
				//console.log('Handle interrupted tool sequence - toolResponse:', result.toolResponse);
				//console.log('Handle interrupted tool sequence - toolResults:', result.toolResults);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				// Get final messages
				const messages = interaction.getMessages();
				console.log(
					'Final message sequence:',
					messages.map((m) => ({
						role: m.role,
						content: m.content.map((c) => ({
							type: c.type,
							text: 'text' in c ? c.text.substring(0, 80) + '...' : undefined,
						})),
					})),
				);

				// After truncation, we expect:
				// 1. Initial user message asking to incorporate context
				// 2. Assistant message with summary
				// 3. User message to continue
				// 4. Assistant message with tool 2 use (tool 1 sequence removed)
				assert(messages.length === 4, `Expected 4 messages after truncation, got ${messages.length}`);

				// Verify first three messages are the setup sequence
				assert(
					messages[0].role === 'user' && messages[0].content[0].type === 'text',
					'First message should be user text',
				);
				assert(
					messages[1].role === 'assistant' && messages[1].content[0].type === 'text',
					'Second message should be assistant summary',
				);
				assert(
					messages[2].role === 'user' && messages[2].content[0].type === 'text',
					'Third message should be user text',
				);

				// Verify last message contains only tool 2 use
				const lastMessage = messages[3];
				assert(lastMessage.role === 'assistant', 'Last message should be from assistant');
				assert(lastMessage.content.length === 1, 'Last message should have exactly one content part');

				// Verify it's tool 2
				const toolUsePart = lastMessage.content[0] as LLMMessageContentPartToolUseBlock;
				assert(toolUsePart.type === 'tool_use', 'Last message should be tool use');
				assert(toolUsePart.id === 'tool-2', 'Last message should be tool 2');

				// Verify no messages contain any part of the interrupted sequence
				const hasInterruptedSequence = messages.some((msg) =>
					msg.content.some((part) => {
						if (part.type === 'tool_use') {
							const toolUse = part as LLMMessageContentPartToolUseBlock;
							return toolUse.id === 'tool-1';
						}
						if (part.type === 'tool_result') {
							const toolResult = part as LLMMessageContentPartToolResultBlock;
							return toolResult.tool_use_id === 'tool-1';
						}
						return false;
					})
				);
				assert(!hasInterruptedSequence, 'No part of interrupted sequence should remain');

				// Verify message alternation
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}

				// Verify token counts
				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assert(
					data.originalTokenCount === 2500,
					`Expected original token count 2500, got ${data.originalTokenCount}`,
				);
				assert(data.newTokenCount <= data.originalTokenCount, 'New token count should not exceed original');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Basic functionality - Generate summary without truncation',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			// Create test messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'How are you?' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: "I'm doing well, thank you!" }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 25 } },
				},
			] as LLMMessage[];
			// console.log('Test messages:');
			// testMessages.forEach((msg, i) => {
			// 	console.log(`Message ${i}:`);
			// 	console.log(`  Role: ${msg.role}`);
			// 	console.log(`  Content: ${JSON.stringify(msg.content)}`);
			// 	if (msg.providerResponse) {
			// 		console.log(`  Tokens: ${msg.providerResponse.usage.totalTokens}`);
			// 	}
			// });
			//
			// console.log('\nWriting test messages to:', join(conversationsDir, 'messages.jsonl'));
			// console.log('\nCreating test messages:', testMessages.map((m) => ({ role: m.role, content: m.content })));

			await createTestMessages(conversationsDir, testMessages);

			// Verify the files were created
			// console.log('\nVerifying conversation directory contents:');
			// for await (const entry of Deno.readDir(conversationsDir)) {
			// 	console.log(`- ${entry.name}`);
			// }

			// Read back the messages file to verify content
			const messagesContent = await Deno.readTextFile(join(conversationsDir, 'messages.jsonl'));
			// console.log('\nVerifying messages.jsonl content:');
			// console.log(messagesContent);

			// List directory contents to verify files
			// console.log('Conversation directory:',conversationsDir);
			// console.log('Conversation directory contents:');
			// for await (const entry of Deno.readDir(conversationsDir)) {
			// 	console.log(`- ${entry.name}`);
			// }

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);

			// // Log initial messages in interaction
			// const initialMessages = interaction.getMessages();
			// console.log(
			// 	'\nInitial messages in interaction:',
			// 	initialMessages.map((m) => ({ role: m.role, content: m.content })),
			// );
			//
			// // Verify messages were loaded into interaction
			// const loadedMessages = interaction.getMessages();
			// console.log('\nVerifying loaded messages:');
			// loadedMessages.forEach((msg, i) => {
			// 	console.log(`Message ${i}:`);
			// 	console.log(`  Role: ${msg.role}`);
			// 	console.log(`  Content: ${JSON.stringify(msg.content)}`);
			// 	if (msg.providerResponse) {
			// 		console.log(`  Tokens: ${msg.providerResponse.usage.totalTokens}`);
			// 	}
			// });
			//
			// // Log interaction messages
			// const interactionMessages = interaction.getMessages();
			// console.log('\nInteraction messages after creation:');
			// interactionMessages.forEach((msg, i) => {
			// 	console.log(`Message ${i}:`);
			// 	console.log(`  Role: ${msg.role}`);
			// 	console.log(`  Content: ${JSON.stringify(msg.content)}`);
			// 	if (msg.providerResponse) {
			// 		console.log(`  Tokens: ${msg.providerResponse.usage.totalTokens}`);
			// 	}
			// });

			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns a properly formatted summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced in this conversation

### Tools Used
- No tools were used in this conversation

### Key Decisions
- Established initial greeting and rapport

### Requirements Established
- None specified

### Code Changes
- No code changes were made

### Project Context
- This was an introductory conversation`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'medium',
					},
				};

				console.log('\nRunning tool with input:', toolUse.toolInput);
				const result = await tool.runTool(interaction, toolUse, projectEditor);
				console.log('\nTool result:', {
					bbResponse: result.bbResponse,
					toolResponse: result.toolResponse,
					toolResults: result.toolResults,
				});
				//console.log('Basic functionality - Generate summary without truncation - bbResponse:', result.bbResponse);
				//console.log('Basic functionality - Generate summary without truncation - toolResponse:', result.toolResponse);
				//console.log('Basic functionality - Generate summary without truncation - toolResults:', result.toolResults);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assertEquals(data.originalTokenCount, 40, 'Original token count should be 40');
				assertEquals(data.summaryLength, 'medium', 'Summary length should be medium');
				assert(data.summary.includes('## Removed Conversation Context'), 'Summary should have correct header');
				assert(data.summary.includes('### Files Referenced'), 'Summary should have Files Referenced section');
				assert(data.summary.includes('### Tools Used'), 'Summary should have Tools Used section');
				assert(data.summary.includes('### Key Decisions'), 'Summary should have Key Decisions section');
				assert(
					data.summary.includes('### Requirements Established'),
					'Summary should have Requirements section',
				);
				assert(data.summary.includes('### Code Changes'), 'Summary should have Code Changes section');
				assert(data.summary.includes('### Project Context'), 'Summary should have Project Context section');

				// Verify tool response includes success message
				assert(
					result.toolResponse.includes('summarized successfully'),
					'Tool response should indicate success',
				);

				// Verify tool results include summary stats
				const toolResults = result.toolResults as string;
				assert(toolResults.includes('Token Reduction:'), 'Tool results should show token reduction');
				assert(toolResults.includes('Messages:'), 'Tool results should show message counts');
				assert(toolResults.includes('Summary Type: medium'), 'Tool results should show summary type');

				// Verify messages are preserved (since we're not truncating)
				const messages = interaction.getMessages();
				//console.log('\nMessages after tool run:', messages.map((m) => ({ role: m.role, content: m.content })));
				assertEquals(messages.length, testMessages.length, 'All messages should be preserved');
				for (let i = 0; i < messages.length; i++) {
					assertEquals(messages[i].role, testMessages[i].role, `Message ${i} should have correct role`);
					assertEquals(
						(messages[i].content[0] as LLMMessageContentPartTextBlock).text,
						(testMessages[i].content[0] as LLMMessageContentPartTextBlock).text,
						`Message ${i} should have correct content`,
					);
				}
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Generate long summary with complex context',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with complex project context
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'We need to refactor the authentication system' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using search_project to find auth files' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Found auth.ts and auth.test.ts' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'After reviewing the files, we should implement OAuth2' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Sounds good, what changes do we need?' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using search_and_replace to update auth.ts' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Updated authentication implementation' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Now we need to update the tests' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 100 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns a properly formatted long summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- auth.ts: Authentication implementation file, modified to add OAuth2 support
- auth.test.ts: Test file updated to cover new OAuth2 functionality
- Related configuration files identified but not modified

### Tools Used
- search_project: Located authentication-related files
  - Found main implementation and test files
  - Identified related configuration files
- search_and_replace: Updated authentication implementation
  - Modified auth.ts to implement OAuth2
  - Preserved existing error handling

### Key Decisions
- Implement OAuth2 for authentication
- Maintain backward compatibility
- Update test coverage for new functionality
- Plan phased rollout of changes

### Requirements Established
- OAuth2 implementation required
- Must maintain existing auth interfaces
- Need comprehensive test coverage
- Consider security implications

### Code Changes
- Updated auth.ts with OAuth2 implementation
- Modified authentication flow
- Preserved existing error handling
- Prepared test updates

### Project Context
- Authentication system refactoring
- Security considerations documented
- Impact on dependent systems analyzed
- Migration strategy outlined

### External References
- OAuth2 specification: https://oauth.net/2/
- Security best practices: https://owasp.org/oauth
- Implementation guides referenced
- Similar implementations reviewed`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'long',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assertEquals(data.summaryLength, 'long', 'Summary length should be long');

				// Verify all required sections for long summary
				const requiredSections = [
					'## Removed Conversation Context',
					'### Files Referenced',
					'### Tools Used',
					'### Key Decisions',
					'### Requirements Established',
					'### Code Changes',
					'### Project Context',
					'### External References',
				];

				requiredSections.forEach((section) => {
					assert(
						data.summary.includes(section),
						`Long summary should include ${section} section`,
					);
				});

				// Verify detailed content requirements
				assert(
					data.summary.includes('auth.ts:') && data.summary.includes('auth.test.ts:'),
					'Files section should include detailed file descriptions',
				);
				assert(
					data.summary.includes('search_project:') && data.summary.includes('search_and_replace:'),
					'Tools section should include detailed tool usage',
				);
				assert(
					data.summary.includes('https://') || data.summary.includes('http://'),
					'External References should include URLs',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle invalid summary formats',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			// Test 1: Invalid format (not markdown)
			const chatInteractionStubMaker1 = makeChatInteractionStub(chatInteraction);
			const chatStub1 = chatInteractionStubMaker1.chatStub('Summary without markdown headers');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Generated short summary is missing required sections',
				);
			} finally {
				chatStub1.restore();
			}

			// Test 2: Missing required sections
			const chatInteractionStubMaker2 = makeChatInteractionStub(chatInteraction);
			const chatStub2 = chatInteractionStubMaker2.chatStub(`## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files

### Tools Used
- No tools`);

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Generated short summary is missing required sections: ### Key Decisions',
				);
			} finally {
				chatStub2.restore();
				createChatInteractionStub.restore();
			}

			// 			// Test 3: Invalid content structure
			// 			const chatInteractionStubMaker3 = makeChatInteractionStub(chatInteraction);
			// 			const chatStub3 = chatInteractionStubMaker3.chatStub(`## Removed Conversation Context
			// *From 2024-01-01 to 2024-01-02*
			//
			// ### Files Referenced
			// - No files
			//
			// ### Tools Used
			// - No tools
			//
			// ### Key Decisions
			//
			// ### Files Referenced
			// - Duplicate section`);
			//
			// 			try {
			// 				const toolUse: LLMAnswerToolUse = {
			// 					toolValidation: { validated: true, results: '' },
			// 					toolUseId: 'test-id',
			// 					toolName: 'conversation_summary',
			// 					toolInput: {
			// 						summaryLength: 'short',
			// 					},
			// 				};
			//
			// 				await assertRejects(
			// 					async () => await tool.runTool(interaction, toolUse, projectEditor),
			// 					Error,
			// 					'Generated short summary has duplicate sections',
			// 				);
			// 			} finally {
			// 				chatStub3.restore();
			// 				createChatInteractionStub.restore();
			// 			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle tool use as last message',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with tool use as last message
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 1' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 1 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 2' }], // Last message is tool use
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- Tool 1 was used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 2000, // High enough to keep all messages
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				//console.log('Handle tool use as last message - bbResponse:', result.bbResponse);
				//console.log('Handle tool use as last message - toolResponse:', result.toolResponse);
				//console.log('Handle tool use as last message - toolResults:', result.toolResults);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				// Get final messages
				const messages = interaction.getMessages();
				//console.log('\nMessages after tool run:', messages.map((m) => ({ role: m.role, content: m.content })));
				//console.dir(messages, { depth: null });

				// Verify message sequence after truncation
				console.log(
					'Final message sequence:',
					messages.map((m) => ({
						role: m.role,
						content: m.content.map((c) => ({
							type: c.type,
							text: 'text' in c ? c.text.substring(0, 20) + '...' : undefined,
						})),
					})),
				);

				// Should have:
				// 1. Initial user message asking to incorporate context
				// 2. Assistant message with summary
				// 3. User message to continue
				// 4. Assistant tool use message
				assert(messages.length === 4, `Expected 4 messages after truncation, got ${messages.length}`);

				// Verify first three messages are the setup sequence
				assert(
					messages[0].role === 'user' && messages[0].content[0].type === 'text',
					'First message should be user text',
				);
				assert(
					messages[1].role === 'assistant' && messages[1].content[0].type === 'tool_use',
					'Second message should be assistant summary',
				);
				assert(
					messages[2].role === 'user' && messages[2].content[0].type === 'tool_result',
					'Third message should be user text',
				);

				// Verify last message is the tool use
				const lastMessage = messages[3];
				assert(lastMessage.role === 'assistant', 'Last message should be from assistant');
				assert(
					lastMessage.content.some((part) => part.type === 'tool_use'),
					'Last message should be tool use',
				);

				// Verify message alternation
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}

				// Verify token counts
				assert(
					data.originalTokenCount === 1000,
					`Expected original token count 1000, got ${data.originalTokenCount}`,
				);
				assert(data.newTokenCount <= data.originalTokenCount, 'New token count should not exceed original');
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle minimum token limit',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with exactly 1000 tokens total
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 1' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 400 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 1 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Final message' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 600 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- Tool 1 was used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1000, // Minimum allowed token limit
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				// Verify we kept at least one complete message pair
				const messages = interaction.getMessages();
				assert(messages.length >= 4, 'Should keep at least one complete message pair plus summary');

				// Verify tool sequences are complete
				let expectingResult = false;
				for (const message of messages) {
					if (message.content.some((part) => part.type === 'tool_use')) {
						if (expectingResult) {
							assert(false, 'Found tool use while expecting result');
						}
						expectingResult = true;
					} else if (message.content.some((part) => part.type === 'tool_result')) {
						if (!expectingResult) {
							assert(false, 'Found tool result without preceding tool use');
						}
						expectingResult = false;
					}
				}

				// Verify message alternation
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle complex tool sequences and token limits',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with complex tool sequence
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 1' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 1 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Normal message' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Another message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 2' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 2 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 3' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- Tool 1 was used
- Tool 2 was used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				// Test with token limit that forces split in middle of tool sequence
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1250, // Should force split after first tool sequence
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;

				// Verify messages are properly truncated
				const messages = interaction.getMessages();

				// Verify tool sequences are complete
				let expectingResult = false;
				for (const message of messages) {
					if (message.content.some((part) => part.type === 'tool_use')) {
						if (expectingResult) {
							assert(false, 'Found tool use while expecting result');
						}
						expectingResult = true;
					} else if (message.content.some((part) => part.type === 'tool_result')) {
						if (!expectingResult) {
							assert(false, 'Found tool result without preceding tool use');
						}
						expectingResult = false;
					}
				}

				// Verify message alternation
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Truncate conversation with tool uses',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with tool uses
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 1' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 1 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 2' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 2 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 3' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 3 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool 4' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'tool_result', text: 'Tool 4 result' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Final response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- Tool 1 was used
- Tool 2 was used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1500,
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);
				// console.log('Truncate conversation with tool uses - bbResponse:', result.bbResponse);
				// console.log('Truncate conversation with tool uses - toolResponse:', result.toolResponse);
				// console.log('Truncate conversation with tool uses - toolResults:', result.toolResults);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assertEquals(data.originalTokenCount, 3000, 'Original token count should be 3000');
				assert(data.newTokenCount < data.originalTokenCount, 'New token count should be less than original');

				// Verify messages are properly truncated
				const messages = interaction.getMessages();
				assert(messages.length < testMessages.length, 'Messages should be truncated');

				// Verify message alternation is maintained
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}

				// Verify tool sequences are complete in kept messages
				let expectingResult = false;
				for (const message of messages) {
					if (message.content.some((part) => part.type === 'tool_use')) {
						if (expectingResult) {
							assert(false, 'Found tool use while expecting result');
						}
						expectingResult = true;
					} else if (message.content.some((part) => part.type === 'tool_result')) {
						if (!expectingResult) {
							assert(false, 'Found tool result without preceding tool use');
						}
						expectingResult = false;
					}
				}
				// It's ok to be expecting a result at the end
				if (expectingResult) {
					assert(
						messages[messages.length - 1].role === 'assistant',
						'Last message should be assistant if expecting result',
					);
				}
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Handle failed chat interaction',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			// Create test messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatErrorStub = chatInteractionStubMaker.chatErrorStub('Failed to generate summary');

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					summaryLength: 'short',
				},
			};

			try {
				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Failed to generate summary',
				);
			} finally {
				chatErrorStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Validate tool use/result pairing',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			// Create test messages with broken tool use/result pairing
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1500 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1500 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using tool' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 50 } },
				},
				// Missing tool result
				{
					role: 'user',
					content: [{ type: 'text', text: 'Not a valid turn' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'tool_use', text: 'Using another tool' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 200 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'What is next' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns a properly formatted summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced in this conversation

### Tools Used
- No tools were used in this conversation

### Key Decisions
- Established initial greeting and rapport

### Requirements Established
- None specified

### Code Changes
- No code changes were made

### Project Context
- This was an introductory conversation`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
						maxTokensToKeep: 1500,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Failed to maintain correct message alternation pattern', // || 'Found incomplete tool use/result pairs',
					'Expected error about incomplete tool sequences or broken message alternation',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Error on missing required sections in summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			// Create test messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns an incomplete summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Generated short summary is missing required sections: ### Key Decisions',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Error on broken message alternation',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with broken alternation
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First user message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First assistant response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { inputTokens: 5, outputTokens: 15, totalTokens: 500 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Second user message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'user', // Broken alternation here
					content: [{ type: 'text', text: 'Third user message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Final assistant response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 2000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns an incomplete summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced in this conversation

### Tools Used
- No tools were used in this conversation

### Key Decisions
- Established initial greeting and rapport

### Requirements Established
- None specified

### Code Changes
- No code changes were made

### Project Context
- This was an introductory conversation`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
						maxTokensToKeep: 1500,
					},
				};

				await assertRejects(
					async () => await tool.runTool(interaction, toolUse, projectEditor),
					Error,
					'Failed to maintain correct message alternation pattern',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Generate short summary',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			// Create chat stub that returns a properly formatted summary
			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial greeting established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assertEquals(data.summaryLength, 'short', 'Summary length should be short');

				// Verify required sections for short summary
				assert(data.summary.includes('## Removed Conversation Context'), 'Summary should have correct header');
				assert(data.summary.includes('### Files Referenced'), 'Summary should have Files Referenced section');
				assert(data.summary.includes('### Tools Used'), 'Summary should have Tools Used section');
				assert(data.summary.includes('### Key Decisions'), 'Summary should have Key Decisions section');

				// Verify optional sections are NOT present
				assert(
					!data.summary.includes('### Requirements Established'),
					'Short summary should not have Requirements section',
				);
				assert(
					!data.summary.includes('### Code Changes'),
					'Short summary should not have Code Changes section',
				);
				assert(
					!data.summary.includes('### Project Context'),
					'Short summary should not have Project Context section',
				);
				assert(
					!data.summary.includes('### External References'),
					'Short summary should not have External References section',
				);
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Truncate conversation with token limit',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages with high token counts
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'First message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'First response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Second message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Second response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
				{
					role: 'user',
					content: [{ type: 'text', text: 'Third message' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Third response' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 1000 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const orchestratorControllerStubMaker = makeOrchestratorControllerStub(
				projectEditor.orchestratorController,
			);

			const interaction = await createTestInteraction(conversationId, projectEditor);
			const chatInteraction = await createTestChatInteraction(
				conversationId,
				projectEditor,
				'Generate conversation summary',
			);

			const createChatInteractionStub = orchestratorControllerStubMaker.createChatInteractionStub(() =>
				Promise.resolve(chatInteraction)
			);

			const summaryText = `## Removed Conversation Context
*From 2024-01-01 to 2024-01-02*

### Files Referenced
- No files were referenced

### Tools Used
- No tools were used

### Key Decisions
- Initial conversation established`;

			const chatInteractionStubMaker = makeChatInteractionStub(
				chatInteraction,
			);
			const chatStub = chatInteractionStubMaker.chatStub(summaryText);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			// Create chat stub that returns a properly formatted summary

			try {
				const toolUse: LLMAnswerToolUse = {
					toolValidation: { validated: true, results: '' },
					toolUseId: 'test-id',
					toolName: 'conversation_summary',
					toolInput: {
						maxTokensToKeep: 1500,
						summaryLength: 'short',
					},
				};

				const result = await tool.runTool(interaction, toolUse, projectEditor);

				// Verify the response structure
				assert(result.bbResponse && typeof result.bbResponse === 'object', 'bbResponse should be an object');
				assert('data' in result.bbResponse, 'bbResponse should have data property');

				const data = result.bbResponse.data as LLMToolConversationBbResponseData;
				assertEquals(data.originalTokenCount, 3000, 'Original token count should be 2000');
				assert(data.newTokenCount < data.originalTokenCount, 'New token count should be less than original');

				// Verify messages are properly truncated
				const messages = interaction.getMessages();
				assert(messages.length < testMessages.length, 'Messages should be truncated');

				// Verify message alternation is maintained
				for (let i = 1; i < messages.length; i++) {
					assert(
						messages[i].role !== messages[i - 1].role,
						`Messages ${i - 1} and ${i} should alternate roles`,
					);
				}
			} finally {
				chatStub.restore();
				createChatInteractionStub.restore();
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Error on invalid token limit',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			// Set up test conversation directory
			const conversationId = 'test-conversation';
			const conversationsDir = await setupConversationDir(testProjectRoot, conversationId);

			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			} as ConversationMetrics;

			// Create test messages
			const testMessages = [
				{
					role: 'user',
					content: [{ type: 'text', text: 'Hello' }],
					conversationStats: incrementConversationStats(conversationStats),
				},
				{
					role: 'assistant',
					content: [{ type: 'text', text: 'Hi there!' }],
					conversationStats: incrementConversationStats(conversationStats),
					providerResponse: { usage: { totalTokens: 15 } },
				},
			] as LLMMessage[];
			await createTestMessages(conversationsDir, testMessages);

			const projectEditor = await getProjectEditor(testProjectRoot);
			const interaction = await createTestInteraction(conversationId, projectEditor);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			// Test too low token limit
			const toolUseTooLow: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					maxTokensToKeep: 500, // Below minimum 1000
					summaryLength: 'short',
				},
			};

			await assertRejects(
				async () => await tool.runTool(interaction, toolUseTooLow, projectEditor),
				Error,
				'maxTokensToKeep must be at least 1000',
			);

			// Test too high token limit
			const toolUseTooHigh: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					maxTokensToKeep: 200000, // Above maximum 128000
					summaryLength: 'short',
				},
			};

			await assertRejects(
				async () => await tool.runTool(interaction, toolUseTooHigh, projectEditor),
				Error,
				'maxTokensToKeep cannot exceed model context window',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
