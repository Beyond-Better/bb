import { assertEquals, assertExists } from '../../../deps.ts';
import { InteractionManager } from 'api/llms/interactionManager.ts';
import LLMConversationInteraction from 'api/llms/conversationInteraction.ts';
import LLM from '../../../../src/llms/providers/baseLLM.ts';

/*
Deno.test('InteractionManager - Create and manage interactions', async () => {
	const manager = new InteractionManager();

	// Test 1: Create a conversation interaction
	const parentInteractionId = await manager.createInteraction('conversation', 'test-id', {} as LLM);
	assertExists(await manager.getInteraction(parentInteractionId));

	// Test 2: Create a child interaction
	const childId = await manager.createInteraction('conversation', 'test-child-id', {} as LLM, parentInteractionId);
	assertExists(await manager.getInteraction(childId));

	// Test 3: Get child interactions
	const childInteractions = await manager.getChildInteractions(parentInteractionId);
	assertEquals(childInteractions.length, 1);
	assertEquals(childInteractions[0], childId);

	// Test 4: Get parent interaction
	const parentInteraction = await manager.getParentInteraction(childId);
	assertExists(parentInteraction);
	assertEquals(parentInteraction, parentInteractionId);

	// Test 5: Remove an interaction
	const removed = await manager.removeInteraction(childId);
	assertEquals(removed, true);
	assertEquals(await manager.getInteraction(childId), undefined);

	// Test 6: Get all descendant interactions
	const grandchildId = await manager.createInteraction('conversation', 'test-grandchild-id', {} as LLM, childId);
	const descendants = await manager.getAllDescendantInteractions(parentInteractionId);
	assertEquals(descendants.length, 2);

	// Test 7: Set and get interaction results
	const result = { data: 'test result' };
	await manager.setInteractionResult(parentInteractionId, result);
	assertEquals(await manager.getInteractionResult(parentInteractionId), result);
});

Deno.test('InteractionManager - Error handling', () => {
	const manager = new InteractionManager();

	// Test setting parent-child relationship with non-existent interactions
	assertThrows(
		() => manager.setParentChild('non-existent-parent', 'non-existent-child'),
		Error,
		'Parent or child interaction does not exist',
	);

	// Test getting a non-existent interaction
	assertEquals(manager.getInteraction('non-existent-id'), undefined);

	// Test getting a non-existent interaction with strict method
	assertThrows(
		() => manager.getInteractionStrict('non-existent-id'),
		Error,
		'Interaction with id non-existent-id not found',
	);
});

Deno.test('InteractionManager - New methods', () => {
	const manager = new InteractionManager();

	// Test 8: Set parent-child relationship with non-existent interactions
	assertThrows(
		() => manager.setParentChild('non-existent-parent', 'non-existent-child'),
		Error,
		'Parent or child interaction does not exist',
	);

	// Additional error handling tests can be added here
});
 */
