import { assertEquals, assertExists, assertThrows } from '../../deps.ts';
import OrchestratorController from '../../../src/controllers/orchestratorController.ts';
import InteractionManager from '../../../src/llms/interactions/interactionManager.ts';
import LLMConversationInteraction from '../../../src/llms/interactions/conversationInteraction.ts';
import { InteractionId } from 'shared/types.ts';

// Mock dependencies
class MockInteractionManager extends InteractionManager {
	// Add mock implementations as needed
}

class MockLLMProvider {
	// Add mock implementations as needed
}

class MockPromptManager {
	async init() {}
	async getPrompt() {
		return 'mock prompt';
	}
}

class MockLLMToolManager {
	getAllTools() {
		return [];
	}
}

/*
Deno.test('OrchestratorController - createChildInteraction', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private property for testing
	orchestrator.interactionManager = new MockInteractionManager();

	const parentInteractionId = 'parent-id' as InteractionId;
	const childId = await orchestrator.createChildInteraction(parentInteractionId, 'Test Child');

	assertExists(childId);
	const childInteraction = orchestrator.interactionManager.getInteractionStrict(childId);
	assertEquals(childInteraction.title, 'Test Child');
});

Deno.test('OrchestratorController - initializePrimaryInteraction with existing interaction', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private properties for testing
	orchestrator.interactionManager = new MockInteractionManager();
	orchestrator.llmProvider = new MockLLMProvider();
	orchestrator.promptManager = new MockPromptManager();
	orchestrator.toolManager = new MockLLMToolManager();

	const existingInteractionId = 'existing-id' as InteractionId;
	const existingInteraction = new LLMConversationInteraction(new MockLLMProvider(), existingInteractionId);
	orchestrator.interactionManager.addInteraction(existingInteraction);

	const result = await orchestrator.initializePrimaryInteraction(existingInteractionId);
	assertEquals(result.id, existingInteractionId);
	assertEquals(orchestrator.primaryInteractionId, existingInteractionId);
});

Deno.test('OrchestratorController - initializePrimaryInteraction creates new interaction', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private properties for testing
	orchestrator.interactionManager = new MockInteractionManager();
	orchestrator.llmProvider = new MockLLMProvider();
	orchestrator.promptManager = new MockPromptManager();
	orchestrator.toolManager = new MockLLMToolManager();

	const newInteractionId = 'new-id' as InteractionId;
	const result = await orchestrator.initializePrimaryInteraction(newInteractionId);
	assertExists(result);
	assertEquals(orchestrator.primaryInteractionId, newInteractionId);
});

Deno.test('OrchestratorController - manageAgentTasks with sync execution', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private properties for testing
	orchestrator.interactionManager = new MockInteractionManager();
	orchestrator.llmProvider = new MockLLMProvider();
	orchestrator.promptManager = new MockPromptManager();
	orchestrator.toolManager = new MockLLMToolManager();
	orchestrator.delegateTasksTool = {
		execute: async () => ({ result: 'mock result' }),
	};

	await orchestrator.initializePrimaryInteraction('primary-id' as InteractionId);

	const tasks = [{
		title: 'Test Task',
		instructions: 'Do something',
		resources: [],
		capabilities: [],
		requirements: '',
	}];
	await orchestrator.manageAgentTasks(tasks, true);

	// Assert that the task was executed (you might need to add more specific assertions based on your implementation)
	assertExists(orchestrator.interactionManager.getInteractionResult('primary-id' as InteractionId));
});

Deno.test('OrchestratorController - manageAgentTasks with error handling', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private properties for testing
	orchestrator.interactionManager = new MockInteractionManager();
	orchestrator.llmProvider = new MockLLMProvider();
	orchestrator.promptManager = new MockPromptManager();
	orchestrator.toolManager = new MockLLMToolManager();
	orchestrator.delegateTasksTool = {
		execute: async () => {
			throw new Error('Task execution failed');
		},
    };

	await orchestrator.initializePrimaryInteraction('primary-id' as InteractionId);

	const tasks = [{
		title: 'Test Task',
		instructions: 'Do something',
		resources: [],
		capabilities: [],
		requirements: '',
	}];
	await assertThrows(
		() => orchestrator.manageAgentTasks(tasks, true, { strategy: 'fail_fast' }),
		Error,
		'Failed to execute tasks: Test Task',
	);
});

Deno.test('OrchestratorController - createAgentController', () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private properties for testing
	orchestrator.interactionManager = new MockInteractionManager();
	orchestrator.llmProvider = new MockLLMProvider();

	const agentController = orchestrator.createAgentController();
	assertExists(agentController);
	assertEquals(orchestrator.agentControllers.size, 1);
});

Deno.test('OrchestratorController - getInteractionResult', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private property for testing
	orchestrator.interactionManager = new MockInteractionManager();

	const interactionId = 'test-id' as InteractionId;
	const mockResult = { data: 'test result' };
	orchestrator.interactionManager.setInteractionResult(interactionId, mockResult);

	const result = await orchestrator.getInteractionResult(interactionId);
	assertEquals(result, mockResult);
});


Deno.test('OrchestratorController - cleanupChildInteractions', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private property for testing
	orchestrator.interactionManager = new MockInteractionManager();

	const parentInteractionId = 'parent-id' as InteractionId;
	const childId1 = await orchestrator.createChildInteraction(parentInteractionId, 'Child 1');
	const childId2 = await orchestrator.createChildInteraction(parentInteractionId, 'Child 2');
	const grandchildId = await orchestrator.createChildInteraction(childId1, 'Grandchild');

	await orchestrator.cleanupChildInteractions(parentInteractionId);

	assertThrows(() => orchestrator.interactionManager.getInteractionStrict(childId1));
	assertThrows(() => orchestrator.interactionManager.getInteractionStrict(childId2));
	assertThrows(() => orchestrator.interactionManager.getInteractionStrict(grandchildId));
});


Deno.test('OrchestratorController - manageAgentTasks with uninitialized primary interaction', async () => {
	const orchestrator = new OrchestratorController('/mock/project/root', '/mock/start/dir');
	// @ts-ignore: Overwrite private property for testing
	orchestrator.interactionManager = new MockInteractionManager();

	await assertThrows(
		() =>
			orchestrator.manageAgentTasks([{
				title: 'Test Task',
				instructions: 'Do something',
				resources: [],
				capabilities: [],
				requirements: '',
			}]),
		Error,
		'Primary interaction not initialized or not found',
	);
  });
 */
