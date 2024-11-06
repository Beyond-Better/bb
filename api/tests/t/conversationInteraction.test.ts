import { assertEquals, assertExists } from '../deps.ts';
import { join } from '@std/path';

import LLMConversationInteraction from '../../src/llms/interactions/conversationInteraction.ts';
import LLMMessage, { LLMMessageContentPart, LLMMessageContentPartTextBlock } from 'api/llms/llmMessage.ts';
import { GitUtils } from 'shared/git.ts';
import { LLMCallbackType } from 'api/types.ts';
import type { ConversationMetrics } from 'shared/types.ts';
import { getProjectEditor, withTestProject } from '../lib/testSetup.ts';

// Mock LLM class
class MockLLM {
	async invoke(callbackType: LLMCallbackType, ..._args: any[]): Promise<any> {
		if (callbackType === LLMCallbackType.PROJECT_ROOT) {
			return Deno.makeTempDir();
		}
		return null;
	}
}

async function setupTestEnvironment(projectRoot: string) {
	await GitUtils.initGit(projectRoot);
	const projectEditor = await getProjectEditor(projectRoot);
	const mockLLM = new MockLLM();
	const conversation = new LLMConversationInteraction(mockLLM as any, 'test-conversation-id');

	// Create test files
	const testFiles = ['file1.txt', 'file2.txt'];
	for (const file of testFiles) {
		const filePath = join(projectRoot, file);
		await Deno.writeTextFile(filePath, `Content of ${file}`);
	}

	return { projectEditor, conversation, projectRoot, testFiles };
}

function incrementConversationStats(conversationStats: ConversationMetrics) {
	return {
		statementCount: conversationStats.statementCount++,
		statementTurnCount: conversationStats.statementTurnCount++,
		conversationTurnCount: conversationStats.conversationTurnCount++,
	};
}

Deno.test({
	name: 'LLMConversationInteraction - hydrateMessages',
	async fn() {
		await withTestProject(async (testProjectRoot) => {
			const { projectEditor: _projectEditor, conversation, projectRoot, testFiles } = await setupTestEnvironment(
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
			const firstFileContent = await Deno.readTextFile(join(projectRoot, testFiles[0]));
			const firstHydratedContent = getTextContent(hydratedMessages[3].content[0]);
			assertExists(firstHydratedContent, 'First message should have text content');
			assertExists(
				firstHydratedContent?.includes(firstFileContent),
				'First message should contain hydrated content of file1.txt',
			);

			// Check second file hydration
			const secondFileContent = await Deno.readTextFile(join(projectRoot, testFiles[1]));
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
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
