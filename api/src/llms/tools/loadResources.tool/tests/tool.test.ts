import { assert, assertEquals, assertStringIncludes } from 'api/tests/deps.ts';
import { join } from '@std/path';

import type { LLMAnswerToolUse } from 'api/llms/llmMessage.ts';
import { getProjectEditor, getToolManager, withTestProject } from 'api/tests/testSetup.ts';
import type { LLMToolLoadResourcesResponseData } from '../types.ts';

// Type guard for response validation
export function isLoadResourcesResponse(
	response: unknown,
): response is LLMToolLoadResourcesResponseData {
	const data = response && typeof response === 'object' && 'data' in response
		? (response as { data: unknown }).data
		: null;
	return (
		data !== null &&
		typeof data === 'object' &&
		'resourcesAdded' in data &&
		Array.isArray((data as { resourcesAdded: unknown }).resourcesAdded) &&
		'resourcesError' in data &&
		Array.isArray((data as { resourcesError: unknown }).resourcesError)
	);
}

Deno.test({
	name: 'LoadResourcesTool - Template Mode - Load existing resources',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Create test resources
			await Deno.writeTextFile(join(testProjectRoot, 'file1.txt'), 'Content of file1');
			await Deno.writeTextFile(join(testProjectRoot, 'file2.txt'), 'Content of file2');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'template',
					uriTemplate: 'file:./{path}',
					templateResources: [
						{ path: 'file1.txt' },
						{ path: 'file2.txt' },
					],
				},
			};

			const initialCollaboration = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(initialCollaboration, toolUse, projectEditor);
			// console.log('Template Mode - Load existing resources - bbResponse:', result.bbResponse);
			// console.log('Template Mode - Load existing resources - toolResponse:', result.toolResponse);
			// console.log('Template Mode - Load existing resources - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					2,
					'Should have 2 successful resource additions',
				);

				assert(
					result.bbResponse.data.resourcesAdded.some((r) => r.includes('file1.txt')),
					'Should have a result for loaded file1.txt',
				);
				assert(
					result.bbResponse.data.resourcesAdded.some((r) => r.includes('file2.txt')),
					'Should have a result for loaded file2.txt',
				);

				assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no load resource errors');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'Added resources to the conversation');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const firstResourceResult = result.toolResults[1];
			assert(firstResourceResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(firstResourceResult.text, 'Resource added');
			assertStringIncludes(firstResourceResult.text, 'file1.txt');

			const secondResourceResult = result.toolResults[2];
			assert(secondResourceResult.type === 'text', 'Third result should be of type text');
			assertStringIncludes(secondResourceResult.text, 'Resource added');
			assertStringIncludes(secondResourceResult.text, 'file2.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - Direct Mode - Load existing resources',
	fn: async () => {
		await withTestProject(async (testProjectId, testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			// Create test resources
			await Deno.writeTextFile(join(testProjectRoot, 'file3.txt'), 'Content of file3');
			await Deno.writeTextFile(join(testProjectRoot, 'file4.txt'), 'Content of file4');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'direct',
					directUris: [
						'file:./file3.txt',
						'file:./file4.txt',
					],
				},
			};

			const initialCollaboration = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(initialCollaboration, toolUse, projectEditor);
			// console.log('Direct Mode - Load existing resources - bbResponse:', result.bbResponse);
			// console.log('Direct Mode - Load existing resources - toolResponse:', result.toolResponse);
			// console.log('Direct Mode - Load existing resources - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesAdded.length,
					2,
					'Should have 2 successful resource additions',
				);

				assert(
					result.bbResponse.data.resourcesAdded.some((r) => r.includes('file3.txt')),
					'Should have a result for loaded file3.txt',
				);
				assert(
					result.bbResponse.data.resourcesAdded.some((r) => r.includes('file4.txt')),
					'Should have a result for loaded file4.txt',
				);

				assertEquals(result.bbResponse.data.resourcesError.length, 0, 'Should have no load resource errors');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'Added resources to the conversation');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 3, 'toolResults should have 3 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const firstResourceResult = result.toolResults[1];
			assert(firstResourceResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(firstResourceResult.text, 'Resource added');
			assertStringIncludes(firstResourceResult.text, 'file3.txt');

			const secondResourceResult = result.toolResults[2];
			assert(secondResourceResult.type === 'text', 'Third result should be of type text');
			assertStringIncludes(secondResourceResult.text, 'Resource added');
			assertStringIncludes(secondResourceResult.text, 'file4.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - Template Mode - Load non-existent resource',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'template',
					uriTemplate: 'file:./{path}',
					templateResources: [
						{ path: 'non_existent.txt' },
					],
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Template Mode - Load non-existent resource - bbResponse:', result.bbResponse);
			// console.log('Template Mode - Load non-existent resource - toolResponse:', result.toolResponse);
			// console.log('Template Mode - Load non-existent resource - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					1,
					'Should have 1 resource error',
				);

				assert(
					result.bbResponse.data.resourcesError.some((f) => f.includes('non_existent.txt')),
					'Should have an error for non_existent.txt',
				);

				assertEquals(result.bbResponse.data.resourcesAdded.length, 0, 'Should have no added resources');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'No resources added');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const errorResult = result.toolResults[1];
			assert(errorResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(errorResult.text, 'Error adding resource');
			assertStringIncludes(errorResult.text, 'non_existent.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - Direct Mode - Load non-existent resource',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'direct',
					directUris: [
						'file:./non_existent.txt',
					],
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			console.log('Direct Mode - Load non-existent resource - bbResponse:', result.bbResponse);
			console.log('Direct Mode - Load non-existent resource - toolResponse:', result.toolResponse);
			console.log('Direct Mode - Load non-existent resource - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					1,
					'Should have 1 resource error',
				);

				assert(
					result.bbResponse.data.resourcesError.some((f) => f.includes('non_existent.txt')),
					'Should have an error for non_existent.txt',
				);

				assertEquals(result.bbResponse.data.resourcesAdded.length, 0, 'Should have no added resources');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'No resources added');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const errorResult = result.toolResults[1];
			assert(errorResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(errorResult.text, 'Error adding resource');
			assertStringIncludes(errorResult.text, 'non_existent.txt');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - Template Mode - Resource outside project root',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'template',
					uriTemplate: 'file:./{path}',
					templateResources: [
						{ path: '../outside_project.txt' },
					],
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Template Mode - Resource outside project root - bbResponse:', result.bbResponse);
			// console.log('Template Mode - Resource outside project root - toolResponse:', result.toolResponse);
			// console.log('Template Mode - Resource outside project root - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					1,
					'Should have 1 resource error',
				);

				assert(
					result.bbResponse.data.resourcesError.some((f) => f.includes('../outside_project.txt')),
					'Should have an error for ../outside_project.txt',
				);

				assertEquals(result.bbResponse.data.resourcesAdded.length, 0, 'Should have no added resources');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'Failed to load resource: File not found');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const errorResult = result.toolResults[1];
			assert(errorResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(errorResult.text, 'Failed to load resource: File not found');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});

