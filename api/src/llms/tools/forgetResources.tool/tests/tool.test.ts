import { join } from '@std/path';

import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolForgetResourcesResponseData } from '../types.ts';
import { generateResourceRevisionKey } from 'shared/dataSource.ts';

// Type guard function
function isForgetResourcesResponse(
	response: unknown,
): response is LLMToolForgetResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcesSuccess' in data &&
		Array.isArray(data.resourcesSuccess) &&
		'resourcesError' in data &&
		Array.isArray(data.resourcesError)
	);
}

// // Type guard to check if bbResponse is a string
// function isString(value: unknown): value is string {
// 	return typeof value === 'string';
// }

Deno.test({
	name: 'ForgetResourcesTool - Forget existing resources from conversation',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const primaryDsConnection = projectEditor.projectData.getPrimaryDsConnection();

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_resources');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			// Create test resources and add them to the conversation
			await Deno.writeTextFile(join(testProjectRoot, 'file1.txt'), 'Content of file1');
			await Deno.writeTextFile(join(testProjectRoot, 'file2.txt'), 'Content of file2');
			const initialConversation = await projectEditor.initConversation('test-conversation-id');
			initialConversation.addResourceForMessage(primaryDsConnection!.getUriForResource('file:./file1.txt'), {
				contentType: 'text',
				type: 'file',
				size: 'Content of file1'.length,
				lastModified: new Date(),
			}, messageId);
			initialConversation.addResourceForMessage(primaryDsConnection!.getUriForResource('file:./file2.txt'), {
				contentType: 'text',
				type: 'file',
				size: 'Content of file2'.length,
				lastModified: new Date(),
			}, messageId);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_resources',
				toolInput: {
					resources: [{ resourcePath: 'file1.txt', revision: messageId }, {
						resourcePath: 'file2.txt',
						revision: messageId,
					}],
				},
			};

			const result = await tool.runTool(initialConversation, toolUse, projectEditor);
			// console.log('Forget existing resources from conversation - bbResponse:', result.bbResponse);
			// console.log('Forget existing resources from conversation - toolResponse:', result.toolResponse);
			// console.log('Forget existing resources from conversation - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isForgetResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			assertStringIncludes(
				result.toolResponse,
				'Removed resources from the conversation:\n- file1.txt (Revision: 1111-2222)\n- file2.txt (Revision: 1111-2222)',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const firstResult = result.toolResults[0];
			assert(firstResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(firstResult.text, 'Used data source: primary');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(secondResult.text, 'Resource removed: file1.txt');

			const thirdResult = result.toolResults[2];
			assert(thirdResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(thirdResult.text, 'Resource removed: file2.txt');

			// Check if resources are removed from the conversation
			const conversation = await projectEditor.initConversation('test-conversation-id');
			const resource1 = conversation.getResourceRevisionMetadata(
				generateResourceRevisionKey(primaryDsConnection!.getUriForResource('file:./file1.txt'), '1'),
			);
			const resource2 = conversation.getResourceRevisionMetadata(
				generateResourceRevisionKey(primaryDsConnection!.getUriForResource('file:./file2.txt'), '2'),
			);
			assertEquals(resource1, undefined, 'file1.txt should not exist in the conversation');
			assertEquals(resource2, undefined, 'file2.txt should not exist in the conversation');

			// Check if listResources doesn't return the removed resources
			const resourceList = conversation.listResources();
			assertEquals(resourceList?.includes('file1.txt'), false, 'file1.txt should not be in the resource list');
			assertEquals(resourceList?.includes('file2.txt'), false, 'file2.txt should not be in the resource list');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetResourcesTool - Attempt to forget non-existent resource',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_resources');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_resources',
				toolInput: {
					resources: [{ resourcePath: 'non_existent.txt', revision: messageId }],
				},
			};

			const conversation = await projectEditor.initConversation('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Attempt to forget non-existent resource - bbResponse:', result.bbResponse);
			// console.log('Attempt to forget non-existent resource - toolResponse:', result.toolResponse);
			// console.log('Attempt to forget non-existent resource - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isForgetResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			assertStringIncludes(
				result.toolResponse,
				'non_existent.txt (1111-2222): Resource is not in the conversation history',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(secondResult.text, 'non_existent.txt: Resource is not in the conversation history');

			// Check that listResources doesn't include the non-existent resource
			const resourceList = conversation.listResources();
			assertEquals(
				resourceList?.includes('non_existent.txt'),
				false,
				'non_existent.txt should not be in the resource list',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'ForgetResourcesTool - Forget mix of existing and non-existent resources',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);
			const primaryDsConnection = projectEditor.projectData.getPrimaryDsConnection();

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('forget_resources');
			assert(tool, 'Failed to get tool');

			const messageId = '1111-2222';
			// Create test resource and add it to the conversation
			await Deno.writeTextFile(join(testProjectRoot, 'existing_file.txt'), 'Content of existing resource');
			const conversation = await projectEditor.initConversation('test-conversation-id');
			conversation.addResourceForMessage(primaryDsConnection!.getUriForResource('file:./existing_file.txt'), {
				contentType: 'text',
				type: 'file',
				size: 'Content of existing resource'.length,
				lastModified: new Date(),
			}, messageId);

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'forget_resources',
				toolInput: {
					resources: [{ resourcePath: 'existing_file.txt', revision: messageId }, {
						resourcePath: 'non_existent_file.txt',
						revision: messageId,
					}],
				},
			};

			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Forget mix of existing and non-existent resources - bbResponse:', result.bbResponse);
			// console.log('Forget mix of existing and non-existent resources - toolResponse:', result.toolResponse);
			// console.log('Forget mix of existing and non-existent resources - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isForgetResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for Tool',
			);

			assertStringIncludes(result.toolResponse, 'Removed resources from the conversation:\n- existing_file.txt');
			assertStringIncludes(
				result.toolResponse,
				'Failed to remove resources from the conversation:\n- non_existent_file.txt (1111-2222): Resource is not in the conversation history',
			);

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const secondResult = result.toolResults[1];
			assert(secondResult.type === 'text', 'First result should be of type text');
			assertStringIncludes(secondResult.text, 'Resource removed: existing_file.txt (Revision: 1111-2222)');

			const thirdResult = result.toolResults[2];
			assert(thirdResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(
				thirdResult.text,
				'Error removing resource non_existent_file.txt: Resource is not in the conversation history',
			);

			// Check if existing resource is forgotten from the conversation
			const existingResource = conversation.getResourceRevisionMetadata(
				generateResourceRevisionKey(primaryDsConnection!.getUriForResource('file:./existing_file.txt'), '1'),
			);
			assertEquals(existingResource, undefined, 'existing_file.txt should not exist in the conversation');

			// Check that listResources doesn't include either resource
			const resourceList = conversation.listResources();
			assertEquals(
				resourceList?.includes('existing_file.txt'),
				false,
				'existing_file.txt should not be in the resource list',
			);
			assertEquals(
				resourceList?.includes('non_existent_file.txt'),
				false,
				'non_existent_file.txt should not be in the resource list',
			);
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
