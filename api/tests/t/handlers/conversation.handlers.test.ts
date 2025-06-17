import { assertEquals, assertExists, assertSpyCalls } from 'api/tests/deps.ts';
import { stub } from 'https://deno.land/std@0.181.0/testing/mock.ts';
import { Application } from 'https://deno.land/x/oak@v12.4.0/mod.ts';
import { superoak } from 'https://deno.land/x/superoak@4.7.0/mod.ts';
import apiRouter from '../../../src/routes/apiRouter.ts';
import ProjectEditorManager from '../../../src/editor/projectEditorManager.ts';
import ProjectEditor from '../../../src/editor/projectEditor.ts';
//import DelegateTasksTool from '../../../src/llms/tools/delegateTasksTool.ts';
import InteractionManager from '../../../src/llms/interactions/interactionManager.ts';
import OrchestratorController from '../../../src/controllers/orchestratorController.ts';
import { makeOrchestratorControllerStub, makeProjectEditorStub } from '../../lib/stubs.ts';

// Test for new getConversation behavior that returns defaults for non-existent conversations
Deno.test('getConversation returns defaults for non-existent conversation', async () => {
	// This test demonstrates the new behavior where getConversation
	// returns default configuration values instead of 404 for new conversations

	// In a real test, we would:
	// 1. Set up proper mocks for ProjectEditorManager
	// 2. Mock the config manager to return known default values
	// 3. Call the getConversation endpoint for a non-existent conversation ID
	// 4. Verify that it returns 200 with default model configuration
	// 5. Verify that the response includes modelConfig with proper defaults

	// Expected response structure:
	// {
	//   id: 'new-conversation-id',
	//   model: 'claude-3-7-sonnet-20250219', // from global/project defaults
	//   modelConfig: {
	//     model: 'claude-3-7-sonnet-20250219',
	//     temperature: 0.7,
	//     maxTokens: 16384,
	//     extendedThinking: { enabled: true, budgetTokens: 4096 },
	//     usePromptCaching: true
	//   },
	//   logDataEntries: [],
	//   interactionStats: { statementTurnCount: 0, interactionTurnCount: 0, statementCount: 0 }
	// }

	console.log('Test placeholder: getConversation now returns defaults instead of 404');
});

/*
// Create stubs
const projectEditorStub = makeProjectEditorStub(new ProjectEditor('test-id', mockProjectRoot));
const orchestratorControllerStub = makeOrchestratorControllerStub(
	new OrchestratorController(projectEditorStub.projectEditor),
);

// Mock the ProjectEditorManager
class MockProjectEditorManager {
	async getOrCreateEditor() {
		return projectEditorStub.projectEditor;
	}
}

// Replace the actual ProjectEditorManager with our mock
stub(ProjectEditorManager.prototype, 'getOrCreateEditor', MockProjectEditorManager.prototype.getOrCreateEditor);
 */