Deno.test({
	name: 'LoadResourcesTool - Direct Mode - Resource outside project root',
	fn: async () => {
		await withTestProject(async (testProjectId, _testProjectRoot) => {
			const projectEditor = await getProjectEditor(testProjectId);

			const toolManager = await getToolManager(projectEditor);
			const tool = await toolManager.getTool('load_resources');
			assert(tool, 'Failed to get tool');

			const toolUse: LLMAnswerToolUse = {
				toolValidation: { validated: true, results: '' },
				toolUseId: 'test-id',
				toolName: 'load_resources',
				toolInput: {
					mode: 'direct',
					directUris: [
						'file:./../outside_project.txt',
					],
				},
			};

			const conversation = await projectEditor.initCollaboration('test-conversation-id');
			const result = await tool.runTool(conversation, toolUse, projectEditor);
			// console.log('Direct Mode - Resource outside project root - bbResponse:', result.bbResponse);
			// console.log('Direct Mode - Resource outside project root - toolResponse:', result.toolResponse);
			// console.log('Direct Mode - Resource outside project root - toolResults:', result.toolResults);

			assert(
				result.bbResponse && typeof result.bbResponse === 'object',
				'bbResponse should be an object',
			);
			assertEquals(typeof result.toolResponse, 'string');
			assertEquals(typeof result.toolResults, 'object');

			assert(
				isLoadResourcesResponse(result.bbResponse),
				'bbResponse should have the correct structure for LoadResourcesTool',
			);

			if (isLoadResourcesResponse(result.bbResponse)) {
				assertEquals(
					result.bbResponse.data.resourcesError.length,
					1,
					'Should have 1 resource error',
				);

				assert(
					result.bbResponse.data.resourcesError.some((f) => f.includes('../outside_project.txt')),
					'Should have an error for ../outside_project.txt',
				);

				assertEquals(result.bbResponse.data.resourcesAdded.length, 0, 'Should have no added resources');
			} else {
				assert(false, 'bbResponse does not have the expected structure for LoadResourcesTool');
			}

			assertStringIncludes(result.toolResponse, 'Failed to load resource: File not found');

			// Check toolResults
			assert(Array.isArray(result.toolResults), 'toolResults should be an array');
			assert(result.toolResults.length > 0, 'toolResults should not be empty');
			assert(result.toolResults.length === 2, 'toolResults should have 2 elements');

			const dataSourceInfo = result.toolResults[0];
			assert(dataSourceInfo.type === 'text', 'First result should be of type text');
			assertStringIncludes(dataSourceInfo.text, 'Used data source:');

			const errorResult = result.toolResults[1];
			assert(errorResult.type === 'text', 'Second result should be of type text');
			assertStringIncludes(errorResult.text, 'Failed to load resource: File not found');
		});
	},
	sanitizeResources: false,
	sanitizeOps: false,
});
