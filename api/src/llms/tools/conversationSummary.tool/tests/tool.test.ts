import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { stripAnsiCode } from '@std/fmt/colors';

import LLMToolConversationSummary from '../tool.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import LLMMessage from 'api/llms/llmMessage.ts';
import type { ConversationMetrics } from 'shared/types.ts';

// Mock functions
const mockSaveConversation = async () => {};
const mockGetConversationPath = async () => '/mock/conversation/path';
const mockCopy = async (src: string, dest: string) => {
	copiedFiles.push({ src, dest });
};
const mockEnsureDir = async () => {};

// Mock the imported functions
// import * as conversationPersistence from 'api/storage/conversationPersistence.ts';
// conversationPersistence.saveConversation = mockSaveConversation;
// conversationPersistence.getConversationPath = mockGetConversationPath;
//
// import * as fs from '@std/fs';
// import * as path from '@std/path';
// fs.copy = mockCopy;
// fs.ensureDir = mockEnsureDir;

let copiedFiles: { src: string; dest: string }[] = [];

function incrementConversationStats(conversationStats: ConversationMetrics) {
	return {
		statementCount: conversationStats.statementCount++,
		statementTurnCount: conversationStats.statementTurnCount++,
		conversationTurnCount: conversationStats.conversationTurnCount++,
	};
}

/*
Deno.test({
	name: 'ConversationSummaryTool - Backup functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					maxTokens: 50,
					summaryLength: 'short',
				},
			};

			// Mock conversation messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			}
			const mockMessages = [
				new LLMMessage('user', 'Hello', incrementConversationStats(conversationStats), { usage: { totalTokens: 10 } }),
				new LLMMessage('assistant', 'Hi there!', incrementConversationStats(conversationStats), { usage: { totalTokens: 15 } }),
				new LLMMessage('user', 'How are you?', incrementConversationStats(conversationStats), { usage: { totalTokens: 20 } }),
				new LLMMessage('assistant', "I'm doing well, thank you!", incrementConversationStats(conversationStats), { usage: { totalTokens: 25 } }),
				new LLMMessage('tool', 'Some tool usage', incrementConversationStats(conversationStats), { usage: { totalTokens: 30 } }),
			];

			const mockConversation = {
				getMessages: () => mockMessages,
				getLLMProvider: () => ({ getCompletion: async () => ({ answer: 'Mock summary' }) }),
				getConversationId: () => 'mock-conversation-id',
				getProjectEditor: () => ({ projectRoot: testProjectRoot }),
				setMessages: () => {},
				speakWithLLM: async () => ({ messageResponse: { answer: 'Mock summary' } }),
			};

			copiedFiles = [];
			await tool.runTool(mockConversation as any, toolUse, projectEditor);

			assertEquals(copiedFiles.length, 3, 'Three files should be backed up');
			const expectedFiles = ['messages.jsonl', 'conversation.jsonl', 'metadata.json'];
			for (const file of expectedFiles) {
				assert(
					copiedFiles.some(({ src, dest }) =>
						path.basename(src) === file && dest.includes('backups') && dest.includes(file)
					),
					`Backup for ${file} should be created`,
				);
			}
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - Basic functionality',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					maxTokens: 50,
					summaryLength: 'short',
				},
			};

			// Mock conversation messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			}
			const mockMessages = [
				new LLMMessage('user', 'Hello', incrementConversationStats(conversationStats), { usage: { totalTokens: 10 } }),
				new LLMMessage('assistant', 'Hi there!', incrementConversationStats(conversationStats), { usage: { totalTokens: 15 } }),
				new LLMMessage('user', 'How are you?', incrementConversationStats(conversationStats), { usage: { totalTokens: 20 } }),
				new LLMMessage('assistant', "I'm doing well, thank you!", incrementConversationStats(conversationStats), { usage: { totalTokens: 25 } }),
				new LLMMessage('tool', 'Some tool usage', incrementConversationStats(conversationStats), { usage: { totalTokens: 30 } }),
			];

			const mockLLMProvider = {
				getCompletion: async () => ({ answer: 'This is a mock summary of the conversation.' }),
			};

			const mockConversation = {
				getMessages: () => mockMessages,
				getLLMProvider: () => mockLLMProvider,
				getConversationId: () => 'mock-conversation-id',
				getProjectEditor: () => ({ projectRoot: testProjectRoot }),
				setMessages: () => {},
				speakWithLLM: async () => ({
					messageResponse: { answer: 'This is a mock summary of the conversation.' },
				}),
			};

			const result = await tool.runTool(mockConversation as any, toolUse, projectEditor);

			assert(result.toolResults, 'Tool results should not be null');
			assert(result.toolResponse, 'Tool response should not be null');
			assert(result.bbResponse, 'BB response should not be null');

			const summary = JSON.parse(result.toolResults as string);

			assertEquals(summary.summaryLength, 'short', 'Summary length should be short');
			assertEquals(
				summary.summary,
				'This is a mock summary of the conversation.',
				'Summary should match mock response',
			);
			assertEquals(summary.originalTokenCount, 100, 'Original token count should be 100');
			assertEquals(summary.newTokenCount, 50, 'New token count should be 50');
			assertEquals(summary.truncatedConversation.length, 2, 'Truncated conversation should have 2 messages');

			assert(
				stripAnsiCode(result.toolResponse).includes('Conversation summarized and truncated successfully'),
				'Tool response should indicate successful summarization and truncation',
			);
			assert(
				stripAnsiCode(result.bbResponse).includes(
					'BB has summarized the conversation and truncated it if requested',
				),
				'BB response should indicate summarization and truncation',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ConversationSummaryTool - No truncation needed',
	fn: async () => {
		await withTestProject(async (testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectRoot);
			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('conversation_summary') as LLMToolConversationSummary;
			assert(tool, 'Failed to get ConversationSummaryTool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'conversation_summary',
				toolInput: {
					maxTokens: 200,
					summaryLength: 'medium',
				},
			};

			// Mock conversation messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			}
			const mockMessages = [
				new LLMMessage('user', 'Hello', incrementConversationStats(conversationStats), { usage: { totalTokens: 10 } }),
				new LLMMessage('assistant', 'Hi there!', incrementConversationStats(conversationStats), { usage: { totalTokens: 15 } }),
			];

			const mockLLMProvider = {
				getCompletion: async () => ({ answer: 'This is a mock summary of the conversation.' }),
			};

			const mockConversation = {
				getMessages: () => mockMessages,
				getLLMProvider: () => mockLLMProvider,
				getConversationId: () => 'mock-conversation-id',
				getProjectEditor: () => ({ projectRoot: testProjectRoot }),
				setMessages: () => {},
				speakWithLLM: async () => ({
					messageResponse: { answer: 'This is a mock summary of the conversation.' },
				}),
			};

			const result = await tool.runTool(mockConversation as any, toolUse, projectEditor);

			const summary = JSON.parse(result.toolResults as string);

			assertEquals(summary.summaryLength, 'medium', 'Summary length should be medium');
			assertEquals(summary.originalTokenCount, 25, 'Original token count should be 25');
			assertEquals(summary.newTokenCount, 25, 'New token count should be 25');
			assertEquals(
				summary.truncatedConversation.length,
				2,
				'Truncated conversation should have 2 messages (no truncation needed)',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
 */