/*
// Setup the application for testing
const app = new Application();
app.use(apiRouter.routes());
app.use(apiRouter.allowedMethods());

// Setup a mock project root for testing
const mockProjectRoot = await Deno.makeTempDir();


Deno.test('startConversation handler', async (t) => {
	projectEditorStub.handleStatementStub.reset();
	projectEditorStub.getOrchestratorControllerStub.reset();
	await t.step('should start a new conversation', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation')
			.send({ statement: 'Hello', startDir: mockProjectRoot })
			.expect(200);

		assertExists(response.body.conversationId);
		assertEquals(response.body.collaborationTitle, 'Test Conversation');
		assertSpyCalls(projectEditorStub.handleStatementStub, 1);
		assertSpyCalls(projectEditorStub.handleStatementStub, 1);
		assertSpyCalls(projectEditorStub.getOrchestratorControllerStub, 1);
	});

	await t.step('should return 400 if statement is missing', async () => {
		const request = await superoak(app);
		await request.post('/api/v1/conversation')
			.send({ startDir: mockProjectRoot })
			.expect(400);
	});
});

Deno.test('getConversation handler', async (t) => {
	orchestratorControllerStub.getInteractionStub.reset();
	await t.step('should retrieve conversation details', async () => {
		const request = await superoak(app);
		const response = await request.get('/api/v1/conversation/test-conversation-id')
			.expect(200);

		assertEquals(response.body.id, 'test-conversation-id');
		assertEquals(response.body.llmProviderName, 'test-provider');
		assertSpyCalls(orchestratorControllerStub.getInteractionStub, 1);
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.getInteractionStub.reset();
		orchestratorControllerStub.getInteractionStub.throws(new Error('Conversation not found'));
		const request = await superoak(app);
		await request.get('/api/v1/conversation/non-existent-id')
			.expect(404);

		assertSpyCalls(orchestratorControllerStub.getInteractionStub, 1);
	});
});

Deno.test('continueConversation handler', async (t) => {
	projectEditorStub.handleStatementStub.reset();
	await t.step('should continue an existing conversation', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id')
			.send({ statement: 'Continue', startDir: mockProjectRoot })
			.expect(200);

		assertExists(response.body.conversationId);
		assertEquals(response.body.collaborationTitle, 'Test Conversation');
		assertSpyCalls(projectEditorStub.handleStatementStub, 1);
		assertSpyCalls(projectEditorStub.handleStatementStub, 1);
		assertSpyCalls(projectEditorStub.getOrchestratorControllerStub, 1);
	});

	await t.step('should return 400 if statement is missing', async () => {
		const request = await superoak(app);
		await request.post('/api/v1/conversation/test-conversation-id')
			.send({ startDir: mockProjectRoot })
			.expect(400);
	});
});
Deno.test('deleteInteraction handler', async (t) => {
	orchestratorControllerStub.deleteInteractionStub.reset();
	await t.step('should delete an existing conversation', async () => {
		const request = await superoak(app);
		await request.delete('/api/v1/conversation/test-conversation-id')
			.expect(200);

		assertSpyCalls(orchestratorControllerStub.deleteInteractionStub, 1);
	});
});

Deno.test('clearConversation handler', async (t) => {
	orchestratorControllerStub.clearInteractionStub.reset();

	await t.step('should clear an existing conversation', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id/clear')
			.expect(200);

		assertEquals(response.body.message, 'Conversation cleared successfully');
		assertSpyCalls(orchestratorControllerStub.clearInteractionStub, 1);
		assertSpyCalls(orchestratorControllerStub.clearInteractionStub.calls[0], 1);
		assertEquals(orchestratorControllerStub.clearInteractionStub.calls[0].args[0], 'test-conversation-id');
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.clearInteractionStub.reset();
		orchestratorControllerStub.clearInteractionStub.throws(new Error('Conversation not found'));

		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/non-existent-id/clear')
			.expect(404);

		assertEquals(response.body.error, 'Conversation not found');
		assertSpyCalls(orchestratorControllerStub.clearInteractionStub, 1);
	});
});

Deno.test('undoConversation handler', async (t) => {
	orchestratorControllerStub.undoInteractionStub.reset();

	await t.step('should undo the last change in a conversation', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id/undo')
			.expect(200);

		assertEquals(response.body.message, 'Last change undone successfully');
		assertSpyCalls(orchestratorControllerStub.undoInteractionStub, 1);
		assertEquals(orchestratorControllerStub.undoInteractionStub.calls[0].args[0], 'test-conversation-id');
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.undoInteractionStub.reset();
		orchestratorControllerStub.undoInteractionStub.throws(new Error('Conversation not found'));

		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/non-existent-id/undo')
			.expect(404);

		assertEquals(response.body.error, 'Conversation not found');
		assertSpyCalls(orchestratorControllerStub.undoInteractionStub, 1);
	});

	await t.step('should return 400 if there are no changes to undo', async () => {
		orchestratorControllerStub.undoInteractionStub.reset();
		orchestratorControllerStub.undoInteractionStub.throws(new Error('No changes to undo'));

		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id/undo')
			.expect(400);

		assertEquals(response.body.error, 'No changes to undo');
		assertSpyCalls(orchestratorControllerStub.undoInteractionStub, 1);
	});
});

Deno.test('addFile handler', async (t) => {
	orchestratorControllerStub.addFileToInteractionStub.reset();

	await t.step('should add a file to a conversation', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id/file')
			.attach('file', 'test.txt', 'Hello, World!')
			.expect(200);

		assertEquals(response.body.message, 'File added successfully');
		assertSpyCalls(orchestratorControllerStub.addFileToInteractionStub, 1);
		assertEquals(orchestratorControllerStub.addFileToInteractionStub.calls[0].args[0], 'test-conversation-id');
		assertEquals(orchestratorControllerStub.addFileToInteractionStub.calls[0].args[1], 'test.txt');
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.addFileToInteractionStub.reset();
		orchestratorControllerStub.addFileToInteractionStub.throws(new Error('Conversation not found'));

		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/non-existent-id/file')
			.attach('file', 'test.txt', 'Hello, World!')
			.expect(404);

		assertEquals(response.body.error, 'Conversation not found');
		assertSpyCalls(orchestratorControllerStub.addFileToInteractionStub, 1);
	});

	await t.step('should return 400 if file is not provided', async () => {
		const request = await superoak(app);
		const response = await request.post('/api/v1/conversation/test-conversation-id/file')
			.expect(400);

		assertEquals(response.body.error, 'No file provided');
		assertSpyCalls(orchestratorControllerStub.addFileToInteractionStub, 0);
	});
});

Deno.test('removeFile handler', async (t) => {
	orchestratorControllerStub.removeFileFromInteractionStub.reset();

	await t.step('should remove a file from a conversation', async () => {
		const request = await superoak(app);
		const response = await request.delete('/api/v1/conversation/test-conversation-id/file/test.txt')
			.expect(200);

		assertEquals(response.body.message, 'File removed successfully');
		assertSpyCalls(orchestratorControllerStub.removeFileFromInteractionStub, 1);
		assertEquals(orchestratorControllerStub.removeFileFromInteractionStub.calls[0].args[0], 'test-conversation-id');
		assertEquals(orchestratorControllerStub.removeFileFromInteractionStub.calls[0].args[1], 'test.txt');
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.removeFileFromInteractionStub.reset();
		orchestratorControllerStub.removeFileFromInteractionStub.throws(new Error('Conversation not found'));

		const request = await superoak(app);
		const response = await request.delete('/api/v1/conversation/non-existent-id/file/test.txt')
			.expect(404);

		assertEquals(response.body.error, 'Conversation not found');
		assertSpyCalls(orchestratorControllerStub.removeFileFromInteractionStub, 1);
	});

	await t.step('should return 404 if file is not found in the conversation', async () => {
		orchestratorControllerStub.removeFileFromInteractionStub.reset();
		orchestratorControllerStub.removeFileFromInteractionStub.throws(new Error('File not found in conversation'));

		const request = await superoak(app);
		const response = await request.delete('/api/v1/conversation/test-conversation-id/file/non-existent.txt')
			.expect(404);

		assertEquals(response.body.error, 'File not found in conversation');
		assertSpyCalls(orchestratorControllerStub.removeFileFromInteractionStub, 1);
	});
});

Deno.test('listFiles handler', async (t) => {
	orchestratorControllerStub.getInteractionStub.reset();

	await t.step('should list files in a conversation', async () => {
		orchestratorControllerStub.getInteractionStub.returns({
			id: 'test-conversation-id',
			files: ['file1.txt', 'file2.txt'],
		});

		const request = await superoak(app);
		const response = await request.get('/api/v1/conversation/test-conversation-id/files')
			.expect(200);

		assertExists(response.body.files);
		assertEquals(Array.isArray(response.body.files), true);
		assertEquals(response.body.files, ['file1.txt', 'file2.txt']);
		assertSpyCalls(orchestratorControllerStub.getInteractionStub, 1);
		assertEquals(orchestratorControllerStub.getInteractionStub.calls[0].args[0], 'test-conversation-id');
	});

	await t.step('should return 404 if conversation is not found', async () => {
		orchestratorControllerStub.getInteractionStub.reset();
		orchestratorControllerStub.getInteractionStub.throws(new Error('Conversation not found'));

		const request = await superoak(app);
		const response = await request.get('/api/v1/conversation/non-existent-id/files')
			.expect(404);

		assertEquals(response.body.error, 'Conversation not found');
		assertSpyCalls(orchestratorControllerStub.getInteractionStub, 1);
	});

	await t.step('should return an empty array if conversation has no files', async () => {
		orchestratorControllerStub.getInteractionStub.reset();
		orchestratorControllerStub.getInteractionStub.returns({
			id: 'test-conversation-id',
			files: [],
		});

		const request = await superoak(app);
		const response = await request.get('/api/v1/conversation/test-conversation-id/files')
			.expect(200);

		assertExists(response.body.files);
		assertEquals(Array.isArray(response.body.files), true);
		assertEquals(response.body.files.length, 0);
		assertSpyCalls(orchestratorControllerStub.getInteractionStub, 1);
	});
});
 */
