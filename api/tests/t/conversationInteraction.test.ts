import { assertEquals, assertExists } from 'api/tests/deps.ts';
import { join } from '@std/path';

import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import LLMMessage, { type LLMMessageContentPart, type LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';
import type {
	//LLMCallbackType,
	LLMCallbacks,
} from 'api/types.ts';
import { getProjectEditor, incrementConversationStats, withTestProject } from 'api/tests/testSetup.ts';
import { makeConversationInteractionStub } from '../lib/stubs.ts';
import type { LLMModelConfig } from 'api/types/llms.ts';

import type {
	ConversationId,
	ConversationLogEntry,
	ConversationStats,
	//ObjectivesData,
	TokenUsageStats,
} from 'shared/types.ts';

import type LLMTool from 'api/llms/llmTool.ts';

// Mock LLM class
//class MockLLM {
//	async invoke(callbackType: LLMCallbackType, ..._args: any[]): Promise<any> {
//		if (callbackType === LLMCallbackType.PROJECT_DATA_SOURCES) {
//			return Deno.makeTempDir();
//		}
//		return null;
//	}
//}

const mockInteractionCallbacks: LLMCallbacks = {
	PROJECT_EDITOR: () => undefined,
	PROJECT_ID: () => undefined,
	PROJECT_DATA_SOURCES: () => [Deno.makeTempDir()],
	PROJECT_MCP_TOOLS: () => [],
	PROJECT_INFO: () => {},
	PROJECT_CONFIG: () => {},
	PROJECT_RESOURCE_CONTENT: async (_dsConnectionId: string, _filePath: string): Promise<string | null> => {
		return null;
	},
	// deno-lint-ignore require-await
	LOG_ENTRY_HANDLER: async (
		_messageId: string,
		_parentMessageId: string | null,
		_parentInteractionId: ConversationId,
		_agentInteractionId: ConversationId | null,
		_timestamp: string,
		_logEntry: ConversationLogEntry,
		_conversationStats: ConversationStats,
		_tokenUsageStats: TokenUsageStats,
		_modelConfig?: LLMModelConfig,
	): Promise<void> => {
	},
	PREPARE_SYSTEM_PROMPT: async (_system: string, _interactionId: string): Promise<string> => {
		return '';
	},
	PREPARE_MESSAGES: async (_messages: LLMMessage[], _interactionId: string): Promise<LLMMessage[]> => {
		return [];
	},
	PREPARE_TOOLS: async (_tools: Map<string, LLMTool>, _interactionId: string): Promise<LLMTool[]> => {
		return [];
	},
	// [TODO] PREPARE_DATA_SOURCES
	// [TODO] PREPARE_RESOURCES
};

async function setupTestEnvironment(projectId: string, dataSourceRoot: string) {
	await GitUtils.initGit(dataSourceRoot);
	const projectEditor = await getProjectEditor(projectId);

	// Create conversation and stub the LLMFactory to prevent real provider creation
	const conversation = new LLMConversationInteraction('test-conversation-id');
	const { factoryStub } = makeConversationInteractionStub(conversation, projectEditor);

	// Now init the conversation - it will use the stubbed factory
	await conversation.init('claude-3-5-haiku-20241022', mockInteractionCallbacks);

	// Create test files
	const testFiles = ['file1.txt', 'file2.txt'];
	for (const file of testFiles) {
		const filePath = join(dataSourceRoot, file);
		await Deno.writeTextFile(filePath, `Content of ${file}`);
	}

	return { projectEditor, conversation, dataSourceRoot, testFiles, factoryStub };
}

Deno.test({
	name: 'LLMConversationInteraction - hydrateMessages',
	async fn() {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const { projectEditor: _projectEditor, conversation, dataSourceRoot, testFiles, factoryStub } =
				await setupTestEnvironment(
					testProjectId,
					testProjectRoot,
				);

			// Create test messages
			const conversationStats = {
				statementCount: 0,
				statementTurnCount: 0,
				conversationTurnCount: 0,
			};
			const messages: LLMMessage[] = [
				new LLMMessage(
					'user',
					[{ type: 'text', text: `File added: ${testFiles[0]}` }],
					incrementConversationStats(conversationStats),
					undefined,
					undefined,
					'msg1',
				),
				new LLMMessage(
					'assistant',
					[{ type: 'text', text: 'Acknowledged.' }],
					incrementConversationStats(conversationStats),
					undefined,
					undefined,
					'msg2',
				),
				new LLMMessage(
					'user',
					[{ type: 'text', text: `File added: ${testFiles[1]}` }],
					incrementConversationStats(conversationStats),
					undefined,
					undefined,
					'msg3',
				),
				new LLMMessage(
					'user',
					[{ type: 'text', text: `File added: ${testFiles[0]}` }],
					incrementConversationStats(conversationStats),
					undefined,
					undefined,
					'msg4',
				),
			];

			// Call hydrateMessages
			const hydratedMessages = await conversation.hydrateMessages(messages);

			// Assertions
			assertEquals(hydratedMessages.length, 4, 'Should have 4 messages');

			// Helper function to safely get text content
			function getTextContent(contentPart: LLMMessageContentPart): string | null {
				if (contentPart.type === 'text') {
					return (contentPart as LLMMessageContentPartTextBlock).text;
				}
				return null;
			}

			// Check first file hydration
			const firstFileContent = await Deno.readTextFile(join(dataSourceRoot, testFiles[0]));
			const firstHydratedContent = getTextContent(hydratedMessages[3].content[0]);
			assertExists(firstHydratedContent, 'First message should have text content');
			assertExists(
				firstHydratedContent?.includes(firstFileContent),
				'First message should contain hydrated content of file1.txt',
			);

			// Check second file hydration
			const secondFileContent = await Deno.readTextFile(join(dataSourceRoot, testFiles[1]));
			const secondHydratedContent = getTextContent(hydratedMessages[1].content[0]);
			assertExists(secondHydratedContent, 'Third message should have text content');
			assertExists(
				secondHydratedContent?.includes(secondFileContent),
				'Third message should contain hydrated content of file2.txt',
			);

			// Check that the second mention of file1.txt is not hydrated
			const lastHydratedContent = getTextContent(hydratedMessages[0].content[0]);
			assertExists(lastHydratedContent, 'Fourth message should have text content');
			assertExists(
				lastHydratedContent?.includes('Note: File file1.txt content is up-to-date as of turn'),
				'Fourth message should contain a note about file1.txt being up-to-date',
			);

			// Clean up stubs
			factoryStub.restore();
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
